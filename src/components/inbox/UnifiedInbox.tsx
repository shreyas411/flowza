import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  CheckCircle,
  Clock,
  UserCheck,
  Bot,
  Sparkles,
  Send,
  Paperclip,
  Tag,
  StickyNote,
  AlertTriangle,
  RotateCcw,
  Check,
  Pause,
  Play,
  Instagram,
  User,
  ChevronRight,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Conversation, Message, Contact, User as UserType } from '../../types/crm';
import { apiRequest } from '../../lib/api';

interface UnifiedInboxProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onConversationUpdated: () => void;
  teamMembers: { id: string; user: UserType | null; role: string }[];
}

export const UnifiedInbox: React.FC<UnifiedInboxProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  onConversationUpdated,
  teamMembers,
}) => {
  const [filter, setFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [useHumanTag, setUseHumanTag] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<{ text: string; confidence: number; intent: string; citations: any[] } | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation details and messages when selected
  useEffect(() => {
    if (!selectedConversationId) {
      if (conversations.length > 0) {
        onSelectConversation(conversations[0].id);
      }
      return;
    }

    const conv = conversations.find((c) => c.id === selectedConversationId) || null;
    setActiveConv(conv);
    setSendError(null);
    setAiDraft(null);

    // Fetch messages
    apiRequest<Message[]>(`/api/v1/conversations/${selectedConversationId}/messages`)
      .then((data) => {
        setMessages(data);
        scrollToBottom();
      })
      .catch((err) => console.error('Failed to load messages', err));
  }, [selectedConversationId, conversations]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    if (filter === 'UNREAD' && c.unreadCount === 0) return false;
    if (filter === 'UNASSIGNED' && (c.assignedToId || c.status === 'RESOLVED')) return false;
    if (filter === 'AI_HANDLED' && (!c.isAiHandled || c.isAiPaused)) return false;
    if (filter === 'HUMAN_HANDLED' && c.isAiHandled && !c.isAiPaused) return false;
    if (filter === 'RESOLVED' && c.status !== 'RESOLVED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.contact?.displayName?.toLowerCase().includes(q);
      const matchUser = c.contact?.username.toLowerCase().includes(q);
      const matchSnippet = c.lastMessageSnippet?.toLowerCase().includes(q);
      return matchName || matchUser || matchSnippet;
    }
    return true;
  });

  // Calculate filter counts
  const counts = {
    all: conversations.length,
    unread: conversations.filter((c) => c.unreadCount > 0).length,
    unassigned: conversations.filter((c) => !c.assignedToId && c.status !== 'RESOLVED').length,
    aiHandled: conversations.filter((c) => c.isAiHandled && !c.isAiPaused).length,
    humanHandled: conversations.filter((c) => !c.isAiHandled || c.isAiPaused).length,
    resolved: conversations.filter((c) => c.status === 'RESOLVED').length,
  };

  // Handle message send
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !activeConv || isSending) return;

    setIsSending(true);
    setSendError(null);

    try {
      if (isInternalNote) {
        // Send internal note
        const noteMsg = await apiRequest<Message>(`/api/v1/conversations/${activeConv.id}/notes`, {
          method: 'POST',
          body: JSON.stringify({ content: messageInput.trim() }),
        });
        setMessages((prev) => [...prev, noteMsg]);
      } else {
        // Send outbound Instagram DM through policy engine
        const newMsg = await apiRequest<Message>(`/api/v1/conversations/${activeConv.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            text: messageInput.trim(),
            useHumanAgentTag: useHumanTag,
          }),
        });

        setMessages((prev) => [...prev, newMsg]);
        if (!newMsg.policyCheckPassed) {
          setSendError(newMsg.policyBlockedReason || 'Message was blocked by Meta Platform policy.');
        }
      }

      setMessageInput('');
      setAiDraft(null);
      scrollToBottom();
      onConversationUpdated();
    } catch (err: any) {
      setSendError(err.message || 'Failed to dispatch message');
    } finally {
      setIsSending(false);
    }
  };

  // Trigger AI Suggestion
  const handleRequestAiSuggestion = async () => {
    if (!activeConv) return;
    setIsGeneratingAi(true);
    try {
      const lastCustMsg = [...messages].reverse().find((m) => m.senderType === 'CUSTOMER');
      const textToUse = lastCustMsg ? lastCustMsg.text : activeConv.lastMessageSnippet || 'Hello';

      const draft = await apiRequest('/api/v1/ai/suggest', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: activeConv.id,
          lastMessageText: textToUse,
        }),
      });

      setAiDraft(draft);
    } catch (err) {
      console.error('Failed to get AI draft', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Conversation action triggers
  const handleAssignAgent = async (agentId: string) => {
    if (!activeConv) return;
    try {
      await apiRequest(`/api/v1/conversations/${activeConv.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assignedToId: agentId }),
      });
      onConversationUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleResolve = async () => {
    if (!activeConv) return;
    try {
      const endpoint = activeConv.status === 'RESOLVED' ? 'reopen' : 'resolve';
      await apiRequest(`/api/v1/conversations/${activeConv.id}/${endpoint}`, {
        method: 'POST',
      });
      onConversationUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAi = async () => {
    if (!activeConv) return;
    try {
      await apiRequest(`/api/v1/conversations/${activeConv.id}/toggle-ai`, {
        method: 'POST',
      });
      onConversationUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateLeadStatus = async (status: string) => {
    if (!activeConv?.contact) return;
    try {
      await apiRequest(`/api/v1/contacts/${activeConv.contact.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ leadStatus: status }),
      });
      onConversationUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-full bg-[#F8FAFC] overflow-hidden select-none">
      {/* ---------------- 1. INBOX FILTERS SIDEBAR ---------------- */}
      <div className="w-48 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-800">Inbox Views</span>
          <Filter className="w-3.5 h-3.5 text-slate-400" />
        </div>

        <div className="p-2 space-y-0.5 flex-1 overflow-y-auto text-xs">
          {[
            { id: 'ALL', label: 'All Conversations', count: counts.all },
            { id: 'UNREAD', label: 'Unread', count: counts.unread },
            { id: 'UNASSIGNED', label: 'Unassigned', count: counts.unassigned },
            { id: 'AI_HANDLED', label: 'AI Handled', count: counts.aiHandled },
            { id: 'HUMAN_HANDLED', label: 'Human Handled', count: counts.humanHandled },
            { id: 'RESOLVED', label: 'Resolved', count: counts.resolved },
          ].map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Messaging Policy Info Box */}
        <div className="p-2.5 border-t border-slate-100 bg-slate-50/50 m-2 rounded text-[11px] text-slate-500">
          <div className="flex items-center gap-1 font-semibold text-slate-700 mb-0.5">
            <Info className="w-3.5 h-3.5 text-indigo-600" />
            <span>Meta 24h Window</span>
          </div>
          Replies must occur within 24h of customer DM. Human agent tag allows up to 7 days.
        </div>
      </div>

      {/* ---------------- 2. CONVERSATION LIST ---------------- */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-2.5 border-b border-slate-100">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              No conversations in this view.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConversationId;
              const contact = conv.contact;
              return (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={`p-3 cursor-pointer transition-colors relative ${
                    isSelected ? 'bg-indigo-50/40 border-l-2 border-indigo-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="relative shrink-0">
                      <img
                        src={contact?.profilePictureUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                        alt={contact?.displayName || contact?.username}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200"
                      />
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
                      )}
                    </div>

                    <div className="flex-1 overflow-hidden">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-semibold text-slate-800 truncate">
                          {contact?.displayName || contact?.username}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 truncate mb-1">
                        {conv.lastMessageSnippet || 'No messages yet'}
                      </div>

                      {/* Status Tags */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {conv.isAiHandled && !conv.isAiPaused ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 font-medium border border-purple-200/50 flex items-center gap-0.5">
                            <Bot className="w-2.5 h-2.5" /> AI Active
                          </span>
                        ) : conv.isAiPaused ? (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200/50">
                            Human Takeover
                          </span>
                        ) : null}

                        {conv.assignedUser && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                            {conv.assignedUser.fullName.split(' ')[0]}
                          </span>
                        )}

                        {conv.status === 'RESOLVED' && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 font-medium">
                            Resolved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ---------------- 3. MAIN THREAD PANEL ---------------- */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {activeConv ? (
          <>
            {/* Header */}
            <div className="h-13 px-4 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2.5">
                <img
                  src={activeConv.contact?.profilePictureUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt={activeConv.contact?.username}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-900">
                      {activeConv.contact?.displayName || activeConv.contact?.username}
                    </span>
                    <a
                      href={`https://instagram.com/${activeConv.contact?.username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-0.5"
                    >
                      @{activeConv.contact?.username}
                    </a>
                  </div>

                  {/* 24-hour window countdown pill */}
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-slate-400">Account: @{activeConv.account?.username}</span>
                    <span className="text-slate-300">•</span>
                    {activeConv.isStandard24hWindowActive ? (
                      <span className="text-emerald-700 font-medium flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> 24h Window Active ({24 - Math.floor(activeConv.hoursSinceCustomerMessage || 0)}h left)
                      </span>
                    ) : activeConv.isHumanAgent7dWindowActive ? (
                      <span className="text-amber-700 font-medium flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> 7d Human Agent Tag Eligible
                      </span>
                    ) : (
                      <span className="text-rose-600 font-medium flex items-center gap-0.5">
                        <ShieldAlert className="w-2.5 h-2.5" /> Window Expired ({Math.round((activeConv.hoursSinceCustomerMessage || 0) / 24)}d ago)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* AI Pause / Resume */}
                <button
                  onClick={handleToggleAi}
                  className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors border ${
                    activeConv.isAiPaused
                      ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                  title={activeConv.isAiPaused ? 'Resume AI Responses' : 'Pause AI and take over'}
                >
                  {activeConv.isAiPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  <span>{activeConv.isAiPaused ? 'Resume AI' : 'Pause AI'}</span>
                </button>

                {/* Assign Dropdown */}
                <select
                  value={activeConv.assignedToId || ''}
                  onChange={(e) => handleAssignAgent(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.user?.id}>
                      {m.user?.fullName} ({m.role})
                    </option>
                  ))}
                </select>

                {/* Resolve Button */}
                <button
                  onClick={handleToggleResolve}
                  className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                    activeConv.status === 'RESOLVED'
                      ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  <CheckCircle className="w-3 h-3" />
                  <span>{activeConv.status === 'RESOLVED' ? 'Reopen' : 'Resolve'}</span>
                </button>

                {/* Toggle details sidebar */}
                <button
                  onClick={() => setIsDetailsOpen(!isDetailsOpen)}
                  className={`p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors ${
                    isDetailsOpen ? 'bg-slate-100 text-slate-800' : ''
                  }`}
                  title="Toggle Customer CRM details"
                >
                  <User className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAFBFD]">
              {messages.map((msg) => {
                const isCustomer = msg.senderType === 'CUSTOMER';
                const isAI = msg.senderType === 'AI';
                const isNote = msg.isInternalNote;

                if (isNote) {
                  return (
                    <div
                      key={msg.id}
                      className="mx-auto max-w-lg bg-amber-50/90 border border-amber-200/80 rounded-md p-2.5 text-xs text-amber-900 shadow-2xs"
                    >
                      <div className="flex items-center justify-between font-semibold text-[10px] uppercase text-amber-700 mb-1">
                        <span className="flex items-center gap-1">
                          <StickyNote className="w-3 h-3 text-amber-600" /> Internal Team Note (Not sent to Instagram)
                        </span>
                        <span>{msg.senderName}</span>
                      </div>
                      <div className="text-slate-800 whitespace-pre-wrap">{msg.text}</div>
                      <div className="text-[10px] text-amber-600/80 text-right mt-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                      <span className="font-medium text-slate-600">{msg.senderName}</span>
                      {isAI && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                          AI
                        </span>
                      )}
                      <span>•</span>
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 text-xs leading-relaxed shadow-2xs whitespace-pre-wrap ${
                        isCustomer
                          ? 'bg-white text-slate-800 border border-slate-200/80'
                          : isAI
                          ? 'bg-purple-600 text-white'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Delivery Status & Policy Failures */}
                    <div className="flex items-center gap-1 px-1 mt-0.5 text-[10px] text-slate-400">
                      {!msg.policyCheckPassed ? (
                        <span className="text-rose-600 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" /> Blocked by Policy: {msg.policyBlockedReason}
                        </span>
                      ) : (
                        <span>{msg.status.toLowerCase()}</span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* AI Suggestion Bar (if available) */}
            {aiDraft && (
              <div className="border-t border-purple-200 bg-purple-50/70 p-3 text-xs animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 font-semibold text-purple-900">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>AI Suggested Reply (Intent: {aiDraft.intent})</span>
                    <span className="text-[10px] font-normal text-purple-600">
                      Confidence: {Math.round(aiDraft.confidence * 100)}%
                    </span>
                  </div>
                  <button
                    onClick={() => setAiDraft(null)}
                    className="text-[11px] text-purple-600 hover:text-purple-800"
                  >
                    Dismiss
                  </button>
                </div>
                <div className="bg-white/80 rounded p-2 text-slate-800 border border-purple-200/60 mb-2 font-mono text-[11px]">
                  {aiDraft.text}
                </div>
                <div className="flex items-center justify-between">
                  {aiDraft.citations && aiDraft.citations.length > 0 ? (
                    <span className="text-[10px] text-slate-500">
                      Sources: {aiDraft.citations.map((c) => c.title).join(', ')}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400">Grounded in business settings</span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setMessageInput(aiDraft.text);
                        setAiDraft(null);
                      }}
                      className="px-2 py-1 rounded bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 font-medium text-[11px]"
                    >
                      Insert &amp; Edit
                    </button>
                    <button
                      onClick={async () => {
                        setMessageInput(aiDraft.text);
                        setTimeout(handleSendMessage, 50);
                      }}
                      className="px-2 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 font-medium text-[11px]"
                    >
                      Send Immediately
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Policy Blocked Error Banner */}
            {sendError && (
              <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-rose-800 text-xs flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{sendError}</span>
                </div>
                <button
                  onClick={() => setSendError(null)}
                  className="text-[11px] text-rose-600 hover:text-rose-900 font-medium"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Composer */}
            <div className="p-3 border-t border-slate-200 bg-white">
              {/* Policy Toggle Controls */}
              <div className="flex items-center justify-between mb-2 text-xs">
                <div className="flex items-center gap-3">
                  {/* Internal note switch */}
                  <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span className={isInternalNote ? 'font-semibold text-amber-700' : ''}>
                      Internal Team Note
                    </span>
                  </label>

                  {/* Human agent tag (if past 24h) */}
                  {!isInternalNote && activeConv && !activeConv.isStandard24hWindowActive && (
                    <label className="flex items-center gap-1.5 text-amber-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={useHumanTag}
                        onChange={(e) => setUseHumanTag(e.target.checked)}
                        className="rounded border-amber-400 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-medium text-[11px]">
                        Apply Human Agent Exception Tag (Within 7 Days)
                      </span>
                    </label>
                  )}
                </div>

                {/* AI Draft Generator Trigger */}
                <button
                  type="button"
                  onClick={handleRequestAiSuggestion}
                  disabled={isGeneratingAi}
                  className="flex items-center gap-1 text-[11px] text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded border border-purple-200 transition-colors"
                >
                  <Sparkles className="w-3 h-3 text-purple-600" />
                  <span>{isGeneratingAi ? 'Drafting...' : 'Ask AI to Draft'}</span>
                </button>
              </div>

              {/* Textarea & Send button */}
              <div className="relative">
                <textarea
                  rows={2}
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    isInternalNote
                      ? 'Add an internal note visible only to your team...'
                      : activeConv.isStandard24hWindowActive
                      ? 'Write a reply to customer on Instagram...'
                      : 'Past 24h window: Enable Human Agent Tag above to reply'
                  }
                  className={`w-full border rounded-md p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 pr-16 transition-colors ${
                    isInternalNote
                      ? 'bg-amber-50/50 border-amber-300 focus:ring-amber-500'
                      : 'bg-white border-slate-200 focus:ring-indigo-500'
                  }`}
                />

                <div className="absolute right-2 bottom-2.5 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={isSending || !messageInput.trim()}
                    className={`p-1.5 rounded transition-colors text-white ${
                      isInternalNote
                        ? 'bg-amber-600 hover:bg-amber-700 disabled:opacity-50'
                        : 'bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-xs">
            <Instagram className="w-8 h-8 text-slate-300 mb-2" />
            <span>Select a conversation from the list to start messaging</span>
          </div>
        )}
      </div>

      {/* ---------------- 4. RIGHT CUSTOMER CRM DETAILS SIDEBAR ---------------- */}
      {isDetailsOpen && activeConv && (
        <div className="w-64 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto text-xs">
          <div className="p-4 border-b border-slate-100 flex flex-col items-center text-center">
            <img
              src={activeConv.contact?.profilePictureUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={activeConv.contact?.username}
              className="w-14 h-14 rounded-full object-cover border-2 border-slate-100 shadow-xs mb-2"
            />
            <div className="font-semibold text-slate-900 text-sm">
              {activeConv.contact?.displayName || activeConv.contact?.username}
            </div>
            <div className="text-slate-400 text-xs">@{activeConv.contact?.username}</div>

            {/* Lead Status Select */}
            <div className="mt-2 w-full">
              <label className="block text-[10px] uppercase font-semibold text-slate-400 mb-1 text-left">
                CRM Lead Status
              </label>
              <select
                value={activeConv.contact?.leadStatus || 'NEW'}
                onChange={(e) => handleUpdateLeadStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="NEW">New Lead</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="FOLLOW_UP">Follow Up</option>
                <option value="CONVERTED">Converted</option>
                <option value="LOST">Lost</option>
              </select>
            </div>
          </div>

          {/* Contact Details */}
          <div className="p-3 border-b border-slate-100 space-y-2">
            <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Contact Attributes
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Email</div>
              <div className="text-slate-700 truncate">{activeConv.contact?.email || 'Not provided'}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Phone</div>
              <div className="text-slate-700">{activeConv.contact?.phone || 'Not provided'}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">Platform ID</div>
              <div className="text-slate-700 font-mono text-[11px]">{activeConv.contact?.platformUserId}</div>
            </div>
          </div>

          {/* Tags */}
          <div className="p-3 border-b border-slate-100">
            <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider mb-1.5 flex items-center justify-between">
              <span>Tags</span>
              <Tag className="w-3 h-3 text-slate-400" />
            </div>
            <div className="flex flex-wrap gap-1">
              {activeConv.tags && activeConv.tags.length > 0 ? (
                activeConv.tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium text-[10px] border border-slate-200/60"
                  >
                    {t}
                  </span>
                ))
              ) : (
                <span className="text-slate-400 text-[11px]">No tags assigned</span>
              )}
            </div>
          </div>

          {/* Custom CRM Fields */}
          <div className="p-3 border-b border-slate-100 space-y-1.5">
            <div className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Custom CRM Fields
            </div>
            {activeConv.contact?.customFields && Object.keys(activeConv.contact.customFields).length > 0 ? (
              Object.entries(activeConv.contact.customFields).map(([key, val]) => (
                <div key={key} className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400 capitalize">{key}:</span>
                  <span className="text-slate-700 font-medium">{String(val)}</span>
                </div>
              ))
            ) : (
              <span className="text-slate-400 text-[11px]">No custom fields</span>
            )}
          </div>

          {/* Account & Channel Info */}
          <div className="p-3 text-[11px] text-slate-500 space-y-1 mt-auto">
            <div>
              Instagram Account: <span className="font-medium text-slate-700">@{activeConv.account?.username}</span>
            </div>
            <div>
              Thread ID: <span className="font-mono text-[10px] text-slate-400">{activeConv.platformThreadId}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
