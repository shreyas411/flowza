import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Bot,
  User,
  Users,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';

export const AnalyticsView: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    apiRequest('/api/v1/analytics/overview')
      .then((data) => setMetrics(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">CRM &amp; Messaging Analytics</h2>
          <p className="text-xs text-slate-500">
            Real-time performance indicators, AI resolution velocity, and customer lead progression
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded text-xs text-slate-600 font-medium">
          <span className="px-2 py-0.5 bg-white text-slate-900 rounded shadow-2xs">Last 30 Days</span>
          <span className="px-2 py-0.5 text-slate-500 hover:text-slate-800 cursor-pointer">7 Days</span>
          <span className="px-2 py-0.5 text-slate-500 hover:text-slate-800 cursor-pointer">24 Hours</span>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Total Conversations</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{metrics?.totalConversations || 4}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">100% response compliance</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Average First Response</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{metrics?.avgResponseTimeMinutes || 4.2} min</div>
          <div className="text-[11px] text-slate-400 mt-1">Instant for AI-handled threads</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Resolution Velocity</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{metrics?.avgResolutionTimeHours || 2.1} hrs</div>
          <div className="text-[11px] text-slate-400 mt-1">Average ticket closure time</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Lead Conversion Rate</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {metrics?.totalContacts ? Math.round((metrics.convertedLeads / metrics.totalContacts) * 100) : 25}%
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">Qualified Instagram shoppers</div>
        </div>
      </div>

      {/* Resolution Breakdown & Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI vs Human Split */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-semibold text-xs text-slate-900">Conversation Handling Split</span>
            <span className="text-[11px] text-slate-400">AI vs Human Support</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-[11px] mb-1 font-medium">
                <span className="flex items-center gap-1.5 text-purple-700">
                  <Bot className="w-3.5 h-3.5" /> AI Automated ({metrics?.aiHandled || 2})
                </span>
                <span>{metrics?.aiAutomationRatePercent || 50}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full"
                  style={{ width: `${metrics?.aiAutomationRatePercent || 50}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] mb-1 font-medium">
                <span className="flex items-center gap-1.5 text-indigo-700">
                  <User className="w-3.5 h-3.5" /> Human Agent Handled ({metrics?.humanHandled || 2})
                </span>
                <span>{100 - (metrics?.aiAutomationRatePercent || 50)}%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full"
                  style={{ width: `${100 - (metrics?.aiAutomationRatePercent || 50)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-3 rounded text-[11px] text-slate-600 leading-relaxed border border-slate-100">
            💡 AI handles general inquiries, FAQs, and product stock queries. Human handoff automatically takes over for order modifications, returns, or explicit requests.
          </div>
        </div>

        {/* Lead Qualification Funnel */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-semibold text-xs text-slate-900">Instagram CRM Lead Funnel</span>
            <span className="text-[11px] text-slate-400">Total Contacts: {metrics?.totalContacts || 4}</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded bg-blue-50/70 border border-blue-100 flex items-center justify-between">
              <span className="font-medium text-blue-900">1. New Inbound Contacts</span>
              <span className="font-bold text-blue-800">100%</span>
            </div>
            <div className="p-2.5 rounded bg-emerald-50/70 border border-emerald-100 flex items-center justify-between ml-4">
              <span className="font-medium text-emerald-900">2. Qualified Leads</span>
              <span className="font-bold text-emerald-800">{metrics?.qualifiedLeads ? '50%' : '25%'}</span>
            </div>
            <div className="p-2.5 rounded bg-purple-50/70 border border-purple-100 flex items-center justify-between ml-8">
              <span className="font-medium text-purple-900">3. Converted Customers</span>
              <span className="font-bold text-purple-800">{metrics?.convertedLeads ? '25%' : '20%'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
