
import React, { useEffect, useState } from 'react';
import { requestPasswordResetEmail, signInWithEmail, signInWithOAuthProvider, signUpWithEmail } from '../services/supabaseService';
import { fetchCsrfToken, waitForSession } from '../services/csrfService';
import { supabase } from '../services/supabaseClient';
import { X, Mail, Lock, User, Loader2, AlertCircle, Chrome, Linkedin } from 'lucide-react';

import { useTranslation } from 'react-i18next';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    defaultMode?: 'login' | 'register';
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, defaultMode = 'login' }) => {
    const { t, i18n } = useTranslation();
    const [isLogin, setIsLogin] = useState(defaultMode === 'login');
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'linkedin_oidc'>(null);
    const [error, setError] = useState<string | null>(null);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: ''
    });

    useEffect(() => {
        if (isOpen) {
            setIsLogin(defaultMode === 'login');
            setInfoMessage(null);
            setError(null);
            setAwaitingConfirmation(false);
        }
    }, [isOpen, defaultMode]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            let userData;

            if (isLogin) {
                const result = await signInWithEmail(formData.email, formData.password);
                if (result.error) throw result.error;
                userData = result.data?.user;
            } else {
                const result = await signUpWithEmail(
                    formData.email,
                    formData.password,
                    formData.fullName,
                    i18n.language,
                    Intl.DateTimeFormat().resolvedOptions().timeZone
                );
                if (result.error) throw result.error;
                userData = result.data?.user;

                const needsConfirmation = !!result.data?.user && !result.data?.session;
                if (needsConfirmation) {
                    setInfoMessage(t('auth.confirmation_required'));
                    setAwaitingConfirmation(true);
                    setIsLogin(true);
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 p-8">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full"
                >
                    <X size={20} />
                </button>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {isLogin ? t('auth.welcome_back') : t('auth.create_account')}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
                        {isLogin ? t('auth.login_desc') : t('auth.register_desc')}
                    </p>
                </div>

                {isLogin && (
                    <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300">
                        <AlertCircle size={16} className="mt-0.5" />
                        <div>
                            <div className="font-semibold">{t('auth.email_confirm_notice_title')}</div>
                            <div>{t('auth.email_confirm_notice_body')}</div>
                        </div>
                    </div>
                )}

                {infoMessage && (
                    <div className={`mb-6 p-3 border rounded-lg flex items-start gap-2 text-sm ${awaitingConfirmation ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                        <AlertCircle size={16} className="mt-0.5" />
                        <div>
                            {awaitingConfirmation && (
                                <div className="font-semibold mb-1">{t('auth.confirmation_required_title')}</div>
                            )}
                            <div>{infoMessage}</div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                <div className="space-y-3 mb-6">
                    <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleOAuthSignIn('google')}
                        className="w-full py-3 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                        {oauthLoading === 'google' ? <Loader2 className="animate-spin" size={18} /> : <Chrome size={18} />}
                        {t('auth.continue_with_google')}
                    </button>
                    <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleOAuthSignIn('linkedin_oidc')}
                        className="w-full py-3 border border-slate-200 dark:border-slate-800 rounded-xl font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                        {oauthLoading === 'linkedin_oidc' ? <Loader2 className="animate-spin" size={18} /> : <Linkedin size={18} />}
                        {t('auth.continue_with_linkedin')}
                    </button>
                </div>

                <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                    <span className="text-xs font-bold text-slate-400 uppercase">{t('auth.or')}</span>
                    <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('auth.full_name')}</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                    placeholder="Jan Novák"
                                    value={formData.fullName}
                                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('auth.email')}</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input
                                type="email"
                                required
                                className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                placeholder="jan@example.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('auth.password')}</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input
                                type="password"
                                required
                                minLength={6}
                                className="w-full pl-10 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
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
                                    className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline disabled:opacity-50"
                                >
                                    {t('auth.forgot_password')}
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={isBusy}
                        className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="animate-spin" size={18} />}
                        {isLogin ? t('auth.login_button') : t('auth.register_button')}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm">
                    <span className="text-slate-500 dark:text-slate-400">
                        {isLogin ? t('auth.no_account') : t('auth.have_account')}
                    </span>
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="ml-2 font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                    >
                        {isLogin ? t('auth.create_account') : t('auth.login_button')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
