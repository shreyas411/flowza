import React, { useState, useEffect } from 'react';
import {
  Zap,
  Plus,
  Play,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Filter,
  History,
  X,
} from 'lucide-react';
import { AutomationRule } from '../../types/crm';
import { apiRequest } from '../../lib/api';

export const AutomationsView: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('KEYWORD_DETECTED');
  const [keywordMatch, setKeywordMatch] = useState('');
  const [actionType, setActionType] = useState('ADD_TAG');
  const [actionPayloadTag, setActionPayloadTag] = useState('');

  const loadAutomations = () => {
    apiRequest<{ rules: AutomationRule[]; executions: any[] }>('/api/v1/automations')
      .then((data) => {
        setRules(data.rules);
        setExecutions(data.executions);
      })
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadAutomations();
  }, []);

  const handleToggleRule = async (ruleId: string) => {
    try {
      await apiRequest(`/api/v1/automations/${ruleId}/toggle`, { method: 'POST' });
      loadAutomations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/v1/automations', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          triggerType,
          keywordMatch,
          actionType,
          actionPayload: { tag: actionPayloadTag || 'Automated' },
        }),
      });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setKeywordMatch('');
      loadAutomations();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Automation Rule Engine</h2>
          <p className="text-xs text-slate-500">
            Set up conditional triggers on incoming Instagram messages, keywords, or customer sentiment
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-2xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Automation Rule</span>
        </button>
      </div>

      {/* Rules List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className={`bg-white border rounded-lg p-4 shadow-2xs transition-colors flex flex-col justify-between ${
              rule.isActive ? 'border-slate-200' : 'border-slate-200/60 opacity-60'
            }`}
          >
            <div>
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                      rule.isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-xs">{rule.name}</h4>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">{rule.triggerType}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleRule(rule.id)}
                  className="p-1 text-slate-500 hover:text-slate-800"
                  title={rule.isActive ? 'Disable rule' : 'Enable rule'}
                >
                  {rule.isActive ? (
                    <ToggleRight className="w-6 h-6 text-indigo-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-slate-300" />
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-600 mb-3">{rule.description}</p>

              {rule.keywordMatch && (
                <div className="text-[11px] bg-slate-50 p-2 rounded border border-slate-100 text-slate-600 mb-3">
                  <span className="font-medium text-slate-700">Trigger Keywords: </span>
                  <span className="font-mono text-indigo-700">{rule.keywordMatch}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-medium text-slate-700">Action: {rule.actionType.replace('_', ' ')}</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] ${rule.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {rule.isActive ? 'Active' : 'Disabled'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Execution Audit History */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-900 text-xs">Recent Automation Executions</h3>
          </div>
          <span className="text-[11px] text-slate-400">{executions.length} logged runs</span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-[11px] uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-4">Timestamp</th>
              <th className="py-2.5 px-4">Rule Name</th>
              <th className="py-2.5 px-4">Execution Summary</th>
              <th className="py-2.5 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {executions.map((exec) => (
              <tr key={exec.id} className="hover:bg-slate-50">
                <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                  {new Date(exec.createdAt).toLocaleTimeString()}
                </td>
                <td className="py-2.5 px-4 font-semibold text-slate-900">{exec.ruleName}</td>
                <td className="py-2.5 px-4 text-slate-600">{exec.resultSummary}</td>
                <td className="py-2.5 px-4">
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-medium">
                    {exec.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Rule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-lg w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-semibold text-slate-900">Create Automation Rule</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. VIP Customer Tagging"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Explain when this rule fires..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Trigger Event</label>
                <select
                  value={triggerType}
                  onChange={(e) => setTriggerType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                >
                  <option value="KEYWORD_DETECTED">Keyword Match in Customer Message</option>
                  <option value="HUMAN_REQUESTED">Customer Asks for Human Representative</option>
                  <option value="INCOMING_MESSAGE">Every New Incoming Message</option>
                </select>
              </div>

              {triggerType === 'KEYWORD_DETECTED' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Keywords (Comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. wholesale, bulk, discount, return"
                    value={keywordMatch}
                    onChange={(e) => setKeywordMatch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Action to Take</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                >
                  <option value="ADD_TAG">Add Conversation Tag</option>
                  <option value="ESCALATE_HUMAN">Escalate to Human &amp; Pause AI</option>
                  <option value="CHANGE_LEAD_STATUS">Mark Contact as Qualified Lead</option>
                  <option value="ENABLE_AI">Enable AI Assistant</option>
                </select>
              </div>

              {actionType === 'ADD_TAG' && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Tag Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Wholesale Lead"
                    value={actionPayloadTag}
                    onChange={(e) => setActionPayloadTag(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
              )}

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
                  className="px-3.5 py-1.5 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
