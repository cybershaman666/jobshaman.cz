import React, { useMemo, useState } from 'react';
import {
  Bell,
  BrainCircuit,
  Check,
  ChevronDown,
  Globe2,
  MapPin,
  Menu,
  Monitor,
  Moon,
  LogOut,
  Search,
  Sun,
  X,
  Building2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CompanyProfile, JobWorkArrangementFilter, SearchLanguageCode, TransportMode, UserProfile, ViewState } from '../types';
import { cn } from './ui/primitives';
import { getNormalizedAppPath, isExternalStandalonePath } from '../utils/appRouting';
import { NotificationInbox, SearchCockpit, type CareerOSNotification } from './careeros/CareerOSCandidateWorkspace';

interface AppHeaderProps {
  viewState: ViewState;
  setViewState: React.Dispatch<React.SetStateAction<ViewState>>;
  selectedJobId: string | null;
  setSelectedJobId: React.Dispatch<React.SetStateAction<string | null>> | ((id: string | null) => void);
  isBlogOpen?: boolean;
  setIsBlogOpen?: (open: boolean) => void;
  setSelectedBlogPostSlug?: (slug: string | null) => void;
  showCompanyLanding: boolean;
  setShowCompanyLanding: (show: boolean) => void;
  userProfile: UserProfile;
  companyProfile: CompanyProfile | null;
  setCompanyProfile: (profile: CompanyProfile | null) => void;
  handleAuthAction: (mode?: 'login' | 'register') => void;
  theme: 'light' | 'dark';
  themeMode: 'light' | 'dark' | 'system';
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  setIsOnboardingCompany: (show: boolean) => void;
  onIntentionalListClick?: () => void;
  discoveryLane?: 'challenges' | 'imports';
  setDiscoveryLane?: (lane: 'challenges' | 'imports') => void;
  discoveryMode?: 'all' | 'micro_jobs';
  setDiscoveryMode?: (mode: 'all' | 'micro_jobs') => void;
  discoverySearchMode?: boolean;
  onOpenDiscoverySearch?: () => void;
  setDiscoverySearchMode?: (active: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterCity: string;
  setFilterCity: (city: string) => void;
  performSearch: (term: string) => void;
  remoteOnly: boolean;
  setRemoteOnly: (enabled: boolean) => void;
  filterWorkArrangement: JobWorkArrangementFilter;
  setFilterWorkArrangement: (value: JobWorkArrangementFilter) => void;
  globalSearch: boolean;
  setGlobalSearch: (enabled: boolean) => void;
  abroadOnly: boolean;
  setAbroadOnly: (enabled: boolean) => void;
  enableCommuteFilter: boolean;
  setEnableCommuteFilter: (enabled: boolean) => void;
  filterMinSalary: number;
  setFilterMinSalary: (salary: number) => void;
  filterMaxDistance: number;
  setFilterMaxDistance: (distance: number) => void;
  transportMode: TransportMode;
  setTransportMode: (mode: TransportMode) => void;
  discoveryFilterMode?: 'all' | 'micro_jobs';
  setDiscoveryFilterMode?: (mode: 'all' | 'micro_jobs') => void;
  filterContractType: string[];
  setFilterContractType: (values: string[]) => void;
  filterExperience: string[];
  setFilterExperience: (values: string[]) => void;
  filterLanguageCodes: SearchLanguageCode[];
  setFilterLanguageCodes: (values: SearchLanguageCode[]) => void;
  filterBenefits: string[];
  setFilterBenefits: (values: string[]) => void;
  benefitCandidates: string[];
  notifications?: CareerOSNotification[];
  readNotificationIds?: string[];
  notificationCount?: number;
  onNotificationAction?: (notification: CareerOSNotification) => void;
  onMarkNotificationRead?: (notificationId: string) => void;
  onMarkAllNotificationsRead?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  viewState,
  setViewState,
  setSelectedJobId,
  isBlogOpen = false,
  setIsBlogOpen,
  setSelectedBlogPostSlug,
  showCompanyLanding,
  setShowCompanyLanding,
  userProfile,
  handleAuthAction,
  theme,
  themeMode,
  setThemeMode,
  setIsOnboardingCompany,
  onIntentionalListClick,
  discoveryLane = 'challenges',
  setDiscoveryLane,
  discoveryMode = 'all',
  setDiscoveryMode,
  discoverySearchMode = false,
  setDiscoverySearchMode,
  searchTerm,
  setSearchTerm,
  filterCity,
  setFilterCity,
  performSearch,
  remoteOnly,
  setRemoteOnly,
  filterWorkArrangement,
  setFilterWorkArrangement,
  globalSearch,
  setGlobalSearch,
  abroadOnly,
  setAbroadOnly,
  enableCommuteFilter,
  setEnableCommuteFilter,
  filterMinSalary,
  setFilterMinSalary,
  filterMaxDistance,
  setFilterMaxDistance,
  transportMode,
  setTransportMode,
  discoveryFilterMode = 'all',
  setDiscoveryFilterMode,
  filterContractType,
  setFilterContractType,
  filterExperience,
  setFilterExperience,
  filterLanguageCodes,
  setFilterLanguageCodes,
  filterBenefits,
  setFilterBenefits,
  benefitCandidates,
  notifications = [],
  readNotificationIds = [],
  notificationCount = 0,
  onNotificationAction,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
}) => {
  const { t, i18n } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const currentLanguageCode = useMemo(() => {
    const supported = new Set(((i18n.options.supportedLngs || []) as string[]).filter(Boolean));
    if (supported.has(locale)) return locale;
    const fallback = (i18n.resolvedLanguage || i18n.language || 'cs').split('-')[0].toLowerCase();
    return supported.has(fallback) ? fallback : 'cs';
  }, [i18n.language, i18n.options.supportedLngs, i18n.resolvedLanguage, locale]);

  const scrollToElement = (elementId: string, options?: ScrollIntoViewOptions) => {
    window.setTimeout(() => {
      document.getElementById(elementId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        ...options,
      });
    }, 80);
  };

  const openHomeOverview = () => {
    if (leaveStandaloneRoute()) return;
    onIntentionalListClick?.();
    setIsBlogOpen?.(false);
    setSelectedBlogPostSlug?.(null);
    setShowCompanyLanding(false);
    setIsOnboardingCompany(false);
    setSelectedJobId(null);
    setDiscoveryLane?.('challenges');
    setDiscoveryMode?.('all');
    setDiscoverySearchMode?.(false);
    setViewState(ViewState.LIST);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openMicroJobs = () => {
    if (leaveStandaloneRoute('')) return;
    onIntentionalListClick?.();
    setIsBlogOpen?.(false);
    setSelectedBlogPostSlug?.(null);
    setShowCompanyLanding(false);
    setIsOnboardingCompany(false);
    setSelectedJobId(null);
    setViewState(ViewState.LIST);
    setDiscoveryLane?.('challenges');
    setDiscoveryMode?.('micro_jobs');
    setDiscoverySearchMode?.(false);
    scrollToElement('challenge-discovery');
  };

  const navItems = [
    {
      key: 'overview',
      label: t('header.shell.overview'),
      active: !showCompanyLanding && !isBlogOpen && viewState === ViewState.LIST && discoveryLane === 'challenges' && discoveryMode === 'all' && !discoverySearchMode,
      onClick: openHomeOverview
    },
    {
      key: 'micro_jobs',
      label: t('header.shell.quick_gigs'),
      active: !showCompanyLanding && !isBlogOpen && viewState === ViewState.LIST && discoveryLane === 'challenges' && discoveryMode === 'micro_jobs',
      onClick: openMicroJobs
    },
  ];

  const languages = [
    { code: 'cs', name: 'CZ', flagCode: 'cz' },
    { code: 'en', name: 'EN', flagCode: 'gb' },
    { code: 'pl', name: 'PL', flagCode: 'pl' },
    { code: 'de', name: 'DE', flagCode: 'de' },
    { code: 'at', name: 'AT', flagCode: 'at' },
    { code: 'sk', name: 'SK', flagCode: 'sk' }
  ];

  const getLocalePrefix = () => {
    const supported: string[] = (i18n.options.supportedLngs || []) as string[];
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length > 0 && supported.includes(parts[0])) {
      return `/${parts[0]}`;
    }
    const fallback = (i18n.language || 'cs').split('-')[0];
    return `/${fallback}`;
  };

  const isDemoHandshakeRoute = () => {
    const supported: string[] = (i18n.options.supportedLngs || []) as string[];
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length > 0 && supported.includes(parts[0])) parts.shift();
    return parts[0] === 'demo-handshake' || parts[0] === 'demo-company-handshake';
  };

  const isAdminRoute = () => {
    const supported: string[] = (i18n.options.supportedLngs || []) as string[];
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length > 0 && supported.includes(parts[0])) parts.shift();
    return parts[0] === 'admin';
  };

  const leaveDemoHandshakeRoute = (targetPath?: string): boolean => {
    if (!isDemoHandshakeRoute()) return false;
    const localePrefix = getLocalePrefix();
    const normalizedTarget = targetPath
      ? `${localePrefix}/${targetPath.replace(/^\/+/, '')}`.replace(/\/+$/, '')
      : `${localePrefix}/`;
    window.location.assign(normalizedTarget);
    return true;
  };

  const leaveStandaloneRoute = (targetPath?: string): boolean => {
    const normalizedCurrentPath = getNormalizedAppPath(window.location.pathname);
    if (!isExternalStandalonePath(normalizedCurrentPath)) return false;
    const localePrefix = getLocalePrefix();
    const normalizedTarget = targetPath
      ? `${localePrefix}/${targetPath.replace(/^\/+/, '')}`.replace(/\/+$/, '')
      : `${localePrefix}/`;
    window.location.assign(normalizedTarget);
    return true;
  };

  const navigateToShellHome = () => {
    if (leaveDemoHandshakeRoute()) return;
    if (leaveStandaloneRoute()) return;
    if (isAdminRoute()) {
      window.location.assign(`${getLocalePrefix()}/`);
      return;
    }
    const homePath = `${getLocalePrefix()}/`;
    if (window.location.pathname !== homePath) {
      window.history.replaceState({}, '', homePath);
    }
    onIntentionalListClick?.();
    setDiscoveryLane?.('challenges');
    setDiscoveryMode?.('all');
    setDiscoverySearchMode?.(false);
    setIsBlogOpen?.(false);
    setViewState(ViewState.LIST);
    setSelectedJobId(null);
    setSelectedBlogPostSlug?.(null);
    setShowCompanyLanding(false);
    setIsOnboardingCompany(false);
  };

  const changeLanguage = (lng: string) => {
    try {
      const supported: string[] = (i18n.options.supportedLngs || []) as string[];
      const parts = window.location.pathname.split('/').filter(Boolean);
      if (parts.length > 0 && supported.includes(parts[0])) parts.shift();
      const newPath = `/${lng}/${parts.join('/')}`.replace(/\/\/$/, '/');
      window.history.replaceState({}, '', newPath + window.location.search + window.location.hash);
    } catch (error) {
      console.warn('Failed to update locale in path', error);
    }
    i18n.changeLanguage(lng);
  };

  const searchUiCopy = {
    searchPlaceholder: t('header.shell.search_placeholder'),
    locationPlaceholder: t('header.shell.location_placeholder'),
    submit: t('header.shell.search_submit'),
  };
  const headerUiCopy = {
    companies: t('header.shell.companies'),
    lightMode: t('header.shell.light_mode'),
    darkMode: t('header.shell.dark_mode'),
    systemMode: t('header.system_mode', { defaultValue: 'System' }),
    preferences: t('header.preferences', { defaultValue: 'Preferences' }),
    appearance: t('header.appearance', { defaultValue: 'Appearance' }),
    language: t('header.language', { defaultValue: 'Language' }),
    pages: t('header.pages', { defaultValue: 'Pages' }),
    about: t('footer.about', { defaultValue: 'About Us' }),
    terms: t('footer.terms', { defaultValue: 'Terms of Use' }),
    privacy: t('footer.privacy', { defaultValue: 'Privacy Policy' }),
  };
  const legalLinks = [
    { href: `${getLocalePrefix()}/about`, label: headerUiCopy.about },
    { href: `${getLocalePrefix()}/terms`, label: headerUiCopy.terms },
    { href: `${getLocalePrefix()}/privacy-policy`, label: headerUiCopy.privacy },
  ];
  const themeOptions = [
    { key: 'system' as const, label: headerUiCopy.systemMode, icon: Monitor },
    { key: 'light' as const, label: headerUiCopy.lightMode, icon: Sun },
    { key: 'dark' as const, label: headerUiCopy.darkMode, icon: Moon },
  ];

  const submitDiscoverySearch = () => {
    if (leaveDemoHandshakeRoute()) return;
    if (leaveStandaloneRoute()) return;
    if (isAdminRoute()) {
      window.location.assign(`${getLocalePrefix()}/`);
      return;
    }
    onIntentionalListClick?.();
    setIsBlogOpen?.(false);
    setSelectedBlogPostSlug?.(null);
    setShowCompanyLanding(false);
    setIsOnboardingCompany(false);
    setSelectedJobId(null);
    setDiscoveryLane?.('challenges');
    setDiscoverySearchMode?.(true);
    setViewState(ViewState.LIST);
    performSearch(searchTerm);
    window.setTimeout(() => {
      document.getElementById('challenge-discovery')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const discoveryAccentStyle = useMemo((): React.CSSProperties | undefined => {
    if (viewState !== ViewState.LIST) return undefined;
    const isDark = theme === 'dark';
    const accent = isDark ? '#22d3ee' : '#0ea5c9';
    const accentRgb = isDark ? '34, 211, 238' : '14, 165, 201';
    const accentGreen = isDark ? '#14b8a6' : '#0f766e';
    const accentGreenRgb = isDark ? '20, 184, 166' : '15, 118, 110';
    const accentSky = isDark ? '#0d9488' : '#38bdf8';
    const accentSkyRgb = isDark ? '13, 148, 136' : '56, 189, 248';
    return {
      ['--accent' as any]: accent,
      ['--accent-rgb' as any]: accentRgb,
      ['--accent-green' as any]: accentGreen,
      ['--accent-green-rgb' as any]: accentGreenRgb,
      ['--accent-sky' as any]: accentSky,
      ['--accent-sky-rgb' as any]: accentSkyRgb,
    };
  }, [theme, viewState]);
  const headerInputClass = 'app-header-input h-11 w-full pl-11 pr-4 text-sm outline-none transition';
  const headerControlClass = 'app-header-control inline-flex h-11 items-center gap-2 px-4 text-sm font-semibold transition-colors';

  return (
    <header
      style={discoveryAccentStyle}
      className={cn(
        'sticky top-0 z-50 w-full py-1.5',
        'relative overflow-visible px-2 sm:px-4 lg:px-0'
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" />

      <div
        className={cn(
          'w-full',
          'lg:px-3'
        )}
      >
        <div
          className={cn(
            "app-topnav relative z-40 flex w-full flex-col gap-2 overflow-visible rounded-[26px] border border-slate-200/75 bg-white/78 px-4 py-3 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:px-5"
          )}
        >
          <div className="relative z-30 flex w-full items-center gap-3">
            {/* Logo Section */}
            <button
              type="button"
              onClick={navigateToShellHome}
              className="relative z-10 flex shrink-0 items-center gap-3 px-1 py-1 transition opacity-95 hover:opacity-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-[12px] border border-[rgba(var(--accent-rgb),0.2)] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_18%),linear-gradient(180deg,rgba(10,18,29,0.96),rgba(14,24,36,0.92))] text-[var(--accent)] shadow-[0_18px_34px_-24px_rgba(2,8,23,0.42),0_0_22px_rgba(var(--accent-rgb),0.12)]">
                <BrainCircuit size={18} strokeWidth={2.1} aria-hidden />
              </span>
              <span className="hidden text-[1.05rem] font-semibold tracking-[-0.03em] text-slate-800 dark:text-slate-100 sm:block">
                Jobshaman
              </span>
            </button>

            {/* Desktop Search - Single Row */}
            <div className="mx-auto hidden min-w-0 max-w-5xl flex-1 lg:flex">
              <div className="flex w-full items-center gap-2">
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                    <Search size={18} />
                  </div>
                  <input
                    id="appheader-discovery-search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitDiscoverySearch()}
                    onFocus={() => setDiscoverySearchMode?.(true)}
                    placeholder={searchUiCopy.searchPlaceholder}
                    className={headerInputClass}
                  />
                </div>
                <div className="relative flex-[0.7]">
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                    <MapPin size={18} />
                  </div>
                  <input
                    value={filterCity}
                    onChange={(e) => setFilterCity(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitDiscoverySearch()}
                    onFocus={() => setDiscoverySearchMode?.(true)}
                    placeholder={searchUiCopy.locationPlaceholder}
                    className={headerInputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={submitDiscoverySearch}
                  className="app-header-search-cta inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold whitespace-nowrap"
                >
                  {searchUiCopy.submit}
                </button>
              </div>
            </div>

            {/* Right Actions */}
            <div className="relative z-10 flex items-center gap-2 sm:gap-4">
              <div className="relative z-[80] hidden lg:block">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen((prev) => !prev);
                    setUtilityMenuOpen(false);
                  }}
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:border-cyan-200 hover:bg-cyan-50/60 hover:text-cyan-700 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-cyan-500/50 dark:hover:bg-slate-900"
                  aria-label={t('careeros.notifications.title', { defaultValue: 'Notifications' })}
                >
                  <Bell size={17} />
                  {notificationCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-cyan-500 px-1.5 py-0.5 text-[11px] font-bold text-white shadow-[0_8px_18px_rgba(8,145,178,0.28)]">
                      {notificationCount > 9 ? '9+' : notificationCount}
                    </span>
                  ) : null}
                </button>
              </div>

              <div className="relative z-[80] hidden lg:block">
                <button
                  type="button"
                  onClick={() => {
                    setUtilityMenuOpen((prev) => !prev);
                    setNotificationsOpen(false);
                  }}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50/60 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:border-cyan-500/50 dark:hover:bg-slate-900"
                >
                  <Globe2 size={15} />
                  {languages.find((lang) => lang.code === currentLanguageCode)?.name || currentLanguageCode.toUpperCase()}
                  <ChevronDown size={12} />
                </button>
                {utilityMenuOpen && (
                  <div className="app-header-menu absolute right-0 top-full z-[90] mt-2 w-[20rem] overflow-hidden rounded-2xl p-2 shadow-xl">
                    <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                      Offer market
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => {
                            changeLanguage(lang.code);
                            setUtilityMenuOpen(false);
                          }}
                          className={cn(
                            'flex items-center justify-center rounded-xl px-2 py-2 text-xs font-semibold transition',
                            currentLanguageCode === lang.code
                              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                              : 'text-[var(--text)] hover:bg-[var(--surface-muted)]'
                          )}
                        >
                          {lang.name}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 border-t border-[var(--border-subtle)] px-2 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                      {headerUiCopy.appearance}
                    </div>
                    <div className="grid gap-1">
                      {themeOptions.map((option) => {
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setThemeMode(option.key)}
                            className={cn(
                              'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition',
                              themeMode === option.key
                                ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                                : 'text-[var(--text)] hover:bg-[var(--surface-muted)]'
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <Icon size={16} />
                              {option.label}
                            </span>
                            {themeMode === option.key ? <Check size={15} /> : null}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-3 border-t border-[var(--border-subtle)] px-2 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                      {headerUiCopy.pages}
                    </div>
                    <div className="grid gap-1">
                      {legalLinks.map((item) => (
                        <a
                          key={item.href}
                          href={item.href}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-muted)]"
                        >
                          {item.label}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pro firmy link */}
              <button
                type="button"
                onClick={() => setShowCompanyLanding(true)}
                className={cn(headerControlClass, 'hidden lg:flex')}
              >
                <Building2 size={15} />
                {headerUiCopy.companies}
              </button>

              {/* User Profile / Auth */}
              {userProfile.isLoggedIn ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowCompanyLanding(false);
                      setViewState(ViewState.PROFILE);
                    }}
                    className="group flex items-center gap-3 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-cyan-500/50 dark:hover:bg-slate-900"
                  >
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-white text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                      {userProfile.photo && !avatarFailed ? (
                        <img src={userProfile.photo} alt="" className="h-full w-full object-cover" onError={() => setAvatarFailed(true)} />
                      ) : (
                        <span>{userProfile.name?.charAt(0) || userProfile.email?.charAt(0)}</span>
                      )}
                    </div>
                    <span className="hidden text-sm font-semibold text-slate-800 dark:text-slate-100 lg:block">{userProfile.name || userProfile.email}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAuthAction('login')}
                    className={cn(
                      'hidden h-9 w-9 items-center justify-center rounded-full border border-rose-200/80 bg-rose-50 text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200 dark:hover:bg-rose-950/50 lg:inline-flex'
                    )}
                    title={t('common.logout', { defaultValue: 'Logout' })}
                    aria-label={t('common.logout', { defaultValue: 'Logout' })}
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleAuthAction('login')}
                  className="app-button-primary !px-5 !py-2"
              >
                {t('auth.login_button')}
              </button>
              )}

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="app-header-control inline-flex h-10 w-10 items-center justify-center p-2 lg:hidden"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Search/Nav */}
        {mobileMenuOpen && (
          <div className="app-header-menu mt-2 overflow-hidden rounded-[28px] lg:hidden">
            <div className="grid gap-2 p-4">
              {/* Unified Search for Mobile */}
              <div className="relative mb-2">
                <Search size={18} className="absolute left-4 top-3 text-[var(--text-faint)]" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onFocus={() => setDiscoverySearchMode?.(true)}
                  placeholder={searchUiCopy.searchPlaceholder}
                  className={headerInputClass}
                />
              </div>
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => { item.onClick(); setMobileMenuOpen(false); }}
                  className={cn(
                    "app-header-control w-full justify-start px-4 py-3 text-left text-sm font-bold transition-colors",
                    item.active ? "app-header-control-active" : null
                  )}
                >
                  {item.label}
                </button>
              ))}
              <div className="mt-2 grid gap-2 border-t border-[var(--border-subtle)] pt-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  {headerUiCopy.appearance}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {themeOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.key}
                        onClick={() => setThemeMode(option.key)}
                        className={cn(
                          'app-header-control justify-center gap-2 px-3 py-2 text-xs font-bold',
                          themeMode === option.key ? 'app-header-control-active' : null
                        )}
                      >
                        <Icon size={15} />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2 grid gap-2 border-t border-[var(--border-subtle)] pt-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  {headerUiCopy.language}
                </div>
                <div className="flex flex-wrap gap-2">
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => changeLanguage(l.code)}
                      className={cn("app-header-control px-2 py-1 text-xs font-bold", currentLanguageCode === l.code ? "app-header-control-active" : null)}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 grid gap-2 border-t border-[var(--border-subtle)] pt-4">
                {userProfile.isLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleAuthAction('login');
                    }}
                    className="app-header-control w-full justify-start px-4 py-3 text-left text-sm font-semibold transition-colors"
                  >
                    <LogOut size={16} />
                    {t('common.logout', { defaultValue: 'Logout' })}
                  </button>
                ) : null}
                {legalLinks.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="app-header-control w-full justify-start px-4 py-3 text-left text-sm font-semibold transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="relative z-[85]">
          <NotificationInbox
            open={notificationsOpen}
            notifications={notifications}
            readNotificationIds={readNotificationIds}
            onClose={() => setNotificationsOpen(false)}
            onAction={(notification) => {
              setNotificationsOpen(false);
              onMarkNotificationRead?.(notification.id);
              onNotificationAction?.(notification);
            }}
            onMarkRead={onMarkNotificationRead}
            onMarkAllRead={onMarkAllNotificationsRead}
            className="right-4 lg:right-[23rem] xl:right-[25rem] 2xl:right-[27rem]"
          />
          <SearchCockpit
            open={Boolean(discoverySearchMode)}
            onClose={() => setDiscoverySearchMode?.(false)}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterCity={filterCity}
            setFilterCity={setFilterCity}
            remoteOnly={remoteOnly}
            setRemoteOnly={setRemoteOnly}
            filterWorkArrangement={filterWorkArrangement}
            setFilterWorkArrangement={setFilterWorkArrangement}
            globalSearch={globalSearch}
            setGlobalSearch={setGlobalSearch}
            abroadOnly={abroadOnly}
            setAbroadOnly={setAbroadOnly}
            enableCommuteFilter={enableCommuteFilter}
            setEnableCommuteFilter={setEnableCommuteFilter}
            filterMinSalary={filterMinSalary}
            setFilterMinSalary={setFilterMinSalary}
            filterMaxDistance={filterMaxDistance}
            setFilterMaxDistance={setFilterMaxDistance}
            transportMode={transportMode}
            setTransportMode={setTransportMode}
            discoveryMode={discoveryFilterMode}
            setDiscoveryMode={(value) => setDiscoveryFilterMode?.(value)}
            filterContractType={filterContractType}
            setFilterContractType={setFilterContractType}
            filterExperience={filterExperience}
            setFilterExperience={setFilterExperience}
            filterLanguageCodes={filterLanguageCodes}
            setFilterLanguageCodes={setFilterLanguageCodes}
            filterBenefits={filterBenefits}
            setFilterBenefits={setFilterBenefits}
            benefitCandidates={benefitCandidates}
            onSubmit={submitDiscoverySearch}
          />
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
