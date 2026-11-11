import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  MessageSquare,
  BookOpen,
  Plus,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
  Search,
  X,
  FileQuestion,
} from 'lucide-react';
import { SupportTicket } from '../../types/crm';
import { apiRequest } from '../../lib/api';

export const HelpSupportView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'FAQS' | 'TICKETS'>('FAQS');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [searchFaq, setSearchFaq] = useState('');

  // New Ticket Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<any>('INSTAGRAM_API');
  const [priority, setPriority] = useState<any>('MEDIUM');
  const [initialMessage, setInitialMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTickets = () => {
    apiRequest<SupportTicket[]>('/api/v1/support/tickets')
      .then((data) => {
        setTickets(data);
        if (selectedTicket) {
          const updated = data.find((t) => t.id === selectedTicket.id);
          if (updated) setSelectedTicket(updated);
        }
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !initialMessage.trim()) return;
    setIsSubmitting(true);

    try {
      const created = await apiRequest<SupportTicket>('/api/v1/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ subject, category, priority, message: initialMessage }),
      });
      setIsModalOpen(false);
      setSubject('');
      setInitialMessage('');
      loadTickets();
      setSelectedTicket(created);
      setActiveTab('TICKETS');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketReplyText.trim() || !selectedTicket) return;

    try {
      await apiRequest(`/api/v1/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: ticketReplyText.trim() }),
      });
      setTicketReplyText('');
      loadTickets();
    } catch (err) {
      console.error(err);
    }
  };

  const faqs = [
    {
      q: 'How does the Meta 24-Hour Messaging Window work?',
      a: 'Meta Platform Terms permit automated and standard customer support replies within 24 hours of the customer’s latest inbound message. Outside of this window, replies must utilize the qualifying Human Agent Exception Tag (allowing up to 7 days for verified human responses). Automated AI messaging is strictly forbidden outside 24 hours.',
    },
    {
      q: 'Can agencies manage separate client Instagram accounts?',
      a: 'Yes. With the Agency Workspace, agencies can provision isolated client organizations with dedicated permissions, isolated inboxes, and client-level CRM data, ensuring complete zero-leakage tenant isolation.',
    },
    {
      q: 'How are Instagram tokens encrypted?',
      a: 'All Meta Instagram Graph API access tokens are encrypted at rest using AES-256-GCM envelope encryption. Secrets and decrypted tokens are never transmitted to frontend clients or logged.',
    },
  ];

  const filteredFaqs = faqs.filter(
    (f) => f.q.toLowerCase().includes(searchFaq.toLowerCase()) || f.a.toLowerCase().includes(searchFaq.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Help Center &amp; Support Desk</h2>
          <p className="text-xs text-slate-500">
            Platform documentation, Meta API guidelines, and direct customer support ticket desk
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-medium">
            <button
              onClick={() => setActiveTab('FAQS')}
              className={`px-3 py-1 rounded transition-colors ${
                activeTab === 'FAQS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Documentation &amp; FAQ
            </button>
            <button
              onClick={() => setActiveTab('TICKETS')}
              className={`px-3 py-1 rounded transition-colors ${
                activeTab === 'TICKETS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Support Tickets ({tickets.length})
            </button>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Open Ticket</span>
          </button>
        </div>
      </div>

      {activeTab === 'FAQS' ? (
        <div className="space-y-4">
          {/* FAQ Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search knowledge base and FAQs..."
              value={searchFaq}
              onChange={(e) => setSearchFaq(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 shadow-2xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredFaqs.map((faq, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2">
                <div className="font-semibold text-slate-900 text-xs flex items-start gap-2">
                  <FileQuestion className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>{faq.q}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pl-6">{faq.a}</p>
              </div>
            ))}
          </div>

          <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-4 text-xs text-indigo-900 flex items-center justify-between">
            <div>
              <div className="font-semibold">Still need assistance with your Instagram CRM setup?</div>
              <div className="text-indigo-700 text-[11px]">Our engineering team responds within 4 hours.</div>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-3 py-1.5 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-2xs shrink-0"
            >
              Submit Support Ticket
            </button>
          </div>
        </div>
      ) : (
        /* Tickets View */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Ticket List */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden md:col-span-1 divide-y divide-slate-100">
            <div className="p-3 bg-slate-50 font-semibold text-slate-900 text-xs border-b border-slate-200">
              Active Support Tickets
            </div>
            {tickets.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">No support tickets found</div>
            ) : (
              tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`p-3 cursor-pointer transition-colors ${
                    selectedTicket?.id === t.id ? 'bg-indigo-50/50 border-l-2 border-indigo-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900 text-xs truncate max-w-[140px]">{t.subject}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                        t.status === 'RESOLVED'
                          ? 'bg-emerald-50 text-emerald-700'
                          : t.status === 'IN_PROGRESS'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between">
                    <span>{t.category}</span>
                    <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ticket Messages Thread */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xs md:col-span-2 flex flex-col h-[480px]">
            {selectedTicket ? (
              <>
                <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-xs">{selectedTicket.subject}</h4>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Priority: {selectedTicket.priority} • Opened by {selectedTicket.userName}
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                    {selectedTicket.status}
                  </span>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FAFBFD]">
                  {selectedTicket.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.senderType === 'ADMIN' ? 'items-end' : 'items-start'}`}
                    >
                      <div className="text-[10px] text-slate-400 mb-0.5 px-1">
                        <span className="font-medium text-slate-600">{m.senderName}</span>
                        {m.senderType === 'ADMIN' && (
                          <span className="text-[9px] px-1 ml-1 rounded bg-indigo-50 text-indigo-700 font-semibold">
                            Staff
                          </span>
                        )}
                        <span> • {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div
                        className={`max-w-[80%] rounded-lg p-2.5 text-xs shadow-2xs whitespace-pre-wrap ${
                          m.senderType === 'ADMIN' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-800'
                        }`}
                      >
                        {m.message}
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendReply} className="p-3 border-t border-slate-200 flex gap-2 bg-white">
                  <input
                    type="text"
                    value={ticketReplyText}
                    onChange={(e) => setTicketReplyText(e.target.value)}
                    placeholder="Type a response to support..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1 shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Reply</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-xs">
                <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
                <span>Select a support ticket to view conversation history</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-semibold text-slate-900">Open Customer Support Ticket</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  placeholder="e.g. Question regarding Instagram comment replies"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    <option value="INSTAGRAM_API">Instagram / Meta API</option>
                    <option value="AI_ENGINE">AI Automation</option>
                    <option value="BILLING">Billing &amp; Subscription</option>
                    <option value="FEATURE_REQUEST">Feature Request</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Detailed Message</label>
                <textarea
                  rows={4}
                  placeholder="Describe your issue or question in detail..."
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-800"
                  required
                />
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
                  className="px-3.5 py-1.5 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-2xs"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
