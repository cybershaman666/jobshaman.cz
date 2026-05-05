import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  Coins,
  Compass,
  ExternalLink,
  Gauge,
  Loader2,
  MapPin,
  LogOut,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  WalletCards,
  UserCircle2,
  X,
} from 'lucide-react';

import type { CompanyProfile, DialogueSummary, UserProfile } from '../../types';
import { computeArchetype, fetchJcfpmItems, submitJcfpm } from '../../services/v2JcfpmService';
import { clearJcfpmDraft, readJcfpmDraft, writeJcfpmDraft } from '../../services/jcfpmSessionState';
import { evaluateRole, roleMatchesDiscovery } from '../intelligence';
import type {
  CandidatePreferenceProfile,
  Company,
  HandshakeBlueprint,
  JcfpmQuestion,
  JCFPMSession,
  MarketplaceFilters,
  Role,
} from '../models';
import { resolveCompany } from '../shellDomain';
import { getApplicationStatusCopy } from '../status';
import { BrandMark, LanguageSwitcher, ThemeToggle } from '../ui/ShellChrome';
import {
  appHeaderChromeClass,
  appHeaderShellClass,
  fieldClass,
  headerProfileChipClass,
  panelClass,
  pillEyebrowClass,
  primaryButtonClass,
  secondaryButtonClass,
  segmentedControlClass,
  shellPageClass,
  topBarSearchClass,
} from '../ui/shellStyles';
import { cn } from '../cn';
import type { AuthIntent } from '../authTypes';
import { getStockCoverCandidatesForDomain } from '../../utils/domainCoverImages';
import {
  CandidateShellSurface,
  CompactActionButton,
  SectionEyebrow,
  ShellCard,
} from './CandidateShellSurface';

const MARKETPLACE_IMAGE_FALLBACK = '/hero-panorama.png';
const MARKETPLACE_LOGO_FALLBACK = '/logo-alt.png';
const JCFPM_DRAFT_SCOPE = 'candidate-profile';
const PINNED_MARKETPLACE_BENEFITS = [
  'Accommodation',
  'Dog-friendly office',
  'Child-friendly office',
] as const;

const normalizeBenefitToken = (value: string) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/children/g, 'child')
    .replace(/kids/g, 'child')
    .replace(/friendly/g, 'friendly')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const benefitFilterAliases = (value: string): string[] => {
  const normalized = normalizeBenefitToken(value);
  if (!normalized) return [];
  if (normalized.includes('accommodation') || normalized.includes('ubytovani') || normalized.includes('ubytovanie')) {
    return ['accommodation', 'housing', 'relocation support', 'relocation package', 'ubytovani', 'ubytovanie'];
  }
  if (normalized.includes('dog') && normalized.includes('friendly')) {
    return ['dog friendly office', 'dogfriendly office', 'dog friendly', 'dogfriendly'];
  }
  if (normalized.includes('child') && normalized.includes('friendly')) {
    return [
      'child friendly office',
      'childfriendly office',
      'children friendly office',
      'childrenfriendly office',
      'child friendly',
      'children friendly',
      'kid friendly office',
      'kids friendly office',
      'kid friendly',
      'kids friendly',
      'family friendly office',
    ];
  }
  return [normalized];
};

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

const MarketplaceActiveFilters: React.FC<{
  filters: MarketplaceFilters;
  activeFilterCount: number;
  t: (key: string, opts: { defaultValue: string }) => string;
}> = ({ filters, activeFilterCount, t }) => {
  if (activeFilterCount === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {filters.city.trim() ? <span className="rounded-full border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] px-3 py-1.5 text-xs font-medium text-[color:var(--shell-text-secondary)]">{t('rebuild.marketplace.current_city', { defaultValue: 'City' })}: {filters.city.trim()}</span> : null}
      <span className="rounded-full border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] px-3 py-1.5 text-xs font-medium text-[color:var(--shell-text-secondary)]">{t('rebuild.marketplace.current_radius', { defaultValue: 'Radius' })}: {filters.radiusKm} km</span>
      <span className="rounded-full border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] px-3 py-1.5 text-xs font-medium text-[color:var(--shell-text-secondary)]">{t('rebuild.marketplace.current_market', { defaultValue: 'Market scope' })}: {filters.crossBorder ? t('rebuild.marketplace.market_scope_cross_border', { defaultValue: 'Cross-border' }) : t('rebuild.marketplace.market_scope_domestic', { defaultValue: 'Domestic' })}</span>
      {filters.curatedOnly ? <span className="rounded-full border border-[color:color-mix(in_srgb,var(--shell-accent-cyan)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--shell-accent-cyan)_12%,transparent)] px-3 py-1.5 text-xs font-medium text-[color:var(--shell-accent-cyan)]">{t('rebuild.marketplace.curated_only', { defaultValue: 'Curated only' })}</span> : null}
      {filters.benefits.slice(0, 3).map((benefit) => <span key={benefit} className="rounded-full border border-[color:color-mix(in_srgb,var(--shell-accent-cyan)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--shell-accent-cyan)_12%,transparent)] px-3 py-1.5 text-xs font-medium text-[color:var(--shell-accent-cyan)]">{benefit}</span>)}
    </div>
  );
};

const MarketplaceFilterControls: React.FC<{
  filters: MarketplaceFilters;
  onFiltersChange: (updater: React.SetStateAction<MarketplaceFilters>) => void;
  navigate: (path: string) => void;
  benefitOptions: string[];
  compact?: boolean;
  t: (key: string, opts: { defaultValue: string }) => string;
}> = ({ filters, onFiltersChange, navigate, benefitOptions, compact = false, t }) => (
  <>
    <div className={cn('space-y-4', !compact && 'xl:grid xl:grid-cols-[1.2fr_1fr] xl:gap-4 xl:space-y-0')}>
      <label className="block text-sm font-medium text-[color:var(--shell-text-secondary)]">
        {t('rebuild.marketplace.city_filter', { defaultValue: 'City' })}
        <div className="relative">
          <MapPin size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--shell-text-tertiary)]" />
          <input value={filters.city} onChange={(event) => onFiltersChange((current) => ({ ...current, city: event.target.value }))} placeholder={t('rebuild.marketplace.city_placeholder', { defaultValue: 'Prague, Brno, Berlin...' })} className={cn(fieldClass, 'pl-10')} />
        </div>
      </label>
      <label className="block text-sm font-medium text-[color:var(--shell-text-secondary)]">
        {t('rebuild.marketplace.role_family', { defaultValue: 'Domain' })}
        <select value={filters.roleFamily} onChange={(event) => onFiltersChange((current) => ({ ...current, roleFamily: event.target.value as MarketplaceFilters['roleFamily'] }))} className={cn(fieldClass, 'truncate pr-10')}>
          <option value="all">{t('rebuild.marketplace.role_family_all', { defaultValue: 'All domains' })}</option>
          <option value="engineering">{t('rebuild.marketplace.role_family_engineering', { defaultValue: 'Engineering' })}</option>
          <option value="design">{t('rebuild.marketplace.role_family_design', { defaultValue: 'Design' })}</option>
          <option value="product">{t('rebuild.marketplace.role_family_product', { defaultValue: 'Product' })}</option>
          <option value="operations">{t('rebuild.marketplace.role_family_operations', { defaultValue: 'Operations' })}</option>
          <option value="sales">{t('rebuild.marketplace.role_family_sales', { defaultValue: 'Sales' })}</option>
          <option value="care">{t('rebuild.marketplace.role_family_care', { defaultValue: 'People & Care' })}</option>
          <option value="frontline">{t('rebuild.marketplace.role_family_frontline', { defaultValue: 'Frontline' })}</option>
        </select>
      </label>
      <label className="block text-sm font-medium text-[color:var(--shell-text-secondary)]">
        {t('rebuild.marketplace.work_arrangement', { defaultValue: 'Work model' })}
        <select
          value={filters.remoteOnly ? 'remote' : filters.workArrangement}
          onChange={(event) => {
            const next = event.target.value as MarketplaceFilters['workArrangement'];
            onFiltersChange((current) => ({
              ...current,
              remoteOnly: next === 'remote',
              workArrangement: next === 'remote' ? 'all' : next,
            }));
          }}
          className={cn(fieldClass, 'truncate pr-10')}
        >
          <option value="all">{t('rebuild.marketplace.work_arrangement_all', { defaultValue: 'All models' })}</option>
          <option value="remote">{t('rebuild.marketplace.work_arrangement_remote', { defaultValue: 'Remote only' })}</option>
          <option value="hybrid">{t('rebuild.marketplace.work_arrangement_hybrid', { defaultValue: 'Hybrid' })}</option>
          <option value="onsite">{t('rebuild.marketplace.work_arrangement_onsite', { defaultValue: 'On-site' })}</option>
        </select>
      </label>
      <label className="block text-sm font-medium text-[color:var(--shell-text-secondary)]">
        {t('rebuild.marketplace.radius', { defaultValue: 'Commute radius' })}
        <select value={String(filters.radiusKm)} onChange={(event) => onFiltersChange((current) => ({ ...current, radiusKm: Number(event.target.value) }))} className={cn(fieldClass, 'truncate pr-10')}>
          {[15, 25, 35, 50, 80, 120, 180].map((radius) => <option key={radius} value={radius}>{radius} km</option>)}
        </select>
      </label>
    </div>
    <div className="mt-5 grid gap-2">
      <button type="button" onClick={() => onFiltersChange((current) => ({ ...current, curatedOnly: !current.curatedOnly }))} className={cn(secondaryButtonClass, 'w-full justify-between px-4 py-3 text-left', filters.curatedOnly && 'border-[color:color-mix(in_srgb,var(--shell-accent-cyan)_44%,transparent)] bg-[image:linear-gradient(135deg,color-mix(in_srgb,var(--shell-accent-cyan)_28%,transparent),color-mix(in_srgb,var(--shell-accent)_16%,transparent))] text-[color:var(--shell-text-primary)] hover:bg-[image:linear-gradient(135deg,color-mix(in_srgb,var(--shell-accent-cyan)_36%,transparent),color-mix(in_srgb,var(--shell-accent)_22%,transparent))]')}>
        {t('rebuild.marketplace.curated_only', { defaultValue: 'Curated only' })}
      </button>
      <button type="button" onClick={() => onFiltersChange((current) => ({ ...current, crossBorder: !current.crossBorder }))} className={cn(secondaryButtonClass, 'w-full justify-between px-4 py-3 text-left', filters.crossBorder && 'border-[color:color-mix(in_srgb,var(--shell-accent)_42%,transparent)] bg-[image:linear-gradient(135deg,color-mix(in_srgb,var(--shell-accent)_26%,transparent),color-mix(in_srgb,var(--shell-accent-cyan)_14%,transparent))] text-[color:var(--shell-text-primary)] hover:bg-[image:linear-gradient(135deg,color-mix(in_srgb,var(--shell-accent)_34%,transparent),color-mix(in_srgb,var(--shell-accent-cyan)_20%,transparent))]')}>
        {filters.crossBorder ? t('rebuild.marketplace.cross_border_on', { defaultValue: 'Cross-border on' }) : t('rebuild.marketplace.cross_border_off', { defaultValue: 'Domestic only' })}
      </button>
      <button type="button" onClick={() => navigate('/candidate/jcfpm')} className={cn(secondaryButtonClass, 'w-full justify-between px-4 py-3 text-left')}>
        {t('rebuild.marketplace.launch_jcfpm', { defaultValue: 'Launch JCFPM' })}
      </button>
    </div>
    {benefitOptions.length > 0 ? (
      <div className="mt-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--shell-text-tertiary)]">{t('rebuild.marketplace.benefits', { defaultValue: 'Benefits' })}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {benefitOptions.map((benefit) => {
            const active = filters.benefits.includes(benefit);
            return (
              <button
                key={benefit}
                type="button"
                onClick={() => onFiltersChange((current) => ({
                  ...current,
                  benefits: current.benefits.includes(benefit)
                    ? current.benefits.filter((item) => item !== benefit)
                    : [...current.benefits, benefit],
                }))}
                className={cn(
                  'max-w-full truncate rounded-full border px-3 py-2 text-xs font-semibold transition',
                  active
                    ? 'border-[color:color-mix(in_srgb,var(--shell-accent)_40%,transparent)] bg-[image:linear-gradient(135deg,color-mix(in_srgb,var(--shell-accent)_34%,transparent),color-mix(in_srgb,var(--shell-accent-cyan)_18%,transparent))] text-[color:var(--shell-text-primary)] shadow-[0_18px_32px_-24px_color-mix(in_srgb,var(--shell-accent)_45%,transparent)]'
                    : 'border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] text-[color:var(--shell-text-secondary)] hover:border-[color:var(--shell-panel-border-strong)] hover:text-[color:var(--shell-text-primary)]',
                )}
                title={benefit}
              >
                {benefit}
              </button>
            );
          })}
        </div>
      </div>
    ) : null}
  </>
);

const MarketplaceFilterPanel: React.FC<{
  filters: MarketplaceFilters;
  onFiltersChange: (updater: React.SetStateAction<MarketplaceFilters>) => void;
  onResetFilters: () => void;
  navigate: (path: string) => void;
  benefitOptions: string[];
  t: (key: string, opts: { defaultValue: string }) => string;
  className?: string;
  compact?: boolean;
}> = ({ filters, onFiltersChange, onResetFilters, navigate, benefitOptions, t, className, compact = false }) => (
  <div className={cn(panelClass, 'min-w-0 rounded-[28px] p-5', 'shrink-0', className)}>
    <div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--shell-text-tertiary)]">{t('rebuild.marketplace.filters_title', { defaultValue: 'Search controls' })}</div>
        <div className="mt-2 text-sm leading-6 text-[color:var(--shell-text-secondary)]">{t('rebuild.marketplace.filters_subtitle', { defaultValue: 'Refine roles by place, domain and work setup.' })}</div>
      </div>
      <button type="button" onClick={onResetFilters} className={cn(secondaryButtonClass, 'mt-4 w-full justify-center')}>
        <X size={14} />
        {t('rebuild.marketplace.reset_filters', { defaultValue: 'Reset filters' })}
      </button>
    </div>
    <div className="mt-5">
      <MarketplaceFilterControls
        filters={filters}
        onFiltersChange={onFiltersChange}
        navigate={navigate}
        benefitOptions={benefitOptions}
        compact={compact}
        t={t}
      />
    </div>
  </div>
);

const MarketplaceSearchPanel: React.FC<{
  searchValue: string;
  loading: boolean;
  onSearchChange: (value: string) => void;
  t: (key: string, opts: { defaultValue: string }) => string;
  className?: string;
}> = ({ searchValue, loading, onSearchChange, t, className }) => (
  <div className={cn(panelClass, 'shrink-0 p-4', className)}>
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--shell-text-tertiary)]">
      {t('rebuild.marketplace.search_label', { defaultValue: 'Search marketplace' })}
    </div>
    <label className={cn(topBarSearchClass, 'mt-3 border-[color:color-mix(in_srgb,var(--shell-accent-cyan)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--shell-button-secondary-bg)_82%,transparent)] px-4 py-3 shadow-[0_18px_44px_-32px_color-mix(in_srgb,var(--shell-accent)_26%,transparent)]')}>
      <Search size={16} className="text-[color:var(--shell-accent-cyan)]" />
      <input
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t('rebuild.search_placeholder', { defaultValue: 'Search roles, firms and candidate signals' })}
        className="w-full bg-transparent text-sm text-[color:var(--shell-text-primary)] outline-none placeholder:text-[color:var(--shell-text-subtle)]"
      />
      {loading ? <Loader2 size={14} className="animate-spin text-[color:var(--shell-accent-cyan)]" /> : null}
    </label>
  </div>
);

export const InsightBadge: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.16)]">
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
    <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-900">{value}</div>
  </div>
);

const HeroStatCard: React.FC<{
  label: string;
  value: string;
  accent?: string;
}> = ({ label, value, accent = 'bg-white/90' }) => (
  <div className={cn('min-w-0 rounded-[26px] border border-white/70 px-5 py-5 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.18)] bg-white', accent)}>
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
    <div className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.05em] text-slate-900">{value}</div>
  </div>
);

const RoleCard: React.FC<{
  role: Role;
  companyLibrary: Company[];
  onOpen: () => void;
  applicationStatus?: string;
  t?: (key: string, opts: { defaultValue: string }) => string;
}> = ({ role, companyLibrary, onOpen, applicationStatus, t }) => {
  const company = resolveCompany(role, companyLibrary);
  const statusCopy = applicationStatus ? getApplicationStatusCopy(applicationStatus, t) : null;
  const coverFallbacks = buildImageCandidates([
    role.companyCoverImage,
    company.coverImage,
    ...getStockCoverCandidatesForDomain('operations', `${role.companyName}:${role.title}`),
    MARKETPLACE_IMAGE_FALLBACK,
  ]);
  const logoFallbacks = buildImageCandidates([
    role.companyLogo,
    company.logo,
    MARKETPLACE_LOGO_FALLBACK,
    '/logo.png',
  ]);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(panelClass, 'group relative overflow-hidden text-left transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_40px_110px_-52px_rgba(15,23,42,0.35)]')}
    >
      <div className="absolute inset-0">
        <ResilientImage src={role.heroImage} fallbackSrcs={coverFallbacks} alt={role.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,15,33,0.2),rgba(5,15,33,0.78)_72%,rgba(5,15,33,0.96))]" />
      </div>
      <div className="relative flex min-h-[26rem] flex-col justify-between p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ResilientImage src={company.logo} fallbackSrcs={logoFallbacks} alt={company.name} className="h-11 w-11 rounded-2xl border border-white/12 object-cover shadow-[0_14px_32px_-20px_rgba(0,0,0,0.45)]" loading="lazy" decoding="async" />
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
              {role.source === 'curated' ? t?.('rebuild.role.full_journey', { defaultValue: 'Full Jobshaman journey' }) : t?.('rebuild.role.external_opportunity', { defaultValue: 'External opportunity' })}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {statusCopy ? <span className={cn('rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]', statusCopy.tone)}>{statusCopy.label}</span> : null}
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">{role.workModel}</span>
          </div>
        </div>
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80">{company.name}</div>
          <h3 className="mt-3 max-w-[18rem] text-[1.9rem] font-semibold leading-[1.03] tracking-[-0.05em] text-white">{role.title}</h3>
          <div className="mt-3 text-sm text-white/80">{role.location} · {role.level}</div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="text-xs text-white/76">{role.featuredInsights.join(' • ')}</div>
          <span className="rounded-full border border-[rgba(255,255,255,0.18)] bg-[linear-gradient(135deg,#ff8e78,#ff6f5b)] px-4 py-2 text-sm font-semibold text-white shadow-[0_20px_38px_-22px_rgba(255,111,91,0.72)] transition duration-300 group-hover:translate-y-[-1px] group-hover:shadow-[0_24px_44px_-22px_rgba(255,111,91,0.82)]">
            {applicationStatus ? t?.('rebuild.role.track_submission', { defaultValue: 'Track submission' }) : role.source === 'curated' ? t?.('rebuild.role.open_journey', { defaultValue: 'Open journey' }) : t?.('rebuild.role.open_prep', { defaultValue: 'Open prep' })}
          </span>
        </div>
      </div>
    </button>
  );
};



const RecommendationFitPanel: React.FC<{
  role: Role;
  t?: (key: string, opts: { defaultValue: string }) => string;
}> = ({ role, t }) => {
  const fit = role.recommendationFit;
  if (!fit) return null;

  const metrics = [
    { key: 'skill', label: t?.('rebuild.fit.skill', { defaultValue: 'Skill' }) || 'Skill', value: fit.components.skillMatch.score },
    { key: 'evidence', label: t?.('rebuild.fit.evidence', { defaultValue: 'Evidence' }) || 'Evidence', value: fit.components.evidenceQuality.score },
    { key: 'growth', label: t?.('rebuild.fit.growth', { defaultValue: 'Growth' }) || 'Growth', value: fit.components.growthPotential.score },
    { key: 'values', label: t?.('rebuild.fit.context', { defaultValue: 'Context' }) || 'Context', value: fit.components.valuesAlignment.score },
    { key: 'risk', label: t?.('rebuild.fit.risk', { defaultValue: 'Risk' }) || 'Risk', value: fit.components.riskPenalty.score, inverse: true },
  ];
  const evidence = [
    ...fit.reasons,
    ...fit.components.skillMatch.evidence,
    ...fit.components.growthPotential.evidence,
    ...fit.components.valuesAlignment.evidence,
  ].filter(Boolean).slice(0, 4);
  const caveats = [
    ...fit.caveats,
    ...fit.components.riskPenalty.caveats,
  ].filter(Boolean).slice(0, 4);

  return (
    <ShellCard className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionEyebrow><Gauge size={12} />{t?.('rebuild.fit.title', { defaultValue: 'Skill-first fit' })}</SectionEyebrow>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            {role.matchScore ? `${role.matchScore}/100` : t?.('rebuild.fit.audit_ready', { defaultValue: 'Auditable fit' })}
          </h2>
        </div>
        {fit.formula?.version ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-500">{fit.formula.version}</span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.key} className="rounded-[20px] border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{metric.label}</span>
              <span className={cn('text-sm font-bold', metric.inverse ? 'text-amber-700' : 'text-[#0f95ac]')}>{metric.value}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div className={cn('h-full rounded-full', metric.inverse ? 'bg-amber-400' : 'bg-[#12AFCB]')} style={{ width: `${Math.max(0, Math.min(100, metric.value))}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[22px] border border-[#12AFCB]/12 bg-[#12AFCB]/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CheckCircle2 size={16} className="text-[#0f95ac]" />{t?.('rebuild.fit.evidence_title', { defaultValue: 'Why it makes sense' })}</div>
          <div className="mt-3 space-y-2">
            {(evidence.length ? evidence : [t?.('rebuild.fit.no_evidence', { defaultValue: 'Fit was calculated without significant positive evidence.' }) || 'Fit was calculated without significant positive evidence.']).map((item) => (
              <div key={item} className="text-sm leading-6 text-slate-600">{item}</div>
            ))}
          </div>
        </div>
        <div className="rounded-[22px] border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><AlertTriangle size={16} className="text-amber-700" />{t?.('rebuild.fit.risk_title', { defaultValue: 'What to verify' })}</div>
          <div className="mt-3 space-y-2">
            {(caveats.length ? caveats : [t?.('rebuild.fit.no_caveats', { defaultValue: 'No significant risk signals yet.' }) || 'No significant risk signals yet.']).map((item) => (
              <div key={item} className="text-sm leading-6 text-amber-900/80">{item}</div>
            ))}
          </div>
        </div>
      </div>
    </ShellCard>
  );
};

const DetailMetaPill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
    <div className="mt-2 break-words text-sm font-semibold leading-6 text-slate-900">{value}</div>
  </div>
);

const DetailSection: React.FC<{ title: string; body: string }> = ({ title, body }) => {
  if (!body.trim()) return null;
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{body}</div>
    </div>
  );
};

const formatRoleCompensation = (role: Role, fallback: string, language?: string) => {
  if (role.salaryFrom <= 0 && role.salaryTo <= 0) return fallback;
  const locale = language === 'cs' ? 'cs-CZ' : 'en-GB';
  const from = role.salaryFrom > 0 ? role.salaryFrom.toLocaleString(locale) : role.salaryTo.toLocaleString(locale);
  const to = role.salaryTo > 0 && role.salaryTo !== role.salaryFrom ? ` - ${role.salaryTo.toLocaleString(locale)}` : '';
  return `${from}${to} ${role.currency}${role.salaryTimeframe ? ` / ${role.salaryTimeframe}` : ''}`;
};

const formatMoney = (value: number, currency: string, language?: string) => `${Math.round(value).toLocaleString(language === 'cs' ? 'cs-CZ' : 'en-GB')} ${currency}`;

const JhiNetGraph: React.FC<{
  jhi: ReturnType<typeof evaluateRole>['jhi'];
}> = ({ jhi }) => {
  const { t } = useTranslation();
  const axes = [
    { key: 'financial', label: t?.('rebuild.jhi.finance', { defaultValue: 'Finance' }) || 'Finance', value: jhi.financial },
    { key: 'timeCost', label: t?.('rebuild.jhi.time', { defaultValue: 'Time' }) || 'Time', value: jhi.timeCost },
    { key: 'mentalLoad', label: t?.('rebuild.jhi.mental', { defaultValue: 'Mental' }) || 'Mental', value: jhi.mentalLoad },
    { key: 'growth', label: t?.('rebuild.jhi.growth', { defaultValue: 'Growth' }) || 'Growth', value: jhi.growth },
    { key: 'values', label: t?.('rebuild.jhi.values', { defaultValue: 'Values' }) || 'Values', value: jhi.values },
  ] as const;
  const center = 92;
  const radius = 68;
  const points = axes.map((axis, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axes.length;
    const distance = radius * (Math.max(0, Math.min(100, axis.value)) / 100);
    return {
      ...axis,
      x: center + Math.cos(angle) * distance,
      y: center + Math.sin(angle) * distance,
      labelX: center + Math.cos(angle) * (radius + 20),
      labelY: center + Math.sin(angle) * (radius + 20),
      axisX: center + Math.cos(angle) * radius,
      axisY: center + Math.sin(angle) * radius,
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
      <div className="relative mx-auto h-[220px] w-[220px]">
        <svg viewBox="0 0 184 184" className="h-full w-full" aria-label="JHI net graph">
          {[0.25, 0.5, 0.75, 1].map((level) => {
            const ring = axes.map((_axis, index) => {
              const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axes.length;
              return `${center + Math.cos(angle) * radius * level},${center + Math.sin(angle) * radius * level}`;
            }).join(' ');
            return <polygon key={level} points={ring} fill="none" stroke="#dbe8ee" strokeWidth="1" />;
          })}
          {points.map((point) => (
            <line key={point.key} x1={center} y1={center} x2={point.axisX} y2={point.axisY} stroke="#dbe8ee" strokeWidth="1" />
          ))}
          <polygon points={polygon} fill="rgba(18,175,203,0.2)" stroke="#0f95ac" strokeWidth="3" strokeLinejoin="round" />
          {points.map((point) => (
            <circle key={point.key} cx={point.x} cy={point.y} r="4" fill="#0f95ac" stroke="white" strokeWidth="2" />
          ))}
          {points.map((point) => (
            <text key={point.key} x={point.labelX} y={point.labelY} textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-[9px] font-semibold">
              {point.label}
            </text>
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full border border-white bg-white/92 px-4 py-3 text-center shadow-sm">
            <div className="text-3xl font-semibold tracking-[-0.05em] text-slate-900">{Math.round(jhi.personalizedScore)}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">JHI</div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {axes.map((axis) => (
          <div key={axis.key} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-600">{axis.label}</span>
              <span className="text-sm font-semibold text-slate-900">{Math.round(axis.value)}/100</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#0f95ac]" style={{ width: `${Math.max(0, Math.min(100, axis.value))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RoleRealityBoard: React.FC<{
  role: Role;
  preferences: CandidatePreferenceProfile;
  t: (key: string, opts: { defaultValue: string }) => string;
}> = ({ role, preferences, t }) => {
  const { i18n } = useTranslation();
  const evaluation = React.useMemo(() => evaluateRole(role, preferences, t), [role, preferences, t]);
  const compensation = formatRoleCompensation(role, t('rebuild.detail.compensation_unknown', { defaultValue: 'Neuvedeno' }));

  const financeRows = [
    { label: t('rebuild.detail.gross_salary', { defaultValue: 'Gross salary / base' }), value: evaluation.grossMonthlySalary > 0 ? formatMoney(evaluation.grossMonthlySalary, role.currency, i18n?.language) : compensation, icon: Coins },
    { label: t('rebuild.detail.taxes_deductions', { defaultValue: 'Taxes and deductions' }), value: formatMoney(evaluation.estimatedTaxAndInsurance, role.currency, i18n?.language), icon: ShieldCheck },
    { label: t('rebuild.detail.take_home', { defaultValue: 'Take-home pay' }), value: formatMoney(evaluation.takeHomeMonthly, role.currency, i18n?.language), icon: WalletCards },
    { label: t('rebuild.detail.benefits_value', { defaultValue: 'Benefits value' }), value: formatMoney(evaluation.benefitsValue, role.currency, i18n?.language), icon: Sparkles },
    { label: t('rebuild.detail.commute_cost', { defaultValue: 'Commute costs' }), value: `-${formatMoney(evaluation.commuteMonthlyCost, role.currency, i18n?.language)}`, icon: Route },
    { label: t('rebuild.detail.real_monthly_value', { defaultValue: 'Real monthly value' }), value: formatMoney(evaluation.totalRealMonthlyValue, role.currency, i18n?.language), icon: Gauge },
  ];

  const commuteRows = [
    { label: t('rebuild.detail.distance', { defaultValue: 'Distance' }), value: evaluation.commuteDistanceKm > 0 ? `${evaluation.commuteDistanceKm.toLocaleString(i18n?.language === 'cs' ? 'cs-CZ' : 'en-GB')} km` : t('rebuild.detail.commute_unknown', { defaultValue: 'No commute / unknown' }) },
    { label: t('rebuild.detail.one_way_time', { defaultValue: 'One-way time' }), value: `${evaluation.commuteMinutesOneWay} min` },
    { label: t('rebuild.detail.monthly_costs', { defaultValue: 'Monthly costs' }), value: formatMoney(evaluation.commuteMonthlyCost, role.currency, i18n?.language) },
    { label: t('rebuild.detail.saved_commute', { defaultValue: 'Saved commute' }), value: formatMoney(evaluation.avoidedCommuteCost, role.currency, i18n?.language) },
    { label: t('rebuild.detail.transport_mode', { defaultValue: 'Transport mode' }), value: preferences.transportMode },
    { label: t('rebuild.detail.your_tolerance', { defaultValue: 'Your tolerance' }), value: preferences.commuteFilterEnabled ? `${preferences.commuteToleranceMinutes} min` : t('rebuild.detail.tolerance_off', { defaultValue: 'Off' }) },
  ];

  return (
    <ShellCard className="p-6 md:p-7">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
        <div>
          <SectionEyebrow><Gauge size={12} />{t('rebuild.detail.reality_title', { defaultValue: 'Reality check' })}</SectionEyebrow>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900 md:text-3xl">{t('rebuild.detail.reality_heading', { defaultValue: 'Real work, money, commute and energy in one view.' })}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{evaluation.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#12AFCB]/8 px-3 py-1.5 text-xs font-medium text-[#0f95ac]">{evaluation.borderFitLabel}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{role.workModel}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{role.location}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{evaluation.isContractorMode ? t('rebuild.tax.contractor', { defaultValue: 'Contractor' }) : t('rebuild.tax.employee', { defaultValue: 'Employee' })}</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <JhiNetGraph jhi={evaluation.jhi} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><WalletCards size={16} className="text-[#0f95ac]" />{t('rebuild.detail.financial_reality', { defaultValue: 'Financial reality' })}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {financeRows.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    <Icon size={13} className="text-[#0f95ac]" />
                    {metric.label}
                  </div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-slate-900">{metric.value}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-7 text-slate-600">
            {t('rebuild.detail.effective_rate', { defaultValue: 'Effective rate' })}: <strong className="text-slate-900">{evaluation.taxEffectiveRate}%</strong>. {t('rebuild.detail.jhi_impact', { defaultValue: 'Impact of benefits and commute on JHI finance' })}: <strong className={evaluation.financialScoreAdjustment >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{evaluation.financialScoreAdjustment >= 0 ? '+' : ''}{evaluation.financialScoreAdjustment} {t('rebuild.detail.points', { defaultValue: 'points' })}</strong>.
          </div>
          {evaluation.taxBreakdownDetails.length > 0 ? (
            <div className="mt-3 space-y-2">
              {evaluation.taxBreakdownDetails.slice(0, 4).map((detail) => (
                <div key={detail} className="flex items-start gap-2 text-xs leading-5 text-slate-500"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[#0f95ac]" />{detail}</div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Route size={16} className="text-[#0f95ac]" />{t('rebuild.detail.commute_reality', { defaultValue: 'Commute reality' })}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {commuteRows.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{metric.label}</div>
                <div className="mt-2 text-sm font-semibold leading-6 text-slate-900">{metric.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {evaluation.parkingWarning ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{evaluation.parkingWarning}</div>
            ) : null}
            {evaluation.isRelocation ? (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{t('rebuild.detail.relocation_warning', { defaultValue: 'This offer looks more like a relocation decision than a standard commute.' })}</div>
            ) : null}
            {!evaluation.parkingWarning && !evaluation.isRelocation ? (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900"><CheckCircle2 size={16} className="mt-0.5 shrink-0" />{t('rebuild.detail.commute_no_warning', { defaultValue: 'Commute has no special warnings from available data. Still take it as an estimate based on your profile.' })}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t('rebuild.detail.salary', { defaultValue: 'Offered salary' }), value: compensation, icon: Coins },
          { label: t('rebuild.detail.tax', { defaultValue: 'Tax regime' }), value: `${evaluation.taxRuleLabel}${evaluation.taxRuleVersion ? ` · ${evaluation.taxRuleVersion}` : ''}`, icon: ShieldCheck },
          { label: t('rebuild.detail.source', { defaultValue: 'Source' }), value: role.source === 'curated' ? t('rebuild.detail.native', { defaultValue: 'Jobshaman native' }) : t('rebuild.detail.external_import', { defaultValue: 'External import' }), icon: ExternalLink },
          { label: t('rebuild.detail.contract', { defaultValue: 'Contract' }), value: role.contractType || t('rebuild.briefing.contract_unknown', { defaultValue: 'Not specified' }), icon: Building2 },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <Icon size={14} className="text-[#0f95ac]" />
                {metric.label}
              </div>
              <div className="mt-3 text-sm font-semibold leading-6 text-slate-900">{metric.value}</div>
            </div>
          );
        })}
      </div>
    </ShellCard>
  );
};

const CompanyEncounterPanel: React.FC<{
  role: Role;
  company?: Company | null;
  t: (key: string, opts: { defaultValue: string }) => string;
}> = ({ role, company, t }) => {
  if (!company) {
    return (
      <ShellCard className="p-6">
        <SectionEyebrow><Building2 size={12} />{t('rebuild.detail.external_source_title', { defaultValue: 'Offer source' })}</SectionEyebrow>
        <div className="mt-5 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100">
            {role.companyLogo ? (
              <img src={role.companyLogo} alt="" className="h-full w-full object-contain p-2" />
            ) : (
              <Building2 size={24} className="text-slate-300" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold tracking-[-0.03em] text-slate-900">{role.companyName || t('rebuild.detail.external_source', { defaultValue: 'External source' })}</div>
            <div className="text-sm text-slate-500 uppercase tracking-wider font-bold text-[10px]">{t('rebuild.detail.imported_label', { defaultValue: 'Imported' })}</div>
          </div>
        </div>
      </ShellCard>
    );
  }

  const reviewerName = company.reviewer.name;
  const reviewerRole = company.reviewer.role;
  const intro = company.reviewer.intro || role.companyNarrative || role.importedNote || '';
  const logoFallbacks = buildImageCandidates([company.logo, role.companyLogo, MARKETPLACE_LOGO_FALLBACK, '/logo.png']);

  return (
    <ShellCard className="p-6">
      <SectionEyebrow><Users size={12} />{t('rebuild.detail.encounter_title', { defaultValue: 'Who you will meet' })}</SectionEyebrow>
      <div className="mt-5 flex items-center gap-4">
        <ResilientImage src={company.reviewer.avatarUrl || company.logo} fallbackSrcs={logoFallbacks} alt={reviewerName} className="h-16 w-16 rounded-2xl object-cover" loading="lazy" decoding="async" />
        <div>
          <div className="text-lg font-semibold tracking-[-0.03em] text-slate-900">{reviewerName}</div>
          <div className="text-sm text-slate-500">{reviewerRole}</div>
        </div>
      </div>
      {intro ? <p className="mt-5 text-sm leading-7 text-slate-600">{intro}</p> : null}
      <div className="mt-5 grid gap-3">
        <DetailMetaPill label={t('rebuild.detail.company', { defaultValue: 'Company' })} value={company.name} />
        <DetailMetaPill label={t('rebuild.detail.source', { defaultValue: 'Source' })} value={t('rebuild.detail.native', { defaultValue: 'Jobshaman native' })} />
      </div>
    </ShellCard>
  );
};

const DetailActionPanel: React.FC<{
  role: Role;
  sourceLink?: string;
  existingApplication?: DialogueSummary | null;
  isSaved: boolean;
  onToggleSaved: () => void;
  navigate: (path: string) => void;
  t: (key: string, opts: { defaultValue: string }) => string;
}> = ({ role, sourceLink, existingApplication, isSaved, onToggleSaved, navigate, t }) => {
  const { i18n } = useTranslation();
  return (
    <ShellCard className="p-6">
      <SectionEyebrow>{role.source === 'curated' ? t('rebuild.briefing.next_step', { defaultValue: 'Next step' }) : t('rebuild.detail.external_source_title', { defaultValue: 'External source' })}</SectionEyebrow>
      <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-slate-900">
        {role.source === 'curated'
          ? existingApplication
            ? t('rebuild.briefing.open_journey', { defaultValue: 'Open submitted journey' })
            : t('rebuild.briefing.start_journey', { defaultValue: 'Start branded journey' })
          : t('rebuild.prep.open_listing_title', { defaultValue: 'Original listing' })}
      </h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        {role.source === 'curated'
          ? role.firstStep
          : t('rebuild.prep.source_warning_body', { defaultValue: 'The imported offer may have changed terms. Before responding, open the original site and verify current text, validity, and contact.' })}
      </p>
      <div className="mt-5 space-y-4 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <MapPin size={16} className="shrink-0 text-slate-400" />
          <span className="font-medium">{role.location}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Clock3 size={16} className="shrink-0 text-slate-400" />
          <span className="font-medium">{role.workModel}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Coins size={16} className="shrink-0 text-slate-400" />
          <span className="font-medium">{formatRoleCompensation(role, t('rebuild.prep.compensation_unknown', { defaultValue: 'Not specified' }), i18n?.language)}</span>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {role.source === 'curated' ? (
          <button type="button" onClick={() => navigate(`/candidate/journey/${role.id}`)} className={primaryButtonClass}>
            {existingApplication ? t('rebuild.briefing.open_journey', { defaultValue: 'Open submitted journey' }) : t('rebuild.briefing.start_journey', { defaultValue: 'Start branded journey' })} <ArrowRight size={16} />
          </button>
        ) : sourceLink ? (
          <a href={sourceLink} target="_blank" rel="noreferrer" className={primaryButtonClass}>{t('rebuild.prep.open_listing', { defaultValue: 'Open source listing' })} <ExternalLink size={16} /></a>
        ) : (
          <button type="button" className={cn(primaryButtonClass, 'cursor-not-allowed opacity-60')} disabled>{t('rebuild.prep.source_missing', { defaultValue: 'Source not available' })}</button>
        )}
        <button type="button" onClick={onToggleSaved} className={secondaryButtonClass}><Star size={16} className={isSaved ? 'fill-current text-amber-500' : ''} />{isSaved ? t('rebuild.briefing.saved_role', { defaultValue: 'Saved role' }) : t('rebuild.briefing.save_role', { defaultValue: 'Save role' })}</button>
      </div>
    </ShellCard>
  );
};

const MobileSwipeMarketplace: React.FC<{
  roles: Role[];
  companyLibrary: Company[];
  savedRoleIds: string[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRoleInteraction: (roleId: string, eventType: 'swipe_left' | 'swipe_right' | 'save' | 'unsave') => void;
  navigate: (path: string) => void;
  t: (key: string, opts: { defaultValue: string }) => string;
}> = ({ roles, companyLibrary, savedRoleIds, hasMore, loadingMore, onLoadMore, onRoleInteraction, navigate, t }) => {
  const [index, setIndex] = React.useState(0);
  const [dragX, setDragX] = React.useState(0);
  const touchStartX = React.useRef<number | null>(null);

  React.useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(roles.length - 1, 0)));
  }, [roles.length]);

  const currentRole = roles[index] || null;
  const nextRole = roles[index + 1] || null;

  const commitSwipe = React.useCallback((direction: 'left' | 'right') => {
    if (!currentRole) return;
    onRoleInteraction(currentRole.id, direction === 'left' ? 'swipe_left' : 'swipe_right');
    setDragX(0);
    setIndex((current) => current + 1);
  }, [currentRole, onRoleInteraction]);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) return;
    setDragX((event.touches[0]?.clientX ?? 0) - touchStartX.current);
  };

  const handleTouchEnd = () => {
    if (Math.abs(dragX) > 110) {
      commitSwipe(dragX < 0 ? 'left' : 'right');
    } else {
      setDragX(0);
    }
    touchStartX.current = null;
  };

  if (!currentRole) {
    return (
      <div className="md:hidden -mx-4 min-h-[calc(100dvh-8rem)] bg-[linear-gradient(180deg,#f8fafc,#eef6f8)] px-4 py-8">
        <div className="flex h-full items-center justify-center rounded-[32px] border border-slate-200 bg-white/88 p-8 text-center shadow-[0_30px_80px_-42px_rgba(15,23,42,0.16)]">
          <div>
            <div className="text-lg font-semibold text-slate-900">{hasMore ? t('rebuild.marketplace.loading_more', { defaultValue: 'More offers are waiting.' }) : t('rebuild.marketplace.no_more_roles', { defaultValue: 'That\'s all for now.' })}</div>
            <div className="mt-3 text-sm leading-7 text-slate-500">{hasMore ? t('rebuild.marketplace.load_more_copy', { defaultValue: 'Load the next batch and continue in swipe mode.' }) : t('rebuild.marketplace.no_more_roles_copy', { defaultValue: 'Try adjusting filters or come back later for more offers.' })}</div>
            {hasMore ? (
              <button type="button" onClick={onLoadMore} disabled={loadingMore} className={cn(primaryButtonClass, 'mt-5')}>
                {loadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
                {t('rebuild.marketplace.load_more', { defaultValue: 'Load more' })}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const company = resolveCompany(currentRole, companyLibrary);
  const isSaved = savedRoleIds.includes(String(currentRole.id));
  const coverFallbacks = buildImageCandidates([
    currentRole.companyCoverImage,
    company.coverImage,
    ...getStockCoverCandidatesForDomain('operations', `${currentRole.companyName}:${currentRole.title}`),
    MARKETPLACE_IMAGE_FALLBACK,
  ]);
  const logoFallbacks = buildImageCandidates([
    currentRole.companyLogo,
    company.logo,
    MARKETPLACE_LOGO_FALLBACK,
    '/logo.png',
  ]);

  return (
    <div className="md:hidden -mx-4 min-h-[calc(100dvh-8rem)] bg-[linear-gradient(180deg,#f8fafc,#eef6f8)] px-4 py-2">
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.marketplace.mobile_swipe_label', { defaultValue: 'Swipe mode' })}</div>
          <div className="mt-1 text-sm font-medium text-slate-600">{index + 1} / {roles.length}</div>
        </div>
        <button type="button" onClick={() => navigate(currentRole.source === 'curated' ? `/candidate/role/${currentRole.id}` : `/candidate/imported/${currentRole.id}`)} className={secondaryButtonClass}>
          {t('rebuild.marketplace.open_detail', { defaultValue: 'Open detail' })}
        </button>
      </div>
      <div className="relative mx-auto max-w-md">
        {nextRole ? (
          <div className="absolute inset-x-4 top-4 h-full rounded-[30px] bg-slate-200/70 shadow-[0_24px_48px_-38px_rgba(15,23,42,0.3)]" />
        ) : null}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative overflow-hidden rounded-[34px] border border-slate-200 bg-slate-900 shadow-[0_42px_100px_-52px_rgba(15,23,42,0.5)] transition"
          style={{ transform: `translateX(${dragX}px) rotate(${dragX / 18}deg)` }}
        >
          <div className="absolute inset-0">
            <ResilientImage src={currentRole.heroImage} fallbackSrcs={coverFallbacks} alt={currentRole.title} className="h-full w-full object-cover" loading="lazy" decoding="async" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,15,33,0.08),rgba(5,15,33,0.7)_62%,rgba(5,15,33,0.94))]" />
          </div>
          <div className="relative flex min-h-[calc(100dvh-14rem)] flex-col justify-between p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
                {currentRole.source === 'curated' ? t('rebuild.marketplace.curated_roles_title', { defaultValue: 'Curated roles' }) : t('rebuild.marketplace.imported_title', { defaultValue: 'Imported opportunities' })}
              </div>
              {isSaved ? <div className="rounded-full bg-amber-400/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-950">{t('rebuild.briefing.saved_role', { defaultValue: 'Saved role' })}</div> : null}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <ResilientImage src={company.logo} fallbackSrcs={logoFallbacks} alt={company.name} className="h-12 w-12 rounded-2xl border border-white/15 object-cover" loading="lazy" decoding="async" />
                <div>
                  <div className="text-sm font-medium text-white/72">{company.name}</div>
                  <div className="text-sm text-white/62">{currentRole.location}</div>
                </div>
              </div>
              <h2 className="mt-5 text-[2rem] font-semibold leading-[0.98] tracking-[-0.06em]">{currentRole.title}</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {currentRole.benefits.slice(0, 3).map((benefit) => (
                  <span key={benefit} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/86">{benefit}</span>
                ))}
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
                <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-3">{currentRole.workModel}</div>
                <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-3">{currentRole.level}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-center gap-4">
        <button type="button" onClick={() => commitSwipe('left')} className="flex h-14 w-14 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 shadow-[0_18px_38px_-24px_rgba(244,63,94,0.35)]">
          <X size={22} />
        </button>
        <button type="button" onClick={() => navigate(currentRole.source === 'curated' ? `/candidate/role/${currentRole.id}` : `/candidate/imported/${currentRole.id}`)} className="rounded-full border border-[rgba(255,255,255,0.18)] bg-[linear-gradient(135deg,#ff8e78,#ff6f5b)] px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_38px_-22px_rgba(255,111,91,0.72)] transition hover:translate-y-[-1px] hover:shadow-[0_24px_44px_-22px_rgba(255,111,91,0.82)]">
          {t('rebuild.marketplace.open_detail', { defaultValue: 'Open detail' })}
        </button>
        <button type="button" onClick={() => commitSwipe('right')} className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-600 shadow-[0_18px_38px_-24px_rgba(16,185,129,0.35)]">
          <Star size={22} className="fill-current" />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-center gap-5 text-xs font-medium text-slate-500">
        <span>{t('rebuild.marketplace.swipe_left_hint', { defaultValue: 'Swipe left = not for me' })}</span>
        <span>{t('rebuild.marketplace.swipe_right_hint', { defaultValue: 'Swipe right = save for later' })}</span>
      </div>
    </div>
  );
};

export const MarketplacePage: React.FC<{
  roles: Role[];
  loading: boolean;
  totalRoleCount: number;
  databaseRoleCount: number;
  hasMore: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters: MarketplaceFilters;
  preferences: CandidatePreferenceProfile;
  companyLibrary: Company[];
  candidateApplicationsByRoleId: Record<string, DialogueSummary>;
  savedRoleIds: string[];
  onFiltersChange: (updater: React.SetStateAction<MarketplaceFilters>) => void;
  onResetFilters: () => void;
  onLoadMore: () => void;
  onRoleInteraction: (roleId: string, eventType: 'swipe_left' | 'swipe_right' | 'save' | 'unsave') => void;
  navigate: (path: string) => void;
  t: (key: string, opts: { defaultValue: string }) => string;
}> = ({ roles, loading, totalRoleCount, databaseRoleCount, hasMore, searchValue, onSearchChange, filters, preferences, companyLibrary, candidateApplicationsByRoleId, savedRoleIds, onFiltersChange, onResetFilters, onLoadMore, onRoleInteraction, navigate, t }) => {
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const listingsStartRef = React.useRef<HTMLDivElement | null>(null);
  const autoLoadStateRef = React.useRef({ loading: false, hasMore: false, requestedForCount: -1 });
  const hasTextSearch = searchValue.trim().length > 0;
  const isSearchExpanding = hasTextSearch && (hasMore || (loading && roles.length > 0));
  const visibleRoles = React.useMemo(() => {
    const toRadians = (value: number) => value * (Math.PI / 180);
    const distanceKm = (latA: number, lonA: number, latB: number, lonB: number) => {
      const earthRadiusKm = 6371;
      const dLat = toRadians(latB - latA);
      const dLon = toRadians(lonB - lonA);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
    };
    const normalizedCity = filters.city.trim().toLowerCase();
    const domesticCountryCode = preferences.taxProfile.countryCode;

    return roles.filter((role) => {
      if (!roleMatchesDiscovery(role, preferences, searchValue, filters.curatedOnly)) return false;
      if (filters.roleFamily !== 'all' && role.roleFamily !== filters.roleFamily) return false;
      if (!filters.crossBorder && role.countryCode !== domesticCountryCode) return false;
      if (filters.remoteOnly && role.workModel !== 'Remote') return false;
      if (!filters.remoteOnly && filters.workArrangement !== 'all') {
        const normalizedWorkModel = role.workModel.toLowerCase();
        if (filters.workArrangement === 'hybrid' && normalizedWorkModel !== 'hybrid') return false;
        if (filters.workArrangement === 'onsite' && normalizedWorkModel !== 'on-site') return false;
      }
      if (normalizedCity) {
        const haystack = [role.location, role.companyName, role.team, role.title].join(' ').toLowerCase();
        if (!haystack.includes(normalizedCity)) return false;
      }
      if (filters.benefits.length > 0) {
        const normalizedBenefits = role.benefits.map((benefit) => normalizeBenefitToken(benefit)).filter(Boolean);
        const hasBenefitMatch = filters.benefits.every((benefit) => {
          const aliases = benefitFilterAliases(benefit);
          return normalizedBenefits.some((item) => aliases.some((alias) => item.includes(alias) || alias.includes(item)));
        });
        if (!hasBenefitMatch) return false;
      }
      if (!hasTextSearch && role.workModel !== 'Remote' && filters.radiusKm > 0) {
        const candidateLat = preferences.coordinates.lat;
        const candidateLon = preferences.coordinates.lon;
        if (Number.isFinite(candidateLat) && Number.isFinite(candidateLon)) {
          const distance = distanceKm(candidateLat, candidateLon, role.coordinates.lat, role.coordinates.lng);
          if (distance > filters.radiusKm) return false;
        }
      }
      return true;
    });
  }, [filters.benefits, filters.city, filters.crossBorder, filters.curatedOnly, filters.radiusKm, filters.remoteOnly, filters.roleFamily, filters.workArrangement, preferences, roles, searchValue]);
  const curatedRoles = visibleRoles.filter((role) => role.source === 'curated');
  const importedRoles = visibleRoles.filter((role) => role.source === 'imported');
  const hasVisibleRoles = visibleRoles.length > 0;
  const benefitOptions = React.useMemo(() => {
    const counts = new Map<string, number>();
    roles.forEach((role) => {
      role.benefits.forEach((benefit) => {
        const normalized = String(benefit || '').trim();
        if (!normalized) return;
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([benefit]) => benefit)
      .reduce<string[]>((acc, benefit) => {
        if (!acc.some((item) => normalizeBenefitToken(item) === normalizeBenefitToken(benefit))) {
          acc.push(benefit);
        }
        return acc;
      }, [...PINNED_MARKETPLACE_BENEFITS])
      .slice(0, 12);
  }, [roles]);
  const catalogRoleCount = databaseRoleCount > 0 ? databaseRoleCount : Math.max(totalRoleCount, roles.length);
  const heroPulse = React.useMemo(() => {
    const minute = new Date().getMinutes();
    return {
      onlineUsers: 36 + (minute % 11),
      liveApplications: Math.max(8, Object.keys(candidateApplicationsByRoleId).length + curatedRoles.length + (minute % 4)),
    };
  }, [candidateApplicationsByRoleId, curatedRoles.length]);
  const activeFilterCount = [
    searchValue.trim(),
    filters.city.trim(),
    filters.roleFamily !== 'all' ? filters.roleFamily : '',
    filters.workArrangement !== 'all' ? filters.workArrangement : '',
    filters.remoteOnly ? 'remote' : '',
    filters.crossBorder !== preferences.borderSearchEnabled ? 'crossBorder' : '',
    filters.radiusKm !== preferences.searchRadiusKm ? String(filters.radiusKm) : '',
    filters.benefits.length > 0 ? filters.benefits.join(',') : '',
    filters.curatedOnly ? 'curatedOnly' : '',
  ].filter(Boolean).length;

  React.useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 480);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    autoLoadStateRef.current.loading = loading;
    autoLoadStateRef.current.hasMore = hasMore;
    if (!hasMore) {
      autoLoadStateRef.current.requestedForCount = -1;
    }
  }, [hasMore, loading]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth < 768) return;
    const node = loadMoreSentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry?.isIntersecting) return;
      if (!autoLoadStateRef.current.hasMore || autoLoadStateRef.current.loading) return;
      if (autoLoadStateRef.current.requestedForCount === visibleRoles.length) return;
      autoLoadStateRef.current.requestedForCount = visibleRoles.length;
      onLoadMore();
    }, {
      rootMargin: '900px 0px 240px 0px',
      threshold: 0.01,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, visibleRoles.length]);

  return (
    <div className={shellPageClass}>
      <section className="space-y-5 md:hidden">
        <div className={cn(panelClass, 'overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(232,242,248,0.96))]')}>
          <div className="grid gap-5 px-6 py-6 md:px-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-center">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0f95ac]">{t('rebuild.marketplace.hero_kicker', { defaultValue: 'Opportunity ecosystem' })}</div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 md:text-[15px]">
                {t('rebuild.marketplace.hero_copy', { defaultValue: 'Explore teams through real roles, clear signals and stronger fit context before you spend energy on applying.' })}
              </p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => listingsStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className={primaryButtonClass}
                >
                  {t('rebuild.marketplace.hero_cta', { defaultValue: 'Try the first challenge free →' })}
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:w-[27rem] lg:self-start">
              <HeroStatCard
                label={t('rebuild.marketplace.roles_database', { defaultValue: 'Roles in database' })}
                value={catalogRoleCount.toLocaleString(t === undefined ? 'cs-CZ' : (t('rebuild.locale', { defaultValue: 'en-GB' }) === 'cs-CZ' ? 'cs-CZ' : 'en-GB'))}
                accent="bg-white/92"
              />
              <HeroStatCard
                label={t('rebuild.marketplace.users_online', { defaultValue: 'Users online' })}
                value={heroPulse.onlineUsers.toLocaleString(t === undefined ? 'cs-CZ' : (t('rebuild.locale', { defaultValue: 'en-GB' }) === 'cs-CZ' ? 'cs-CZ' : 'en-GB'))}
                accent="bg-[rgba(18,175,203,0.12)]"
              />
              {curatedRoles.length > 0 ? (
                <HeroStatCard
                  label={t('rebuild.marketplace.curated_roles_title', { defaultValue: 'Curated roles' })}
                  value={curatedRoles.length.toLocaleString('cs-CZ')}
                  accent="bg-white/88"
                />
              ) : null}
            </div>
          </div>
        </div>
        <div className={cn(panelClass, 'p-4 md:p-5')}>
          <div className="flex flex-col gap-4">
            <MarketplaceSearchPanel searchValue={searchValue} loading={loading} onSearchChange={onSearchChange} t={t} className="border-0 bg-none p-0 shadow-none before:hidden" />
            <div className="flex items-center justify-between gap-3 md:hidden">
              <MarketplaceActiveFilters filters={filters} activeFilterCount={activeFilterCount} t={t} />
              <button type="button" onClick={() => setMobileFiltersOpen((current) => !current)} className={secondaryButtonClass}>
                {t('rebuild.marketplace.filters_button', { defaultValue: 'Filters' })}
                {activeFilterCount > 0 ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{activeFilterCount}</span> : null}
              </button>
            </div>
            <div className={cn('grid transition-all duration-300 md:hidden', mobileFiltersOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
              <div className="overflow-hidden">
                <MarketplaceFilterPanel
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  onResetFilters={onResetFilters}
                  navigate={navigate}
                  benefitOptions={benefitOptions}
                  t={t}
                  className="bg-[image:var(--shell-panel-bg)]"
                  compact={false}
                />
              </div>
            </div>
            <div className="hidden md:block">
              <MarketplaceActiveFilters filters={filters} activeFilterCount={activeFilterCount} t={t} />
            </div>
          </div>
        </div>
      </section>
      {isSearchExpanding ? (
        <div className={cn(panelClass, 'flex items-start gap-3 p-4 text-sm text-slate-600')}>
          <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-[#0f95ac]" />
          <div>
            <div className="font-semibold text-slate-900">{t('rebuild.marketplace.search_expanding_title', { defaultValue: 'First relevant results are already here.' })}</div>
            <div className="mt-1 leading-6">{t('rebuild.marketplace.search_expanding_copy', { defaultValue: 'Finding more matches across the database. You can start browsing the first batch, and more positions will be added continuously.' })}</div>
          </div>
        </div>
      ) : null}
      <MobileSwipeMarketplace
        roles={visibleRoles}
        companyLibrary={companyLibrary}
        savedRoleIds={savedRoleIds}
        hasMore={hasMore}
        loadingMore={loading}
        onLoadMore={onLoadMore}
        onRoleInteraction={onRoleInteraction}
        navigate={navigate}
        t={t}
      />
      <div className="hidden md:grid md:grid-cols-[320px_minmax(0,1fr)] md:items-start md:gap-8 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="sticky top-24 self-start">
          <div className={cn(panelClass, 'flex max-h-[calc(100vh-8rem)] flex-col overflow-hidden p-4 pr-3')}>
            <MarketplaceSearchPanel searchValue={searchValue} loading={loading} onSearchChange={onSearchChange} t={t} className="border-0 bg-none p-0 shadow-none before:hidden" />
            <div className="mt-4 h-px shrink-0 bg-[color:var(--shell-button-secondary-border)]" />
            <div className="mt-4 overflow-y-auto pr-1">
              <MarketplaceFilterPanel
                filters={filters}
                onFiltersChange={onFiltersChange}
                onResetFilters={onResetFilters}
                navigate={navigate}
                benefitOptions={benefitOptions}
                t={t}
                className="border-0 bg-none p-0 shadow-none before:hidden"
                compact
              />
            </div>
          </div>
        </aside>
        <div className="min-w-0 pr-2">
          <div ref={listingsStartRef} className="space-y-8 min-w-0">
            <section className="space-y-5">
              <div className={cn(panelClass, 'overflow-hidden bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(232,242,248,0.96))]')}>
                <div className="grid gap-5 px-6 py-6 md:px-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] xl:items-center">
                  <div className="max-w-3xl">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0f95ac]">{t('rebuild.marketplace.hero_kicker', { defaultValue: 'Opportunity ecosystem' })}</div>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 md:text-[15px]">
                      {t('rebuild.marketplace.hero_copy', { defaultValue: 'Explore teams through real roles, clear signals and stronger fit context before you spend energy on applying.' })}
                    </p>
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => listingsStartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className={primaryButtonClass}
                      >
                        {t('rebuild.marketplace.hero_cta', { defaultValue: 'Try the first challenge free →' })}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:w-[27rem] xl:self-start">
                    <HeroStatCard
                      label={t('rebuild.marketplace.roles_database', { defaultValue: 'Roles in database' })}
                      value={catalogRoleCount.toLocaleString('cs-CZ')}
                      accent="bg-white/92"
                    />
                    <HeroStatCard
                      label={t('rebuild.marketplace.users_online', { defaultValue: 'Users online' })}
                      value={heroPulse.onlineUsers.toLocaleString('cs-CZ')}
                      accent="bg-[rgba(18,175,203,0.12)]"
                    />
                    {curatedRoles.length > 0 ? (
                      <HeroStatCard
                        label={t('rebuild.marketplace.curated_roles_title', { defaultValue: 'Curated roles' })}
                        value={curatedRoles.length.toLocaleString(t('rebuild.locale', { defaultValue: 'en-GB' }) === 'cs-CZ' ? 'cs-CZ' : 'en-GB')}
                        accent="bg-white/88"
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
            {loading ? <div className={cn(panelClass, 'flex items-center gap-3 p-5 text-sm text-slate-500')}><Loader2 size={16} className="animate-spin" />{t('rebuild.marketplace.loading', { defaultValue: 'Loading current offers.' })}</div> : null}
            <div className="space-y-8">
              {curatedRoles.length > 0 ? (
                <section className="space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.marketplace.curated_roles_title', { defaultValue: 'Curated roles' })}</div>
                      <h2 className="mt-2 font-display text-[2rem] font-semibold tracking-[-0.04em] text-slate-900">{t('rebuild.marketplace.curated_desc', { defaultValue: 'Full company-branded handshake journeys' })}</h2>
                    </div>
                    <div className="text-sm text-slate-500">{curatedRoles.length} {t('rebuild.marketplace.roles_label', { defaultValue: 'roles' })}</div>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2">
                    {curatedRoles.map((role) => <RoleCard key={role.id} role={role} companyLibrary={companyLibrary} applicationStatus={candidateApplicationsByRoleId[role.id]?.status} onOpen={() => navigate(`/candidate/role/${role.id}`)} t={t} />)}
                  </div>
                </section>
              ) : null}
              {importedRoles.length > 0 ? (
                <section className="space-y-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.marketplace.imported_title', { defaultValue: 'Imported opportunities' })}</div>
                      <h2 className="mt-2 font-display text-[2rem] font-semibold tracking-[-0.04em] text-slate-900">{t('rebuild.marketplace.imported_desc', { defaultValue: 'External roles with intelligence-first prep' })}</h2>
                    </div>
                    <div className="text-sm text-slate-500">{importedRoles.length} {t('rebuild.marketplace.roles_label', { defaultValue: 'roles' })}</div>
                  </div>
                  <div className="grid gap-5 xl:grid-cols-2">
                    {importedRoles.map((role) => <RoleCard key={role.id} role={role} companyLibrary={companyLibrary} applicationStatus={candidateApplicationsByRoleId[role.id]?.status} onOpen={() => navigate(`/candidate/imported/${role.id}`)} t={t} />)}
                  </div>
                </section>
              ) : null}
              {!hasVisibleRoles ? (
                <div className={cn(panelClass, 'p-8')}>
                  <div className={pillEyebrowClass}>{t('rebuild.marketplace.no_results_label', { defaultValue: 'No matches' })}</div>
                  <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.04em] text-slate-900">{t('rebuild.marketplace.no_results_title', { defaultValue: 'No roles match the current filters.' })}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{t('rebuild.marketplace.no_results_copy', { defaultValue: 'Try a wider radius, remove a few filters, or switch back to all role types.' })}</p>
                  <div className="mt-5">
                    <button type="button" onClick={onResetFilters} className={primaryButtonClass}>
                      {t('rebuild.marketplace.reset_filters', { defaultValue: 'Reset filters' })}
                    </button>
                  </div>
                </div>
              ) : null}
              {hasMore ? (
                <div
                  ref={loadMoreSentinelRef}
                  className={cn(panelClass, 'flex items-center justify-between gap-4 p-5')}
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {loading
                        ? t('rebuild.marketplace.loading_more', { defaultValue: 'Loading more offers.' })
                        : t('rebuild.marketplace.load_more_ready', { defaultValue: 'More offers are ready.' })}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {loading
                        ? t('rebuild.marketplace.loading_more_copy', { defaultValue: 'As soon as the next page arrives, the list will expand smoothly.' })
                        : t('rebuild.marketplace.load_more_copy', { defaultValue: 'Load the next batch and continue browsing.' })}
                    </div>
                  </div>
                  <button type="button" onClick={onLoadMore} disabled={loading} className={primaryButtonClass}>
                    {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loading
                      ? t('rebuild.marketplace.loading_more', { defaultValue: 'Loading more offers.' })
                      : t('rebuild.marketplace.load_more', { defaultValue: 'Load more' })}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {loading ? <div className={cn(panelClass, 'flex items-center gap-3 p-5 text-sm text-slate-500 md:hidden')}><Loader2 size={16} className="animate-spin" />{t('rebuild.marketplace.loading', { defaultValue: 'Loading current offers.' })}</div> : null}
      {showScrollTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-[0_22px_44px_-24px_rgba(15,23,42,0.55)] transition hover:bg-slate-800"
          aria-label={t('rebuild.marketplace.back_to_top', { defaultValue: 'Back to top' })}
        >
          <ArrowUp size={18} />
        </button>
      ) : null}
    </div>
  );
};

const JobPostingSchema: React.FC<{ role: Role }> = ({ role }) => {
  const schema = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    "title": role.title,
    "description": role.summary || role.description,
    "datePosted": new Date().toISOString(),
    "employmentType": role.contractType === 'Full-time' ? 'FULL_TIME' : 'PART_TIME',
    "hiringOrganization": {
      "@type": "Organization",
      "name": role.companyName,
      "logo": role.companyLogo
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": role.location,
        "addressCountry": "CZ"
      }
    },
    "baseSalary": role.salaryFrom ? {
      "@type": "MonetaryAmount",
      "currency": role.currency,
      "value": {
        "@type": "QuantitativeValue",
        "minValue": role.salaryFrom,
        "maxValue": role.salaryTo,
        "unitText": "MONTH"
      }
    } : undefined
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export const CandidateRoleBriefingPage: React.FC<{
  role: Role;
  blueprint: HandshakeBlueprint;
  preferences: CandidatePreferenceProfile;
  companyLibrary: Company[];
  existingApplication?: DialogueSummary | null;
  isSaved: boolean;
  onToggleSaved: () => void;
  navigate: (path: string) => void;
  t: (key: string, opts: { defaultValue: string }) => string;
}> = ({ role, blueprint, preferences, companyLibrary, existingApplication, isSaved, onToggleSaved, navigate, t }) => {
  const company = resolveCompany(role, companyLibrary);
  const applicationStatus = existingApplication ? getApplicationStatusCopy(existingApplication.status, t) : null;
  const coverFallbacks = buildImageCandidates([
    role.heroImage,
    role.companyCoverImage,
    ...getStockCoverCandidatesForDomain('operations', `${role.companyName}:${role.title}`),
    MARKETPLACE_IMAGE_FALLBACK,
  ]);
  const _reviewerFallbacks = buildImageCandidates([
    company.reviewer.avatarUrl,
    company.logo,
    MARKETPLACE_LOGO_FALLBACK,
    '/logo.png',
  ]);
  const compensation = formatRoleCompensation(role, t('rebuild.briefing.compensation_unknown', { defaultValue: 'Compensation not specified' }));
  return (
    <CandidateShellSurface
      variant="role"
      className={shellPageClass}
      eyebrow={<SectionEyebrow>{t('rebuild.briefing.role_briefing', { defaultValue: 'Briefing role' })}</SectionEyebrow>}
      actions={(
        <CompactActionButton tone="secondary" onClick={() => navigate('/candidate/marketplace')}>
          <ArrowLeft size={16} /> {t('rebuild.briefing.back_marketplace', { defaultValue: 'Back to marketplace' })}
        </CompactActionButton>
      )}
    >
      <JobPostingSchema role={role} />
      <ShellCard className="overflow-hidden">
        <div className="grid min-h-[22rem] bg-white lg:grid-cols-[1fr_0.78fr]">
          <div className="flex items-center p-6 md:p-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{company.name}</div>
              <h1 className="mt-4 text-[clamp(2.2rem,5vw,4.6rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-slate-950">{role.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">{role.summary}</p>
            </div>
          </div>
          <div className="min-h-[16rem] border-t border-slate-200 lg:border-l lg:border-t-0">
            <ResilientImage src={company.coverImage} fallbackSrcs={coverFallbacks} alt={company.name} className="h-full min-h-[16rem] w-full object-cover" loading="lazy" decoding="async" />
          </div>
        </div>
      </ShellCard>
      <RoleRealityBoard role={role} preferences={preferences} t={t} />
      <RecommendationFitPanel role={role} t={t} />
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <ShellCard className="p-6">
            <SectionEyebrow>{t('rebuild.briefing.title', { defaultValue: 'Role briefing' })}</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-900">{role.challenge}</h2>
            <p className="mt-4 text-base leading-8 text-slate-600">{role.mission || role.description}</p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Building2 size={16} className="text-[#0f95ac]" />{t('rebuild.detail.company_signal', { defaultValue: 'Company from inside' })}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{company.narrative || role.companyNarrative || t('rebuild.detail.company_signal_body', { defaultValue: 'Branded Jobshaman detail connects the role, team and handshake materials so you can imagine a real working day.' })}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Compass size={16} className="text-[#0f95ac]" />{t('rebuild.detail.fit_signal', { defaultValue: 'Fit before clicking' })}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{t('rebuild.detail.fit_signal_body', { defaultValue: 'JHI, salary, taxes and commute are calculated before starting the handshake, not after a wasted afternoon.' })}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Clock3 size={16} className="text-[#0f95ac]" />{t('rebuild.detail.next_step_signal', { defaultValue: 'Next step' })}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{role.firstStep}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <DetailMetaPill label={t('rebuild.briefing.contract', { defaultValue: 'Contract' })} value={role.contractType || t('rebuild.briefing.contract_unknown', { defaultValue: 'Not specified' })} />
              <DetailMetaPill label={t('rebuild.briefing.compensation', { defaultValue: 'Compensation' })} value={compensation} />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.briefing.signal_desc', { defaultValue: 'What the first signal looks like' })}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{role.firstStep}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.briefing.blueprint', { defaultValue: 'Journey blueprint' })}</div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{blueprint.overview}</p>
              </div>
            </div>
            {role.benefits.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.briefing.benefits', { defaultValue: 'Benefits' })}</div>
                <div className="mt-3 flex flex-wrap gap-2">{role.benefits.map((benefit) => <span key={benefit} className="rounded-full bg-[#12AFCB]/8 px-3 py-1.5 text-xs font-medium text-[#0f95ac]">{benefit}</span>)}</div>
              </div>
            ) : null}
            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-900">{t('rebuild.briefing.skills', { defaultValue: 'Key skills' })}</div>
              <div className="mt-3 flex flex-wrap gap-2">{role.skills.map((skill) => <span key={skill} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{skill}</span>)}</div>
            </div>
            <div className="mt-6 space-y-4">
              <DetailSection title={t('rebuild.briefing.why_this_role', { defaultValue: 'Why this role matters' })} body={role.roleSummary || role.summary} />
              <DetailSection title={t('rebuild.briefing.hard_truth', { defaultValue: 'Hard truth of the role' })} body={role.companyTruthHard || ''} />
              <DetailSection title={t('rebuild.briefing.failure_truth', { defaultValue: 'What failure looks like' })} body={role.companyTruthFail || ''} />
            </div>
            {company.gallery.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.briefing.company_gallery', { defaultValue: 'Company gallery' })}</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {company.gallery.slice(0, 4).map((asset) => (
                    <div key={asset.id} className="overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50">
                      <img src={asset.url} alt={asset.title || asset.name} className="h-36 w-full object-cover" loading="lazy" />
                      <div className="px-4 py-3 text-sm text-slate-600">{asset.caption || asset.title || asset.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {company.handshakeMaterials.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.briefing.handshake_materials', { defaultValue: 'Materials for the handshake' })}</div>
                <div className="mt-3 space-y-2">
                  {company.handshakeMaterials.map((asset) => (
                    <a
                      key={asset.id}
                      href={asset.download_url || asset.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:border-[#255DAB] hover:text-[#255DAB]"
                    >
                      <span className="min-w-0 truncate">{asset.title || asset.name}</span>
                      <ExternalLink size={16} className="shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {existingApplication ? (
              <div className="mt-6 rounded-[22px] border border-[#12AFCB]/12 bg-[#12AFCB]/5 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cn('rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]', applicationStatus?.tone || 'bg-[#12AFCB]/10 text-[#0f95ac]')}>{applicationStatus?.label || t('rebuild.briefing.submitted', { defaultValue: 'Submitted' })}</span>
                  <span className="text-sm text-slate-500">{t('rebuild.briefing.submitted_on', { defaultValue: 'Submitted' })} {existingApplication.submitted_at ? new Date(existingApplication.submitted_at).toLocaleDateString('cs-CZ') : t('rebuild.briefing.recently', { defaultValue: 'recently' })}</span>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{t('rebuild.briefing.submission_in_flight', { defaultValue: 'This role already has a draft or submitted response. Open the application detail to check the next step.' })}</p>
              </div>
            ) : null}
          </ShellCard>
        </div>
        <div className="space-y-6">
          <CompanyEncounterPanel role={role} company={company} t={t} />
          <DetailActionPanel role={role} existingApplication={existingApplication} isSaved={isSaved} onToggleSaved={onToggleSaved} navigate={navigate} t={t} />
        </div>
      </div>
    </CandidateShellSurface>
  );
};

export const ImportedPrepPage: React.FC<{
  role: Role;
  preferences: CandidatePreferenceProfile;
  isSaved: boolean;
  onToggleSaved: () => void;
  navigate: (path: string) => void;
  t: (key: string, opts: { defaultValue: string }) => string;
}> = ({ role, preferences, isSaved, onToggleSaved, navigate, t }) => {
  const sourceLink = role.outboundUrl || role.sourceUrl || '';
  const coverFallbacks = buildImageCandidates([
    role.heroImage,
    ...getStockCoverCandidatesForDomain('operations', `${role.companyName}:${role.title}:${role.location}`),
    MARKETPLACE_IMAGE_FALLBACK,
  ]);
  const _compensation = formatRoleCompensation(role, t('rebuild.prep.compensation_unknown', { defaultValue: 'Neuvedeno' }));

  return (
    <CandidateShellSurface
      variant="role"
      className={shellPageClass}
      eyebrow={<SectionEyebrow><ExternalLink size={12} />{t('rebuild.prep.title', { defaultValue: 'External outbound prep' })}</SectionEyebrow>}
      actions={(
        <CompactActionButton tone="secondary" onClick={() => navigate('/candidate/marketplace')}>
          <ArrowLeft size={16} /> {t('rebuild.briefing.back_marketplace', { defaultValue: 'Back to marketplace' })}
        </CompactActionButton>
      )}
    >
      <JobPostingSchema role={role} />
      <ShellCard className="overflow-hidden">
        <div className="grid min-h-[22rem] bg-white lg:grid-cols-[1fr_0.78fr]">
          <div className="flex items-center p-6 md:p-8">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <ExternalLink size={12} /> {role.companyName || t('rebuild.prep.external_source', { defaultValue: 'External listing' })}
              </div>
              <h1 className="mt-4 max-w-4xl text-[clamp(2.2rem,5vw,4.6rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-slate-950">{role.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">{role.roleSummary || role.summary || role.importedNote}</p>
            </div>
          </div>
          <div className="min-h-[16rem] border-t border-slate-200 lg:border-l lg:border-t-0">
            <ResilientImage src={role.heroImage} fallbackSrcs={coverFallbacks} alt={role.title} className="h-full min-h-[16rem] w-full object-cover" loading="lazy" decoding="async" />
          </div>
        </div>
      </ShellCard>

      <RoleRealityBoard role={role} preferences={preferences} t={t} />
      <RecommendationFitPanel role={role} t={t} />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <ShellCard className="p-6">
            <SectionEyebrow><Sparkles size={12} />{t('rebuild.prep.decision_room', { defaultValue: 'Decision detail' })}</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-900">{role.challenge || t('rebuild.prep.imported_challenge', { defaultValue: 'Reality first, external response later.' })}</h2>
            <p className="mt-4 text-base leading-8 text-slate-600">{role.mission || role.description}</p>
            <div className="mt-6">
              <DetailMetaPill label={t('rebuild.prep.contract', { defaultValue: 'Contract' })} value={role.contractType || t('rebuild.prep.contract_unknown', { defaultValue: 'Not specified' })} />
            </div>
            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">{t('rebuild.prep.prepare', { defaultValue: 'What to prepare' })}</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{role.firstStep}</p>
            </div>
            {role.skills.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.briefing.skills', { defaultValue: 'Key skills' })}</div>
                <div className="mt-3 flex flex-wrap gap-2">{role.skills.map((skill) => <span key={skill} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{skill}</span>)}</div>
              </div>
            ) : null}
            {role.benefits.length > 0 ? (
              <div className="mt-6">
                <div className="text-sm font-semibold text-slate-900">{t('rebuild.prep.benefits', { defaultValue: 'Benefits' })}</div>
                <div className="mt-3 flex flex-wrap gap-2">{role.benefits.map((benefit) => <span key={benefit} className="rounded-full bg-[#12AFCB]/8 px-3 py-1.5 text-xs font-medium text-[#0f95ac]">{benefit}</span>)}</div>
              </div>
            ) : null}
            <div className="mt-6 space-y-4">
              <DetailSection title={t('rebuild.prep.hard_truth', { defaultValue: 'Hard truth of the role' })} body={role.companyTruthHard || ''} />
              <DetailSection title={t('rebuild.prep.failure_truth', { defaultValue: 'What failure looks like' })} body={role.companyTruthFail || ''} />
            </div>
          </ShellCard>
        </div>
        <div className="space-y-6">
          <CompanyEncounterPanel role={role} company={null} t={t} />
          <DetailActionPanel role={role} sourceLink={sourceLink} isSaved={isSaved} onToggleSaved={onToggleSaved} navigate={navigate} t={t} />
        </div>
      </div>
    </CandidateShellSurface>
  );
};

export const CandidateJcfpmPage: React.FC<{
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
  locale?: string;
}> = ({ t, locale = 'cs' }) => {
  const draft = React.useMemo(() => readJcfpmDraft(JCFPM_DRAFT_SCOPE), []);
  const [questions, setQuestions] = React.useState<JcfpmQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = React.useState(true);
  const [questionsError, setQuestionsError] = React.useState('');
  const [submitState, setSubmitState] = React.useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const submittedSignatureRef = React.useRef('');
  const [session, setSession] = React.useState<JCFPMSession>(() => ({
    answers: Object.fromEntries(Object.entries(draft?.responses || {}).map(([key, value]) => [key, Number(value)])),
  }));
  const [currentGroupIndex, setCurrentGroupIndex] = React.useState(0);
  const [wizardStep, setWizardStep] = React.useState<'welcome' | 'questions' | 'results'>('welcome');
  const [snapshot, setSnapshot] = React.useState<any>(null);

  const dimensionOrder = React.useMemo(
    () =>
      [
        'd1_cognitive',
        'd2_social',
        'd3_motivational',
        'd4_energy',
        'd5_values',
        'd6_ai_readiness',
        'd7_cognitive_reflection',
        'd8_digital_eq',
        'd9_systems_thinking',
        'd10_ambiguity_interpretation',
        'd11_problem_decomposition',
        'd12_moral_compass',
      ] as const,
    [],
  );

  React.useEffect(() => {
    let active = true;

    const loadQuestions = async () => {
      setQuestionsLoading(true);
      setQuestionsError('');
      try {
        const items = await fetchJcfpmItems();
        if (!active) return;

        const localeChain = [locale.toLowerCase(), locale.toLowerCase().split('-')[0], 'cs', 'en'];
        const shuffleArray = <T,>(array: T[]) => {
          const arr = [...array];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        };

        const randomizedItems = shuffleArray(items as any[]);

        const selected = dimensionOrder
          .flatMap((dimension) => {
            const dimItems = randomizedItems.filter((item: any) => item.dimension === dimension);
            return dimItems.slice(0, 6).map((item: any) => {
              const localizedPrompt = localeChain
                .map((key) => item?.prompt_i18n?.[key])
                .find((value) => typeof value === 'string' && value.trim().length > 0);

              const localizedPayload = localeChain
                .map((key) => item?.payload_i18n?.[key])
                .find((value) => value && typeof value === 'object');

              return {
                id: String(item?.id || ''),
                dimension: (item?.dimension || 'd1_cognitive') as JcfpmQuestion['dimension'],
                prompt: localizedPrompt || String(item?.prompt || ''),
                item_type: item?.item_type || 'likert',
                payload: localizedPayload || item?.payload || {},
              } satisfies JcfpmQuestion;
            });
          })
          .filter((item) => item.id && item.prompt);

        setQuestions(selected);
      } catch (error) {
        if (!active) return;
        setQuestions([]);
        setQuestionsError(error instanceof Error ? error.message : t('rebuild.jcfpm.load_failed', { defaultValue: 'Failed to load JCFPM questions.' }));
      } finally {
        if (active) setQuestionsLoading(false);
      }
    };

    void loadQuestions();

    return () => {
      active = false;
    };
  }, [locale, t]);

  React.useEffect(() => {
    writeJcfpmDraft({ stepIndex: 0, responses: session.answers, updatedAt: new Date().toISOString() }, JCFPM_DRAFT_SCOPE);
  }, [session.answers]);

  const dimensionGroups = React.useMemo(() => {
    return dimensionOrder
      .map((dim) => ({
        dimension: dim,
        questions: questions.filter((q) => q.dimension === dim),
      }))
      .filter((group) => group.questions.length > 0);
  }, [questions]);

  const dimensionScores = React.useMemo(() => {
    const grouped = new Map<string, number[]>();
    questions.forEach((question) => {
      const current = grouped.get(question.dimension) || [];
      const val = Number(session.answers[question.id] || 0);
      if (val > 0) current.push(val);
      grouped.set(question.dimension, current);
    });
    return Array.from(grouped.entries()).map(([dimension, values]) => ({
      dimension,
      raw_score: values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1),
      percentile: Math.round((values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1)) * 14), // Approx for 1-7 scale
    }));
  }, [questions, session.answers]);

  const archetype = React.useMemo(() => computeArchetype(dimensionScores as never), [dimensionScores]);
  const completed = questions.length > 0 && questions.every((question) => Number(session.answers[question.id] || 0) > 0);
  const dimensionLabels = React.useMemo<Record<string, string>>(() => ({
    d1_cognitive: t('rebuild.jcfpm.dimensions.d1_cognitive', { defaultValue: 'Analytical thinking' }),
    d2_social: t('rebuild.jcfpm.dimensions.d2_social', { defaultValue: 'People collaboration' }),
    d3_motivational: t('rebuild.jcfpm.dimensions.d3_motivational', { defaultValue: 'Intrinsic motivation' }),
    d4_energy: t('rebuild.jcfpm.dimensions.d4_energy', { defaultValue: 'Work pace and energy' }),
    d5_values: t('rebuild.jcfpm.dimensions.d5_values', { defaultValue: 'Value setting' }),
    d6_ai_readiness: t('rebuild.jcfpm.dimensions.d6_ai_readiness', { defaultValue: 'AI tool usage' }),
    d7_cognitive_reflection: t('rebuild.jcfpm.dimensions.d7_cognitive_reflection', { defaultValue: 'Self-reflection in decisions' }),
    d8_digital_eq: t('rebuild.jcfpm.dimensions.d8_digital_eq', { defaultValue: 'Digital maturity' }),
    d9_systems_thinking: t('rebuild.jcfpm.dimensions.d9_systems_thinking', { defaultValue: 'Systems thinking' }),
    d10_ambiguity_interpretation: t('rebuild.jcfpm.dimensions.d10_ambiguity_interpretation', { defaultValue: 'Ambiguity navigation' }),
    d11_problem_decomposition: t('rebuild.jcfpm.dimensions.d11_problem_decomposition', { defaultValue: 'Problem decomposition' }),
    d12_moral_compass: t('rebuild.jcfpm.dimensions.d12_moral_compass', { defaultValue: 'Ethical judgment' }),
  }), [t]);

  React.useEffect(() => {
    if (!completed) return;
    setSession((current) => ({ ...current, archetypeTitle: archetype.title, summary: archetype.description, completedAt: new Date().toISOString() }));
  }, [archetype.description, archetype.title, completed]);

  React.useEffect(() => {
    if (!completed) {
      setSubmitState('idle');
      return;
    }

    const itemIds = questions.map((question) => question.id);
    const signature = JSON.stringify({ itemIds, answers: session.answers });
    if (submittedSignatureRef.current === signature) return;
    submittedSignatureRef.current = signature;
    setSubmitState('saving');

    void submitJcfpm(session.answers, itemIds, `rebuild-${locale}`)
      .then((res) => {
        if (!res) {
          setSubmitState('failed');
          return;
        }
        setSnapshot(res);
        clearJcfpmDraft(JCFPM_DRAFT_SCOPE);
        setSubmitState('saved');
      })
      .catch(() => {
        submittedSignatureRef.current = '';
        setSubmitState('failed');
      });
  }, [completed, locale, questions, session.answers]);

  React.useEffect(() => {
    if (!questionsLoading && dimensionGroups.length > 0) {
      if (completed) {
        setWizardStep('results');
      } else {
        const currentGroup = dimensionGroups[currentGroupIndex];
        const groupComplete = currentGroup?.questions.every((q) => Number(session.answers[q.id] || 0) > 0);
        if (groupComplete && currentGroupIndex < dimensionGroups.length - 1) {
          // Auto advance group? Or let user click? Let's auto advance for now but maybe better with button
        }
      }
    }
  }, [questionsLoading, dimensionGroups, completed, session.answers, currentGroupIndex]);

  const handleAnswer = (questionId: string, value: number) => {
    setSession((current) => ({ ...current, answers: { ...current.answers, [questionId]: value } }));
  };

  const handleNextGroup = () => {
    if (currentGroupIndex < dimensionGroups.length - 1) {
      setCurrentGroupIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (completed) {
      setWizardStep('results');
    }
  };

  const handleReset = () => {
    setSession({ answers: {} });
    clearJcfpmDraft(JCFPM_DRAFT_SCOPE);
    submittedSignatureRef.current = '';
    setSubmitState('idle');
    setCurrentGroupIndex(0);
    setWizardStep('welcome');
    setSnapshot(null);
  };

  return (
    <CandidateShellSurface
      variant="profile"
      className={shellPageClass}
      eyebrow={<SectionEyebrow>{t('rebuild.jcfpm.title', { defaultValue: 'JCFPM profil' })}</SectionEyebrow>}
      title={t('rebuild.jcfpm.subtitle', { defaultValue: 'Work preference profile' })}
      subtitle={t('rebuild.jcfpm.copy', { defaultValue: 'Vypln kratky profil a rychleji poznas, jake nabidky ti opravdu sednou.' })}
    >
      {questionsLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 size={32} className="animate-spin" />
        </div>
      ) : questionsError ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm leading-7 text-rose-700">
          {questionsError}
        </div>
      ) : wizardStep === 'welcome' ? (
        <ShellCard className="mx-auto max-w-2xl p-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#255DAB]/10 text-[#255DAB]">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 14 4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{t('rebuild.jcfpm.welcome_title', { defaultValue: 'Psychometric and skill profile' })}</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            {t('rebuild.jcfpm.welcome_desc', { defaultValue: '12 groups of questions await you. The first 6 focus on your psychological profile and work style, the next 6 map your real skills and cognitive prerequisites. The result is saved to your profile and helps us with more accurate recommendations for positions and courses.' })}
          </p>
          <button
            type="button"
            onClick={() => setWizardStep('questions')}
            className={cn(primaryButtonClass, 'mt-10 w-full max-w-sm rounded-[16px] py-4 text-lg')}
          >
            {t('rebuild.jcfpm.start_test', { defaultValue: 'Start JCFPM test' })}
          </button>
        </ShellCard>
      ) : wizardStep === 'questions' ? (
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-slate-500">
              <span>{t('rebuild.assessment.group_progress', { defaultValue: 'Blok {{current}} z {{total}}', current: currentGroupIndex + 1, total: dimensionGroups.length })}</span>
              <span>{Math.round(((currentGroupIndex + 1) / dimensionGroups.length) * 100)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-[#255DAB] transition-all duration-500 ease-out"
                style={{ width: `${((currentGroupIndex + 1) / dimensionGroups.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-6">
            <div className="mb-6 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {currentGroupIndex < 6 ? t('rebuild.jcfpm.psych_profile', { defaultValue: 'Psychological profile' }) : t('rebuild.jcfpm.skill_profile', { defaultValue: 'Cognitive and skill prerequisites' })} • {dimensionLabels[dimensionGroups[currentGroupIndex].dimension]}
            </div>

            {dimensionGroups[currentGroupIndex].questions.map((question) => {
              const isLikert = !question.item_type || question.item_type === 'likert';
              const options = (question.payload?.options as any[]) || [];

              return (
                <ShellCard key={question.id} className="p-6 md:p-8">
                  <h3 className="text-xl font-medium leading-relaxed text-slate-900">{question.prompt}</h3>

                  {isLikert ? (
                    <div className="mt-8">
                      <div className="grid grid-cols-7 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7].map((value) => {
                          const active = Number(session.answers[question.id] || 0) === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => handleAnswer(question.id, value)}
                              className={cn(
                                'flex aspect-square flex-col items-center justify-center rounded-[16px] border-2 transition-all duration-200',
                                active ? 'border-[#255DAB] bg-[#255DAB] text-white shadow-lg' : 'border-slate-100 bg-white text-slate-600 hover:border-[#255DAB]/30'
                              )}
                            >
                              <span className="text-xl font-bold">{value}</span>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span>{t('rebuild.jcfpm.disagree', { defaultValue: 'Disagree' })}</span>
                        <span>{t('rebuild.jcfpm.agree', { defaultValue: 'Agree' })}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 grid gap-3">
                      {options.map((opt) => {
                        const active = session.answers[question.id] === opt.id || session.answers[question.id] === opt.value;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleAnswer(question.id, opt.id || opt.value)}
                            className={cn(
                              'flex w-full items-center rounded-[16px] border-2 p-4 text-left transition-all',
                              active ? 'border-[#255DAB] bg-[#255DAB]/5 text-[#255DAB]' : 'border-slate-100 bg-white text-slate-600 hover:border-[#255DAB]/30'
                            )}
                          >
                            <div className={cn('mr-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', active ? 'border-[#255DAB] bg-[#255DAB]' : 'border-slate-200')}>
                              {active && <div className="h-2 w-2 rounded-full bg-white" />}
                            </div>
                            <span className="text-sm font-medium">{opt.label || opt.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ShellCard>
              );
            })}
          </div>

          <div className="mt-10 flex flex-col items-center gap-6">
            <button
              type="button"
              disabled={!dimensionGroups[currentGroupIndex].questions.every((q) => Number(session.answers[q.id] || 0) > 0)}
              onClick={handleNextGroup}
              className={cn(primaryButtonClass, 'w-full max-w-sm rounded-[16px] py-4 text-lg disabled:opacity-50 disabled:grayscale')}
            >
              {currentGroupIndex < dimensionGroups.length - 1 ? t('rebuild.jcfpm.next_block', { defaultValue: 'Continue to next block' }) : t('rebuild.jcfpm.finish', { defaultValue: 'Finish and show results' })}
            </button>
            <button type="button" onClick={handleReset} className="text-sm font-medium text-slate-400 hover:text-slate-600">
              {t('rebuild.jcfpm.abort', { defaultValue: 'Interrupt and start again' })}
            </button>
          </div>
        </div>
      ) : (
        <ShellCard className="grid gap-6 p-6 xl:grid-cols-[1fr_340px]">
          <div className="flex flex-col">
            <div className="flex-1 space-y-6">
              <div className="rounded-[28px] bg-[linear-gradient(145deg,#103d46,#1f6c74_48%,#d18a45_140%)] p-8 text-white shadow-[0_30px_80px_-42px_rgba(18,89,100,0.56)]">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/72">{t('rebuild.jcfpm.archetype', { defaultValue: 'Archetyp' })}</div>
                <div className="mt-4 text-4xl font-bold tracking-[-0.05em]">{archetype.title}</div>
                <p className="mt-6 max-w-2xl text-base leading-8 text-white/90">{archetype.description}</p>
              </div>

              {snapshot?.traits?.big_five && (
                <div className={cn(panelClass, 'p-8')}>
                  <h4 className="text-lg font-bold text-slate-900">{t('rebuild.jcfpm.psych_report_title', { defaultValue: 'Psychometric report (Big 5)' })}</h4>
                  <p className="mt-2 text-sm text-slate-500">{t('rebuild.jcfpm.psych_report_desc', { defaultValue: 'This report compares your internal setting with cognitive prerequisites.' })}</p>
                  <div className="mt-8 grid gap-8 md:grid-cols-2">
                    {[
                      { key: 'openness', label: t('rebuild.jcfpm.big5.openness', { defaultValue: 'Openness' }), color: 'bg-emerald-500' },
                      { key: 'conscientiousness', label: t('rebuild.jcfpm.big5.conscientiousness', { defaultValue: 'Conscientiousness' }), color: 'bg-blue-500' },
                      { key: 'extraversion', label: t('rebuild.jcfpm.big5.extraversion', { defaultValue: 'Extraversion' }), color: 'bg-amber-500' },
                      { key: 'agreeableness', label: t('rebuild.jcfpm.big5.agreeableness', { defaultValue: 'Agreeableness' }), color: 'bg-rose-500' },
                      { key: 'neuroticism', label: t('rebuild.jcfpm.big5.neuroticism', { defaultValue: 'Emotional reactivity' }), color: 'bg-indigo-500' },
                    ].map((trait) => (
                      <div key={trait.key}>
                        <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                          <span>{trait.label}</span>
                          <span>{Math.round(snapshot.traits.big_five[trait.key])}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div className={cn('h-full transition-all duration-1000', trait.color)} style={{ width: `${snapshot.traits.big_five[trait.key]}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {snapshot?.traits?.temperament && (
                <div className={cn(panelClass, 'p-8')}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">{t('rebuild.jcfpm.temperament_title', { defaultValue: 'Temperament profile' })}</h4>
                      <div className="mt-2 text-2xl font-bold capitalize text-[#255DAB]">{snapshot.traits.temperament.label}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('rebuild.jcfpm.confidence', { defaultValue: 'Estimation confidence' })}</div>
                      <div className="text-xl font-bold text-slate-700">{snapshot.traits.temperament.confidence}%</div>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    <div>
                      <div className="mb-2 text-xs font-semibold text-slate-500">{t('rebuild.jcfpm.dominance', { defaultValue: 'Dominance' })}</div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-slate-400" style={{ width: `${snapshot.traits.temperament.dominance}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-semibold text-slate-500">{t('rebuild.jcfpm.reactivity', { defaultValue: 'Reactivity' })}</div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-slate-400" style={{ width: `${snapshot.traits.temperament.reactivity}%` }} />
                      </div>
                    </div>
                  </div>
                  {snapshot.traits.temperament.notes?.length > 0 && (
                    <div className="mt-6 space-y-2">
                      {snapshot.traits.temperament.notes.map((note: string, idx: number) => (
                        <div key={idx} className="flex gap-2 text-sm leading-6 text-slate-600">
                          <span className="text-[#255DAB]">•</span>
                          <span>{note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500">
                  {submitState === 'saving' ? t('rebuild.jcfpm.saving', { defaultValue: 'Saving JCFPM...' }) : submitState === 'saved' ? t('rebuild.jcfpm.saved', { defaultValue: 'JCFPM saved to profile' }) : submitState === 'failed' ? t('rebuild.jcfpm.save_failed', { defaultValue: 'Failed to save JCFPM' }) : null}
                </div>
              </div>
              <button type="button" onClick={handleReset} className={secondaryButtonClass}>{t('rebuild.jcfpm.reset', { defaultValue: 'Try again' })}</button>
            </div>
          </div>
          <div className="space-y-5">
            <div className={cn(panelClass, 'p-5')}>
              <div className="text-sm font-semibold text-slate-900">{t('rebuild.jcfpm.dimension_map', { defaultValue: 'Dimension overview' })}</div>
              <div className="mt-5 space-y-4">
                {dimensionScores.map((item) => (
                  <div key={item.dimension}>
                    <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                      <span>{dimensionLabels[item.dimension] || item.dimension.replace(/_/g, ' ')}</span>
                      <span>{item.percentile}%</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100">
                      <div className="h-1.5 rounded-full bg-[#255DAB]" style={{ width: `${item.percentile}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ShellCard>
      )}
    </CandidateShellSurface>
  );
};
