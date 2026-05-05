import React from 'react';
import {
  LayoutDashboard,
  ArrowRight,
  Briefcase,
  CircleUserRound,
  MessageSquare,
  Bookmark,
  MessageCircle,
  Eye,
  CheckCircle2,
  Handshake,
  GraduationCap,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
  MapPin,
  Car,
  Bus,
  Bike,
  Footprints,
  Dog,
  Baby,
  Home,
  Banknote,
  BrainCircuit,
} from 'lucide-react';
import { DashboardLayoutV2 } from '../ui/DashboardLayoutV2';
import { Role, CandidatePreferenceProfile, MarketplaceFilters, MarketplaceSection } from '../models';
import { DialogueSummary, UserProfile } from '../../types';
import {
  QuickActionButtons,
  FeaturedRoleCard,
  DiscoveryRoleCard,
  MiniSandboxCard,
  CandidateKompas
} from './MarketplaceComponents';
import { getStaticCoordinates } from '../../services/geocodingService';

// Helper to calculate distance in km
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) return Infinity;
  if ((lat2 === 0 && lon2 === 0) || (lat1 === 0 && lon1 === 0)) return Infinity;
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

const getRolePath = (role: Role) => role.source === 'curated' ? `/candidate/role/${role.id}` : `/candidate/imported/${role.id}`;

const DEFAULT_PRAGUE_COORDINATES = { lat: 50.0755, lon: 14.4378 };

const isDefaultPragueCoordinates = (coordinates?: { lat: number; lon: number } | null): boolean => {
  if (!coordinates) return false;
  return Math.abs(coordinates.lat - DEFAULT_PRAGUE_COORDINATES.lat) < 0.02
    && Math.abs(coordinates.lon - DEFAULT_PRAGUE_COORDINATES.lon) < 0.02;
};

const isRemoteRole = (role: Role): boolean => String(role.workModel || '').toLowerCase().includes('remote');
const RECOMMENDATION_PAGE_SIZE = 24;
type MarketplaceFocus = 'all' | 'immediate' | 'curated';

const getBenefitOptions = (t: (key: string, opts?: { defaultValue: string }) => string) => [
  t('rebuild.marketplace.benefit_dog_friendly', { defaultValue: 'Dog-friendly office' }),
  t('rebuild.marketplace.benefit_child_friendly', { defaultValue: 'Child friendly office' }),
  t('rebuild.marketplace.benefit_car', { defaultValue: 'Služební auto' }),
  t('rebuild.marketplace.benefit_accommodation', { defaultValue: 'Ubytování' }),
  t('rebuild.marketplace.benefit_home_office', { defaultValue: 'Home office' }),
  t('rebuild.marketplace.benefit_flex_hours', { defaultValue: 'Flexibilní směny' }),
  t('rebuild.marketplace.benefit_transport', { defaultValue: 'Příspěvek na dopravu' }),
  t('rebuild.marketplace.benefit_meal_vouchers', { defaultValue: 'Stravenky' }),
  t('rebuild.marketplace.benefit_multisport', { defaultValue: 'Multisport' }),
  t('rebuild.marketplace.benefit_education', { defaultValue: 'Vzdělávání' }),
  t('rebuild.marketplace.benefit_13th_salary', { defaultValue: '13. plat' }),
  t('rebuild.marketplace.benefit_part_time', { defaultValue: 'Zkrácený úvazek' }),
];

const getRoleFamilyOptions = (t: (key: string, opts?: { defaultValue: string }) => string) => [
  { value: 'all' as const, label: t('rebuild.marketplace.role_family_all', { defaultValue: 'Všechny obory' }) },
  { value: 'engineering' as const, label: 'Engineering' },
  { value: 'design' as const, label: 'Design' },
  { value: 'product' as const, label: 'Product' },
  { value: 'operations' as const, label: 'Operations' },
  { value: 'sales' as const, label: 'Sales' },
  { value: 'care' as const, label: t('rebuild.marketplace.role_family_care', { defaultValue: 'Péče a služby' }) },
  { value: 'frontline' as const, label: 'Frontline' },
  { value: 'marketing' as const, label: 'Marketing' },
  { value: 'finance' as const, label: 'Finance' },
  { value: 'people' as const, label: 'People/HR' },
  { value: 'education' as const, label: t('rebuild.marketplace.role_family_education', { defaultValue: 'Vzdělávání' }) },
  { value: 'health' as const, label: t('rebuild.marketplace.role_family_health', { defaultValue: 'Zdravotnictví' }) },
  { value: 'construction' as const, label: t('rebuild.marketplace.role_family_construction', { defaultValue: 'Stavba a řemesla' }) },
  { value: 'logistics' as const, label: t('rebuild.marketplace.role_family_logistics', { defaultValue: 'Logistika' }) },
  { value: 'legal' as const, label: t('rebuild.marketplace.role_family_legal', { defaultValue: 'Právo' }) },
];

const getTransportOptions = (t: (key: string, opts?: { defaultValue: string }) => string) => [
  { value: 'car' as const, label: t('rebuild.transport.car', { defaultValue: 'Auto' }), icon: Car },
  { value: 'public' as const, label: t('rebuild.transport.public', { defaultValue: 'MHD/Vlak' }), icon: Bus },
  { value: 'bike' as const, label: t('rebuild.transport.bike', { defaultValue: 'Kolo' }), icon: Bike },
  { value: 'walk' as const, label: t('rebuild.transport.walk', { defaultValue: 'Pěšky' }), icon: Footprints },
];

const benefitIconFor = (benefit: string) => {
  const normalized = benefit.toLowerCase();
  if (normalized.includes('dog')) return Dog;
  if (normalized.includes('child')) return Baby;
  if (normalized.includes('auto')) return Car;
  if (normalized.includes('ubyt') || normalized.includes('home')) return Home;
  return CheckCircle2;
};

const SearchFiltersModal: React.FC<{
  open: boolean;
  filters: MarketplaceFilters;
  searchValue: string;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  onSearchChange: (value: string) => void;
  onFiltersChange: (updater: React.SetStateAction<MarketplaceFilters>) => void;
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
}> = ({ open, filters, searchValue, onClose, onApply, onReset, onSearchChange, onFiltersChange, t }) => {
  if (!open) return null;

  const fieldShell = 'mt-2 flex h-12 items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-slate-500 dark:text-slate-400 shadow-sm focus-within:border-[#d4ad70] dark:focus-within:border-amber-500 focus-within:ring-4 focus-within:ring-[#f7ead5] dark:focus-within:ring-amber-500/20';
  const inputClass = 'h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400';
  const labelClass = 'block text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm p-3 md:p-6">
      <div className="grid max-h-[calc(100vh-1.5rem)] w-full max-w-[64rem] overflow-hidden rounded-[1.15rem] border border-white/60 dark:border-white/10 bg-[#ffffff] dark:bg-slate-900 shadow-[0_30px_90px_-36px_rgba(8,16,22,0.72)] md:max-h-[calc(100vh-3rem)] md:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="relative hidden min-h-[36rem] overflow-hidden bg-[linear-gradient(160deg,#fbfdff_0%,#f5f8f9_48%,#eef5f5_100%)] dark:bg-[linear-gradient(160deg,#0f172a_0%,#1e293b_48%,#0f172a_100%)] px-9 py-10 md:flex md:flex-col">
          <img src="/logo-transparent.png" alt="Jobshaman" className="dark:hidden h-12 w-12 rounded-full object-contain" loading="eager" />
          <img src="/logodark.png" alt="Jobshaman" className="hidden dark:block h-12 w-12 rounded-full object-contain" loading="eager" />
          <div className="mt-16">
            <h2 className="max-w-[14rem] text-[1.55rem] font-semibold leading-tight text-slate-950 dark:text-slate-100">
              {t('rebuild.marketplace.filter_title', { defaultValue: 'Najdi práci podle reality, ne podle náhodného keywordu.' })}
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {t('rebuild.marketplace.filter_desc', { defaultValue: 'Role, obor, místo, dojíždění, peníze a benefity se posílají do V2 katalogu jako jeden záměr.' })}
            </p>
          </div>
          <div className="relative mt-10 flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800 bg-[radial-gradient(circle_at_center,#f3d691_0%,#f8f4e8_34%,#eef7f6_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(243,214,145,0.1)_0%,rgba(248,244,232,0.05)_34%,rgba(238,247,246,0.02)_70%)]">
            <SlidersHorizontal size={92} className="relative z-10 text-[#1f6c80] drop-shadow-[0_24px_40px_rgba(31,108,128,0.16)]" />
          </div>
          <div className="mt-auto text-[0.72rem] font-semibold leading-4 text-slate-500 dark:text-slate-400">
            {t('rebuild.marketplace.filter_hint', { defaultValue: 'Dojezd a benefity jsou preference uchazeče, ne tvrdý HR filtr.' })}
          </div>
        </aside>

        <section key="filters-main" className="relative overflow-y-auto bg-[#ffffff] dark:bg-slate-900 px-5 py-6 md:px-8 md:py-8 min-h-0 max-h-full">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            aria-label="Zavřít"
          >
            <X size={18} />
          </button>

          <div className="pr-10">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{t('rebuild.marketplace.step_search', { defaultValue: '01 Vyhledávání' })}</div>
            <div className="mt-4 rounded-xl border border-[#c18a2d] bg-[#fff9ef] dark:bg-amber-950/20 px-4 py-4 shadow-[0_18px_38px_-32px_rgba(159,118,45,0.7)] dark:shadow-none">
              <label className={labelClass}>
                {t('rebuild.marketplace.position_label', { defaultValue: 'Název pozice nebo klíčový záměr' })}
                <span className={fieldShell + ' dark:bg-slate-800 dark:border-slate-700 dark:focus-within:ring-amber-500/20'}>
                  <Search size={16} />
                  <input
                    value={searchValue}
                    onChange={(event) => onSearchChange(event.target.value)}
                    className={inputClass + ' dark:text-slate-200'}
                    placeholder={t('rebuild.marketplace.search_placeholder_long', { defaultValue: 'např. skladník, product designer, práce se psy' })}
                    autoFocus
                  />
                </span>
              </label>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              {t('rebuild.marketplace.role_family', { defaultValue: 'Obor' })}
              <select
                value={filters.roleFamily}
                onChange={(event) => onFiltersChange((current) => ({ ...current, roleFamily: event.target.value as MarketplaceFilters['roleFamily'] }))}
                className={`${fieldShell} w-full appearance-none text-sm font-semibold text-slate-800 dark:text-slate-200 dark:bg-slate-800 dark:border-slate-700`}
              >
                {getRoleFamilyOptions(t).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              {t('rebuild.marketplace.location_label', { defaultValue: 'Místo práce' })}
              <span className={fieldShell + ' dark:bg-slate-800 dark:border-slate-700'}>
                <MapPin size={16} />
                <input
                  value={filters.city}
                  onChange={(event) => onFiltersChange((current) => ({ ...current, city: event.target.value }))}
                  className={inputClass + ' dark:text-slate-200'}
                  placeholder={t('rebuild.marketplace.city_placeholder', { defaultValue: 'Praha, Brno, Ostrava...' })}
                />
              </span>
            </label>
            <label className={labelClass}>
              {t('rebuild.marketplace.min_salary', { defaultValue: 'Minimální mzda' })}
              <span className={fieldShell + ' dark:bg-slate-800 dark:border-slate-700'}>
                <Banknote size={16} />
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={filters.minSalary || ''}
                  onChange={(event) => onFiltersChange((current) => ({ ...current, minSalary: Number(event.target.value || 0) }))}
                  className={inputClass + ' dark:text-slate-200'}
                  placeholder={t('rebuild.marketplace.min_salary_placeholder', { defaultValue: 'např. 45000' })}
                />
              </span>
            </label>
            <label className={labelClass}>
              {t('rebuild.marketplace.work_arrangement', { defaultValue: 'Forma práce' })}
              <select
                value={filters.remoteOnly ? 'remote' : filters.workArrangement}
                onChange={(event) => {
                  const next = event.target.value as MarketplaceFilters['workArrangement'];
                  onFiltersChange((current) => ({ ...current, remoteOnly: next === 'remote', workArrangement: next === 'remote' ? 'all' : next }));
                }}
                className={`${fieldShell} w-full appearance-none text-sm font-semibold text-slate-800 dark:text-slate-200 dark:bg-slate-800 dark:border-slate-700`}
              >
                <option value="all">{t('rebuild.marketplace.work_arrangement_all', { defaultValue: 'Všechny formy' })}</option>
                <option value="remote">{t('rebuild.marketplace.work_arrangement_remote', { defaultValue: 'Pouze remote' })}</option>
                <option value="hybrid">{t('rebuild.marketplace.work_arrangement_hybrid', { defaultValue: 'Hybrid' })}</option>
                <option value="onsite">{t('rebuild.marketplace.work_arrangement_onsite', { defaultValue: 'Na místě' })}</option>
              </select>
            </label>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('rebuild.marketplace.commute_label', { defaultValue: '02 Dojíždění' })}</div>
                <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{t('rebuild.marketplace.up_to_radius', { defaultValue: 'Do {{radius}} km', radius: filters.radiusKm })}</div>
              </div>
              <span className="rounded-full bg-white dark:bg-slate-800 px-3 py-1 text-xs font-bold text-[#1f6c80] dark:text-cyan-400 shadow-sm">{getTransportOptions(t).find((item) => item.value === filters.transportMode)?.label}</span>
            </div>
            <input
              type="range"
              min={5}
              max={180}
              step={5}
              value={filters.radiusKm}
              onChange={(event) => onFiltersChange((current) => ({ ...current, radiusKm: Number(event.target.value) }))}
              className="mt-4 w-full accent-[#b98331]"
            />
          </div>

          <div className="mt-6">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500">{t('rebuild.marketplace.step_transport', { defaultValue: '04 Preferovaný způsob dojíždění' })}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {getTransportOptions(t).map((option) => {
                const active = filters.transportMode === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onFiltersChange((current) => ({ ...current, transportMode: option.value }))}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${active ? 'border-[#12afcb] bg-[#eefaff] text-[#0d8ca3] dark:bg-cyan-950 dark:text-cyan-400' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-[#12afcb]'}`}
                  >
                    <Icon size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500">{t('rebuild.marketplace.step_benefits', { defaultValue: '03 Benefity a životní preference' })}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {getBenefitOptions(t).map((benefit) => {
                const active = filters.benefits.includes(benefit);
                const Icon = benefitIconFor(benefit);
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
                    className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${active ? 'border-[#c18a2d] bg-[#fff9ef] text-[#9f762d] dark:bg-amber-950/40 dark:text-amber-400' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-[#d4ad70]'}`}
                  >
                    <Icon size={14} />
                    <span className="truncate">{benefit}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800 pt-5 sm:flex-row">
            <button type="button" onClick={onReset} className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 text-sm font-bold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700">
              {t('rebuild.marketplace.reset_filters', { defaultValue: 'Resetovat' })}
            </button>
            <button type="button" onClick={onApply} className="inline-flex h-12 flex-1 items-center justify-center gap-3 rounded-xl bg-[#b98331] px-5 text-sm font-bold text-white shadow-[0_18px_34px_-24px_rgba(159,118,45,0.88)] transition hover:bg-[#a57124]">
              {t('rebuild.marketplace.apply_filters', { defaultValue: 'Použít filtry' })}
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

const jcfpmMetricFallback = [
  { label: 'Práce rukama', value: 85 },
  { label: 'Stabilita', value: 80 },
  { label: 'Týmovost', value: 75 },
  { label: 'Učení se', value: 70 },
  { label: 'Fyzická zátěž', value: 65 },
];

const buildKompasMetrics = (userProfile: UserProfile) => {
  const scores = Array.isArray(userProfile.preferences?.jcfpm_v1?.dimension_scores)
    ? userProfile.preferences.jcfpm_v1.dimension_scores
    : [];
  const mapped = scores
    .map((score: any) => ({
      label: String(score.label || score.dimension || '').replace(/^d\d+_/, '').replace(/_/g, ' '),
      value: Math.max(0, Math.min(100, Math.round(Number(score.percentile || score.raw_score || 0)))),
    }))
    .filter((item) => item.label && item.value > 0)
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);
  return mapped.length >= 3 ? mapped : jcfpmMetricFallback;
};

const MarketplaceSchema: React.FC<{ roles: Role[]; t: any }> = ({ roles, t }) => {
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": t('rebuild.marketplace.recommended_for_you', { defaultValue: 'Recommended for you' }),
    "itemListElement": roles.slice(0, 10).map((role, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "url": `https://jobshaman.cz${getRolePath(role)}`,
      "name": role.title
    }))
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "JobShaman",
        "item": "https://jobshaman.cz"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": t('rebuild.nav.marketplace', { defaultValue: 'Marketplace' }),
        "item": "https://jobshaman.cz/marketplace"
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </>
  );
};

export const MarketplaceV2: React.FC<{
  roles: Role[];
  loading?: boolean;
  hasMore?: boolean;
  totalCount?: number;
  userProfile: UserProfile;
  preferences: CandidatePreferenceProfile;
  filters: MarketplaceFilters;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onFiltersChange: (updater: React.SetStateAction<MarketplaceFilters>) => void;
  onResetFilters: () => void;
  sections?: MarketplaceSection[];
  savedRoleIds?: string[];
  candidateApplications?: DialogueSummary[];
  onSignOut?: () => void;
  onCompanySwitch?: () => void;
  onLoadMore?: () => void;
  currentLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  navigate: (path: string) => void;
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
}> = ({ roles, loading = false, hasMore = false, totalCount = 0, userProfile, preferences, filters, searchValue, onSearchChange, onFiltersChange, onResetFilters, sections = [], savedRoleIds = [], candidateApplications = [], onSignOut, onCompanySwitch, onLoadMore, currentLanguage, onLanguageChange, navigate, t }) => {
  const [visibleRecommendationCount, setVisibleRecommendationCount] = React.useState(RECOMMENDATION_PAGE_SIZE);
  const [focusMode, setFocusMode] = React.useState<MarketplaceFocus>('all');
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const navItems = [
    { id: 'home', label: t('rebuild.nav.home', { defaultValue: 'Domů' }), icon: LayoutDashboard, path: '/candidate/insights' },
    { id: 'profile', label: t('rebuild.nav.profile', { defaultValue: 'Profil' }), icon: CircleUserRound, path: '/candidate/profile' },
    { id: 'jcfpm', label: t('rebuild.nav.jcfpm', { defaultValue: 'Sebepoznání' }), icon: BrainCircuit, path: '/candidate/jcfpm' },
    { id: 'work', label: t('rebuild.nav.work', { defaultValue: 'Práce' }), icon: Briefcase, path: '/candidate/marketplace' },
    { id: 'applications', label: t('rebuild.nav.applications', { defaultValue: 'Žádosti' }), icon: MessageSquare, path: '/candidate/applications' },
    { id: 'learning', label: t('rebuild.nav.learning', { defaultValue: 'Učení' }), icon: GraduationCap, path: '/candidate/learning' },
  ];

  const domesticCountryCode = preferences.taxProfile?.countryCode || 'CZ';

  const effectiveCoordinates = React.useMemo(() => {
    const staticCoordinates = getStaticCoordinates(preferences.address || '');
    const currentCoordinates = preferences.coordinates || null;

    if (staticCoordinates && (!currentCoordinates || isDefaultPragueCoordinates(currentCoordinates))) {
      return staticCoordinates;
    }

    if (staticCoordinates && currentCoordinates) {
      const addressDriftKm = getDistance(
        staticCoordinates.lat,
        staticCoordinates.lon,
        currentCoordinates.lat,
        currentCoordinates.lon,
      );
      if (addressDriftKm > Math.max(50, preferences.searchRadiusKm * 1.5)) {
        return staticCoordinates;
      }
    }

    return currentCoordinates || staticCoordinates;
  }, [preferences.address, preferences.coordinates, preferences.searchRadiusKm]);

  const visibleRoles = React.useMemo(() => {
    const query = [searchValue, filters.targetRole].join(' ').trim().toLowerCase();
    const benefitNeedles = filters.benefits.map((item) => item.toLowerCase());
    const scoped = (filters.crossBorder ? roles : roles.filter((role) => role.countryCode === domesticCountryCode))
      .filter((role) => filters.roleFamily === 'all' || role.roleFamily === filters.roleFamily)
      .filter((role) => !filters.curatedOnly || role.source === 'curated')
      .filter((role) => !filters.remoteOnly || isRemoteRole(role))
      .filter((role) => filters.workArrangement === 'all' || (filters.workArrangement === 'onsite' ? role.workModel === 'On-site' : role.workModel.toLowerCase() === filters.workArrangement))
      .filter((role) => !filters.minSalary || Math.max(role.salaryFrom || 0, role.salaryTo || 0) >= filters.minSalary)
      .filter((role) => !filters.city || role.location.toLowerCase().includes(filters.city.toLowerCase()))
      .filter((role) => {
        if (!benefitNeedles.length) return true;
        const haystack = role.benefits.join(' ').toLowerCase();
        return benefitNeedles.every((benefit) => haystack.includes(benefit));
      })
      .filter((role) => {
        if (!query) return true;
        const haystack = [role.title, role.companyName, role.location, role.summary, role.description, role.skills.join(' '), role.benefits.join(' ')].join(' ').toLowerCase();
        return query.split(/\s+/).every((part) => haystack.includes(part));
      });
    if (focusMode === 'immediate') return scoped.filter((role) => !isRemoteRole(role));
    if (focusMode === 'curated') return scoped.filter((role) => role.source === 'curated');
    return scoped;
  }, [domesticCountryCode, filters, focusMode, roles, searchValue]);

  const rolesWithDistance = React.useMemo(() => {
    if (!effectiveCoordinates) {
      return visibleRoles.map((role) => ({ role, distanceKm: Infinity }));
    }

    const userLat = effectiveCoordinates.lat;
    const userLon = effectiveCoordinates.lon;

    return visibleRoles
      .map((role) => ({
        role,
        distanceKm: getDistance(userLat, userLon, role.coordinates.lat, role.coordinates.lng),
      }))
      .sort((a, b) => {
        // Secondary sort by curated vs imported
        if (Math.abs(a.distanceKm - b.distanceKm) < 1) {
          if (a.role.source === 'curated' && b.role.source === 'imported') return -1;
          if (a.role.source === 'imported' && b.role.source === 'curated') return 1;
        }

        return a.distanceKm - b.distanceKm;
      });
  }, [visibleRoles, effectiveCoordinates]);

  const localRadiusKm = Math.max(1, Number(filters.radiusKm || preferences.searchRadiusKm || 45));
  const nearbyRoles = React.useMemo(() => (
    rolesWithDistance.filter(({ role, distanceKm }) => (
      Number.isFinite(distanceKm)
      && distanceKm <= localRadiusKm
      && !isRemoteRole(role)
    ))
  ), [localRadiusKm, rolesWithDistance]);

  const featuredCandidate = nearbyRoles[0] || null;
  const featuredRole = featuredCandidate?.role || null;
  const scopedRecommendationCandidates = React.useMemo(() => {
    const localRoleIds = new Set(nearbyRoles.map(({ role }) => role.id));
    return rolesWithDistance
      .filter(({ role }) => !featuredRole || role.id !== featuredRole.id)
      .filter(({ role, distanceKm }) => (
        isRemoteRole(role)
        || (Number.isFinite(distanceKm) && distanceKm <= localRadiusKm)
      ))
      .sort((a, b) => {
        const aLocalBoost = localRoleIds.has(a.role.id) ? -2 : 0;
        const bLocalBoost = localRoleIds.has(b.role.id) ? -2 : 0;
        const aRemoteBoost = isRemoteRole(a.role) ? 0 : -1;
        const bRemoteBoost = isRemoteRole(b.role) ? 0 : -1;
        const scoreA = aLocalBoost + aRemoteBoost;
        const scoreB = bLocalBoost + bRemoteBoost;
        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.distanceKm - b.distanceKm;
      });
  }, [featuredRole, localRadiusKm, nearbyRoles, rolesWithDistance]);
  const visibleRecommendedCandidates = scopedRecommendationCandidates.slice(0, visibleRecommendationCount);
  const hasMoreRecommendations = visibleRecommendationCount < scopedRecommendationCandidates.length;
  const outOfRadiusCount = React.useMemo(() => (
    rolesWithDistance.filter(({ role, distanceKm }) => (
      !isRemoteRole(role)
      && Number.isFinite(distanceKm)
      && distanceKm > localRadiusKm
    )).length
  ), [localRadiusKm, rolesWithDistance]);
  const trainingRoles = rolesWithDistance.filter(({ role }) => role.source === 'curated').slice(0, 6).map(({ role }) => role);

  React.useEffect(() => {
    setVisibleRecommendationCount(RECOMMENDATION_PAGE_SIZE);
  }, [filters, focusMode, localRadiusKm, preferences.address, roles.length]);

  const kompasMetrics = React.useMemo(() => buildKompasMetrics(userProfile), [userProfile]);
  const handleQuickAction = React.useCallback((actionId: string) => {
    if (actionId === 'immediate') {
      setFocusMode((current) => current === 'immediate' ? 'all' : 'immediate');
      return;
    }
    if (actionId === 'pivot') {
      setFocusMode((current) => current === 'curated' ? 'all' : 'curated');
      return;
    }
    if (actionId === 'unsure' || actionId === 'improve') {
      navigate('/candidate/jcfpm');
    }
  }, [navigate]);

  // Smarter city extraction from address
  const locationLabel = React.useMemo(() => {
    const addr = preferences.address || '';
    if (!addr) return t('rebuild.marketplace.default_location', { defaultValue: 'Česká republika' });
    const parts = addr.split(',').map(p => p.trim());
    // Often address is "Street 123, City, Zip, Country" or "City, Country"
    // Try to find a part that doesn't look like a street or zip
    const cityPart = parts.find(p => !/\d/.test(p)) || parts[0];
    return cityPart;
  }, [preferences.address]);

  const sectionTitleClass = "flex items-center justify-between mb-5 px-1";
  const h3Class = "text-[18px] font-black text-slate-900";
  const viewAllClass = "text-[12px] font-bold text-[#12afcb] hover:underline";
  const firstName = userProfile.isLoggedIn ? userProfile.name?.split(' ')[0] : '';
  const activeFilterCount = [
    searchValue.trim(),
    filters.city.trim(),
    filters.roleFamily !== 'all',
    filters.remoteOnly || filters.workArrangement !== 'all',
    filters.crossBorder !== preferences.borderSearchEnabled,
    filters.radiusKm !== preferences.searchRadiusKm,
    filters.minSalary > 0,
    filters.curatedOnly,
    ...filters.benefits,
  ].filter(Boolean).length;
  const openDialogueCount = React.useMemo(() => (
    candidateApplications.filter((item) => !['withdrawn', 'closed', 'rejected', 'hired'].includes(String(item.status || '').toLowerCase())).length
  ), [candidateApplications]);
  const activityStats = React.useMemo(() => [
    { id: 'loaded', label: t('rebuild.marketplace.activity_loaded', { defaultValue: 'Načtené nabídky' }), value: roles.length, icon: <Eye size={14} /> },
    { id: 'recommended', label: t('rebuild.marketplace.activity_recommended', { defaultValue: 'V aktuálním výběru' }), value: scopedRecommendationCandidates.length, icon: <CheckCircle2 size={14} /> },
    { id: 'saved', label: t('rebuild.marketplace.activity_saved', { defaultValue: 'Uložené role' }), value: savedRoleIds.length, icon: <Bookmark size={14} /> },
    { id: 'dialogues', label: t('rebuild.marketplace.activity_dialogues', { defaultValue: 'Otevřené dialogy' }), value: openDialogueCount, icon: <Handshake size={14} /> },
  ], [openDialogueCount, roles.length, savedRoleIds.length, scopedRecommendationCandidates.length, t]);
  const shamanTip = React.useMemo(() => {
    if (featuredRole) {
      return t('rebuild.marketplace.tip_featured', {
        defaultValue: 'Nejbližší konkrétní tah je {{title}} ve firmě {{company}}. Otevři detail a ověř hlavně mzdu, dojezd a první krok handshaku.',
        title: featuredRole.title,
        company: featuredRole.companyName || 'bez uvedené firmy'
      });
    }
    if (filters.benefits.length > 2) {
      return t('rebuild.marketplace.tip_too_many_benefits', { defaultValue: 'Benefitů máš vybraných hodně. Nech si ty, které opravdu mění tvůj den, jinak si filtruješ trh do slepé uličky.' });
    }
    if (outOfRadiusCount > 0) {
      return t('rebuild.marketplace.tip_out_of_radius', {
        defaultValue: '{{count}} nabídek je mimo tvůj dojezd. Buď zvedni radius, nebo přestaň dělat kompromis, který tě bude štvát každý den.',
        count: outOfRadiusCount
      });
    }
    return t('rebuild.marketplace.tip_fill_filters', { defaultValue: 'Doplň cílovou roli, místo a minimální mzdu. Bez těchto tří údajů doporučení spíš hádá, než čte tvoji realitu.' });
  }, [featuredRole, filters.benefits.length, outOfRadiusCount]);

  return (
    <>
      <SearchFiltersModal
        open={filtersOpen}
        filters={filters}
        searchValue={searchValue}
        onClose={() => setFiltersOpen(false)}
        onApply={() => setFiltersOpen(false)}
        onReset={onResetFilters}
        onSearchChange={onSearchChange}
        onFiltersChange={onFiltersChange}
        t={t}
      />
      <DashboardLayoutV2
        userRole="candidate"
        navItems={navItems}
        activeItemId="work"
        onNavigate={(_id, path) => { if (path) navigate(path); }}
        userProfile={userProfile}
        onSignOut={onSignOut}
        onCompanySwitch={onCompanySwitch}
        currentLanguage={currentLanguage}
        onLanguageChange={onLanguageChange}
        title={firstName ? t('rebuild.marketplace.greeting', { name: firstName }) : t('rebuild.marketplace.welcome_title')}
        subtitle={firstName ? t('rebuild.marketplace.welcome_title') : t('rebuild.marketplace.welcome_subtitle')}
        t={t}
        actionRegion={
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setFiltersOpen(true)} className="hidden min-w-[18rem] items-center gap-3 rounded-full border border-[#f0e8d8] dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-left text-[13px] font-bold text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700 sm:flex">
              <Search size={16} className="text-[#12afcb]" />
              <span className="min-w-0 flex-1 truncate">{searchValue || filters.city || t('rebuild.marketplace.marketplace_placeholder')}</span>
              {activeFilterCount ? <span className="rounded-full bg-[#fff6e4] dark:bg-amber-950/40 px-2 py-0.5 text-[11px] text-[#9f762d] dark:text-amber-500">{activeFilterCount}</span> : null}
            </button>
            <button type="button" onClick={() => setFiltersOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-full border border-[#f0e8d8] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700 sm:hidden" aria-label="Otevřít vyhledávání">
              <SlidersHorizontal size={16} />
            </button>
            <button type="button" onClick={() => navigate('/candidate/insights#mentor')} className="hidden items-center gap-2 rounded-full border border-[#f0e8d8] dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-[13px] font-bold text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700 lg:flex">
              <MessageCircle size={16} className="text-amber-500" />
              {t('rebuild.marketplace.cybershaman_mentor')}
            </button>
          </div>
        }
      >
        <MarketplaceSchema roles={visibleRoles} t={t} />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] xl:gap-8">
          {/* Main Column - min-w-0 is crucial to prevent content from stretching the grid */}
          <div className="min-w-0 space-y-10 pb-12">
            {/* Quick Actions */}
            <QuickActionButtons
              activeAction={focusMode === 'immediate' ? 'immediate' : focusMode === 'curated' ? 'pivot' : undefined}
              onAction={handleQuickAction}
            />

            {/* Featured Section */}
            <section key="featured">
              <div className={sectionTitleClass}>
                <h3 className={h3Class + ' dark:text-slate-100'}>
                  {t('rebuild.marketplace.local_jobs')}
                  <span className="ml-2 text-sm font-medium text-slate-400">
                    {locationLabel} {t('rebuild.marketplace.radius_label', { radius: localRadiusKm })}
                  </span>
                </h3>
                <button type="button" onClick={() => setFocusMode((current) => current === 'immediate' ? 'all' : 'immediate')} className={viewAllClass}>
                  {focusMode === 'immediate' ? t('rebuild.marketplace.show_all') : t('rebuild.marketplace.only_local')}
                </button>
              </div>
              {featuredRole ? (
                <FeaturedRoleCard
                  role={featuredRole}
                  distanceKm={featuredCandidate?.distanceKm ?? null}
                  onOpen={() => navigate(getRolePath(featuredRole))}
                />
              ) : (
                <div className="rounded-[28px] border border-dashed border-[#eadfc9] dark:border-slate-700 bg-white/55 dark:bg-slate-900/55 p-7 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400 shadow-[0_18px_40px_-34px_rgba(72,55,24,0.18)] dark:shadow-none">
                  {t('rebuild.marketplace.no_local_jobs', { defaultValue: 'V okolí {{location}} aktuálně nejsou žádné aktivní výzvy v okruhu {{radius}} km.', radius: localRadiusKm, location: locationLabel })}
                </div>
              )}
            </section>

            {/* Recommended Sections (New Hybrid Engine) */}
            {sections.length > 0 ? (
              sections.map((section) => (
                <section key={section.id || section.title}>
                  <div className={sectionTitleClass}>
                    <h3 className={h3Class + ' dark:text-slate-100'}>
                      {section.title}
                      <span className="ml-2 text-sm font-medium text-slate-400">{section.description}</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {section.items.map((role) => (
                      <DiscoveryRoleCard
                        key={role.id}
                        role={role}
                        distanceKm={getDistance(effectiveCoordinates?.lat ?? 0, effectiveCoordinates?.lon ?? 0, role.coordinates.lat, role.coordinates.lng)}
                        onOpen={() => navigate(getRolePath(role))}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              /* Legacy Recommended Section fallback */
              <section key="legacy-recommended">
                <div className={sectionTitleClass}>
                  <h3 className={h3Class + ' dark:text-slate-100'}>{t('rebuild.marketplace.recommended_for_you')} <span className="ml-2 text-sm font-medium text-slate-400">{t('rebuild.marketplace.based_on_profile')}</span></h3>
                  <div className="text-[12px] font-bold text-slate-400">
                    {t('rebuild.marketplace.relevant_count', { relevant: scopedRecommendationCandidates.length, total: visibleRoles.length })}
                  </div>
                </div>
                <div className="mb-4 rounded-[22px] border border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 px-5 py-3 text-[12px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  {t('rebuild.marketplace.summary_hint', { radius: localRadiusKm, outCount: outOfRadiusCount, totalCount: totalCount })}
                </div>
                {visibleRecommendedCandidates.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {visibleRecommendedCandidates.map(({ role, distanceKm }) => (
                      <DiscoveryRoleCard
                        key={role.id}
                        role={role}
                        distanceKm={distanceKm}
                        onOpen={() => navigate(getRolePath(role))}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-[#eadfc9] dark:border-slate-700 bg-white/55 dark:bg-slate-900/55 p-7 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                    {t('rebuild.marketplace.no_more_recommendations', { defaultValue: 'V aktuálním radiusu nemám další vhodné nabídky. Zkus zvětšit dojezd v profilu nebo zapnout širší hledání.' })}
                  </div>
                )}
                {hasMoreRecommendations ? (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleRecommendationCount((current) => current + RECOMMENDATION_PAGE_SIZE)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#e9dcc3] dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-[13px] font-bold text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-[#fff9ef] dark:hover:bg-slate-700"
                    >
                      <Loader2 size={15} className="text-[#12afcb]" />
                      {t('rebuild.marketplace.load_more')}
                      <span className="text-slate-400">
                        {t('rebuild.marketplace.remaining_in_batch', { count: Math.min(RECOMMENDATION_PAGE_SIZE, scopedRecommendationCandidates.length - visibleRecommendationCount) })}
                      </span>
                    </button>
                  </div>
                ) : null}
                {hasMore && onLoadMore ? (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={onLoadMore}
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-2xl border border-[#d8edf2] bg-[#eef8fb] px-5 py-3 text-[13px] font-bold text-[#08788a] shadow-sm transition hover:bg-[#e3f4f8] disabled:cursor-wait disabled:opacity-70"
                    >
                      {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                      {loading ? t('rebuild.marketplace.loading_catalog') : t('rebuild.marketplace.load_from_db')}
                      <span className="text-[#6aa7b2]">{roles.length.toLocaleString('cs-CZ')} / {totalCount.toLocaleString('cs-CZ')}</span>
                    </button>
                  </div>
                ) : null}
              </section>
            )}

            {/* Training Section */}
            {trainingRoles.length > 0 && (
              <section key="training">
                <div className={sectionTitleClass}>
                  <h3 className={h3Class + ' dark:text-slate-100'}>{t('rebuild.marketplace.try_something_new')} <span className="ml-2 text-sm font-medium text-slate-400">{t('rebuild.marketplace.with_shaman_support')}</span></h3>
                  <button type="button" onClick={() => setFocusMode('curated')} className={viewAllClass}>{t('rebuild.marketplace.show_all')}</button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {trainingRoles.map((role) => (
                    <DiscoveryRoleCard
                      key={role.id}
                      role={role}
                      onOpen={() => navigate(getRolePath(role))}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Sandbox Section */}
            <section key="sandbox">
              <div className={sectionTitleClass}>
                <h3 className={h3Class + ' dark:text-slate-100'}>{t('rebuild.marketplace.sandbox_title')} <span className="ml-2 text-sm font-medium text-slate-400">{t('rebuild.marketplace.sandbox_subtitle')}</span></h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <MiniSandboxCard title={t('rebuild.marketplace.sandbox_warehouse')} sub={t('rebuild.marketplace.sandbox_warehouse_sub')} onOpen={() => setFocusMode('immediate')} />
                <MiniSandboxCard title={t('rebuild.marketplace.sandbox_vzv')} sub={t('rebuild.marketplace.sandbox_vzv_sub')} onOpen={() => setFocusMode('immediate')} />
                <MiniSandboxCard title={t('rebuild.marketplace.sandbox_production')} sub={t('rebuild.marketplace.sandbox_production_sub')} onOpen={() => setFocusMode('immediate')} />
              </div>
            </section>
          </div>

          {/* Right Sidebar */}
          <aside className="space-y-8 lg:pt-2">
            {/* Kompas */}
            <div className="rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-6 shadow-sm backdrop-blur-sm">
              <h3 className="mb-6 text-[18px] font-black text-slate-900 dark:text-slate-100">{t('rebuild.marketplace.your_kompas')}</h3>
              <CandidateKompas score={85} metrics={kompasMetrics} />
            </div>

            {/* Tip */}
            <div className="relative overflow-hidden rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-6 shadow-sm backdrop-blur-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[16px] font-black text-slate-900 dark:text-slate-100">{t('rebuild.marketplace.shaman_tip')}</h3>
                  <p className="mt-2 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {shamanTip}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={() => navigate('/candidate/insights#mentor')} className="flex items-center gap-2 rounded-full border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-[12px] font-bold text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700">
                  <MessageCircle size={14} className="text-[#12afcb]" />
                  {t('rebuild.marketplace.talk_to_shaman')}
                </button>
              </div>
              {/* Abstract background image/graphic could go here */}
              <div className="absolute -bottom-4 -right-4 h-24 w-24 opacity-10">
                <img src="/logo-transparent.png" alt="" className="dark:hidden h-full w-full object-contain" />
                <img src="/logodark.png" alt="" className="hidden dark:block h-full w-full object-contain" />
              </div>
            </div>

            {/* Activity */}
            <div className="rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-6 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[16px] font-black text-slate-900 dark:text-slate-100">{t('rebuild.marketplace.activity_title', { defaultValue: 'Aktivita' })}</h3>
                <button type="button" onClick={() => navigate('/candidate/insights')} className="text-[11px] font-bold text-[#12afcb] hover:underline">{t('rebuild.marketplace.activity_view_all', { defaultValue: 'Zobrazit vše' })}</button>
              </div>
              <div className="space-y-4">
                {activityStats.map((stat) => (
                  <div key={stat.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
                        {stat.icon}
                      </div>
                      <span className="text-[13px] font-medium">{stat.label}</span>
                    </div>
                    <span className="text-[15px] font-black text-slate-900 dark:text-slate-100">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </DashboardLayoutV2>
    </>
  );
};
