/**
 * Flowza - Multi-Tenant Instagram CRM Application
 * Light theme only, compact Inter typography, modern SaaS design
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { UnifiedInbox } from './components/inbox/UnifiedInbox';
import { OverviewView } from './components/overview/OverviewView';
import { ContactsView } from './components/contacts/ContactsView';
import { InstagramAccountsView } from './components/accounts/InstagramAccountsView';
import { AIAssistantView } from './components/ai/AIAssistantView';
import { KnowledgeBaseView } from './components/knowledge/KnowledgeBaseView';
import { AutomationsView } from './components/automations/AutomationsView';
import { TeamsView } from './components/teams/TeamsView';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { SettingsView } from './components/settings/SettingsView';
import { AgencyWorkspaceView } from './components/agency/AgencyWorkspaceView';
import { HelpSupportView } from './components/support/HelpSupportView';
import { SuperAdminView } from './components/admin/SuperAdminView';
import { LoginPage } from './components/auth/LoginPage';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';

import { Organization, User, OrgRole, InstagramAccount, Conversation } from './types/crm';
import { apiRequest, setApiTenant, setAuthToken, getApiTenant } from './lib/api';
import { useRealtime, RealtimeEvent } from './hooks/useRealtime';

export default function App() {
  // Result of the Instagram OAuth callback redirect (?connected=true&account=… or ?error=…)
  const [igResult] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const result = p.get('connected')
      ? { ok: true, text: `Instagram account @${p.get('account') || ''} connected.` }
      : p.get('error') && !/[?&](reset|invite|verify)=/.test(window.location.search)
        ? { ok: false, text: `Instagram connection failed: ${p.get('error')}` }
        : null;
    if (result) window.history.replaceState(null, '', '/');
    return result;
  });
  const [igNotice, setIgNotice] = useState(igResult);
  const [currentTab, setCurrentTab] = useState<string>(igResult ? 'accounts' : 'inbox');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => Boolean(getApiTenant().token));
  // Email links (reset / invite / verify) open the auth screen even when already signed in.
  const [authLinkOpen, setAuthLinkOpen] = useState(() => /[?&](reset|invite|verify)=/.test(window.location.search));
  const [currentUser, setCurrentUser] = useState<User>({ id: '', email: '', fullName: '', avatarUrl: '', isSuperAdmin: false });
  const [userRole, setUserRole] = useState<OrgRole>('ADMIN');
  const [currentOrg, setCurrentOrg] = useState<Organization>({ id: '', name: '', slug: '', type: 'BUSINESS', isOnboardingCompleted: true });
  const [availableOrgs, setAvailableOrgs] = useState<Organization[]>([]);

  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  
  // Modals state
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Load Initial Org and User Data
  const loadInitialData = useCallback(async () => {
    try {
      const authData = await apiRequest('/api/v1/auth/me');
      if (authData.user) setCurrentUser(authData.user);
      if (authData.organization) setCurrentOrg(authData.organization);
      if (authData.role) setUserRole(authData.role);
      if (authData.availableOrganizations) setAvailableOrgs(authData.availableOrganizations);

      // Set API headers
      if (authData.organization?.id) setApiTenant(authData.organization.id);

      // Load Instagram accounts
      const accs = await apiRequest<InstagramAccount[]>('/api/v1/instagram-accounts');
      setAccounts(accs);

      // Load Team members
      const members = await apiRequest<any[]>('/api/v1/members');
      setTeamMembers(members);

      // Load Conversations
      const convs = await apiRequest<Conversation[]>('/api/v1/conversations');
      setConversations(convs);
      if (convs.length > 0 && !selectedConversationId) {
        setSelectedConversationId(convs[0].id);
      }
    } catch (err) {
      console.error('Failed to load initial data', err);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    if (isLoggedIn) loadInitialData();
  }, [loadInitialData, isLoggedIn]);

  // Reload conversations on account filter change
  const reloadConversations = useCallback(async () => {
    try {
      const endpoint =
        selectedAccountId && selectedAccountId !== 'ALL'
          ? `/api/v1/conversations?accountId=${selectedAccountId}`
          : '/api/v1/conversations';
      const convs = await apiRequest<Conversation[]>(endpoint);
      setConversations(convs);
    } catch (err) {
      console.error(err);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (isLoggedIn) reloadConversations();
  }, [reloadConversations, isLoggedIn]);

  // Handle Real-time WebSocket Events
  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      if (event.event === 'message:new' || event.event === 'conversation:updated' || event.event === 'contact:updated') {
        reloadConversations();
      }
    },
    [reloadConversations]
  );

  const { isConnected: isRealtimeConnected } = useRealtime(handleRealtimeEvent, isLoggedIn);

  // Switch Active Organization
  const handleSwitchOrg = async (orgId: string) => {
    try {
      await apiRequest('/api/v1/auth/switch-org', {
        method: 'POST',
        body: JSON.stringify({ organizationId: orgId }),
      });
      setApiTenant(orgId);
      await loadInitialData();
    } catch (err) {
      console.error(err);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
    setAuthToken(null);
    setIsLoggedIn(false);
  };

  // Auth Success callback
  const handleAuthSuccess = async (userData: any, orgId: string) => {
    if (userData) setCurrentUser(userData);
    if (orgId) setApiTenant(orgId);
    setAuthLinkOpen(false);
    if (isLoggedIn) await loadInitialData(); // already signed in: effect won't re-run, so refresh for the new session
    setIsLoggedIn(true);
  };

  const unreadCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const tabTitles: Record<string, string> = {
    overview: 'Workspace Overview',
    inbox: 'Unified Instagram Inbox',
    contacts: 'Contacts & CRM',
    accounts: 'Connected Instagram Accounts',
    agency: 'Agency Client Workspaces',
    ai: 'AI Automation & Settings',
    knowledge: 'AI Knowledge Base',
    automations: 'Rule Engine & Automations',
    teams: 'Team & Agent Permissions',
    analytics: 'Performance & Analytics',
    support: 'Help Center & Support Desk',
    settings: 'Organization Settings & Plans',
    admin: 'Super Admin Platform Control',
  };

  // When not logged in, render the dedicated split-screen Login & Registration page
  if (!isLoggedIn || authLinkOpen) {
    return (
      <LoginPage
        onAuthSuccess={handleAuthSuccess}
        onCancel={isLoggedIn ? () => setAuthLinkOpen(false) : undefined}
      />
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-800 antialiased overflow-hidden select-none">
      {/* Fixed Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        currentOrg={currentOrg}
        availableOrgs={availableOrgs}
        onSwitchOrg={handleSwitchOrg}
        currentUser={currentUser}
        userRole={userRole}
        unreadCount={unreadCount}
        onOpenAuthModal={() => setIsLoggedIn(false)}
        onSignOut={handleSignOut}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          title={tabTitles[currentTab] || 'Flowza'}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={setSelectedAccountId}
          isRealtimeConnected={isRealtimeConnected}
          currentOrg={currentOrg}
          userRole={userRole}
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
        />

        {/* Dynamic View Router */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          {igNotice && (
            <div
              role={igNotice.ok ? 'status' : 'alert'}
              className={`mx-6 mt-4 p-3 rounded-lg border text-xs flex items-start justify-between gap-3 ${
                igNotice.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              <span className="break-words">{igNotice.text}</span>
              <button onClick={() => setIgNotice(null)} aria-label="Dismiss" className="shrink-0 font-semibold">
                ×
              </button>
            </div>
          )}
          {currentTab === 'inbox' && (
            <UnifiedInbox
              conversations={conversations}
              selectedConversationId={selectedConversationId}
              onSelectConversation={setSelectedConversationId}
              onConversationUpdated={reloadConversations}
              teamMembers={teamMembers}
            />
          )}

          {currentTab === 'overview' && (
            <OverviewView
              onNavigateToInbox={(convId) => {
                if (convId) setSelectedConversationId(convId);
                setCurrentTab('inbox');
              }}
              accounts={accounts}
            />
          )}

          {currentTab === 'contacts' && (
            <ContactsView
              onOpenConversation={(convId) => {
                setSelectedConversationId(convId);
                setCurrentTab('inbox');
              }}
            />
          )}

          {currentTab === 'accounts' && (
            <InstagramAccountsView
              accounts={accounts}
              onAccountsUpdated={loadInitialData}
            />
          )}

          {currentTab === 'agency' && (
            <AgencyWorkspaceView onSwitchWorkspace={handleSwitchOrg} />
          )}

          {currentTab === 'ai' && <AIAssistantView />}

          {currentTab === 'knowledge' && <KnowledgeBaseView />}

          {currentTab === 'automations' && <AutomationsView />}

          {currentTab === 'teams' && (
            <TeamsView members={teamMembers} onMembersUpdated={loadInitialData} />
          )}

          {currentTab === 'analytics' && <AnalyticsView />}

          {currentTab === 'support' && <HelpSupportView />}

          {currentTab === 'settings' && (
            <SettingsView
              currentUser={currentUser}
              currentOrg={currentOrg}
              onUserUpdated={setCurrentUser}
              onOrgUpdated={setCurrentOrg}
            />
          )}

          {currentTab === 'admin' && <SuperAdminView />}
        </main>
      </div>

      {/* Organization Onboarding Wizard */}
      <OnboardingWizard
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        organization={currentOrg}
        accounts={accounts}
        onCompleted={loadInitialData}
        onOpenConnectInstagram={() => {
          setIsOnboardingOpen(false);
          setCurrentTab('accounts');
        }}
      />
    </div>
  );
}
