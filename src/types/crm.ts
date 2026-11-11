export type OrgRole = 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT' | 'VIEWER';
export type LeadStatus = 'NEW' | 'QUALIFIED' | 'FOLLOW_UP' | 'CONVERTED' | 'LOST';
export type ConversationStatus = 'OPEN' | 'UNASSIGNED' | 'ASSIGNED' | 'RESOLVED';
export type MessageStatus = 'PENDING' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type AIMode = 'DISABLED' | 'SUGGESTION' | 'AUTOMATIC' | 'HYBRID';

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  phone?: string;
  timezone?: string;
  language?: string;
  emailVerified?: boolean;
  isSuperAdmin?: boolean;
  status?: 'ACTIVE' | 'SUSPENDED';
  failedLoginAttempts?: number;
  lockoutUntil?: string | null;
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
  email?: string;
  phone?: string;
  address?: string;
  timezone?: string;
  defaultLanguage?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
  onboardingStep?: number;
  isOnboardingCompleted?: boolean;
  parentAgencyId?: string | null;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
  status: 'ACTIVE' | 'SUSPENDED' | 'INVITED';
  lastActiveAt?: string;
  createdAt: string;
  user?: User | null;
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
  permissions?: string[];
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
  leadStatus: LeadStatus;
  customFields: Record<string, any>;
  tags: string[];
  totalConversations?: number;
  createdAt?: string;
  lastInteractionAt: string;
}

export interface Conversation {
  id: string;
  organizationId: string;
  instagramAccountId: string;
  contactId: string;
  platformThreadId: string;
  status: ConversationStatus;
  isAiHandled: boolean;
  isAiPaused: boolean;
  unreadCount: number;
  lastMessageSnippet: string;
  lastMessageAt: string;
  lastCustomerMessageAt: string;
  humanAgentEligibleUntil: string | null;
  assignedToId?: string;
  tags: string[];
  contact?: Contact;
  account?: { id: string; username: string; name: string } | null;
  assignedUser?: { id: string; fullName: string } | null;
  hoursSinceCustomerMessage?: number;
  isStandard24hWindowActive?: boolean;
  isHumanAgent7dWindowActive?: boolean;
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
  status: MessageStatus;
  isPrivateReply: boolean;
  isInternalNote: boolean;
  policyCheckPassed: boolean;
  policyBlockedReason?: string;
  attachments?: { type: 'IMAGE' | 'VIDEO' | 'AUDIO'; url: string }[];
  createdAt: string;
}

export interface AISettings {
  id: string;
  organizationId: string;
  isEnabled: boolean;
  mode: AIMode;
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
  updatedAt?: string;
}

export interface AutomationRule {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  triggerType: string;
  keywordMatch?: string;
  actionType: string;
  actionPayload: any;
  isActive: boolean;
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

export interface AuditLogItem {
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
