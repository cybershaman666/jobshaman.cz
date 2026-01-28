import React from 'react';
import {
    Briefcase,
    Sun,
    Moon,
    LogOut,
    UserCircle,
    ShoppingBag
} from 'lucide-react';
import { ViewState, UserProfile } from '../types';
import SubscriptionStatusBadge from './SubscriptionStatusBadge';

import { useTranslation } from 'react-i18next';

interface AppHeaderProps {
    viewState: ViewState;
    setViewState: (view: ViewState) => void;
    setSelectedJobId: (id: string | null) => void;
    showCompanyLanding: boolean;
    setShowCompanyLanding: (show: boolean) => void;
    userProfile: UserProfile;
    handleAuthAction: () => void;
    toggleTheme: () => void;
    theme: 'light' | 'dark';
}

const AppHeader: React.FC<AppHeaderProps> = ({
    viewState,
    setViewState,
    setSelectedJobId,
    showCompanyLanding,
    setShowCompanyLanding,
    userProfile,
    handleAuthAction,
    toggleTheme,
    theme
}) => {
    const { t, i18n } = useTranslation();

    const languages = [
        { code: 'cs', name: 'CZ', flag: '🇨🇿' },
        { code: 'en', name: 'EN', flag: '🇬🇧' },
        { code: 'pl', name: 'PL', flag: '🇵🇱' },
        { code: 'de', name: 'DE', flag: '🇩🇪' },
        { code: 'sk', name: 'SK', flag: '🇸🇰' }
    ];

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-[1920px] mx-auto">
                {/* Logo */}
                <div
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => { setViewState(ViewState.LIST); setSelectedJobId(null); }}
                >
                    <div className="p-1 rounded-lg transition-colors bg-transparent">
                        <img
                            src="/logo.png"
                            alt="JobShaman"
                            className="w-6 h-6 bg-transparent"
                        />
                    </div>
                    <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight hidden sm:block">Job<span className="text-cyan-600 dark:text-cyan-400">Shaman</span></span>
                </div>

                {/* Navigation */}
                <nav className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700/50 overflow-x-auto">
                    {!showCompanyLanding && (
                        <>
                            <button
                                onClick={() => { setViewState(ViewState.LIST); setSelectedJobId(null); }}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${viewState === ViewState.LIST ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                            >
                                {t('nav.offers')}
                            </button>
                            <button
                                onClick={() => userProfile.isLoggedIn ? setViewState(ViewState.PROFILE) : handleAuthAction()}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${viewState === ViewState.PROFILE ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                            >
                                {t('nav.profile')}
                            </button>
                            <button
                                onClick={() => setViewState(ViewState.MARKETPLACE)}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${viewState === ViewState.MARKETPLACE ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                            >
                                <ShoppingBag className="w-4 h-4" />
                                {t('nav.marketplace')}
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => {
                            if (showCompanyLanding) {
                                setShowCompanyLanding(false);
                                setViewState(ViewState.LIST);
                            } else if (userProfile.isLoggedIn) {
                                if (userProfile.role === 'recruiter') {
                                    setViewState(ViewState.COMPANY_DASHBOARD);
                                } else {
                                    setShowCompanyLanding(true);
                                }
                            } else {
                                setShowCompanyLanding(true);
                            }
                        }}
                        className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${showCompanyLanding || viewState === ViewState.COMPANY_DASHBOARD ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                    >
                        <Briefcase size={14} /> {showCompanyLanding ? t('nav.back') : t('nav.for_companies')}
                    </button>
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
                            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                            title="Změnit režim"
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

                        {userProfile.isLoggedIn ? (
                            <div className="flex items-center gap-3 pl-2">
                                <div className="text-right hidden md:block">
                                    <div className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">{userProfile.name}</div>
                                    <div className="flex items-center gap-2">
                                        <SubscriptionStatusBadge userId={userProfile.id} />
                                    </div>
                                </div>
                                <button
                                    onClick={handleAuthAction}
                                    className="text-slate-400 hover:text-rose-500 transition-colors"
                                    title="Odhlásit se"
                                >
                                    <LogOut size={20} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleAuthAction}
                                className="flex items-center gap-2 text-sm font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                            >
                                <UserCircle size={18} />
                                {t('auth.login')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
};

export default AppHeader;
