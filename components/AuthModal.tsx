
import React, { useEffect, useState } from 'react';
import { requestPasswordResetEmail, signInWithEmail, signInWithOAuthProvider, signUpWithEmail } from '../services/supabaseService';
import { fetchCsrfToken, waitForSession } from '../services/csrfService';
import { supabase } from '../services/supabaseClient';
import { X, Mail, Lock, User, Loader2, AlertCircle, Chrome, Linkedin, Sparkles, CheckCircle2 } from 'lucide-react';

import { useTranslation } from 'react-i18next';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    defaultMode?: 'login' | 'register' | 'reset';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, defaultMode = 'login' }) => {
    const { t, i18n } = useTranslation();
    const resolveDefaultCountry = (): 'CZ' | 'SK' | 'PL' | 'DE' | 'AT' => {
        const locale = String(i18n.language || '').toLowerCase();
        if (locale.startsWith('sk')) return 'SK';
        if (locale.startsWith('pl')) return 'PL';
        if (locale.startsWith('de')) {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            return tz === 'Europe/Vienna' ? 'AT' : 'DE';
        }
        return 'CZ';
    };
    const [mode, setMode] = useState<'login' | 'register' | 'reset'>(defaultMode);
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'linkedin_oidc'>(null);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        preferredCountryCode: resolveDefaultCountry(),
        wantsDigestEmail: false,
        agreedToTerms: false,
        agreedToPrivacy: false
    });
    const countryOptions = [
        { code: 'CZ', label: t('countries.cz', { defaultValue: 'Česko' }) },
        { code: 'SK', label: t('countries.sk', { defaultValue: 'Slovensko' }) },
        { code: 'PL', label: t('countries.pl', { defaultValue: 'Polsko' }) },
        { code: 'DE', label: t('countries.de', { defaultValue: 'Německo' }) },
        { code: 'AT', label: t('countries.at', { defaultValue: 'Rakousko' }) }
    ];

    const isLogin = mode === 'login';
    const isResetMode = mode === 'reset';
    const language = ((i18n.language || 'cs').split('-')[0].toLowerCase() === 'at' ? 'de' : (i18n.language || 'cs').split('-')[0].toLowerCase());

    useEffect(() => {
        if (isOpen) {
            setMode(defaultMode);
            setInfoMessage(null);
            setError(null);
            setAwaitingConfirmation(false);
            if (defaultMode === 'reset') {
                setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
            } else if (defaultMode === 'register') {
                setFormData(prev => ({
                    ...prev,
                    preferredCountryCode: prev.preferredCountryCode || resolveDefaultCountry(),
                    wantsDigestEmail: Boolean(prev.wantsDigestEmail)
                }));
            }
        }
    }, [isOpen, defaultMode]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            let userData;

            if (isResetMode) {
                if (formData.password.trim().length < 6) {
                    throw new Error(t('auth.password_too_short', { defaultValue: 'Heslo musí mít alespoň 6 znaků.' }));
                }
                if (formData.password !== formData.confirmPassword) {
                    throw new Error(t('auth.passwords_mismatch', { defaultValue: 'Hesla se neshodují.' }));
                }

                const { error: updateError } = await supabase.auth.updateUser({
                    password: formData.password
                });
                if (updateError) throw updateError;

                setInfoMessage(
                    t('auth.password_reset_success', {
                        defaultValue: 'Heslo bylo změněno. Nyní se můžete přihlásit novým heslem.'
                    })
                );
                setMode('login');
                setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
                setLoading(false);
                return;
            } else if (isLogin) {
                const result = await signInWithEmail(formData.email, formData.password);
                if (result.error) throw result.error;
                userData = result.data?.user;
            } else {
                if (!formData.agreedToTerms || !formData.agreedToPrivacy) {
                    throw new Error(
                        t('auth.legal_consent_required', {
                            defaultValue: 'Pro vytvoření účtu je potřeba souhlasit s podmínkami použití a zpracováním osobních údajů.'
                        })
                    );
                }
                const result = await signUpWithEmail(
                    formData.email,
                    formData.password,
                    formData.fullName,
                    i18n.language,
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                    {
                        preferredCountryCode: formData.preferredCountryCode,
                        dailyDigestEnabled: formData.wantsDigestEmail,
                        dailyDigestTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                    }
                );
                if (result.error) throw result.error;
                userData = result.data?.user;

                const needsConfirmation = !!result.data?.user && !result.data?.session;
                if (needsConfirmation) {
                    setInfoMessage(t('auth.confirmation_required'));
                    setAwaitingConfirmation(true);
                    setMode('login');
                    try {
                        const payload = { email: formData.email, at: new Date().toISOString() };
                        localStorage.setItem('jobshaman_email_confirmation_pending', JSON.stringify(payload));
                        window.dispatchEvent(new Event('jobshaman:email-confirmation'));
                    } catch (storageError) {
                        console.warn('Failed to store confirmation flag:', storageError);
                    }
                    setLoading(false);
                    return;
                }
            }

            // CSRF: Fetch token in the background to avoid blocking the modal close
            if (userData) {
                (async () => {
                    try {
                        const session = await supabase?.auth.getSession();
                        let accessToken = session?.data?.session?.access_token;

                        if (!accessToken) {
                            accessToken = await waitForSession(2000) || undefined;
                        }

                        if (accessToken) {
                            await fetchCsrfToken(accessToken);
                        }
                    } catch (csrfError) {
                        console.warn('⚠️ Could not fetch CSRF token:', csrfError);
                    }
                })();
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleOAuthSignIn = async (provider: 'google' | 'linkedin_oidc') => {
        setOauthLoading(provider);
        setError(null);

        try {
            await signInWithOAuthProvider(provider);
            // Browser will redirect to provider, no further action needed here.
            setOauthLoading(null);
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
            setOauthLoading(null);
        }
    };

    const handleForgotPassword = async () => {
        const email = formData.email.trim();
        if (!email) {
            setError(t('auth.enter_email_for_reset', { defaultValue: 'Nejprve zadejte svůj e‑mail.' }));
            return;
        }

        setLoading(true);
        setError(null);
        try {
            await requestPasswordResetEmail(email);
            setInfoMessage(
                t('auth.reset_password_sent', {
                    defaultValue: 'Odkaz pro obnovu hesla jsme odeslali na váš e‑mail.'
                })
            );
        } catch (err: any) {
            setError(err.message || t('auth.reset_password_failed', { defaultValue: 'Nepodařilo se odeslat odkaz pro obnovu hesla.' }));
        } finally {
            setLoading(false);
        }
    };

    const isBusy = loading || oauthLoading !== null;
    const authUiCopy = (() => {
        if (language === 'cs') {
            return {
                kicker: 'Career OS vstup',
                premiumTitle: 'Proč si premium rychle získá hodnotu',
                premiumBullets: [
                    'Více dialogových slotů pro odpovědi bez zbytečného limitu.',
                    'AI průvodce pro profil, životní situaci a podpůrné podklady.',
                    'Personalizovaný JHI a detailní JCFPM report místo jen základního náhledu.'
                ]
            };
        }
        if (language === 'sk') {
            return {
                kicker: 'Career OS vstup',
                premiumTitle: 'Prečo si premium rýchlo získa hodnotu',
                premiumBullets: [
                    'Viac dialógových slotov pre odpovede bez zbytočného limitu.',
                    'AI sprievodca pre profil, životnú situáciu a podporné podklady.',
                    'Personalizovaný JHI a detailný JCFPM report namiesto len základného náhľadu.'
                ]
            };
        }
        if (language === 'de') {
            return {
                kicker: 'Career OS Zugang',
                premiumTitle: 'Warum Premium schnell nützlich wird',
                premiumBullets: [
                    'Mehr Dialog-Slots für echte Antworten ohne unnötig enge Limits.',
                    'Ein KI-Guide für Profil, Lebenskontext und unterstützende Unterlagen.',
                    'Personalisierter JHI und ein detaillierter JCFPM-Bericht statt nur einer Basisvorschau.'
                ]
            };
        }
        if (language === 'pl') {
            return {
                kicker: 'Dostęp do Career OS',
                premiumTitle: 'Dlaczego premium szybko zaczyna mieć wartość',
                premiumBullets: [
                    'Więcej slotów dialogowych na realne odpowiedzi bez zbyt ciasnych limitów.',
                    'Przewodnik AI do ustawienia profilu, kontekstu życiowego i materiałów wspierających.',
                    'Spersonalizowany JHI i szczegółowy raport JCFPM zamiast tylko podstawowego podglądu.'
                ]
            };
        }
        return {
            kicker: 'Career OS access',
            premiumTitle: 'Why premium becomes useful fast',
            premiumBullets: [
                'More dialogue slots for real replies without tight limits.',
                'An AI guide for profile setup, life context, and supporting materials.',
                'Personalized JHI and a detailed JCFPM report instead of only the basic preview.'
            ]
        };
    })();

    return (
        <div className="app-modal-backdrop">
            <div className="absolute inset-0" onClick={onClose}></div>

            <div className="app-modal-panel max-h-[92vh] max-w-5xl overflow-y-auto animate-in zoom-in-95 duration-300">
                <div className="app-modal-topline" />
                <button
                    onClick={onClose}
                    className="absolute right-5 top-5 z-10 rounded-full p-2 text-[var(--text-faint)] transition hover:bg-black/5 hover:text-[var(--text-strong)] dark:hover:bg-white/5"
                >
                    <X size={20} />
                </button>
                <div className="grid gap-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                    <div className="app-modal-surface hidden border-r px-8 py-8 lg:block lg:rounded-none lg:border-b-0 lg:border-l-0 lg:border-t-0">
                        <div className="space-y-6">
                            <div className="app-modal-kicker">
                                <Sparkles size={12} />
                                {authUiCopy.kicker}
                            </div>
                            <div className="space-y-3">
                                <h2 className="text-3xl font-black tracking-[-0.04em] text-[var(--text-strong)]">
                                    {isResetMode
                                        ? t('auth.reset_password_title', { defaultValue: 'Nastavit nové heslo' })
                                        : (isLogin ? t('auth.welcome_back') : t('auth.create_account'))}
                                </h2>
                                <p className="text-sm leading-7 text-[var(--text-muted)]">
                                    {isResetMode
                                        ? t('auth.reset_password_desc', { defaultValue: 'Zadejte nové heslo pro svůj účet.' })
                                        : (isLogin ? t('auth.login_desc') : t('auth.register_desc'))}
                                </p>
                            </div>
                            {!isResetMode ? (
                                <div className="app-premium-note space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        <Sparkles size={16} />
                                        {authUiCopy.premiumTitle}
                                    </div>
                                    <div className="space-y-2">
                                        {authUiCopy.premiumBullets.map((item) => (
                                            <div key={item} className="flex items-start gap-2 text-sm leading-6">
                                                <CheckCircle2 size={16} className="mt-1 shrink-0" />
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="app-modal-surface px-5 py-5 sm:px-6 sm:py-6 lg:rounded-none lg:border-0">
                        <div className="mb-5 space-y-2.5 lg:hidden">
                            <div className="app-modal-kicker w-fit">
                                <Sparkles size={12} />
                                {authUiCopy.kicker}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-[var(--text-strong)]">
                                    {isResetMode
                                        ? t('auth.reset_password_title', { defaultValue: 'Nastavit nové heslo' })
                                        : (isLogin ? t('auth.welcome_back') : t('auth.create_account'))}
                                </h2>
                                <p className="mt-2 text-sm text-[var(--text-muted)]">
                                    {isResetMode
                                        ? t('auth.reset_password_desc', { defaultValue: 'Zadejte nové heslo pro svůj účet.' })
                                        : (isLogin ? t('auth.login_desc') : t('auth.register_desc'))}
                                </p>
                            </div>
                        </div>

                        {isLogin && (
                            <div className="mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-200 dark:bg-amber-50 dark:text-amber-800">
                                <AlertCircle size={16} className="mt-0.5" />
                                <div>
                                    <div className="font-semibold">{t('auth.email_confirm_notice_title')}</div>
                                    <div>{t('auth.email_confirm_notice_body')}</div>
                                </div>
                            </div>
                        )}

                        {infoMessage && (
                            <div className={`mb-4 flex items-start gap-2 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${awaitingConfirmation ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-200 dark:bg-emerald-50 dark:text-emerald-800' : 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text)]'}`}>
                                <AlertCircle size={16} className="mt-0.5" />
                                <div>
                                    {awaitingConfirmation && (
                                        <div className="mb-1 font-semibold">{t('auth.confirmation_required_title')}</div>
                                    )}
                                    <div>{infoMessage}</div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 flex items-center gap-2 rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-200 dark:bg-rose-50 dark:text-rose-700">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-3">
                    {!isLogin && !isResetMode && (
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-[var(--text-muted)]">{t('auth.full_name')}</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-[var(--text-faint)]" size={18} />
                                <input
                                    type="text"
                                    required
                                    className="app-modal-input pl-10"
                                    placeholder="Jan Novák"
                                    value={formData.fullName}
                                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {!isLogin && !isResetMode && (
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-[var(--text-muted)]">
                                {t('auth.preferred_country', { defaultValue: 'Země pro nabídky' })}
                            </label>
                            <select
                                required
                                className="app-modal-input"
                                value={formData.preferredCountryCode}
                                onChange={e => setFormData({
                                    ...formData,
                                    preferredCountryCode: e.target.value as 'CZ' | 'SK' | 'PL' | 'DE' | 'AT'
                                })}
                            >
                                {countryOptions.map((country) => (
                                    <option key={country.code} value={country.code}>
                                        {country.label}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-2 text-xs leading-6 text-[var(--text)]">
                                {t('auth.preferred_country_help', {
                                    defaultValue: 'Použijeme ji pro cílení doporučení a denního digestu. Později ji můžete změnit v profilu.'
                                })}
                            </p>
                        </div>
                    )}

                    {!isResetMode && (
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-[var(--text-muted)]">{t('auth.email')}</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-[var(--text-faint)]" size={18} />
                                <input
                                    type="email"
                                    required
                                    className="app-modal-input pl-10"
                                    placeholder="jan@example.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="mb-1 block text-xs font-bold uppercase text-[var(--text-muted)]">
                            {isResetMode
                                ? t('auth.new_password', { defaultValue: 'Nové heslo' })
                                : t('auth.password')}
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-[var(--text-faint)]" size={18} />
                            <input
                                type="password"
                                required
                                minLength={6}
                                className="app-modal-input pl-10"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                            />
                        </div>
                        {isLogin && (
                            <div className="mt-2 text-right">
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={isBusy}
                                    className="text-xs font-semibold text-[var(--accent)] hover:underline disabled:opacity-50"
                                >
                                    {t('auth.forgot_password')}
                                </button>
                            </div>
                        )}
                    </div>

                    {isResetMode && (
                        <div>
                            <label className="mb-1 block text-xs font-bold uppercase text-[var(--text-muted)]">
                                {t('auth.confirm_new_password', { defaultValue: 'Potvrzení hesla' })}
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-[var(--text-faint)]" size={18} />
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="app-modal-input pl-10"
                                    placeholder="••••••••"
                                    value={formData.confirmPassword}
                                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {!isLogin && !isResetMode && (
                        <label className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2 text-[13px] text-[var(--text)]">
                            <input
                                type="checkbox"
                                checked={formData.wantsDigestEmail}
                                onChange={e => setFormData({ ...formData, wantsDigestEmail: e.target.checked })}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                            />
                            <span>
                                <span className="block text-[13px] font-semibold leading-5 text-[var(--text-strong)]">
                                    {t('auth.digest_consent_title', { defaultValue: 'Souhlasím se zasíláním emailového digestu' })}
                                </span>
                            </span>
                        </label>
                    )}

                    {!isLogin && !isResetMode && (
                        <div className="space-y-3">
                            <label className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2 text-[13px] text-[var(--text)]">
                                <input
                                    type="checkbox"
                                    checked={formData.agreedToTerms}
                                    onChange={e => setFormData({ ...formData, agreedToTerms: e.target.checked })}
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                                />
                                <span>
                                    <span className="block text-[13px] font-semibold leading-5 text-[var(--text-strong)]">
                                        {t('auth.register_terms_title', { defaultValue: 'Souhlasím s podmínkami použití' })}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] leading-5 text-[var(--text)]">
                                        {t('auth.register_terms_help_prefix', { defaultValue: 'Přečetl(a) jsem si' })}{' '}
                                        <a href="/terms" target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] hover:underline">
                                            {t('footer.terms', { defaultValue: 'Podmínky používání' })}
                                        </a>.
                                    </span>
                                </span>
                            </label>

                            <label className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2 text-[13px] text-[var(--text)]">
                                <input
                                    type="checkbox"
                                    checked={formData.agreedToPrivacy}
                                    onChange={e => setFormData({ ...formData, agreedToPrivacy: e.target.checked })}
                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                                />
                                <span>
                                    <span className="block text-[13px] font-semibold leading-5 text-[var(--text-strong)]">
                                        {t('auth.register_privacy_title', { defaultValue: 'Souhlasím se zpracováním osobních údajů' })}
                                    </span>
                                    <span className="mt-0.5 block text-[11px] leading-5 text-[var(--text)]">
                                        {t('auth.register_privacy_help_prefix', { defaultValue: 'Podrobnosti najdete v dokumentu' })}{' '}
                                        <a href="/privacy-policy" target="_blank" rel="noreferrer" className="font-semibold text-[var(--accent)] hover:underline">
                                            {t('footer.privacy', { defaultValue: 'Ochrana osobních údajů' })}
                                        </a>.
                                    </span>
                                </span>
                            </label>
                        </div>
                    )}

                    <div className="sticky bottom-0 -mx-5 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)]/96 px-5 pb-1 pt-3 backdrop-blur sm:-mx-6 sm:px-6">
                        <div className="space-y-3">
                            <button
                                type="submit"
                                disabled={isBusy || (!isLogin && !isResetMode && (!formData.agreedToTerms || !formData.agreedToPrivacy))}
                                className="app-button-primary w-full"
                            >
                                {loading && <Loader2 className="animate-spin" size={18} />}
                                {isResetMode
                                    ? t('auth.set_new_password', { defaultValue: 'Nastavit nové heslo' })
                                    : (isLogin ? t('auth.login_button') : t('auth.register_button'))}
                            </button>

                            {!isResetMode && (
                                <>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                                        <span className="text-xs font-bold uppercase text-[var(--text-faint)]">{t('auth.or')}</span>
                                        <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                                    </div>

                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => handleOAuthSignIn('google')}
                                            className="app-button-secondary w-full"
                                        >
                                            {oauthLoading === 'google' ? <Loader2 className="animate-spin" size={18} /> : <Chrome size={18} />}
                                            {t('auth.continue_with_google')}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => handleOAuthSignIn('linkedin_oidc')}
                                            className="app-button-secondary w-full"
                                        >
                                            {oauthLoading === 'linkedin_oidc' ? <Loader2 className="animate-spin" size={18} /> : <Linkedin size={18} />}
                                            {t('auth.continue_with_linkedin')}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                        </form>

                        <div className="mt-4 text-center text-sm">
                    {isResetMode ? (
                        <button
                            onClick={() => setMode('login')}
                            className="font-bold text-[var(--accent)] hover:underline"
                        >
                            {t('auth.login_button')}
                        </button>
                    ) : (
                        <>
                            <span className="text-[var(--text-muted)]">
                                {isLogin ? t('auth.no_account') : t('auth.have_account')}
                            </span>
                            <button
                                onClick={() => setMode(isLogin ? 'register' : 'login')}
                                className="ml-2 font-bold text-[var(--accent)] hover:underline"
                            >
                                {isLogin ? t('auth.create_account') : t('auth.login_button')}
                            </button>
                        </>
                    )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
