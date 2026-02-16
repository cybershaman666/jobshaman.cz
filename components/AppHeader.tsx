import React, { useState } from 'react';
import {
    Briefcase,
    Sun,
    Moon,
    UserCircle,
    Menu,
    X,
    User,
    LogOut
} from 'lucide-react';
import { ViewState, UserProfile, CompanyProfile } from '../types';
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
    handleAuthAction,
    toggleTheme,
    theme,
    setIsOnboardingCompany,
    onIntentionalListClick
}) => {
    const { t, i18n } = useTranslation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const isMarketplaceAccountContext = companyProfile?.industry === 'Freelancer' || companyProfile?.industry === 'Education';
    const canShowBusinessMenu = showCompanyLanding || !userProfile.isLoggedIn || userProfile.role === 'recruiter' || isMarketplaceAccountContext;
    const subscriptionSubjectId = userProfile.role === 'recruiter' && companyProfile?.id && companyProfile?.industry !== 'Freelancer'
        ? companyProfile.id
        : userProfile.id;

    const languages = [
        { code: 'cs', name: 'CZ', flag: '🇨🇿' },
        { code: 'en', name: 'EN', flag: '🇬🇧' },
        { code: 'pl', name: 'PL', flag: '🇵🇱' },
        { code: 'de', name: 'DE', flag: '🇩🇪' },
        { code: 'at', name: 'AT', flag: '🇦🇹' },
        { code: 'sk', name: 'SK', flag: '🇸🇰' }
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

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
            <div className="flex h-16 items-center justify-between px-3 sm:px-6 lg:px-8 max-w-[1920px] mx-auto gap-2 sm:gap-4">
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
                    <div className="p-1 rounded-lg transition-colors bg-transparent">
                        <img
                            src="/logo.png"
                            alt="JobShaman"
                            className="w-6 h-6 bg-transparent"
                        />
                    </div>
                    <span className="text-lg sm:text-xl font-bold tracking-tight hidden sm:block">
                        <span className="text-slate-900 dark:text-white">Job</span>
                        <span className="text-cyan-600 dark:text-cyan-400">Shaman</span>
                    </span>
                </div>

                {/* Mobile Menu Button */}
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="sm:hidden flex items-center justify-center p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                    title="Menu"
                >
                    {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>

                {/* Desktop Navigation */}
                <nav className="hidden sm:flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700/50">
                    {!showCompanyLanding && (
                        <>
                            <button
                                onClick={() => { 
                                    onIntentionalListClick?.();
                                    setViewState(ViewState.LIST); 
                                    setSelectedJobId(null); 
                                }}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${viewState === ViewState.LIST ? 'bg-white dark:bg-cyan-500/15 text-slate-900 dark:text-cyan-200 shadow-sm dark:ring-1 dark:ring-cyan-500/40' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
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
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${viewState === ViewState.PROFILE ? 'bg-white dark:bg-cyan-500/15 text-slate-900 dark:text-cyan-200 shadow-sm dark:ring-1 dark:ring-cyan-500/40' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
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
                                if (showCompanyLanding) {
                                    setShowCompanyLanding(false);
                                    setViewState(ViewState.LIST);
                                } else if (userProfile.isLoggedIn) {
                                    // Check if they are a course provider or freelancer FIRST
                                    if (companyProfile?.industry === 'Education') {
                                        setViewState(ViewState.COURSE_PROVIDER_DASHBOARD);
                                    } else if (companyProfile?.industry === 'Freelancer') {
                                        // Freelancer dashboard disabled - go to profile
                                        setViewState(ViewState.PROFILE);
                                    } else if (userProfile.role === 'recruiter') {
                                        // Regular recruiter/company
                                        if (companyProfile) {
                                            setViewState(ViewState.COMPANY_DASHBOARD);
                                        } else {
                                            // Recruiter but no company - go to onboarding
                                            setIsOnboardingCompany(true);
                                        }
                                    } else {
                                        // Not logged in as recruiter, show company landing
                                        setShowCompanyLanding(true);
                                    }
                                } else {
                                    setShowCompanyLanding(true);
                                }
                            }}
                            className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${showCompanyLanding || viewState === ViewState.COMPANY_DASHBOARD || viewState === ViewState.FREELANCER_DASHBOARD || viewState === ViewState.COURSE_PROVIDER_DASHBOARD ? 'bg-white dark:bg-cyan-500/15 text-slate-900 dark:text-cyan-200 shadow-sm dark:ring-1 dark:ring-cyan-500/40' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                        >
                            <Briefcase size={14} />
                            <span className="hidden md:inline">{showCompanyLanding ? t('nav.back') : (isMarketplaceAccountContext ? t('nav.my_account') : t('nav.for_companies'))}</span>
                            <span className="md:hidden">{showCompanyLanding ? '←' : '👤'}</span>
                        </button>
                    )}
                </nav>

                {/* Right Actions */}
                {!showCompanyLanding && (
                    <div className="flex items-center gap-3">
                        {/* Language Switcher */}
                        <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            {languages.map((lang) => (
                                <button
                                    key={lang.code}
                                    onClick={() => changeLanguage(lang.code)}
                                    className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${i18n.language === lang.code ? 'bg-white dark:bg-slate-700 text-cyan-600 shadow-sm' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                                    title={lang.name}
                                >
                                    {lang.name}
                                </button>
                            ))}
                        </div>

                        {/* Mobile Language Switcher (Compact) */}
                        <select
                            value={i18n.language}
                            onChange={(e) => changeLanguage(e.target.value)}
                            className="lg:hidden text-xs bg-transparent border-none focus:ring-0 text-slate-500 font-bold"
                        >
                            {languages.map((lang) => (
                                <option key={lang.code} value={lang.code}>{lang.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={toggleTheme}
                            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:white transition-colors"
                            title={t('header.toggle_theme')}
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

                        {userProfile.isLoggedIn ? (
                            <div className="flex items-center gap-3 pl-2">
                                <div
                                    className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-500"
                                    title={t('nav.profile')}
                                >
                                    {userProfile.photo ? (
                                        <img src={userProfile.photo} alt={userProfile.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{userProfile.name?.charAt(0) || 'U'}</span>
                                    )}
                                </div>
                                <div className="text-right hidden md:block">
                                    <div className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">{userProfile.name}</div>
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
                                    if (showCompanyLanding) {
                                        setShowCompanyLanding(false);
                                        setViewState(ViewState.LIST);
                                    } else if (userProfile.isLoggedIn) {
                                        if (companyProfile?.industry === 'Education') {
                                            setViewState(ViewState.COURSE_PROVIDER_DASHBOARD);
                                        } else if (companyProfile?.industry === 'Freelancer') {
                                            setViewState(ViewState.PROFILE);
                                        } else if (userProfile.role === 'recruiter') {
                                            if (companyProfile) {
                                                setViewState(ViewState.COMPANY_DASHBOARD);
                                            } else {
                                                setIsOnboardingCompany(true);
                                            }
                                        } else {
                                            setShowCompanyLanding(true);
                                        }
                                    } else {
                                        setShowCompanyLanding(true);
                                    }
                                    setMobileMenuOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${showCompanyLanding || viewState === ViewState.COMPANY_DASHBOARD || viewState === ViewState.FREELANCER_DASHBOARD || viewState === ViewState.COURSE_PROVIDER_DASHBOARD ? 'bg-white dark:bg-cyan-500/15 text-slate-900 dark:text-cyan-200 shadow-sm dark:ring-1 dark:ring-cyan-500/40' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                            >
                                <Briefcase size={14} />
                                {showCompanyLanding ? t('nav.back') : (isMarketplaceAccountContext ? t('nav.my_account') : t('nav.for_companies'))}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
};

export default AppHeader;
