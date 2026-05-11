import React from 'react';
import { 
  Search, 
  Loader2, 
  UserCircle2, 
  LogOut 
} from 'lucide-react';
import { cn } from '../cn';
import type { CompanyProfile, UserProfile } from '../../types';
import type { 
  CandidatePreferenceProfile, 
  MarketplaceFilters, 
  Role 
} from '../models';
import { BrandMark, LanguageSwitcher, ThemeToggle } from '../ui/RebuildChrome';
import {
  appHeaderChromeClass,
  appHeaderShellClass,
  headerProfileChipClass,
  segmentedControlClass,
  topBarSearchClass,
  secondaryButtonClass,
  primaryButtonClass,
} from '../ui/shellStyles';
import type { AuthIntent } from '../authTypes';

const MARKETPLACE_LOGO_FALLBACK = '/logo-alt.png';

const buildImageCandidates = (sources: Array<string | null | undefined>): string[] =>
  Array.from(new Set(sources.map((source) => String(source || '').trim()).filter(Boolean)));

const ResilientImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement> & {
  fallbackSrcs?: Array<string | null | undefined>;
}> = ({ src, fallbackSrcs = [], alt = '', onError, ...props }) => {
  const sources = React.useMemo(
    () => buildImageCandidates([src, ...fallbackSrcs]),
    [fallbackSrcs, src],
  );
  const [sourceIndex, setSourceIndex] = React.useState(0);

  React.useEffect(() => {
    setSourceIndex(0);
  }, [sources]);

  if (sources.length === 0) return null;

  return (
    <img
      {...props}
      src={sources[Math.min(sourceIndex, sources.length - 1)]}
      alt={alt}
      onError={(event) => {
        if (sourceIndex < sources.length - 1) {
          setSourceIndex((current) => Math.min(current + 1, sources.length - 1));
          return;
        }
        onError?.(event);
      }}
    />
  );
};

export const CandidateTopBar: React.FC<{
  currentPath: string;
  navigate: (path: string) => void;
  userProfile: UserProfile;
  companyProfile: CompanyProfile | null;
  searchValue: string;
  searchBusy: boolean;
  onSearchChange: (value: string) => void;
  filters?: MarketplaceFilters;
  marketplaceRoles?: Role[];
  preferences?: CandidatePreferenceProfile;
  onFiltersChange?: (updater: React.SetStateAction<MarketplaceFilters>) => void;
  onResetFilters?: () => void;
  onOpenAuth: (intent: AuthIntent) => void;
  onSignOut: () => void;
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
  i18n: { language: string; changeLanguage: (lng: string) => Promise<unknown> };
}> = ({ currentPath, navigate, userProfile, companyProfile, searchValue, searchBusy, onSearchChange, filters: _filters, marketplaceRoles: _marketplaceRoles = [], preferences: _preferences, onFiltersChange: _onFiltersChange, onResetFilters: _onResetFilters, onOpenAuth, onSignOut, t, i18n }) => {
  const userIdentityFallbacks = buildImageCandidates([MARKETPLACE_LOGO_FALLBACK, '/logo.png']);
  const showMarketplaceSearch = currentPath === '/candidate/marketplace' || currentPath === '/marketplace';

  const navItems = [
    { label: t('rebuild.nav.marketplace', { defaultValue: 'Marketplace' }), path: '/candidate/marketplace' },
    { label: t('rebuild.nav.profile_insights', { defaultValue: 'Profile & Insights' }), path: '/candidate/insights' },
    { label: t('rebuild.nav.work_profile', { defaultValue: 'Work profile' }), path: '/candidate/jcfpm' },
    { label: companyProfile ? t('rebuild.nav.recruiter_os', { defaultValue: 'For companies' }) : t('rebuild.nav.recruiter', { defaultValue: 'For companies' }), path: companyProfile ? '/recruiter' : '/firmy' },
  ];

  return (
    <div className={appHeaderChromeClass}>
      <div className="mx-auto flex w-full max-w-[1600px] flex-col">
        <div className={appHeaderShellClass}>
          <div className="flex min-w-0 items-center gap-6">
            <button type="button" onClick={() => navigate('/candidate/insights')} className="text-left">
              <BrandMark subtitle={t('rebuild.nav.candidate_area', { defaultValue: 'For candidates' })} compact />
            </button>
            <div className={cn(segmentedControlClass, 'hidden max-w-full lg:flex')}>
              {navItems.map((item) => {
                const active = item.path === '/candidate/marketplace'
                  ? currentPath === '/candidate/marketplace' || currentPath === '/marketplace' || currentPath.startsWith('/candidate/role/') || currentPath.startsWith('/candidate/imported/') || currentPath.startsWith('/candidate/journey/')
                  : currentPath === item.path || currentPath.startsWith(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={cn('inline-flex h-9 items-center rounded-full px-5 text-sm font-medium transition whitespace-nowrap', active ? 'bg-[#12AFCB] text-white' : 'text-slate-500 hover:text-slate-900')}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className={cn(segmentedControlClass, 'w-full justify-start overflow-x-auto lg:hidden')}>
              {navItems.map((item) => {
                const active = item.path === '/'
                  ? currentPath === '/' || currentPath.startsWith('/candidate/role/') || currentPath.startsWith('/candidate/imported/') || currentPath.startsWith('/candidate/journey/')
                  : currentPath === item.path || currentPath.startsWith(item.path);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className={cn('inline-flex h-9 items-center rounded-full px-5 text-sm font-medium transition whitespace-nowrap', active ? 'bg-[#12AFCB] text-white' : 'text-slate-500 hover:text-slate-900')}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {showMarketplaceSearch ? (
              <label className={cn(topBarSearchClass, 'hidden min-w-[18rem] max-w-[26rem] flex-1 lg:flex')}>
                <Search size={16} className="text-[color:var(--shell-accent-cyan)]" />
                <input
                  value={searchValue}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder={t('rebuild.search_placeholder', { defaultValue: 'Search roles, firms and candidate signals' })}
                  className="w-full bg-transparent text-sm text-[color:var(--shell-text-primary)] outline-none placeholder:text-[color:var(--shell-text-subtle)]"
                />
                {searchBusy ? <Loader2 size={14} className="animate-spin text-[color:var(--shell-accent-cyan)]" /> : null}
              </label>
            ) : null}
            <ThemeToggle />
            <LanguageSwitcher i18n={i18n} />
            {userProfile.isLoggedIn ? (
              <div className={cn(headerProfileChipClass, 'shrink-0')}>
                <button type="button" onClick={() => navigate('/candidate/insights')} className="inline-flex h-9 items-center gap-2 rounded-[14px] px-2.5 text-left">
                  {userProfile.photo ? (
                    <ResilientImage src={userProfile.photo} fallbackSrcs={userIdentityFallbacks} alt={userProfile.name} className="h-7 w-7 rounded-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <UserCircle2 size={14} />
                    </span>
                  )}
                  <span className="hidden text-sm font-semibold text-slate-900 md:inline">{userProfile.name || userProfile.email || t('rebuild.profile_label', { defaultValue: 'Profile' })}</span>
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  aria-label={t('rebuild.sign_out', { defaultValue: 'Sign out' })}
                  title={t('rebuild.sign_out', { defaultValue: 'Sign out' })}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] text-rose-600 transition hover:bg-rose-50 hover:text-rose-700"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <>
                <button type="button" onClick={() => onOpenAuth('candidate')} className={secondaryButtonClass}>{t('rebuild.candidate_sign_in', { defaultValue: 'Candidate sign in' })}</button>
                <button type="button" onClick={() => onOpenAuth('recruiter')} className={primaryButtonClass}>{t('rebuild.recruiter_sign_in', { defaultValue: 'Recruiter sign in' })}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
