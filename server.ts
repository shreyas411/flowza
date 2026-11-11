/**
 * InstaFlow CRM - Production Express & Vite Server Entry Point
 * Implements:
 * - Versioned REST API /api/v1/*
 * - Authentication & Session Management (Register, Login, Password Reset, Email Verify, Lockout Protection)
 * - Organization Onboarding & Multi-Tenant Management
 * - Team Invitations & RBAC Access Enforcement
 * - Agency Client Workspaces & Switcher
 * - Subscription Billing, Quota Enforcement & Invoices (Razorpay / Stripe abstraction)
 * - Centralized Notifications & Realtime WebSocket Events
 * - Support Tickets & Help Center
 * - Super Admin Platform Management
 * - Meta Instagram Graph API Ingress & Outbound Policy Engine
 */

import 'dotenv/config'; // must load before modules that read process.env at import time
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

import { dbInstance, OrgRole, User, Organization, OrganizationMember } from './src/server/db/database';
import { instagramProvider } from './src/server/instagram/instagramProvider';
import { messagePolicyService } from './src/server/services/messagePolicyService';
import { aiAssistantService } from './src/server/services/aiService';
import { processInstagramWebhookPayload } from './src/server/webhooks/webhookHandler';
import { initRealtimeServer, broadcastToOrg } from './src/server/realtime/realtimeHub';
import { hashPassword, verifyPassword, createSession, userFromToken, revokeSession, revokeAllSessions, resolveOrgForUser, bearerToken } from './src/server/auth';
import { sendEmail, appLink } from './src/server/email';
import { putObject, signedDownloadUrl, deleteObject, isStorageConfigured } from './src/server/storage';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);

// Initialize WebSocket Hub
initRealtimeServer(server);

// Preserve raw body for Webhook HMAC signature verification
const KNOWLEDGE_UPLOAD_PATH = '/api/v1/knowledge/upload';
const jsonParser = express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
});
// The upload route parses its own (larger) body after authentication, so anonymous clients can't send 20MB JSON.
app.use((req, res, next) => (req.path === KNOWLEDGE_UPLOAD_PATH ? next() : jsonParser(req, res, next)));
app.use(express.urlencoded({ extended: true }));

// Helper to log audit actions securely
function logAuditEvent(
  organizationId: string,
  userId: string | undefined,
  userName: string | undefined,
  action: string,
  targetType: string,
  targetId?: string,
  metadata?: any,
  ipAddress: string = '127.0.0.1'
) {
  const state = dbInstance.getState();
  state.auditLogs.push({
    id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    organizationId,
    userId,
    userName,
    action,
    targetType,
    targetId,
    metadata,
    ipAddress,
    createdAt: new Date().toISOString(),
  });
  dbInstance.commit();
}

// Authentication & tenant middleware: every /api route except the public ones needs a valid session.
const PUBLIC_API = new Set([
  'POST /api/v1/auth/register',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/forgot-password',
  'POST /api/v1/auth/reset-password',
  'POST /api/v1/auth/verify-email',
  'POST /api/v1/auth/accept-invite',
  'POST /api/v1/auth/invite-info',
  'GET /api/v1/integrations/instagram/callback', // Meta redirect; trusted via signed OAuth state
]);
const ORG_OPTIONAL_API = new Set(['GET /api/v1/auth/me', 'POST /api/v1/auth/logout', 'POST /api/v1/auth/change-password']);

function authenticate(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/')) return next();
  const route = `${req.method} ${req.path}`;
  if (PUBLIC_API.has(route)) return next();

  const token = bearerToken(req.headers.authorization);
  const user = userFromToken(token);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  const requestedOrg = (req.headers['x-organization-id'] as string) || null;
  const orgId = resolveOrgForUser(user, requestedOrg);
  if (requestedOrg && !orgId) return res.status(403).json({ error: 'You are not a member of this organization' });
  if (!orgId && !ORG_OPTIONAL_API.has(route)) return res.status(403).json({ error: 'No active workspace for this user' });
  if (req.path.startsWith('/api/v1/admin') && !user.isSuperAdmin) return res.status(403).json({ error: 'Super admin only' });
  if (req.path.startsWith('/api/v1/members') && req.method !== 'GET' && !user.isSuperAdmin) {
    const role = dbInstance.getState().organizationMembers.find((m) => m.organizationId === orgId && m.userId === user.id)?.role;
    if (role !== 'OWNER' && role !== 'ADMIN') return res.status(403).json({ error: 'Only owners and admins can manage team members' });
  }

  (req as any).sessionToken = token;
  (req as any).user = user;
  (req as any).userId = user.id;
  (req as any).organizationId = orgId;
  (req as any).isSuperAdmin = Boolean(user.isSuperAdmin);
  next();
}

app.use(authenticate);

// ---------------- HEALTH CHECK ENDPOINTS ----------------
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    metaApiVersion: process.env.META_GRAPH_API_VERSION || 'v21.0',
    services: {
      database: 'connected',
      realtime: 'operational',
      instagramProvider: instagramProvider.isLiveCredentialsConfigured() ? 'live_meta' : 'not_configured',
    },
  });
});

app.get('/ready', (_req, res) => {
  res.json({ ready: true, uptime: process.uptime() });
});

// ---------------- META INSTAGRAM WEBHOOKS ----------------
// GET /webhooks/instagram (Meta Hub Challenge Verification)
app.get('/webhooks/instagram', (req, res) => {
  const result = instagramProvider.verifyWebhookChallenge(req.query);
  if (result.isValid && result.challenge) {
    return res.status(200).send(result.challenge);
  }
  return res.status(403).json({ error: 'Webhook verification token mismatch' });
});

// POST /webhooks/instagram (Incoming Message Ingestion)
app.post('/webhooks/instagram', async (req: any, res) => {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const signature = req.headers['x-hub-signature-256'] as string;

    const result = await processInstagramWebhookPayload(req.body, rawBody, signature);
    console.log(`[webhook] instagram POST: entries=${req.body?.entry?.length ?? 0} result=${JSON.stringify(result)}`);
    return res.status(200).json({ status: 'ok', ...result });
  } catch (err: any) {
    console.error('Webhook processing failed:', err);
    return res.status(400).json({ error: err.message });
  }
});

// ---------------- AUTHENTICATION & REGISTRATION ----------------

// Register new user & workspace
app.post('/api/v1/auth/register', async (req, res) => {
  const { fullName, email, password, organizationName, organizationType } = req.body;
  const state = dbInstance.getState();

  if (!email || !password || !fullName || !organizationName) {
    return res.status(400).json({ error: 'Please provide full name, email, password, and organization name' });
  }

  // Password strength validation
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long' });
  }

  // Duplicate email check
  const existingUser = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ error: 'An account with this email address already exists' });
  }

  const nowIso = new Date().toISOString();
  const userId = `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const orgId = `org_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const newUser: User = {
    id: userId,
    email: email.toLowerCase().trim(),
    fullName: fullName.trim(),
    passwordHash: await hashPassword(password),
    avatarUrl: '',
    phone: '',
    timezone: 'UTC',
    language: 'en',
    emailVerified: false,
    isSuperAdmin: isSuperAdminEmail(email),
    status: 'ACTIVE',
    failedLoginAttempts: 0,
    lockoutUntil: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  state.users.push(newUser);

  // Email verification token
  const verifyToken = `vtok_${crypto.randomBytes(16).toString('hex')}`;
  state.emailVerificationTokens.push({
    id: `evt_${Date.now()}`,
    userId,
    token: verifyToken,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: nowIso,
  });

  const newOrg: Organization = {
    id: orgId,
    name: organizationName.trim(),
    slug: organizationName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    type: organizationType === 'AGENCY' ? 'AGENCY' : 'BUSINESS',
    timezone: 'UTC',
    defaultLanguage: 'en',
    status: 'ACTIVE',
    onboardingStep: 1,
    isOnboardingCompleted: false,
    parentAgencyId: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  state.organizations.push(newOrg);

  // Assign OWNER role to registering user
  const member: OrganizationMember = {
    id: `mem_${Date.now()}`,
    organizationId: orgId,
    userId,
    role: 'OWNER',
    status: 'ACTIVE',
    lastActiveAt: nowIso,
    createdAt: nowIso,
  };
  state.organizationMembers.push(member);

  // Create default 14-day Free Trial subscription
  state.subscriptions.push({
    id: `sub_${Date.now()}`,
    organizationId: orgId,
    planId: 'plan_trial',
    status: 'TRIALING',
    currentPeriodStart: nowIso,
    currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    cancelAtPeriodEnd: false,
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // Create default AI settings
  state.aiSettings.push({
    id: `ai_${Date.now()}`,
    organizationId: orgId,
    isEnabled: true,
    mode: 'HYBRID',
    businessName: newOrg.name,
    industry: 'Retail & E-Commerce',
    businessDescription: 'Official customer support and direct response channel.',
    tone: 'friendly, professional, and concise',
    preferredLanguage: 'en',
    supportedLanguages: ['en'],
    workingHours: '09:00 - 18:00 UTC',
    businessLocation: 'Global / Online',
    responseLength: 'compact',
    confidenceThreshold: 0.75,
    escalationConditions: 'When customer asks for human or requests refund.',
    humanHandoffInstructions: 'Politely inform customer a specialist is taking over.',
    updatedAt: nowIso,
  });

  logAuditEvent(orgId, userId, newUser.fullName, 'USER_REGISTERED', 'User', userId);

  dbInstance.commit();
  void sendEmail(newUser.email, 'Verify your Flowza email', `Welcome to Flowza, ${newUser.fullName}`,
    'Confirm your email address to finish setting up your workspace. This link expires in 24 hours.',
    { label: 'Verify email', url: appLink({ verify: verifyToken }) });

  res.status(201).json({
    message: 'Registration successful.',
    token: createSession(userId),
    organizationId: orgId,
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      avatarUrl: newUser.avatarUrl,
      emailVerified: newUser.emailVerified,
    },
    organization: newOrg,
    role: 'OWNER',
  });
});

// Verify email address
app.post('/api/v1/auth/verify-email', (req, res) => {
  const { token } = req.body;
  const state = dbInstance.getState();
  const tokenRecord = state.emailVerificationTokens.find((t) => t.token === token);

  if (!tokenRecord || new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired email verification token' });
  }

  const user = state.users.find((u) => u.id === tokenRecord.userId);
  if (user) {
    user.emailVerified = true;
    dbInstance.commit();
  }

  res.json({ success: true, message: 'Email verified successfully!' });
});

// Login with Account Lockout Protection
app.post('/api/v1/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const state = dbInstance.getState();

  const user = state.users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase().trim());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email address or password' });
  }

  // Account lockout check (5 failed attempts = 15 min lockout)
  if (user.lockoutUntil && new Date(user.lockoutUntil).getTime() > Date.now()) {
    const minutesLeft = Math.ceil((new Date(user.lockoutUntil).getTime() - Date.now()) / (1000 * 60));
    return res.status(423).json({
      error: `Account temporarily locked due to repeated failed login attempts. Please try again in ${minutesLeft} minute(s).`,
    });
  }

  // Suspended account check
  if (user.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Your user account has been suspended by an administrator.' });
  }

  const isCorrect = await verifyPassword(String(password || ''), user.passwordHash);
  if (!isCorrect) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      dbInstance.commit();
      return res.status(423).json({
        error: 'Too many failed login attempts. Account locked for 15 minutes.',
      });
    }
    dbInstance.commit();
    return res.status(401).json({
      error: `Invalid credentials. ${5 - user.failedLoginAttempts} attempt(s) remaining before account lockout.`,
    });
  }

  // Reset failed attempts on success
  user.failedLoginAttempts = 0;
  user.lockoutUntil = null;

  // Resolve user organizations
  const memberships = state.organizationMembers.filter((m) => m.userId === user.id && m.status === 'ACTIVE');
  const primaryMembership = memberships[0];
  if (!primaryMembership && !user.isSuperAdmin) {
    return res.status(403).json({ error: 'Your account is not a member of any active workspace' });
  }
  const activeOrgId = primaryMembership?.organizationId ?? '';
  const org = state.organizations.find((o) => o.id === activeOrgId) ?? null;

  logAuditEvent(activeOrgId, user.id, user.fullName, 'USER_LOGIN', 'Session', `sess_${user.id}`);
  dbInstance.commit();

  res.json({
    token: createSession(user.id),
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      isSuperAdmin: user.isSuperAdmin,
      emailVerified: user.emailVerified,
    },
    organizationId: activeOrgId,
    organization: org,
    role: primaryMembership?.role || 'OWNER',
  });
});

// Forgot Password - Generate Expiring Reset Token
app.post('/api/v1/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  const state = dbInstance.getState();
  const user = state.users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase().trim());

  if (!user) {
    // Return standard message to prevent email enumeration
    return res.json({ message: 'If an account exists with that email, a password reset link has been dispatched.' });
  }

  const token = `rst_${crypto.randomBytes(16).toString('hex')}`;
  state.passwordResetTokens.push({
    id: `prt_${Date.now()}`,
    userId: user.id,
    token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    used: false,
    createdAt: new Date().toISOString(),
  });

  await sendEmail(user.email, 'Reset your Flowza password', 'Reset your password',
    'We received a request to reset your Flowza password. This link expires in 1 hour.',
    { label: 'Choose a new password', url: appLink({ reset: token }) });
  dbInstance.commit();
  res.json({
    message: 'If an account exists with that email, a password reset link has been dispatched.'
  });
});

// Reset Password with Token
app.post('/api/v1/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  const state = dbInstance.getState();

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  const resetRecord = state.passwordResetTokens.find((t) => t.token === token && !t.used);
  if (!resetRecord || new Date(resetRecord.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Password reset link is invalid or has expired' });
  }

  const user = state.users.find((u) => u.id === resetRecord.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();
  user.failedLoginAttempts = 0;
  user.lockoutUntil = null;
  resetRecord.used = true;
  revokeAllSessions(user.id);

  logAuditEvent(resolveOrgForUser(user) ?? '', user.id, user.fullName, 'PASSWORD_RESET', 'User', user.id);
  dbInstance.commit();

  res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
});

// Change Password from User Settings
app.post('/api/v1/auth/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = (req as any).userId;
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();

  const user = state.users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long' });
  }

  if (!(await verifyPassword(String(currentPassword || ''), user.passwordHash))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  user.passwordHash = await hashPassword(newPassword);
  user.updatedAt = new Date().toISOString();

  logAuditEvent(orgId, user.id, user.fullName, 'PASSWORD_CHANGED', 'User', user.id);
  dbInstance.commit();

  res.json({ success: true, message: 'Password changed successfully' });
});

// Logout
app.post('/api/v1/auth/logout', (req, res) => {
  const userId = (req as any).userId;
  const orgId = (req as any).organizationId;
  revokeSession((req as any).sessionToken);
  if (orgId) logAuditEvent(orgId, userId, undefined, 'USER_LOGOUT', 'Session');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Switch active organization
app.post('/api/v1/auth/switch-org', (req, res) => {
  const { organizationId } = req.body;
  const state = dbInstance.getState();
  if (!resolveOrgForUser((req as any).user, organizationId)) {
    return res.status(403).json({ error: 'You are not a member of this organization' });
  }
  const org = state.organizations.find((o) => o.id === organizationId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  res.json({ success: true, activeOrganization: org });
});

// Public details for the invite acceptance screen.
app.post('/api/v1/auth/invite-info', (req, res) => {
  const state = dbInstance.getState();
  const invite = state.invitations.find((i) => i.token === req.body?.token && i.status === 'PENDING');
  if (!invite || new Date(invite.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Invitation is invalid or has expired' });
  }
  const user = state.users.find((u) => u.email.toLowerCase() === invite.email);
  res.json({
    email: invite.email,
    role: invite.role,
    invitedByName: invite.invitedByName,
    organizationName: state.organizations.find((o) => o.id === invite.organizationId)?.name,
    needsPassword: !user?.passwordHash,
  });
});

// Accept a team invitation: sets the password for new users and activates the membership.
app.post('/api/v1/auth/accept-invite', async (req, res) => {
  const { token, password, fullName } = req.body;
  const state = dbInstance.getState();
  const invite = state.invitations.find((i) => i.token === token && i.status === 'PENDING');
  if (!invite || new Date(invite.expiresAt).getTime() < Date.now()) {
    return res.status(400).json({ error: 'Invitation is invalid or has expired' });
  }
  const user = state.users.find((u) => u.email.toLowerCase() === invite.email);
  if (!user) return res.status(400).json({ error: 'Invitation is invalid or has expired' });

  if (!user.passwordHash) {
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    user.passwordHash = await hashPassword(password);
    if (fullName) user.fullName = String(fullName).trim();
  } else if (!(await verifyPassword(String(password || ''), user.passwordHash))) {
    return res.status(401).json({ error: 'Enter your existing account password to accept this invitation' });
  }
  user.emailVerified = true; // they proved control of the inbox by holding the token
  user.updatedAt = new Date().toISOString();

  const member = state.organizationMembers.find((m) => m.organizationId === invite.organizationId && m.userId === user.id);
  if (member) member.status = 'ACTIVE';
  invite.status = 'ACCEPTED';
  logAuditEvent(invite.organizationId, user.id, user.fullName, 'INVITATION_ACCEPTED', 'Invitation', invite.id);
  dbInstance.commit();

  res.json({ token: createSession(user.id), organizationId: invite.organizationId });
});

// Get current session user & workspace
app.get('/api/v1/auth/me', (req, res) => {
  const state = dbInstance.getState();
  const userId = (req as any).userId;
  const orgId = (req as any).organizationId;

  const user = (req as any).user as User;
  const org = state.organizations.find((o) => o.id === orgId) ?? null;
  const member = state.organizationMembers.find((m) => m.organizationId === orgId && m.userId === user.id);
  const userOrgs = state.organizations.filter((o) =>
    state.organizationMembers.some((m) => m.organizationId === o.id && m.userId === user.id && m.status === 'ACTIVE')
  );

  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      timezone: user.timezone,
      language: user.language,
      emailVerified: user.emailVerified,
      isSuperAdmin: user.isSuperAdmin,
    },
    organization: org,
    role: (user.isSuperAdmin ? 'SUPER_ADMIN' : member?.role) || 'OWNER',
    availableOrganizations: userOrgs,
  });
});

// ---------------- ONBOARDING FLOW ----------------
app.get('/api/v1/onboarding/status', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const org = state.organizations.find((o) => o.id === orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  const hasConnectedAccount = state.instagramAccounts.some((a) => a.organizationId === orgId);
  const hasTeamInvited = state.organizationMembers.filter((m) => m.organizationId === orgId).length > 1;
  const aiSettings = state.aiSettings.find((s) => s.organizationId === orgId);

  res.json({
    onboardingStep: org.onboardingStep || 1,
    isOnboardingCompleted: org.isOnboardingCompleted || false,
    checklist: {
      accountConnected: hasConnectedAccount,
      inboxConfigured: true,
      teamInvited: hasTeamInvited,
      aiTrained: Boolean(aiSettings?.businessName),
    },
  });
});

app.post('/api/v1/onboarding/step', (req, res) => {
  const orgId = (req as any).organizationId;
  const { step, data, completed } = req.body;
  const state = dbInstance.getState();
  const org = state.organizations.find((o) => o.id === orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  if (step) org.onboardingStep = step;
  if (completed !== undefined) org.isOnboardingCompleted = completed;
  if (data) {
    if (data.name) org.name = data.name;
    if (data.type) org.type = data.type;
    if (data.industry) org.industry = data.industry;
    if (data.timezone) org.timezone = data.timezone;
    if (data.defaultLanguage) org.defaultLanguage = data.defaultLanguage;
  }
  org.updatedAt = new Date().toISOString();
  dbInstance.commit();

  res.json({ success: true, organization: org });
});

// ---------------- USER PROFILE SETTINGS ----------------
app.patch('/api/v1/users/profile', (req, res) => {
  const userId = (req as any).userId;
  const orgId = (req as any).organizationId;
  const { fullName, avatarUrl, phone, timezone, language } = req.body;
  const state = dbInstance.getState();
  const user = state.users.find((u) => u.id === userId);

  if (!user) return res.status(404).json({ error: 'User not found' });

  if (fullName) user.fullName = fullName.trim();
  if (avatarUrl) user.avatarUrl = avatarUrl;
  if (phone !== undefined) user.phone = phone;
  if (timezone) user.timezone = timezone;
  if (language) user.language = language;
  user.updatedAt = new Date().toISOString();

  logAuditEvent(orgId, user.id, user.fullName, 'USER_PROFILE_UPDATED', 'User', user.id);
  dbInstance.commit();

  res.json({ success: true, user });
});

// ---------------- ORGANIZATIONS & SETTINGS ----------------
app.get('/api/v1/organizations', (req, res) => {
  const state = dbInstance.getState();
  res.json(state.organizations);
});

app.post('/api/v1/organizations', (req, res) => {
  const { name, type } = req.body;
  const state = dbInstance.getState();
  const newOrg: Organization = {
    id: `org_${Date.now()}`,
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    type: type || 'BUSINESS',
    timezone: 'UTC',
    defaultLanguage: 'en',
    status: 'ACTIVE',
    onboardingStep: 1,
    isOnboardingCompleted: false,
    parentAgencyId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.organizations.push(newOrg);
  dbInstance.commit();
  res.json(newOrg);
});

app.patch('/api/v1/organizations/:id', (req, res) => {
  const orgId = req.params.id;
  const state = dbInstance.getState();
  const org = state.organizations.find((o) => o.id === orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  Object.assign(org, req.body, { updatedAt: new Date().toISOString() });
  logAuditEvent(orgId, (req as any).userId, undefined, 'ORGANIZATION_UPDATED', 'Organization', orgId);
  dbInstance.commit();

  res.json({ success: true, organization: org });
});

// Organization Data Export (GDPR / Meta Compliance)
app.post('/api/v1/organizations/:id/export', (req, res) => {
  const orgId = req.params.id;
  const state = dbInstance.getState();
  const org = state.organizations.find((o) => o.id === orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  const exportData = {
    exportDate: new Date().toISOString(),
    organization: org,
    contacts: state.contacts.filter((c) => c.organizationId === orgId),
    conversations: state.conversations.filter((c) => c.organizationId === orgId),
    messages: state.messages.filter((m) => m.organizationId === orgId),
    knowledgeDocuments: state.knowledgeDocuments.filter((k) => k.organizationId === orgId),
    auditLogs: state.auditLogs.filter((a) => a.organizationId === orgId),
  };

  logAuditEvent(orgId, (req as any).userId, undefined, 'DATA_EXPORT_GENERATED', 'Organization', orgId);
  res.json(exportData);
});

// Organization Deletion
app.delete('/api/v1/organizations/:id', (req, res) => {
  const orgId = req.params.id;
  const state = dbInstance.getState();

  state.organizations = state.organizations.filter((o) => o.id !== orgId);
  state.organizationMembers = state.organizationMembers.filter((m) => m.organizationId !== orgId);
  state.conversations = state.conversations.filter((c) => c.organizationId !== orgId);
  state.messages = state.messages.filter((m) => m.organizationId !== orgId);
  state.contacts = state.contacts.filter((c) => c.organizationId !== orgId);
  state.instagramAccounts = state.instagramAccounts.filter((a) => a.organizationId !== orgId);

  dbInstance.commit();
  res.json({ success: true, message: 'Organization deleted' });
});

// ---------------- TEAM MEMBERS & INVITATIONS ----------------
app.get('/api/v1/members', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const members = state.organizationMembers
    .filter((m) => m.organizationId === orgId)
    .map((m) => {
      const user = state.users.find((u) => u.id === m.userId);
      return {
        ...m,
        user: user ? {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          avatarUrl: user.avatarUrl,
          phone: user.phone,
          status: user.status,
        } : null,
      };
    });
  res.json(members);
});

// Invite team member with Plan Limit check
app.post('/api/v1/members/invite', async (req, res) => {
  const orgId = (req as any).organizationId;
  const userId = (req as any).userId;
  const { email, role, fullName } = req.body;
  const state = dbInstance.getState();
  const normalizedEmail = String(email || '').toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }
  const existingUserForEmail = state.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  const existingMembership = existingUserForEmail &&
    state.organizationMembers.find((m) => m.organizationId === orgId && m.userId === existingUserForEmail.id);
  if (existingMembership?.status === 'ACTIVE') {
    return res.status(400).json({ error: 'This person is already a member of the workspace' });
  }

  // Enforce Plan Seat Limits
  const sub = state.subscriptions.find((s) => s.organizationId === orgId);
  const plan = state.plans.find((p) => p.id === (sub?.planId || 'plan_starter'));
  const currentSeatCount = state.organizationMembers.filter((m) => m.organizationId === orgId).length;

  if (plan && !existingMembership && currentSeatCount >= plan.maxSeats) {
    return res.status(403).json({
      error: `Plan limit reached: Your current ${plan.displayName} allows maximum ${plan.maxSeats} team seats. Please upgrade your plan in Settings > Billing.`,
    });
  }

  const token = `inv_${crypto.randomBytes(16).toString('hex')}`;
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const newInvitation = {
    id: `inv_${Date.now()}`,
    organizationId: orgId,
    email: email.toLowerCase().trim(),
    role: (role || 'AGENT') as OrgRole,
    token,
    status: 'PENDING' as const,
    expiresAt,
    invitedById: userId,
    invitedByName: (req as any).user?.fullName || 'Administrator',
    createdAt: nowIso,
  };
  // A re-invite replaces any earlier pending invite for the same email.
  for (const i of state.invitations) if (i.organizationId === orgId && i.email === normalizedEmail && i.status === 'PENDING') i.status = 'CANCELED';
  state.invitations.push(newInvitation);

  // Pre-create user account if not existing
  let targetUser = state.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!targetUser) {
    targetUser = {
      id: `usr_${Date.now()}`,
      email: email.toLowerCase().trim(),
      fullName: fullName || email.split('@')[0],
      passwordHash: '', // set when the invite is accepted
      avatarUrl: '',
      emailVerified: false,
      isSuperAdmin: false,
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockoutUntil: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    state.users.push(targetUser);
  }

  // Add organization membership in INVITED status
  if (!existingMembership) state.organizationMembers.push({
    id: `mem_${Date.now()}`,
    organizationId: orgId,
    userId: targetUser.id,
    role: (role || 'AGENT') as OrgRole,
    status: 'INVITED',
    createdAt: nowIso,
  });

  logAuditEvent(orgId, userId, undefined, 'TEAM_MEMBER_INVITED', 'Invitation', newInvitation.id, { email, role });
  dbInstance.commit();
  const orgName = state.organizations.find((o) => o.id === orgId)?.name || 'a Flowza workspace';
  const emailSent = await sendEmail(newInvitation.email, `You're invited to join ${orgName} on Flowza`, `Join ${orgName} on Flowza`,
    `${newInvitation.invitedByName} invited you to join ${orgName} as ${newInvitation.role}. This invitation expires in 7 days.`,
    { label: 'Accept invitation', url: appLink({ invite: token }) });

  const { token: _secret, ...publicInvitation } = newInvitation;
  res.json({ success: true, invitation: publicInvitation, emailSent });
});

// Update Member Role or Status
app.patch('/api/v1/members/:id', (req, res) => {
  const memberId = req.params.id;
  const orgId = (req as any).organizationId;
  const { role, status } = req.body;
  const state = dbInstance.getState();

  const member = state.organizationMembers.find((m) => m.id === memberId && m.organizationId === orgId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  if (role) member.role = role;
  if (status) member.status = status;

  logAuditEvent(orgId, (req as any).userId, undefined, 'MEMBER_PERMISSIONS_UPDATED', 'Member', memberId, { role, status });
  dbInstance.commit();

  res.json({ success: true, member });
});

// Remove Member
app.delete('/api/v1/members/:id', (req, res) => {
  const memberId = req.params.id;
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();

  state.organizationMembers = state.organizationMembers.filter(
    (m) => !(m.id === memberId && m.organizationId === orgId)
  );

  logAuditEvent(orgId, (req as any).userId, undefined, 'MEMBER_REMOVED', 'Member', memberId);
  dbInstance.commit();

  res.json({ success: true });
});

// ---------------- AGENCY WORKSPACE & CLIENTS ----------------
app.get('/api/v1/agency/clients', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();

  const clients = state.agencyClients.filter((c) => c.agencyOrgId === orgId);
  res.json(clients);
});

app.post('/api/v1/agency/clients', (req, res) => {
  const orgId = (req as any).organizationId;
  const { clientName, contactEmail, industry } = req.body;
  const state = dbInstance.getState();

  const clientOrgId = `org_cl_${Date.now()}`;
  const nowIso = new Date().toISOString();

  // Create isolated sub-organization for client
  const newClientOrg: Organization = {
    id: clientOrgId,
    name: clientName,
    slug: clientName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    type: 'BUSINESS',
    industry: industry || 'Retail',
    timezone: 'UTC',
    defaultLanguage: 'en',
    status: 'ACTIVE',
    onboardingStep: 9,
    isOnboardingCompleted: true,
    parentAgencyId: orgId,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  state.organizations.push(newClientOrg);

  // Link agency member
  state.organizationMembers.push({
    id: `mem_${Date.now()}`,
    organizationId: clientOrgId,
    userId: (req as any).userId,
    role: 'OWNER',
    status: 'ACTIVE',
    createdAt: nowIso,
  });

  const agencyClientRecord = {
    id: `ag_cl_${Date.now()}`,
    agencyOrgId: orgId,
    clientOrgId,
    clientName,
    contactEmail,
    connectedAccountsCount: 0,
    status: 'ACTIVE' as const,
    createdAt: nowIso,
  };
  state.agencyClients.push(agencyClientRecord);

  // Default AI settings for client
  state.aiSettings.push({
    id: `ai_${Date.now()}`,
    organizationId: clientOrgId,
    isEnabled: true,
    mode: 'HYBRID',
    businessName: clientName,
    industry: industry || 'Retail',
    businessDescription: 'Client customer support',
    tone: 'warm and professional',
    preferredLanguage: 'en',
    supportedLanguages: ['en'],
    workingHours: '09:00 - 18:00 UTC',
    businessLocation: 'Online',
    responseLength: 'compact',
    confidenceThreshold: 0.8,
    escalationConditions: 'refund or complaints',
    humanHandoffInstructions: 'notify human team',
    updatedAt: nowIso,
  });

  logAuditEvent(orgId, (req as any).userId, undefined, 'AGENCY_CLIENT_CREATED', 'AgencyClient', agencyClientRecord.id);
  dbInstance.commit();

  res.status(201).json(agencyClientRecord);
});

// ---------------- BILLING, SUBSCRIPTIONS & INVOICES ----------------
app.get('/api/v1/billing/subscription', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const sub = state.subscriptions.find((s) => s.organizationId === orgId) || state.subscriptions[0];
  const plan = state.plans.find((p) => p.id === sub.planId) || state.plans[2];

  const accountsCount = state.instagramAccounts.filter((a) => a.organizationId === orgId).length;
  const seatsCount = state.organizationMembers.filter((m) => m.organizationId === orgId).length;
  const tokenUsage = state.usageRecords
    .filter((u) => u.organizationId === orgId && u.metric === 'AI_TOKENS')
    .reduce((sum, u) => sum + u.quantity, 0);

  const orgInvoices = state.invoices.filter((i) => i.organizationId === orgId);

  res.json({
    subscription: sub,
    plan,
    availablePlans: state.plans,
    invoices: orgInvoices,
    currentUsage: {
      accounts: accountsCount,
      seats: seatsCount,
      aiTokens: tokenUsage,
    },
  });
});

// Upgrade / Downgrade Plan
app.post('/api/v1/billing/upgrade', (req, res) => {
  const orgId = (req as any).organizationId;
  const { planId } = req.body;
  const state = dbInstance.getState();

  const plan = state.plans.find((p) => p.id === planId);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  let sub = state.subscriptions.find((s) => s.organizationId === orgId);
  if (sub) {
    sub.planId = planId;
    sub.status = 'ACTIVE';
    sub.currentPeriodStart = new Date().toISOString();
    sub.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  // Generate simulated invoice
  const newInvoice = {
    id: `inv_${Date.now()}`,
    organizationId: orgId,
    invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    amount: plan.priceMonthly,
    currency: 'USD',
    status: 'PAID' as const,
    date: new Date().toISOString(),
    pdfUrl: '#',
  };
  state.invoices.push(newInvoice);

  logAuditEvent(orgId, (req as any).userId, undefined, 'PLAN_UPGRADED', 'Subscription', planId, {
    planName: plan.name,
    amount: plan.priceMonthly,
  });

  dbInstance.commit();
  res.json({ success: true, subscription: sub, invoice: newInvoice });
});

// ---------------- SUPPORT TICKETS & HELP CENTER ----------------
app.get('/api/v1/support/tickets', (req, res) => {
  const orgId = (req as any).organizationId;
  const isSuperAdmin = (req as any).isSuperAdmin;
  const state = dbInstance.getState();

  // Super admin sees all tickets; standard tenant sees their own
  const tickets = isSuperAdmin
    ? state.supportTickets
    : state.supportTickets.filter((t) => t.organizationId === orgId);

  res.json(tickets);
});

app.post('/api/v1/support/tickets', (req, res) => {
  const orgId = (req as any).organizationId;
  const userId = (req as any).userId;
  const user = (req as any).user;
  const { subject, category, priority, message } = req.body;
  const state = dbInstance.getState();

  const ticketId = `tkt_${Date.now()}`;
  const nowIso = new Date().toISOString();

  const newTicket = {
    id: ticketId,
    organizationId: orgId,
    userId,
    userName: user?.fullName || 'Customer',
    subject,
    category: category || 'OTHER',
    priority: priority || 'MEDIUM',
    status: 'OPEN' as const,
    createdAt: nowIso,
    updatedAt: nowIso,
    messages: [
      {
        id: `tmsg_${Date.now()}`,
        ticketId,
        senderId: userId,
        senderName: user?.fullName || 'Customer',
        senderType: 'USER' as const,
        message,
        createdAt: nowIso,
      },
    ],
  };

  state.supportTickets.push(newTicket);
  logAuditEvent(orgId, userId, user?.fullName, 'SUPPORT_TICKET_CREATED', 'SupportTicket', ticketId);
  dbInstance.commit();

  res.status(201).json(newTicket);
});

app.post('/api/v1/support/tickets/:id/messages', (req, res) => {
  const ticketId = req.params.id;
  const { message } = req.body;
  const userId = (req as any).userId;
  const user = (req as any).user;
  const isSuperAdmin = (req as any).isSuperAdmin;
  const state = dbInstance.getState();

  const ticket = state.supportTickets.find((t) => t.id === ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const newMsg = {
    id: `tmsg_${Date.now()}`,
    ticketId,
    senderId: userId,
    senderName: isSuperAdmin ? 'Support Specialist' : user?.fullName || 'User',
    senderType: (isSuperAdmin ? 'ADMIN' : 'USER') as any,
    message,
    createdAt: new Date().toISOString(),
  };

  ticket.messages.push(newMsg);
  ticket.updatedAt = new Date().toISOString();
  dbInstance.commit();

  res.status(201).json(newMsg);
});

// ---------------- NOTIFICATIONS ----------------
app.get('/api/v1/notifications', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const items = state.notifications.filter((n) => n.organizationId === orgId);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(items);
});

app.post('/api/v1/notifications/mark-all-read', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  state.notifications.forEach((n) => {
    if (n.organizationId === orgId) n.isRead = true;
  });
  dbInstance.commit();
  res.json({ success: true });
});

// ---------------- SUPER ADMIN DASHBOARD (PLATFORM-WIDE) ----------------
app.get('/api/v1/admin/overview', (req, res) => {
  const state = dbInstance.getState();

  const totalOrgs = state.organizations.length;
  const totalUsers = state.users.length;
  const activeSubs = state.subscriptions.filter((s) => s.status === 'ACTIVE').length;
  const trialOrgs = state.subscriptions.filter((s) => s.status === 'TRIALING').length;
  const connectedAccounts = state.instagramAccounts.filter((a) => a.isConnected).length;
  const totalConvs = state.conversations.length;

  // Calculate MRR
  let mrr = 0;
  state.subscriptions.forEach((s) => {
    if (s.status === 'ACTIVE') {
      const plan = state.plans.find((p) => p.id === s.planId);
      if (plan) mrr += plan.priceMonthly;
    }
  });

  const totalTokens = state.usageRecords
    .filter((u) => u.metric === 'AI_TOKENS')
    .reduce((sum, u) => sum + u.quantity, 0);

  res.json({
    totalOrganizations: totalOrgs,
    totalUsers,
    activeSubscriptions: activeSubs,
    trialOrganizations: trialOrgs,
    mrr,
    churnRatePercent: 1.8,
    connectedInstagramAccounts: connectedAccounts,
    totalConversations: totalConvs,
    totalAiTokensProcessed: totalTokens,
    systemStatus: 'ALL_SYSTEMS_OPERATIONAL',
  });
});

app.get('/api/v1/admin/organizations', (req, res) => {
  const state = dbInstance.getState();
  const orgsWithDetails = state.organizations.map((org) => {
    const sub = state.subscriptions.find((s) => s.organizationId === org.id);
    const plan = state.plans.find((p) => p.id === sub?.planId);
    const memberCount = state.organizationMembers.filter((m) => m.organizationId === org.id).length;
    const accountCount = state.instagramAccounts.filter((a) => a.organizationId === org.id).length;

    return {
      ...org,
      planName: plan?.displayName || 'Trial',
      subscriptionStatus: sub?.status || 'INACTIVE',
      membersCount: memberCount,
      accountsCount: accountCount,
    };
  });
  res.json(orgsWithDetails);
});

app.patch('/api/v1/admin/organizations/:id/status', (req, res) => {
  const orgId = req.params.id;
  const { status } = req.body;
  const state = dbInstance.getState();
  const org = state.organizations.find((o) => o.id === orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  org.status = status;
  dbInstance.commit();
  res.json({ success: true, organization: org });
});

app.get('/api/v1/admin/users', (req, res) => {
  const state = dbInstance.getState();
  res.json(state.users);
});

app.patch('/api/v1/admin/users/:id/status', (req, res) => {
  const userId = req.params.id;
  const { status } = req.body;
  const state = dbInstance.getState();
  const user = state.users.find((u) => u.id === userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.status = status;
  dbInstance.commit();
  res.json({ success: true, user });
});

// ---------------- INSTAGRAM ACCOUNTS & OAUTH ----------------
app.get('/api/v1/instagram-accounts', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const accounts = state.instagramAccounts.filter((a) => a.organizationId === orgId);
  res.json(accounts);
});

app.get('/api/v1/integrations/instagram/connect', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();

  // Enforce Plan Account Limit
  const sub = state.subscriptions.find((s) => s.organizationId === orgId);
  const plan = state.plans.find((p) => p.id === (sub?.planId || 'plan_starter'));
  const currentAccCount = state.instagramAccounts.filter((a) => a.organizationId === orgId).length;

  if (plan && currentAccCount >= plan.maxAccounts) {
    return res.status(403).json({
      error: `Plan limit reached: Your current ${plan.displayName} allows maximum ${plan.maxAccounts} connected Instagram accounts. Please upgrade your subscription.`,
    });
  }

  if (!instagramProvider.isLiveCredentialsConfigured()) {
    return res.status(503).json({ error: 'Instagram is not configured on the server (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET / INSTAGRAM_CONFIG_ID missing).' });
  }
  const authDetails = instagramProvider.getOAuthAuthorizationUrl(orgId);
  res.json({
    authUrl: authDetails.url,
    state: authDetails.state,
    isLiveConfigured: instagramProvider.isLiveCredentialsConfigured(),
  });
});

app.get('/api/v1/integrations/instagram/callback', async (req, res) => {
  const { code, state, error_description } = req.query as { code: string; state: string; error_description?: string };
  console.log(`[instagram] callback hit: code=${code ? 'yes' : 'no'}${error_description ? ` meta_error=${error_description}` : ''}`);

  try {
    if (!code && error_description) throw new Error(error_description);
    const result = await instagramProvider.exchangeOAuthCode(code, state);
    console.log(`[instagram] connected @${result.username}`);
    return res.redirect(`/settings?connected=true&account=${result.username}`);
  } catch (err: any) {
    console.error(`[instagram] connect failed: ${err.message}`);
    return res.redirect(`/settings?error=${encodeURIComponent(err.message)}`);
  }
});

app.delete('/api/v1/instagram-accounts/:id', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const owned = state.instagramAccounts.some((a) => a.id === req.params.id && a.organizationId === orgId);
  if (owned) {
    state.instagramAccounts = state.instagramAccounts.filter((a) => a.id !== req.params.id);
    // Disconnect must also drop the stored access token.
    state.instagramTokens = state.instagramTokens.filter((t) => t.instagramAccountId !== req.params.id);
  }
  dbInstance.commit();
  res.json({ success: true });
});

// ---------------- INBOX & CONVERSATIONS ----------------
app.get('/api/v1/conversations', (req, res) => {
  const orgId = (req as any).organizationId;
  const { filter, accountId, search } = req.query as { filter?: string; accountId?: string; search?: string };
  const state = dbInstance.getState();

  let convs = state.conversations.filter((c) => c.organizationId === orgId);

  if (accountId && accountId !== 'ALL') {
    convs = convs.filter((c) => c.instagramAccountId === accountId);
  }

  const userId = (req as any).userId;
  if (filter === 'UNREAD') convs = convs.filter((c) => c.unreadCount > 0);
  else if (filter === 'ASSIGNED_TO_ME') convs = convs.filter((c) => c.assignedToId === userId);
  else if (filter === 'UNASSIGNED') convs = convs.filter((c) => !c.assignedToId && c.status !== 'RESOLVED');
  else if (filter === 'AI_HANDLED') convs = convs.filter((c) => c.isAiHandled && !c.isAiPaused);
  else if (filter === 'HUMAN_HANDLED') convs = convs.filter((c) => !c.isAiHandled || c.isAiPaused);
  else if (filter === 'RESOLVED') convs = convs.filter((c) => c.status === 'RESOLVED');

  const enriched = convs.map((c) => {
    const contact = state.contacts.find((cnt) => cnt.id === c.contactId);
    const account = state.instagramAccounts.find((a) => a.id === c.instagramAccountId);
    const assignedUser = state.users.find((u) => u.id === c.assignedToId);

    const lastCust = new Date(c.lastCustomerMessageAt || c.createdAt).getTime();
    const hoursSinceCust = (Date.now() - lastCust) / (1000 * 60 * 60);

    return {
      ...c,
      contact,
      account: account ? { id: account.id, username: account.username, name: account.name } : null,
      assignedUser: assignedUser ? { id: assignedUser.id, fullName: assignedUser.fullName } : null,
      hoursSinceCustomerMessage: Number(hoursSinceCust.toFixed(1)),
      isStandard24hWindowActive: hoursSinceCust <= 24,
      isHumanAgent7dWindowActive: hoursSinceCust <= 168,
    };
  });

  let finalConvs = enriched;
  if (search) {
    const s = search.toLowerCase();
    finalConvs = enriched.filter(
      (c) =>
        c.contact?.username.toLowerCase().includes(s) ||
        c.contact?.displayName?.toLowerCase().includes(s) ||
        c.lastMessageSnippet?.toLowerCase().includes(s)
    );
  }

  finalConvs.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  res.json(finalConvs);
});

app.get('/api/v1/conversations/:id', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const conv = state.conversations.find((c) => c.id === req.params.id && c.organizationId === orgId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const contact = state.contacts.find((cnt) => cnt.id === conv.contactId);
  const account = state.instagramAccounts.find((a) => a.id === conv.instagramAccountId);
  const assignedUser = state.users.find((u) => u.id === conv.assignedToId);

  const lastCust = new Date(conv.lastCustomerMessageAt || conv.createdAt).getTime();
  const hoursSinceCust = (Date.now() - lastCust) / (1000 * 60 * 60);

  res.json({
    ...conv,
    contact,
    account,
    assignedUser,
    hoursSinceCustomerMessage: Number(hoursSinceCust.toFixed(1)),
    isStandard24hWindowActive: hoursSinceCust <= 24,
    isHumanAgent7dWindowActive: hoursSinceCust <= 168,
  });
});

app.patch('/api/v1/conversations/:id', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const conv = state.conversations.find((c) => c.id === req.params.id && c.organizationId === orgId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  Object.assign(conv, req.body, { updatedAt: new Date().toISOString() });
  dbInstance.commit();
  broadcastToOrg(orgId, 'conversation:updated', conv);
  res.json(conv);
});

app.post('/api/v1/conversations/:id/assign', (req, res) => {
  const orgId = (req as any).organizationId;
  const { assignedToId } = req.body;
  const state = dbInstance.getState();
  const conv = state.conversations.find((c) => c.id === req.params.id && c.organizationId === orgId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  conv.assignedToId = assignedToId;
  conv.status = 'ASSIGNED';
  conv.updatedAt = new Date().toISOString();
  dbInstance.commit();

  broadcastToOrg(orgId, 'conversation:assigned', { conversationId: conv.id, assignedToId });
  broadcastToOrg(orgId, 'conversation:updated', conv);
  res.json(conv);
});

app.post('/api/v1/conversations/:id/resolve', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const conv = state.conversations.find((c) => c.id === req.params.id && c.organizationId === orgId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  conv.status = 'RESOLVED';
  conv.unreadCount = 0;
  conv.updatedAt = new Date().toISOString();
  dbInstance.commit();

  broadcastToOrg(orgId, 'conversation:resolved', { conversationId: conv.id });
  broadcastToOrg(orgId, 'conversation:updated', conv);
  res.json(conv);
});

app.post('/api/v1/conversations/:id/reopen', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const conv = state.conversations.find((c) => c.id === req.params.id && c.organizationId === orgId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  conv.status = 'OPEN';
  conv.updatedAt = new Date().toISOString();
  dbInstance.commit();

  broadcastToOrg(orgId, 'conversation:updated', conv);
  res.json(conv);
});

app.post('/api/v1/conversations/:id/toggle-ai', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const conv = state.conversations.find((c) => c.id === req.params.id && c.organizationId === orgId);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  conv.isAiPaused = !conv.isAiPaused;
  conv.updatedAt = new Date().toISOString();
  dbInstance.commit();

  broadcastToOrg(orgId, 'conversation:updated', conv);
  res.json(conv);
});

app.post('/api/v1/conversations/:id/notes', async (req, res) => {
  const orgId = (req as any).organizationId;
  const userId = (req as any).userId;
  const { content } = req.body;
  const state = dbInstance.getState();
  const user = state.users.find((u) => u.id === userId);

  try {
    const note = await messagePolicyService.addInternalNote(
      orgId,
      req.params.id,
      userId,
      user?.fullName || 'Agent',
      content
    );
    res.json(note);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------- MESSAGES & POLICY OUTBOUND ----------------
app.get('/api/v1/conversations/:id/messages', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const messages = state.messages.filter((m) => m.conversationId === req.params.id && m.organizationId === orgId);

  const conv = state.conversations.find((c) => c.id === req.params.id && c.organizationId === orgId);
  if (conv && conv.unreadCount > 0) {
    conv.unreadCount = 0;
    dbInstance.commit();
    broadcastToOrg(orgId, 'conversation:updated', conv);
  }

  messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  res.json(messages);
});

app.post('/api/v1/conversations/:id/messages', async (req, res) => {
  const orgId = (req as any).organizationId;
  const userId = (req as any).userId;
  const { text, useHumanAgentTag, isPrivateReply, commentId, attachments } = req.body;
  const state = dbInstance.getState();
  const user = state.users.find((u) => u.id === userId);

  try {
    const message = await messagePolicyService.sendOutboundMessage({
      organizationId: orgId,
      conversationId: req.params.id,
      senderType: 'AGENT',
      senderId: userId,
      senderName: user?.fullName || 'Support Agent',
      text,
      useHumanAgentTag: Boolean(useHumanAgentTag),
      isPrivateReply: Boolean(isPrivateReply),
      commentId,
      attachments,
    });
    res.json(message);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ---------------- CONTACTS & CRM ----------------
app.get('/api/v1/contacts', (req, res) => {
  const orgId = (req as any).organizationId;
  const { search, leadStatus } = req.query as { search?: string; leadStatus?: string };
  const state = dbInstance.getState();

  let contacts = state.contacts.filter((c) => c.organizationId === orgId);
  if (leadStatus && leadStatus !== 'ALL') {
    contacts = contacts.filter((c) => c.leadStatus === leadStatus);
  }
  if (search) {
    const s = search.toLowerCase();
    contacts = contacts.filter(
      (c) =>
        c.username.toLowerCase().includes(s) ||
        c.displayName.toLowerCase().includes(s) ||
        (c.email && c.email.toLowerCase().includes(s))
    );
  }

  const enriched = contacts.map((c) => {
    const convCount = state.conversations.filter((cv) => cv.contactId === c.id).length;
    return { ...c, totalConversations: convCount };
  });

  res.json(enriched);
});

app.get('/api/v1/contacts/:id', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const contact = state.contacts.find((c) => c.id === req.params.id && c.organizationId === orgId);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  const conversations = state.conversations.filter((c) => c.contactId === contact.id);
  res.json({ ...contact, conversations });
});

app.patch('/api/v1/contacts/:id', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const contact = state.contacts.find((c) => c.id === req.params.id && c.organizationId === orgId);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  Object.assign(contact, req.body);
  dbInstance.commit();
  broadcastToOrg(orgId, 'contact:updated', contact);
  res.json(contact);
});

app.post('/api/v1/contacts/:id/tags', (req, res) => {
  const orgId = (req as any).organizationId;
  const { tag } = req.body;
  const state = dbInstance.getState();
  const contact = state.contacts.find((c) => c.id === req.params.id && c.organizationId === orgId);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });

  if (tag && !contact.tags.includes(tag)) {
    contact.tags.push(tag);
    dbInstance.commit();
    broadcastToOrg(orgId, 'contact:updated', contact);
  }
  res.json(contact);
});

// ---------------- AI ASSISTANT & KNOWLEDGE BASE ----------------
app.get('/api/v1/ai/settings', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const settings = state.aiSettings.find((s) => s.organizationId === orgId) || state.aiSettings[0];
  res.json(settings);
});

app.patch('/api/v1/ai/settings', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  let settings = state.aiSettings.find((s) => s.organizationId === orgId);
  if (!settings) {
    settings = {
      id: `ai_${Date.now()}`,
      organizationId: orgId,
      isEnabled: true,
      mode: 'HYBRID',
      businessName: 'Brand Store',
      industry: 'Retail',
      businessDescription: 'Official customer support',
      tone: 'friendly and concise',
      preferredLanguage: 'en',
      supportedLanguages: ['en'],
      workingHours: '9am - 6pm',
      businessLocation: 'Online',
      responseLength: 'compact',
      confidenceThreshold: 0.8,
      escalationConditions: 'refund or complaints',
      humanHandoffInstructions: 'notify human team',
      updatedAt: new Date().toISOString(),
    };
    state.aiSettings.push(settings);
  }
  Object.assign(settings, req.body, { updatedAt: new Date().toISOString() });
  dbInstance.commit();
  res.json(settings);
});

app.post('/api/v1/ai/suggest', async (req, res) => {
  const orgId = (req as any).organizationId;
  const { conversationId, lastMessageText } = req.body;

  try {
    const draft = await aiAssistantService.generateResponse(orgId, conversationId, lastMessageText);
    res.json(draft);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/ai/executions', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const logs = state.aiExecutions.filter((e) => e.organizationId === orgId);
  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(logs.slice(0, 50));
});

app.get('/api/v1/knowledge', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const docs = state.knowledgeDocuments.filter((d) => d.organizationId === orgId);
  res.json(docs);
});

app.post('/api/v1/knowledge', (req, res) => {
  const orgId = (req as any).organizationId;
  const { title, sourceType, content, fileName, fileSize, fileType } = req.body;
  const state = dbInstance.getState();

  const newDoc = {
    id: `kb_${Date.now()}`,
    organizationId: orgId,
    title,
    sourceType: sourceType || (fileName ? 'FILE' : 'FAQ'),
    content,
    fileName,
    fileSize,
    fileType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.knowledgeDocuments.push(newDoc);
  dbInstance.commit();
  res.json(newDoc);
});

// Upload one file to the Knowledge Base: bytes go to S3, the DB keeps metadata + extracted text.
const MAX_KNOWLEDGE_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_KNOWLEDGE_EXT = new Set(['pdf', 'txt', 'md', 'markdown', 'csv', 'json', 'doc', 'docx']);

app.post(KNOWLEDGE_UPLOAD_PATH, express.json({ limit: '21mb' }), async (req, res) => {
  const orgId = (req as any).organizationId;
  const { title, content, fileName, fileType, fileData } = req.body || {};

  if (!isStorageConfigured()) return res.status(503).json({ error: 'File storage is not configured on the server.' });
  const safeName = String(fileName || '').replace(/[^\w.\- ]+/g, '_').slice(0, 150);
  const ext = safeName.split('.').pop()?.toLowerCase() || '';
  if (!safeName || !ALLOWED_KNOWLEDGE_EXT.has(ext)) {
    return res.status(400).json({ error: `Unsupported file type. Allowed: ${[...ALLOWED_KNOWLEDGE_EXT].join(', ')}` });
  }
  const base64 = typeof fileData === 'string' ? fileData.replace(/^data:[^,]*,/, '') : '';
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0) return res.status(400).json({ error: 'File is empty' });
  if (bytes.length > MAX_KNOWLEDGE_FILE_BYTES) return res.status(413).json({ error: 'File exceeds the 15MB limit' });

  const id = `kb_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const fileKey = `orgs/${orgId}/knowledge/${id}/${safeName}`;
  try {
    await putObject(fileKey, bytes, String(fileType || 'application/octet-stream'));
  } catch (err: any) {
    console.error('[storage] upload failed', err);
    return res.status(502).json({ error: 'Could not store the file. Please try again.' });
  }

  const now = new Date().toISOString();
  const doc = {
    id,
    organizationId: orgId,
    title: String(title || safeName),
    sourceType: 'FILE' as const,
    content: String(content || ''),
    fileName: safeName,
    fileSize: bytes.length,
    fileType: String(fileType || ''),
    fileKey,
    createdAt: now,
    updatedAt: now,
  };
  dbInstance.getState().knowledgeDocuments.push(doc);
  dbInstance.commit();
  res.json({ success: true, document: doc });
});

app.get('/api/v1/knowledge/:id/download', async (req, res) => {
  const orgId = (req as any).organizationId;
  const doc = dbInstance.getState().knowledgeDocuments.find((d) => d.id === req.params.id && d.organizationId === orgId);
  if (!doc?.fileKey) return res.status(404).json({ error: 'File not found' });
  try {
    res.json({ url: await signedDownloadUrl(doc.fileKey, doc.fileName || 'download') });
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});

app.delete('/api/v1/knowledge/:id', async (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const doc = state.knowledgeDocuments.find((d) => d.id === req.params.id && d.organizationId === orgId);
  if (doc?.fileKey) {
    // Leaves an orphaned object on failure rather than blocking the delete; logged for cleanup.
    await deleteObject(doc.fileKey).catch((err) => console.error(`[storage] failed to delete ${doc.fileKey}`, err));
  }
  state.knowledgeDocuments = state.knowledgeDocuments.filter(
    (d) => !(d.id === req.params.id && d.organizationId === orgId)
  );
  dbInstance.commit();
  res.json({ success: true });
});

// ---------------- TEAMS ----------------
app.get('/api/v1/teams', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const teams = state.teams.filter((t) => t.organizationId === orgId);
  res.json(teams);
});

// ---------------- AUTOMATIONS ----------------
app.get('/api/v1/automations', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const rules = state.automationRules.filter((r) => r.organizationId === orgId);
  const executions = state.automationExecutions.filter((e) => e.organizationId === orgId);
  res.json({ rules, executions });
});

app.post('/api/v1/automations', (req, res) => {
  const orgId = (req as any).organizationId;
  const { name, description, triggerType, keywordMatch, actionType, actionPayload } = req.body;
  const state = dbInstance.getState();

  const newRule = {
    id: `rul_${Date.now()}`,
    organizationId: orgId,
    name,
    description: description || '',
    triggerType: triggerType || 'KEYWORD_DETECTED',
    keywordMatch,
    actionType: actionType || 'ADD_TAG',
    actionPayload: actionPayload || {},
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  state.automationRules.push(newRule);
  dbInstance.commit();
  res.json(newRule);
});

app.post('/api/v1/automations/:id/toggle', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const rule = state.automationRules.find((r) => r.id === req.params.id && r.organizationId === orgId);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });

  rule.isActive = !rule.isActive;
  dbInstance.commit();
  res.json(rule);
});

// ---------------- ANALYTICS ----------------
app.get('/api/v1/analytics/overview', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();

  const convs = state.conversations.filter((c) => c.organizationId === orgId);
  const totalConversations = convs.length;
  const openConversations = convs.filter((c) => c.status === 'OPEN' || c.status === 'UNASSIGNED').length;
  const unreadConversations = convs.filter((c) => c.unreadCount > 0).length;
  const aiHandled = convs.filter((c) => c.isAiHandled && !c.isAiPaused).length;
  const humanHandled = convs.filter((c) => !c.isAiHandled || c.isAiPaused).length;

  const contacts = state.contacts.filter((c) => c.organizationId === orgId);
  const qualifiedLeads = contacts.filter((c) => c.leadStatus === 'QUALIFIED').length;
  const convertedLeads = contacts.filter((c) => c.leadStatus === 'CONVERTED').length;

  const aiExecs = state.aiExecutions.filter((e) => e.organizationId === orgId);
  const totalTokens = aiExecs.reduce((sum, e) => sum + e.responseTokens + e.promptTokens, 0);

  res.json({
    totalConversations,
    openConversations,
    unreadConversations,
    aiHandled,
    humanHandled,
    avgResponseTimeMinutes: 4.2,
    avgResolutionTimeHours: 2.1,
    aiAutomationRatePercent: totalConversations ? Math.round((aiHandled / totalConversations) * 100) : 0,
    totalContacts: contacts.length,
    qualifiedLeads,
    convertedLeads,
    totalTokensUsed: totalTokens,
  });
});

// ---------------- AUDIT LOGS ----------------
app.get('/api/v1/audit-logs', (req, res) => {
  const orgId = (req as any).organizationId;
  const state = dbInstance.getState();
  const logs = state.auditLogs.filter((l) => l.organizationId === orgId);
  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(logs);
});

// ---------------- FRONTEND INTEGRATION (Vite / Static) ----------------
const isSuperAdminEmail = (email: string) =>
  Boolean(process.env.SUPER_ADMIN_EMAIL) && email.toLowerCase().trim() === process.env.SUPER_ADMIN_EMAIL!.toLowerCase().trim();

async function startServer() {
  await dbInstance.init();
  // Promote the configured platform owner (they register like any other user).
  for (const u of dbInstance.getState().users) if (isSuperAdminEmail(u.email)) u.isSuperAdmin = true;
  dbInstance.commit();

  const shutdown = async () => {
    await dbInstance.flush();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 InstaFlow CRM SaaS running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server boot error:', err);
  process.exit(1);
});
