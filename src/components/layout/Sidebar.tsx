import React from 'react';
import {
  Inbox,
  Users,
  Instagram,
  Bot,
  BookOpen,
  Zap,
  ShieldCheck,
  BarChart3,
  Settings,
  LayoutDashboard,
  Building2,
  ChevronDown,
  Sparkles,
  Briefcase,
  HelpCircle,
  ShieldAlert,
  LogOut,
  UserCheck,
} from 'lucide-react';
import { Organization, User, OrgRole } from '../../types/crm';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentOrg: Organization;
  availableOrgs: Organization[];
  onSwitchOrg: (orgId: string) => void;
  currentUser: User;
  userRole: OrgRole;
  unreadCount: number;
  onOpenAuthModal?: () => void;
  onSignOut?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  currentOrg,
  availableOrgs,
  onSwitchOrg,
  currentUser,
  userRole,
  unreadCount,
  onOpenAuthModal,
  onSignOut,
}) => {
  const [showOrgDropdown, setShowOrgDropdown] = React.useState(false);
  const [showUserMenu, setShowUserMenu] = React.useState(false);

  const isSuperAdmin = userRole === 'SUPER_ADMIN' || currentUser.isSuperAdmin;
  const isAgency = currentOrg.type === 'AGENCY';

  const baseNavItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'inbox', label: 'Inbox', icon: Inbox, badge: unreadCount > 0 ? unreadCount : undefined },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'accounts', label: 'Instagram Accounts', icon: Instagram },
    ...(isAgency
      ? [{ id: 'agency', label: 'Agency Clients', icon: Briefcase, isSpecial: true }]
      : []),
    { id: 'ai', label: 'AI Assistant', icon: Bot, isAccent: true },
    { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
    { id: 'automations', label: 'Automations', icon: Zap },
    { id: 'teams', label: 'Teams & Agents', icon: ShieldCheck },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'support', label: 'Support & Help', icon: HelpCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
    ...(isSuperAdmin
      ? [{ id: 'admin', label: 'Super Admin', icon: ShieldAlert, isSuperAdmin: true }]
      : []),
  ];

  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex flex-col h-screen select-none shrink-0 z-20">
      {/* App Branding & Org Switcher */}
      <div className="p-3 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="w-6 h-6 rounded bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-xs">
            <Instagram className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-slate-900 tracking-tight text-sm">Flowza</span>
          <span className="text-[10px] font-medium bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded border border-indigo-200/50 ml-auto">
            CRM
          </span>
        </div>

        {/* Workspace Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowOrgDropdown(!showOrgDropdown)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-slate-100/80 border border-slate-200/60 transition-colors text-left"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="text-xs font-medium text-slate-800 truncate">{currentOrg.name}</span>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {showOrgDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-30 text-xs">
              <div className="px-2.5 py-1 text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                Workspaces ({currentOrg.type})
              </div>
              {availableOrgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    onSwitchOrg(org.id);
                    setShowOrgDropdown(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 hover:bg-slate-50 flex items-center justify-between ${
                    org.id === currentOrg.id ? 'font-medium text-indigo-600 bg-indigo-50/50' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate">{org.name}</span>
                  <span className="text-[10px] px-1 py-0.2 rounded bg-slate-100 text-slate-500">{org.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {baseNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                isActive
                  ? item.isSuperAdmin
                    ? 'bg-purple-100 text-purple-900 font-medium'
                    : 'bg-slate-100 text-slate-900 font-medium'
                  : item.isSuperAdmin
                  ? 'text-purple-700 hover:text-purple-900 hover:bg-purple-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? item.isSuperAdmin
                        ? 'text-purple-700'
                        : 'text-indigo-600'
                      : item.isSuperAdmin
                      ? 'text-purple-600'
                      : item.isAccent
                      ? 'text-indigo-500'
                      : item.isSpecial
                      ? 'text-amber-600'
                      : 'text-slate-400'
                  }`}
                />
                <span className={item.isSuperAdmin ? 'font-semibold text-purple-700' : ''}>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded-full bg-rose-500 text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Subscription & Profile */}
      <div className="p-3 border-t border-slate-100 space-y-2.5 bg-slate-50/50 relative">
        <div className="p-2 rounded bg-white border border-slate-200/70 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-700">Growth Plan</span>
            <span className="text-[10px] font-semibold text-indigo-600 flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> Active
            </span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full" style={{ width: '38%' }}></div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
            <span>AI Tokens</span>
            <span>42k / 250k</span>
          </div>
        </div>

        {/* User Card with Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-2 p-1 rounded hover:bg-white transition-colors text-left"
          >
            <img
              src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={currentUser.fullName}
              className="w-7 h-7 rounded-full object-cover border border-slate-200"
            />
            <div className="overflow-hidden leading-tight flex-1">
              <div className="text-xs font-medium text-slate-800 truncate">{currentUser.fullName}</div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <span className="uppercase text-[9px] bg-slate-100 text-slate-600 px-1 rounded font-medium">
                  {userRole}
                </span>
              </div>
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-30 text-xs">
              <div className="px-2.5 py-1 text-[10px] text-slate-400 font-mono truncate">
                {currentUser.email}
              </div>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  onOpenAuthModal?.();
                }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>Switch / Sign In</span>
              </button>
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  onSignOut?.();
                }}
                className="w-full text-left px-2.5 py-1.5 hover:bg-rose-50 flex items-center gap-2 text-rose-600"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

