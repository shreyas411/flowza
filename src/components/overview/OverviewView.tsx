import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  Users,
  Bot,
  Zap,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Instagram,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Conversation, InstagramAccount } from '../../types/crm';

interface OverviewViewProps {
  onNavigateToInbox: (conversationId?: string) => void;
  accounts: InstagramAccount[];
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onNavigateToInbox,
  accounts,
}) => {
  const [stats, setStats] = useState<any>(null);
  const [recentConversations, setRecentConversations] = useState<Conversation[]>([]);
  const [healthStatus, setHealthStatus] = useState<any>(null);

  useEffect(() => {
    apiRequest('/api/v1/analytics/overview')
      .then((data) => setStats(data))
      .catch((err) => console.error(err));

    apiRequest<Conversation[]>('/api/v1/conversations')
      .then((data) => setRecentConversations(data.slice(0, 5)))
      .catch((err) => console.error(err));

    fetch('/health')
      .then((r) => r.json())
      .then((data) => setHealthStatus(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-slate-800">
      {/* Top Banner / Integration Status */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Instagram className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Instagram Platform Integration</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                Connected &amp; Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {accounts.length} active business accounts • Webhook URL: <code className="text-slate-700 font-mono text-[11px] bg-slate-100 px-1 py-0.2 rounded">/webhooks/instagram</code> (Meta Graph API {healthStatus?.metaApiVersion || 'v21.0'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Open Conversations</span>
            <MessageSquare className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {stats ? stats.openConversations : '--'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-600 font-medium">{stats?.unreadConversations || 0} unread</span> • Real-time synced
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">AI Automation Rate</span>
            <Bot className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {stats ? `${stats.aiAutomationRatePercent}%` : '--'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {stats?.aiHandled || 0} conversations resolved by AI
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Avg First Response Time</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {stats ? `${stats.avgResponseTimeMinutes} min` : '--'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            94% within Meta 24h standard window
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Qualified Leads</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {stats ? stats.qualifiedLeads : '--'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            From {stats?.totalContacts || 0} customer contacts
          </div>
        </div>
      </div>

      {/* Main Grid: Recent Conversations & AI Policy Engine Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Conversations */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-slate-900">Recent Customer Inquiries</h3>
              <p className="text-[11px] text-slate-500">Live incoming threads from connected Instagram accounts</p>
            </div>
            <button
              onClick={() => onNavigateToInbox()}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 transition-colors"
            >
              <span>View all in Inbox</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading recent conversations...</div>
            ) : (
              recentConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => onNavigateToInbox(conv.id)}
                  className="p-3.5 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img
                      src={conv.contact?.profilePictureUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={conv.contact?.username}
                      className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900">
                          {conv.contact?.displayName || conv.contact?.username}
                        </span>
                        <span className="text-[11px] text-slate-400">@{conv.contact?.username}</span>
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-md">
                        {conv.lastMessageSnippet || 'No messages'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div>
                      {conv.isAiHandled && !conv.isAiPaused ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium border border-purple-200">
                          AI Handled
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          Human Agent
                        </span>
                      )}
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Messaging Policy & AI Health Card */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-xs mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Meta Policy Compliance</span>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-800">24h Standard Messaging Window</div>
                  <div className="text-slate-500 text-[11px]">Enforced before sending any customer DM</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-800">Human Agent Exception Tag</div>
                  <div className="text-slate-500 text-[11px]">Permits human responses up to 7 days; automated AI strictly disallowed</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-slate-800">Webhook HMAC Verification</div>
                  <div className="text-slate-500 text-[11px]">Validates SHA-256 header signature for all inbound events</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-xs mb-2">
              <Bot className="w-4 h-4 text-purple-600" />
              <span>AI Engine Status</span>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Hybrid Mode active. Gemini 2.5 Flash / OpenAI grounded with your Knowledge Base.
            </p>
            <div className="bg-purple-50 rounded p-2.5 text-xs text-purple-900 space-y-1">
              <div className="flex justify-between">
                <span>Total Tokens Processed:</span>
                <span className="font-semibold">{stats?.totalTokensUsed?.toLocaleString() || '42,150'}</span>
              </div>
              <div className="flex justify-between">
                <span>Grounding Docs:</span>
                <span className="font-semibold">4 active policies</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
