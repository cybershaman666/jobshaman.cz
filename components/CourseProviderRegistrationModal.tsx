import React, { useState } from 'react';
import { supabase } from '../services/supabaseService';
import { Eye, EyeOff, Mail, Lock, CheckCircle, ArrowRight, Loader2, Info, X, User, MapPin, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CourseProviderRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function CourseProviderRegistrationModal({ isOpen, onClose, onSuccess }: CourseProviderRegistrationModalProps) {
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
        providerName: '',
        contactName: '',
        contactPhone: '',
        address: '',
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

    const finalizeRegistration = async (userId: string, userEmail: string) => {
        const { createBaseProfile, updateUserProfile, ensureCandidateProfile, createCompany, createMarketplacePartner, getMarketplacePartnerByOwner, getUserProfile } = await import('../services/supabaseService');

        await updateUserProfile(userId, { role: 'recruiter' }).catch(async () => {
            await createBaseProfile(userId, userEmail || formData.email, formData.providerName, 'recruiter');
        });
        await ensureCandidateProfile(userId);

        const profileCheck = await getUserProfile(userId);
        if (!profileCheck) throw new Error('Profile creation failed.');

        const companyData = await createCompany({
            name: formData.providerName,
            website: formData.website,
            contact_email: userEmail || formData.email,
            contact_phone: formData.contactPhone,
            address: formData.address,
            description: 'Vzdělávání / kurzy',
            industry: 'Education'
        }, userId);

        const existingPartner = await getMarketplacePartnerByOwner(userId);
        if (!existingPartner) {
            await createMarketplacePartner({
                name: formData.providerName,
                contact_email: userEmail || formData.email,
                contact_name: formData.contactName,
                contact_phone: formData.contactPhone,
                website: formData.website,
                address: formData.address,
                partner_type: 'education',
                owner_id: userId,
                course_categories: []
            });
        }

        if (companyData?.id) {
            try {
                const { initializeCompanySubscription } = await import('../services/supabaseService');
                await initializeCompanySubscription(companyData.id);
            } catch (err) {
                console.warn('⚠️ Failed to initialize subscription:', err);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            if (!supabase) throw new Error("Supabase not initialized");

            let userId = existingUserId;
            let userEmail = formData.email;

            if (!isExistingUser) {
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            role: 'recruiter',
                            company_name: formData.providerName,
                            website: formData.website,
                            is_course_provider: true
                        },
                        emailRedirectTo: window.location.origin
                    }
                });

                if (authError) throw authError;

                const user = authData.user;
                const session = authData.session;
                userId = user?.id || null;
                userEmail = user?.email || userEmail;

                if (user && !session) {
                    setNeedsEmailConfirmation(true);
                    setStep('success');
                    setIsSubmitting(false);
                    return;
                }
            }

            if (userId) {
                await finalizeRegistration(userId, userEmail || formData.email);
            }

            setStep('success');
        } catch (error: any) {
            console.error("Registration error:", error);
            if (error?.status === 429 || error?.message?.includes('rate limit')) {
                alert(t('course_provider_registration.error_too_many', { defaultValue: 'Příliš mnoho pokusů, zkuste to později.' }));
            } else if (error?.message?.includes('User already registered')) {
                alert(t('course_provider_registration.error_exists', { defaultValue: 'Tento účet už existuje.' }));
            } else {
                alert(error.message || t('course_provider_registration.error_generic', { defaultValue: 'Registrace se nezdařila.' }));
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
                            {step === 1 && t('course_provider_registration.step_1_title', { defaultValue: 'Vytvořit účet' })}
                            {step === 2 && t('course_provider_registration.step_2_title', { defaultValue: 'Informace o poskytovateli' })}
                            {step === 3 && t('course_provider_registration.step_3_title', { defaultValue: 'Dokončení registrace' })}
                            {step === 'success' && t('course_provider_registration.success_title', { defaultValue: 'Registrace dokončena' })}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            {step === 'success'
                                ? t('course_provider_registration.success_desc', { defaultValue: 'Váš účet je připraven. Stačí dokončit ověření e‑mailu.' })
                                : t('course_provider_registration.intro_desc', { defaultValue: 'Zaregistrujte se jako poskytovatel kurzů a spravujte nabídky na marketplace.' })}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {step === 1 && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-right-8">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        {t('course_provider_registration.email_label', { defaultValue: 'E‑mail' })}
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
                                        {t('course_provider_registration.password_label', { defaultValue: 'Heslo' })}
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            name="password"
                                            required
                                            minLength={8}
                                            className="w-full pl-10 pr-12 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                                            placeholder={t('course_provider_registration.password_placeholder', { defaultValue: 'Min. 8 znaků' })}
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
                                        {t('course_provider_registration.provider_name_label', { defaultValue: 'Název poskytovatele' })}
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 text-slate-400" size={20} />
                                        <input
                                            type="text"
                                            name="providerName"
                                            required
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                                            placeholder="Název školy / institutu"
                                            value={formData.providerName}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            {t('course_provider_registration.contact_name_label', { defaultValue: 'Kontaktní osoba' })}
                                        </label>
                                        <input
                                            type="text"
                                            name="contactName"
                                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                                            placeholder="Jméno a příjmení"
                                            value={formData.contactName}
                                            onChange={handleChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            {t('course_provider_registration.phone_label', { defaultValue: 'Telefon' })}
                                        </label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-3 text-slate-400" size={20} />
                                            <input
                                                type="tel"
                                                name="contactPhone"
                                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                                                placeholder="+420 777 123 456"
                                                value={formData.contactPhone}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        {t('course_provider_registration.address_label', { defaultValue: 'Adresa' })}
                                    </label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-3 text-slate-400" size={20} />
                                        <input
                                            type="text"
                                            name="address"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                                            placeholder="Praha, Brno, Ostrava..."
                                            value={formData.address}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        {t('course_provider_registration.website_label', { defaultValue: 'Web' })}
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
                        )}

                        {step === 3 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-8">
                                <div className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/50 flex gap-3">
                                    <Info className="shrink-0 text-cyan-600 dark:text-cyan-400" size={20} />
                                    <p className="text-sm text-cyan-800 dark:text-cyan-300">
                                        {t('course_provider_registration.info_box', { defaultValue: 'Po dokončení registrace získáte přístup do dashboardu pro správu kurzů.' })}
                                    </p>
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
                                            {t('course_provider_registration.terms_agree', { defaultValue: 'Souhlasím s podmínkami používání.' })}
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
                                            {t('course_provider_registration.privacy_agree', { defaultValue: 'Souhlasím se zpracováním osobních údajů.' })}
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
                                        <p className="mb-4 text-slate-700 dark:text-slate-300">
                                            {t('course_provider_registration.confirm_email_instructions', { defaultValue: 'Na váš e‑mail jsme poslali odkaz pro potvrzení. Po potvrzení klikněte na tlačítko níže pro dokončení registrace.' })}
                                        </p>
                                        <div className="space-y-3">
                                            <button
                                                type="button"
                                                data-finalize-action
                                                onClick={async () => {
                                                    setIsSubmitting(true);
                                                    try {
                                                        const { data: { session }, error } = await supabase.auth.getSession();
                                                        if (error) throw error;
                                                        if (!session || !session.user) {
                                                            alert(t('course_provider_registration.confirm_email_not_found', { defaultValue: 'Nepodařilo se ověřit potvrzení e‑mailu. Zkuste znovu po potvrzení.' }));
                                                            setIsSubmitting(false);
                                                            return;
                                                        }

                                                        await finalizeRegistration(session.user.id, session.user.email || formData.email);
                                                        setIsSubmitting(false);
                                                        setNeedsEmailConfirmation(false);
                                                        if (onSuccess) onSuccess();
                                                        else window.location.reload();
                                                    } catch (err) {
                                                        console.error('Finalize registration failed', err);
                                                        setIsSubmitting(false);
                                                        alert(t('course_provider_registration.error_finalize', { defaultValue: 'Dokončení registrace se nezdařilo. Kontaktujte podporu.' }));
                                                    }
                                                }}
                                                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
                                            >
                                                {isSubmitting ? <Loader2 className="animate-spin" /> : t('course_provider_registration.go_to_profile', { defaultValue: 'Přejít do dashboardu' })}
                                            </button>

                                            {!pollingFinalize && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPollingFinalize(true);
                                                        let attempts = 0;
                                                        const maxAttempts = 30;
                                                        const interval = setInterval(async () => {
                                                            attempts += 1;
                                                            try {
                                                                const { data: { session } } = await supabase.auth.getSession();
                                                                if (session && session.user) {
                                                                    clearInterval(interval);
                                                                    setPollingFinalize(false);
                                                                    (document.querySelector('[data-finalize-action]') as HTMLButtonElement)?.click();
                                                                } else if (attempts >= maxAttempts) {
                                                                    clearInterval(interval);
                                                                    setPollingFinalize(false);
                                                                    alert(t('course_provider_registration.confirm_email_not_found', { defaultValue: 'Nepodařilo se ověřit potvrzení e‑mailu. Zkuste znovu po potvrzení.' }));
                                                                }
                                                            } catch (err) {
                                                                console.error('Polling session error', err);
                                                            }
                                                        }, 2000);
                                                    }}
                                                    className="w-full py-3 mt-2 border border-dashed border-slate-200 dark:border-slate-700 text-sm rounded-xl"
                                                >
                                                    {t('course_provider_registration.waiting_for_confirmation', { defaultValue: 'Čekám na potvrzení e‑mailu a automaticky dokončím…' })}
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        setIsSubmitting(true);
                                                        const { error } = await supabase.auth.signInWithOtp({ email: formData.email }, { emailRedirectTo: window.location.origin });
                                                        if (error) throw error;
                                                        alert(t('course_provider_registration.check_email_magic', { defaultValue: 'Poslali jsme vám přihlašovací odkaz (magic link). Zkontrolujte svou e‑mailovou schránku.' }));
                                                    } catch (err) {
                                                        console.error('Resend confirmation failed', err);
                                                        alert(t('course_provider_registration.error_resend', { defaultValue: 'Nepodařilo se odeslat potvrzení. Zkuste to později.' }));
                                                    } finally {
                                                        setIsSubmitting(false);
                                                    }
                                                }}
                                                className="w-full py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                            >
                                                {t('course_provider_registration.resend_confirmation', { defaultValue: 'Poslat přihlašovací odkaz (resend)' })}
                                            </button>
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
                                        {t('course_provider_registration.go_to_profile', { defaultValue: 'Přejít do dashboardu' })}
                                        <ArrowRight size={20} />
                                    </button>
                                )}
                            </div>
                        )}
                    </form>
                </div>

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
                            {t('course_provider_registration.back', { defaultValue: 'Zpět' })}
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            if (step === 3) handleSubmit(e);
                            else setStep((step as number) + 1);
                        }}
                        disabled={(!isExistingUser && step === 1 && (!formData.email || !formData.password)) || (step === 2 && !formData.providerName) || (step === 3 && (!formData.agreedToTerms || !formData.agreedToPrivacy)) || isSubmitting}
                        className={`flex-1 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed ${step === 'success' ? 'hidden' : ''}`}
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                        {step === 3 ? t('course_provider_registration.finish', { defaultValue: 'Dokončit' }) : t('course_provider_registration.continue', { defaultValue: 'Pokračovat' })}
                        {!isSubmitting && <ArrowRight size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
