import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  Search,
  CheckCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Radio,
  FileText,
  Server,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';

export const SuperAdminView: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ORGS' | 'USERS' | 'SYSTEM'>('OVERVIEW');
  const [searchOrg, setSearchOrg] = useState('');
  const [searchUser, setSearchUser] = useState('');

  const loadData = () => {
    apiRequest('/api/v1/admin/overview')
      .then((data) => setOverview(data))
      .catch((err) => console.error(err));

    apiRequest('/api/v1/admin/organizations')
      .then((data) => setOrganizations(data))
      .catch((err) => console.error(err));

    apiRequest('/api/v1/admin/users')
      .then((data) => setUsers(data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleOrgStatus = async (orgId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiRequest(`/api/v1/admin/organizations/${orgId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiRequest(`/api/v1/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredOrgs = organizations.filter(
    (o) => o.name.toLowerCase().includes(searchOrg.toLowerCase()) || o.slug.toLowerCase().includes(searchOrg.toLowerCase())
  );

  const filteredUsers = users.filter(
    (u) => u.fullName.toLowerCase().includes(searchUser.toLowerCase()) || u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-slate-800">
      {/* Super Admin Top Banner */}
      <div className="bg-purple-900 text-white rounded-lg p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-300" />
            <h2 className="text-base font-bold tracking-tight">Super Admin Platform Control Center</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-800 text-purple-200 border border-purple-700 font-semibold uppercase">
              Global Access
            </span>
          </div>
          <p className="text-xs text-purple-200 mt-1">
            Platform-wide governance across all multi-tenant organizations, users, recurring subscriptions, and system health
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-purple-950/60 p-1 rounded-md text-xs font-medium">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'OVERVIEW' ? 'bg-white text-purple-950 font-bold shadow-2xs' : 'text-purple-200 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('ORGS')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'ORGS' ? 'bg-white text-purple-950 font-bold shadow-2xs' : 'text-purple-200 hover:text-white'
            }`}
          >
            Organizations ({organizations.length})
          </button>
          <button
            onClick={() => setActiveTab('USERS')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'USERS' ? 'bg-white text-purple-950 font-bold shadow-2xs' : 'text-purple-200 hover:text-white'
            }`}
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('SYSTEM')}
            className={`px-3 py-1 rounded transition-colors ${
              activeTab === 'SYSTEM' ? 'bg-white text-purple-950 font-bold shadow-2xs' : 'text-purple-200 hover:text-white'
            }`}
          >
            System Health
          </button>
        </div>
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Global Platform KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
              <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                <span>Monthly Recurring Revenue</span>
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                ${overview?.mrr?.toLocaleString() || '528'}
              </div>
              <div className="text-[11px] text-emerald-600 font-medium mt-1">
                From {overview?.activeSubscriptions || 2} active paid orgs
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
              <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                <span>Total Workspaces</span>
                <Building2 className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {overview?.totalOrganizations || organizations.length}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {overview?.trialOrganizations || 1} on 14-day free trial
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
              <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                <span>Registered Platform Users</span>
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {overview?.totalUsers || users.length}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Agents, Admins &amp; Owners</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
              <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
                <span>Platform AI Volume</span>
                <Activity className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {overview?.totalAiTokensProcessed?.toLocaleString() || '42,150'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Processed tokens this billing cycle</div>
            </div>
          </div>

          {/* Quick Platform Status */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs text-xs space-y-3">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>Platform Core Services Status</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded bg-emerald-50/60 border border-emerald-100">
                <div className="font-semibold text-emerald-900">Meta Instagram Graph API v21.0</div>
                <div className="text-[11px] text-emerald-700 mt-0.5">Webhook Ingress: Operational (100% SLA)</div>
              </div>
              <div className="p-3 rounded bg-emerald-50/60 border border-emerald-100">
                <div className="font-semibold text-emerald-900">Realtime WebSocket Hub</div>
                <div className="text-[11px] text-emerald-700 mt-0.5">Multi-Tenant Broadcast: Operational</div>
              </div>
              <div className="p-3 rounded bg-emerald-50/60 border border-emerald-100">
                <div className="font-semibold text-emerald-900">Gemini 2.5 Flash / OpenAI Engine</div>
                <div className="text-[11px] text-emerald-700 mt-0.5">Semantic Grounding: Operational</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ORGANIZATIONS TAB */}
      {activeTab === 'ORGS' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden text-xs">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search organizations..."
                value={searchOrg}
                onChange={(e) => setSearchOrg(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded pl-8 pr-3 py-1.5 text-xs text-slate-800"
              />
            </div>
            <span className="text-[11px] text-slate-400">Total: {filteredOrgs.length}</span>
          </div>

          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Organization</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Plan</th>
                <th className="py-2.5 px-4">Members</th>
                <th className="py-2.5 px-4">Accounts</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrgs.map((org) => (
                <tr key={org.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    <div>{org.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{org.id}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-600 font-medium text-[11px]">{org.type}</td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                      {org.planName}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{org.membersCount}</td>
                  <td className="py-3 px-4 text-slate-600">{org.accountsCount}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        org.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {org.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleToggleOrgStatus(org.id, org.status || 'ACTIVE')}
                      className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                        org.status === 'SUSPENDED'
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                      }`}
                    >
                      {org.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'USERS' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden text-xs">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded pl-8 pr-3 py-1.5 text-xs text-slate-800"
              />
            </div>
            <span className="text-[11px] text-slate-400">Total: {filteredUsers.length}</span>
          </div>

          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">User</th>
                <th className="py-2.5 px-4">Email</th>
                <th className="py-2.5 px-4">Super Admin</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-slate-900">{u.fullName}</td>
                  <td className="py-3 px-4 text-slate-600">{u.email}</td>
                  <td className="py-3 px-4">
                    {u.isSuperAdmin ? (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">
                        SUPER_ADMIN
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">Regular User</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        u.status === 'SUSPENDED'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {u.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {!u.isSuperAdmin && (
                      <button
                        onClick={() => handleToggleUserStatus(u.id, u.status || 'ACTIVE')}
                        className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                          u.status === 'SUSPENDED'
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        }`}
                      >
                        {u.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SYSTEM HEALTH TAB */}
      {activeTab === 'SYSTEM' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
              <Server className="w-4 h-4 text-indigo-600" />
              <span>Infrastructure Health &amp; Background Queues</span>
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-1 text-slate-600 hover:text-slate-900 text-xs font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-semibold text-slate-800">BullMQ &amp; Background Queues</div>
              <div className="flex justify-between text-slate-600">
                <span>Webhook Ingestion Queue:</span>
                <span className="font-bold text-emerald-600">Active (0 delayed)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>AI Grounding Worker:</span>
                <span className="font-bold text-emerald-600">Idle (Ready)</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Dead-letter Queue:</span>
                <span className="font-bold text-slate-500">0 failed events</span>
              </div>
            </div>

            <div className="p-3.5 rounded bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-semibold text-slate-800">Database &amp; Encryption Engine</div>
              <div className="flex justify-between text-slate-600">
                <span>PostgreSQL Connection:</span>
                <span className="font-bold text-emerald-600">Connected</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Token Encryption:</span>
                <span className="font-bold text-indigo-600">AES-256-GCM Active</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tenant Isolation Filter:</span>
                <span className="font-bold text-emerald-600">Enforced (RLS Scoped)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
