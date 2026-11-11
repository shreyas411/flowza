import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  Trash2,
  Tag,
  Mail,
  Phone,
  Calendar,
  MessageSquare,
  ArrowRight,
  User,
  Plus,
  X,
  ExternalLink,
} from 'lucide-react';
import { Contact, LeadStatus } from '../../types/crm';
import { apiRequest } from '../../lib/api';

interface ContactsViewProps {
  onOpenConversation: (conversationId: string) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({ onOpenConversation }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newTagInput, setNewTagInput] = useState('');

  const loadContacts = () => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (statusFilter !== 'ALL') params.append('leadStatus', statusFilter);

    apiRequest<Contact[]>(`/api/v1/contacts?${params.toString()}`)
      .then((data) => setContacts(data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadContacts();
  }, [search, statusFilter]);

  const handleUpdateStatus = async (contactId: string, status: LeadStatus) => {
    try {
      const updated = await apiRequest<Contact>(`/api/v1/contacts/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify({ leadStatus: status }),
      });
      setContacts((prev) => prev.map((c) => (c.id === contactId ? updated : c)));
      if (selectedContact?.id === contactId) setSelectedContact(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTag = async (contactId: string) => {
    if (!newTagInput.trim()) return;
    try {
      const updated = await apiRequest<Contact>(`/api/v1/contacts/${contactId}/tags`, {
        method: 'POST',
        body: JSON.stringify({ tag: newTagInput.trim() }),
      });
      setContacts((prev) => prev.map((c) => (c.id === contactId ? updated : c)));
      if (selectedContact?.id === contactId) setSelectedContact(updated);
      setNewTagInput('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportData = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(contacts, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `instaflow_contacts_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const leadBadgeColors: Record<LeadStatus, string> = {
    NEW: 'bg-blue-50 text-blue-700 border-blue-200',
    QUALIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    FOLLOW_UP: 'bg-amber-50 text-amber-700 border-amber-200',
    CONVERTED: 'bg-purple-50 text-purple-700 border-purple-200',
    LOST: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4 text-slate-800">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Customer CRM &amp; Contacts</h2>
          <p className="text-xs text-slate-500">
            Instagram customer records, lead qualification statuses, voluntary details, and tags
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportData}
            className="px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Contacts</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search by username, name, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400">Lead Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses ({contacts.length})</option>
            <option value="NEW">New</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="FOLLOW_UP">Follow Up</option>
            <option value="CONVERTED">Converted</option>
            <option value="LOST">Lost</option>
          </select>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Contact</th>
                <th className="py-2.5 px-4">Lead Status</th>
                <th className="py-2.5 px-4">Tags</th>
                <th className="py-2.5 px-4">Email / Phone</th>
                <th className="py-2.5 px-4">Last Activity</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No contacts found matching criteria.
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={() => setSelectedContact(contact)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={contact.profilePictureUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                          alt={contact.username}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                        <div>
                          <div className="font-semibold text-slate-900">{contact.displayName || contact.username}</div>
                          <div className="text-[11px] text-slate-400">@{contact.username}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                          leadBadgeColors[contact.leadStatus]
                        }`}
                      >
                        {contact.leadStatus.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {contact.tags && contact.tags.length > 0 ? (
                          contact.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/50"
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-300 text-[10px]">None</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      <div>{contact.email || <span className="text-slate-300 text-[11px]">No email</span>}</div>
                      <div className="text-[10px] text-slate-400">{contact.phone || ''}</div>
                    </td>

                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(contact.lastInteractionAt).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedContact(contact);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        View Profile
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contact Profile Drawer */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto flex flex-col space-y-5 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">Customer CRM Profile</h3>
              <button
                onClick={() => setSelectedContact(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={selectedContact.profilePictureUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                alt={selectedContact.username}
                className="w-14 h-14 rounded-full object-cover border-2 border-slate-100 shadow-xs"
              />
              <div>
                <div className="text-base font-bold text-slate-900">{selectedContact.displayName || selectedContact.username}</div>
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <span>@{selectedContact.username}</span>
                  <a
                    href={`https://instagram.com/${selectedContact.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 hover:underline inline-flex items-center"
                  >
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Lead Status Select */}
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Lead Qualification</label>
              <select
                value={selectedContact.leadStatus}
                onChange={(e) => handleUpdateStatus(selectedContact.id, e.target.value as LeadStatus)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="NEW">New Lead</option>
                <option value="QUALIFIED">Qualified Lead</option>
                <option value="FOLLOW_UP">Follow Up Required</option>
                <option value="CONVERTED">Converted Customer</option>
                <option value="LOST">Lost</option>
              </select>
            </div>

            {/* Tags Manager */}
            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Tags</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedContact.tags.map((t, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs border border-slate-200 flex items-center gap-1"
                  >
                    <span>{t}</span>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Add a tag..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag(selectedContact.id)}
                  className="px-2.5 py-1 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Custom CRM Data */}
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <span className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">Custom Fields</span>
              {selectedContact.customFields && Object.keys(selectedContact.customFields).length > 0 ? (
                Object.entries(selectedContact.customFields).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs py-1 border-b border-slate-50">
                    <span className="text-slate-500 capitalize">{k}</span>
                    <span className="font-medium text-slate-800">{String(v)}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 text-xs">No custom fields recorded</div>
              )}
            </div>

            {/* Platform Identification (Meta Graph compliance) */}
            <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-400 space-y-1">
              <div>Platform User ID: <span className="font-mono text-slate-600">{selectedContact.platformUserId}</span></div>
              <div>First Discovered: {selectedContact.createdAt ? new Date(selectedContact.createdAt).toLocaleString() : 'Recently'}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
