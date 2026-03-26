
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  supabase,
  createBaseProfile,
  updateUserProfile,
  getUserProfile,
  createCompany,
  initializeCompanySubscription
} from '../services/supabaseService';
import { Eye, EyeOff, Building2, Mail, Lock, CheckCircle, ArrowRight, Loader2, Info, X } from 'lucide-react';

interface CompanyRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CompanyRegistrationModal({ isOpen, onClose, onSuccess }: CompanyRegistrationModalProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<number | 'success'>(1);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    companyName: '',
    ico: '',
    website: '',
    agreedToTerms: false,
    agreedToPrivacy: false
  });
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Sign up with Supabase Auth
      if (!supabase) throw new Error("Supabase not initialized");

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: 'recruiter',
            company_name: formData.companyName,
            ico: formData.ico,
            website: formData.website
          }
        }
      });

      if (authError) throw authError;

      // 2. Create Company Profile in 'companies' table (if triggered via webhook or handled manually here)
      // Use result data directly to ensure we have the most current session state
      const user = authData.user;
      const session = authData.session;

      // Setup immediately if we have a session (e.g. no email confirmation required or auto-login)
      if (user && !session) {
        setNeedsEmailConfirmation(true);
        setStep('success');
        setIsSubmitting(false);
        return;
      }

      if (user && session) {
        const userId = user.id;

        // 1. Ensure user profile exists as 'recruiter'
        try {
          // Try to update first (if trigger created it as candidate)
          await updateUserProfile(userId, { role: 'recruiter' }).catch(async () => {
            // If update failed (maybe profile doesn't exist), try to create
            await createBaseProfile(userId, formData.email, formData.companyName, 'recruiter');
          });

          // VERIFY: Profile MUST exist before we create company (FK Constraint)
          const profileCheck = await getUserProfile(userId);

          if (!profileCheck) {
            throw new Error("Profile creation failed - cannot create company without user profile.");
          }
        } catch (err) {
          console.error("❌ Critical Profile Setup Error:", err);
          alert(t('company_onboarding.error_creating'));
          setIsSubmitting(false);
          return; // STOP EXECUTION to prevent FK violation
        }

        // 2. Create the company record immediately
        try {
          const companyData = await createCompany({
            name: formData.companyName,
            ico: formData.ico,
            website: formData.website,
            contact_email: formData.email,
            description: 'Nově registrovaná společnost'
          }, userId);

          if (companyData?.id) {
            await initializeCompanySubscription(companyData.id);
          }
        } catch (err) {
          console.error("❌ Failed to create company record:", err);
        }
      }

      setStep('success');
    } catch (error: any) {
      console.error("Registration error:", error);

      // Handle Rate Limiting specifically
      if (error?.status === 429 || error?.message?.includes('rate limit')) {
        alert(t('alerts.registration_rate_limited'));
      } else if (error?.message?.includes('User already registered')) {
        alert(t('alerts.user_already_exists'));
      } else {
        alert(error.message || t('alerts.registration_failed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-modal-backdrop z-[100]">
      <div className="absolute inset-0" onClick={onClose}></div>

      <div className="app-modal-panel max-w-3xl overflow-hidden">
        <div className="app-modal-topline" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="app-modal-close"
          aria-label={t('common.close', { defaultValue: 'Zavřít' })}
        >
          <X size={20} />
        </button>

        {/* Progress Bar */}
        {typeof step === 'number' && (
          <div className="h-1.5 w-full bg-[var(--surface-subtle)]">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
        )}

        <div className="space-y-8 overflow-y-auto p-6 pt-14 sm:p-8 sm:pt-16">
          <div className="app-modal-header-safe space-y-3">
            <span className="app-modal-kicker">
              <Building2 size={12} />
              {t('company_registration.subtitle_default', { defaultValue: 'Firemní workspace' })}
            </span>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] sm:text-3xl">
              {step === 1 && t('company_registration.step1_title')}
              {step === 2 && t('company_registration.step2_title')}
              {step === 3 && t('company_registration.step3_title')}
              {step === 'success' && t('company_registration.success_title')}
            </h2>
            <p className="text-sm leading-7 text-[var(--text-muted)]">
              {step === 'success'
                ? t('company_registration.subtitle_success')
                : t('company_registration.subtitle_default')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <div className="app-modal-surface animate-in fade-in slide-in-from-right-8 p-5">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--text-strong)]">
                      {t('company_registration.email_label')}
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 text-slate-400" size={20} />
                      <input
                        type="email"
                        name="email"
                        required
                        className="app-modal-input pl-10"
                        placeholder={t('company_registration.email_placeholder')}
                        value={formData.email}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--text-strong)]">
                      {t('company_registration.password_label')}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        required
                        minLength={8}
                        className="app-modal-input pl-10 pr-12"
                        placeholder={t('company_registration.password_placeholder')}
                        value={formData.password}
                        onChange={handleChange}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="app-modal-surface animate-in fade-in slide-in-from-right-8 p-5">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[var(--text-strong)]">
                      {t('company_registration.company_name_label')}
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 text-slate-400" size={20} />
                      <input
                        type="text"
                        name="companyName"
                        required
                        className="app-modal-input pl-10"
                        placeholder={t('company_registration.company_name_placeholder')}
                        value={formData.companyName}
                        onChange={handleChange}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[var(--text-strong)]">
                        {t('company_registration.ico_label')}
                      </label>
                      <input
                        type="text"
                        name="ico"
                        required
                        className="app-modal-input"
                        placeholder={t('company_registration.ico_placeholder')}
                        value={formData.ico}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-[var(--text-strong)]">
                        {t('company_registration.web_label')}
                      </label>
                      <input
                        type="url"
                        name="website"
                        className="app-modal-input"
                        placeholder={t('company_registration.web_placeholder')}
                        value={formData.website}
                        onChange={handleChange}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="app-modal-surface animate-in fade-in slide-in-from-right-8 p-5">
                <div className="space-y-6">
                  <div className="app-premium-note flex gap-3">
                    <Info className="shrink-0 text-[var(--accent-strong)]" size={20} />
                    <p className="text-sm leading-6 text-slate-700">
                      {t('company_registration.premium_info')}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3 transition-colors hover:border-[var(--border-strong)]">
                      <input
                        type="checkbox"
                        name="agreedToTerms"
                        checked={formData.agreedToTerms}
                        onChange={handleChange}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-[var(--accent)] focus:ring-[var(--accent)] dark:[color-scheme:dark]"
                      />
                      <span className="text-sm text-[var(--text-muted)]">
                        {t('company_registration.terms_agree')}
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-3 transition-colors hover:border-[var(--border-strong)]">
                      <input
                        type="checkbox"
                        name="agreedToPrivacy"
                        checked={formData.agreedToPrivacy}
                        onChange={handleChange}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-[var(--accent)] focus:ring-[var(--accent)] dark:[color-scheme:dark]"
                      />
                      <span className="text-sm text-[var(--text-muted)]">
                        {t('company_registration.privacy_agree')}
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 'success' && (
              <div className="py-8 flex flex-col items-center animate-in zoom-in-95">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                  <CheckCircle size={40} />
                </div>
                {needsEmailConfirmation && (
                  <div className="text-center mb-6">
                    <p className="text-[var(--text-muted)]">
                      {t('company_registration.confirm_email_instructions', { defaultValue: 'Na váš e‑mail jsme poslali odkaz pro potvrzení. Po potvrzení klikněte na tlačítko níže pro dokončení registrace.' })}
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (needsEmailConfirmation) {
                      (async () => {
                        setIsSubmitting(true);
                        try {
                          const { data: { session }, error } = await supabase.auth.getSession();
                          if (error) throw error;
                          if (!session) {
                            alert(t('company_registration.confirm_email_not_found', { defaultValue: 'Nepodařilo se ověřit potvrzení e‑mailu. Zkuste to po potvrzení znovu.' }));
                            setIsSubmitting(false);
                            return;
                          }
                          setNeedsEmailConfirmation(false);
                          if (onSuccess) onSuccess();
                          else window.location.reload();
                        } catch (err) {
                          console.error('Email confirmation check failed', err);
                          alert(t('company_registration.confirm_email_not_found', { defaultValue: 'Nepodařilo se ověřit potvrzení e‑mailu. Zkuste to po potvrzení znovu.' }));
                        } finally {
                          setIsSubmitting(false);
                        }
                      })();
                      return;
                    }
                    if (onSuccess) onSuccess();
                    else window.location.reload();
                  }}
                  className="app-button-primary w-full justify-center"
                >
                  {needsEmailConfirmation ? (t('company_registration.confirm_email_continue', { defaultValue: 'Potvrdit a pokračovat' })) : t('company_registration.success_button')}
                  <ArrowRight size={20} />
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-4 border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-6 py-5 sm:px-8">
          {typeof step === 'number' && step > 1 && (
            <button
              onClick={() => setStep((typeof step === 'number' ? step : 1) - 1)}
              className="app-button-secondary"
            >
              {t('company_registration.back_button')}
            </button>
          )}
          <button
            onClick={(e) => {
              if (step === 3) handleSubmit(e);
              else setStep((step as number) + 1);
            }}
            disabled={(step === 1 && (!formData.email || !formData.password)) || (step === 2 && (!formData.companyName || !formData.ico)) || (step === 3 && (!formData.agreedToTerms || !formData.agreedToPrivacy)) || isSubmitting}
            className={`app-button-primary flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-50 ${step === 'success' ? 'hidden' : ''}`}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : null}
            {step === 3 ? t('company_registration.finish_button') : t('company_registration.continue_button')}
            {!isSubmitting && <ArrowRight size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}
