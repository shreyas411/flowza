import React, { useState, useEffect } from 'react';
import {
  Bell,
  Search,
  Sparkles,
  Instagram,
  CheckCircle2,
  ChevronDown,
  Shield,
  Wifi,
  WifiOff,
  CheckCheck,
  ListChecks,
} from 'lucide-react';
import { InstagramAccount, NotificationItem, Organization, OrgRole } from '../../types/crm';
import { apiRequest } from '../../lib/api';

interface HeaderProps {
  title: string;
  accounts: InstagramAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  isRealtimeConnected: boolean;
  currentOrg?: Organization;
  userRole?: OrgRole;
  onOpenOnboarding?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  accounts,
  selectedAccountId,
  onSelectAccount,
  isRealtimeConnected,
  currentOrg,
  userRole,
  onOpenOnboarding,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = () => {
    apiRequest<NotificationItem[]>('/api/v1/notifications')
      .then((data) => {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.isRead).length);
      })
      .catch((err) => console.error('Failed to load notifications', err));
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/api/v1/notifications/mark-all-read', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="h-12 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 select-none">
      {/* Title, Role & Instagram Filter */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-800 tracking-tight">{title}</h1>

        {userRole && (
          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            {userRole}
          </span>
        )}

        <div className="h-4 w-px bg-slate-200" />

        {/* Account Selector */}
        <div className="relative">
          <select
            value={selectedAccountId}
            onChange={(e) => onSelectAccount(e.target.value)}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-colors"
          >
            <option value="ALL">All Instagram Accounts ({accounts.length})</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                @{acc.username}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Onboarding Checklist Status Button */}
        {currentOrg && !currentOrg.isOnboardingCompleted && (
          <button
            onClick={onOpenOnboarding}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-medium transition-colors"
          >
            <ListChecks className="w-3.5 h-3.5 text-amber-600" />
            <span>Setup Checklist ({currentOrg.onboardingStep || 1}/6)</span>
          </button>
        )}

        {/* Realtime Status Indicator */}
        <div
          title={isRealtimeConnected ? 'WebSocket live updates connected' : 'Connecting to WebSocket server...'}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[11px] text-slate-600 font-medium"
        >
          {isRealtimeConnected ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] text-emerald-700 font-medium">Live</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span className="text-[10px] text-amber-700 font-medium">Connecting</span>
            </>
          )}
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 relative transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-1.5 w-80 bg-white rounded-md border border-slate-200 shadow-xl py-2 z-40 text-xs">
              <div className="px-3 py-1 font-semibold text-slate-900 border-b border-slate-100 flex items-center justify-between">
                <span>In-App Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
                  >
                    <CheckCheck className="w-3 h-3" /> Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">No notifications yet</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-2.5 hover:bg-slate-50 transition-colors ${
                        !n.isRead ? 'bg-indigo-50/30' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 text-[11px]">{n.title}</span>
                        {!n.isRead && (
                          <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
                        )}
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">{n.message}</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

