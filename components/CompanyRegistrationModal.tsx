
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabaseService';
import { Eye, EyeOff, Building2, Mail, Lock, CheckCircle, ArrowRight, Loader2, Info, X } from 'lucide-react';

interface CompanyRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CompanyRegistrationModal({ isOpen, onClose, onSuccess }: CompanyRegistrationModalProps) {
  const { t } = useTranslation();

  const [step, setStep] = useState<number | 'success'>(1);
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
      if (user && session) {
        const userId = user.id;
        console.log("✅ Registration successful, initializing company profile for:", userId);

        // 1. Ensure user profile exists as 'recruiter'
        try {
          const { createBaseProfile, updateUserProfile } = await import('../services/supabaseService');

          // Try to update first (if trigger created it as candidate)
          await updateUserProfile(userId, { role: 'recruiter' }).catch(async () => {
            // If update failed (maybe profile doesn't exist), try to create
            await createBaseProfile(userId, formData.email, formData.companyName, 'recruiter');
          });

          // VERIFY: Profile MUST exist before we create company (FK Constraint)
          const { getUserProfile } = await import('../services/supabaseService');
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
          const { createCompany } = await import('../services/supabaseService');
          const companyData = await createCompany({
            name: formData.companyName,
            ico: formData.ico,
            website: formData.website,
            contact_email: formData.email,
            description: 'Nově registrovaná společnost'
          }, userId);
          console.log("✅ Company record created successfully:", companyData?.id);

          if (companyData?.id) {
            const { initializeCompanySubscription } = await import('../services/supabaseService');
            await initializeCompanySubscription(companyData.id);
            console.log("✅ Free subscription initialized.");
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
        alert("Příliš mnoho pokusů o registraci. Prosím počkejte chvíli a zkuste to znovu (ochrana proti spamu).");
      } else if (error?.message?.includes('User already registered')) {
        alert("Uživatel s tímto emailem již existuje. Prosím přihlašte se.");
      } else {
        alert(error.message || "Registrace se nezdařila. Zkuste to prosím znovu.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors z-10"
        >
          <X size={20} />
        </button>

        {/* Progress Bar */}
        {typeof step === 'number' && (
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5">
            <div
              className="h-full bg-indigo-600 transition-all duration-300"
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
        )}

        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              {step === 1 && t('company_registration.step1_title')}
              {step === 2 && t('company_registration.step2_title')}
              {step === 3 && t('company_registration.step3_title')}
              {step === 'success' && t('company_registration.success_title')}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              {step === 'success'
                ? t('company_registration.subtitle_success')
                : t('company_registration.subtitle_default')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-8">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('company_registration.email_label')}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                      type="email"
                      name="email"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder={t('company_registration.email_placeholder')}
                      value={formData.email}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('company_registration.password_label')}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      required
                      minLength={8}
                      className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-8">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('company_registration.company_name_label')}
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                      type="text"
                      name="companyName"
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder={t('company_registration.company_name_placeholder')}
                      value={formData.companyName}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t('company_registration.ico_label')}
                    </label>
                    <input
                      type="text"
                      name="ico"
                      required
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder={t('company_registration.ico_placeholder')}
                      value={formData.ico}
                      onChange={handleChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      {t('company_registration.web_label')}
                    </label>
                    <input
                      type="url"
                      name="website"
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder={t('company_registration.web_placeholder')}
                      value={formData.website}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex gap-3">
                  <Info className="shrink-0 text-indigo-600 dark:text-indigo-400" size={20} />
                  <p className="text-sm text-indigo-800 dark:text-indigo-300">
                    {t('company_registration.premium_info')}
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      name="agreedToTerms"
                      checked={formData.agreedToTerms}
                      onChange={handleChange}
                      className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {t('company_registration.terms_agree')}
                    </span>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      name="agreedToPrivacy"
                      checked={formData.agreedToPrivacy}
                      onChange={handleChange}
                      className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {t('company_registration.privacy_agree')}
                    </span>
                  </label>
                </div>
              </div>
            )}

            {step === 'success' && (
              <div className="py-8 flex flex-col items-center animate-in zoom-in-95">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mb-6">
                  <CheckCircle size={40} />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (onSuccess) onSuccess();
                    else window.location.reload();
                  }}
                  className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  {t('company_registration.success_button')}
                  <ArrowRight size={20} />
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-8 pt-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 flex gap-4">
          {typeof step === 'number' && step > 1 && (
            <button
              onClick={() => setStep((typeof step === 'number' ? step : 1) - 1)}
              className="px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all flex items-center gap-2"
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
            className={`flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${step === 'success' ? 'hidden' : ''}`}
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