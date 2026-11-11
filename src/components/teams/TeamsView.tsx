import React, { useState } from 'react';
import {
  Users,
  Shield,
  Plus,
  Mail,
  UserCheck,
  Building2,
  Trash2,
  X,
  CheckCircle,
} from 'lucide-react';
import { User, OrgRole } from '../../types/crm';
import { apiRequest } from '../../lib/api';

interface TeamsViewProps {
  members: { id: string; user: User | null; role: string }[];
  onMembersUpdated: () => void;
}

export const TeamsView: React.FC<TeamsViewProps> = ({ members, onMembersUpdated }) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<OrgRole>('AGENT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsSubmitting(true);

    setInviteError(null);
    try {
      const res = await apiRequest('/api/v1/members/invite', {
        method: 'POST',
        body: JSON.stringify({ email, fullName, role }),
      });
      setNotice(
        res.emailSent
          ? `Invitation emailed to ${email.trim()}.`
          : `Invitation created, but the email to ${email.trim()} could not be sent. Check the email provider settings and re-invite.`
      );
      setIsInviteModalOpen(false);
      setEmail('');
      setFullName('');
      onMembersUpdated();
    } catch (err: any) {
      setInviteError(err.message || 'Could not send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleBadges: Record<string, string> = {
    OWNER: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
    AGENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    VIEWER: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Team Members &amp; RBAC Access</h2>
          <p className="text-xs text-slate-500">
            Manage agents, assign roles (Owner, Admin, Agent, Viewer), and control Instagram account permissions
          </p>
        </div>

        <button
          onClick={() => setIsInviteModalOpen(true)}
          className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Invite Agent</span>
        </button>
      </div>

      {/* Members Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4">Member</th>
              <th className="py-2.5 px-4">Role</th>
              <th className="py-2.5 px-4">Account Access Level</th>
              <th className="py-2.5 px-4">Joined Date</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={m.user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                      alt={m.user?.fullName}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                    <div>
                      <div className="font-semibold text-slate-900">{m.user?.fullName || 'Invited User'}</div>
                      <div className="text-[11px] text-slate-400">{m.user?.email}</div>
                    </div>
                  </div>
                </td>

                <td className="py-3 px-4">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${roleBadges[m.role] || 'bg-slate-100 text-slate-600'}`}>
                    {m.role}
                  </span>
                </td>

                <td className="py-3 px-4 text-slate-600">
                  {m.role === 'OWNER' || m.role === 'ADMIN' ? (
                    <span className="text-[11px] text-indigo-700 font-medium">All Connected Accounts</span>
                  ) : (
                    <span className="text-[11px] text-slate-600">Assigned Client Accounts</span>
                  )}
                </td>

                <td className="py-3 px-4 text-slate-400 text-[11px]">
                  3 days ago
                </td>

                <td className="py-3 px-4 text-right">
                  {m.role !== 'OWNER' && (
                    <button className="text-xs text-rose-600 hover:text-rose-800 font-medium">
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Descriptions */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-50 p-3 rounded border border-slate-200">
          <div className="font-semibold text-slate-900 text-xs mb-1">OWNER</div>
          <div className="text-[11px] text-slate-500 leading-relaxed">Full organization control, billing, API keys, and deletion rights.</div>
        </div>
        <div className="bg-slate-50 p-3 rounded border border-slate-200">
          <div className="font-semibold text-slate-900 text-xs mb-1">ADMIN</div>
          <div className="text-[11px] text-slate-500 leading-relaxed">Manage Instagram integrations, AI parameters, and team invites.</div>
        </div>
        <div className="bg-slate-50 p-3 rounded border border-slate-200">
          <div className="font-semibold text-slate-900 text-xs mb-1">AGENT</div>
          <div className="text-[11px] text-slate-500 leading-relaxed">Send outbound Instagram DMs, view assigned conversations, add CRM tags.</div>
        </div>
        <div className="bg-slate-50 p-3 rounded border border-slate-200">
          <div className="font-semibold text-slate-900 text-xs mb-1">VIEWER</div>
          <div className="text-[11px] text-slate-500 leading-relaxed">Read-only visibility into analytics and customer CRM records.</div>
        </div>
      </div>

      {notice && (
        <div role="status" className="fixed bottom-4 right-4 z-50 max-w-sm p-3 rounded-lg border border-slate-200 bg-white shadow-lg text-xs text-slate-700 flex gap-2">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-semibold text-slate-900">Invite Team Member</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {inviteError && (
              <div role="alert" className="p-2 rounded border border-rose-200 bg-rose-50 text-rose-700">{inviteError}</div>
            )}
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Jordan Lee"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Work Email</label>
                <input
                  type="email"
                  placeholder="jordan@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Organization Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as OrgRole)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="AGENT">Agent (Customer Support)</option>
                  <option value="VIEWER">Viewer (Read-only)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700"
                >
                  {isSubmitting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
