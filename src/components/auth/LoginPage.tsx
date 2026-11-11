import React, { useEffect, useState } from 'react';
import {
  Lock,
  Mail,
  User,
  Building2,
  Key,
  Shield,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Instagram,
  CheckCheck,
  TrendingUp,
  MessageSquare,
  Zap,
  Users,
  ShieldCheck,
  Bot,
} from 'lucide-react';
import { apiRequest, setAuthToken } from '../../lib/api';

interface LoginPageProps {
  onAuthSuccess: (userData: any, orgId: string) => void;
  onCancel?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuthSuccess, onCancel }) => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT' | 'RESET' | 'VERIFY' | 'INVITE'>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState<'BUSINESS' | 'AGENCY'>('BUSINESS');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [inviteToken, setInviteToken] = useState('');
  const [invite, setInvite] = useState<{
    email: string;
    role: string;
    invitedByName?: string;
    organizationName?: string;
    needsPassword: boolean;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const strength = getPasswordStrength(password);

  // Links from emails: /?reset=…, /?invite=…, /?verify=…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reset = params.get('reset');
    const inviteParam = params.get('invite');
    const verify = params.get('verify');
    if (!reset && !inviteParam && !verify) return;
    window.history.replaceState(null, '', window.location.pathname); // keep tokens out of history/bookmarks

    if (reset) {
      setResetToken(reset);
      setMode('RESET');
    } else if (inviteParam) {
      setInviteToken(inviteParam);
      setMode('INVITE');
      apiRequest('/api/v1/auth/invite-info', { method: 'POST', body: JSON.stringify({ token: inviteParam }) })
        .then(setInvite)
        .catch((err) => setErrorMsg(err.message || 'Invitation is invalid or has expired'));
    } else if (verify) {
      setMode('LOGIN');
      apiRequest('/api/v1/auth/verify-email', { method: 'POST', body: JSON.stringify({ token: verify }) })
        .then((res) => setSuccessMsg(res.message || 'Email verified!'))
        .catch((err) => setErrorMsg(err.message || 'Verification link is invalid or has expired'));
    }
  }, []);

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invite?.needsPassword && password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiRequest('/api/v1/auth/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token: inviteToken, password, fullName: fullName || undefined }),
      });
      setAuthToken(res.token);
      onAuthSuccess(null, res.organizationId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(res.token);
      onAuthSuccess(res.user, res.organizationId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      setErrorMsg('You must agree to the Terms of Service and Privacy Policy');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await apiRequest('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          fullName,
          organizationName: orgName,
          organizationType: orgType,
        }),
      });

      setSuccessMsg(res.message || 'Registration successful!');
      if (res.user && res.organizationId) {
        setAuthToken(res.token);
        setTimeout(() => {
          onAuthSuccess(res.user, res.organizationId);
        }, 1200);
      } else {
        setMode('LOGIN');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await apiRequest('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSuccessMsg(res.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send reset link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await apiRequest('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      setSuccessMsg(res.message);
      setTimeout(() => {
        setMode('LOGIN');
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Password reset failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await apiRequest('/api/v1/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: verifyToken }),
      });
      setSuccessMsg(res.message);
      setTimeout(() => {
        setMode('LOGIN');
        setSuccessMsg(null);
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen w-full flex bg-[#F8FAFC] text-slate-800 antialiased select-none overflow-x-hidden">
      {/* LEFT SIDE: Promotional / Advertise Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 p-12 flex-col justify-between text-white relative overflow-hidden">
        {/* Decorative background glow accents */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

        {/* Top Branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Instagram className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Flowza
                <span className="text-[10px] uppercase font-semibold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                  Enterprise
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Center Marketing Value Proposition & Preview */}
        <div className="relative z-10 space-y-6 my-auto max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Official Meta Instagram Graph API v21.0 Certified</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
            Scale your Instagram DMs into high-converting sales pipelines.
          </h1>

          <p className="text-slate-300 text-sm leading-relaxed">
            The unified Instagram CRM built for direct brands and digital agencies. Ground AI replies in your official knowledge base, automate comment conversions, and never breach Meta&apos;s 24-hour messaging policy.
          </p>

          {/* Value props list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-200 pt-2">
            <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 p-2.5 rounded-lg backdrop-blur-xs">
              <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Unified DMs &amp; Comments Inbox</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 p-2.5 rounded-lg backdrop-blur-xs">
              <Bot className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Gemini 2.5 Grounded Assistant</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 p-2.5 rounded-lg backdrop-blur-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>24h Meta SLA &amp; 7d Human Tags</span>
            </div>
            <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 p-2.5 rounded-lg backdrop-blur-xs">
              <Users className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Multi-Client Agency Workspaces</span>
            </div>
          </div>
        </div>

        {/* Footer Meta compliance guarantee */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/10 pt-4">
          <span>AES-256-GCM Encrypted Data</span>
          <span>SOC2 &amp; GDPR Compliant</span>
          <span>Meta Tech Partner</span>
        </div>
      </div>

      {/* RIGHT SIDE: Authentication Form Panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-12 overflow-y-auto">
        {/* Top Header for Mobile & Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center text-white">
              <Instagram className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900 text-sm">Flowza</span>
          </div>

          {onCancel && (
            <button
              onClick={onCancel}
              className="text-xs text-slate-500 hover:text-slate-800 ml-auto transition-colors font-medium"
            >
              Back to workspace →
            </button>
          )}
        </div>

        {/* Centered Form Container */}
        <div className="max-w-md w-full mx-auto space-y-6 my-auto">
          {/* Title and Switcher */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {mode === 'LOGIN' && 'Welcome back'}
              {mode === 'REGISTER' && 'Create your Flowza workspace'}
              {mode === 'FORGOT' && 'Reset your password'}
              {mode === 'RESET' && 'Set new password'}
              {mode === 'VERIFY' && 'Verify your email address'}
              {mode === 'INVITE' && (invite?.organizationName ? `Join ${invite.organizationName}` : 'Accept invitation')}
            </h2>
            <p className="text-xs text-slate-500">
              {mode === 'LOGIN' && 'Enter your credentials to access your multi-tenant Instagram CRM.'}
              {mode === 'REGISTER' && 'Start your 14-day free trial. No credit card required.'}
              {mode === 'FORGOT' && 'Enter your account email and we will send you a reset link.'}
              {mode === 'RESET' && 'Choose a new password for your account.'}
              {mode === 'VERIFY' && 'Enter your verification token to activate your account.'}
              {mode === 'INVITE' && invite && `${invite.invitedByName || 'A teammate'} invited ${invite.email} to join as ${invite.role}.`}
            </p>
          </div>

          {/* Mode Tabs for Login / Register */}
          {(mode === 'LOGIN' || mode === 'REGISTER') && (
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setMode('LOGIN');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-1.5 rounded-md text-center transition-all ${
                  mode === 'LOGIN'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('REGISTER');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`flex-1 py-1.5 rounded-md text-center transition-all ${
                  mode === 'REGISTER'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Error & Success Alerts */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">{successMsg}</div>
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === 'LOGIN' && (
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-medium">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('FORGOT');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 text-[11px] font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Remember me for 30 days</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Sign in to Workspace'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === 'REGISTER' && (
            <form onSubmit={handleRegister} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Your Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Work Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sarah@yourbrand.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Workspace Name</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Retail"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Workspace Type</label>
                  <select
                    value={orgType}
                    onChange={(e) => setOrgType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                  >
                    <option value="BUSINESS">Single Business / Brand</option>
                    <option value="AGENCY">Agency (Multi-Client)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full pl-9 pr-9 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password strength bar */}
                {password.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex gap-1 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          strength === 1
                            ? 'w-1/4 bg-rose-500'
                            : strength === 2
                            ? 'w-2/4 bg-amber-500'
                            : strength === 3
                            ? 'w-3/4 bg-blue-500'
                            : 'w-full bg-emerald-500'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Strength: {strength <= 1 ? 'Weak' : strength <= 3 ? 'Medium' : 'Strong'}
                    </span>
                  </div>
                )}
              </div>

              {/* Terms & Privacy acceptance */}
              <div className="pt-1">
                <label className="flex items-start gap-2 cursor-pointer text-slate-600 text-[11px] leading-tight">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    required
                  />
                  <span>
                    I accept the{' '}
                    <span className="text-indigo-600 underline">Terms of Service</span> and{' '}
                    <span className="text-indigo-600 underline">Privacy Policy</span>, and agree to Meta&apos;s commercial terms.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? 'Creating account...' : 'Create Flowza Workspace'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'FORGOT' && (
            <form onSubmit={handleForgotPassword} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Enter your registered email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className="w-1/2 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Back to Sign In
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-1/2 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </div>
            </form>
          )}

          {/* ACCEPT INVITATION FORM */}
          {mode === 'INVITE' && invite && (
            <form onSubmit={handleAcceptInvite} className="space-y-4 text-xs">
              {invite.needsPassword && (
                <div>
                  <label htmlFor="invite-name" className="block text-slate-700 font-medium mb-1">Your name</label>
                  <input
                    id="invite-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    autoComplete="name"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  />
                </div>
              )}
              <div>
                <label htmlFor="invite-password" className="block text-slate-700 font-medium mb-1">
                  {invite.needsPassword ? 'Create a password' : `Password for ${invite.email}`}
                </label>
                <input
                  id="invite-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={invite.needsPassword ? 'Min 8 characters' : 'Your existing password'}
                  autoComplete={invite.needsPassword ? 'new-password' : 'current-password'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium disabled:opacity-60"
              >
                {isLoading ? 'Joining...' : 'Accept invitation'}
              </button>
            </form>
          )}
          {mode === 'INVITE' && !invite && (
            <button
              type="button"
              onClick={() => { setMode('LOGIN'); setErrorMsg(null); }}
              className="w-full py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
            >
              Back to Sign In
            </button>
          )}

          {/* RESET PASSWORD FORM */}
          {mode === 'RESET' && (
            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div className={resetToken ? 'hidden' : ''}>
                <label className="block text-slate-700 font-medium mb-1">Reset Token</label>
                <input
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste reset token"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">New Secure Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                {isLoading ? 'Updating...' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>

        {/* Bottom copyright */}
        <div className="text-center text-[11px] text-slate-400 pt-6">
          &copy; {new Date().getFullYear()} Flowza SaaS. Protected by Meta Graph API v21.0 Encryption.
        </div>
      </div>
    </div>
  );
};
