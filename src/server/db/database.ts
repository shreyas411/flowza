/**
 * Production Multi-Tenant Relational Store
 * Supports RBAC, Agency Client Workspaces, Invitations, Password Resets,
 * Support Tickets, Billing Quotas, Invoices, and Audit Logs.
 */

import crypto from 'crypto';
import pg from 'pg';

export type OrgRole = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  timezone?: string;
  language?: string;
  emailVerified: boolean;
  isSuperAdmin: boolean;
  status: 'ACTIVE' | 'SUSPENDED';
  failedLoginAttempts: number;
  lockoutUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

export interface EmailVerificationToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  type: 'BUSINESS' | 'AGENCY';
  logoUrl?: string;
  description?: string;
  website?: string;
  industry?: string;
  businessEmail?: string;
  phone?: string;
  address?: string;
  timezone: string;
  defaultLanguage: string;
  status: 'ACTIVE' | 'SUSPENDED';
  onboardingStep: number;
  isOnboardingCompleted: boolean;
  parentAgencyId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  status: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
  lastActiveAt?: string;
  createdAt: string;
}

export interface Invitation {
  id: string;
  organizationId: string;
  email: string;
  role: OrgRole;
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'CANCELED' | 'EXPIRED';
  expiresAt: string;
  invitedById: string;
  invitedByName?: string;
  createdAt: string;
}

export interface AgencyClient {
  id: string;
  agencyOrgId: string;
  clientOrgId: string;
  clientName: string;
  contactEmail: string;
  connectedAccountsCount: number;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
}

export interface InstagramAccount {
  id: string;
  organizationId: string;
  instagramBusinessId: string;
  username: string;
  name: string;
  profilePictureUrl: string;
  accountType: 'BUSINESS' | 'CREATOR';
  isConnected: boolean;
  lastSyncAt: string;
  tokenExpiresAt: string;
  createdAt: string;
}

export interface InstagramToken {
  id: string;
  instagramAccountId: string;
  encryptedToken: string;
  tokenType: string;
  scopes: string[];
  expiresAt: string;
}

export interface Contact {
  id: string;
  organizationId: string;
  platform: 'INSTAGRAM';
  platformUserId: string;
  username: string;
  displayName: string;
  profilePictureUrl: string;
  email?: string;
  phone?: string;
  leadStatus: 'NEW' | 'QUALIFIED' | 'FOLLOW_UP' | 'CONVERTED' | 'LOST';
  customFields: Record<string, any>;
  tags: string[];
  createdAt?: string;
  lastInteractionAt: string;
}

export interface Conversation {
  id: string;
  organizationId: string;
  instagramAccountId: string;
  contactId: string;
  platformThreadId: string;
  status: 'OPEN' | 'UNASSIGNED' | 'ASSIGNED' | 'RESOLVED';
  isAiHandled: boolean;
  isAiPaused: boolean;
  unreadCount: number;
  lastMessageSnippet: string;
  lastMessageAt: string;
  lastCustomerMessageAt: string;
  humanAgentEligibleUntil: string | null;
  assignedToId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  organizationId: string;
  conversationId: string;
  platformMessageId?: string;
  senderType: 'CUSTOMER' | 'AGENT' | 'AI' | 'SYSTEM';
  senderId?: string;
  senderName?: string;
  text: string;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  isPrivateReply: boolean;
  isInternalNote: boolean;
  policyCheckPassed: boolean;
  policyBlockedReason?: string;
  attachments?: { type: 'IMAGE' | 'VIDEO' | 'AUDIO'; url: string }[];
  createdAt: string;
}

export interface ConversationNote {
  id: string;
  organizationId: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface AISettings {
  id: string;
  organizationId: string;
  isEnabled: boolean;
  mode: 'DISABLED' | 'SUGGESTION' | 'AUTOMATIC' | 'HYBRID';
  businessName: string;
  industry: string;
  businessDescription: string;
  tone: string;
  preferredLanguage: string;
  supportedLanguages: string[];
  workingHours: string;
  businessLocation: string;
  responseLength: 'compact' | 'detailed';
  confidenceThreshold: number;
  escalationConditions: string;
  humanHandoffInstructions: string;
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  organizationId: string;
  title: string;
  sourceType: 'FAQ' | 'TEXT' | 'POLICY' | 'URL' | 'FILE';
  content: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  fileKey?: string; // S3 object key
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  memberIds: string[];
  createdAt: string;
}

export interface AutomationRule {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  triggerType: 'INCOMING_MESSAGE' | 'KEYWORD_DETECTED' | 'CONVERSATION_CREATED' | 'HUMAN_REQUESTED';
  keywordMatch?: string;
  actionType: 'ENABLE_AI' | 'DISABLE_AI' | 'SEND_REPLY' | 'ASSIGN_AGENT' | 'ADD_TAG' | 'CHANGE_LEAD_STATUS' | 'ESCALATE_HUMAN';
  actionPayload: any;
  isActive: boolean;
  createdAt: string;
}

export interface AutomationExecution {
  id: string;
  organizationId: string;
  ruleId: string;
  ruleName: string;
  conversationId: string;
  status: 'SUCCESS' | 'FAILED';
  resultSummary: string;
  createdAt: string;
}

export interface Plan {
  id: string;
  name: 'FREE_TRIAL' | 'STARTER' | 'GROWTH' | 'AGENCY' | 'ENTERPRISE';
  displayName: string;
  maxAccounts: number;
  maxSeats: number;
  maxAiTokens: number;
  maxMonthlyConversations: number;
  priceMonthly: number;
  features: string[];
}

export interface Subscription {
  id: string;
  organizationId: string;
  planId: string;
  status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string;
}

export interface Invoice {
  id: string;
  organizationId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'PAID' | 'PENDING' | 'FAILED';
  date: string;
  pdfUrl?: string;
}

export interface UsageRecord {
  id: string;
  organizationId: string;
  metric: 'AI_TOKENS' | 'MESSAGES_SENT' | 'STORAGE_MB';
  quantity: number;
  recordedAt: string;
}

export interface NotificationItem {
  id: string;
  organizationId: string;
  recipientId?: string;
  title: string;
  message: string;
  type: 'INVITATION' | 'ASSIGNMENT' | 'NEW_MESSAGE' | 'HUMAN_HANDOFF' | 'TOKEN_EXPIRED' | 'BILLING' | 'TRIAL_EXPIRING' | 'POLICY_BLOCK';
  isRead: boolean;
  linkUrl?: string;
  createdAt: string;
}

export interface NotificationPreference {
  organizationId: string;
  userId: string;
  emailNewMessage: boolean;
  emailHandoff: boolean;
  emailTokenExpiry: boolean;
  emailBillingAlerts: boolean;
  inAppAll: boolean;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderType: 'USER' | 'ADMIN';
  message: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  subject: string;
  category: 'BILLING' | 'INSTAGRAM_API' | 'AI_ENGINE' | 'FEATURE_REQUEST' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessage[];
}

export interface AuditLog {
  id: string;
  organizationId: string;
  userId?: string;
  userName?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: any;
  ipAddress: string;
  createdAt: string;
}

export interface AIExecutionLog {
  id: string;
  organizationId: string;
  conversationId: string;
  promptTokens: number;
  responseTokens: number;
  model: string;
  intentDetected: string;
  confidence: number;
  status: 'SUCCESS' | 'ESCALATED' | 'FAILED';
  suggestedText: string;
  costEstimate: number;
  executionTimeMs: number;
  createdAt: string;
}

export interface SystemAnnouncement {
  id: string;
  title: string;
  content: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  isActive: boolean;
  createdAt: string;
}

export interface DatabaseState {
  users: User[];
  sessions: Session[];
  passwordResetTokens: PasswordResetToken[];
  emailVerificationTokens: EmailVerificationToken[];
  organizations: Organization[];
  organizationMembers: OrganizationMember[];
  invitations: Invitation[];
  agencyClients: AgencyClient[];
  instagramAccounts: InstagramAccount[];
  instagramTokens: InstagramToken[];
  contacts: Contact[];
  conversations: Conversation[];
  messages: Message[];
  conversationNotes: ConversationNote[];
  aiSettings: AISettings[];
  knowledgeDocuments: KnowledgeDocument[];
  teams: Team[];
  automationRules: AutomationRule[];
  automationExecutions: AutomationExecution[];
  plans: Plan[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  usageRecords: UsageRecord[];
  notifications: NotificationItem[];
  notificationPreferences: NotificationPreference[];
  supportTickets: SupportTicket[];
  auditLogs: AuditLog[];
  aiExecutions: AIExecutionLog[];
  systemAnnouncements: SystemAnnouncement[];
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';
if (ENCRYPTION_KEY.length < 32) throw new Error('ENCRYPTION_KEY must be set (at least 32 chars, e.g. `openssl rand -hex 32`)');

export function encryptSecret(plainText: string): string {
  try {
    const iv = crypto.randomBytes(12);
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    return `enc_${Buffer.from(plainText).toString('base64')}`;
  }
}

export function decryptSecret(encryptedPayload: string): string {
  try {
    if (encryptedPayload.startsWith('enc_')) {
      return Buffer.from(encryptedPayload.slice(4), 'base64').toString('utf8');
    }
    const [ivHex, authTagHex, encryptedText] = encryptedPayload.split(':');
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedPayload;
  }
}

export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

const COLLECTIONS = [
  'users', 'sessions', 'passwordResetTokens', 'emailVerificationTokens', 'organizations', 'organizationMembers',
  'invitations', 'agencyClients', 'instagramAccounts', 'instagramTokens', 'contacts', 'conversations', 'messages',
  'conversationNotes', 'aiSettings', 'knowledgeDocuments', 'teams', 'automationRules', 'automationExecutions',
  'plans', 'subscriptions', 'invoices', 'usageRecords', 'notifications', 'notificationPreferences',
  'supportTickets', 'auditLogs', 'aiExecutions', 'systemAnnouncements',
] as const;

const rowKey = (item: any): string => item.id ?? `${item.organizationId}:${item.userId}`;

/**
 * Postgres-backed store. Rows live in one `records` table (collection, id, jsonb) and are
 * cached in memory; commit() writes only rows that changed since the last write.
 * shortcut: single app instance only (memory is the runtime source of truth) and commit() re-serialises
 * every row; move hot collections (messages, auditLogs) to real tables/queries before scaling out.
 */
class Database {
  private state = Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as DatabaseState;
  private saved = new Map<string, string>();
  private pool: pg.Pool | null = null;
  private writes: Promise<void> = Promise.resolve();

  async init() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    this.pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS records (
        collection text NOT NULL, id text NOT NULL, data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (collection, id))`
    );
    const { rows } = await this.pool.query('SELECT collection, id, data FROM records');
    for (const r of rows) {
      const list = (this.state as any)[r.collection];
      if (!list) continue;
      list.push(r.data);
      this.saved.set(`${r.collection}\u0000${r.id}`, JSON.stringify(r.data));
    }
    if (this.state.plans.length === 0) this.state.plans = defaultPlans();
    this.commit();
    await this.flush();
  }

  public getState(): DatabaseState {
    return this.state;
  }

  /** Queues a transactional write of every row added, changed or removed since the last commit. */
  public commit() {
    const upserts: [string, string, string][] = [];
    const deletes: [string, string][] = [];
    const seen = new Set<string>();
    for (const col of COLLECTIONS) {
      for (const item of (this.state as any)[col] as any[]) {
        const id = rowKey(item);
        const key = `${col}\u0000${id}`;
        const json = JSON.stringify(item);
        seen.add(key);
        if (this.saved.get(key) !== json) {
          upserts.push([col, id, json]);
          this.saved.set(key, json);
        }
      }
    }
    for (const key of this.saved.keys()) {
      if (!seen.has(key)) {
        const [col, id] = key.split('\u0000');
        deletes.push([col, id]);
        this.saved.delete(key);
      }
    }
    if (!upserts.length && !deletes.length) return;
    this.writes = this.writes.then(() => this.write(upserts, deletes)).catch((err) => {
      console.error('DATABASE WRITE FAILED - will retry on next commit', err);
      // Forget what we thought was saved so the next commit re-sends these rows.
      for (const [col, id] of upserts) this.saved.delete(`${col}\u0000${id}`);
      for (const [col, id] of deletes) this.saved.set(`${col}\u0000${id}`, '');
    });
  }

  public flush(): Promise<void> {
    return this.writes;
  }

  private async write(upserts: [string, string, string][], deletes: [string, string][]) {
    const client = await this.pool!.connect();
    try {
      await client.query('BEGIN');
      for (const [col, id, json] of upserts) {
        await client.query(
          `INSERT INTO records (collection, id, data) VALUES ($1, $2, $3)
           ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
          [col, id, json]
        );
      }
      for (const [col, id] of deletes) {
        await client.query('DELETE FROM records WHERE collection = $1 AND id = $2', [col, id]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }
}

function defaultPlans(): Plan[] {
return [
    {
      id: 'plan_trial',
      name: 'FREE_TRIAL',
      displayName: '14-Day Free Trial',
      maxAccounts: 1,
      maxSeats: 2,
      maxAiTokens: 25000,
      maxMonthlyConversations: 200,
      priceMonthly: 0,
      features: ['1 Instagram Account', '2 Agent Seats', '25,000 AI Tokens', 'Unified Inbox', '14 Days Access'],
    },
    {
      id: 'plan_starter',
      name: 'STARTER',
      displayName: 'Starter Plan',
      maxAccounts: 1,
      maxSeats: 3,
      maxAiTokens: 50000,
      maxMonthlyConversations: 1000,
      priceMonthly: 49,
      features: ['1 Instagram Account', '3 Agent Seats', '50,000 AI Tokens', 'Unified Inbox', 'Standard CRM'],
    },
    {
      id: 'plan_growth',
      name: 'GROWTH',
      displayName: 'Growth Plan',
      maxAccounts: 3,
      maxSeats: 7,
      maxAiTokens: 250000,
      maxMonthlyConversations: 5000,
      priceMonthly: 129,
      features: ['3 Instagram Accounts', '7 Agent Seats', '250,000 AI Tokens', 'Knowledge Grounding', 'Automations', 'Full CRM'],
    },
    {
      id: 'plan_agency',
      name: 'AGENCY',
      displayName: 'Agency Tier',
      maxAccounts: 15,
      maxSeats: 25,
      maxAiTokens: 1000000,
      maxMonthlyConversations: 20000,
      priceMonthly: 399,
      features: ['15 Instagram Accounts', '25 Agent Seats', '1M AI Tokens', 'Multi-Client Workspaces', 'Agency Analytics'],
    },
    {
      id: 'plan_enterprise',
      name: 'ENTERPRISE',
      displayName: 'Enterprise Custom',
      maxAccounts: 50,
      maxSeats: 100,
      maxAiTokens: 5000000,
      maxMonthlyConversations: 100000,
      priceMonthly: 899,
      features: ['Unlimited Accounts', 'Custom Agent Seats', 'Dedicated AI Model SLA', 'Custom Billing & Invoicing'],
    },
  ];
}

declare global {
  var __INSTAFLOW_DB: Database | undefined;
}

export const dbInstance = global.__INSTAFLOW_DB || (global.__INSTAFLOW_DB = new Database());
