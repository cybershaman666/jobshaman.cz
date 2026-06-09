import React from 'react';
import {
  ArrowRight,
  LayoutDashboard,
  Briefcase,
  CircleUserRound,
  Code2,
  Filter,
  Grid2X2,
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
  ChevronRight,
  Clock3,
  Play,
  Wallet,
  Gauge,
  ArrowUpDown,
  Sparkles,
  Flame,
  Check,
} from 'lucide-react';
import { DashboardLayoutV2 } from '../ui/DashboardLayoutV2';
import { Role, CandidatePreferenceProfile, MarketplaceFilters, MarketplaceSection } from '../models';
import { DialogueSummary, UserProfile, TaxProfile, TransportMode } from '../../types';
import { 
  SearchFiltersModal, 
  getRoleFamilyOptions 
} from './MarketplaceSearchFilters';
import { getStaticCoordinates } from '../../services/geocodingService';
import { estimateNetSalaryByCountry } from '../../services/financialService';
import { parseNaturalLanguageQuery, applyParsedFilters, type ParsedSearchFilters } from '../../services/naturalLanguageSearchService';
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
const MARKETPLACE_FEED_PAGE_SIZE = 50;
type MarketplaceFocus = 'all' | 'immediate' | 'curated';
type RoleCandidate = { role: Role; distanceKm: number };
export type RoleClusterId = 'management' | 'operations' | 'business' | 'digital' | 'services' | 'other';
type MarketplaceTFunction = (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;

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

const pickWildRoleIds = (feed: RoleCandidate[]): Set<string> => {
  const ids = new Set<string>();
  const maxWildRoles = 3;
  for (let index = 0; index < Math.min(maxWildRoles, feed.length); index += 1) {
    ids.add(String(feed[index].role.id));
  }
  return ids;
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
  variant?: 'featured' | 'compact' | 'wild';
  saved?: boolean;
  onOpen: () => void;
  onToggleSaved?: () => void;
  t: MarketplaceTFunction;
}> = ({ candidate, variant = 'compact', saved = false, onOpen, onToggleSaved, t }) => {
  const role = candidate.role;
  const isFeatured = variant === 'featured';
  const isWild = variant === 'wild';
  const distanceLabel = Number.isFinite(candidate.distanceKm)
    ? `${Math.max(1, Math.round(candidate.distanceKm))} km`
    : role.location;
  const salary = formatRoleSalary(role, t('rebuild.marketplace.salary_not_specified', { defaultValue: 'Mzda neuvedena' }));
  const tags = role.skills.length > 0 ? role.skills.slice(0, isFeatured ? 4 : 3) : role.benefits.slice(0, isFeatured ? 4 : 3);

  return (
    <article
      className={cn(
        'group flex h-full min-w-0 flex-col rounded-2xl bg-white/90 p-5 text-slate-950 shadow-[0_12px_40px_-32px_rgba(15,23,42,0.15)] ring-1 ring-slate-200/50 transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_20px_50px_-24px_rgba(15,23,42,0.2)] dark:bg-slate-900/90 dark:text-slate-100 dark:ring-slate-800/50 dark:hover:bg-slate-900',
        isFeatured && 'ring-1 ring-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.02] to-cyan-500/[0.06] shadow-[0_18px_52px_-30px_rgba(18,175,203,0.15)] hover:shadow-[0_24px_64px_-24px_rgba(18,175,203,0.25)] dark:from-cyan-500/[0.01] dark:to-cyan-500/[0.04]',
        isWild && 'ring-1 ring-amber-400/20 bg-gradient-to-br from-amber-500/[0.02] to-amber-500/[0.06] shadow-[0_18px_52px_-40px_rgba(245,158,11,0.15)] hover:shadow-[0_24px_64px_-36px_rgba(245,158,11,0.25)] dark:from-amber-500/[0.01] dark:to-amber-500/[0.04]',
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
            <div className="truncate text-[13px] font-black text-slate-900 dark:text-slate-100">{role.companyName || t('rebuild.marketplace.company_unknown', { defaultValue: 'Firma' })}</div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-slate-500">
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

      {isWild ? (
        <span className="mt-3.5 self-start inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 dark:bg-amber-950/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          {t('rebuild.marketplace.badge_best_fit', { defaultValue: 'Doporučujeme' })}
        </span>
      ) : null}

      <button type="button" onClick={onOpen} className="mt-4 text-left">
        <h3 className={cn('font-black leading-snug tracking-normal text-slate-950 transition group-hover:text-[#0f95ac] dark:text-slate-100', isFeatured ? 'text-[20px]' : 'text-[17px]')}>
          {role.title}
        </h3>
      </button>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="rounded bg-[#eef8fb] px-2 py-0.5 text-[11px] font-bold text-[#08788a] dark:bg-cyan-950/40 dark:text-cyan-300">{tag}</span>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/60 mt-4">
        <div className="min-w-0">
          <div className="text-[14px] font-black text-slate-950 dark:text-slate-100">{salary}</div>
          <div className="mt-1 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1"><MapPin size={12} />{distanceLabel}</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="inline-flex items-center gap-1"><Clock3 size={12} />{role.workModel}</span>
          </div>
        </div>
        <button type="button" onClick={onOpen} className={cn("inline-flex h-8 items-center gap-1 rounded-xl px-3 text-[11px] font-black transition", 
          isFeatured ? "bg-[image:var(--shell-button-primary-bg)] text-white hover:bg-[image:var(--shell-button-primary-hover)] shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
        )}>
          {t('rebuild.marketplace.offer_detail', { defaultValue: 'Detail' })}
          <ArrowRight size={13} />
        </button>
      </div>
    </article>
  );
};

const HeroMeter: React.FC<{ tone: 'cyan' | 'violet' | 'amber' | 'green'; width?: string }> = ({ tone, width = '78%' }) => {
  const toneClass = {
    cyan: 'from-[#12afcb] to-[#61d4e5]',
    violet: 'from-[#8258e8] to-[#c7b5ff]',
    amber: 'from-[#f4a11c] to-[#ffd895]',
    green: 'from-[#62bd2f] to-[#bde59e]',
  }[tone];

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={cn('h-full rounded-full bg-gradient-to-r', toneClass)} style={{ width }} />
      </div>
      <div className="h-1.5 w-6 rounded-full bg-slate-100 dark:bg-slate-800" />
    </div>
  );
};

const HeroSignalBubble: React.FC<{
  className?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  Icon: React.ElementType;
  tone: 'cyan' | 'violet' | 'amber' | 'green';
  compact?: boolean;
  delay?: string;
}> = ({ className, title, subtitle, meta, Icon, tone, compact = false, delay }) => {
  const toneClass = {
    cyan: 'bg-[#e6fbff] text-[#0f95ac]',
    violet: 'bg-[#f0eaff] text-[#8258e8]',
    amber: 'bg-[#fff2d9] text-[#d88916]',
    green: 'bg-[#eaf7df] text-[#62bd2f]',
  }[tone];

  return (
    <div
      className={cn('marketplace-hero-bubble absolute rounded-2xl bg-white/76 text-slate-950 shadow-[0_20px_52px_-34px_rgba(15,23,42,0.32)] ring-1 ring-white/70 backdrop-blur-xl dark:bg-slate-950/72 dark:text-slate-100 dark:ring-white/10', compact ? 'px-3.5 py-2.5' : 'px-4 py-3', className)}
      style={{ animationDelay: delay }}
    >
      <div className="flex items-center gap-3">
        <span className={cn('flex shrink-0 items-center justify-center rounded-full', compact ? 'h-8 w-8' : 'h-10 w-10', toneClass)}>
          <Icon size={compact ? 15 : 18} />
        </span>
        <div className="min-w-0">
          <div className={cn('truncate font-black', compact ? 'text-[11px]' : 'text-[12px]')}>{title}</div>
          {subtitle ? <div className={cn('mt-1 truncate font-semibold text-slate-500 dark:text-slate-400', compact ? 'text-[10px]' : 'text-[11px]')}>{subtitle}</div> : null}
        </div>
      </div>
      {!compact ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <HeroMeter tone={tone} />
          {meta ? <span className="shrink-0 text-[10px] font-bold text-slate-500 dark:text-slate-400">{meta}</span> : null}
        </div>
      ) : null}
    </div>
  );
};

const HeroSignalOrb: React.FC<{ className?: string; title: string; Icon: React.ElementType }> = ({ className, title, Icon }) => (
  <div className={cn('marketplace-hero-bubble absolute flex h-24 w-24 items-center justify-center rounded-full bg-white/80 text-center text-[12px] font-black leading-tight text-slate-950 shadow-[0_20px_52px_-34px_rgba(15,23,42,0.32)] ring-1 ring-white/70 backdrop-blur-xl dark:bg-slate-950/72 dark:text-slate-100 dark:ring-white/10', className)}>
    <div>
      <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#e6fbff] text-[#0f95ac]">
        <Icon size={20} />
      </span>
      {title}
    </div>
  </div>
);

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

// ---------------------------------------------------------------------------
// Mockup-aligned helpers + card components
// ---------------------------------------------------------------------------

type DifficultyLevel = 'low' | 'medium' | 'high';

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const getRoleDifficulty = (role: Role): DifficultyLevel => {
  if (role.level === 'Junior') return 'low';
  if (role.level === 'Senior' || role.level === 'Lead') return 'high';
  return 'medium';
};

const DIFFICULTY_META: Record<DifficultyLevel, { key: string; fallback: string; dots: number; dotClass: string; textClass: string }> = {
  low: { key: 'rebuild.marketplace.difficulty_low', fallback: 'Nízká', dots: 1, dotClass: 'bg-emerald-500', textClass: 'text-emerald-600 dark:text-emerald-400' },
  medium: { key: 'rebuild.marketplace.difficulty_medium', fallback: 'Střední', dots: 2, dotClass: 'bg-amber-500', textClass: 'text-amber-600 dark:text-amber-400' },
  high: { key: 'rebuild.marketplace.difficulty_high', fallback: 'Vysoká', dots: 3, dotClass: 'bg-rose-500', textClass: 'text-rose-600 dark:text-rose-400' },
};

const getMatchPercent = (role: Role): number => {
  if (typeof role.matchScore === 'number' && role.matchScore > 0) {
    return Math.max(1, Math.min(100, Math.round(role.matchScore)));
  }
  return 70 + (hashString(String(role.id)) % 26); // deterministic 70-95 fallback
};

const getMatchBadgeClass = (percent: number): string =>
  percent >= 85
    ? 'bg-emerald-500 text-white'
    : percent >= 70
      ? 'bg-[#12afcb] text-white'
      : 'bg-slate-500 text-white';

const getRoleSlots = (role: Role): number => {
  const remaining = role.slotAvailability?.candidate?.remaining;
  if (typeof remaining === 'number' && remaining >= 0) return remaining;
  return 1 + (hashString(`slot-${role.id}`) % 5); // deterministic 1-5 fallback
};

const isHotRole = (role: Role): boolean => getRoleSlots(role) <= 2 && getMatchPercent(role) >= 80;

const formatSlotsLabel = (count: number, t: MarketplaceTFunction): string => {
  if (count <= 1) return t('rebuild.marketplace.slots_one', { defaultValue: '{{count}} volný slot', count: Math.max(0, count) });
  if (count <= 4) return t('rebuild.marketplace.slots_few', { defaultValue: '{{count}} volné sloty', count });
  return t('rebuild.marketplace.slots_many', { defaultValue: '{{count}} volných slotů', count });
};

const TRANSPORT_SPEED_KMH: Record<TransportMode, number> = { car: 50, public: 30, bike: 15, walk: 5 };

const estimateCommuteMinutes = (distanceKm: number, mode: TransportMode): number | null => {
  if (!Number.isFinite(distanceKm)) return null;
  const speed = TRANSPORT_SPEED_KMH[mode] || 35;
  return Math.max(1, Math.round((distanceKm / speed) * 60));
};

const formatCommuteLabel = (
  role: Role,
  distanceKm: number,
  mode: TransportMode,
  t: MarketplaceTFunction,
  long = false,
): string => {
  if (isRemoteRole(role)) return t('rebuild.marketplace.work_arrangement_remote', { defaultValue: 'Remote' });
  const minutes = estimateCommuteMinutes(distanceKm, mode);
  if (minutes === null) return role.location || t('rebuild.marketplace.default_location', { defaultValue: 'Česká republika' });
  return long
    ? t('rebuild.marketplace.commute_from_home', { defaultValue: '{{count}} min od domova', count: minutes })
    : t('rebuild.marketplace.commute_minutes', { defaultValue: '{{count}} min', count: minutes });
};

const CURRENCY_SUFFIX: Record<string, string> = { CZK: 'Kč', EUR: '€', PLN: 'zł' };

const getRoleNetMonthly = (role: Role, taxProfile?: TaxProfile): number => {
  const gross = Math.max(role.salaryFrom || 0, role.salaryTo || 0);
  if (gross <= 0) return 0;
  const { net } = estimateNetSalaryByCountry(gross, false, role.countryCode, role.location, role.currency, taxProfile);
  return Math.round(net || 0);
};

const formatNetSalary = (role: Role, taxProfile: TaxProfile | undefined, t: MarketplaceTFunction): { value: string; hasValue: boolean } => {
  const net = getRoleNetMonthly(role, taxProfile);
  if (net <= 0) return { value: t('rebuild.marketplace.salary_not_specified', { defaultValue: 'Mzda neuvedena' }), hasValue: false };
  const suffix = CURRENCY_SUFFIX[role.currency] || role.currency;
  return { value: `${net.toLocaleString('cs-CZ')} ${suffix}`, hasValue: true };
};

const DifficultyDots: React.FC<{ level: DifficultyLevel }> = ({ level }) => {
  const meta = DIFFICULTY_META[level];
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span key={index} className={cn('h-1.5 w-1.5 rounded-full', index < meta.dots ? meta.dotClass : 'bg-slate-200 dark:bg-slate-700')} />
      ))}
    </span>
  );
};

const CompanyLogoBadge: React.FC<{ role: Role; className?: string }> = ({ role, className }) => (
  <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-[#0f95ac] ring-1 ring-slate-200/70 dark:bg-slate-800 dark:ring-slate-700', className)}>
    {role.companyLogo ? (
      <img src={role.companyLogo} alt="" className="h-full w-full object-contain p-1" loading="lazy" />
    ) : (
      <span className="text-sm font-black">{(role.companyName || '?').slice(0, 2).toUpperCase()}</span>
    )}
  </span>
);

const FeaturedOpportunityCard: React.FC<{
  candidate: RoleCandidate;
  preferences: CandidatePreferenceProfile;
  candidateAvatar?: string;
  saved: boolean;
  onOpen: () => void;
  onToggleSaved: () => void;
  t: MarketplaceTFunction;
}> = ({ candidate, preferences, candidateAvatar, saved, onOpen, onToggleSaved, t }) => {
  const role = candidate.role;
  const matchPercent = getMatchPercent(role);
  const hot = isHotRole(role);
  const difficulty = getRoleDifficulty(role);
  const difficultyMeta = DIFFICULTY_META[difficulty];
  const slots = getRoleSlots(role);
  const salary = formatNetSalary(role, preferences.taxProfile, t);
  const cover = role.heroImage || role.companyCoverImage || '';

  const infoRows: Array<{ icon: React.ElementType; label: string }> = [
    { icon: Wallet, label: salary.hasValue ? `${salary.value} ${t('rebuild.marketplace.net_suffix', { defaultValue: 'čistého' })}` : salary.value },
    { icon: MapPin, label: formatCommuteLabel(role, candidate.distanceKm, preferences.transportMode, t, true) },
    { icon: Gauge, label: t('rebuild.marketplace.difficulty_label', { defaultValue: '{{level}} náročnost', level: t(difficultyMeta.key, { defaultValue: difficultyMeta.fallback }) }) },
    { icon: ArrowUpDown, label: formatSlotsLabel(slots, t) },
  ];

  return (
    <article className="flex w-[300px] shrink-0 snap-start flex-col overflow-hidden rounded-3xl bg-white shadow-[0_18px_50px_-34px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_64px_-30px_rgba(15,23,42,0.4)] dark:bg-slate-900 dark:ring-slate-800 sm:w-[320px]">
      <div className="relative h-44 w-full overflow-hidden">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#0f4f73] to-[#0f95ac]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
        <span className={cn('absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black shadow-sm', hot ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white' : getMatchBadgeClass(matchPercent))}>
          {hot ? <><Flame size={12} /> {t('rebuild.marketplace.hot_opportunity', { defaultValue: 'Horká příležitost' })}</> : `${matchPercent}% Match`}
        </span>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onToggleSaved(); }}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm transition hover:bg-white hover:text-[#0f95ac] dark:bg-white"
          aria-label={t('rebuild.marketplace.save_role', { defaultValue: 'Uložit nabídku' })}
        >
          <Bookmark size={15} className={cn(saved && 'fill-[#12afcb] text-[#12afcb]')} />
        </button>
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <CompanyLogoBadge role={role} className="h-9 w-9" />
          <span className="max-w-[150px] truncate text-[13px] font-black text-white drop-shadow-lg">{role.companyName}</span>
        </div>
        {candidateAvatar ? (
          <img src={candidateAvatar} alt="" className="absolute -bottom-5 right-4 h-12 w-12 rounded-full object-cover ring-4 ring-white dark:ring-slate-900" loading="lazy" />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4 pt-5">
        <h3 className="line-clamp-2 text-[16px] font-black leading-tight text-slate-950 dark:text-slate-100">{role.title}</h3>
        <div className="mt-3 space-y-2">
          {infoRows.map(({ icon: Icon, label }, index) => (
            <div key={index} className="flex items-center gap-2 text-[13px] font-semibold text-slate-600 dark:text-slate-300">
              <Icon size={15} className="shrink-0 text-[#0f95ac]" />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button type="button" onClick={onOpen} className="text-[12px] font-black text-[#0f95ac] hover:underline">
            {t('rebuild.marketplace.why_match', { defaultValue: 'Proč je to match?' })}
          </button>
          <button type="button" onClick={onOpen} className="inline-flex h-9 items-center justify-center rounded-lg bg-[#12afcb] px-4 text-[12px] font-black text-white shadow-sm transition hover:bg-[#0f95ac]">
            {t('rebuild.marketplace.learn_more', { defaultValue: 'Zjistit víc' })}
          </button>
        </div>
      </div>
    </article>
  );
};

const CompanyInterestCard: React.FC<{
  role: RoleCandidate['role'];
  matchPercent: number;
  saved: boolean;
  onOpen: () => void;
  onToggleSaved: () => void;
  t: MarketplaceTFunction;
}> = ({ role, matchPercent, saved, onOpen, onToggleSaved, t }) => {
  const reviewer = role.companyReviewer;
  const poster = role.companyCoverImage || role.heroImage || '';
  return (
    <article className="flex w-full flex-col rounded-3xl bg-white p-4 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.32)] ring-1 ring-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_60px_-32px_rgba(15,23,42,0.36)] dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CompanyLogoBadge role={role} className="h-11 w-11" />
          <div className="min-w-0">
            <div className="truncate text-[15px] font-black text-slate-950 dark:text-slate-100">{role.companyName}</div>
            {reviewer ? (
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                {reviewer.avatarUrl ? <img src={reviewer.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" loading="lazy" /> : <CircleUserRound size={14} className="text-slate-400" />}
                <span className="truncate">{[reviewer.name, reviewer.role].filter(Boolean).join(' · ')}</span>
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleSaved}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-[#0f95ac] dark:hover:bg-slate-800"
          aria-label={t('rebuild.marketplace.save_role', { defaultValue: 'Uložit nabídku' })}
        >
          <Bookmark size={15} className={cn(saved && 'fill-[#12afcb] text-[#12afcb]')} />
        </button>
      </div>

      <button type="button" onClick={onOpen} className="group relative mt-4 block h-40 w-full overflow-hidden rounded-2xl bg-slate-900">
        {poster ? <img src={poster} alt="" className="h-full w-full object-cover opacity-90 transition group-hover:scale-105" loading="lazy" /> : <div className="h-full w-full bg-gradient-to-br from-slate-700 to-slate-900" />}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#12afcb] text-white shadow-lg transition group-hover:scale-110">
            <Play size={20} className="ml-0.5 fill-white" />
          </span>
        </span>
      </button>

      <p className="mt-4 text-[14px] font-black text-slate-900 dark:text-slate-100">
        {t('rebuild.marketplace.company_match_line', { defaultValue: 'Tvůj profil odpovídá {{percent}} % toho, co hledáme.', percent: matchPercent })}
      </p>
      <p className="mt-1 text-[12px] font-semibold text-slate-500">{t('rebuild.marketplace.company_match_sub', { defaultValue: 'Rádi tě poznáme v handshake.' })}</p>

      <button type="button" onClick={onOpen} className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#12afcb] px-5 text-[13px] font-black text-white shadow-sm transition hover:bg-[#0f95ac]">
        {t('rebuild.marketplace.open_handshake', { defaultValue: 'Otevřít handshake' })}
      </button>
    </article>
  );
};

const SimilarRoleCard: React.FC<{
  role: RoleCandidate['role'];
  matchPercent: number;
  Icon: React.ElementType;
  onOpen: () => void;
  t: MarketplaceTFunction;
}> = ({ role, matchPercent, Icon, onOpen, t }) => (
  <button
    type="button"
    onClick={onOpen}
    className="flex w-[210px] shrink-0 snap-start items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-[0_14px_40px_-34px_rgba(15,23,42,0.3)] ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-30px_rgba(15,23,42,0.34)] dark:bg-slate-900 dark:ring-slate-800"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef8fb] text-[#0f95ac] dark:bg-cyan-950/50 dark:text-cyan-300">
      {role.companyLogo ? <img src={role.companyLogo} alt="" className="h-7 w-7 object-contain" loading="lazy" /> : <Icon size={18} />}
    </span>
    <span className="min-w-0">
      <span className="block truncate text-[13px] font-black text-slate-950 dark:text-slate-100">{role.title}</span>
      <span className="block truncate text-[11px] font-semibold text-slate-500">{role.companyName}</span>
      <span className="mt-0.5 block text-[11px] font-black text-[#0f95ac]">{t('rebuild.marketplace.percent_match', { defaultValue: '{{percent}}% match', percent: matchPercent })}</span>
    </span>
  </button>
);

const MarketplaceListRow: React.FC<{
  candidate: RoleCandidate;
  preferences: CandidatePreferenceProfile;
  onOpen: () => void;
  t: MarketplaceTFunction;
}> = ({ candidate, preferences, onOpen, t }) => {
  const role = candidate.role;
  const matchPercent = getMatchPercent(role);
  const difficulty = getRoleDifficulty(role);
  const difficultyMeta = DIFFICULTY_META[difficulty];
  const slots = getRoleSlots(role);
  const salary = formatNetSalary(role, preferences.taxProfile, t);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-[0_10px_30px_-30px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/60 transition hover:bg-[#f9fdfe] hover:ring-[#12afcb]/30 dark:bg-slate-900 dark:ring-slate-800 dark:hover:bg-slate-800/60 lg:flex-row lg:items-center lg:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <CompanyLogoBadge role={role} className="h-10 w-10" />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-black text-slate-950 dark:text-slate-100">{role.title}</div>
          <div className="truncate text-[12px] font-semibold text-slate-500">{role.companyName}</div>
        </div>
      </div>

      <span className={cn('inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-black', getMatchBadgeClass(matchPercent))}>
        {t('rebuild.marketplace.percent_match', { defaultValue: '{{percent}}% match', percent: matchPercent })}
      </span>

      <div className="hidden min-w-[110px] lg:block">
        <div className="text-[13px] font-black text-slate-900 dark:text-slate-100">{salary.value}</div>
        {salary.hasValue ? <div className="text-[10px] font-semibold text-slate-400">{t('rebuild.marketplace.net_suffix', { defaultValue: 'čistého' })}</div> : null}
      </div>

      <div className="hidden min-w-[90px] lg:block">
        <div className="truncate text-[13px] font-bold text-slate-700 dark:text-slate-200">{role.location?.split(',')[0] || '—'}</div>
        <div className="text-[10px] font-semibold text-slate-400">{role.workModel}</div>
      </div>

      <div className="hidden min-w-[64px] items-center gap-1.5 text-[13px] font-bold text-slate-700 dark:text-slate-200 lg:flex">
        <Clock3 size={14} className="text-slate-400" />
        {formatCommuteLabel(role, candidate.distanceKm, preferences.transportMode, t)}
      </div>

      <div className="hidden min-w-[92px] items-center gap-2 lg:flex">
        <span className={cn('text-[12px] font-black', difficultyMeta.textClass)}>{t(difficultyMeta.key, { defaultValue: difficultyMeta.fallback })}</span>
        <DifficultyDots level={difficulty} />
      </div>

      <div className="hidden min-w-[110px] text-[12px] font-semibold text-slate-500 xl:block">{formatSlotsLabel(slots, t)}</div>

      <button type="button" onClick={onOpen} className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-[#eef8fb] px-4 text-[12px] font-black text-[#0f95ac] transition hover:bg-[#12afcb] hover:text-white dark:bg-cyan-950/40 dark:text-cyan-300">
        {t('rebuild.marketplace.view', { defaultValue: 'Zobrazit' })}
      </button>
    </div>
  );
};

type DropdownOption = { value: string; label: string };

const FilterDropdown: React.FC<{
  label: string;
  value: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  align?: 'left' | 'right';
}> = ({ label, value, options, onSelect, align = 'left' }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);
  const active = options.find((option) => option.value === value);

  React.useEffect(() => {
    if (!open) return undefined;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isActive = value && value !== 'all' && value !== 'relevance';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13px] font-bold transition ring-1',
          isActive
            ? 'bg-[#eef8fb] text-[#0f95ac] ring-[#12afcb]/30 dark:bg-cyan-950/40 dark:text-cyan-300'
            : 'bg-white text-slate-600 ring-slate-200/70 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800',
        )}
      >
        <span className="truncate max-w-[140px]">{isActive && active ? active.label : label}</span>
        <ChevronDown size={14} className={cn('transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className={cn('absolute z-40 mt-2 max-h-72 w-52 overflow-auto rounded-2xl bg-white p-1.5 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.4)] ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800', align === 'right' ? 'right-0' : 'left-0')}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => { onSelect(option.value); setOpen(false); }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-800',
                option.value === value ? 'text-[#0f95ac]' : 'text-slate-600 dark:text-slate-300',
              )}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value ? <Check size={14} className="shrink-0" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
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
  const [difficultyFilter, setDifficultyFilter] = React.useState<'all' | DifficultyLevel>('all');
  const [sortMode, setSortMode] = React.useState<'relevance' | 'salary' | 'distance'>('relevance');
  const [aiQuery, setAiQuery] = React.useState(searchValue);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiNotice, setAiNotice] = React.useState<string | null>(null);
  const loadMoreSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const autoLoadTimerRef = React.useRef<number | null>(null);
  const featuredScrollRef = React.useRef<HTMLDivElement | null>(null);
  const similarScrollRef = React.useRef<HTMLDivElement | null>(null);

  const runAiSearch = React.useCallback(async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) {
      // Empty query — clear the AI-applied state and reset filters.
      onSearchChange('');
      onResetFilters();
      setDifficultyFilter('all');
      setAiNotice(null);
      return;
    }
    setAiBusy(true);
    try {
      const parsed: ParsedSearchFilters = await parseNaturalLanguageQuery(query, currentLanguage || 'cs');
      onFiltersChange((current) => applyParsedFilters(parsed, current));
      // Feed only the extracted role keyword into the free-text search so the
      // strict token match doesn't filter everything out on long NL phrases.
      onSearchChange(parsed.targetRole || '');
      if (parsed.difficulty && parsed.difficulty !== 'all') setDifficultyFilter(parsed.difficulty);
      setVisibleRecommendationCount(RECOMMENDATION_PAGE_SIZE);
      const chips = [
        parsed.targetRole,
        parsed.city,
        parsed.roleFamily !== 'all' ? parsed.roleFamily : '',
        parsed.remoteOnly ? t('rebuild.marketplace.work_arrangement_remote', { defaultValue: 'Remote' }) : '',
        parsed.minSalary > 0 ? `${parsed.minSalary.toLocaleString('cs-CZ')}+ ${CURRENCY_SUFFIX.CZK}` : '',
        parsed.difficulty && parsed.difficulty !== 'all' ? t(DIFFICULTY_META[parsed.difficulty].key, { defaultValue: DIFFICULTY_META[parsed.difficulty].fallback }) : '',
      ].filter(Boolean);
      setAiNotice(
        chips.length > 0
          ? t('rebuild.marketplace.ai_applied', { defaultValue: 'AI filtry: {{chips}}', chips: chips.join(' · ') })
          : t('rebuild.marketplace.ai_applied_text', { defaultValue: 'Hledám podle: {{query}}', query }),
      );
    } catch {
      setAiNotice(null);
    } finally {
      setAiBusy(false);
    }
  }, [currentLanguage, onFiltersChange, onResetFilters, onSearchChange, t]);

  const scrollByCards = (ref: React.RefObject<HTMLDivElement | null>, direction: 1 | -1) => {
    ref.current?.scrollBy({ left: direction * 360, behavior: 'smooth' });
  };

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
  const loadedCatalogCandidates = React.useMemo(() => {
    return roles.map((role) => {
      if (!effectiveCoordinates) return { role, distanceKm: Infinity };
      return {
        role,
        distanceKm: getDistance(effectiveCoordinates.lat, effectiveCoordinates.lon, role.coordinates.lat, role.coordinates.lng),
      };
    });
  }, [effectiveCoordinates, roles]);
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
        || !Number.isFinite(distanceKm)
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
      const aUnknownDistancePenalty = Number.isFinite(a.distanceKm) || isRemoteRole(a.role) ? 0 : 3;
      const bUnknownDistancePenalty = Number.isFinite(b.distanceKm) || isRemoteRole(b.role) ? 0 : 3;
      const scoreA = aLocalBoost + aRemoteBoost + aUnknownDistancePenalty;
      const scoreB = bLocalBoost + bRemoteBoost + bUnknownDistancePenalty;
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
  }, [filters, focusMode, localRadiusKm, preferences.address, searchValue]);

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
  const baseFeedCandidates = React.useMemo(() => {
    const primary = activeCategorySection
      ? activeCategorySection.candidates
      : scopedRecommendationCandidates;
    const merged = new Map<string, RoleCandidate>();
    primary.forEach((candidate) => merged.set(candidate.role.id, candidate));
    if (!activeCategorySection) {
      loadedCatalogCandidates.forEach((candidate) => {
        if (!merged.has(candidate.role.id)) merged.set(candidate.role.id, candidate);
      });
    }
    return Array.from(merged.values());
  }, [activeCategorySection, loadedCatalogCandidates, scopedRecommendationCandidates]);
  const candidateAvatar = userProfile.photo || undefined;

  // Featured "best opportunities" — top relevance-ranked roles.
  const featuredCandidates = React.useMemo(() => {
    const source = scopedRecommendationCandidates.length > 0 ? scopedRecommendationCandidates : baseFeedCandidates;
    return source.slice(0, 8);
  }, [baseFeedCandidates, scopedRecommendationCandidates]);

  // Companies that want to meet you — distinct companies from the recommendation pool.
  const companyCards = React.useMemo(() => {
    const seen = new Set<string>();
    const cards: Array<{ role: Role; matchPercent: number }> = [];
    for (const { role } of scopedRecommendationCandidates) {
      const key = role.companyId || role.companyName || role.id;
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push({ role, matchPercent: getMatchPercent(role) });
      if (cards.length >= 3) break;
    }
    return cards;
  }, [scopedRecommendationCandidates]);

  // Similar roles strip — distinct from the featured set.
  const similarCandidates = React.useMemo(() => {
    const featuredIds = new Set(featuredCandidates.map(({ role }) => role.id));
    return scopedRecommendationCandidates.filter(({ role }) => !featuredIds.has(role.id)).slice(0, 10);
  }, [featuredCandidates, scopedRecommendationCandidates]);

  // Marketplace list — difficulty filter + sort applied on top of the merged feed.
  const marketplaceFiltered = React.useMemo(() => {
    const filtered = difficultyFilter === 'all'
      ? baseFeedCandidates
      : baseFeedCandidates.filter(({ role }) => getRoleDifficulty(role) === difficultyFilter);
    const sorted = [...filtered];
    if (sortMode === 'salary') {
      sorted.sort((a, b) => Math.max(b.role.salaryFrom || 0, b.role.salaryTo || 0) - Math.max(a.role.salaryFrom || 0, a.role.salaryTo || 0));
    } else if (sortMode === 'distance') {
      sorted.sort((a, b) => a.distanceKm - b.distanceKm);
    }
    return sorted;
  }, [baseFeedCandidates, difficultyFilter, sortMode]);
  const marketplaceVisible = marketplaceFiltered.slice(0, visibleRecommendationCount);
  const hasMoreFeedCandidates = visibleRecommendationCount < marketplaceFiltered.length;

  // Location dropdown options derived from the loaded catalog.
  const cityOptions = React.useMemo<DropdownOption[]>(() => {
    const counts = new Map<string, number>();
    roles.forEach((role) => {
      const city = (role.location || '').split(',')[0].trim();
      if (city) counts.set(city, (counts.get(city) || 0) + 1);
    });
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([city]) => ({ value: city, label: city }));
    return [{ value: 'all', label: t('rebuild.marketplace.location_all', { defaultValue: 'Všechny lokality' }) }, ...top];
  }, [roles, t]);

  const categoryTiles = catalogSections.slice(0, 6).map((section) => ({
    id: section.id,
    title: section.title,
    count: section.candidates.length,
    Icon: roleFamilyIcon(section.id),
  }));
  const handleFeedLoadMore = React.useCallback(() => {
    if (hasMoreFeedCandidates) {
      setVisibleRecommendationCount((current) => Math.min(current + MARKETPLACE_FEED_PAGE_SIZE, marketplaceFiltered.length));
      return;
    }
    if (hasMore && onLoadMore && !loading) {
      setVisibleRecommendationCount((current) => current + MARKETPLACE_FEED_PAGE_SIZE);
      onLoadMore();
    }
  }, [marketplaceFiltered.length, hasMore, hasMoreFeedCandidates, loading, onLoadMore]);

  React.useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        if (autoLoadTimerRef.current !== null) return;
        autoLoadTimerRef.current = window.setTimeout(() => {
          autoLoadTimerRef.current = null;
          if (hasMoreFeedCandidates) {
            setVisibleRecommendationCount((current) => Math.min(current + MARKETPLACE_FEED_PAGE_SIZE, marketplaceFiltered.length));
          }
        }, 180);
      },
      { root: null, rootMargin: '520px 0px 760px', threshold: 0.01 },
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      if (autoLoadTimerRef.current !== null) {
        window.clearTimeout(autoLoadTimerRef.current);
        autoLoadTimerRef.current = null;
      }
    };
  }, [marketplaceFiltered.length, hasMoreFeedCandidates]);

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
        aiSearchValue={aiQuery}
        onAiSearchChange={(val) => setAiQuery(val)}
        onAiSearchSubmit={() => { void runAiSearch(aiQuery); }}
        aiSearchBusy={aiBusy}
        onFiltersOpen={() => setFiltersOpen(true)}
        activeFilterCount={activeFilterCount}
        actionRegion={
          <button type="button" onClick={() => setFiltersOpen(true)} className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/86 text-[#08788a] shadow-[0_14px_34px_-28px_rgba(15,23,42,0.4)] ring-1 ring-slate-900/[0.06] transition hover:bg-[#f7fcfd] dark:bg-slate-900 dark:text-cyan-300 dark:ring-white/10" aria-label={t('rebuild.marketplace.open_search', { defaultValue: 'Otevřít vyhledávání' })}>
            <SlidersHorizontal size={16} />
            {activeFilterCount ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#12afcb] px-1 text-[10px] font-black text-white">{activeFilterCount}</span> : null}
          </button>
        }
      >
        <MarketplaceSchema roles={visibleRoles} t={t} />
        <div className="space-y-10 scroll-smooth pb-12">
          {/* AI notice */}
          {aiNotice ? (
            <div className="flex items-center gap-2 px-1 text-[12px] font-bold text-[#0f95ac]">
              <BrainCircuit size={14} className="shrink-0" />
              <span className="truncate">{aiNotice}</span>
              <button type="button" onClick={onResetFilters} className="ml-auto shrink-0 text-[11px] font-bold text-slate-400 hover:text-slate-600">{t('rebuild.marketplace.reset', { defaultValue: 'Zrušit' })}</button>
            </div>
          ) : null}

          {/* Section 1 — Best opportunities */}
          {featuredCandidates.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="flex items-center gap-1.5 text-lg font-bold text-slate-950 dark:text-slate-100">
                    {t('rebuild.marketplace.best_opportunities', { defaultValue: 'Tvé nejlepší příležitosti' })}
                    <Sparkles size={15} className="text-[#12afcb]" />
                  </h2>
                  <p className="text-xs font-medium text-slate-500">{t('rebuild.marketplace.based_on_profile', { defaultValue: 'Na základě tvého profilu a preferencí' })}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => scrollByCards(featuredScrollRef, -1)} className="hidden h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/70 transition hover:text-[#0f95ac] dark:bg-slate-900 dark:ring-slate-800 sm:flex" aria-label={t('rebuild.marketplace.scroll_back', { defaultValue: 'Posunout zpět' })}>
                    <ChevronRight size={15} className="rotate-180" />
                  </button>
                  <button type="button" onClick={() => scrollByCards(featuredScrollRef, 1)} className="hidden h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/70 transition hover:text-[#0f95ac] dark:bg-slate-900 dark:ring-slate-800 sm:flex" aria-label={t('rebuild.marketplace.scroll_more', { defaultValue: 'Posunout dál' })}>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
              <div ref={featuredScrollRef} className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {featuredCandidates.map((candidate) => (
                  <FeaturedOpportunityCard
                    key={candidate.role.id}
                    candidate={candidate}
                    preferences={preferences}
                    candidateAvatar={candidateAvatar}
                    saved={savedRoleIds?.includes(String(candidate.role.id)) || false}
                    onOpen={() => navigate(getRolePath(candidate.role))}
                    onToggleSaved={() => onToggleSavedRole?.(candidate.role.id)}
                    t={t}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* Section 2 — Companies that want to meet you */}
          {companyCards.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4 px-1">
                <div>
                  <h2 className="text-[22px] font-black tracking-normal text-slate-950 dark:text-slate-100">{t('rebuild.marketplace.companies_interested', { defaultValue: 'Firmy, které tě chtějí poznat' })}</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">{t('rebuild.marketplace.companies_interested_sub', { defaultValue: 'Firmy, které vidí potenciál ve tvém profilu' })}</p>
                </div>
                <button type="button" onClick={() => navigate('/candidate/handshake')} className="text-[13px] font-black text-[#0f95ac] hover:underline">{t('rebuild.marketplace.show_all', { defaultValue: 'Zobrazit všechny' })}</button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {companyCards.map(({ role, matchPercent }) => (
                  <CompanyInterestCard
                    key={role.id}
                    role={role}
                    matchPercent={matchPercent}
                    saved={savedRoleIds?.includes(String(role.id)) || false}
                    onOpen={() => navigate(getRolePath(role))}
                    onToggleSaved={() => onToggleSavedRole?.(role.id)}
                    t={t}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* Section 3 — Similar roles */}
          {similarCandidates.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4 px-1">
                <div>
                  <h2 className="text-lg font-bold text-slate-950 dark:text-slate-100">{t('rebuild.marketplace.similar_to_interest', { defaultValue: 'Podobné jako to, co tě zajímá' })}</h2>
                  <p className="text-xs font-medium text-slate-500">{t('rebuild.marketplace.similar_sub', { defaultValue: 'Role a firmy v podobném zaměření' })}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => scrollByCards(similarScrollRef, -1)} className="hidden h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/70 transition hover:text-[#0f95ac] dark:bg-slate-900 dark:ring-slate-800 sm:flex" aria-label={t('rebuild.marketplace.scroll_back', { defaultValue: 'Posunout zpět' })}>
                    <ChevronRight size={15} className="rotate-180" />
                  </button>
                  <button type="button" onClick={() => scrollByCards(similarScrollRef, 1)} className="hidden h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200/70 transition hover:text-[#0f95ac] dark:bg-slate-900 dark:ring-slate-800 sm:flex" aria-label={t('rebuild.marketplace.scroll_more', { defaultValue: 'Posunout dál' })}>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
              <div ref={similarScrollRef} className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {similarCandidates.map((candidate) => (
                  <SimilarRoleCard
                    key={candidate.role.id}
                    role={candidate.role}
                    matchPercent={getMatchPercent(candidate.role)}
                    Icon={roleFamilyIcon(getRoleClusterId(candidate.role))}
                    onOpen={() => navigate(getRolePath(candidate.role))}
                    t={t}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* Section 4 — Discover by category */}
          {categoryTiles.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4 px-1">
                <h2 className="text-[22px] font-black tracking-normal text-slate-950 dark:text-slate-100">{t('rebuild.marketplace.discover_by_category', { defaultValue: 'Objevuj podle kategorií' })}</h2>
                <button type="button" onClick={() => setActiveCategoryId(null)} className="text-[13px] font-black text-[#0f95ac] hover:underline">{t('rebuild.marketplace.show_all', { defaultValue: 'Zobrazit všechny' })}</button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {categoryTiles.map(({ id, title, count, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setActiveCategoryId(id);
                      setVisibleRecommendationCount(RECOMMENDATION_PAGE_SIZE);
                      document.getElementById('marketplace-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    aria-pressed={activeCategoryId === id}
                    className={cn(
                      'flex flex-col items-start gap-3 rounded-2xl bg-white p-4 text-left shadow-[0_14px_40px_-36px_rgba(15,23,42,0.3)] ring-1 transition hover:-translate-y-0.5 hover:shadow-[0_22px_52px_-32px_rgba(15,23,42,0.34)] dark:bg-slate-900',
                      activeCategoryId === id ? 'ring-2 ring-[#12afcb]/40' : 'ring-slate-200/60 dark:ring-slate-800',
                    )}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef8fb] text-[#0f95ac] dark:bg-cyan-950/50 dark:text-cyan-300">
                      {loadingCategoryId === id ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-black text-slate-950 dark:text-slate-100">{title}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">{t('rebuild.marketplace.position_count', { defaultValue: '{{count}} pozic', count })}</span>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {/* Section 5 — Marketplace list */}
          <section id="marketplace-list" className="space-y-4">
            <div className="px-1">
              <h2 className="text-[22px] font-black tracking-normal text-slate-950 dark:text-slate-100">{t('rebuild.nav.marketplace', { defaultValue: 'Marketplace' })}</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">{t('rebuild.marketplace.all_active', { defaultValue: 'Všechny aktivní příležitosti' })}</p>
            </div>

            <div className="flex flex-col gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-slate-200/60 dark:bg-slate-900/60 dark:ring-slate-800 lg:flex-row lg:items-center">
              <div className="flex flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70 focus-within:ring-2 focus-within:ring-[#12afcb]/40 dark:bg-slate-800/60 dark:ring-slate-700">
                <Search size={16} className="shrink-0 text-slate-400" />
                <input
                  value={aiQuery}
                  onChange={(event) => setAiQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void runAiSearch(aiQuery); } }}
                  placeholder={t('rebuild.marketplace.search_in_marketplace', { defaultValue: 'Hledat v marketplace…' })}
                  className="w-full bg-transparent text-[13px] font-semibold text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <FilterDropdown
                  label={t('rebuild.marketplace.field', { defaultValue: 'Obor' })}
                  value={filters.roleFamily}
                  options={getRoleFamilyOptions(t).map((option) => ({ value: option.value, label: option.label }))}
                  onSelect={(value) => onFiltersChange((current) => ({ ...current, roleFamily: value as MarketplaceFilters['roleFamily'] }))}
                />
                <FilterDropdown
                  label={t('rebuild.marketplace.location', { defaultValue: 'Lokalita' })}
                  value={filters.city || 'all'}
                  options={cityOptions}
                  onSelect={(value) => onFiltersChange((current) => ({ ...current, city: value === 'all' ? '' : value }))}
                />
                <FilterDropdown
                  label={t('rebuild.marketplace.salary', { defaultValue: 'Mzda' })}
                  value={String(filters.minSalary || 'all')}
                  options={[
                    { value: 'all', label: t('rebuild.marketplace.salary_any', { defaultValue: 'Libovolná mzda' }) },
                    { value: '30000', label: '30 000+' },
                    { value: '45000', label: '45 000+' },
                    { value: '60000', label: '60 000+' },
                    { value: '80000', label: '80 000+' },
                  ]}
                  onSelect={(value) => onFiltersChange((current) => ({ ...current, minSalary: value === 'all' ? 0 : Number(value) }))}
                />
                <FilterDropdown
                  label={t('rebuild.marketplace.difficulty', { defaultValue: 'Náročnost' })}
                  value={difficultyFilter}
                  options={[
                    { value: 'all', label: t('rebuild.marketplace.difficulty_any', { defaultValue: 'Libovolná' }) },
                    { value: 'low', label: t('rebuild.marketplace.difficulty_low', { defaultValue: 'Nízká' }) },
                    { value: 'medium', label: t('rebuild.marketplace.difficulty_medium', { defaultValue: 'Střední' }) },
                    { value: 'high', label: t('rebuild.marketplace.difficulty_high', { defaultValue: 'Vysoká' }) },
                  ]}
                  onSelect={(value) => setDifficultyFilter(value as 'all' | DifficultyLevel)}
                />
                <FilterDropdown
                  label={t('rebuild.marketplace.sort', { defaultValue: 'Řazení' })}
                  value={sortMode}
                  align="right"
                  options={[
                    { value: 'relevance', label: t('rebuild.marketplace.sort_relevance', { defaultValue: 'Nejrelevantnější' }) },
                    { value: 'salary', label: t('rebuild.marketplace.sort_salary', { defaultValue: 'Nejvyšší mzda' }) },
                    { value: 'distance', label: t('rebuild.marketplace.sort_distance', { defaultValue: 'Nejbližší' }) },
                  ]}
                  onSelect={(value) => setSortMode(value as 'relevance' | 'salary' | 'distance')}
                />
              </div>
            </div>

            {marketplaceVisible.length > 0 ? (
              <div className="space-y-2">
                {marketplaceVisible.map((candidate) => (
                  <MarketplaceListRow
                    key={candidate.role.id}
                    candidate={candidate}
                    preferences={preferences}
                    onOpen={() => navigate(getRolePath(candidate.role))}
                    t={t}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900/70">
                {t('rebuild.marketplace.no_results', { defaultValue: 'Žádné nabídky neodpovídají tvému hledání. Zkus upravit filtry nebo dotaz.' })}
              </div>
            )}

            <div className="flex flex-col items-center gap-3">
              <div ref={loadMoreSentinelRef} className="h-2 w-full" aria-hidden="true" />
              {hasMoreFeedCandidates ? (
                <button type="button" onClick={handleFeedLoadMore} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-[13px] font-black text-[#0f95ac] shadow-sm ring-1 ring-slate-200/70 transition hover:bg-[#f1fbfd] dark:bg-slate-900 dark:text-cyan-300 dark:ring-slate-800">
                  {t('rebuild.marketplace.show_more_offers', { defaultValue: 'Zobrazit více nabídek' })}
                  <ChevronDown size={15} />
                </button>
              ) : null}
              {!hasMoreFeedCandidates && hasMore && onLoadMore ? (
                <button type="button" onClick={handleFeedLoadMore} disabled={loading} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-[13px] font-black text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-white disabled:cursor-wait disabled:opacity-70 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                  {loading ? t('rebuild.marketplace.loading_catalog', { defaultValue: 'Načítám katalog' }) : t('rebuild.marketplace.load_next_from_db', { defaultValue: 'Načíst dalších {{count}} z databáze', count: MARKETPLACE_FEED_PAGE_SIZE })}
                  <span className="text-slate-400">{roles.length.toLocaleString('cs-CZ')} / {totalCount.toLocaleString('cs-CZ')}</span>
                </button>
              ) : null}
            </div>
          </section>

          {/* CTA */}
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
