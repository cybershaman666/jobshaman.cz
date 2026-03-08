import React, { useState } from 'react';
import {
  Briefcase,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Search,
  Sparkles,
  Sun,
  UserCircle,
  X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CompanyProfile, UserProfile, ViewState } from '../types';
import { getRecruiterCompany } from '../services/supabaseService';
import { cn } from './ui/primitives';

interface AppHeaderProps {
  viewState: ViewState;
  setViewState: (view: ViewState) => void;
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
  discoverySearchMode?: boolean;
  onOpenInsights?: () => void;
  onOpenDiscoverySearch?: () => void;
  setDiscoverySearchMode?: (active: boolean) => void;
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
  companyProfile,
  setCompanyProfile,
  handleAuthAction,
  toggleTheme,
  theme,
  setIsOnboardingCompany,
  onIntentionalListClick,
  discoveryLane = 'challenges',
  setDiscoveryLane,
  discoverySearchMode = false,
  onOpenInsights,
  onOpenDiscoverySearch,
  setDiscoverySearchMode
}) => {
  const { t, i18n } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [legalMenuOpen, setLegalMenuOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const isCsLike = locale === 'cs' || locale === 'sk';
  const canShowBusinessMenu = showCompanyLanding || !userProfile.isLoggedIn || userProfile.role === 'recruiter';
  const insightsLabel =
    locale === 'cs' || locale === 'sk'
      ? 'Články'
      : locale === 'de' || locale === 'at'
        ? 'Artikel'
        : locale === 'pl'
          ? 'Artykuły'
          : 'Articles';

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
    setDiscoverySearchMode?.(false);
    setViewState(ViewState.LIST);
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
  };

  const openDiscoveryLane = (lane: 'challenges' | 'imports', focusSearch = false) => {
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
    setViewState(ViewState.LIST);
    setDiscoveryLane?.(lane);
    setDiscoverySearchMode?.(focusSearch);
    if (focusSearch) {
      onOpenDiscoverySearch?.();
      return;
    }
    scrollToElement('challenge-discovery');
  };

  const navItems = [
    {
      key: 'overview',
      label: isCsLike ? 'Úvod' : 'Overview',
      active: !showCompanyLanding && !isBlogOpen && viewState === ViewState.LIST && discoveryLane === 'challenges' && !discoverySearchMode,
      onClick: openHomeOverview
    },
    {
      key: 'search',
      label: isCsLike ? 'Hledání a filtry' : 'Search and filters',
      active: !showCompanyLanding && viewState === ViewState.LIST && discoveryLane === 'challenges' && discoverySearchMode,
      onClick: () => openDiscoveryLane('challenges', true)
    },
    {
      key: 'saved',
      label: isCsLike ? 'Uložené' : 'Saved',
      active: viewState === ViewState.SAVED,
      onClick: () => {
        if (leaveDemoHandshakeRoute('ulozene')) return;
        setShowCompanyLanding(false);
        setIsOnboardingCompany(false);
        setIsBlogOpen?.(false);
        setDiscoverySearchMode?.(false);
        setViewState(ViewState.SAVED);
        setSelectedJobId(null);
        setSelectedBlogPostSlug?.(null);
      }
    },
    {
      key: 'imports',
      label: isCsLike ? 'Importované nabídky' : 'Imported listings',
      active: !showCompanyLanding && viewState === ViewState.LIST && discoveryLane === 'imports',
      onClick: () => openDiscoveryLane('imports')
    }
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
    onIntentionalListClick?.();
    setDiscoveryLane?.('challenges');
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

  const handleBusinessClick = async () => {
    if (showCompanyLanding) {
      setShowCompanyLanding(false);
      setIsBlogOpen?.(false);
      setSelectedBlogPostSlug?.(null);
      setDiscoverySearchMode?.(false);
      setViewState(ViewState.LIST);
      return;
    }

    if (!userProfile.isLoggedIn || userProfile.role !== 'recruiter') {
      setShowCompanyLanding(true);
      return;
    }

    if (companyProfile) {
      setIsBlogOpen?.(false);
      setSelectedBlogPostSlug?.(null);
      setDiscoverySearchMode?.(false);
      setViewState(ViewState.COMPANY_DASHBOARD);
      return;
    }

    if (userProfile.id) {
      try {
        const resolvedCompany = await getRecruiterCompany(userProfile.id);
        if (resolvedCompany) {
          setCompanyProfile(resolvedCompany);
          setIsOnboardingCompany(false);
          setIsBlogOpen?.(false);
          setSelectedBlogPostSlug?.(null);
          setDiscoverySearchMode?.(false);
          setViewState(ViewState.COMPANY_DASHBOARD);
          return;
        }
      } catch (error) {
        console.warn('Failed to resolve recruiter company before onboarding:', error);
      }
    }

    setIsOnboardingCompany(true);
  };

  const activePill = 'bg-[var(--accent-soft)] text-[var(--accent)] border-[rgba(var(--accent-rgb),0.18)]';
  const inactivePill = 'text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-white/70 border-transparent';
  const searchPlaceholder = isCsLike
    ? 'Hledat nabídky, firmy nebo důležité signály'
    : 'Search roles, companies, or key signals';
  const searchLabel = isCsLike ? 'Hledání a filtry' : 'Search and filters';

  return (
    <header className="sticky top-0 z-50 w-full px-3 pt-2.5 sm:px-5 lg:px-6">
      <div className="app-topnav mx-auto max-w-[1680px] rounded-[1.5rem] border px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={navigateToShellHome}
            className="flex min-w-0 items-center gap-2.5 rounded-[1.1rem] px-2 py-1 text-left transition hover:bg-white/60 dark:hover:bg-white/5"
          >
            <img src="/logo-alt.png" alt="JobShaman" className="h-10 w-auto object-contain sm:h-11" />
            <div className="hidden min-w-0 sm:block">
              <div className="text-lg font-semibold tracking-[-0.045em] text-[var(--text-strong)] sm:text-[1.35rem]">
                <span>Job</span>
                <span className="text-[var(--accent)]">Shaman</span>
              </div>
            </div>
          </button>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setLanguageMenuOpen((prev) => !prev);
                  setLegalMenuOpen(false);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-white/60 px-3 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
              >
                <img
                  src={`https://flagcdn.com/w20/${languages.find((lang) => lang.code === i18n.language)?.flagCode || 'cz'}.png`}
                  alt=""
                  className="h-3 w-4 rounded-sm"
                  loading="lazy"
                />
                {(languages.find((lang) => lang.code === i18n.language)?.name || i18n.language || '').toUpperCase()}
                <ChevronDown size={14} className="text-[var(--text-faint)]" />
              </button>
              {languageMenuOpen ? (
                <div className="absolute right-0 mt-2 w-36 rounded-[1.1rem] border border-[var(--border)] bg-[var(--surface-elevated)] p-2 shadow-[var(--shadow-overlay)]">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        changeLanguage(lang.code);
                        setLanguageMenuOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition',
                        i18n.language === lang.code
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'text-[var(--text)] hover:bg-[var(--surface-muted)]'
                      )}
                    >
                      <img
                        src={`https://flagcdn.com/w20/${lang.flagCode}.png`}
                        alt=""
                        className="h-3 w-4 rounded-sm"
                        loading="lazy"
                      />
                      {lang.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-white/60 text-[var(--text)] transition hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
              title={t('header.toggle_theme')}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {canShowBusinessMenu ? (
              <button
                type="button"
                onClick={() => {
                  const businessTarget = userProfile.isLoggedIn && userProfile.role === 'recruiter'
                    ? 'company-dashboard'
                    : 'pro-firmy';
                  if (leaveDemoHandshakeRoute(businessTarget)) return;
                  void handleBusinessClick();
                }}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold transition whitespace-nowrap',
                  showCompanyLanding || viewState === ViewState.COMPANY_DASHBOARD ? activePill : inactivePill
                )}
              >
                <Briefcase size={15} />
                <span className="hidden xl:inline">{showCompanyLanding ? t('nav.back') : t('nav.for_companies')}</span>
              </button>
            ) : null}

            {userProfile.isLoggedIn ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (leaveDemoHandshakeRoute('profile')) return;
                    setShowCompanyLanding(false);
                    setIsOnboardingCompany(false);
                    setIsBlogOpen?.(false);
                    setDiscoverySearchMode?.(false);
                    setViewState(ViewState.PROFILE);
                    setSelectedJobId(null);
                    setSelectedBlogPostSlug?.(null);
                  }}
                  className="flex items-center gap-3 rounded-[1.1rem] border border-[var(--border-subtle)] bg-white/70 px-3 py-2 text-left transition hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
                >
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
                    {userProfile.photo && !avatarFailed ? (
                      <img
                        src={userProfile.photo}
                        alt={userProfile.name}
                        className="h-full w-full object-cover"
                        onError={() => setAvatarFailed(true)}
                      />
                    ) : (
                      <span>{userProfile.name?.charAt(0) || 'U'}</span>
                    )}
                  </div>
                  <div className="hidden min-w-0 2xl:block">
                    <div className="truncate text-sm font-semibold text-[var(--text-strong)]">{userProfile.name}</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleAuthAction()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-white/60 text-[var(--text)] transition hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
                  title={t('header.logout')}
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAuthAction('login')}
                  className="app-button-secondary !px-3.5 !py-2.5"
                >
                  <UserCircle size={16} />
                  {t('auth.login_button')}
                </button>
                <button
                  type="button"
                  onClick={() => handleAuthAction('register')}
                  className="app-button-primary !px-3.5 !py-2.5"
                >
                  <Sparkles size={16} />
                  {t('auth.register_button')}
                </button>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={onOpenDiscoverySearch}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-white/60 text-[var(--text)]"
            >
              <Search size={16} />
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-white/60 text-[var(--text)]"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        <div className="mt-2.5 hidden items-center gap-3 border-t border-[var(--border-subtle)] pt-2.5 lg:flex">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)] xl:block">
                {searchLabel}
              </div>
              <button
                type="button"
                onClick={onOpenDiscoverySearch}
                className="app-command-field min-w-0 flex-1 justify-between"
              >
                <span className="inline-flex min-w-0 items-center gap-3">
                  <Search size={16} className="text-[var(--text-faint)]" />
                  <span className="min-w-0 truncate text-left text-[var(--text-muted)]">
                    {searchPlaceholder}
                  </span>
                </span>
                <span className="rounded-md border border-[var(--border-subtle)] bg-white/70 px-2 py-1 font-mono text-[11px] text-[var(--text-faint)] dark:bg-white/5">
                  /
                </span>
              </button>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className={cn(
                  'rounded-full border px-3 py-2 text-sm font-semibold transition whitespace-nowrap',
                  item.active ? activePill : inactivePill
                )}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                navigateToShellHome();
                onOpenInsights?.();
              }}
              className={cn(
                'rounded-full border px-3 py-2 text-sm font-semibold transition whitespace-nowrap',
                isBlogOpen ? activePill : inactivePill
              )}
            >
              {insightsLabel}
            </button>
          </nav>
        </div>

        {mobileMenuOpen ? (
          <div className="mt-2.5 border-t border-[var(--border-subtle)] pt-2.5 lg:hidden">
            <div className="grid gap-2">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    item.onClick();
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    'rounded-[1rem] border px-4 py-3 text-left text-sm font-semibold transition',
                    item.active ? activePill : 'bg-white/55 text-[var(--text)] border-[var(--border-subtle)]'
                  )}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  navigateToShellHome();
                  onOpenInsights?.();
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  'rounded-[1rem] border px-4 py-3 text-left text-sm font-semibold transition',
                  isBlogOpen ? activePill : 'bg-white/55 text-[var(--text)] border-[var(--border-subtle)]'
                )}
              >
                {insightsLabel}
              </button>
              {canShowBusinessMenu ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleBusinessClick();
                    setMobileMenuOpen(false);
                  }}
                  className="rounded-[1rem] border border-[var(--border-subtle)] bg-white/55 px-4 py-3 text-left text-sm font-semibold text-[var(--text)]"
                >
                  {showCompanyLanding ? t('nav.back') : t('nav.for_companies')}
                </button>
              ) : null}
            </div>

            <div className="mt-3 grid gap-2 border-t border-[var(--border-subtle)] pt-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setLegalMenuOpen((prev) => !prev);
                    setLanguageMenuOpen(false);
                  }}
                  className="w-full rounded-[1rem] border border-[var(--border-subtle)] bg-white/55 px-4 py-3 text-left text-sm font-semibold text-[var(--text)]"
                >
                  {t('header.more')}
                </button>
                {legalMenuOpen ? (
                  <div className="mt-2 rounded-[1rem] border border-[var(--border-subtle)] bg-white/70 p-2 dark:bg-white/5">
                    <a
                      href="/podminky-uziti"
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl px-3 py-2 text-sm text-[var(--text)] transition hover:bg-[var(--surface-muted)]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {t('footer.terms')}
                    </a>
                    <a
                      href="/ochrana-osobnich-udaju"
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl px-3 py-2 text-sm text-[var(--text)] transition hover:bg-[var(--surface-muted)]"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {t('footer.privacy')}
                    </a>
                  </div>
                ) : null}
              </div>
              <select
                value={i18n.language}
                onChange={(event) => changeLanguage(event.target.value)}
                className="rounded-[1rem] border border-[var(--border-subtle)] bg-white/55 px-4 py-3 text-sm text-[var(--text)] dark:bg-white/5"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-[1rem] border border-[var(--border-subtle)] bg-white/55 px-4 py-3 text-left text-sm font-semibold text-[var(--text)]"
              >
                {theme === 'dark' ? (isCsLike ? 'Světlý režim' : 'Light mode') : (isCsLike ? 'Tmavý režim' : 'Dark mode')}
              </button>
              {userProfile.isLoggedIn ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompanyLanding(false);
                      setIsOnboardingCompany(false);
                      setViewState(ViewState.PROFILE);
                      setSelectedJobId(null);
                      setMobileMenuOpen(false);
                    }}
                    className="rounded-[1rem] border border-[var(--border-subtle)] bg-white/55 px-4 py-3 text-left text-sm font-semibold text-[var(--text)]"
                  >
                    {t('nav.profile')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleAuthAction();
                      setMobileMenuOpen(false);
                    }}
                    className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
                  >
                    {t('header.logout')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleAuthAction('login');
                      setMobileMenuOpen(false);
                    }}
                    className="app-button-secondary justify-start"
                  >
                    {t('auth.login_button')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleAuthAction('register');
                      setMobileMenuOpen(false);
                    }}
                    className="app-button-primary justify-start"
                  >
                    {t('auth.register_button')}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default AppHeader;
