import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Building2,
  FileText,
  Shield,
  Check,
  Sparkles,
  ExternalLink,
  History,
  Lock,
  User,
  KeyRound,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  BellRing,
  Globe,
  Receipt,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Plan, Subscription, Organization, User as UserType, Invoice } from '../../types/crm';

interface SettingsViewProps {
  currentUser?: UserType;
  currentOrg?: Organization;
  onUserUpdated?: (user: UserType) => void;
  onOrgUpdated?: (org: Organization) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  currentOrg,
  onUserUpdated,
  onOrgUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'ORG' | 'BILLING' | 'AUDIT' | 'API'>('PROFILE');
  
  // Billing Data
  const [billingData, setBillingData] = useState<{
    subscription: Subscription;
    plan: Plan;
    availablePlans: Plan[];
    currentUsage: { accounts: number; seats: number; aiTokens: number };
    invoices?: Invoice[];
  } | null>(null);

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [upgradedPlanId, setUpgradedPlanId] = useState<string | null>(null);

  // Profile Form State
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [userTimezone, setUserTimezone] = useState(currentUser?.timezone || 'America/New_York');
  const [userLanguage, setUserLanguage] = useState(currentUser?.language || 'en');
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Org Form State
  const [orgName, setOrgName] = useState(currentOrg?.name || '');
  const [orgDescription, setOrgDescription] = useState(currentOrg?.description || '');
  const [orgIndustry, setOrgIndustry] = useState(currentOrg?.industry || 'Fashion & Retail');
  const [orgWebsite, setOrgWebsite] = useState(currentOrg?.website || '');
  const [orgEmail, setOrgEmail] = useState(currentOrg?.email || '');
  const [orgPhone, setOrgPhone] = useState(currentOrg?.phone || '');
  const [orgAddress, setOrgAddress] = useState(currentOrg?.address || '');
  const [orgTimezone, setOrgTimezone] = useState(currentOrg?.timezone || 'America/New_York');
  const [orgLanguage, setOrgLanguage] = useState(currentOrg?.defaultLanguage || 'en');
  const [orgLogoUrl, setOrgLogoUrl] = useState(currentOrg?.logoUrl || '');
  const [orgSuccess, setOrgSuccess] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [isSavingOrg, setIsSavingOrg] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Sync state when props change
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName);
      setPhone(currentUser.phone || '');
      setUserTimezone(currentUser.timezone || 'America/New_York');
      setUserLanguage(currentUser.language || 'en');
      setAvatarUrl(currentUser.avatarUrl || '');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setOrgDescription(currentOrg.description || '');
      setOrgIndustry(currentOrg.industry || 'Fashion & Retail');
      setOrgWebsite(currentOrg.website || '');
      setOrgEmail(currentOrg.email || '');
      setOrgPhone(currentOrg.phone || '');
      setOrgAddress(currentOrg.address || '');
      setOrgTimezone(currentOrg.timezone || 'America/New_York');
      setOrgLanguage(currentOrg.defaultLanguage || 'en');
      setOrgLogoUrl(currentOrg.logoUrl || '');
    }
  }, [currentOrg]);

  const loadBilling = () => {
    apiRequest('/api/v1/billing/subscription')
      .then((data) => setBillingData(data))
      .catch((err) => console.error(err));

    apiRequest('/api/v1/audit-logs')
      .then((data) => setAuditLogs(data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadBilling();
  }, []);

  const handleUpgradePlan = async (planId: string) => {
    try {
      await apiRequest('/api/v1/billing/upgrade', {
        method: 'POST',
        body: JSON.stringify({ planId }),
      });
      setUpgradedPlanId(planId);
      loadBilling();
      setTimeout(() => setUpgradedPlanId(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccess(null);
    setProfileError(null);
    try {
      const res = await apiRequest('/api/v1/users/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          phone,
          timezone: userTimezone,
          language: userLanguage,
          avatarUrl,
        }),
      });
      setProfileSuccess('Profile updated successfully!');
      if (onUserUpdated && res.user) onUserUpdated(res.user);
      setTimeout(() => setProfileSuccess(null), 3500);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    setIsChangingPassword(true);
    setPasswordSuccess(null);
    setPasswordError(null);
    try {
      await apiRequest('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setPasswordSuccess('Password changed successfully! Other sessions invalidated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 3500);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    setIsSavingOrg(true);
    setOrgSuccess(null);
    setOrgError(null);
    try {
      const res = await apiRequest(`/api/v1/organizations/${currentOrg.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: orgName,
          description: orgDescription,
          industry: orgIndustry,
          website: orgWebsite,
          email: orgEmail,
          phone: orgPhone,
          address: orgAddress,
          timezone: orgTimezone,
          defaultLanguage: orgLanguage,
          logoUrl: orgLogoUrl,
        }),
      });
      setOrgSuccess('Organization settings saved successfully!');
      if (onOrgUpdated && res.organization) onOrgUpdated(res.organization);
      setTimeout(() => setOrgSuccess(null), 3500);
    } catch (err: any) {
      setOrgError(err.message || 'Failed to update organization');
    } finally {
      setIsSavingOrg(false);
    }
  };

  const handleExportData = async () => {
    if (!currentOrg) return;
    setIsExporting(true);
    try {
      const data = await apiRequest(`/api/v1/organizations/${currentOrg.id}/export`, {
        method: 'POST',
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `instaflow-data-export-${currentOrg.slug || 'org'}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteOrg = async () => {
    if (!currentOrg || deleteConfirmText !== currentOrg.name) return;
    try {
      await apiRequest(`/api/v1/organizations/${currentOrg.id}`, { method: 'DELETE' });
      alert('Organization deleted. Reloading...');
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to delete organization');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-800">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Workspace Settings &amp; Configuration</h2>
          <p className="text-xs text-slate-500">
            Manage your profile, organization profile, subscription, team usage limits, and Meta compliance
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md text-xs font-medium overflow-x-auto">
          <button
            onClick={() => setActiveTab('PROFILE')}
            className={`px-3 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'PROFILE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            User Profile
          </button>
          <button
            onClick={() => setActiveTab('ORG')}
            className={`px-3 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'ORG' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Organization
          </button>
          <button
            onClick={() => setActiveTab('BILLING')}
            className={`px-3 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'BILLING' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Subscription &amp; Plans
          </button>
          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`px-3 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'AUDIT' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Audit Logs ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('API')}
            className={`px-3 py-1 rounded transition-colors whitespace-nowrap ${
              activeTab === 'API' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Meta API Specs
          </button>
        </div>
      </div>

      {/* USER PROFILE TAB */}
      {activeTab === 'PROFILE' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveProfile} className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-slate-900 text-sm">Personal Profile &amp; Preferences</span>
              </div>
              {profileSuccess && (
                <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {profileSuccess}
                </span>
              )}
            </div>

            {profileError && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {profileError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={currentUser?.email || ''}
                  disabled
                  className="w-full px-3 py-1.5 border border-slate-200 rounded bg-slate-50 text-slate-500 text-xs cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400">Account login identifier</span>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Avatar Image URL</label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Timezone</label>
                <select
                  value={userTimezone}
                  onChange={(e) => setUserTimezone(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="America/New_York">Eastern Time (US &amp; Canada) - New York</option>
                  <option value="America/Chicago">Central Time (US &amp; Canada) - Chicago</option>
                  <option value="America/Los_Angeles">Pacific Time (US &amp; Canada) - Los Angeles</option>
                  <option value="Europe/London">London (GMT+1)</option>
                  <option value="Europe/Paris">Paris, Berlin (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="UTC">UTC Standard</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Interface Language</label>
                <select
                  value={userLanguage}
                  onChange={(e) => setUserLanguage(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="en">English (US)</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="pt">Português</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
              >
                {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>

          {/* Change Password Form */}
          <form onSubmit={handleChangePassword} className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-slate-700" />
                <span className="font-semibold text-slate-900 text-sm">Security &amp; Password Management</span>
              </div>
              {passwordSuccess && (
                <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {passwordSuccess}
                </span>
              )}
            </div>

            {passwordError && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {passwordError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-medium transition-colors shadow-2xs"
              >
                {isChangingPassword ? 'Updating Password...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ORGANIZATION TAB */}
      {activeTab === 'ORG' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveOrg} className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-slate-900 text-sm">Organization Profile &amp; Details</span>
              </div>
              {orgSuccess && (
                <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {orgSuccess}
                </span>
              )}
            </div>

            {orgError && (
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {orgError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Organization Name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Industry</label>
                <select
                  value={orgIndustry}
                  onChange={(e) => setOrgIndustry(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="Fashion & Apparel">Fashion &amp; Apparel</option>
                  <option value="Beauty & Cosmetics">Beauty &amp; Cosmetics</option>
                  <option value="Health & Wellness">Health &amp; Wellness</option>
                  <option value="Digital Agency">Digital Agency</option>
                  <option value="Consumer Goods">Consumer Goods</option>
                  <option value="SaaS & Technology">SaaS &amp; Technology</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-medium mb-1">Business Description</label>
                <textarea
                  value={orgDescription}
                  onChange={(e) => setOrgDescription(e.target.value)}
                  rows={2}
                  placeholder="Brief description used for AI context and automated replies..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Official Website</label>
                <input
                  type="url"
                  value={orgWebsite}
                  onChange={(e) => setOrgWebsite(e.target.value)}
                  placeholder="https://yourbrand.com"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Business Email</label>
                <input
                  type="email"
                  value={orgEmail}
                  onChange={(e) => setOrgEmail(e.target.value)}
                  placeholder="support@yourbrand.com"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Business Phone</label>
                <input
                  type="tel"
                  value={orgPhone}
                  onChange={(e) => setOrgPhone(e.target.value)}
                  placeholder="+1 (800) 555-0199"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Brand Logo URL</label>
                <input
                  type="url"
                  value={orgLogoUrl}
                  onChange={(e) => setOrgLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-medium mb-1">Registered Business Address</label>
                <input
                  type="text"
                  value={orgAddress}
                  onChange={(e) => setOrgAddress(e.target.value)}
                  placeholder="100 Main Street, Suite 400, New York, NY 10001"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingOrg}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium transition-colors shadow-2xs"
              >
                {isSavingOrg ? 'Saving Organization...' : 'Save Organization Settings'}
              </button>
            </div>
          </form>

          {/* Data Export & Danger Zone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-indigo-600" />
                <span className="font-semibold text-slate-900 text-sm">GDPR &amp; Meta Data Export</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Download a complete, structured JSON bundle of all contacts, Instagram conversations, audit logs, and integration records in compliance with Meta data privacy standards.
              </p>
              <button
                onClick={handleExportData}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExporting ? 'Exporting...' : 'Export Workspace Data (JSON)'}</span>
              </button>
            </div>

            {/* Danger Zone */}
            <div className="bg-white border border-rose-200 rounded-lg p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-semibold text-slate-900 text-sm">Danger Zone</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Permanently delete this organization, unlinking all Instagram accounts, messages, contacts, and audit histories. This action is irreversible.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-xs font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Organization</span>
              </button>
            </div>
          </div>

          {/* Delete Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-5 max-w-md w-full border border-slate-200 shadow-xl space-y-4 text-xs">
                <div className="flex items-center gap-2 text-rose-600 font-semibold text-sm">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Confirm Organization Deletion</span>
                </div>
                <p className="text-slate-600">
                  To confirm deletion of <strong>{currentOrg?.name}</strong>, please type the organization name below:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={currentOrg?.name}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs"
                />
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteOrg}
                    disabled={deleteConfirmText !== currentOrg?.name}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium disabled:opacity-50"
                  >
                    Permanently Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBSCRIPTION & BILLING TAB */}
      {activeTab === 'BILLING' && billingData && (
        <div className="space-y-6">
          {/* Current Usage Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="font-semibold text-slate-900 text-sm">Active Plan: {billingData.plan.displayName || billingData.plan.name}</span>
                <span className="text-[11px] text-slate-400 block">
                  ${billingData.plan.priceMonthly}/month • Renews on {new Date(billingData.subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium border border-emerald-200">
                {billingData.subscription.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 rounded bg-slate-50 border border-slate-100">
                <div className="text-slate-500 mb-1">Instagram Accounts</div>
                <div className="text-base font-bold text-slate-900">
                  {billingData.currentUsage.accounts} / {billingData.plan.maxAccounts}
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full"
                    style={{
                      width: `${Math.min(100, (billingData.currentUsage.accounts / billingData.plan.maxAccounts) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="p-3 rounded bg-slate-50 border border-slate-100">
                <div className="text-slate-500 mb-1">Team Agent Seats</div>
                <div className="text-base font-bold text-slate-900">
                  {billingData.currentUsage.seats} / {billingData.plan.maxSeats}
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full"
                    style={{
                      width: `${Math.min(100, (billingData.currentUsage.seats / billingData.plan.maxSeats) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="p-3 rounded bg-slate-50 border border-slate-100">
                <div className="text-slate-500 mb-1">AI Tokens Processed</div>
                <div className="text-base font-bold text-slate-900">
                  {billingData.currentUsage.aiTokens.toLocaleString()} / {billingData.plan.maxAiTokens.toLocaleString()}
                </div>
                <div className="h-1.5 w-full bg-slate-200 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{
                      width: `${Math.min(100, (billingData.currentUsage.aiTokens / billingData.plan.maxAiTokens) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Available Plans Grid */}
          <div>
            <h3 className="font-semibold text-slate-900 text-xs mb-3">Subscription Tier Selection</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {billingData.availablePlans.map((p) => {
                const isCurrent = p.id === billingData.plan.id;
                return (
                  <div
                    key={p.id}
                    className={`bg-white rounded-lg p-4 border flex flex-col justify-between space-y-4 shadow-2xs transition-all ${
                      isCurrent ? 'border-indigo-600 ring-1 ring-indigo-600/30' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-sm">{p.displayName || p.name}</span>
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                            Current
                          </span>
                        )}
                      </div>
                      <div className="text-xl font-extrabold text-slate-900 mb-2">
                        ${p.priceMonthly}
                        <span className="text-xs font-normal text-slate-400">/mo</span>
                      </div>

                      <ul className="space-y-1.5 text-[11px] text-slate-600 border-t border-slate-100 pt-3">
                        {p.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button
                      onClick={() => handleUpgradePlan(p.id)}
                      disabled={isCurrent}
                      className={`w-full py-1.5 rounded text-xs font-medium transition-colors ${
                        isCurrent
                          ? 'bg-slate-100 text-slate-400 cursor-default'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                      }`}
                    >
                      {isCurrent ? 'Current Plan' : 'Select Plan'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Invoices History */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-700" />
                <span className="font-semibold text-xs text-slate-900">Billing History &amp; Invoices</span>
              </div>
              <span className="text-[11px] text-slate-400">Automated monthly billing records</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Amount</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billingData.invoices && billingData.invoices.length > 0 ? (
                  billingData.invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50 text-[11px]">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{inv.invoiceNumber}</td>
                      <td className="py-2.5 px-4 text-slate-500">{new Date(inv.date).toLocaleDateString()}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">${inv.amount} {inv.currency}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium text-[10px] border border-emerald-200">
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => alert(`Downloading PDF for invoice ${inv.invoiceNumber}...`)}
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Download PDF
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400 text-xs">
                      No invoices generated yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {activeTab === 'AUDIT' && (
        <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="font-semibold text-xs text-slate-900">Security &amp; Activity Audit Log</span>
            <span className="text-[11px] text-slate-400">Immutable organization event log</span>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4">Target Resource</th>
                <th className="py-2.5 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 font-mono text-[11px]">
                  <td className="py-2.5 px-4 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="py-2.5 px-4 font-sans text-xs text-slate-800 font-medium">{log.userName || 'System'}</td>
                  <td className="py-2.5 px-4 text-indigo-700 font-semibold">{log.action}</td>
                  <td className="py-2.5 px-4 text-slate-600">{log.targetType}: {log.targetId}</td>
                  <td className="py-2.5 px-4 text-slate-400">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* API SPECS TAB */}
      {activeTab === 'API' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-4 text-xs">
          <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm pb-2 border-b border-slate-100">
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Meta Instagram Graph API v21.0 &amp; Production Architecture</span>
          </div>

          <div className="space-y-3 leading-relaxed text-slate-600">
            <p>
              Flowza communicates directly with official Meta Instagram Graph API endpoints. Tokens are encrypted using AES-256-GCM. Outbound messages strictly enforce the 24-hour standard messaging window unless the 7-day Human Agent exception tag is applied.
            </p>

            <div className="bg-slate-50 p-3 rounded font-mono text-[11px] space-y-1.5 border border-slate-200">
              <div className="text-slate-900 font-bold">Key Production Endpoints:</div>
              <div>POST /api/v1/auth/register - Multi-tenant user &amp; organization registration</div>
              <div>POST /api/v1/auth/login - Secure login with 5-attempt brute-force lockout</div>
              <div>GET  /api/v1/conversations - Filterable conversation stream</div>
              <div>POST /api/v1/conversations/:id/messages - Outbound message with 24h Meta policy check</div>
              <div>POST /api/v1/ai/suggest - Grounded AI response generation via Gemini 2.5 Flash</div>
              <div>GET  /webhooks/instagram - Meta hub challenge verification</div>
              <div>POST /webhooks/instagram - HMAC SHA-256 verified inbound webhook ingestion</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
