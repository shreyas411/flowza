import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Settings,
  Shield,
  Activity,
  Check,
  Save,
  AlertTriangle,
  History,
  FileText,
} from 'lucide-react';
import { AISettings } from '../../types/crm';
import { apiRequest } from '../../lib/api';

export const AIAssistantView: React.FC = () => {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'SETTINGS' | 'LOGS'>('SETTINGS');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    apiRequest<AISettings>('/api/v1/ai/settings')
      .then((data) => setSettings(data))
      .catch((err) => console.error(err));

    apiRequest<any[]>('/api/v1/ai/executions')
      .then((data) => setLogs(data))
      .catch((err) => console.error(err));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const updated = await apiRequest<AISettings>('/api/v1/ai/settings', {
        method: 'PATCH',
        body: JSON.stringify(settings),
      });
      setSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading AI settings...</div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-800">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">AI Assistant Engine</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium border border-purple-200 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> Gemini 2.5 Flash / OpenAI Grounded
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure automated response rules, brand persona, confidence thresholds, and human handoff guardrails
          </p>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-medium">
          <button
            onClick={() => setActiveSubTab('SETTINGS')}
            className={`px-3 py-1 rounded transition-colors ${
              activeSubTab === 'SETTINGS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Configuration
          </button>
          <button
            onClick={() => setActiveSubTab('LOGS')}
            className={`px-3 py-1 rounded transition-colors ${
              activeSubTab === 'LOGS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Execution Logs ({logs.length})
          </button>
        </div>
      </div>

      {activeSubTab === 'SETTINGS' ? (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Main Operational Mode Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-slate-900 text-sm">Operating Mode</span>
              </div>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <span>Enable AI Assistant</span>
                <input
                  type="checkbox"
                  checked={settings.isEnabled}
                  onChange={(e) => setSettings({ ...settings, isEnabled: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              {[
                {
                  id: 'DISABLED',
                  title: 'Disabled',
                  desc: 'AI does not draft or send any messages.',
                },
                {
                  id: 'SUGGESTION',
                  title: 'Suggestion Mode',
                  desc: 'Drafts responses for agents to review and send manually.',
                },
                {
                  id: 'AUTOMATIC',
                  title: 'Automatic Mode',
                  desc: 'Automatically sends replies whenever policy checks pass.',
                },
                {
                  id: 'HYBRID',
                  title: 'Hybrid Mode',
                  desc: 'Auto-replies when confidence is high; escalates complex cases to humans.',
                },
              ].map((m) => {
                const isSelected = settings.mode === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSettings({ ...settings, mode: m.id as any })}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 text-slate-900'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                    }`}
                  >
                    <div className="font-semibold text-xs mb-1 flex items-center justify-between">
                      <span>{m.title}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </div>
                    <div className="text-[11px] text-slate-500 leading-relaxed">{m.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Business Profile & Persona */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4 text-xs">
            <h3 className="font-semibold text-slate-900 text-xs border-b border-slate-100 pb-2">
              Business Profile &amp; Tone of Voice
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Business Name</label>
                <input
                  type="text"
                  value={settings.businessName}
                  onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Industry</label>
                <input
                  type="text"
                  value={settings.industry}
                  onChange={(e) => setSettings({ ...settings, industry: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Business Description</label>
              <textarea
                rows={2}
                value={settings.businessDescription}
                onChange={(e) => setSettings({ ...settings, businessDescription: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Tone of Voice</label>
                <input
                  type="text"
                  value={settings.tone}
                  onChange={(e) => setSettings({ ...settings, tone: e.target.value })}
                  placeholder="e.g. warm, direct, elegant, professional"
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Operating Hours</label>
                <input
                  type="text"
                  value={settings.workingHours}
                  onChange={(e) => setSettings({ ...settings, workingHours: e.target.value })}
                  placeholder="e.g. 9am - 8pm EST"
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* AI Guardrails & Human Handoff */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4 text-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-slate-900 text-xs">AI Safety, Confidence &amp; Escalations</h3>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-slate-700">
                  Confidence Threshold for Auto-Sending: {Math.round(settings.confidenceThreshold * 100)}%
                </label>
                <span className="text-[10px] text-slate-400">
                  Responses below this score pause AI and transfer to human
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={settings.confidenceThreshold}
                onChange={(e) => setSettings({ ...settings, confidenceThreshold: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">Escalation Conditions</label>
              <input
                type="text"
                value={settings.escalationConditions}
                onChange={(e) => setSettings({ ...settings, escalationConditions: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">
                Human Handoff Instructions for Customer
              </label>
              <textarea
                rows={2}
                value={settings.humanHandoffInstructions}
                onChange={(e) => setSettings({ ...settings, humanHandoffInstructions: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            {saveSuccess && (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> AI Settings Saved!
              </span>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save AI Configuration'}</span>
            </button>
          </div>
        </form>
      ) : (
        /* Execution Logs Table */
        <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-xs text-slate-900">AI Token &amp; Execution Audit Log</span>
            <span className="text-[11px] text-slate-400">Total logged executions: {logs.length}</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Model</th>
                <th className="py-2.5 px-4">Intent</th>
                <th className="py-2.5 px-4">Tokens</th>
                <th className="py-2.5 px-4">Confidence</th>
                <th className="py-2.5 px-4">Latency</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</td>
                  <td className="py-2.5 px-4 text-slate-800">{log.model}</td>
                  <td className="py-2.5 px-4 font-sans text-xs text-indigo-600 font-medium">{log.intentDetected}</td>
                  <td className="py-2.5 px-4 text-slate-600">{log.promptTokens + log.responseTokens}</td>
                  <td className="py-2.5 px-4 text-slate-600">{Math.round((log.confidence || 0.85) * 100)}%</td>
                  <td className="py-2.5 px-4 text-slate-600">{log.executionTimeMs}ms</td>
                  <td className="py-2.5 px-4 font-sans">
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
