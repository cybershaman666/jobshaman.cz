import React, { useState } from 'react';
import {
    Briefcase,
    Sun,
    Moon,
    UserCircle,
    Menu,
    X,
    User,
    LogOut,
    MoreHorizontal,
    ChevronDown
} from 'lucide-react';
import { ViewState, UserProfile, CompanyProfile } from '../types';
import { getRecruiterCompany } from '../services/supabaseService';
import SubscriptionStatusBadge from './SubscriptionStatusBadge';

import { useTranslation } from 'react-i18next';

interface AppHeaderProps {
    viewState: ViewState;
    setViewState: (view: ViewState) => void;
    setSelectedJobId: (id: string | null) => void;
    showCompanyLanding: boolean;
    setShowCompanyLanding: (show: boolean) => void;
    userProfile: UserProfile;
    companyProfile: CompanyProfile | null;
    setCompanyProfile: (profile: CompanyProfile | null) => void;
    handleAuthAction: (mode?: 'login' | 'register') => void;
    toggleTheme: () => void;
    theme: 'light' | 'dark';
    setIsOnboardingCompany: (show: boolean) => void;
    onIntentionalListClick?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
    viewState,
    setViewState,
    setSelectedJobId,
    showCompanyLanding,
    setShowCompanyLanding,
    userProfile,
    companyProfile,
    setCompanyProfile,
    handleAuthAction,
    toggleTheme,
    theme,
    setIsOnboardingCompany,
    onIntentionalListClick
}) => {
    const { t, i18n } = useTranslation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [legalMenuOpen, setLegalMenuOpen] = useState(false);
    const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);
    const canShowBusinessMenu = showCompanyLanding || !userProfile.isLoggedIn || userProfile.role === 'recruiter';
    const subscriptionSubjectId = (viewState === ViewState.COMPANY_DASHBOARD && userProfile.role === 'recruiter' && companyProfile?.id)
        ? companyProfile.id
        : userProfile.id;

    const languages = [
        { code: 'cs', name: 'CZ', flagCode: 'cz' },
        { code: 'en', name: 'EN', flagCode: 'gb' },
        { code: 'pl', name: 'PL', flagCode: 'pl' },
        { code: 'de', name: 'DE', flagCode: 'de' },
        { code: 'at', name: 'AT', flagCode: 'at' },
        { code: 'sk', name: 'SK', flagCode: 'sk' }
    ];

    const changeLanguage = (lng: string) => {
        try {
            // Update URL to include language prefix without reloading
            const supported: string[] = (i18n.options.supportedLngs || []) as string[];
            const parts = window.location.pathname.split('/').filter(Boolean);
            // If first segment is a supported locale, drop it
            if (parts.length > 0 && supported.includes(parts[0])) parts.shift();
            // Prepend the chosen locale
            const newPath = `/${lng}/${parts.join('/')}`.replace(/\/\/$/, '/');
            // Use history API to avoid reload
            window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);
        } catch (err) {
            console.warn('Failed to update locale in path', err);
        }

        i18n.changeLanguage(lng);
    };

    const handleBusinessClick = async () => {
        if (showCompanyLanding) {
            setShowCompanyLanding(false);
            setViewState(ViewState.LIST);
            return;
        }

        if (!userProfile.isLoggedIn) {
            setShowCompanyLanding(true);
            return;
        }

        if (userProfile.role !== 'recruiter') {
            setShowCompanyLanding(true);
            return;
        }

        if (companyProfile) {
            setViewState(ViewState.COMPANY_DASHBOARD);
            return;
        }

        if (userProfile.id) {
            try {
                const resolvedCompany = await getRecruiterCompany(userProfile.id);
                if (resolvedCompany) {
                    setCompanyProfile(resolvedCompany);
                    setIsOnboardingCompany(false);
                    setViewState(ViewState.COMPANY_DASHBOARD);
                    return;
                }
            } catch (error) {
                console.warn('Failed to resolve recruiter company before onboarding:', error);
            }
        }

        setIsOnboardingCompany(true);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200/20 dark:border-slate-800/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(30,41,59,0.94)_100%)] text-white backdrop-blur-md shadow-[0_16px_42px_-30px_rgba(15,23,42,0.65)]">
            <div className="flex h-[4.35rem] items-center justify-between px-3 sm:px-6 lg:px-8 max-w-[1920px] mx-auto gap-2 sm:gap-4">
                {/* Logo */}
                <div
                    className="flex items-center gap-2 cursor-pointer group flex-shrink-0"
                    onClick={() => {
                        setViewState(ViewState.LIST);
                        setSelectedJobId(null);
                        setShowCompanyLanding(false);
                        setIsOnboardingCompany(false);
                    }}
                >
                    <div className="rounded-lg transition-colors bg-transparent">
                        <img
                            src="/logo-alt.png"
                            alt="JobShaman"
                            className="h-11 sm:h-12 w-auto bg-transparent object-contain"
                        />
                    </div>
                    <span className="text-lg sm:text-xl font-bold tracking-tight hidden sm:block">
                        <span className="text-white">Job</span>
                        <span className="text-amber-500">Shaman</span>
                    </span>
                </div>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="sm:hidden flex items-center justify-center p-2 text-slate-300 hover:text-white transition-colors"
                    title={t('header.menu')}
                >
                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>

                {/* Desktop Navigation */}
                <nav className="hidden sm:flex items-center gap-1.5">
                    {!showCompanyLanding && (
                        <>
                            <button
                                onClick={() => { 
                                    onIntentionalListClick?.();
                                    setViewState(ViewState.LIST); 
                                    setSelectedJobId(null); 
                                }}
                                className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all whitespace-nowrap ${viewState === ViewState.LIST ? 'bg-white/14 text-white ring-1 ring-white/18' : 'text-slate-300 hover:text-white hover:bg-white/8'}`}
                            >
                                {t('nav.offers')}
                            </button>
                            <button
                                onClick={() => { 
                                    if (userProfile.isLoggedIn) {
                                        setViewState(ViewState.PROFILE);
                                    } else {
                                        handleAuthAction('login');
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${viewState === ViewState.PROFILE ? 'bg-white/14 text-white ring-1 ring-white/18' : 'text-slate-300 hover:text-white hover:bg-white/8'}`}
                                title={t('nav.profile')}
                            >
                                <User className="w-4 h-4" />
                                <span className="hidden xl:inline">{t('nav.profile')}</span>
                            </button>
                        </>
                    )}
                    {canShowBusinessMenu && (
                        <button
                            onClick={() => {
                                void handleBusinessClick();
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${showCompanyLanding || viewState === ViewState.COMPANY_DASHBOARD ? 'bg-white/14 text-white ring-1 ring-white/18' : 'text-slate-300 hover:text-white hover:bg-white/8'}`}
                        >
                            <Briefcase size={14} />
                            <span className="hidden md:inline">{showCompanyLanding ? t('nav.back') : t('nav.for_companies')}</span>
                            <span className="md:hidden">{showCompanyLanding ? '←' : '👤'}</span>
                        </button>
                    )}
                </nav>

                {/* Right Actions */}
                {!showCompanyLanding && (
                    <div className="flex items-center gap-3">
                        {/* Language Switcher */}
                        <div className="hidden lg:flex items-center gap-2">
                            <div className="relative">
                                <button
                                    onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/8 text-slate-200 hover:text-white transition-colors text-xs font-bold ring-1 ring-white/10"
                                    aria-label={t('header.language')}
                                    title={t('header.language')}
                                >
                                    <img
                                        src={`https://flagcdn.com/w20/${languages.find(l => l.code === i18n.language)?.flagCode || 'cz'}.png`}
                                        alt=""
                                        className="w-4 h-3 rounded-sm opacity-85"
                                        loading="lazy"
                                    />
                                    <span>{(languages.find(l => l.code === i18n.language)?.name || i18n.language || '').toUpperCase()}</span>
                                    <ChevronDown size={14} />
                                </button>
                                {languageMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-50">
                                        {languages.map((lang) => (
                                            <button
                                                key={lang.code}
                                                onClick={() => {
                                                    changeLanguage(lang.code);
                                                    setLanguageMenuOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors ${i18n.language === lang.code
                                                    ? 'text-cyan-600 dark:text-cyan-300 bg-cyan-50/60 dark:bg-cyan-900/20'
                                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                <span className="flex items-center gap-2">
                                                    <img
                                                        src={`https://flagcdn.com/w20/${lang.flagCode}.png`}
                                                        alt=""
                                                        className="w-4 h-3 rounded-sm opacity-85"
                                                        loading="lazy"
                                                    />
                                                    <span>{lang.name}</span>
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Mobile Language Switcher (Compact) */}
                        <select
                            value={i18n.language}
                            onChange={(e) => changeLanguage(e.target.value)}
                            className="lg:hidden text-xs bg-transparent border-none focus:ring-0 text-slate-500 font-bold dark:[color-scheme:dark]"
                        >
                            {languages.map((lang) => (
                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={toggleTheme}
                            className="p-2 text-slate-300 hover:text-white transition-colors"
                            title={t('header.toggle_theme')}
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <div className="relative">
                            <button
                                onClick={() => setLegalMenuOpen(!legalMenuOpen)}
                                className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                                aria-label={t('header.more')}
                                title={t('header.more')}
                            >
                                <MoreHorizontal size={20} />
                            </button>
                            {legalMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-50">
                                    <a
                                        href="/podminky-uziti"
                                        target="_blank"
                                        className="block px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        onClick={() => setLegalMenuOpen(false)}
                                    >
                                        {t('footer.terms')}
                                    </a>
                                    <a
                                        href="/ochrana-osobnich-udaju"
                                        target="_blank"
                                        className="block px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                        onClick={() => setLegalMenuOpen(false)}
                                    >
                                        {t('footer.privacy')}
                                    </a>
                                </div>
                            )}
                        </div>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

                        {userProfile.isLoggedIn ? (
                            <div className="flex items-center gap-3 pl-2">
                                <div
                                    className="w-9 h-9 rounded-full p-[1px] bg-white/25 ring-1 ring-white/25 shadow-[0_2px_10px_-6px_rgba(15,23,42,0.8)]"
                                    title={t('nav.profile')}
                                >
                                    <div className="h-full w-full rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-200">
                                        {userProfile.photo && !avatarFailed ? (
                                            <img
                                                src={userProfile.photo}
                                                alt={userProfile.name}
                                                className="w-full h-full rounded-full object-cover object-center"
                                                onError={() => setAvatarFailed(true)}
                                            />
                                        ) : (
                                            <span>{userProfile.name?.charAt(0) || 'U'}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right hidden md:block">
                                    <div className="text-sm font-bold text-white leading-none mb-1">{userProfile.name}</div>
                                    <div className="flex items-center gap-2">
                                        <SubscriptionStatusBadge userId={subscriptionSubjectId} />
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleAuthAction()}
                                    className="flex items-center gap-2 text-sm font-bold text-rose-600 p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                    title={t('header.logout')}
                                >
                                    <LogOut size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => handleAuthAction('login')}
                                className="flex items-center gap-2 text-sm font-bold text-white bg-slate-900 dark:bg-cyan-500/15 dark:text-cyan-200 px-4 py-2 rounded-lg hover:bg-slate-800 dark:hover:bg-cyan-500/25 transition-colors dark:ring-1 dark:ring-cyan-500/40"
                            >
                                <UserCircle size={18} />
                                {t('auth.login')}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Mobile Navigation Drawer */}
            {mobileMenuOpen && (
                <div className="sm:hidden border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <div className="px-3 py-4 space-y-2">
                        {!showCompanyLanding && (
                            <>
                                <button
                                    onClick={() => { 
                                        onIntentionalListClick?.();
                                        setViewState(ViewState.LIST); 
                                        setSelectedJobId(null);
                                        setMobileMenuOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-bold transition-all ${viewState === ViewState.LIST ? 'bg-white dark:bg-cyan-500/15 text-slate-900 dark:text-cyan-200 shadow-sm dark:ring-1 dark:ring-cyan-500/40' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                                >
                                    {t('nav.offers')}
                                </button>
                                <button
                                    onClick={() => { 
                                        if (userProfile.isLoggedIn) {
                                            setViewState(ViewState.PROFILE);
                                        } else {
                                            handleAuthAction('login');
                                        }
                                        setMobileMenuOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewState === ViewState.PROFILE ? 'bg-white dark:bg-cyan-500/15 text-slate-900 dark:text-cyan-200 shadow-sm dark:ring-1 dark:ring-cyan-500/40' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                                >
                                    <User className="w-4 h-4" />
                                    {t('nav.profile')}
                                </button>
                            </>
                        )}
                        {canShowBusinessMenu && (
                            <button
                                onClick={() => {
                                    void handleBusinessClick();
                                    setMobileMenuOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${showCompanyLanding || viewState === ViewState.COMPANY_DASHBOARD ? 'bg-white dark:bg-cyan-500/15 text-slate-900 dark:text-cyan-200 shadow-sm dark:ring-1 dark:ring-cyan-500/40' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                            >
                                <Briefcase size={14} />
                                {showCompanyLanding ? t('nav.back') : t('nav.for_companies')}
                            </button>
                        )}
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-2">{t('header.more')}</div>
                            <a
                                href="/podminky-uziti"
                                target="_blank"
                                className="block px-3 py-2 rounded-md text-sm font-bold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                {t('footer.terms')}
                            </a>
                            <a
                                href="/ochrana-osobnich-udaju"
                                target="_blank"
                                className="block px-3 py-2 rounded-md text-sm font-bold text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                {t('footer.privacy')}
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
};

export default AppHeader;
