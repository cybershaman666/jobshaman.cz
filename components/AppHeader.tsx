import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  MapPin,
  Menu,
  Moon,
  Search,
  Sun,
  X,
  Building2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CompanyProfile, UserProfile, ViewState } from '../types';
import { cn } from './ui/primitives';

interface AppHeaderProps {
  viewState: ViewState;
  setViewState: (view: ViewState) => void;
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
  isBlogOpen?: boolean;
  setIsBlogOpen?: (open: boolean) => void;
  setSelectedBlogPostSlug?: (slug: string | null) => void;
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
  remoteOnly?: boolean;
  setRemoteOnly?: (enabled: boolean) => void;
  enableCommuteFilter?: boolean;
  setEnableCommuteFilter?: (enabled: boolean) => void;
  filterMaxDistance?: number;
  filterMinSalary?: number;
  setFilterMinSalary?: (salary: number) => void;
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
  toggleTheme,
  theme,
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
  remoteOnly = false,
  setRemoteOnly,
  enableCommuteFilter = false,
  setEnableCommuteFilter,
  filterMaxDistance = 50,
  filterMinSalary = 0,
  setFilterMinSalary,
}) => {
  const { t, i18n } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
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

  const navigateToShellHome = () => {
    if (leaveDemoHandshakeRoute()) return;
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
    remoteOnly: t('header.shell.remote_only'),
    commuteMax: t('header.shell.commute_max', { km: filterMaxDistance }),
    atLeast: t('header.shell.at_least'),
    aiLine: t('header.shell.ai_line'),
    aiBadge: t('header.shell.ai_badge'),
    lightMode: t('header.shell.light_mode'),
    darkMode: t('header.shell.dark_mode'),
  };

  const submitDiscoverySearch = () => {
    if (leaveDemoHandshakeRoute()) return;
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

  const hasDesktopLeftRail = viewState !== ViewState.LIST;
  const showMarketplaceHeaderControls = viewState === ViewState.LIST && !showCompanyLanding && !isBlogOpen;
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
  const headerInputClass = 'app-header-input w-full py-3 pl-11 pr-4 text-sm outline-none transition';
  const headerControlClass = 'app-header-control inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors';
  const headerIconButtonClass = 'app-header-control hidden h-10 w-10 items-center justify-center lg:inline-flex';
  const headerNavItemClass = 'app-header-control px-4 py-2 text-sm font-semibold';
  const headerFilterClass = 'app-header-control px-3.5 py-2 text-xs font-semibold';

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
          hasDesktopLeftRail ? 'lg:pl-24 lg:pr-6' : 'lg:px-3'
        )}
      >
        <div
          className={cn(
            "app-topnav relative z-40 flex w-full flex-col gap-3 overflow-visible rounded-[18px] px-4 py-2.5 sm:px-6"
          )}
        >
          <div className="relative z-30 flex w-full items-center gap-3">
            {/* Logo Section */}
            <button
              type="button"
              onClick={navigateToShellHome}
              className="relative z-10 flex shrink-0 items-center gap-3 px-1 py-1 transition opacity-95 hover:opacity-100"
            >
              <span className="flex h-9 w-9 items-center justify-center">
                <img src="/logo-alt.png" alt="JobShaman" className="h-6 w-auto sm:h-7" />
              </span>
              <span className="flex items-center gap-2">
                <span className="hidden text-xl font-bold tracking-tight text-[var(--text-strong)] sm:block">
                  Job<span className="text-[var(--accent)]">Shaman</span>
                </span>
                <span className="inline-flex items-center rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.10)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] sm:text-[11px]">
                  Beta
                </span>
              </span>
            </button>

            {/* Desktop Search - Single Row */}
            <div className="mx-auto hidden max-w-5xl flex-1 lg:flex">
              <div className="flex w-full items-center gap-2">
                <div className="relative flex-1">
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[var(--text-faint)]">
                    <Search size={18} />
                  </div>
                  <input
                    id="appheader-discovery-search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitDiscoverySearch()}
                    placeholder={searchUiCopy.searchPlaceholder}
                    className={headerInputClass}
                  />
                </div>
                <div className="relative flex-[0.7]">
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[var(--text-faint)]">
                    <MapPin size={18} />
                  </div>
                  <input
                    value={filterCity}
                    onChange={(e) => setFilterCity(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitDiscoverySearch()}
                    placeholder={searchUiCopy.locationPlaceholder}
                    className={headerInputClass}
                  />
                </div>
                <button
                  type="button"
                  onClick={submitDiscoverySearch}
                  className="app-header-search-cta px-4 py-2.5 text-sm font-semibold"
                >
                  {searchUiCopy.submit}
                </button>
              </div>
            </div>

            {/* Right Actions */}
            <div className="relative z-10 flex items-center gap-2 sm:gap-4">
              {/* Pro firmy link */}
              <button
                type="button"
                onClick={() => setShowCompanyLanding(true)}
                className={cn(headerControlClass, 'hidden lg:flex')}
              >
                <Building2 size={15} />
                {headerUiCopy.companies}
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={headerIconButtonClass}
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <div className="relative z-[80]">
                  <button
                    type="button"
                    onClick={() => setLanguageMenuOpen((prev) => !prev)}
                    className={headerControlClass}
                  >
                    {(languages.find((lang) => lang.code === currentLanguageCode)?.name || currentLanguageCode).toUpperCase()}
                    <ChevronDown size={12} />
                  </button>
                  {languageMenuOpen && (
                    <div className="app-frost-panel absolute right-0 top-full z-[90] mt-2 w-32 overflow-hidden rounded-2xl p-1 shadow-xl">
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => { changeLanguage(lang.code); setLanguageMenuOpen(false); }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition",
                            currentLanguageCode === lang.code ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text)] hover:bg-[var(--surface-muted)]"
                          )}
                        >
                          <img src={`https://flagcdn.com/w20/${lang.flagCode}.png`} alt="" className="h-3 w-4 rounded-sm" />
                          {lang.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* User Profile / Auth */}
              {userProfile.isLoggedIn ? (
                <button
                  onClick={() => {
                    setShowCompanyLanding(false);
                    setViewState(ViewState.PROFILE);
                  }}
                  className="app-header-control group flex items-center gap-2 p-1 pr-3 transition-colors"
                >
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-xs font-bold text-[var(--accent)]">
                    {userProfile.photo && !avatarFailed ? (
                      <img src={userProfile.photo} alt="" className="h-full w-full object-cover" onError={() => setAvatarFailed(true)} />
                    ) : (
                      <span>{userProfile.name?.charAt(0)}</span>
                    )}
                  </div>
                  <span className="hidden text-sm font-semibold lg:block">{userProfile.name}</span>
                </button>
              ) : (
                <button
                  onClick={() => handleAuthAction('login')}
                  className="app-button-primary app-organic-cta !px-5 !py-2"
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

          {showMarketplaceHeaderControls ? (
            <div className="relative z-10 hidden w-full border-t border-[var(--border)]/80 pt-3 lg:block">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {navItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={item.onClick}
                      className={cn(
                        headerNavItemClass,
                        item.active
                          ? 'app-header-control-active'
                          : null
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRemoteOnly?.(!remoteOnly)}
                    className={cn(
                      headerFilterClass,
                      remoteOnly
                        ? 'app-header-control-active'
                        : null
                    )}
                  >
                    {headerUiCopy.remoteOnly}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnableCommuteFilter?.(!enableCommuteFilter)}
                    className={cn(
                      headerFilterClass,
                      enableCommuteFilter
                        ? 'app-header-control-active'
                        : null
                    )}
                  >
                    {headerUiCopy.commuteMax}
                  </button>
                  <label className={cn(headerFilterClass, 'flex items-center gap-2')}>
                    <span>{headerUiCopy.atLeast}</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={filterMinSalary || 0}
                      onChange={(e) => setFilterMinSalary?.(Number(e.target.value || 0))}
                      className="w-24 bg-transparent text-xs font-semibold text-[var(--text-strong)] outline-none"
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Mobile Search/Nav */}
        {mobileMenuOpen && (
          <div className="app-frost-panel mt-2 overflow-hidden rounded-[28px] lg:hidden">
            <div className="grid gap-2 p-4">
              {/* Unified Search for Mobile */}
              <div className="relative mb-2">
                <Search size={18} className="absolute left-4 top-3 text-[var(--text-faint)]" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
              <div className="mt-2 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
                <button onClick={toggleTheme} className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                  {theme === 'dark' ? headerUiCopy.lightMode : headerUiCopy.darkMode}
                </button>
                <div className="flex gap-2">
                  {languages.map(l => (
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
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
