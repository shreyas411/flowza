import React, { useState } from 'react';
import {
  Check,
  Building2,
  Globe,
  Instagram,
  Inbox,
  Users,
  Bot,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Organization, InstagramAccount } from '../../types/crm';
import { apiRequest } from '../../lib/api';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  organization: Organization;
  onCompleted: () => void;
  accounts: InstagramAccount[];
  onOpenConnectInstagram: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  organization,
  onCompleted,
  accounts,
  onOpenConnectInstagram,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(organization.onboardingStep || 1);
  const [industry, setIndustry] = useState(organization.industry || 'Fashion & Apparel');
  const [website, setWebsite] = useState(organization.website || 'https://');
  const [timezone, setTimezone] = useState(organization.timezone || 'UTC');
  const [defaultLanguage, setDefaultLanguage] = useState(organization.defaultLanguage || 'en');
  const [teamEmail, setTeamEmail] = useState('');
  const [teamRole, setTeamRole] = useState('AGENT');
  const [aiTone, setAiTone] = useState('friendly, professional, and concise');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const totalSteps = 6;

  const handleNextStep = async () => {
    setIsSubmitting(true);
    try {
      const nextStepNum = currentStep + 1;
      const isFinishing = nextStepNum > totalSteps;

      await apiRequest('/api/v1/onboarding/step', {
        method: 'POST',
        body: JSON.stringify({
          step: Math.min(nextStepNum, totalSteps),
          completed: isFinishing,
          data: {
            industry,
            website,
            timezone,
            defaultLanguage,
          },
        }),
      });

      if (isFinishing) {
        onCompleted();
        onClose();
      } else {
        setCurrentStep(nextStepNum);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      onCompleted();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="text-[10px] uppercase font-semibold text-indigo-600 tracking-wider">
              Setup Wizard • Step {currentStep} of {totalSteps}
            </div>
            <h3 className="text-sm font-bold text-slate-900 mt-0.5">
              {currentStep === 1 && '1. Business Profile & Industry'}
              {currentStep === 2 && '2. Timezone & Regional Localization'}
              {currentStep === 3 && '3. Instagram Professional Account Connection'}
              {currentStep === 4 && '4. Inbox Routing & Queue Rules'}
              {currentStep === 5 && '5. Invite Your Support Team'}
              {currentStep === 6 && '6. AI Assistant Knowledge & Tone'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-slate-100 h-1">
          <div
            className="bg-indigo-600 h-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        {/* Step Content */}
        <div className="p-6 overflow-y-auto flex-1 text-xs space-y-4">
          {/* STEP 1: Profile */}
          {currentStep === 1 && (
            <div className="space-y-3">
              <p className="text-slate-600 leading-relaxed">
                Configure your workspace profile to tailor automated lead scoring and CRM customer categories.
              </p>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  value={organization.name}
                  disabled
                  className="w-full bg-slate-100 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Industry Sector</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                >
                  <option value="Fashion & Apparel">Fashion &amp; Apparel</option>
                  <option value="Beauty & Cosmetics">Beauty &amp; Cosmetics</option>
                  <option value="Home & Lifestyle">Home &amp; Lifestyle</option>
                  <option value="Food & Beverage">Food &amp; Beverage</option>
                  <option value="Digital Agency">Digital Marketing Agency</option>
                  <option value="Fitness & Health">Fitness &amp; Health</option>
                  <option value="Consumer Electronics">Consumer Electronics</option>
                  <option value="Other Retail">Other Commercial Business</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Store / Business Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourbrand.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Timezone & Language */}
          {currentStep === 2 && (
            <div className="space-y-3">
              <p className="text-slate-600 leading-relaxed">
                Operating hours and Meta 24-hour response calculations align with your business timezone.
              </p>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Business Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800 font-medium"
                >
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">America/New York (EST/EDT)</option>
                  <option value="America/Chicago">America/Chicago (CST)</option>
                  <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Primary Support Language</label>
                <select
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                >
                  <option value="en">English (US/UK)</option>
                  <option value="es">Spanish (Español)</option>
                  <option value="fr">French (Français)</option>
                  <option value="de">German (Deutsch)</option>
                  <option value="hi">Hindi (हिंदी)</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 3: Instagram Connection */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <p className="text-slate-600 leading-relaxed">
                Connect your official Instagram Business or Creator account via Meta Login to stream direct messages and comments into your unified inbox.
              </p>

              {accounts.length > 0 ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-emerald-900">@{accounts[0].username} Connected</div>
                      <div className="text-[11px] text-emerald-700">Official Graph API Token Active</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-medium">
                    Ready
                  </span>
                </div>
              ) : (
                <div className="p-5 border-2 border-dashed border-slate-200 rounded-lg text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white mx-auto">
                    <Instagram className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">No Instagram account connected yet</div>
                    <div className="text-slate-500 text-[11px]">Connect your Instagram Business account to start receiving DMs</div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenConnectInstagram}
                    className="px-3 py-1.5 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-xs"
                  >
                    Connect Instagram Account Now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Inbox Routing */}
          {currentStep === 4 && (
            <div className="space-y-3">
              <p className="text-slate-600 leading-relaxed">
                Choose how new incoming Instagram inquiries are routed to your team:
              </p>

              <div className="space-y-2">
                <label className="p-3 rounded-lg border border-indigo-600 bg-indigo-50/40 flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="routing" defaultChecked className="mt-0.5 text-indigo-600" />
                  <div>
                    <div className="font-semibold text-slate-900">Hybrid AI First + Human Escalation</div>
                    <div className="text-slate-500 text-[11px]">
                      AI handles common questions instantly; unassigned complex inquiries escalate to human agents.
                    </div>
                  </div>
                </label>

                <label className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 flex items-start gap-3 cursor-pointer">
                  <input type="radio" name="routing" className="mt-0.5 text-indigo-600" />
                  <div>
                    <div className="font-semibold text-slate-900">Human Only (Suggestion Mode)</div>
                    <div className="text-slate-500 text-[11px]">
                      AI prepares drafts for agents to review, edit, and dispatch manually.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 5: Invite Team */}
          {currentStep === 5 && (
            <div className="space-y-3">
              <p className="text-slate-600 leading-relaxed">
                Invite your colleagues or customer support agents to collaborate in this workspace:
              </p>

              <div className="space-y-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Colleague Email</label>
                  <input
                    type="email"
                    value={teamEmail}
                    onChange={(e) => setTeamEmail(e.target.value)}
                    placeholder="support-rep@company.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">Assigned Role</label>
                  <select
                    value={teamRole}
                    onChange={(e) => setTeamRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGER">Manager</option>
                    <option value="AGENT">Customer Support Agent</option>
                    <option value="VIEWER">Viewer (Read-only)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: AI Tone */}
          {currentStep === 6 && (
            <div className="space-y-3">
              <p className="text-slate-600 leading-relaxed">
                Set the default communication tone for AI suggested and automatic replies:
              </p>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Brand Tone of Voice</label>
                <input
                  type="text"
                  value={aiTone}
                  onChange={(e) => setAiTone(e.target.value)}
                  placeholder="e.g. warm, polite, direct, concise"
                  className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs text-slate-800"
                />
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-200/60 rounded-lg text-purple-900 text-xs">
                ✨ Your Knowledge Base is pre-loaded with standard customer policies. You can add custom documents anytime in the Knowledge Base tab.
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-3 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSkip}
              className="px-3 py-1.5 text-slate-500 hover:text-slate-800 text-xs font-medium"
            >
              Skip Step
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-2xs"
            >
              <span>{currentStep === totalSteps ? 'Complete Onboarding' : 'Continue'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
