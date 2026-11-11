import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Users,
  Instagram,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  X,
  Search,
} from 'lucide-react';
import { AgencyClient } from '../../types/crm';
import { apiRequest } from '../../lib/api';

interface AgencyWorkspaceViewProps {
  onSwitchWorkspace: (orgId: string) => void;
}

export const AgencyWorkspaceView: React.FC<AgencyWorkspaceViewProps> = ({ onSwitchWorkspace }) => {
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [industry, setIndustry] = useState('Beauty & Cosmetics');
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadClients = () => {
    apiRequest<AgencyClient[]>('/api/v1/agency/clients')
      .then((data) => setClients(data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !contactEmail.trim()) return;
    setIsSubmitting(true);

    try {
      await apiRequest('/api/v1/agency/clients', {
        method: 'POST',
        body: JSON.stringify({ clientName, contactEmail, industry }),
      });
      setIsModalOpen(false);
      setClientName('');
      setContactEmail('');
      loadClients();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = clients.filter(
    (c) =>
      c.clientName.toLowerCase().includes(search.toLowerCase()) ||
      c.contactEmail.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-slate-800">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">Agency Workspace &amp; Client Organizations</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold border border-purple-200">
              Agency Tier Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage isolated client brand workspaces, assign team agents, and monitor client Instagram inboxes
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Client Workspace</span>
        </button>
      </div>

      {/* Agency Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Managed Clients</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{clients.length}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">100% tenant-isolated</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Active Instagram Channels</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {clients.reduce((sum, c) => sum + (c.connectedAccountsCount || 1), 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Connected client accounts</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium">Agency Account Quota</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {clients.length} / 15
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Agency Tier limit</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        <input
          type="text"
          placeholder="Search client workspaces..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded pl-8 pr-3 py-1.5 text-xs text-slate-800"
        />
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client) => (
          <div
            key={client.id}
            className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs flex flex-col justify-between space-y-4 hover:border-slate-300 transition-colors"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                    {client.clientName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-xs">{client.clientName}</h4>
                    <span className="text-[11px] text-slate-400">{client.contactEmail}</span>
                  </div>
                </div>

                <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                  Active
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Client Org ID:</span>
                  <span className="font-mono text-slate-600">{client.clientOrgId}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Created:</span>
                  <span className="text-slate-600">{new Date(client.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onSwitchWorkspace(client.clientOrgId)}
              className="w-full py-1.5 rounded bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Switch to Client Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Create Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-semibold text-slate-900">Add Client Organization</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Client Business Name</label>
                <input
                  type="text"
                  placeholder="e.g. Verve Fitness Apparel"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Client Admin / Contact Email</label>
                <input
                  type="email"
                  placeholder="contact@vervefitness.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                >
                  <option value="Beauty & Cosmetics">Beauty &amp; Cosmetics</option>
                  <option value="Fashion & Apparel">Fashion &amp; Apparel</option>
                  <option value="Fitness & Health">Fitness &amp; Health</option>
                  <option value="E-Commerce Retail">E-Commerce Retail</option>
                  <option value="Food & Beverage">Food &amp; Beverage</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700"
                >
                  {isSubmitting ? 'Creating...' : 'Create Client Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
