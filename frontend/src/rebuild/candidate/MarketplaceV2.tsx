import React from 'react';
import {
  LayoutDashboard,
  ArrowRight,
  Briefcase,
  CircleUserRound,
  MessageSquare,
  CheckCircle2,
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
  ChevronDown,
} from 'lucide-react';
import { DashboardLayoutV2 } from '../ui/DashboardLayoutV2';
import { Role, CandidatePreferenceProfile, MarketplaceFilters, MarketplaceSection } from '../models';
import { DialogueSummary, UserProfile } from '../../types';
import {
  FeaturedRoleCard,
  DiscoveryRoleCard,
} from './MarketplaceComponents';
import { 
  SearchFiltersModal, 
  getRoleFamilyOptions 
} from './MarketplaceSearchFilters';
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
type RoleCandidate = { role: Role; distanceKm: number };
export type RoleClusterId = 'management' | 'operations' | 'business' | 'digital' | 'services' | 'other';

const diversifyCandidatesByLocation = (candidates: RoleCandidate[]): RoleCandidate[] => {
  const buckets = new Map<string, RoleCandidate[]>();
  candidates.forEach((candidate) => {
    const locationKey = String(candidate.role.location || 'unknown')
      .toLowerCase()
      .split(/[,\-/|]/, 1)[0]
      .trim() || 'unknown';
    buckets.set(locationKey, [...(buckets.get(locationKey) || []), candidate]);
  });

  const mixed: RoleCandidate[] = [];
  while (buckets.size > 0) {
    Array.from(buckets.entries()).forEach(([key, bucket]) => {
      const next = bucket.shift();
      if (next) mixed.push(next);
      if (bucket.length === 0) buckets.delete(key);
    });
  }
  return mixed;
};

// SearchFiltersModal and associated helpers moved to MarketplaceSearchFilters.tsx


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
  onLoadMoreCategory?: (categoryId: RoleClusterId) => void;
  loadingCategoryId?: RoleClusterId | null;
  currentLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  navigate: (path: string) => void;
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
}> = ({ roles, loading = false, hasMore = false, totalCount = 0, userProfile, preferences, filters, searchValue, onSearchChange, onFiltersChange, onResetFilters, sections = [], onSignOut, onCompanySwitch, onLoadMore, onLoadMoreCategory, loadingCategoryId = null, currentLanguage, onLanguageChange, navigate, t }) => {
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
    const manualCity = filters.city.trim().length > 0;
    const scoped = (filters.crossBorder || manualCity ? roles : roles.filter((role) => role.countryCode === domesticCountryCode))
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

  const localRadiusKm = Math.max(1, Number(filters.radiusKm || preferences.searchRadiusKm || 45));
  const commuteFilterActive = filters.enableCommuteFilter !== false;

  const rolesWithDistance = React.useMemo(() => {
    if (!effectiveCoordinates) {
      return visibleRoles.map((role) => ({ role, distanceKm: Infinity }));
    }

    const userLat = effectiveCoordinates.lat;
    const userLon = effectiveCoordinates.lon;

    const withDistance = visibleRoles.map((role) => ({
      role,
      distanceKm: getDistance(userLat, userLon, role.coordinates.lat, role.coordinates.lng),
    }));

    if (!commuteFilterActive && !filters.city.trim()) {
      return withDistance;
    }

    return withDistance.sort((a, b) => {
      // Secondary sort by curated vs imported
      if (Math.abs(a.distanceKm - b.distanceKm) < 1) {
        if (a.role.source === 'curated' && b.role.source === 'imported') return -1;
        if (a.role.source === 'imported' && b.role.source === 'curated') return 1;
      }

      return a.distanceKm - b.distanceKm;
    });
  }, [commuteFilterActive, filters.city, visibleRoles, effectiveCoordinates]);
  const nearbyRoles = React.useMemo(() => (
    commuteFilterActive ? rolesWithDistance.filter(({ role, distanceKm }) => (
      Number.isFinite(distanceKm)
      && distanceKm <= localRadiusKm
      && !isRemoteRole(role)
    )) : []
  ), [commuteFilterActive, localRadiusKm, rolesWithDistance]);

  const featuredCandidate = nearbyRoles[0] || null;
  const featuredRole = featuredCandidate?.role || null;
  const scopedRecommendationCandidates = React.useMemo(() => {
    const localRoleIds = new Set(nearbyRoles.map(({ role }) => role.id));
    const base = rolesWithDistance
      .filter(({ role }) => !featuredRole || role.id !== featuredRole.id)
      .filter(({ role, distanceKm }) => (
        !commuteFilterActive
        || filters.city.trim().length > 0
        || isRemoteRole(role)
        || (Number.isFinite(distanceKm) && distanceKm <= localRadiusKm)
      ));

    if (!commuteFilterActive && !filters.city.trim()) {
      return diversifyCandidatesByLocation(base);
    }

    return base.sort((a, b) => {
      const aLocalBoost = localRoleIds.has(a.role.id) ? -2 : 0;
      const bLocalBoost = localRoleIds.has(b.role.id) ? -2 : 0;
      const aRemoteBoost = isRemoteRole(a.role) ? 0 : -1;
      const bRemoteBoost = isRemoteRole(b.role) ? 0 : -1;
      const scoreA = aLocalBoost + aRemoteBoost;
      const scoreB = bLocalBoost + bRemoteBoost;
      if (scoreA !== scoreB) return scoreA - scoreB;
      return a.distanceKm - b.distanceKm;
    });
  }, [commuteFilterActive, featuredRole, filters.city, localRadiusKm, nearbyRoles, rolesWithDistance]);
  const visibleRecommendedCandidates = scopedRecommendationCandidates.slice(0, visibleRecommendationCount);
  const hasMoreRecommendations = visibleRecommendationCount < scopedRecommendationCandidates.length;
  const spotlightCandidate = commuteFilterActive ? null : visibleRecommendedCandidates[0] || null;
  const gridCandidates = commuteFilterActive ? visibleRecommendedCandidates : visibleRecommendedCandidates.slice(1);
  const profileRelevanceText = React.useMemo(() => normalizeProfileText([
    searchValue,
    filters.targetRole,
    userProfile.jobTitle,
    userProfile.preferences?.desired_role,
    userProfile.preferences?.searchProfile?.targetRole,
    userProfile.preferences?.searchProfile?.inferredTargetRole,
    userProfile.cvAiText,
    userProfile.cvText,
    preferences.story,
  ].join(' ')), [filters.targetRole, preferences.story, searchValue, userProfile.cvAiText, userProfile.cvText, userProfile.jobTitle, userProfile.preferences]);
  const catalogSections = React.useMemo(() => {
    const buckets: Record<RoleClusterId, RoleCandidate[]> = {
      management: [],
      operations: [],
      business: [],
      digital: [],
      services: [],
      other: [],
    };

    gridCandidates.forEach((candidate) => {
      buckets[getRoleClusterId(candidate.role)].push(candidate);
    });

    const definitions: Array<{
      id: keyof typeof buckets;
      title: string;
      description: string;
    }> = [
      {
        id: 'management',
        title: t('rebuild.marketplace.cluster_management', { defaultValue: 'Projektové a provozní řízení' }),
        description: t('rebuild.marketplace.cluster_management_desc', { defaultValue: 'Manažerské, koordinační a projektové role, kde se řeší lidé, procesy a dodání výsledku.' }),
      },
      {
        id: 'operations',
        title: t('rebuild.marketplace.cluster_operations', { defaultValue: 'Výroba, provoz a logistika' }),
        description: t('rebuild.marketplace.cluster_operations_desc', { defaultValue: 'Role v terénu, provozu, skladech, stavbě a každodenním řízení práce.' }),
      },
      {
        id: 'business',
        title: t('rebuild.marketplace.cluster_business', { defaultValue: 'Obchod, administrativa a finance' }),
        description: t('rebuild.marketplace.cluster_business_desc', { defaultValue: 'Pozice pro práci s klienty, čísly, procesy, lidmi a podporou firmy.' }),
      },
      {
        id: 'digital',
        title: t('rebuild.marketplace.cluster_digital', { defaultValue: 'Technologie, produkt a design' }),
        description: t('rebuild.marketplace.cluster_digital_desc', { defaultValue: 'Digitální a produktové role od vývoje po UX, data a systémovou práci.' }),
      },
      {
        id: 'services',
        title: t('rebuild.marketplace.cluster_services', { defaultValue: 'Služby, péče a vzdělávání' }),
        description: t('rebuild.marketplace.cluster_services_desc', { defaultValue: 'Práce s lidmi, péče, zákaznický kontext, školení a veřejně prospěšné role.' }),
      },
      {
        id: 'other',
        title: t('rebuild.marketplace.cluster_other', { defaultValue: 'Další příbuzné možnosti' }),
        description: t('rebuild.marketplace.cluster_other_desc', { defaultValue: 'Nabídky, které se nevešly do hlavních bloků, ale pořád stojí za rychlé projití.' }),
      },
    ];

    return definitions
      .map((definition) => ({
        ...definition,
        relevance: getProfileClusterPreference(profileRelevanceText, definition.id),
        candidates: buckets[definition.id]
          .map((candidate) => ({
            ...candidate,
            profileScore: getRoleProfileScore(candidate, profileRelevanceText, definition.id, commuteFilterActive),
          }))
          .sort((left, right) => right.profileScore - left.profileScore),
      }))
      .filter((section) => section.candidates.length > 0)
      .sort((left, right) => {
        if (right.relevance !== left.relevance) return right.relevance - left.relevance;
        const rightTop = right.candidates[0]?.profileScore || 0;
        const leftTop = left.candidates[0]?.profileScore || 0;
        if (rightTop !== leftTop) return rightTop - leftTop;
        return right.candidates.length - left.candidates.length;
      });
  }, [commuteFilterActive, gridCandidates, profileRelevanceText, t]);
  React.useEffect(() => {
    setVisibleRecommendationCount(RECOMMENDATION_PAGE_SIZE);
  }, [filters, focusMode, localRadiusKm, preferences.address, roles.length]);

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

  const sectionShellClass = "scroll-mt-24 border-t border-slate-200/80 pt-9 dark:border-slate-800/80 md:pt-11";
  const firstSectionShellClass = "scroll-mt-24";
  const sectionTitleClass = "mb-6 flex flex-col gap-3 border-b border-slate-200/70 px-1 pb-4 dark:border-slate-800/80 sm:flex-row sm:items-end sm:justify-between";
  const h3Class = "text-[20px] font-black leading-tight text-slate-900";
  const sectionDescriptionClass = "mt-1 block max-w-3xl text-[13px] font-medium leading-5 text-slate-500 dark:text-slate-400";
  const viewAllClass = "text-[12px] font-bold text-[#12afcb] hover:underline";
  const activeFilterCount = [
    searchValue.trim(),
    filters.city.trim(),
    filters.roleFamily !== 'all',
    filters.remoteOnly || filters.workArrangement !== 'all',
    filters.crossBorder !== preferences.borderSearchEnabled,
    (filters.enableCommuteFilter !== false) !== preferences.commuteFilterEnabled,
    filters.enableCommuteFilter && filters.radiusKm !== preferences.searchRadiusKm,
    filters.minSalary > 0,
    filters.curatedOnly,
    ...filters.benefits,
  ].filter(Boolean).length;
  const searchTriggerLabel = React.useMemo(() => {
    const parts = [
      searchValue.trim(),
      filters.city.trim(),
      filters.roleFamily !== 'all' ? getRoleFamilyOptions(t).find((option) => option.value === filters.roleFamily)?.label : '',
      filters.remoteOnly ? t('rebuild.marketplace.work_arrangement_remote', { defaultValue: 'Pouze remote' }) : '',
      filters.workArrangement !== 'all' && !filters.remoteOnly ? filters.workArrangement : '',
    ].filter(Boolean);
    return parts.length > 0
      ? parts.join(' · ')
      : t('rebuild.marketplace.search_cta', { defaultValue: 'Hledat pozici, firmu nebo město' });
  }, [filters.city, filters.remoteOnly, filters.roleFamily, filters.workArrangement, searchValue, t]);
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
        title={t('rebuild.marketplace.header_title', { defaultValue: 'Marketplace práce' })}
        subtitle={t('rebuild.marketplace.header_subtitle', { defaultValue: 'Procházej nabídky, uprav filtry a otevírej jen ty role, které dávají smysl.' })}
        t={t}
        actionRegion={
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="hidden h-11 min-w-[24rem] max-w-[34rem] items-center gap-3 rounded-[14px] border border-slate-200 bg-white px-3 text-left text-[13px] font-semibold text-slate-800 shadow-sm transition hover:border-[#12afcb] hover:bg-[#f7fcfd] focus:outline-none focus:ring-4 focus:ring-[#12afcb]/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-cyan-600 md:flex"
              aria-label={t('rebuild.marketplace.open_search', { defaultValue: 'Otevřít vyhledávání' })}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#e8f8fb] text-[#08788a] dark:bg-cyan-950/60 dark:text-cyan-300">
                <Search size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">{searchTriggerLabel}</span>
                <span className="block truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  {t('rebuild.marketplace.search_hint', { defaultValue: 'Vyhledávání, lokalita, forma práce a další filtry' })}
                </span>
              </span>
              {activeFilterCount ? <span className="rounded-full bg-[#12afcb] px-2.5 py-1 text-[11px] font-black text-white">{activeFilterCount}</span> : null}
            </button>
            <button type="button" onClick={() => setFiltersOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-[#08788a] shadow-sm transition hover:border-[#12afcb] hover:bg-[#f7fcfd] dark:border-slate-700 dark:bg-slate-900 dark:text-cyan-300 md:hidden" aria-label={t('rebuild.marketplace.open_search', { defaultValue: 'Otevřít vyhledávání' })}>
              <SlidersHorizontal size={16} />
            </button>
          </div>
        }
      >
        <MarketplaceSchema roles={visibleRoles} t={t} />
        <div className="grid gap-6 xl:gap-8">
          {/* Main Column - min-w-0 is crucial to prevent content from stretching the grid */}
          <div className="min-w-0 space-y-12 pb-14 md:space-y-14">
            {/* Featured Section */}
            {commuteFilterActive ? (
            <section key="featured" id="marketplace-local-jobs" className={firstSectionShellClass}>
              <div className={sectionTitleClass}>
                <h3 className={h3Class + ' dark:text-slate-100'}>
                  {t('rebuild.marketplace.local_jobs')}
                  <span className={sectionDescriptionClass}>
                    {commuteFilterActive
                      ? `${locationLabel} ${t('rebuild.marketplace.radius_label', { radius: localRadiusKm })}`
                      : t('rebuild.marketplace.commute_disabled_short', { defaultValue: 'dojezd vypnutý' })}
                  </span>
                </h3>
                <button type="button" onClick={() => setFocusMode((current) => current === 'immediate' ? 'all' : 'immediate')} disabled={!commuteFilterActive} className={viewAllClass + (!commuteFilterActive ? ' opacity-40' : '')}>
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
                  {commuteFilterActive
                    ? t('rebuild.marketplace.no_local_jobs', { defaultValue: 'V okolí {{location}} aktuálně nejsou žádné aktivní výzvy v okruhu {{radius}} km.', radius: localRadiusKm, location: locationLabel })
                    : t('rebuild.marketplace.no_commute_filter', { defaultValue: 'Dojezdový filtr je vypnutý. Hlavní seznam níže ukazuje všechny nabídky odpovídající hledání.' })}
                </div>
              )}
            </section>
            ) : null}

            {/* Recommended Sections (New Hybrid Engine) */}
            {sections.length > 0 ? (
              sections.map((section, index) => (
                <section key={section.id || section.title} id={index === 0 ? 'marketplace-recommended' : undefined} className={index === 0 && !commuteFilterActive ? firstSectionShellClass : sectionShellClass}>
                  <div className={sectionTitleClass}>
                    <h3 className={h3Class + ' dark:text-slate-100'}>
                      {section.title}
                      <span className={sectionDescriptionClass}>{section.description}</span>
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {section.items
                      .filter((role) => !filters.city || role.location.toLowerCase().includes(filters.city.toLowerCase()))
                      .filter((role) => {
                        if (!searchValue.trim()) return true;
                        const query = searchValue.toLowerCase();
                        return (
                          role.title.toLowerCase().includes(query) ||
                          role.companyName.toLowerCase().includes(query) ||
                          role.location.toLowerCase().includes(query)
                        );
                      })
                      .map((role) => (
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
              <section key="legacy-recommended" id="marketplace-recommended" className={!commuteFilterActive ? firstSectionShellClass : sectionShellClass}>
                <div className={sectionTitleClass}>
                  <h3 className={h3Class + ' dark:text-slate-100'}>
                    {t('rebuild.marketplace.recommended_for_you')}
                    <span className={sectionDescriptionClass}>{t('rebuild.marketplace.based_on_profile')}</span>
                  </h3>
                  <div className="text-[12px] font-bold text-slate-400">
                    {t('rebuild.marketplace.relevant_count', { relevant: scopedRecommendationCandidates.length, total: visibleRoles.length })}
                  </div>
                </div>
                {visibleRecommendedCandidates.length > 0 ? (
                  <>
                  {spotlightCandidate ? (
                    <FeaturedRoleCard
                      role={spotlightCandidate.role}
                      distanceKm={spotlightCandidate.distanceKm}
                      onOpen={() => navigate(getRolePath(spotlightCandidate.role))}
                    />
                  ) : null}
                  <div className="mt-8 space-y-11">
                    {catalogSections.map((section) => (
                      <section key={section.id} className="scroll-mt-24 border-t border-slate-200/70 pt-7 first:border-t-0 first:pt-0 dark:border-slate-800/80">
                        <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
                          <div>
                            <h4 className="text-[18px] font-black leading-tight text-slate-900 dark:text-slate-100">{section.title}</h4>
                            <p className="mt-2 max-w-2xl text-[13px] font-medium leading-5 text-slate-500 dark:text-slate-400">{section.description}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {section.candidates.length}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {section.candidates.map(({ role, distanceKm }, index) => (
                            <DiscoveryRoleCard
                              key={role.id}
                              role={role}
                              distanceKm={distanceKm}
                              variant={index === 0 && section.candidates.length >= 4 ? 'wide' : index % 7 === 0 ? 'accent' : index % 5 === 0 ? 'compact' : 'standard'}
                              onOpen={() => navigate(getRolePath(role))}
                            />
                          ))}
                        </div>
                        {onLoadMoreCategory && section.id !== 'other' && section.candidates.length >= 4 && (
                          <div className="mt-8 flex justify-center">
                            <button
                              type="button"
                              onClick={() => onLoadMoreCategory(section.id)}
                              disabled={loadingCategoryId === section.id}
                              className="group flex h-11 items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/30 px-6 text-[13px] font-bold text-cyan-700 transition hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-70 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300 dark:hover:bg-cyan-950/40 shadow-sm"
                            >
                              {loadingCategoryId === section.id ? (
                                <Loader2 size={16} className="animate-spin text-cyan-500" />
                              ) : (
                                <ChevronDown size={16} className="transform transition-transform group-hover:translate-y-0.5" />
                              )}
                              {loadingCategoryId === section.id
                                ? t('rebuild.marketplace.loading_category', { defaultValue: 'Načítám' })
                                : t('rebuild.marketplace.load_more_category', { defaultValue: 'Zobrazit další z kategorie' })}
                            </button>
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                  </>
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
          </div>
        </div>
      </DashboardLayoutV2>
    </>
  );
};
