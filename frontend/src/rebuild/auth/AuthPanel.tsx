import React from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  Eye,
  Info,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { cn } from '../cn';
import { signInWithEmail, signInWithOAuthProvider, signUpWithEmail, createCompany, updateUserProfile, savePendingAuthConsent } from '../../services/v2UserService';
import type { AuthIntent } from '../authTypes';

export const buildDefaultAuthForm = () => ({
  mode: 'signin' as 'signin' | 'signup',
  intent: 'candidate' as AuthIntent,
  email: '',
  password: '',
  fullName: '',
  companyName: '',
  acceptTerms: false,
  acceptPrivacy: false,
  acceptMarketingEmails: false,
});

const inputShellClass = 'mt-2 flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-slate-500 shadow-[0_10px_26px_-24px_rgba(15,23,42,0.28)] transition focus-within:border-[#c18a2d] focus-within:ring-4 focus-within:ring-[#c18a2d]/10';
const inputClass = 'h-full min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400';
const checkboxClass = 'mt-0.5 h-4 w-4 rounded border-slate-300 text-[#9f762d] focus:ring-[#9f762d]';

export const AuthPanel: React.FC<{
  open: boolean;
  initialIntent?: AuthIntent;
  onClose: () => void;
  onSignedIn: (intent: AuthIntent) => void;
  navigate: (path: string) => void;
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
}> = ({ open, initialIntent = 'candidate', onClose, onSignedIn, navigate, t }) => {
  const [form, setForm] = React.useState(buildDefaultAuthForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setForm({ ...buildDefaultAuthForm(), intent: initialIntent });
    setError('');
    setSuccess('');
  }, [initialIntent, open]);

  if (!open) return null;

  const updateField = (field: keyof ReturnType<typeof buildDefaultAuthForm>, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateToggle = (field: 'acceptTerms' | 'acceptPrivacy' | 'acceptMarketingEmails', checked: boolean) => {
    setForm((current) => ({ ...current, [field]: checked }));
  };

  const handleEmailAuth = async () => {
    if (form.mode === 'signup' && (!form.acceptTerms || !form.acceptPrivacy)) {
      setError(t('rebuild.auth.consent_required', { defaultValue: 'To create an account, you need to agree to the terms and conditions and privacy policy.' }));
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (form.mode === 'signin') {
        await signInWithEmail(form.email.trim(), form.password);
        onSignedIn(form.intent);
        onClose();
        return;
      }

      const result = await signUpWithEmail(
        form.email.trim(),
        form.password,
        form.fullName.trim() || form.email.split('@')[0] || 'New user',
        undefined,
        typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
        {
          dailyDigestEnabled: form.acceptMarketingEmails,
          dailyDigestTimezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
          termsAcceptedAt: new Date().toISOString(),
          privacyAcceptedAt: new Date().toISOString(),
          marketingEmailsOptIn: form.acceptMarketingEmails,
          authIntent: form.intent,
        },
      );

      if (form.intent === 'recruiter' && result.data.user && result.data.session) {
        await updateUserProfile(result.data.user.id, {
          role: 'recruiter',
          name: form.fullName.trim() || form.email,
          dailyDigestEnabled: form.acceptMarketingEmails,
          dailyDigestTimezone: typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
        });
        if (form.companyName.trim()) {
          await createCompany(
            {
              name: form.companyName.trim(),
              industry: '',
              tone: '',
              values: [],
              philosophy: '',
              description: '',
              logo_url: '',
              website: '',
            },
            result.data.user.id,
          );
        }
      }

      if (result.data.session) {
        onSignedIn(form.intent);
        onClose();
        return;
      }

      setSuccess(t('rebuild.auth.account_created', { defaultValue: 'Account created. Confirm your email and then sign in.' }));
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : t('rebuild.auth.auth_failed', { defaultValue: 'Authentication failed.' }));
    } finally {
      setBusy(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'linkedin_oidc') => {
    if (form.mode === 'signup' && (!form.acceptTerms || !form.acceptPrivacy)) {
      setError(t('rebuild.auth.consent_required', { defaultValue: 'To create an account, you need to agree to the terms and conditions and privacy policy.' }));
      return;
    }

    setBusy(true);
    setError('');
    try {
      if (form.mode === 'signup') {
        const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined;
        savePendingAuthConsent({
          dailyDigestEnabled: form.acceptMarketingEmails,
          dailyDigestTimezone: timezone,
          termsAcceptedAt: new Date().toISOString(),
          privacyAcceptedAt: new Date().toISOString(),
          marketingEmailsOptIn: form.acceptMarketingEmails,
          authIntent: form.intent,
        });
      }
      await signInWithOAuthProvider(provider);
    } catch (oauthError) {
      setError(oauthError instanceof Error ? oauthError.message : t('rebuild.auth.oauth_failed', { defaultValue: 'OAuth sign-in failed.' }));
      setBusy(false);
    }
  };

  const isRecruiter = form.intent === 'recruiter';
  const roleLabel = isRecruiter ? t('rebuild.auth.company_role', { defaultValue: 'Company' }) : t('rebuild.auth.candidate_role', { defaultValue: 'Candidate' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-white p-3 md:p-6">
      <div className="grid max-h-[calc(100vh-1.5rem)] w-full max-w-[57.5rem] overflow-hidden rounded-[1.15rem] border border-white/60 bg-[#ffffff] shadow-[0_30px_90px_-36px_rgba(8,16,22,0.72)] md:max-h-[calc(100vh-3rem)] md:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="relative hidden min-h-[34rem] overflow-hidden bg-[linear-gradient(160deg,#fbfdff_0%,#f5f8f9_48%,#eef5f5_100%)] px-9 py-10 md:flex md:flex-col">
          <img src="/logo-transparent.png" alt="Jobshaman" className="h-12 w-12 rounded-full object-contain" loading="eager" />

          <div className="mt-16">
            <h2 className="max-w-[13rem] text-[1.55rem] font-semibold leading-tight text-slate-950">
              {t('rebuild.auth.hero_title', { defaultValue: 'Enter a system that understands work differently.' })}
            </h2>
          </div>

          <div className="relative mt-10 flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-[radial-gradient(circle_at_center,#f3d691_0%,#f8f4e8_34%,#eef7f6_70%)]">
            <img
              src="/logo-transparent.png"
              alt=""
              className="relative z-10 h-[86%] w-[86%] object-contain drop-shadow-[0_24px_40px_rgba(121,86,32,0.16)]"
              loading="eager"
            />
          </div>

          <div className="mt-auto flex items-start gap-3 text-[0.72rem] leading-4 text-slate-500">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#1f6c80]" />
            <div>
              <div className="font-semibold text-slate-700">{t('rebuild.auth.security_header', { defaultValue: 'Your data is safe with us.' })}</div>
              <div>{t('auth.security_note', { defaultValue: 'We use encryption and modern security.' })}</div>
            </div>
          </div>
        </aside>

        <section className="relative overflow-y-auto bg-[#ffffff] px-5 py-6 md:px-8 md:py-8 min-h-0 max-h-full">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label={t('rebuild.auth.close', { defaultValue: 'Close' })}
          >
            <X size={18} />
          </button>

          <div className="pr-10">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-500">01 {t('rebuild.auth.step1', { defaultValue: 'Entry' })}</div>
            <div className="mt-4 rounded-xl border border-[#c18a2d] bg-[#fff9ef] px-4 py-4 shadow-[0_18px_38px_-32px_rgba(159,118,45,0.7)]">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#e2bf83] bg-white text-[#9f762d]">
                  {isRecruiter ? <Building2 size={22} /> : <UserRound size={22} />}
                </span>
                <div>
                  <div className="text-base font-semibold text-[#a57124]">{roleLabel}</div>
                </div>
                <span className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#9f762d] text-white">
                  <Check size={14} />
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-xs font-medium text-slate-600 sm:grid-cols-2">
                <div className="rounded-lg bg-white/70 px-3 py-2">{t('rebuild.auth.free_plan', { defaultValue: 'Free: 5 active slots' })}</div>
                <div className="rounded-lg bg-white/70 px-3 py-2">{t('rebuild.auth.premium_plan', { defaultValue: 'Premium: 25 active slots' })}</div>
              </div>
            </div>
          </div>

          <form
            className="mt-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleEmailAuth();
            }}
          >
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-500">02 {t('rebuild.auth.step2', { defaultValue: 'Sign in' })}</div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy || (form.mode === 'signup' && (!form.acceptTerms || !form.acceptPrivacy))}
                onClick={() => void handleOAuth('google')}
                className="inline-flex h-11 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#d4ad70] hover:bg-[#fffbf5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="text-lg font-bold text-[#4285f4]">G</span>
                {t('rebuild.auth.google_signin', { defaultValue: 'Continue with Google' })}
              </button>
              <button
                type="button"
                disabled={busy || (form.mode === 'signup' && (!form.acceptTerms || !form.acceptPrivacy))}
                onClick={() => void handleOAuth('linkedin_oidc')}
                className="inline-flex h-11 items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#d4ad70] hover:bg-[#fffbf5] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="text-lg font-bold text-[#0a66c2]">in</span>
                {t('rebuild.auth.linkedin_signin', { defaultValue: 'Continue with LinkedIn' })}
              </button>
            </div>

            <div className="my-5 flex items-center gap-4">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-xs font-medium text-slate-500">{t('rebuild.auth.or_email', { defaultValue: 'or continue with email' })}</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="space-y-4">
              {form.mode === 'signup' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500">
                    {t('rebuild.auth.full_name', { defaultValue: 'Name' })}
                    <span className={inputShellClass}>
                      <UserRound size={16} />
                      <input value={form.fullName} onChange={(event) => updateField('fullName', event.target.value)} className={inputClass} placeholder={t('rebuild.auth.full_name_placeholder', { defaultValue: 'Enter your name' })} />
                    </span>
                  </label>
                  {form.intent === 'recruiter' ? (
                    <label className="block text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {t('rebuild.auth.company_name', { defaultValue: 'Company' })}
                      <span className={inputShellClass}>
                        <Building2 size={16} />
                        <input value={form.companyName} onChange={(event) => updateField('companyName', event.target.value)} className={inputClass} placeholder={t('rebuild.auth.company_name_placeholder', { defaultValue: 'Company name' })} />
                      </span>
                    </label>
                  ) : null}
                </div>
              ) : null}

              <label className="block text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500">
                {t('rebuild.auth.email', { defaultValue: 'Email' })}
                <span className={inputShellClass}>
                  <Mail size={16} />
                  <input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} className={inputClass} placeholder={t('rebuild.auth.email_placeholder', { defaultValue: 'Enter your email' })} required />
                </span>
              </label>

              <label className="block text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500">
                <span className="flex items-center justify-between gap-4">
                  {t('rebuild.auth.password', { defaultValue: 'Password' })}
                  <button type="button" className="text-[0.68rem] font-semibold normal-case tracking-normal text-slate-500 hover:text-[#9f762d]">{t('rebuild.auth.forgot_password', { defaultValue: 'Forgot password?' })}</button>
                </span>
                <span className={inputShellClass}>
                  <LockKeyhole size={16} />
                  <input type="password" value={form.password} onChange={(event) => updateField('password', event.target.value)} className={inputClass} placeholder={t('rebuild.auth.password_placeholder', { defaultValue: 'Enter your password' })} required />
                  <Eye size={16} />
                </span>
              </label>
            </div>

            <div className="mt-5 flex border-b border-slate-200">
              {(['signin', 'signup'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, mode }))}
                  className={cn(
                    'h-10 border-b-2 px-7 text-sm font-semibold transition',
                    form.mode === mode ? 'border-[#9f762d] text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-900',
                  )}
                >
                  {mode === 'signin' ? t('rebuild.auth.signin_tab', { defaultValue: 'Sign in' }) : t('rebuild.auth.signup_tab', { defaultValue: 'Create account' })}
                </button>
              ))}
            </div>

            {form.mode === 'signup' ? (
              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-3 text-sm leading-5 text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.acceptTerms}
                    onChange={(event) => updateToggle('acceptTerms', event.target.checked)}
                    className={checkboxClass}
                  />
                  <span>
                    {t('rebuild.auth.agree_prefix', { defaultValue: 'I agree with' })} <button type="button" onClick={() => navigate('/obchodni-podminky')} className="font-semibold text-[#a57124] underline underline-offset-2">{t('rebuild.auth.terms', { defaultValue: 'terms and conditions' })}</button>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm leading-5 text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.acceptPrivacy}
                    onChange={(event) => updateToggle('acceptPrivacy', event.target.checked)}
                    className={checkboxClass}
                  />
                  <span>
                    {t('rebuild.auth.agree_prefix', { defaultValue: 'I agree with' })} <button type="button" onClick={() => navigate('/ochrana-osobnich-udaju')} className="font-semibold text-[#a57124] underline underline-offset-2">{t('rebuild.auth.privacy', { defaultValue: 'privacy policy' })}</button>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm leading-5 text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.acceptMarketingEmails}
                    onChange={(event) => updateToggle('acceptMarketingEmails', event.target.checked)}
                    className={checkboxClass}
                  />
                  <span>{t('auth.newsletter_opt_in', { defaultValue: 'I want to receive news and job opportunities by email (optional)' })}</span>
                </label>
              </div>
            ) : null}

            {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}
            {success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</div> : null}

            <button
              type="submit"
              disabled={busy || !form.email || !form.password || (form.mode === 'signup' && (!form.fullName || !form.acceptTerms || !form.acceptPrivacy))}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#b98331] px-5 text-sm font-bold text-white shadow-[0_18px_34px_-24px_rgba(159,118,45,0.88)] transition hover:bg-[#a57124] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? <Loader2 size={17} className="animate-spin" /> : null}
              {form.mode === 'signin' ? t('rebuild.auth.signin_action', { defaultValue: 'Enter JobShaman' }) : t('rebuild.auth.signup_action', { defaultValue: 'Create account' })}
              {!busy ? <ArrowRight size={17} /> : null}
            </button>
            <div className="mt-2 text-center text-xs font-medium text-[#9f762d]">{t('rebuild.auth.bullshit_free', { defaultValue: 'No CV. No bullshit filters.' })}</div>
          </form>

          <div className="-mx-5 mt-6 flex flex-col gap-3 border-t border-slate-200 px-5 pt-5 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between md:-mx-8 md:px-8">
            <span>
              {t('rebuild.auth.need_help', { defaultValue: 'Need help?' })} <button type="button" onClick={() => navigate('/kontakt')} className="font-semibold text-[#1f6c80] hover:underline">{t('rebuild.auth.contact_support', { defaultValue: 'Contact support' })}</button>
            </span>
            <button type="button" className="inline-flex items-center gap-2 text-[#1f6c80] hover:underline">
              {t('rebuild.auth.why_data', { defaultValue: 'Why do we need your data?' })} <Info size={13} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
