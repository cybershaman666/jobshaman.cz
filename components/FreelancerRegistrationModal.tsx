import React, { useState } from 'react';
import { supabase } from '../services/supabaseService';
import { Eye, EyeOff, Mail, Lock, CheckCircle, ArrowRight, Loader2, Info, X, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FreelancerRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function FreelancerRegistrationModal({ isOpen, onClose, onSuccess }: FreelancerRegistrationModalProps) {
    const { t } = useTranslation();
    const [step, setStep] = useState<number | 'success'>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
    const [pollingFinalize, setPollingFinalize] = useState(false);
    const [isExistingUser, setIsExistingUser] = useState(false);
    const [existingUserId, setExistingUserId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '', // Freelancer name (acts as company name)
        ico: '',
        website: '',
        agreedToTerms: false,
        agreedToPrivacy: false
    });
    const [showPassword, setShowPassword] = useState(false);

    React.useEffect(() => {
        let isMounted = true;
        const initialize = async () => {
            try {
                if (!supabase) return;
                const { data, error } = await supabase.auth.getUser();
                if (!isMounted) return;
                if (!error && data?.user) {
                    setIsExistingUser(true);
                    setExistingUserId(data.user.id);
                    setFormData(prev => ({
                        ...prev,
                        email: data.user.email || prev.email
                    }));
                    setStep(2);
                } else {
                    setIsExistingUser(false);
                    setExistingUserId(null);
                    setStep(1);
                }
            } catch {
                if (!isMounted) return;
                setIsExistingUser(false);
                setExistingUserId(null);
                setStep(1);
            }
        };
        if (isOpen) {
            setNeedsEmailConfirmation(false);
            setPollingFinalize(false);
            setIsSubmitting(false);
            initialize();
        }
        return () => { isMounted = false; };
    }, [isOpen]);

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
            // 1. Sign up with Supabase Auth (skip if user already logged in)
            if (!supabase) throw new Error("Supabase not initialized");

            let userId = existingUserId;
            let userEmail = formData.email;

            if (!isExistingUser) {
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            role: 'recruiter', // Freelancers share 'recruiter' role for now to access dashboard features
                            company_name: formData.fullName, // Use personal name as company name
                            ico: formData.ico,
                            website: formData.website,
                            is_freelancer: true // Flag to distinguish
                        },
                        // Ensure the confirmation / magic link redirects back to the app
                        emailRedirectTo: window.location.origin
                    }
                });

                if (authError) throw authError;

                const user = authData.user;
                const session = authData.session;
                userId = user?.id || null;
                userEmail = user?.email || userEmail;

                if (user && !session) {
                    console.log('ℹ️ Signup created but no session (email confirmation required)');
                    setNeedsEmailConfirmation(true);
                }
            }

            if (userId) {
                console.log("✅ Freelancer Registration successful, initializing profile for:", userId);

                try {
                    const { createBaseProfile, updateUserProfile } = await import('../services/supabaseService');

                    // Initialize User Profile
                    await updateUserProfile(userId, { role: 'recruiter' }).catch(async () => {
                        await createBaseProfile(userId, userEmail || formData.email, formData.fullName, 'recruiter');
                    });

                    const { getUserProfile } = await import('../services/supabaseService');
                    const profileCheck = await getUserProfile(userId);

                    if (!profileCheck) {
                        throw new Error("Profile creation failed.");
                    }

                    // 2. Create "Company" record for the Freelancer
                    const { createCompany } = await import('../services/supabaseService');
                    // We set industry to 'Freelancer' explicitly
                    const companyData = await createCompany({
                        name: formData.fullName,
                        ico: formData.ico,
                        website: formData.website,
                        contact_email: userEmail || formData.email,
                        description: 'Freelancer / OSVČ',
                        industry: 'Freelancer'
                    }, userId);

                    console.log("✅ Freelancer company record created successfully:", companyData?.id);

                    if (companyData?.id) {
                        const { initializeCompanySubscription } = await import('../services/supabaseService');
                        await initializeCompanySubscription(companyData.id);
                        console.log("✅ Free subscription initialized.");
                        // Also create a freelancer profile row so the user is recognized as freelancer
                        try {
                            const { createFreelancerProfile } = await import('../services/supabaseService');
                            await createFreelancerProfile(userId, {
                                contact_email: userEmail || formData.email,
                                website: formData.website,
                                presentation: '',
                                work_type: 'remote'
                            });
                            console.log('✅ Freelancer profile created.');
                        } catch (err) {
                            console.warn('⚠️ Failed to create freelancer profile (non-fatal):', err);
                        }
                    }
                } catch (err) {
                    console.error("❌ Failed to create freelancer record:", err);
                    throw err;
                }
            }

            setStep('success');
        } catch (error: any) {
            console.error("Registration error:", error);
            if (error?.status === 429 || error?.message?.includes('rate limit')) {
                alert(t('freelancer_registration.error_too_many'));
            } else if (error?.message?.includes('User already registered')) {
                alert(t('freelancer_registration.error_exists'));
            } else {
                alert(error.message || t('freelancer_registration.error_generic'));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">

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
                            className="h-full bg-cyan-600 transition-all duration-300"
                            style={{ width: `${(step / 3) * 100}%` }}
                        ></div>
                    </div>
                )}

                <div className="p-8">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                            {step === 1 && t('freelancer_registration.step_1_title')}
                            {step === 2 && t('freelancer_registration.step_2_title')}
                            {step === 3 && t('freelancer_registration.step_3_title')}
                            {step === 'success' && t('freelancer_registration.success_title')}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            {step === 'success'
                                ? t('freelancer_registration.success_desc')
                                : t('freelancer_registration.intro_desc')}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {step === 1 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-8">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        {t('freelancer_registration.email_label')}
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-3 text-slate-400" size={20} />
                                        <input
                                            type="email"
                                            name="email"
                                            required
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                                            placeholder="vas@email.cz"
                                            value={formData.email}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        {t('freelancer_registration.password_label')}
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            name="password"
                                            required
                                            minLength={8}
                                            className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                                            placeholder={t('freelancer_registration.password_placeholder')}
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
                                        {t('freelancer_registration.fullname_label')}
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 text-slate-400" size={20} />
                                        <input
                                            type="text"
                                            name="fullName"
                                            required
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                                            placeholder={t('freelancer_registration.fullname_placeholder')}
                                            value={formData.fullName}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            {t('freelancer_registration.ico_label')}
                                        </label>
                                        <input
                                            type="text"
                                            name="ico"
                                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                                            placeholder="12345678"
                                            value={formData.ico}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            {t('freelancer_registration.website_label')}
                                        </label>
                                        <input
                                            type="url"
                                            name="website"
                                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                                            placeholder="https://..."
                                            value={formData.website}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
                                <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/50 flex gap-3">
                                    <Info className="shrink-0 text-cyan-600 dark:text-cyan-400" size={20} />
                                    <p className="text-sm text-cyan-800 dark:text-cyan-300">
                                        {t('freelancer_registration.info_box')}
                                    </p>
                                </div>

                                {/* Pricing & Features Card */}
                                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20 p-5 rounded-xl border border-cyan-200 dark:border-cyan-800/50">
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-3 text-lg">
                                        {t('freelancer_registration.pricing_title') || 'Plány pro freelancery'}
                                    </h3>
                                    
                                    <div className="space-y-3">
                                        {/* Free Plan */}
                                        <div className="bg-white dark:bg-slate-900/50 p-3 rounded-lg border border-cyan-100 dark:border-cyan-900/30">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-bold text-slate-900 dark:text-white">
                                                        {t('freelancer_registration.plan_basic') || 'Základní účet'}
                                                    </h4>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                                        {t('freelancer_registration.plan_basic_desc') || 'Zdarma'}
                                                    </p>
                                                </div>
                                                <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">0 Kč</span>
                                            </div>
                                            <div className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                                                <div className="flex items-start gap-2">
                                                    <CheckCircle className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
                                                    <span>{t('freelancer_registration.plan_basic_offers') || '3 aktivní nabídky měsíčně'}</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <CheckCircle className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
                                                    <span>{t('freelancer_registration.plan_basic_inquiries') || '3 poptávky měsíčně'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Premium Plan */}
                                        <div className="bg-white dark:bg-slate-900/50 p-3 rounded-lg border-2 border-amber-200 dark:border-amber-900/50 relative">
                                            <div className="absolute -top-2.5 left-4 px-2 bg-amber-400 dark:bg-amber-600 text-xs font-bold text-white rounded-full">
                                                {t('freelancer_registration.plan_premium_badge') || 'POPULÁRNÍ'}
                                            </div>
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-bold text-slate-900 dark:text-white">
                                                        {t('freelancer_registration.plan_premium') || 'Premium'}
                                                    </h4>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400">
                                                        {t('freelancer_registration.plan_premium_desc') || 'Neomezené možnosti'}
                                                    </p>
                                                </div>
                                                <span className="text-lg font-bold text-cyan-600 dark:text-cyan-400">499 Kč<span className="text-xs font-normal text-slate-500">/měsíc</span></span>
                                            </div>
                                            <div className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                                                <div className="flex items-start gap-2">
                                                    <CheckCircle className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
                                                    <span>{t('freelancer_registration.plan_premium_offers') || 'Neomezené nabídky'}</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <CheckCircle className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
                                                    <span>{t('freelancer_registration.plan_premium_inquiries') || 'Neomezené poptávky'}</span>
                                                </div>
                                                <div className="flex items-start gap-2">
                                                    <CheckCircle className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0" />
                                                    <span>{t('freelancer_registration.plan_premium_priority') || 'Vyšší viditelnost v hledání'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            name="agreedToTerms"
                                            checked={formData.agreedToTerms}
                                            onChange={handleChange}
                                            className="mt-1 w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500 border-gray-300"
                                        />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">
                                            {t('freelancer_registration.terms_agree')}
                                        </span>
                                    </label>

                                    <label className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            name="agreedToPrivacy"
                                            checked={formData.agreedToPrivacy}
                                            onChange={handleChange}
                                            className="mt-1 w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500 border-gray-300"
                                        />
                                        <span className="text-sm text-slate-600 dark:text-slate-400">
                                            {t('freelancer_registration.privacy_agree')}
                                        </span>
                                    </label>
                                </div>
                            </div>
                        )}

                                        {step === 'success' && (
                                            <div className="py-8 flex flex-col items-center animate-in zoom-in-95">
                                                <div className="w-20 h-20 bg-cyan-100 dark:bg-cyan-900/30 rounded-full flex items-center justify-center text-cyan-600 dark:text-cyan-400 mb-6">
                                                    <CheckCircle size={40} />
                                                </div>
                                                {needsEmailConfirmation ? (
                                                    <div className="text-center">
                                                        <p className="mb-4 text-slate-700 dark:text-slate-300">{t('freelancer_registration.confirm_email_instructions', { defaultValue: 'Na váš e‑mail jsme poslali odkaz pro potvrzení. Po potvrzení klikněte na tlačítko níže pro dokončení registrace.' })}</p>
                                                        <div className="space-y-3">
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                // Try to finalize registration after email confirmation by checking session
                                                                                                setIsSubmitting(true);
                                                                                                try {
                                                                                                    const { data: { session }, error } = await supabase.auth.getSession();
                                                                    if (error) throw error;
                                                                    if (!session) {
                                                                        alert(t('freelancer_registration.confirm_email_not_found', { defaultValue: 'Nepodařilo se ověřit potvrzení e‑mailu. Zkuste znovu po potvrzení.' }));
                                                                        setIsSubmitting(false);
                                                                        return;
                                                                    }

                                                                    const user = session.user;
                                                                    if (!user) {
                                                                        alert(t('freelancer_registration.confirm_email_not_found', { defaultValue: 'Nepodařilo se ověřit potvrzení e‑mailu. Zkuste znovu po potvrzení.' }));
                                                                        setIsSubmitting(false);
                                                                        return;
                                                                    }

                                                                    // Re-run the same profile/company creation logic
                                                                    const userId = user.id;
                                                                    const { createBaseProfile, updateUserProfile, getUserProfile, createCompany, initializeCompanySubscription } = await import('../services/supabaseService');

                                                                    await updateUserProfile(userId, { role: 'recruiter' }).catch(async () => {
                                                                        await createBaseProfile(userId, formData.email, formData.fullName, 'recruiter');
                                                                    });

                                                                    const profileCheck = await getUserProfile(userId);
                                                                    if (!profileCheck) throw new Error('Profile creation failed');

                                                                    const companyData = await createCompany({
                                                                        name: formData.fullName,
                                                                        ico: formData.ico,
                                                                        website: formData.website,
                                                                        contact_email: formData.email,
                                                                        description: 'Freelancer / OSVČ',
                                                                        industry: 'Freelancer'
                                                                    }, userId);

                                                                    if (companyData?.id) {
                                                                        await initializeCompanySubscription(companyData.id);
                                                                        try {
                                                                            const { createFreelancerProfile } = await import('../services/supabaseService');
                                                                            await createFreelancerProfile(userId, {
                                                                                contact_email: formData.email,
                                                                                website: formData.website,
                                                                                presentation: '',
                                                                                work_type: 'remote'
                                                                            });
                                                                            console.log('✅ Freelancer profile created (finalize).');
                                                                        } catch (err) {
                                                                            console.warn('⚠️ Failed to create freelancer profile during finalize:', err);
                                                                        }
                                                                    }

                                                                    setIsSubmitting(false);
                                                                    setNeedsEmailConfirmation(false);
                                                                    if (onSuccess) onSuccess();
                                                                    else window.location.reload();
                                                                } catch (err) {
                                                                    console.error('Finalize registration failed', err);
                                                                    setIsSubmitting(false);
                                                                    alert(t('freelancer_registration.error_finalize', { defaultValue: 'Dokončení registrace se nezdařilo. Kontaktujte podporu.' }));
                                                                }
                                                            }}
                                                            className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
                                                        >
                                                            {isSubmitting ? <Loader2 className="animate-spin" /> : t('freelancer_registration.go_to_profile', { defaultValue: 'Přejít do mého profilu' })}
                                                        </button>
                                                        {/* Auto-poll for session: start when user sees this view */}
                                                        {!pollingFinalize && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setPollingFinalize(true);
                                                                    let attempts = 0;
                                                                    const maxAttempts = 30; // ~60s
                                                                    const interval = setInterval(async () => {
                                                                        attempts += 1;
                                                                        try {
                                                                            const { data: { session } } = await supabase.auth.getSession();
                                                                            if (session && session.user) {
                                                                                clearInterval(interval);
                                                                                setPollingFinalize(false);
                                                                                // programmatically run finalize flow by simulating click
                                                                                (document.querySelector('[data-finalize-action]') as HTMLButtonElement)?.click();
                                                                            } else if (attempts >= maxAttempts) {
                                                                                clearInterval(interval);
                                                                                setPollingFinalize(false);
                                                                                alert(t('freelancer_registration.confirm_email_not_found') || 'Nepodařilo se ověřit potvrzení e‑mailu. Zkuste znovu po potvrzení.');
                                                                            }
                                                                        } catch (err) {
                                                                            console.error('Polling session error', err);
                                                                        }
                                                                    }, 2000);
                                                                }}
                                                                className="w-full py-3 mt-2 border border-dashed border-slate-200 dark:border-slate-700 text-sm rounded-xl"
                                                            >
                                                                {t('freelancer_registration.waiting_for_confirmation', { defaultValue: 'Čekám na potvrzení e‑mailu a automaticky dokončím…' })}
                                                            </button>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                try {
                                                                    setIsSubmitting(true);
                                                                    // Send a magic link as a fallback if confirmation email wasn't received
                                                                    const { error } = await supabase.auth.signInWithOtp({ email: formData.email }, { emailRedirectTo: window.location.origin });
                                                                    if (error) throw error;
                                                                    alert(t('freelancer_registration.check_email_magic', { defaultValue: 'Poslali jsme vám přihlašovací odkaz (magic link). Zkontrolujte svou e‑mailovou schránku.' }));
                                                                } catch (err) {
                                                                    console.error('Resend confirmation failed', err);
                                                                    alert(t('freelancer_registration.error_resend', { defaultValue: 'Nepodařilo se odeslat potvrzení. Zkuste to později.' }));
                                                                } finally {
                                                                    setIsSubmitting(false);
                                                                }
                                                            }}
                                                            className="w-full py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                        >
                                                            {t('freelancer_registration.resend_confirmation', { defaultValue: 'Poslat přihlašovací odkaz (resend)' })}
                                                        </button>
                                        
                                                        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('freelancer_registration.check_email_help', { defaultValue: 'Pokud e‑mail nedorazí, ověřte prosím nastavení e‑mailu v Supabase (SMTP, šablony) a zkontrolujte spam složku.' })}</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (onSuccess) onSuccess();
                                                            else window.location.reload();
                                                        }}
                                                        className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
                                                    >
                                                        {t('freelancer_registration.go_to_profile')}
                                                        <ArrowRight size={20} />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                    </form>
                </div>

                {/* Footer Actions */}
                <div className="p-8 pt-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                    {typeof step === 'number' && step > 1 && (
                        <button
                            onClick={() => {
                                const nextStep = (typeof step === 'number' ? step : 1) - 1;
                                if (isExistingUser && nextStep < 2) {
                                    setStep(2);
                                } else {
                                    setStep(nextStep);
                                }
                            }}
                            className="px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-all flex items-center gap-2"
                        >
                            {t('freelancer_registration.back')}
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            if (step === 3) handleSubmit(e);
                            else setStep((step as number) + 1);
                        }}
                        disabled={(!isExistingUser && step === 1 && (!formData.email || !formData.password)) || (step === 2 && !formData.fullName) || (step === 3 && (!formData.agreedToTerms || !formData.agreedToPrivacy)) || isSubmitting}
                        className={`flex-1 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${step === 'success' ? 'hidden' : ''}`}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                        {step === 3 ? t('freelancer_registration.finish') : t('freelancer_registration.continue')}
                        {!isSubmitting && <ArrowRight size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
