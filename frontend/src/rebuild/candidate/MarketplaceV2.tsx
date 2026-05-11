import React from 'react';
import {
  ArrowRight,
  Bell,
  LayoutDashboard,
  Briefcase,
  CircleUserRound,
  Code2,
  Filter,
  Grid2X2,
  Heart,
  Bookmark,
  MapPin,
  Megaphone,
  MessageSquare,
  GraduationCap,
  Loader2,
  Palette,
  PenLine,
  Search,
  SlidersHorizontal,
  BrainCircuit,
  ChevronDown,
  Clock3,
} from 'lucide-react';
import { DashboardLayoutV2 } from '../ui/DashboardLayoutV2';
import { Role, CandidatePreferenceProfile, MarketplaceFilters, MarketplaceSection } from '../models';
import { DialogueSummary, UserProfile } from '../../types';
import { 
  SearchFiltersModal, 
  getRoleFamilyOptions 
} from './MarketplaceSearchFilters';
import { getStaticCoordinates } from '../../services/geocodingService';
import { cn } from '../cn';

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

const normalizeProfileText = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const roleSearchText = (role: Role): string => normalizeProfileText([
  role.title,
  role.companyName,
  role.location,
  role.summary,
  role.description,
  role.roleFamily,
  role.skills.join(' '),
  role.benefits.join(' '),
].join(' '));

const CLUSTER_KEYWORDS: Record<RoleClusterId, string[]> = {
  management: ['manager', 'manazer', 'management', 'project', 'projekt', 'operations manager', 'provozni', 'program', 'delivery', 'vedouci', 'lead', 'koordinator'],
  operations: ['operations', 'provoz', 'frontline', 'logistics', 'logistika', 'warehouse', 'sklad', 'construction', 'stavba', 'vyroba', 'operator'],
  business: ['sales', 'obchod', 'business', 'finance', 'financ', 'account', 'administrativa', 'office', 'people', 'hr', 'legal', 'marketing'],
  digital: ['engineering', 'developer', 'vyvojar', 'software', 'product', 'design', 'data', 'analyst', 'ux', 'ui', 'digital', 'it'],
  services: ['care', 'pece', 'education', 'vzdelav', 'health', 'zdrav', 'customer', 'zakaznick', 'service', 'sluzby', 'support'],
  other: [],
};

const getRoleClusterId = (role: Role): RoleClusterId => {
  const text = roleSearchText(role);
  if (CLUSTER_KEYWORDS.management.some((keyword) => text.includes(keyword))) return 'management';
  if (['frontline', 'logistics', 'construction', 'operations'].includes(role.roleFamily)) return 'operations';
  if (['sales', 'finance', 'people', 'legal', 'marketing'].includes(role.roleFamily)) return 'business';
  if (['engineering', 'product', 'design'].includes(role.roleFamily)) return 'digital';
  if (['care', 'education', 'health'].includes(role.roleFamily)) return 'services';
  if (CLUSTER_KEYWORDS.operations.some((keyword) => text.includes(keyword))) return 'operations';
  if (CLUSTER_KEYWORDS.business.some((keyword) => text.includes(keyword))) return 'business';
  if (CLUSTER_KEYWORDS.digital.some((keyword) => text.includes(keyword))) return 'digital';
  if (CLUSTER_KEYWORDS.services.some((keyword) => text.includes(keyword))) return 'services';
  return 'other';
};

const getProfileClusterPreference = (profileText: string, clusterId: RoleClusterId): number => {
  const keywords = CLUSTER_KEYWORDS[clusterId];
  if (!keywords.length || !profileText) return clusterId === 'other' ? 1 : 0;
  return keywords.reduce((score, keyword) => score + (profileText.includes(keyword) ? 1 : 0), 0);
};

const getRoleProfileScore = (
  candidate: RoleCandidate,
  profileText: string,
  clusterId: RoleClusterId,
  commuteFilterActive: boolean,
): number => {
  const role = candidate.role;
  const text = roleSearchText(role);
  const profileTerms = profileText.split(' ').filter((term) => term.length >= 3);
  const directMatches = profileTerms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
  const clusterMatches = CLUSTER_KEYWORDS[clusterId].reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0);
  const distanceBoost = commuteFilterActive && Number.isFinite(candidate.distanceKm)
    ? Math.max(0, 20 - Math.min(candidate.distanceKm, 20))
    : 0;
  const curatedBoost = role.source === 'curated' ? 8 : 0;
  const matchScore = typeof role.matchScore === 'number' ? role.matchScore / 10 : 0;

  return directMatches * 3 + clusterMatches * 2 + distanceBoost + curatedBoost + matchScore;
};

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

const formatRoleSalary = (role: Role, fallback: string, language?: string) => {
  if (role.salaryFrom <= 0 && role.salaryTo <= 0) return fallback;
  const locale = language === 'cs' ? 'cs-CZ' : 'en-GB';
  const from = role.salaryFrom > 0 ? role.salaryFrom.toLocaleString(locale) : role.salaryTo.toLocaleString(locale);
  const to = role.salaryTo > 0 && role.salaryTo !== role.salaryFrom ? ` - ${role.salaryTo.toLocaleString(locale)}` : '';
  return `${from}${to} ${role.currency}`;
};

const roleFamilyIcon = (clusterId: RoleClusterId) => {
  if (clusterId === 'digital') return Code2;
  if (clusterId === 'business') return Megaphone;
  if (clusterId === 'services') return PenLine;
  if (clusterId === 'management') return Briefcase;
  if (clusterId === 'operations') return Grid2X2;
  return Palette;
};

const JobFeedCard: React.FC<{
  candidate: RoleCandidate;
  variant?: 'featured' | 'compact';
  saved?: boolean;
  onOpen: () => void;
  onToggleSaved?: () => void;
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
}> = ({ candidate, variant = 'compact', saved = false, onOpen, onToggleSaved, t }) => {
  const role = candidate.role;
  const isFeatured = variant === 'featured';
  const distanceLabel = Number.isFinite(candidate.distanceKm)
    ? `${Math.max(1, Math.round(candidate.distanceKm))} km`
    : role.location;
  const salary = formatRoleSalary(role, t('rebuild.marketplace.salary_not_specified', { defaultValue: 'Mzda neuvedena' }));
  const tags = role.skills.length > 0 ? role.skills.slice(0, isFeatured ? 4 : 3) : role.benefits.slice(0, isFeatured ? 4 : 3);

  return (
    <article
      className={cn(
        'group flex h-full min-w-0 flex-col rounded-2xl bg-white/88 p-5 text-slate-950 shadow-[0_18px_52px_-40px_rgba(15,23,42,0.24)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_26px_70px_-46px_rgba(15,23,42,0.3)] dark:bg-slate-900/92 dark:text-slate-100',
        isFeatured && 'md:p-6',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn('flex shrink-0 items-center justify-center rounded-xl bg-[#eef8fb] p-2 text-[#0f95ac] dark:bg-cyan-950/50', isFeatured ? 'h-12 w-12' : 'h-10 w-10')}>
            {role.companyLogo ? (
              <img src={role.companyLogo} alt="" className="h-full w-full object-contain" />
            ) : (
              <Briefcase size={18} className="text-[#0f95ac]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-bold text-slate-900 dark:text-slate-100">{role.companyName || t('rebuild.marketplace.company_unknown', { defaultValue: 'Firma' })}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <span>{role.source === 'curated' ? t('rebuild.marketplace.verified_company', { defaultValue: 'Ověřená firma' }) : t('rebuild.marketplace.imported_source', { defaultValue: 'Importovaná nabídka' })}</span>
              {role.source === 'curated' ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleSaved}
          disabled={!onToggleSaved}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-[#eef8fb] hover:text-[#0f95ac] disabled:cursor-default dark:hover:bg-slate-800"
          aria-label={saved ? t('rebuild.marketplace.saved_role', { defaultValue: 'Uložená nabídka' }) : t('rebuild.marketplace.save_role', { defaultValue: 'Uložit nabídku' })}
          aria-pressed={saved}
        >
          <Bookmark size={17} className={saved ? 'fill-[#0f95ac] text-[#0f95ac]' : ''} />
        </button>
      </div>

      <button type="button" onClick={onOpen} className="mt-5 text-left">
        <h3 className={cn('font-black leading-snug tracking-normal text-slate-950 transition group-hover:text-[#0f95ac] dark:text-slate-100', isFeatured ? 'text-[22px]' : 'text-[17px]')}>
          {role.title}
        </h3>
        <p className={cn('mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400', isFeatured ? 'line-clamp-3' : 'line-clamp-2')}>
          {role.summary || role.description || role.roleSummary}
        </p>
      </button>

      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="rounded-md bg-[#eef8fb] px-2.5 py-1 text-[11px] font-bold text-[#08788a] dark:bg-cyan-950/50 dark:text-cyan-300">{tag}</span>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
        <div className="min-w-0">
          <div className="text-[15px] font-black text-slate-950 dark:text-slate-100">{salary}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1"><MapPin size={12} />{distanceLabel} · {role.location}</span>
            <span className="inline-flex items-center gap-1"><Clock3 size={12} />{role.workModel}</span>
          </div>
        </div>
        {isFeatured ? (
          <button type="button" onClick={onOpen} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[image:var(--shell-button-primary-bg)] px-4 text-[12px] font-black text-white shadow-[0_14px_28px_-20px_rgba(18,175,203,0.72)] transition hover:bg-[image:var(--shell-button-primary-hover)]">
            {t('rebuild.marketplace.offer_detail', { defaultValue: 'Detail nabídky' })}
            <ArrowRight size={15} />
          </button>
        ) : null}
      </div>
    </article>
  );
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
  onLoadMoreCategory?: (categoryId: RoleClusterId) => void;
  onToggleSavedRole?: (roleId: string) => void;
  loadingCategoryId?: RoleClusterId | null;
  currentLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  navigate: (path: string) => void;
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
}> = ({ roles, loading = false, hasMore = false, totalCount = 0, userProfile, preferences, filters, searchValue, onSearchChange, onFiltersChange, onResetFilters, savedRoleIds = [], onSignOut, onCompanySwitch, onLoadMore, onToggleSavedRole, loadingCategoryId = null, currentLanguage, onLanguageChange, navigate, t }) => {
  const [visibleRecommendationCount, setVisibleRecommendationCount] = React.useState(RECOMMENDATION_PAGE_SIZE);
  const [focusMode, setFocusMode] = React.useState<MarketplaceFocus>('all');
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [activeCategoryId, setActiveCategoryId] = React.useState<RoleClusterId | null>(null);

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
  const activeCategorySection = React.useMemo(
    () => catalogSections.find((section) => section.id === activeCategoryId) || null,
    [activeCategoryId, catalogSections],
  );
  React.useEffect(() => {
    setVisibleRecommendationCount(RECOMMENDATION_PAGE_SIZE);
    setActiveCategoryId(null);
  }, [filters, focusMode, localRadiusKm, preferences.address, roles.length, searchValue]);

  // Smarter city extraction from address
  const locationLabel = React.useMemo(() => {
    const addr = preferences.address || '';
    if (!addr) return t('rebuild.marketplace.default_location', { defaultValue: 'Česká republika' });
    const parts = addr.split(',').map(p => p.trim());
    // Often address is "Street 123, City, Zip, Country" or "City, Country"
    // Try to find a part that doesn't look like a street or zip
    const cityPart = parts.find(p => !/\d/.test(p)) || parts[0];
    return cityPart;
  }, [preferences.address, t]);

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
  const baseFeedCandidates = activeCategorySection
    ? activeCategorySection.candidates
    : commuteFilterActive
      ? scopedRecommendationCandidates
      : visibleRecommendedCandidates;
  const feedCandidates = baseFeedCandidates.slice(0, visibleRecommendationCount);
  const hasMoreFeedCandidates = visibleRecommendationCount < baseFeedCandidates.length;
  const recommendedFeed = feedCandidates.slice(0, 2);
  const latestFeed = feedCandidates.slice(2);
  const categoryCards = catalogSections.slice(0, 4).map((section) => ({
    id: section.id,
    title: section.title,
    count: section.candidates.length,
    Icon: roleFamilyIcon(section.id),
  }));
  const savedSearchCards = [
    {
      id: 'target',
      title: filters.targetRole || userProfile.jobTitle || t('rebuild.marketplace.saved_target_role', { defaultValue: 'Doporučené role' }),
      count: scopedRecommendationCandidates.length,
      Icon: Briefcase,
    },
    {
      id: 'local',
      title: locationLabel,
      count: nearbyRoles.length,
      Icon: MapPin,
    },
    {
      id: 'remote',
      title: t('rebuild.marketplace.work_arrangement_remote', { defaultValue: 'Pouze remote' }),
      count: rolesWithDistance.filter(({ role }) => isRemoteRole(role)).length,
      Icon: Heart,
    },
  ];
  const workTabs = [
    { id: 'all', label: t('rebuild.marketplace.all', { defaultValue: 'Vše' }) },
    { id: 'remote', label: t('rebuild.marketplace.work_arrangement_remote', { defaultValue: 'Na dálku' }) },
    { id: 'hybrid', label: t('rebuild.marketplace.work_arrangement_hybrid', { defaultValue: 'Hybridní' }) },
    { id: 'onsite', label: t('rebuild.marketplace.work_arrangement_onsite', { defaultValue: 'Na místě' }) },
  ] as const;
  const activeWorkTab = filters.remoteOnly ? 'remote' : filters.workArrangement;
  const applyWorkTab = (tabId: (typeof workTabs)[number]['id']) => {
    onFiltersChange((current) => ({
      ...current,
      remoteOnly: tabId === 'remote',
      workArrangement: tabId === 'remote' ? 'all' : tabId,
    }));
  };
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
          <button type="button" onClick={() => setFiltersOpen(true)} className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/86 text-[#08788a] shadow-[0_14px_34px_-28px_rgba(15,23,42,0.4)] ring-1 ring-slate-900/[0.06] transition hover:bg-[#f7fcfd] dark:bg-slate-900 dark:text-cyan-300 dark:ring-white/10" aria-label={t('rebuild.marketplace.open_search', { defaultValue: 'Otevřít vyhledávání' })}>
            <SlidersHorizontal size={16} />
            {activeFilterCount ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#12afcb] px-1 text-[10px] font-black text-white">{activeFilterCount}</span> : null}
          </button>
        }
      >
        <MarketplaceSchema roles={visibleRoles} t={t} />
        <div className="space-y-9 pb-12">
          <section className="relative overflow-hidden rounded-[28px] bg-white/72 shadow-[0_28px_90px_-72px_rgba(15,23,42,0.34)] dark:bg-slate-900/70">
            <div className="grid min-h-[19rem] md:grid-cols-[minmax(0,1fr)_21rem]">
              <div className="relative z-10 p-6 sm:p-8">
                <div className="flex items-center gap-3 text-[13px] font-bold text-[#0f95ac]">
                  <span className="h-2 w-2 rounded-full bg-[#12afcb]" />
                  {t('rebuild.marketplace.feed_label', { defaultValue: 'Feed' })}
                  <span className="text-slate-300">/</span>
                  <span className="text-slate-500">{t('rebuild.nav.marketplace', { defaultValue: 'Marketplace' })}</span>
                </div>
                <h1 className="mt-8 text-[clamp(2rem,4vw,3.15rem)] font-black leading-tight tracking-normal text-slate-950 dark:text-slate-100">
                  {t('rebuild.marketplace.feed_greeting', { defaultValue: 'Ahoj {{name}}, 👋', name: userProfile.name?.split(' ')[0] || preferences.name || t('rebuild.marketplace.you', { defaultValue: 'ty' }) })}
                </h1>
                <p className="mt-2 text-lg font-medium text-slate-600 dark:text-slate-400">
                  {t('rebuild.marketplace.feed_subtitle', { defaultValue: 'Najdi další dobrou příležitost bez náhodných filtrů.' })}
                </p>
                <div className="mt-7 flex max-w-3xl flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    className="flex min-h-14 flex-1 items-center gap-3 rounded-full bg-white px-5 text-left text-sm font-semibold text-slate-500 shadow-[0_18px_44px_-32px_rgba(15,23,42,0.3)] transition hover:text-slate-800 focus:outline-none focus:ring-4 focus:ring-[#12afcb]/15 dark:bg-slate-950/86 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    <Search size={18} className="shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate">{searchTriggerLabel}</span>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[image:var(--shell-button-primary-bg)] text-white shadow-[0_12px_28px_-18px_rgba(18,175,203,0.78)]">
                      <Search size={18} />
                    </span>
                  </button>
                  <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-slate-700 shadow-[0_14px_36px_-30px_rgba(15,23,42,0.3)] transition hover:bg-[#f7fcfd] dark:bg-slate-950/86 dark:text-slate-200">
                    <Filter size={16} />
                    {t('rebuild.marketplace.filters', { defaultValue: 'Filtry' })}
                    {activeFilterCount ? <span className="rounded-full bg-[#12afcb] px-2 py-0.5 text-[11px] text-white">{activeFilterCount}</span> : null}
                  </button>
                </div>
              </div>
              <div className="relative hidden overflow-hidden md:block">
                <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1200&auto=format&fit=crop" alt="" className="absolute inset-0 h-full w-full object-cover" />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.52)_38%,rgba(255,255,255,0.04)_100%)] dark:bg-[linear-gradient(90deg,rgba(15,23,42,0.94)_0%,rgba(15,23,42,0.56)_38%,rgba(15,23,42,0.08)_100%)]" />
              </div>
            </div>
            <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-5">
              {categoryCards.map(({ id, title, count, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveCategoryId(id);
                    setVisibleRecommendationCount(RECOMMENDATION_PAGE_SIZE);
                  }}
                  aria-pressed={activeCategoryId === id}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl px-4 py-4 text-left shadow-[0_14px_38px_-34px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_22px_54px_-42px_rgba(15,23,42,0.32)] dark:bg-slate-950/72',
                    activeCategoryId === id ? 'bg-[#eef8fb] ring-2 ring-[#12afcb]/25 dark:bg-cyan-950/35' : 'bg-white/86',
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef8fb] text-[#0f95ac] dark:bg-cyan-950/50 dark:text-cyan-300">
                    {loadingCategoryId === id ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-black text-slate-950 dark:text-slate-100">{title}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">{t('rebuild.marketplace.offer_count', { defaultValue: '{{count}} nabídek', count })}</span>
                  </span>
                </button>
              ))}
              <button type="button" onClick={() => setActiveCategoryId(null)} className={cn('flex items-center gap-3 rounded-2xl px-4 py-4 text-left shadow-[0_14px_38px_-34px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_22px_54px_-42px_rgba(15,23,42,0.32)] dark:bg-slate-950/72', activeCategoryId ? 'bg-white/86' : 'bg-slate-50 ring-2 ring-slate-200/70 dark:bg-slate-900')}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"><Grid2X2 size={18} /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-black text-slate-950 dark:text-slate-100">{t('rebuild.marketplace.show_all', { defaultValue: 'Zobrazit vše' })}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">{visibleRoles.length.toLocaleString('cs-CZ')} {t('rebuild.marketplace.results', { defaultValue: 'výsledků' })}</span>
                </span>
              </button>
            </div>
          </section>

          <section id="marketplace-recommended" className="space-y-4">
            <div className="flex items-end justify-between gap-4 px-1">
              <div>
                <h2 className="text-[22px] font-black tracking-normal text-slate-950 dark:text-slate-100">{t('rebuild.marketplace.recommended_for_you', { defaultValue: 'Doporučené pro vás' })} <span className="text-[#d58a22]">✦</span></h2>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {activeCategorySection
                    ? activeCategorySection.title
                    : t('rebuild.marketplace.based_on_profile', { defaultValue: 'Na základě profilu a aktivity' })}
                </p>
              </div>
              <button type="button" onClick={() => setFocusMode((current) => current === 'immediate' ? 'all' : 'immediate')} className="text-[13px] font-black text-[#0f95ac] hover:underline">
                {focusMode === 'immediate' ? t('rebuild.marketplace.show_all', { defaultValue: 'Zobrazit vše' }) : t('rebuild.marketplace.only_local', { defaultValue: 'Jen lokální' })}
              </button>
            </div>
            {recommendedFeed.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
                {recommendedFeed.map((candidate, index) => (
                  <JobFeedCard
                    key={candidate.role.id}
                    candidate={candidate}
                    variant={index === 0 ? 'featured' : 'compact'}
                    saved={savedRoleIds?.includes(String(candidate.role.id))}
                    onOpen={() => navigate(getRolePath(candidate.role))}
                    onToggleSaved={() => onToggleSavedRole?.(candidate.role.id)}
                    t={t}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-8 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900/70">
                {commuteFilterActive
                  ? t('rebuild.marketplace.no_local_jobs', { defaultValue: 'V okolí {{location}} aktuálně nejsou žádné aktivní výzvy v okruhu {{radius}} km.', radius: localRadiusKm, location: locationLabel })
                  : t('rebuild.marketplace.no_more_recommendations', { defaultValue: 'V aktuálním radiusu nemám další vhodné nabídky. Zkus zvětšit dojezd v profilu nebo zapnout širší hledání.' })}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 px-1">
              <div>
                <h2 className="text-[22px] font-black tracking-normal text-slate-950 dark:text-slate-100">{t('rebuild.marketplace.latest_jobs', { defaultValue: 'Nejnovější nabídky' })}</h2>
                <div className="mt-4 flex flex-wrap gap-5 text-[13px] font-black text-slate-500">
                  {workTabs.map((item) => (
                    <button key={item.id} type="button" onClick={() => applyWorkTab(item.id)} className={cn('border-b-2 pb-2 transition hover:text-[#0f95ac]', activeWorkTab === item.id ? 'border-[#12afcb] text-[#0f95ac]' : 'border-transparent')}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/82 px-4 text-[13px] font-black text-slate-700 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.28)] transition hover:bg-white dark:bg-slate-900 dark:text-slate-200">
                {t('rebuild.marketplace.newest', { defaultValue: 'Nejnovější' })}
                <ChevronDown size={15} />
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {latestFeed.map((candidate) => (
                <JobFeedCard
                  key={candidate.role.id}
                  candidate={candidate}
                  saved={savedRoleIds?.includes(String(candidate.role.id))}
                  onOpen={() => navigate(getRolePath(candidate.role))}
                  onToggleSaved={() => onToggleSavedRole?.(candidate.role.id)}
                  t={t}
                />
              ))}
            </div>
            <div className="flex flex-col items-center gap-3">
              {hasMoreFeedCandidates ? (
                <button type="button" onClick={() => setVisibleRecommendationCount((current) => current + RECOMMENDATION_PAGE_SIZE)} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/82 px-6 text-[13px] font-black text-[#0f95ac] shadow-[0_12px_32px_-28px_rgba(15,23,42,0.28)] transition hover:bg-[#f1fbfd] dark:bg-slate-900 dark:text-cyan-300">
                  {t('rebuild.marketplace.load_more', { defaultValue: 'Zobrazit další nabídky' })}
                  <ChevronDown size={15} />
                </button>
              ) : null}
              {hasMore && onLoadMore ? (
                <button type="button" onClick={onLoadMore} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/82 px-6 text-[13px] font-black text-slate-700 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.28)] transition hover:bg-white disabled:cursor-wait disabled:opacity-70 dark:bg-slate-900 dark:text-slate-200">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                  {loading ? t('rebuild.marketplace.loading_catalog', { defaultValue: 'Načítám katalog' }) : t('rebuild.marketplace.load_from_db', { defaultValue: 'Načíst další z databáze' })}
                  <span className="text-slate-400">{roles.length.toLocaleString('cs-CZ')} / {totalCount.toLocaleString('cs-CZ')}</span>
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-[28px] bg-white/62 p-6 shadow-[0_24px_70px_-62px_rgba(15,23,42,0.24)] dark:bg-slate-900/70">
            <h2 className="text-[20px] font-black text-slate-950 dark:text-slate-100">{t('rebuild.marketplace.saved_searches', { defaultValue: 'Uložené hledání' })}</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">{t('rebuild.marketplace.saved_searches_desc', { defaultValue: 'Měj přehled o nových nabídkách ve svých oblastech' })}</p>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {savedSearchCards.map(({ id, title, count, Icon }) => (
                <button key={id} type="button" onClick={() => setFiltersOpen(true)} className="flex items-center justify-between gap-3 rounded-2xl bg-white/86 px-4 py-4 text-left shadow-[0_14px_38px_-34px_rgba(15,23,42,0.26)] transition hover:-translate-y-0.5 hover:bg-white dark:bg-slate-900">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef8fb] text-[#0f95ac] dark:bg-cyan-950/50">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-black text-slate-950 dark:text-slate-100">{title}</span>
                      <span className="block text-[11px] font-semibold text-slate-500">{t('rebuild.marketplace.new_offer_count', { defaultValue: '{{count}} nových nabídek', count })}</span>
                    </span>
                  </span>
                  <Bell size={16} className="shrink-0 text-slate-400" />
                </button>
              ))}
              <button type="button" onClick={() => setFiltersOpen(true)} className="flex items-center justify-between gap-3 rounded-2xl bg-white/86 px-4 py-4 text-left text-[13px] font-black text-slate-700 shadow-[0_14px_38px_-34px_rgba(15,23,42,0.26)] transition hover:-translate-y-0.5 hover:bg-white dark:bg-slate-900 dark:text-slate-200">
                {t('rebuild.marketplace.show_all_saved', { defaultValue: 'Zobrazit všechna' })}
                <ArrowRight size={16} />
              </button>
            </div>
          </section>

          <section className="flex flex-col gap-5 rounded-[28px] bg-[linear-gradient(135deg,#0f4f73,#0f95ac)] p-6 text-white shadow-[0_24px_68px_-42px_rgba(15,149,172,0.62)] sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h2 className="text-[22px] font-black tracking-normal">{t('rebuild.marketplace.cta_talent_title', { defaultValue: 'Hledáš lepší fit pro svůj další krok?' })}</h2>
              <p className="mt-2 text-sm font-medium text-cyan-50/85">{t('rebuild.marketplace.cta_talent_copy', { defaultValue: 'Uprav svůj profil a nech Jobshaman seřadit nabídky podle reality.' })}</p>
            </div>
            <button type="button" onClick={() => navigate('/candidate/profile')} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-black text-[#0f4f73] shadow-sm transition hover:bg-cyan-50">
              {t('rebuild.marketplace.update_profile', { defaultValue: 'Upravit profil' })}
              <ArrowRight size={16} />
            </button>
          </section>
        </div>
      </DashboardLayoutV2>
    </>
  );
};
