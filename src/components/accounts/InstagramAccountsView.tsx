import React, { useState } from 'react';
import {
  Instagram,
  ShieldCheck,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Clock,
  Key,
} from 'lucide-react';
import { InstagramAccount } from '../../types/crm';
import { apiRequest } from '../../lib/api';

interface InstagramAccountsViewProps {
  accounts: InstagramAccount[];
  onAccountsUpdated: () => void;
}

export const InstagramAccountsView: React.FC<InstagramAccountsViewProps> = ({
  accounts,
  onAccountsUpdated,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleConnect = async () => {
    setIsConnecting(true);
    setStatusMessage(null);
    try {
      const data = await apiRequest('/api/v1/integrations/instagram/connect');
      if (data.authUrl) {
        // Redirect to Meta OAuth
        window.location.href = data.authUrl;
      }
    } catch (err: any) {
      setStatusMessage(`Connection initiation failed: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this Instagram account? Incoming messages will no longer sync.')) return;
    try {
      await apiRequest(`/api/v1/instagram-accounts/${accountId}`, { method: 'DELETE' });
      onAccountsUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Instagram Professional Accounts</h2>
          <p className="text-xs text-slate-500">
            Connect and manage official Instagram Business or Creator accounts via Meta Graph API
          </p>
        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="px-3.5 py-1.5 rounded bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white text-xs font-medium hover:opacity-95 flex items-center gap-1.5 transition-opacity shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connect Instagram Account</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          {statusMessage}
        </div>
      )}

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {accounts.map((acc) => {
          const expiresDate = new Date(acc.tokenExpiresAt);
          const daysLeft = Math.round((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

          return (
            <div
              key={acc.id}
              className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={acc.profilePictureUrl || 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=150'}
                      alt={acc.username}
                      className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-2xs"
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 text-sm">{acc.name || acc.username}</span>
                        <CheckCircle className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                      <a
                        href={`https://instagram.com/${acc.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-0.5"
                      >
                        @{acc.username}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                    Active
                  </span>
                </div>

                {/* Account Details & Metadata */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Account Type:</span>
                    <span className="font-medium text-slate-700">{acc.accountType}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Instagram ID:</span>
                    <span className="font-mono text-[11px] text-slate-600">{acc.instagramBusinessId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Token Status:</span>
                    <span className="font-medium text-emerald-600 flex items-center gap-1">
                      <Key className="w-3 h-3" />
                      <span>Encrypted AES-GCM ({daysLeft} days left)</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Last Synced:</span>
                    <span className="text-slate-600 text-[11px]">{new Date(acc.lastSyncAt).toLocaleTimeString()}</span>
                  </div>
                </div>

                {/* Granted Permissions */}
                <div className="mt-3">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Granted Meta Permissions
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {['messages', 'comments', 'basic'].map((perm) => (
                      <span
                        key={perm}
                        className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-medium border border-indigo-200/50"
                      >
                        instagram_business_{perm}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={onAccountsUpdated}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3 text-slate-400" />
                  <span>Sync Status</span>
                </button>

                <button
                  onClick={() => handleDisconnect(acc.id)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Meta Webhook Verification Guide Card */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 text-xs text-slate-700 space-y-2">
        <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <span>Meta App Review &amp; Webhook Configuration</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          In your Meta Developer Portal (App Dashboard &gt; Instagram Platform &gt; Webhooks), configure:
        </p>
        <div className="bg-white p-3 rounded border border-slate-200 font-mono text-[11px] space-y-1">
          <div>Callback URL: <span className="text-indigo-600">{window.location.origin}/webhooks/instagram</span></div>
          <div>Verify Token: <span className="text-slate-800">instaflow_verify_secret_token</span></div>
          <div>Required Subscriptions: <span className="text-emerald-700">messages, messaging_postbacks, message_reactions</span></div>
        </div>
      </div>
    </div>
  );
};
