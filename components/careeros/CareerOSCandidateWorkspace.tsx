import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Bot,
  Briefcase,
  BookOpen,
  CarFront,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dog,
  Globe2,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  Mail,
  RotateCcw,
  Sparkles,
  Star,
  TrendingUp,
  UtensilsCrossed,
  X,
} from 'lucide-react';

import type {
  CareerMapBranchOverrides,
  CareerMapNodeOffset,
  Job,
  JobWorkArrangementFilter,
  LearningResource,
  SearchLanguageCode,
  TransportMode,
  UserProfile,
} from '../../types';
import { resolveCareerNavigationGoalWithAi } from '../../services/mistralService';
import { fetchLearningResources } from '../../services/learningResourceService';
import { listProfileMiniChallenges } from '../../services/profileMiniChallengeService';
import { getCareerMapPool, getMainDatabaseJobCount } from '../../services/jobService';
import { updateUserProfile as persistUserProfile } from '../../services/supabaseService';
import { cn } from '../ui/primitives';
import TransportModeSelector from '../TransportModeSelector';
import {
  GalaxyNeuralCircuitTexture as NeuralCircuitTexture,
  GalaxyStageBackground as StageBackground,
  galaxyShellPanelClass as shellPanel,
  galaxyShellInputClass as shellInput,
  galaxyShellCtaButtonClass as shellCtaButton,
  galaxyShellSecondaryButtonClass as shellSecondaryButton,
} from '../galaxy/GalaxyShellPrimitives';
import { GalaxyCanvasControls, GalaxyLayerSidebar } from '../galaxy/GalaxyWorkspaceChrome';
import { resolveJobDomain } from '../../utils/domainAccents';
import MarketplaceSidebar from './MarketplaceSidebar';
import {
  buildCareerNavigationGoalFromAlternative,
  buildCareerNavigationRoute,
  inferCareerNavigationGoal,
  mergeCareerNavigationGoalWithAi,
  type CareerNavigationGoal,
  type CareerNavigationGoalAlternative,
  type CareerNavigationMiniChallengeOption,
  type CareerNavigationPathOption,
  type CareerNavigationRoute,
} from '../../src/app/careeros/model/careerNavigation';
import {
  type CareerOSChallenge,
  type CareerOSLayer,
  mapJobToCareerOSChallenge,
  mapJobsToCareerOSCandidateWorkspace,
} from '../../src/app/careeros/model/viewModels';
import { buildCareerOSNotificationFeed } from '../../src/app/careeros/model/notificationFeed';
import MarketplacePage, { type MarketplacePageProps } from '../../src/pages/marketplace/MarketplacePage';
import { markPerf, measurePerf, measureSyncPerf } from '../../src/app/perf/perfDebug';

const PROFILE_INITIAL_TAB_STORAGE_KEY = 'jobshaman.profile.initialTab';
const DEBUG_CAREER_OS =
  String(import.meta.env.VITE_DEBUG_CAREER_OS || '').toLowerCase() === 'true';
const MARKET_TRENDS_ENABLED =
  String(import.meta.env.VITE_ENABLE_CAREEROS_MARKET_TRENDS || 'false').toLowerCase() === 'true';

interface CareerOSCandidateWorkspaceProps extends MarketplacePageProps {
  onOpenCompanyPage: (companyId: string) => void;
  onOpenCompaniesLanding: () => void;
  homeResetToken?: number;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filterCity: string;
  setFilterCity: (value: string) => void;
  performSearch: (term: string) => void;
  filterWorkArrangement: JobWorkArrangementFilter;
  setFilterWorkArrangement: (value: JobWorkArrangementFilter) => void;
  globalSearch: boolean;
  setGlobalSearch: (value: boolean) => void;
  abroadOnly: boolean;
  setAbroadOnly: (value: boolean) => void;
  filterContractType: string[];
  setFilterContractType: (values: string[]) => void;
  filterExperience: string[];
  setFilterExperience: (values: string[]) => void;
  filterLanguageCodes: SearchLanguageCode[];
  setFilterLanguageCodes: (values: SearchLanguageCode[]) => void;
  initialNavigationState?: CareerOSNavigationState | null;
  onNavigationStateChange?: (state: CareerOSNavigationState) => void;
}

export interface CareerOSNavigationState {
  activeLayer: CareerOSLayer;
  selectedPathId: string | null;
  expandedPathId: string | null;
  activeBranchRoleId?: string | null;
  panelChallengeId: string | null;
  panelDismissed: boolean;
  canvasZoom: number;
}

interface PathNode {
  id: string;
  domainKey: string;
  directionIcon: string;
  title: string;
  subtitle: string;
  summary: string;
  preview: string;
  tags: string[];
  tone: keyof typeof toneClasses;
  challengeCount: number;
  gravity: 'strong' | 'soft';
  featuredChallenge: CareerOSChallenge;
  challenges: CareerOSChallenge[];
  roleNodes: RoleNode[];
  imageUrl: string | null;
  x: number;
  y: number;
  rank: number;
  gravityPull: number;
  orbitDistance: number;
  textPos: 'left' | 'right';
}

interface RoleNode {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  preview: string;
  challengeCount: number;
  featuredChallenge: CareerOSChallenge;
  challenges: CareerOSChallenge[];
  imageUrl: string | null;
}

interface PositionedPathNode extends PathNode {
  slotId: string;
  nodeKey: string;
  baseX: number;
  baseY: number;
  distanceRank: number;
}

interface PositionedRoleNode extends RoleNode {
  slotId: string;
  nodeKey: string;
  pathId: string;
  directionKey: string;
  baseX: number;
  baseY: number;
  offerCount: number;
}

interface RemapDomainOption {
  value: string;
  label?: string;
}

export interface CareerOSNotification {
  id: string;
  kind: 'company_message' | 'dialogue_update' | 'high_match' | 'digest' | 'signal_boost';
  title: string;
  body: string;
  timestamp: string;
  ctaLabel: string;
  challengeId?: string | null;
}

interface LearningResourceCard {
  id: string;
  title: string;
  provider: string;
  duration: string;
  reason: string;
  matchedSkills: string[];
  match: number;
  rating: number;
  reviewCount: number;
  priceLabel: string;
  formatLabel: string;
  levelLabel: string;
  marketplaceNote: string;
  url: string;
  status: 'active' | 'draft' | 'archived';
}

interface LearningGapAnalysis {
  intentReady: boolean;
  skillDataReady: boolean;
  currentRole: string;
  targetRole: string;
  targetDomainLabel: string;
  intentSummary: string;
  currentSkills: string[];
  targetSkills: string[];
  missingSkills: string[];
  resources: LearningResourceCard[];
  resourceState: 'missing_intent' | 'missing_skills' | 'loading' | 'empty_resources' | 'ready';
  resourceEmptyTitle: string | null;
  resourceEmptyBody: string | null;
}

interface MarketTrendMetric {
  label: string;
  value: string;
  detail: string;
  tone: 'emerald' | 'sky' | 'orange';
}

interface MarketTrendSignal {
  title: string;
  value: string;
  note: string;
}

interface MarketTrendNarrative {
  title: string;
  body: string;
}

interface MarketTrendAnalysis {
  scopeTitle: string;
  summary: string;
  metrics: MarketTrendMetric[];
  topSkills: Array<{ label: string; count: number }>;
  aiSignals: MarketTrendSignal[];
  narratives: MarketTrendNarrative[];
}

const filterChipInactiveClass =
  'border border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:text-cyan-700 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:border-cyan-500/50 dark:hover:bg-slate-900 dark:hover:text-cyan-200';

const clampZoom = (value: number): number => Math.max(0.72, Math.min(1.6, Number(value.toFixed(2))));
const CAREER_MAP_CAMERA_DURATION_MS = 560;
const CAREER_MAP_CAMERA_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';

const stepZoom = (
  setZoom: React.Dispatch<React.SetStateAction<number>>,
  direction: 'in' | 'out',
): void => {
  const delta = direction === 'in' ? 0.08 : -0.08;
  setZoom((current) => clampZoom(current + delta));
};

const toneClasses = {
  emerald: {
    line: '#10b981',
    ring: 'border-emerald-400/50',
    glow: 'shadow-[0_0_24px_rgba(16,185,129,0.25)]',
    chip: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    fill: 'from-emerald-500 to-emerald-700',
  },
  orange: {
    line: '#f59e0b',
    ring: 'border-orange-400/50',
    glow: 'shadow-[0_0_24px_rgba(245,158,11,0.25)]',
    chip: 'border-orange-200 bg-orange-100 text-orange-700',
    fill: 'from-orange-400 to-orange-600',
  },
  blue: {
    line: '#0ea5e9',
    ring: 'border-sky-400/50',
    glow: 'shadow-[0_0_24px_rgba(14,165,233,0.22)]',
    chip: 'border-sky-200 bg-sky-100 text-sky-700',
    fill: 'from-sky-500 to-blue-600',
  },
  slate: {
    line: '#64748b',
    ring: 'border-slate-300/70 dark:border-slate-600/80',
    glow: 'shadow-[0_0_24px_rgba(100,116,139,0.18)]',
    chip: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
    fill: 'from-slate-500 to-slate-700',
  },
} as const;

const sidebarLayers: Array<{ id: CareerOSLayer; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'marketplace', icon: Briefcase },
  { id: 'career_path', icon: TrendingUp },
  { id: 'mini_challenges', icon: Sparkles },
  { id: 'learning_path', icon: BookOpen },
  ...(MARKET_TRENDS_ENABLED
    ? [{ id: 'market_trends' as CareerOSLayer, icon: BarChart3 }]
    : []),
];

const buildBranchingPathLayout = (
  rankedDomains: Array<{ score: number }>,
): Array<{ x: number; y: number; orbitDistance: number; gravityPull: number }> => {
  const slots = [
    { x: -220, y: 0 },
    { x: -90, y: -195 },
    { x: -90, y: 195 },
    { x: 80, y: -88 },
    { x: 92, y: 108 },
    { x: 188, y: -278 },
  ];
  const scores = rankedDomains.map((item) => Number(item.score || 0));
  const maxScore = Math.max(...scores, 1);

  return rankedDomains.map((cluster, index) => {
    const slot = slots[index] || { x: 188 + Math.max(0, index - 5) * 88, y: -278 + Math.max(0, index - 5) * 96 };
    const normalizedScore = Math.max(0, Number(cluster.score || 0) / maxScore);
    return {
      x: slot.x,
      y: slot.y,
      orbitDistance: Math.hypot(slot.x, slot.y),
      gravityPull: 0.48 + normalizedScore * 0.28,
    };
  });
};

const TREE_DIRECTION_SLOTS = [
  { id: 'primary', x: -90, y: -24, distanceRank: 0 },
  { id: 'upper', x: 84, y: -238, distanceRank: 1 },
  { id: 'lower', x: 74, y: 206, distanceRank: 2 },
  { id: 'upper_far', x: 302, y: -356, distanceRank: 3 },
  { id: 'mid_far', x: 346, y: -12, distanceRank: 4 },
  { id: 'lower_far', x: 312, y: 324, distanceRank: 5 },
] as const;

const TREE_ROLE_SLOT_OFFSETS = [-120, -40, 40, 120] as const;

const createEmptyBranchOverrides = (): CareerMapBranchOverrides => ({
  directionSlots: {},
  roleSlots: {},
});

const createEmptyNodeOffsets = (): Record<string, CareerMapNodeOffset> => ({});

const sanitizeCareerMapNodeOffsets = (
  positions: Record<string, CareerMapNodeOffset> | undefined | null,
): Record<string, CareerMapNodeOffset> => {
  if (!positions || typeof positions !== 'object') return createEmptyNodeOffsets();
  return Object.fromEntries(
    Object.entries(positions).map(([key, value]) => [
      key,
      {
        x: Math.max(-260, Math.min(260, Number(value?.x || 0))),
        y: Math.max(-220, Math.min(220, Number(value?.y || 0))),
      },
    ]),
  );
};

const getDirectionPositionKey = (directionId: string): string => `direction:${directionId}`;
const getRolePositionKey = (pathId: string, roleId: string): string => `role:${pathId}:${roleId}`;

const applyNodeOffset = (
  baseX: number,
  baseY: number,
  nodeKey: string,
  positions: Record<string, CareerMapNodeOffset>,
) => {
  const offset = positions[nodeKey];
  return {
    x: baseX + Number(offset?.x || 0),
    y: baseY + Number(offset?.y || 0),
  };
};

const buildWorkflowCurve = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  bend = 0.34,
): string => {
  const deltaX = Math.max(80, toX - fromX);
  const controlOneX = fromX + Math.max(76, deltaX * bend);
  const controlTwoX = toX - Math.max(56, deltaX * Math.max(0.18, bend - 0.08));
  return `M ${fromX} ${fromY} C ${controlOneX} ${fromY}, ${controlTwoX} ${toY}, ${toX} ${toY}`;
};

const buildWorkflowRailPath = (
  fromX: number,
  fromY: number,
  railX: number,
  railY: number,
  toX: number,
  toY: number,
): string => {
  const safeRailX = Math.max(fromX + 48, railX);
  const approachX = Math.max(safeRailX + 24, toX - 34);
  return [
    `M ${fromX} ${fromY}`,
    `C ${fromX + 42} ${fromY}, ${safeRailX - 28} ${railY}, ${safeRailX} ${railY}`,
    `L ${approachX} ${railY}`,
    `C ${approachX + 16} ${railY}, ${toX - 12} ${toY}, ${toX} ${toY}`,
  ].join(' ');
};

const initials = (value: string): string => {
  const parts = String(value || 'JS').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return 'JS';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};

const toHumanLabel = (value: string): string =>
  String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const cleaned = String(word || '').trim();
      if (!cleaned) return '';
      if (/^[A-Z0-9]{2,4}$/.test(cleaned)) return cleaned;
      const lower = cleaned.toLocaleLowerCase();
      return lower.charAt(0).toLocaleUpperCase() + lower.slice(1);
    })
    .join(' ');

const topFilterCandidates = (jobs: Job[]): string[] =>
  Array.from(
    jobs
      .flatMap((job) => [...(Array.isArray(job.benefits) ? job.benefits : []), ...(Array.isArray(job.tags) ? job.tags : [])])
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .reduce((map, item) => {
        const normalizedKey = item.toLocaleLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
        if (!normalizedKey || map.has(normalizedKey)) return map;
        map.set(normalizedKey, item);
        return map;
      }, new Map<string, string>())
      .values(),
  ).slice(0, 6);

const buildCareerMapSourceJobs = (jobs: Job[]): Job[] => jobs;

const localeToCountryCode = (locale: string): string => {
  const base = String(locale || 'cs').split('-')[0].toLowerCase();
  if (base === 'sk') return 'SK';
  if (base === 'pl') return 'PL';
  if (base === 'de') return 'DE';
  return 'CZ';
};

const resolveCareerMapCountryCode = (userProfile: UserProfile, activeLocale: string): string => {
  const explicit = String(userProfile.preferredCountryCode || '').trim().toUpperCase();
  if (explicit) return explicit;
  return localeToCountryCode(activeLocale);
};

const compactText = (value: string, max = 40): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 1)).trim()}...`;
};

const domainLabelMap: Record<string, string> = {
  agriculture: 'Agriculture',
  ai_data: 'AI & Data',
  aviation: 'Aviation',
  automotive: 'Automotive',
  construction: 'Construction',
  creative_media: 'Creative & Media',
  customer_support: 'Customer Support',
  ecommerce: 'E-commerce',
  education: 'Education',
  energy_utilities: 'Energy',
  engineering: 'Engineering',
  finance: 'Finance',
  government_defense: 'Gov & Defense',
  healthcare: 'Healthcare',
  hospitality: 'Hospitality',
  insurance: 'Insurance',
  it: 'IT',
  logistics: 'Logistics',
  manufacturing: 'Manufacturing',
  maritime: 'Maritime',
  marketing: 'Marketing',
  media_design: 'Design',
  mining_heavy_industry: 'Heavy Industry',
  operations: 'Operations',
  pharma_biotech: 'Pharma',
  procurement: 'Procurement',
  product_management: 'Product',
  public_services: 'Public Services',
  real_estate: 'Real Estate',
  retail: 'Retail',
  sales: 'Sales',
  science_lab: 'Science',
  security: 'Security',
  telecom_network: 'Telecom',
  hr: 'HR',
  people_ops: 'HR',
  general: 'General',
};

const domainLabelMapCs: Record<string, string> = {
  agriculture: 'Zemědělství',
  ai_data: 'AI a data',
  aviation: 'Letecký průmysl',
  automotive: 'Automotive',
  construction: 'Stavebnictví',
  creative_media: 'Kreativa a média',
  customer_support: 'Zákaznická péče',
  ecommerce: 'E-commerce',
  education: 'Vzdělávání',
  energy_utilities: 'Energetika',
  engineering: 'Inženýrství',
  finance: 'Finance',
  government_defense: 'Veřejná správa a obrana',
  healthcare: 'Zdravotnictví',
  hospitality: 'Gastro a služby',
  insurance: 'Pojišťovnictví',
  it: 'IT',
  logistics: 'Logistika',
  manufacturing: 'Výroba',
  maritime: 'Námořní doprava',
  marketing: 'Marketing',
  media_design: 'Design',
  mining_heavy_industry: 'Těžký průmysl',
  operations: 'Provoz a operativa',
  pharma_biotech: 'Farmacie a biotech',
  procurement: 'Nákup',
  product_management: 'Produkt',
  public_services: 'Veřejné služby',
  real_estate: 'Reality',
  retail: 'Retail',
  sales: 'Obchod',
  science_lab: 'Věda a laboratoře',
  security: 'Bezpečnost',
  telecom_network: 'Telekomunikace',
  hr: 'Lidé a HR',
  people_ops: 'Lidé a HR',
  general: 'Obecné',
};

const REMAP_PRIORITY_DOMAIN_OPTIONS: RemapDomainOption[] = [
  { value: 'logistics' },
  { value: 'healthcare' },
  { value: 'retail' },
  { value: 'automotive' },
  { value: 'education', label: 'Učitelé' },
  { value: 'customer_support', label: 'Customer support' },
];

const getLocalizedDomainLabel = (domain: string, t: TFunction): string => {
  const locale = normalizeNavigationLocale(String((t as any).i18n?.resolvedLanguage || (t as any).i18n?.language || 'en'));
  const localizedFallback = locale === 'cs'
    ? domainLabelMapCs[domain]
    : domainLabelMap[domain];
  return t(`careeros.domains.${domain}`, {
    defaultValue: localizedFallback || domain.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
  });
};

interface LifeDirection {
  id: string;
  label: string;
  labelCS: string;
  description: string;
  descriptionCS: string;
  icon: string;
}

const LIFE_DIRECTIONS: LifeDirection[] = [
  {
    id: 'more_time',
    label: 'More Time',
    labelCS: 'V\u00edce \u010dasu pro \u017eivot',
    description: 'Roles with healthier tempo, less unnecessary pressure and better room outside work.',
    descriptionCS: 'Role s udr\u017eiteln\u011bj\u0161\u00edm tempem, men\u0161\u00edm tlakem a v\u011bt\u0161\u00edm prostorem mimo pr\u00e1ci.',
    icon: '\u23f3',
  },
  {
    id: 'less_commuting',
    label: 'Less Commuting',
    labelCS: 'M\u00e9n\u011b doj\u00ed\u017ed\u011bn\u00ed',
    description: 'Directions with more remote flexibility or a closer practical fit to your day-to-day life.',
    descriptionCS: 'Sm\u011bry s v\u011bt\u0161\u00ed flexibilitou pr\u00e1ce na d\u00e1lku nebo men\u0161\u00edm ka\u017edodenn\u00edm doj\u00ed\u017ed\u011bn\u00edm.',
    icon: '\ud83d\ude97',
  },
  {
    id: 'more_people',
    label: 'More People Contact',
    labelCS: 'V\u00edce mezi lidmi',
    description: 'Work that stays close to people, service, relationships and visible human impact.',
    descriptionCS: 'Pr\u00e1ce bl\u00ed\u017e lidem, slu\u017eb\u011b, vztah\u016fm a viditeln\u00e9mu lidsk\u00e9mu dopadu.',
    icon: '\ud83e\udd1d',
  },
  {
    id: 'more_field',
    label: 'More Field Work',
    labelCS: 'V\u00edce v ter\u00e9nu',
    description: 'Less screen-bound work, more movement, operations, sites or real-world environments.',
    descriptionCS: 'M\u00e9n\u011b pr\u00e1ce za obrazovkou, v\u00edce pohybu, provozu, provozoven nebo ter\u00e9nu.',
    icon: '\ud83e\udded',
  },
  {
    id: 'higher_income',
    label: 'Higher Income',
    labelCS: 'Vy\u0161\u0161\u00ed p\u0159\u00edjem',
    description: 'Directions where stronger performance and responsibility are more often rewarded financially.',
    descriptionCS: 'Sm\u011bry, kde se v\u00fdkon a odpov\u011bdnost \u010dast\u011bji prom\u00edtaj\u00ed do vy\u0161\u0161\u00ed odm\u011bny.',
    icon: '\ud83d\udcb8',
  },
  {
    id: 'faster_growth',
    label: 'Faster Growth',
    labelCS: 'Rychlej\u0161\u00ed r\u016fst',
    description: 'Steeper learning curves, stronger development and clearer room to move upward.',
    descriptionCS: 'Strm\u011bj\u0161\u00ed u\u010dic\u00ed k\u0159ivka, siln\u011bj\u0161\u00ed rozvoj a jasn\u011bj\u0161\u00ed prostor pro r\u016fst.',
    icon: '\ud83d\udcc8',
  },
];

const getLocalizedDirectionLabel = (direction: LifeDirection, t: TFunction): string =>
  t(`careeros.workflow.directions.${direction.id}.title`, {
    defaultValue: direction.label,
  });

const getLocalizedDirectionDescription = (direction: LifeDirection, t: TFunction): string =>
  t(`careeros.workflow.directions.${direction.id}.description`, {
    defaultValue: direction.description,
  });

const directionVisuals: Record<string, { tone: keyof typeof toneClasses; gradient: string; imageUrl: string }> = {
  more_time: {
    tone: 'slate',
    gradient: 'from-slate-700 via-slate-600 to-cyan-700',
    imageUrl: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
  },
  less_commuting: {
    tone: 'blue',
    gradient: 'from-sky-700 via-cyan-500 to-blue-800',
    imageUrl: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=1200&q=80',
  },
  more_people: {
    tone: 'orange',
    gradient: 'from-rose-600 via-orange-500 to-amber-500',
    imageUrl: 'https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&w=1200&q=80',
  },
  more_field: {
    tone: 'blue',
    gradient: 'from-indigo-700 via-sky-600 to-cyan-500',
    imageUrl: 'https://images.unsplash.com/photo-1513828583688-c52646db42da?auto=format&fit=crop&w=1200&q=80',
  },
  higher_income: {
    tone: 'emerald',
    gradient: 'from-emerald-700 via-teal-600 to-cyan-600',
    imageUrl: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&w=1200&q=80',
  },
  faster_growth: {
    tone: 'emerald',
    gradient: 'from-lime-500 via-emerald-600 to-teal-700',
    imageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
  },
};

const normalizeLifeDirectionText = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/+.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const deskBoundRolePattern = /\b(software|engineer|developer|backend|frontend|full stack|fullstack|qa|tester|data|analyst|designer|ux|ui|product manager|scrum|architect)\b/;
const fieldRolePattern = /\b(field|field service|site|site manager|terrain|ter[eÄ‚Â©]n|on site support|onsite support|technician|installer|installation|warehouse|store manager|branch|clinic|maintenance|manufacturing|production|operations on site|supervisor|construction)\b/;
const peopleRolePattern = /\b(customer|support|service|sales|account|success|recruit|talent|hr|people|care|patient|community|hospitality|teacher|education|partner|client)\b/;
const flexibilityPattern = /\b(remote|hybrid|home office|work from home|flexible|part time|part-time|4 day|4-day|wellbeing|well being|balance|na dalku|z domova|async)\b/;
const growthPattern = /\b(growth|career|lead|senior|ownership|learning|develop|scale|promotion|mentor|growth path|rust|rozvoj)\b/;
const highCompPattern = /\b(bonus|commission|ote|equity|stock|nadstandard|high salary)\b/;

const peopleDomains = new Set(['customer_support', 'sales', 'retail', 'hospitality', 'healthcare', 'education', 'public_services']);
const fieldDomains = new Set(['logistics', 'manufacturing', 'construction', 'healthcare', 'retail', 'hospitality', 'security', 'agriculture', 'energy_utilities', 'public_services', 'real_estate', 'automotive']);
const remoteFriendlyDomains = new Set(['it', 'ai_data', 'finance', 'marketing', 'media_design', 'product_management', 'insurance', 'customer_support']);
const incomeDomains = new Set(['it', 'ai_data', 'engineering', 'finance', 'sales', 'product_management', 'pharma_biotech', 'telecom_network']);
const growthDomains = new Set(['it', 'ai_data', 'engineering', 'product_management', 'marketing', 'finance', 'telecom_network']);
const deskBoundDomains = new Set(['it', 'ai_data', 'finance', 'marketing', 'media_design', 'product_management', 'insurance', 'telecom_network']);

const scoreLifeDirectionsForJob = (job: Job): Array<{ id: string; score: number }> => {
  const text = normalizeLifeDirectionText([
    job.title,
    job.description,
    job.location,
    ...(job.tags || []),
    ...(job.benefits || []),
  ].join(' '));
  const workModel = normalizeLifeDirectionText(String((job as any).work_model || (job as any).workArrangement || ''));
  const combined = `${text} ${workModel}`.trim();
  const domain = String(resolveJobDomain(job) || '').toLowerCase();
  const salaryFrom = Number((job as any).salary_from || 0);

  const scores: Record<string, number> = {
    more_time: 0,
    less_commuting: 0,
    more_people: 0,
    more_field: 0,
    higher_income: 0,
    faster_growth: 0,
  };

  const hasFieldSignal = fieldRolePattern.test(combined);
  const hasPeopleSignal = peopleRolePattern.test(combined);
  const hasFlexSignal = flexibilityPattern.test(combined);
  const hasGrowthSignal = growthPattern.test(combined);
  const hasDeskBoundSignal = deskBoundRolePattern.test(combined);
  const hasHighTravelSignal = /\b(travel|travelling|traveling|site visits|branch visits|regional|field work|home visits|social services?|community care|home care|domov|ter[eĂ©]nn[iĂ­]|ter[eĂ©]nni|terenn[iĂ­]|servisn[iĂ­] technik|stavbyvedouc[iĂ­]|mont[eĂ©]r)\b/.test(combined);

  if (hasFlexSignal) scores.less_commuting += 3;
  if (remoteFriendlyDomains.has(domain)) scores.less_commuting += 1;
  if (/onsite only|on site daily|every day onsite/.test(combined)) scores.less_commuting -= 2;
  if ((hasFieldSignal || hasHighTravelSignal || fieldDomains.has(domain)) && !hasFlexSignal) scores.less_commuting -= 3;

  if (hasFlexSignal) scores.more_time += 2;
  if (/\b(part time|part-time|4 day|4-day|wellbeing|balance)\b/.test(combined)) scores.more_time += 2;
  if (/\b(shift|night shift|weekend)\b/.test(combined)) scores.more_time -= 1;

  if (hasPeopleSignal) scores.more_people += 2;
  if (peopleDomains.has(domain)) scores.more_people += 1;
  if (hasDeskBoundSignal && !hasPeopleSignal) scores.more_people -= 1;

  if (hasFieldSignal) scores.more_field += 3;
  if (fieldDomains.has(domain)) scores.more_field += 1;
  if (/travel|travelling|traveling|site visits|branch visits|regional/.test(combined)) scores.more_field += 1;
  if (deskBoundDomains.has(domain)) scores.more_field -= 3;
  if (hasDeskBoundSignal && !hasFieldSignal) scores.more_field -= 3;

  if (salaryFrom >= 90000) scores.higher_income += 3;
  else if (salaryFrom >= 70000) scores.higher_income += 2;
  if (highCompPattern.test(combined)) scores.higher_income += 2;
  if (incomeDomains.has(domain)) scores.higher_income += 1;

  if (hasGrowthSignal) scores.faster_growth += 2;
  if (growthDomains.has(domain)) scores.faster_growth += 2;
  if (/\b(junior|trainee|graduate|lead|principal|staff)\b/.test(combined)) scores.faster_growth += 1;

  return Object.entries(scores)
    .filter(([id, score]) => score >= (id === 'more_field' ? 3 : 2))
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([id, score]) => ({ id, score }));
};

const normalizeRoleClusterTitle = (value: string): string => {
  const normalized = String(value || '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+\|\s+|\s+@\s+|\s+at\s+/i)[0]
    .replace(/\b(senior|junior|lead|principal|staff|mid|medior|sr\.?|jr\.?|remote|hybrid|part[- ]time|full[- ]time)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || String(value || '').trim() || 'Role';
};

const buildRoleNodes = (domainKey: string, challenges: CareerOSChallenge[], t: TFunction): RoleNode[] => {
  const grouped = new Map<string, CareerOSChallenge[]>();

  challenges.forEach((challenge) => {
    const roleTitle = normalizeRoleClusterTitle(challenge.title);
    const key = roleTitle.toLowerCase();
    const bucket = grouped.get(key) || [];
    bucket.push(challenge);
    grouped.set(key, bucket);
  });

  return Array.from(grouped.entries())
    .map(([key, items]) => {
      const sorted = [...items].sort((left, right) => right.jhiScore - left.jhiScore);
      const featuredChallenge = sorted[0];
      const topCompanies = Array.from(new Set(sorted.map((item) => item.company).filter(Boolean))).slice(0, 2);
      return {
        id: `${domainKey}:${key}`,
        title: normalizeRoleClusterTitle(featuredChallenge?.title || key),
        subtitle: t('careeros.map.role_offers_count', {
          defaultValue: '{{count}} offers',
          count: sorted.length,
        }),
        summary: t('careeros.map.role_summary', {
          defaultValue: 'Live offers in {{domain}} around roles like {{role}}.',
          domain: getLocalizedDomainLabel(domainKey, t),
          role: normalizeRoleClusterTitle(featuredChallenge?.title || key),
        }),
        preview: topCompanies.length > 0
          ? t('careeros.map.role_preview_companies', {
              defaultValue: 'Companies nearby: {{companies}}',
              companies: topCompanies.join(' • '),
            })
          : t('careeros.map.role_preview_default', {
              defaultValue: 'Open this role lane to see concrete companies and offers.',
            }),
        challengeCount: sorted.length,
        featuredChallenge,
        challenges: sorted,
        imageUrl: featuredChallenge?.coverImageUrl || featuredChallenge?.avatarUrl || null,
      };
    })
    .sort((left, right) =>
      right.challengeCount - left.challengeCount
      || right.featuredChallenge.jhiScore - left.featuredChallenge.jhiScore)
    .slice(0, 10);
};

const normalizeNavigationLocale = (locale?: string): 'cs' | 'sk' | 'de' | 'pl' | 'en' => {
  const base = String(locale || 'en').split('-')[0].toLowerCase();
  if (base === 'cs' || base === 'sk' || base === 'de' || base === 'pl') return base;
  return 'en';
};

const getNavigationUiCopy = (locale?: string) => {
  const normalized = normalizeNavigationLocale(locale);
  if (normalized === 'cs') {
    return {
      badge: 'Navigace k cíli',
      eta: 'ETA',
      confidence: 'Jistota',
      steps: 'Kroky',
      resolving: 'Upřesňujeme trasu přes AI interpretaci...',
      alternatives: 'Možné interpretace',
      friction: 'Možná tření',
      editGoal: 'Upravit cíl',
      subtitle: 'Zadejte cíl a CareerOS ukáže realistickou trasu z vašeho aktuálního profilu.',
      changeGoal: 'Změnit cíl',
      openCta: 'Navigovat k cíli',
      clear: 'Vymazat trasu',
      placeholder: 'Například Customer Success Manager, operations lead, remote product role...',
      useMarketPrefs: 'Použít moje současné preference trhu jako váhu trasy',
      submit: 'Postavit trasu',
    };
  }
  if (normalized === 'sk') {
    return {
      badge: 'Navigácia k cieľu',
      eta: 'ETA',
      confidence: 'Istota',
      steps: 'Kroky',
      resolving: 'Spresňujeme trasu cez AI interpretáciu...',
      alternatives: 'Možné interpretácie',
      friction: 'Možné trenia',
      editGoal: 'Upraviť cieľ',
      subtitle: 'Zadajte cieľ a CareerOS ukáže realistickú trasu z vášho aktuálneho profilu.',
      changeGoal: 'Zmeniť cieľ',
      openCta: 'Navigovať k cieľu',
      clear: 'Vymazať trasu',
      placeholder: 'Napríklad Customer Success Manager, operations lead, remote product role...',
      useMarketPrefs: 'Použiť moje súčasné preferencie trhu ako váhu trasy',
      submit: 'Postaviť trasu',
    };
  }
  if (normalized === 'de') {
    return {
      badge: 'Zielnavigation',
      eta: 'ETA',
      confidence: 'Sicherheit',
      steps: 'Schritte',
      resolving: 'Die Route wird mit AI-Interpretation verfeinert...',
      alternatives: 'Mögliche Deutungen',
      friction: 'Mögliche Reibung',
      editGoal: 'Ziel bearbeiten',
      subtitle: 'Geben Sie ein Ziel ein und CareerOS zeigt eine realistische Route aus Ihrem aktuellen Profil.',
      changeGoal: 'Ziel ändern',
      openCta: 'Zum Ziel navigieren',
      clear: 'Route löschen',
      placeholder: 'Zum Beispiel Customer Success Manager, Operations Lead, Remote-Produktrolle...',
      useMarketPrefs: 'Meine aktuellen Marktpräferenzen als Routen-Gewichtung nutzen',
      submit: 'Route bauen',
    };
  }
  if (normalized === 'pl') {
    return {
      badge: 'Nawigacja do celu',
      eta: 'ETA',
      confidence: 'Pewność',
      steps: 'Kroki',
      resolving: 'Doprecyzowujemy trasę przez interpretację AI...',
      alternatives: 'Możliwe interpretacje',
      friction: 'Możliwe tarcia',
      editGoal: 'Edytuj cel',
      subtitle: 'Wpisz cel, a CareerOS pokaże realistyczną trasę z Twojego obecnego profilu.',
      changeGoal: 'Zmień cel',
      openCta: 'Nawiguj do celu',
      clear: 'Wyczyść trasę',
      placeholder: 'Na przykład Customer Success Manager, operations lead, remote product role...',
      useMarketPrefs: 'Użyj moich obecnych preferencji rynkowych jako wagi trasy',
      submit: 'Zbuduj trasę',
    };
  }
  return {
    badge: 'Goal navigation',
    eta: 'ETA',
    confidence: 'Confidence',
    steps: 'Steps',
    resolving: 'Refining the route with AI interpretation...',
    alternatives: 'Suggested interpretations',
    friction: 'Likely friction',
    editGoal: 'Edit goal',
    subtitle: 'Type a destination and CareerOS will map a realistic route from your current profile.',
    changeGoal: 'Change goal',
    openCta: 'Navigate to goal',
    clear: 'Clear route',
    placeholder: 'Example: Customer Success Manager, Operations lead, remote product role...',
    useMarketPrefs: 'Use my current market preferences as route weight',
    submit: 'Build route',
  };
};

const getCareerOSSidebarCopy = (locale: string) => {
  const language = String(locale || 'en').split('-')[0].toLowerCase();
  const copy = {
    cs: {
      title: 'Způsob zobrazení',
      subtitle: 'Přepínej mezi mapou, klasickým seznamem a vrstvami, které ti pomohou se rozhodnout.',
      layers: {
        career_path: { label: 'Kariérní mapa', hint: 'Uvidíš směry, přechody a kam tě která role může dovést.' },
        marketplace: { label: 'Seznam', hint: 'Klasický seznam nabídek pro rychlé procházení a porovnání.' },
        learning_path: { label: 'Learning path', hint: 'Dovednosti, mezery a praktické další kroky pro růst.' },
        mini_challenges: { label: 'Mini challenges', hint: 'Krátké pracovní ukázky, na kterých je vidět, jak přemýšlíš a pracuješ.' },
        market_trends: { label: 'Tržní signály', hint: 'Poptávka, odměny a pohyb na trhu kolem tebe.' },
        job_offers: { label: 'Vrstva nabídek', hint: 'Konkrétní nabídky navázané na vybraný směr.' },
      },
    },
    sk: {
      title: 'Spôsob zobrazenia',
      subtitle: 'Prepínaj medzi mapou, klasickým zoznamom a vrstvami, ktoré ti pomôžu rozhodnúť sa.',
      layers: {
        career_path: { label: 'Kariérna mapa', hint: 'Uvidíš smery, prechody a kam ťa môže ktorá rola doviesť.' },
        marketplace: { label: 'Zoznam', hint: 'Klasický zoznam ponúk na rýchle prehliadanie a porovnanie.' },
        learning_path: { label: 'Learning path', hint: 'Zručnosti, medzery a praktické ďalšie kroky pre rast.' },
        mini_challenges: { label: 'Mini challenges', hint: 'Krátke pracovné ukážky, na ktorých vidno, ako premýšľaš a pracuješ.' },
        market_trends: { label: 'Trhové signály', hint: 'Dopyt, odmeny a pohyb na trhu okolo teba.' },
        job_offers: { label: 'Vrstva ponúk', hint: 'Konkrétne ponuky naviazané na vybraný smer.' },
      },
    },
    de: {
      title: 'Ansicht wählen',
      subtitle: 'Wechseln Sie zwischen Karte, klassischer Liste und weiter?n Ebenen, die bei der Entscheidung helfen.',
      layers: {
        career_path: { label: 'Karrierekarte', hint: 'Zeigt Richtungen, Übergänge und wohin eine Rolle führen kann.' },
        marketplace: { label: 'Liste', hint: 'Klassische Stellenliste zum schnellen Durchsehen und Vergleichen.' },
        learning_path: { label: 'Learning Path', hint: 'Kompetenzen, Lücken und praktische nächste Schritte für Wachstum.' },
        mini_challenges: { label: 'Mini-Challenges', hint: 'Kurze Arbeitsproben, die zeigen, wie Sie denken und arbeiten.' },
        market_trends: { label: 'Marktsignale', hint: 'Nachfrage, Vergütung und Bewegungen im Markt um Sie herum.' },
        job_offers: { label: 'Angebotsebene', hint: 'Konkrete Angebote entlang des gewählten Pfads.' },
      },
    },
    pl: {
      title: 'Sposób widoku',
      subtitle: 'Przełączaj się między mapą, klasyczną listą i warstwami, które pomagają podjąć decyzję.',
      layers: {
        career_path: { label: 'Mapa kariery', hint: 'Zobaczysz kierunki, przejścia i dokąd może prowadzić dana rola.' },
        marketplace: { label: 'Lista', hint: 'Klasyczna lista ofert do szybkiego przeglądania i porównywania.' },
        learning_path: { label: 'Learning path', hint: 'Umiejętności, luki i praktyczne kolejne kroki rozwoju.' },
        mini_challenges: { label: 'Mini challenges', hint: 'Krótkie próbki pracy pokazujące, jak myślisz i pracujesz.' },
        market_trends: { label: 'Sygnały rynkowe', hint: 'Popyt, wynagrodzenia i ruchy na rynku wokół ciebie.' },
        job_offers: { label: 'Warstwa ofert', hint: 'Konkretne oferty powiązane z wybranym kierunkiem.' },
      },
    },
    en: {
      title: 'How to view the market',
      subtitle: 'Switch between the map, the classic list and the layers that help you decide.',
      layers: {
        career_path: { label: 'Career Map', hint: 'See directions, transitions and where each role can lead.' },
        marketplace: { label: 'List', hint: 'Classic job list for quick browsing and comparison.' },
        learning_path: { label: 'Learning Path', hint: 'Skills, gaps and practical next steps for growth.' },
        mini_challenges: { label: 'Mini Challenges', hint: 'Short work samples that show how you actually think and work.' },
        market_trends: { label: 'Market Trends', hint: 'Signals about demand, pay and movement in the market.' },
        job_offers: { label: 'Offer Layer', hint: 'Concrete offers connected to the selected path.' },
      },
    },
  } as const;
  return copy[language as keyof typeof copy] || copy.en;
};

const getCareerOSLayerLabel = (t: TFunction, layer: CareerOSLayer, locale: string): string => {
  const fallback = getCareerOSSidebarCopy(locale).layers[layer]?.label || layer;
  switch (layer) {
    case 'career_path':
      return t('careeros.layers.career_path', { defaultValue: fallback });
    case 'marketplace':
      return t('careeros.layers.marketplace', { defaultValue: fallback });
    case 'learning_path':
      return t('careeros.layers.learning_path', { defaultValue: fallback });
    case 'mini_challenges':
      return t('careeros.layers.mini_challenges', { defaultValue: fallback });
    case 'market_trends':
      return t('careeros.layers.market_trends', { defaultValue: fallback });
    case 'job_offers':
      return t('careeros.layers.job_offers', { defaultValue: fallback });
    default:
      return layer;
  }
};

const uniqStrings = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const averageNumber = (values: number[]): number => {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const normalizeSkillKey = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const safeImage = (value: string | null | undefined): string | null => {
  const src = String(value || '').trim();
  return src || null;
};

const getBenefitLabel = (t: TFunction, benefitKey: string, fallbackLabel?: string): string => {
  const normalized = benefitKey.toLowerCase();
  const translated = t(`careeros.filters.benefits.${normalized}`, { defaultValue: '' });
  if (translated) return translated;
  return toHumanLabel(fallbackLabel || normalized);
};

const formatCompactCurrency = (value: number, t: TFunction): string => {
  if (!Number.isFinite(value) || value <= 0) return t('careeros.market.comp_hidden', { defaultValue: 'Comp hidden' });
  return `${Math.round(value).toLocaleString()} CZK`;
};

const formatNotificationTime = (value: string, t: TFunction): string => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return t('careeros.notifications.now', { defaultValue: 'Now' });
  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 1) return t('careeros.notifications.now', { defaultValue: 'Now' });
  if (diffMinutes < 60) return t('careeros.notifications.minutes_ago', { defaultValue: '{{count}}m ago', count: diffMinutes });
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return t('careeros.notifications.hours_ago', { defaultValue: '{{count}}h ago', count: diffHours });
  const diffDays = Math.round(diffHours / 24);
  return t('careeros.notifications.days_ago', { defaultValue: '{{count}}d ago', count: diffDays });
};

const parseDateValue = (value?: string | null): number => {
  const timestamp = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const isRemoteFlexibleJob = (job: Job): boolean => {
  const model = `${job.type || ''} ${job.work_model || ''}`.toLowerCase();
  return /remote|hybrid/.test(model);
};

const getJobMarketComp = (job: Job): number => {
  const marketMedian = Number(job.market?.p50 || job.market?.marketAvgSalary || 0);
  if (marketMedian > 0) return marketMedian;
  const from = Number(job.salary_from || job.aiEstimatedSalary?.min || 0);
  const to = Number(job.salary_to || job.aiEstimatedSalary?.max || 0);
  if (from > 0 && to > 0) return (from + to) / 2;
  return Math.max(from, to, 0);
};

const getHiringResponseDays = (job: Job): number | null => {
  if (Number(job.reaction_window_hours) > 0) return Number(job.reaction_window_hours) / 24;
  if (Number(job.reaction_window_days) > 0) return Number(job.reaction_window_days);
  return null;
};

const containsAnyKeyword = (value: string, keywords: string[]): boolean => {
  const haystack = value.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
};

const buildMarketTrendAnalysis = (
  jobs: Job[],
  selectedPath: PathNode | null,
  userProfile: UserProfile,
  t: TFunction,
): MarketTrendAnalysis => {
  const scopedJobs = jobs.length > 0 ? jobs : [];
  const scopeTitle = selectedPath?.title
    || String(userProfile.preferences?.searchProfile?.targetRole || userProfile.preferences?.desired_role || t('careeros.market.your_market', { defaultValue: 'Your market' })).trim()
    || t('careeros.market.your_market', { defaultValue: 'Your market' });

  const remoteFlexible = scopedJobs.filter(isRemoteFlexibleJob);
  const compensationValues = scopedJobs.map(getJobMarketComp).filter((value) => value > 0);
  const avgCompensation = averageNumber(compensationValues);
  const responseDays = scopedJobs.map(getHiringResponseDays).filter((value): value is number => value !== null && value > 0);
  const avgResponseDays = averageNumber(responseDays);
  const fastResponseRatio = scopedJobs.length > 0
    ? Math.round((responseDays.filter((value) => value <= 5).length / scopedJobs.length) * 100)
    : 0;
  const avgDialoguePressure = averageNumber(
    scopedJobs.map((job) => Number(job.open_dialogues_count || 0)).filter((value) => value > 0),
  );

  const skillCounts = new Map<string, number>();
  scopedJobs.forEach((job) => {
    uniqStrings([...(job.required_skills || []), ...(job.market?.inDemandSkills || [])]).forEach((skill) => {
      skillCounts.set(skill, (skillCounts.get(skill) || 0) + 1);
    });
  });

  const topSkills = Array.from(skillCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));

  const aiKeywords = [' ai', 'automation', 'automated', 'copilot', 'llm', 'machine learning', 'prompt', 'digital', 'workflow'];
  const automationKeywords = ['reporting', 'data entry', 'booking', 'scheduling', 'crm', 'excel', 'admin', 'operations', 'process'];
  const humanEdgeKeywords = ['communication', 'leadership', 'customer', 'service', 'stakeholder', 'empathy', 'conflict', 'relationship', 'coordination'];

  const aiExposedJobs = scopedJobs.filter((job) =>
    containsAnyKeyword(
      [
        job.title,
        ...(job.required_skills || []),
        ...(job.tags || []),
        ...(job.aiMatchReasons || []),
        String(job.aiAnalysis?.summary || ''),
      ].join(' '),
      aiKeywords,
    ),
  );

  const automationHeavyJobs = scopedJobs.filter((job) =>
    containsAnyKeyword([job.title, ...(job.required_skills || []), ...(job.tags || [])].join(' '), automationKeywords),
  );

  const humanEdgeJobs = scopedJobs.filter((job) =>
    containsAnyKeyword([job.title, ...(job.required_skills || []), ...(job.tags || [])].join(' '), humanEdgeKeywords),
  );

  const aiExposureRatio = scopedJobs.length > 0 ? Math.round((aiExposedJobs.length / scopedJobs.length) * 100) : 0;
  const automationRatio = scopedJobs.length > 0 ? Math.round((automationHeavyJobs.length / scopedJobs.length) * 100) : 0;
  const humanEdgeRatio = scopedJobs.length > 0 ? Math.round((humanEdgeJobs.length / scopedJobs.length) * 100) : 0;
  const demandScore = Math.min(97, 42 + scopedJobs.length * 9 + Math.min(18, Math.round(avgDialoguePressure * 2)));
  const remoteRatio = scopedJobs.length > 0 ? Math.round((remoteFlexible.length / scopedJobs.length) * 100) : 0;

  const momentumLabel = demandScore >= 80
    ? t('careeros.market.momentum.expansion', { defaultValue: 'Expansion wave' })
    : demandScore >= 65
      ? t('careeros.market.momentum.healthy', { defaultValue: 'Healthy demand' })
      : demandScore >= 50
        ? t('careeros.market.momentum.selective', { defaultValue: 'Selective growth' })
        : t('careeros.market.momentum.niche', { defaultValue: 'Niche lane' });
  const aiLabel = aiExposureRatio >= 65
    ? t('careeros.market.ai_label.reshape', { defaultValue: 'AI is reshaping the brief' })
    : aiExposureRatio >= 35
      ? t('careeros.market.ai_label.baseline', { defaultValue: 'AI is becoming a baseline' })
      : t('careeros.market.ai_label.differentiator', { defaultValue: 'AI is still a differentiator' });
  const humanLabel = humanEdgeRatio >= 60
    ? t('careeros.market.human_label.decisive', { defaultValue: 'Human edge remains decisive' })
    : humanEdgeRatio >= 35
      ? t('careeros.market.human_label.shortlist', { defaultValue: 'Human skills still matter in the shortlist' })
      : t('careeros.market.human_label.execution', { defaultValue: 'Execution skills dominate the current feed' });

  return {
    scopeTitle,
    summary: t('careeros.market.summary', {
      defaultValue: '{{scopeTitle}} is currently showing {{momentum}}. {{remoteRatio}}% of roles are remote or hybrid, median market comp clusters around {{comp}}, and AI/digital signals appear in {{aiExposureRatio}}% of the active feed.',
      scopeTitle,
      momentum: momentumLabel.toLowerCase(),
      remoteRatio,
      comp: formatCompactCurrency(avgCompensation, t),
      aiExposureRatio,
    }),
    metrics: [
      {
        label: t('careeros.market.metrics.demand_momentum', { defaultValue: 'Demand momentum' }),
        value: `${demandScore}/100`,
        detail: t('careeros.market.metrics.live_roles', { defaultValue: '{{count}} live roles in focus', count: scopedJobs.length }),
        tone: 'emerald',
      },
      {
        label: t('careeros.market.metrics.salary_center', { defaultValue: 'Salary center' }),
        value: formatCompactCurrency(avgCompensation, t),
        detail: t('careeros.market.metrics.salary_center_detail', { defaultValue: 'Median market signal from current feed' }),
        tone: 'sky',
      },
      {
        label: t('careeros.market.metrics.remote_flexibility', { defaultValue: 'Remote flexibility' }),
        value: `${remoteRatio}%`,
        detail: t('careeros.market.metrics.remote_roles', { defaultValue: '{{count}} remote / hybrid roles', count: remoteFlexible.length }),
        tone: 'emerald',
      },
      {
        label: t('careeros.market.metrics.hiring_tempo', { defaultValue: 'Hiring tempo' }),
        value: responseDays.length > 0 ? `${avgResponseDays.toFixed(1)}d` : t('careeros.market.metrics.open', { defaultValue: 'Open' }),
        detail: fastResponseRatio > 0
          ? t('careeros.market.metrics.respond_fast', { defaultValue: '{{percent}}% respond within 5 days', percent: fastResponseRatio })
          : t('careeros.market.metrics.response_unknown', { defaultValue: 'Response windows not published yet' }),
        tone: 'orange',
      },
    ],
    topSkills,
    aiSignals: [
      {
        title: t('careeros.market.signals.ai_adoption', { defaultValue: 'AI adoption' }),
        value: `${aiExposureRatio}%`,
        note: aiLabel,
      },
      {
        title: t('careeros.market.signals.automation_pressure', { defaultValue: 'Automation pressure' }),
        value: `${automationRatio}%`,
        note: automationRatio >= 55
          ? t('careeros.market.signals.automation_high', { defaultValue: 'Routine workflow is being compressed by automation.' })
          : t('careeros.market.signals.automation_low', { defaultValue: 'Automation shows up, but not as the whole story.' }),
      },
      {
        title: t('careeros.market.signals.human_edge', { defaultValue: 'Human edge premium' }),
        value: `${humanEdgeRatio}%`,
        note: humanLabel,
      },
    ],
    narratives: [
      {
        title: t('careeros.market.narratives.market_title', { defaultValue: 'What the market is doing' }),
        body: t('careeros.market.narratives.market_body', {
          defaultValue: '{{momentum}} in this lane is driven by {{skills}}. Employer activity averages {{dialogues}}.',
          momentum: momentumLabel,
          skills: topSkills.slice(0, 3).map((skill) => skill.label).join(', ') || t('careeros.market.cross_functional_demand', { defaultValue: 'cross-functional demand' }),
          dialogues: avgDialoguePressure > 0
            ? t('careeros.market.open_dialogues_avg', { defaultValue: '{{value}} open dialogues per role', value: avgDialoguePressure.toFixed(1) })
            : t('careeros.market.open_dialogues_light', { defaultValue: 'light open-dialogue pressure for now' }),
        }),
      },
      {
        title: t('careeros.market.narratives.ai_title', { defaultValue: 'How AI changes the lane' }),
        body: aiExposureRatio >= 55
          ? t('careeros.market.narratives.ai_body_high', { defaultValue: 'AI is no longer an optional bonus here. Roles increasingly reference digital workflow, automation or AI-adjacent skills, so candidates who can work with tools, prompts or process augmentation should move faster.' })
          : t('careeros.market.narratives.ai_body_low', { defaultValue: 'AI influence is present but uneven. The stronger differentiator is being able to combine domain execution with a modern digital workflow, rather than presenting as a pure AI specialist.' }),
      },
      {
        title: t('careeros.market.narratives.best_move_title', { defaultValue: 'Best move for you' }),
        body: t('careeros.market.narratives.best_move_body', {
          defaultValue: 'Use Learning Path to close the gap around {{skills}}, then use the strongest cluster to open handshakes while demand is still active.',
          skills: topSkills.slice(0, 2).map((skill) => skill.label).join(` ${t('careeros.common.and', { defaultValue: 'and' })} `)
            || t('careeros.market.top_requested_skills', { defaultValue: 'the top requested skills' }),
        }),
      },
    ],
  };
};

const buildPathNodes = (
  jobs: Job[],
  _challenges: CareerOSChallenge[],
  _userProfile: UserProfile,
  t: TFunction,
  _selectedDomains: string[] = [],
  _customDomainQuery = '',
): PathNode[] => {
  const buckets = Object.fromEntries(
    LIFE_DIRECTIONS.map((direction) => [direction.id, [] as Job[]]),
  ) as Record<string, Job[]>;

  const jobsByRoleFamily = new Map<string, Array<{ job: Job; rankedDirections: Array<{ id: string; score: number }> }>>();

  jobs.forEach((job) => {
    const rankedDirections = scoreLifeDirectionsForJob(job);
    if (rankedDirections.length === 0) return;
    const roleFamily = normalizeRoleClusterTitle(String(job.title || '').trim() || 'unknown role').toLowerCase();
    const bucket = jobsByRoleFamily.get(roleFamily) || [];
    bucket.push({ job, rankedDirections });
    jobsByRoleFamily.set(roleFamily, bucket);
  });

  jobsByRoleFamily.forEach((group) => {
    const directionStrength = new Map<string, number>();

    group.forEach(({ rankedDirections }) => {
      rankedDirections.forEach(({ id, score }, index) => {
        const current = directionStrength.get(id) || 0;
        directionStrength.set(id, current + score - index * 0.35);
      });
    });

    const dominantDirection = Array.from(directionStrength.entries())
      .sort((left, right) => right[1] - left[1])[0]?.[0];

    if (!dominantDirection) return;

    group.forEach(({ job }) => {
      buckets[dominantDirection].push(job);
    });
  });

  const rankedDirections = LIFE_DIRECTIONS
    .map((direction) => {
      const mappedChallenges = (buckets[direction.id] || []).slice(0, 100).map((job) => mapJobToCareerOSChallenge(job));
      const roleNodes = buildRoleNodes(direction.id, mappedChallenges, t);
      const featuredChallenge = roleNodes[0]?.featuredChallenge || mappedChallenges[0];
      return {
        direction,
        items: mappedChallenges,
        roleNodes,
        featuredChallenge,
        score: mappedChallenges.length + roleNodes.length * 4,
      };
    })
    .filter((item) => item.featuredChallenge && item.roleNodes.length > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  const branchingLayout = buildBranchingPathLayout(rankedDirections);

  return rankedDirections.map((cluster, index) => {
    const layout = branchingLayout[index] || { x: -150, y: 0, orbitDistance: 150, gravityPull: 0.4 };
    const gravity: PathNode['gravity'] = index < 2 ? 'strong' : 'soft';
    const topRoleLabels = cluster.roleNodes.slice(0, 2).map((role) => role.title);
    const visual = directionVisuals[cluster.direction.id] || directionVisuals.less_commuting;
    const localizedTitle = getLocalizedDirectionLabel(cluster.direction, t);
    const localizedDescription = getLocalizedDirectionDescription(cluster.direction, t);

    return {
      id: 'direction:' + cluster.direction.id,
      domainKey: cluster.direction.id,
      directionIcon: cluster.direction.icon,
      title: localizedTitle,
      subtitle: t('careeros.workflow.direction_meta', {
        defaultValue: '{{roles}} roles • {{offers}} offers',
        roles: cluster.roleNodes.length,
        offers: cluster.items.length,
      }),
      summary: localizedDescription,
      preview: topRoleLabels.length > 0
        ? t('careeros.workflow.typical_roles', {
            defaultValue: 'Typical roles: {{roles}}',
            roles: topRoleLabels.join(' • '),
          })
        : localizedDescription,
      tags: topRoleLabels.length > 0 ? topRoleLabels : Array.from(new Set(cluster.items.flatMap((item) => item.topTags))).slice(0, 2),
      tone: visual.tone,
      challengeCount: cluster.items.length,
      gravity,
      featuredChallenge: cluster.featuredChallenge,
      challenges: cluster.items,
      roleNodes: cluster.roleNodes,
      imageUrl: cluster.featuredChallenge?.coverImageUrl || cluster.featuredChallenge?.avatarUrl || null,
      x: layout.x,
      y: layout.y,
      rank: index,
      gravityPull: layout.gravityPull,
      orbitDistance: layout.orbitDistance,
      textPos: layout.x < 0 ? 'left' : 'right',
    };
  });
};

const buildJobOfferLayerJobs = (jobs: Job[], selectedPath: PathNode | null, selectedRole: RoleNode | null): Job[] => {
  if (!selectedPath || !selectedRole) return [];

  const roleChallengeIds = new Set(selectedRole.challenges.map((challenge) => challenge.id));
  const normalizedSelectedRole = normalizeRoleClusterTitle(selectedRole.title).toLowerCase();

  return jobs
    .map((job) => {
      const jobId = String(job.id || '');
      const normalizedJobRole = normalizeRoleClusterTitle(String(job.title || '')).toLowerCase();
      const isDirectRoleMatch = normalizedJobRole === normalizedSelectedRole;
      const isRoleChallengeMatch = roleChallengeIds.has(jobId);
      if (!isDirectRoleMatch && !isRoleChallengeMatch) {
        return null;
      }

      const score =
        (isRoleChallengeMatch ? 100 : 0)
        + (isDirectRoleMatch ? 80 : 0)
        + Number(job.priorityScore || job.searchScore || job.aiMatchScore || 0)
        + Math.min(20, Number(job.jhi?.score || 0) / 5);

      return { job, score };
    })
    .filter((item): item is { job: Job; score: number } => Boolean(item))
    .sort((left, right) => right.score - left.score)
    .map((item) => item.job)
    .slice(0, 60);
};

const selectLearningRelevantChallenges = (
  preferredDomains: string[],
  targetRole: string,
  selectedPath: PathNode | null,
  allChallenges: CareerOSChallenge[],
): CareerOSChallenge[] => {
  const normalizedRole = normalizeRoleClusterTitle(targetRole).toLowerCase();
  const roleTokens = normalizedRole.split(/\s+/).filter((token) => token.length >= 3);

  const scored = allChallenges
    .map((challenge) => {
      let score = 0;
      const challengeDomains = challenge.matchedDomains || [];
      if (preferredDomains.some((domain) => challengeDomains.includes(domain as any))) score += 10;
      if (selectedPath?.challenges.some((item) => item.id === challenge.id)) score += 6;
      const haystack = `${challenge.title} ${challenge.challengeSummary} ${challenge.companyGoal}`.toLowerCase();
      if (roleTokens.some((token) => haystack.includes(token))) score += 8;
      if (challenge.requiredSkills.length > 0) score += 2;
      return { challenge, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || right.challenge.jhiScore - left.challenge.jhiScore)
    .map((item) => item.challenge);

  if (scored.length > 0) return scored.slice(0, 12);
  if (selectedPath?.challenges?.length) return selectedPath.challenges.slice(0, 12);
  return allChallenges.slice(0, 12);
};

const formatLearningDuration = (durationHours: number, t: TFunction): string => {
  const hours = Number(durationHours || 0);
  if (!Number.isFinite(hours) || hours <= 0) {
    return t('careeros.learning.duration.flexible', { defaultValue: 'Flexible pace' });
  }
  if (hours < 8) {
    return t('careeros.learning.duration.hours', { defaultValue: '{{count}} hours', count: Math.max(1, Math.round(hours)) });
  }
  if (hours < 40) {
    return t('careeros.learning.duration.days', { defaultValue: '{{count}} days', count: Math.max(1, Math.round(hours / 8)) });
  }
  return t('careeros.learning.duration.dynamic_weeks', { defaultValue: '{{count}} weeks', count: Math.max(1, Math.round(hours / 20)) });
};

const formatLearningPrice = (resource: LearningResource, t: TFunction): string => {
  if (resource.is_government_funded) {
    return t('careeros.learning.pricing.funded', { defaultValue: 'Funding available' });
  }
  const amount = Number(resource.price || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return t('careeros.learning.pricing.free', { defaultValue: 'Free / undisclosed' });
  }
  return `${amount.toLocaleString()} ${resource.currency || 'CZK'}`;
};

const formatLearningDifficulty = (difficulty: LearningResource['difficulty'], t: TFunction): string => {
  if (difficulty === 'Advanced') return t('careeros.learning.level.advanced', { defaultValue: 'Advanced' });
  if (difficulty === 'Intermediate') return t('careeros.learning.level.intermediate', { defaultValue: 'Intermediate' });
  return t('careeros.learning.level.beginner', { defaultValue: 'Beginner' });
};

const buildLearningMarketplaceNote = (resource: LearningResource, t: TFunction): string => {
  if (resource.is_government_funded) {
    return t('careeros.learning.marketplace_note.funded', { defaultValue: 'This resource may be partially or fully funded, which lowers the barrier to act on the gap.' });
  }
  if (resource.location) {
    return t('careeros.learning.marketplace_note.location', { defaultValue: 'Has a location component, so it can work well when you want a more grounded, practical learning step.' });
  }
  if (resource.partner_name) {
    return t('careeros.learning.marketplace_note.partner', { defaultValue: 'Comes directly from a learning partner, so the recommendation stays tied to a real provider instead of a synthetic placeholder.' });
  }
  return t('careeros.learning.marketplace_note.default_real', { defaultValue: 'Real marketplace entry matched to your current gap, not a generated placeholder.' });
};

const buildLearningGapAnalysis = (
  userProfile: UserProfile,
  selectedPath: PathNode | null,
  allChallenges: CareerOSChallenge[],
  learningResources: LearningResource[],
  resourcesLoading: boolean,
  t: TFunction,
): LearningGapAnalysis => {
  const searchProfile = userProfile.preferences?.searchProfile;
  const primaryDomain = String(searchProfile?.primaryDomain || searchProfile?.inferredPrimaryDomain || '').trim();
  const secondaryDomains = (searchProfile?.secondaryDomains || []).map((domain) => String(domain || '').trim()).filter(Boolean);
  const currentRole = String(
    userProfile.jobTitle
    || userProfile.preferences?.desired_role
    || t('careeros.learning.current_profile', { defaultValue: 'Current profile' }),
  ).trim() || t('careeros.learning.current_profile', { defaultValue: 'Current profile' });
  const explicitTargetRole = String(searchProfile?.targetRole || userProfile.preferences?.desired_role || '').trim();
  const fallbackTargetRole = String(selectedPath?.title || selectedPath?.featuredChallenge.title || '').trim();
  const targetRole = explicitTargetRole || fallbackTargetRole || t('careeros.learning.next_step', { defaultValue: 'Next career step' });
  const targetDomainLabel = primaryDomain
    ? getLocalizedDomainLabel(primaryDomain, t)
    : selectedPath
      ? selectedPath.title
      : t('careeros.learning.selected_direction', { defaultValue: 'Selected direction' });
  const intentReady = Boolean(primaryDomain || explicitTargetRole);
  const intentSummary = t('careeros.learning.intent_summary', {
    defaultValue: '{{domain}} -> {{role}}',
    domain: targetDomainLabel,
    role: targetRole,
  });

  const candidateSkillPool = uniqStrings([
    ...(Array.isArray(userProfile.skills) ? userProfile.skills : []),
    ...(Array.isArray(userProfile.inferredSkills) ? userProfile.inferredSkills : []),
    ...(Array.isArray(userProfile.strengths) ? userProfile.strengths : []),
    ...(Array.isArray(userProfile.certifications) ? userProfile.certifications : []),
  ]);

  const relevantChallenges = selectLearningRelevantChallenges(
    uniqStrings([primaryDomain, ...secondaryDomains].filter(Boolean)),
    targetRole,
    selectedPath,
    allChallenges,
  );

  const targetSkills = uniqStrings(
    relevantChallenges
      .flatMap((challenge) => challenge.requiredSkills)
      .filter(Boolean),
  ).slice(0, 8);

  const currentSkillKeys = new Set(candidateSkillPool.map(normalizeSkillKey));
  const currentSkills = candidateSkillPool
    .filter((skill) => targetSkills.some((target) => normalizeSkillKey(target) === normalizeSkillKey(skill)))
    .concat(candidateSkillPool)
    .filter((skill, index, list) => list.findIndex((item) => normalizeSkillKey(item) === normalizeSkillKey(skill)) === index)
    .slice(0, 4);
  const missingSkills = targetSkills.filter((skill) => !currentSkillKeys.has(normalizeSkillKey(skill))).slice(0, 5);
  const skillDataReady = targetSkills.length > 0;

  const rankedResources = learningResources
    .filter((resource) => String(resource.status || 'active') !== 'archived')
    .map((resource) => {
      const haystack = [
        resource.title,
        resource.description,
        resource.provider,
        resource.partner_name,
        ...(resource.skill_tags || []),
      ].join(' ').toLowerCase();
      const matchedSkills = uniqStrings(
        (missingSkills.length > 0 ? missingSkills : targetSkills)
          .filter((skill) => (resource.skill_tags || []).some((tag) => normalizeSkillKey(tag) === normalizeSkillKey(skill))),
      );
      const roleTokens = normalizeRoleClusterTitle(targetRole).toLowerCase().split(/\s+/).filter((token) => token.length >= 3);
      const roleHit = roleTokens.some((token) => haystack.includes(token));
      const domainHit = primaryDomain ? haystack.includes(primaryDomain.replace(/_/g, ' ')) : haystack.includes(targetDomainLabel.toLowerCase());
      const score = matchedSkills.length * 100 + (roleHit ? 18 : 0) + (domainHit ? 9 : 0) + Number(resource.rating || 0);
      return { resource, matchedSkills, roleHit, domainHit, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || parseDateValue(right.resource.created_at) - parseDateValue(left.resource.created_at))
    .slice(0, 6)
    .map(({ resource, matchedSkills, roleHit, score }) => ({
      id: resource.id,
      title: resource.title,
      provider: resource.partner_name || resource.provider || t('careeros.learning.unknown_provider', { defaultValue: 'Learning partner' }),
      duration: formatLearningDuration(resource.duration_hours, t),
      reason: matchedSkills.length > 0
        ? t('careeros.learning.resource_reason.skills', { defaultValue: 'Matched to {{skills}}.', skills: matchedSkills.join(', ') })
        : roleHit
          ? t('careeros.learning.resource_reason.role', { defaultValue: 'Relevant for the target move into {{role}}.', role: targetRole })
          : t('careeros.learning.resource_reason.domain', { defaultValue: 'Relevant for your selected direction in {{domain}}.', domain: targetDomainLabel }),
      matchedSkills,
      match: Math.max(68, Math.min(98, Math.round(score))),
      rating: Number(resource.rating || 0),
      reviewCount: Number(resource.reviews_count || 0),
      priceLabel: formatLearningPrice(resource, t),
      formatLabel: resource.location
        ? t('careeros.learning.format.location_based', { defaultValue: 'Location-based / blended' })
        : t('careeros.learning.format.self_paced', { defaultValue: 'Self-paced' }),
      levelLabel: formatLearningDifficulty(resource.difficulty, t),
      marketplaceNote: buildLearningMarketplaceNote(resource, t),
      url: resource.affiliate_url || resource.url || '',
      status: resource.status || 'active',
    }));

  let resourceState: LearningGapAnalysis['resourceState'] = 'ready';
  let resourceEmptyTitle: string | null = null;
  let resourceEmptyBody: string | null = null;

  if (!intentReady) {
    resourceState = 'missing_intent';
    resourceEmptyTitle = t('careeros.learning.empty_intent_title', { defaultValue: 'Choose a direction first' });
    resourceEmptyBody = t('careeros.learning.empty_intent_body', { defaultValue: 'Set your primary domain or target role in the profile first. Once the direction is explicit, the learning path can stop guessing and start matching.' });
  } else if (!skillDataReady) {
    resourceState = 'missing_skills';
    resourceEmptyTitle = t('careeros.learning.empty_skills_title', { defaultValue: 'We still need skill signal for this direction' });
    resourceEmptyBody = t('careeros.learning.empty_skills_body', { defaultValue: 'The direction is set, but we do not yet have enough reliable skill requirements from matching roles to build a useful gap.' });
  } else if (resourcesLoading) {
    resourceState = 'loading';
  } else if (rankedResources.length === 0) {
    resourceState = 'empty_resources';
    resourceEmptyTitle = t('careeros.learning.empty_resources_title', { defaultValue: 'The path is ready, but there are no courses here yet' });
    resourceEmptyBody = t('careeros.learning.empty_resources_body', { defaultValue: 'Your direction and skill gap are ready. We just do not have any real learning resources matched to this path yet.' });
  }

  return {
    intentReady,
    skillDataReady,
    currentRole,
    targetRole,
    targetDomainLabel,
    intentSummary,
    currentSkills,
    targetSkills,
    missingSkills,
    resources: rankedResources,
    resourceState,
    resourceEmptyTitle,
    resourceEmptyBody,
  };
};

const buildMiniChallengeCards = (jobs: Job[], profileChallenges: Job[], userProfile: UserProfile, t: TFunction) => {
  const isLikelyMiniChallenge = (job: Job): boolean => {
    const salaryTimeframe = String(job.salary_timeframe || '').trim().toLowerCase();
    return (
      job.challenge_format === 'micro_job'
      || Boolean(job.micro_job_kind)
      || Boolean(job.micro_job_time_estimate)
      || (Array.isArray(job.micro_job_collaboration_modes) && job.micro_job_collaboration_modes.length > 0)
      || salaryTimeframe === 'project_total'
    );
  };

  const resolveDuration = (job: Job): string => {
    if (String(job.micro_job_time_estimate || '').trim()) {
      return String(job.micro_job_time_estimate).trim();
    }

    if (job.micro_job_kind === 'one_off_task') {
      return t('careeros.mini.duration.one_off', { defaultValue: '2-6 hours' });
    }
    if (job.micro_job_kind === 'audit_review') {
      return t('careeros.mini.duration.audit_review', { defaultValue: '0.5-1 day' });
    }
    if (job.micro_job_kind === 'prototype') {
      return t('careeros.mini.duration.prototype', { defaultValue: '2-5 days' });
    }
    if (job.micro_job_kind === 'experiment') {
      return t('careeros.mini.duration.experiment', { defaultValue: '3-7 days' });
    }
    if (job.micro_job_kind === 'short_project') {
      return t('careeros.mini.duration.short_project', { defaultValue: '1-3 weeks' });
    }

    return t('careeros.mini.duration.project_scoped', { defaultValue: 'Project scoped' });
  };

  const resolveScope = (job: Job): string => {
    if (Array.isArray(job.micro_job_collaboration_modes) && job.micro_job_collaboration_modes.length > 0) {
      return job.micro_job_collaboration_modes
        .map((mode) => String(mode || '').trim().toLowerCase())
        .filter(Boolean)
        .map((value) => t(`company.job_editor.micro_job_collaboration_options.${value}`, {
          defaultValue: value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
        }))
        .join(' • ');
    }

    if (job.micro_job_kind === 'one_off_task') {
      return t('careeros.mini.scope.one_off', { defaultValue: 'One-off task' });
    }
    if (job.micro_job_kind === 'audit_review') {
      return t('careeros.mini.scope.audit_review', { defaultValue: 'Audit / review' });
    }
    if (job.micro_job_kind === 'prototype') {
      return t('careeros.mini.scope.prototype', { defaultValue: 'Prototype build' });
    }
    if (job.micro_job_kind === 'experiment') {
      return t('careeros.mini.scope.experiment', { defaultValue: 'Experiment' });
    }
    if (job.micro_job_kind === 'short_project') {
      return t('careeros.mini.scope.short_project', { defaultValue: 'Short project' });
    }

    return t('careeros.mini.short_collaboration', { defaultValue: 'Short collaboration' });
  };

  const ownProfileChallengeIds = new Set(profileChallenges.map((job) => String(job.id || '')).filter(Boolean));

  const source = jobs
    .filter(isLikelyMiniChallenge)
    .filter((job) => !ownProfileChallengeIds.has(String(job.id || '')))
    .sort((left, right) => Number((right as any)?.jhi?.score || 0) - Number((left as any)?.jhi?.score || 0));

  const profileJobCards = profileChallenges
    .filter((job) => {
      const status = String(job.status || 'active').toLowerCase();
      return status !== 'archived';
    })
    .sort((left, right) => new Date(right.scrapedAt || 0).getTime() - new Date(left.scrapedAt || 0).getTime())
    .map((job) => ({
      id: String(job.id),
      title: String(job.title || t('careeros.mini.title_fallback', { defaultValue: 'Mini challenge' })),
      company: String(job.company || userProfile.name || t('careeros.mini.your_profile', { defaultValue: 'Your profile' })),
      duration: resolveDuration(job),
      scope: String(job.location || resolveScope(job) || t('careeros.mini.short_collaboration', { defaultValue: 'Short collaboration' })),
      reward: String(job.micro_job_reward || job.salaryRange || t('careeros.mini.budget_open', { defaultValue: 'Budget on open' })),
      summary: compactText(String(job.challenge || job.description || t('careeros.mini.summary_fallback', { defaultValue: 'Small scoped project to test real collaboration.' })), 140),
      action: 'manage_profile_challenge' as const,
    }));

  const jobCards = source.slice(0, 6).map((job) => ({
    id: String(job.id),
    title: String(job.title || t('careeros.mini.title_fallback', { defaultValue: 'Mini challenge' })),
    company: String(job.company || t('careeros.mini.unknown_company', { defaultValue: 'Unknown company' })),
    duration: resolveDuration(job),
    scope: resolveScope(job),
    reward: String(job.micro_job_reward || job.salaryRange || t('careeros.mini.budget_open', { defaultValue: 'Budget on open' })),
    summary: compactText(String(job.challenge || job.description || t('careeros.mini.summary_fallback', { defaultValue: 'Small scoped project to test real collaboration.' })), 140),
    action: 'open_challenge' as const,
  }));

  return [...profileJobCards, ...jobCards]
    .filter((card, index, cards) => cards.findIndex((item) => item.id === card.id) === index)
    .slice(0, 6);
};

const hasCareerPathProfileSignal = (userProfile: UserProfile): boolean => {
  const searchProfile = userProfile.preferences?.searchProfile;
  return Boolean(
    String(searchProfile?.primaryDomain || '').trim()
    || String(searchProfile?.inferredPrimaryDomain || '').trim()
    || String(searchProfile?.targetRole || '').trim()
    || String(userProfile.preferences?.desired_role || '').trim()
    || String(userProfile.jobTitle || '').trim()
    || String(userProfile.story || '').trim()
    || String(userProfile.cvText || '').trim()
    || String(userProfile.cvAiText || '').trim()
    || (Array.isArray(userProfile.skills) && userProfile.skills.length > 0)
    || (Array.isArray(userProfile.inferredSkills) && userProfile.inferredSkills.length > 0)
    || (Array.isArray(userProfile.workHistory) && userProfile.workHistory.length > 0)
  );
};

const NodeImage: React.FC<{
  src: string | null;
  alt: string;
  fallback: string;
  className?: string;
}> = ({ src, alt, fallback, className }) => {
  const [failed, setFailed] = useState(false);
  const safeSrc = !failed ? safeImage(src) : null;

  if (safeSrc) {
    return <img src={safeSrc} alt={alt} className={className} onError={() => setFailed(true)} loading="lazy" />;
  }

  return (
    <div className={cn('flex items-center justify-center bg-gradient-to-br from-emerald-500 to-sky-500 text-white', className)}>
      <span className="text-sm font-semibold">{fallback}</span>
    </div>
  );
};

const DirectionNodeMedia: React.FC<{
  directionKey: string;
  icon: string;
  title: string;
  className?: string;
}> = ({ directionKey, icon, title, className }) => {
  const visual = directionVisuals[directionKey] || directionVisuals.less_commuting;

  return (
    <div className={cn('relative h-full w-full overflow-hidden rounded-[30px] [clip-path:polygon(16%_0,84%_0,100%_16%,100%_84%,84%_100%,16%_100%,0_84%,0_16%)]', className)}>
      <img src={visual.imageUrl} alt={title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-88', visual.gradient)} />
      <div className="absolute inset-[7px] [clip-path:polygon(16%_0,84%_0,100%_16%,100%_84%,84%_100%,16%_100%,0_84%,0_16%)] border border-white/30 bg-slate-950/8" />
      <div className="absolute inset-x-0 top-[12px] flex justify-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950/28 text-[20px] text-white shadow-sm backdrop-blur-md">
          {icon}
        </div>
      </div>
      <div className="absolute inset-x-[10px] bottom-[10px] h-[18px] rounded-full bg-white/18 blur-[1px]" />
      <div className="absolute inset-x-[16px] bottom-[10px] h-[2px] rounded-full bg-white/48" />
      <div className="absolute inset-x-[22px] bottom-[16px] h-[2px] rounded-full bg-white/24" />
      <div className="absolute right-[10px] top-[10px] h-2.5 w-2.5 rounded-full bg-white/55" />
      <div className="absolute left-[10px] bottom-[10px] h-1.5 w-1.5 rounded-full bg-white/45" />
      <div className="absolute left-1/2 top-1/2 h-[56px] w-[56px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-white/6 blur-[0.5px]" />
      <div className="absolute inset-0 [clip-path:polygon(16%_0,84%_0,100%_16%,100%_84%,84%_100%,16%_100%,0_84%,0_16%)] ring-1 ring-inset ring-white/12" />
      <div className="absolute inset-0 [clip-path:polygon(16%_0,84%_0,100%_16%,100%_84%,84%_100%,16%_100%,0_84%,0_16%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.36)]" />
      <div className="sr-only">
        {title}
      </div>
    </div>
  );
};

const roleNodeBadgeStyles: Record<string, { shell: string; core: string; text: string; chip: string }> = {
  more_time: {
    shell: 'border-slate-300 bg-gradient-to-br from-slate-50 to-cyan-50 shadow-[0_0_18px_rgba(148,163,184,0.18)]',
    core: 'from-slate-600 to-cyan-600',
    text: 'text-slate-700',
    chip: 'border-slate-200 bg-white text-slate-600',
  },
  less_commuting: {
    shell: 'border-cyan-300 bg-gradient-to-br from-cyan-50 to-sky-50 shadow-[0_0_18px_rgba(34,211,238,0.16)]',
    core: 'from-cyan-500 to-blue-600',
    text: 'text-cyan-700',
    chip: 'border-cyan-200 bg-white text-cyan-700',
  },
  more_people: {
    shell: 'border-orange-300 bg-gradient-to-br from-amber-50 to-rose-50 shadow-[0_0_18px_rgba(251,146,60,0.16)]',
    core: 'from-orange-500 to-rose-500',
    text: 'text-orange-700',
    chip: 'border-orange-200 bg-white text-orange-700',
  },
  more_field: {
    shell: 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-[0_0_18px_rgba(16,185,129,0.16)]',
    core: 'from-emerald-500 to-teal-600',
    text: 'text-emerald-700',
    chip: 'border-emerald-200 bg-white text-emerald-700',
  },
  higher_income: {
    shell: 'border-lime-300 bg-gradient-to-br from-lime-50 to-emerald-50 shadow-[0_0_18px_rgba(132,204,22,0.16)]',
    core: 'from-lime-500 to-emerald-600',
    text: 'text-emerald-700',
    chip: 'border-lime-200 bg-white text-emerald-700',
  },
  faster_growth: {
    shell: 'border-sky-300 bg-gradient-to-br from-sky-50 to-indigo-50 shadow-[0_0_18px_rgba(59,130,246,0.16)]',
    core: 'from-sky-500 to-indigo-600',
    text: 'text-sky-700',
    chip: 'border-sky-200 bg-white text-sky-700',
  },
};

const RolePreviewPill: React.FC<{
  title: string;
  count: number;
  directionKey: string;
  active?: boolean;
}> = ({ title, count, directionKey, active = false }) => {
  const style = roleNodeBadgeStyles[directionKey] || roleNodeBadgeStyles.less_commuting;

  return (
    <div
      className={cn(
        'inline-flex max-w-[188px] items-center gap-2 rounded-full border px-3 py-1.5 text-left shadow-sm backdrop-blur-sm transition-transform duration-200',
        active ? 'translate-x-1 scale-[1.01] ring-2 ring-white shadow-[0_10px_28px_-18px_rgba(15,23,42,0.35)]' : '',
        style.chip,
      )}
      title={title}
    >
      <span className={cn('truncate text-[10px] font-semibold', style.text)}>{compactText(title, 24)}</span>
      <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-950/90 dark:text-slate-200">
        {count}
      </span>
    </div>
  );
};

const filterChipClass = 'rounded-full px-3 py-2 text-sm font-semibold transition';

const curatedBenefitOptions: Array<{ key: string; label: string; icon: React.ReactNode }> = [
  { key: 'dog_friendly', label: 'Dog-friendly office', icon: <Dog className="h-3.5 w-3.5" /> },
  { key: 'child_friendly', label: 'Child-friendly office', icon: <HeartHandshake className="h-3.5 w-3.5" /> },
  { key: 'car_personal', label: 'Company car', icon: <CarFront className="h-3.5 w-3.5" /> },
  { key: 'education', label: 'Courses & learning', icon: <GraduationCap className="h-3.5 w-3.5" /> },
  { key: 'multisport', label: 'Sport card', icon: <Sparkles className="h-3.5 w-3.5" /> },
  { key: 'meal_allowance', label: 'Meal allowance', icon: <UtensilsCrossed className="h-3.5 w-3.5" /> },
  { key: 'health_care', label: 'Health care', icon: <HeartPulse className="h-3.5 w-3.5" /> },
];

export const SearchCockpit: React.FC<{
  open: boolean;
  onClose: () => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filterCity: string;
  setFilterCity: (value: string) => void;
  remoteOnly: boolean;
  setRemoteOnly: (value: boolean) => void;
  filterWorkArrangement: JobWorkArrangementFilter;
  setFilterWorkArrangement: (value: JobWorkArrangementFilter) => void;
  globalSearch: boolean;
  setGlobalSearch: (value: boolean) => void;
  abroadOnly: boolean;
  setAbroadOnly: (value: boolean) => void;
  enableCommuteFilter: boolean;
  setEnableCommuteFilter: (value: boolean) => void;
  filterMinSalary: number;
  setFilterMinSalary: (value: number) => void;
  filterMaxDistance: number;
  setFilterMaxDistance: (value: number) => void;
  transportMode: TransportMode;
  setTransportMode: (value: TransportMode) => void;
  discoveryMode: 'all' | 'micro_jobs';
  setDiscoveryMode: (value: 'all' | 'micro_jobs') => void;
  filterContractType: string[];
  setFilterContractType: (values: string[]) => void;
  filterExperience: string[];
  setFilterExperience: (values: string[]) => void;
  filterLanguageCodes: SearchLanguageCode[];
  setFilterLanguageCodes: (values: SearchLanguageCode[]) => void;
  filterBenefits: string[];
  setFilterBenefits: (values: string[]) => void;
  benefitCandidates: string[];
  onLiveChange: () => void;
}> = ({
  open,
  onClose,
  searchTerm,
  setSearchTerm,
  filterCity,
  setFilterCity,
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
  discoveryMode: _discoveryMode,
  setDiscoveryMode: _setDiscoveryMode,
  filterContractType,
  setFilterContractType,
  filterExperience: _filterExperience,
  setFilterExperience: _setFilterExperience,
  filterLanguageCodes: _filterLanguageCodes,
  setFilterLanguageCodes: _setFilterLanguageCodes,
  filterBenefits,
  setFilterBenefits,
  benefitCandidates,
  onLiveChange,
}) => {
  const { t } = useTranslation();
  if (!open) return null;

  const activateLiveDiscovery = () => {
    onLiveChange();
  };

  const activateCommuteRadius = (distanceKm?: number) => {
    setGlobalSearch(false);
    setAbroadOnly(false);
    setEnableCommuteFilter(true);
    if (typeof distanceKm === 'number') {
      setFilterMaxDistance(distanceKm);
    }
    activateLiveDiscovery();
  };

  const combinedBenefits = Array.from(
    new Map(
      [
        ...curatedBenefitOptions,
        ...benefitCandidates.map((benefit) => ({ key: benefit, label: benefit.replace(/_/g, ' '), icon: <Sparkles className="h-3.5 w-3.5" /> })),
      ].map((item) => [item.key, item]),
    ).values(),
  ).slice(0, 10);

  const activeFilterCount =
    Number(Boolean(remoteOnly || filterWorkArrangement !== 'all'))
    + Number(Boolean(globalSearch || abroadOnly || enableCommuteFilter))
    + Number(filterMinSalary > 0)
    + filterContractType.length
    + filterBenefits.length
    + Number(transportMode !== 'car');

  const selectedWorkArrangement: JobWorkArrangementFilter = remoteOnly ? 'remote' : filterWorkArrangement;
  const geographicScope: 'domestic' | 'border' | 'all' = enableCommuteFilter ? 'border' : (globalSearch || abroadOnly ? 'all' : 'domestic');

  return (
    <>
      <button
        type="button"
        aria-label={t('careeros.filters.close', { defaultValue: 'Close filters' })}
        className="fixed inset-0 z-[79] cursor-default bg-slate-950/12 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="absolute left-1/2 top-[calc(100%+12px)] z-[80] flex max-h-[min(78vh,820px)] w-[min(94vw,980px)] -translate-x-1/2 flex-col overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/96 p-4 shadow-[0_28px_90px_-30px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/94 dark:shadow-[0_28px_90px_-30px_rgba(2,6,23,0.82)] sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600">{t('careeros.filters.title', { defaultValue: 'Upresnit hledani' })}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('careeros.filters.subtitle', { defaultValue: 'Jen par jasnych voleb, ktere opravdu meni vysledky.' })}</div>
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setRemoteOnly(false);
                  setFilterWorkArrangement('all');
                  setGlobalSearch(false);
                  setAbroadOnly(false);
                  setEnableCommuteFilter(false);
                  setFilterMinSalary(0);
                  setFilterMaxDistance(50);
                  setFilterContractType([]);
                  setFilterBenefits([]);
                  setTransportMode('car');
                  activateLiveDiscovery();
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/55 px-3 py-2 text-xs font-semibold text-slate-700 backdrop-blur-xl transition hover:border-cyan-200/80 hover:text-cyan-700 dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('careeros.filters.reset', { defaultValue: 'Vyčistit' })}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/60 bg-white/55 text-slate-700 backdrop-blur-xl transition hover:border-cyan-200/80 hover:text-cyan-700 dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div className="space-y-3 rounded-[24px] border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.58),rgba(255,255,255,0.26))] p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.72),rgba(15,23,42,0.46))]">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.search', { defaultValue: 'Co hledáte' })}</span>
                  <input
                    value={searchTerm}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setSearchTerm(nextValue);
                      activateLiveDiscovery();
                    }}
                    placeholder={t('careeros.filters.search_placeholder', { defaultValue: 'Role, firma nebo klíčové slovo' })}
                    className="w-full rounded-[18px] border border-white/70 bg-white/72 px-4 py-3 text-sm text-slate-700 outline-none backdrop-blur-xl focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.city', { defaultValue: 'Kde chcete hledat' })}</span>
                  <input
                    value={filterCity}
                    onChange={(event) => {
                      setFilterCity(event.target.value);
                      activateLiveDiscovery();
                    }}
                    placeholder={t('careeros.filters.city_placeholder', { defaultValue: 'Město, region nebo práce na dálku' })}
                    className="w-full rounded-[18px] border border-white/70 bg-white/72 px-4 py-3 text-sm text-slate-700 outline-none backdrop-blur-xl focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[20px] border border-white/60 bg-white/52 p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/60">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    <span>{t('careeros.filters.commute_distance', { defaultValue: 'Dojezdova vzdalenost' })}</span>
                    <span className="text-cyan-600">{filterMaxDistance} km</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={120}
                    step={5}
                    value={filterMaxDistance}
                    onChange={(event) => activateCommuteRadius(Number(event.target.value))}
                    className="careeros-cyan-range w-full"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEnableCommuteFilter(false);
                        activateLiveDiscovery();
                      }}
                      className={cn(
                        filterChipClass,
                        !enableCommuteFilter ? 'bg-cyan-600 text-white' : filterChipInactiveClass,
                      )}
                    >
                      {t('careeros.filters.off', { defaultValue: 'Vypnout' })}
                    </button>
                    {[20, 50, 80].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => activateCommuteRadius(value)}
                        className={cn(
                          filterChipClass,
                          filterMaxDistance === value ? 'bg-cyan-600 text-white' : filterChipInactiveClass,
                        )}
                      >
                        {value} km
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[20px] border border-white/60 bg-white/52 p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/60">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.search_scope', { defaultValue: 'Kde hledat' })}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('careeros.filters.search_scope_desc', { defaultValue: 'Zaklad je vzdy domaci trh. Prihranici a zahranici se zapina jen kdyz to opravdu chcete.' })}</div>
                  <div className="mt-3 grid gap-2">
                    {([
                      ['domestic', t('careeros.filters.scope_domestic', { defaultValue: 'Jen domaci trh' })],
                      ['border', t('careeros.filters.scope_border', { defaultValue: 'I prihranici' })],
                      ['all', t('careeros.filters.scope_all_markets', { defaultValue: 'I zahranici' })],
                    ] as Array<['domestic' | 'border' | 'all', string]>).map(([value, label]) => {
                      const active = geographicScope === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            if (value === 'domestic') {
                              setGlobalSearch(false);
                              setAbroadOnly(false);
                              setEnableCommuteFilter(false);
                              activateLiveDiscovery();
                              return;
                            }
                            if (value === 'border') {
                              setGlobalSearch(false);
                              setAbroadOnly(false);
                              setEnableCommuteFilter(true);
                              activateLiveDiscovery();
                              return;
                            }
                            setGlobalSearch(true);
                            setAbroadOnly(false);
                            setEnableCommuteFilter(false);
                            activateLiveDiscovery();
                          }}
                          className={cn(
                            'rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition',
                            active ? 'border-cyan-500 bg-cyan-600 text-white shadow-[0_18px_36px_-24px_rgba(8,145,178,0.8)]' : filterChipInactiveClass,
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-white/60 bg-white/52 p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/60">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.transport_mode', { defaultValue: 'Jak dojíždíte' })}</div>
                <TransportModeSelector
                  selectedMode={transportMode}
                  onModeChange={(value) => {
                    setTransportMode(value);
                    activateLiveDiscovery();
                  }}
                  compact
                />
              </div>

              <div className="rounded-[20px] border border-white/60 bg-white/52 p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/60">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.comp_floor', { defaultValue: 'Minimální odměna' })}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[0, 40000, 60000, 90000].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setFilterMinSalary(value);
                        activateLiveDiscovery();
                      }}
                      className={cn(
                        filterChipClass,
                          filterMinSalary === value ? 'bg-cyan-600 text-white' : filterChipInactiveClass,
                      )}
                    >
                      {value === 0 ? t('careeros.filters.any', { defaultValue: 'Bez minima' }) : value.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-[24px] border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.58),rgba(255,255,255,0.26))] p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.72),rgba(15,23,42,0.46))]">
              <div className="rounded-[20px] border border-white/60 bg-white/52 p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/60">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.work_arrangement', { defaultValue: 'Jak chcete pracovat' })}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('careeros.filters.work_arrangement_desc', { defaultValue: 'Jen to, co opravdu chcete videt: remote, onsite nebo neco mezi tim.' })}</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {([
                    ['remote', t('careeros.filters.arrangement_remote', { defaultValue: 'Remote' })],
                    ['onsite', t('careeros.filters.arrangement_onsite', { defaultValue: 'Na miste' })],
                    ['hybrid', t('careeros.filters.arrangement_hybrid', { defaultValue: 'Hybrid' })],
                  ] as Array<[JobWorkArrangementFilter, string]>).map(([value, label]) => {
                    const active = selectedWorkArrangement === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setRemoteOnly(false);
                          setFilterWorkArrangement(active ? 'all' : value);
                          activateLiveDiscovery();
                        }}
                        className={cn(
                          'rounded-2xl border px-4 py-3 text-sm font-semibold transition',
                          active ? 'border-cyan-500 bg-cyan-600 text-white shadow-[0_18px_36px_-24px_rgba(8,145,178,0.8)]' : filterChipInactiveClass,
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.contract_type', { defaultValue: 'Typ spoluprace' })}</div>
              <div className="flex flex-wrap gap-2">
                {['employee', 'contractor'].map((value) => {
                  const active = filterContractType.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setFilterContractType(active ? filterContractType.filter((item) => item !== value) : [...filterContractType, value]);
                        activateLiveDiscovery();
                      }}
                      className={cn(filterChipClass, active ? 'bg-cyan-600 text-white' : filterChipInactiveClass)}
                    >
                      {value === 'employee' ? t('careeros.filters.employee', { defaultValue: 'HPP / zamestnani' }) : t('careeros.filters.contractor', { defaultValue: 'ICO / kontrakt' })}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.life_benefits', { defaultValue: 'Co musi sedet v realnem zivote' })}</div>
              <div className="flex flex-wrap gap-2">
                {combinedBenefits.map((benefit) => {
                  const active = filterBenefits.includes(benefit.key);
                  return (
                    <button
                      key={benefit.key}
                      type="button"
                      onClick={() => {
                        setFilterBenefits(active ? filterBenefits.filter((item) => item !== benefit.key) : [...filterBenefits, benefit.key]);
                        activateLiveDiscovery();
                      }}
                      className={cn(
                        filterChipClass,
                        active ? 'bg-cyan-600 text-white' : filterChipInactiveClass,
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        {benefit.icon}
                        {getBenefitLabel(t, benefit.key, benefit.label)}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-[18px] border border-cyan-100/80 bg-cyan-50/70 px-4 py-3 text-sm text-cyan-800 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-200">
                {t('careeros.filters.live_apply', { defaultValue: 'Vysledky se meni hned podle toho, co si opravdu zvolite. Zadna skryta logika navic.' })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const NotificationInbox: React.FC<{
  open: boolean;
  notifications: CareerOSNotification[];
  readNotificationIds?: string[];
  onClose: () => void;
  onAction: (notification: CareerOSNotification) => void;
  onMarkRead?: (notificationId: string) => void;
  onMarkAllRead?: () => void;
  className?: string;
}> = ({ open, notifications, readNotificationIds = [], onClose, onAction, onMarkRead, onMarkAllRead, className }) => {
  const { t, i18n } = useTranslation();
  if (!open) return null;
  const unreadNotifications = notifications.filter((notification) => !readNotificationIds.includes(notification.id));
  const locale = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0].toLowerCase();
  const copy = {
    markAllRead:
      locale === 'cs' ? 'Označit vše jako přečtené'
      : locale === 'sk' ? 'Označiť všetko ako prečítané'
      : locale === 'de' ? 'Alles als gelesen markieren'
      : locale === 'pl' ? 'Oznacz wszystko jako przeczytane'
      : 'Mark all as read',
    markRead:
      locale === 'cs' ? 'Označit jako přečtené'
      : locale === 'sk' ? 'Označiť ako prečítané'
      : locale === 'de' ? 'Als gelesen markieren'
      : locale === 'pl' ? 'Oznacz jako przeczytane'
      : 'Mark as read',
  };
  const unreadCount = unreadNotifications.length;

  return (
    <>
      <button type="button" aria-label={t('careeros.notifications.close', { defaultValue: 'Close notifications' })} className="fixed inset-0 z-[79] cursor-default bg-transparent" onClick={onClose} />
      <div className={cn("absolute right-0 top-[calc(100%+14px)] z-[80] w-[360px] max-w-[calc(100vw-2rem)] rounded-[26px] border border-slate-300 bg-white p-4 shadow-[0_28px_80px_-28px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-950 dark:shadow-[0_28px_80px_-28px_rgba(2,6,23,0.82)]", className)}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600">{t('careeros.notifications.title', { defaultValue: 'Notifications' })}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('careeros.notifications.subtitle', { defaultValue: 'Messages, company reactions, daily digests and fresh high-match signals.' })}</div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-[11px] font-semibold text-cyan-700 dark:border-cyan-900/70 dark:bg-cyan-950/40 dark:text-cyan-200"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {copy.markAllRead}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {unreadNotifications.length === 0 ? (
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              {t('careeros.notifications.empty', { defaultValue: 'No fresh signals yet. New company replies, digest updates and strong match opportunities will appear here.' })}
            </div>
          ) : (
            unreadNotifications.map((notification) => {
              const Icon =
                notification.kind === 'company_message'
                  ? Mail
                  : notification.kind === 'dialogue_update'
                    ? CheckCircle2
                    : notification.kind === 'signal_boost'
                      ? Sparkles
                    : notification.kind === 'digest'
                      ? Sparkles
                      : Briefcase;
              return (
                <div
                  key={notification.id}
                  className="rounded-[22px] border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-900/70 dark:bg-slate-900"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-600 shadow-sm dark:bg-cyan-950/60 dark:text-cyan-300">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500 shadow-[0_0_0_4px_rgba(6,182,212,0.12)] dark:bg-cyan-300" />
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{notification.title}</div>
                        </div>
                        <div className="shrink-0 text-[11px] font-medium text-slate-400">{formatNotificationTime(notification.timestamp, t)}</div>
                      </div>
                      <div className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">{notification.body}</div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onAction(notification)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          {notification.ctaLabel}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMarkRead?.(notification.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-[11px] font-semibold text-cyan-700 dark:border-cyan-900/70 dark:bg-cyan-950/40 dark:text-cyan-200"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {copy.markRead}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

const DomainRemapPanel: React.FC<{
  remapOpen: boolean;
  setRemapOpen: React.Dispatch<React.SetStateAction<boolean>>;
  availableDomains: RemapDomainOption[];
  manualDomainSelection: string[];
  setManualDomainSelection: React.Dispatch<React.SetStateAction<string[]>>;
  manualDomainQuery: string;
  setManualDomainQuery: React.Dispatch<React.SetStateAction<string>>;
  className?: string;
}> = ({
  remapOpen,
  setRemapOpen,
  availableDomains,
  manualDomainSelection,
  setManualDomainSelection,
  manualDomainQuery,
  setManualDomainQuery,
  className,
}) => {
  const { t } = useTranslation();
  const activeFilterCount = manualDomainSelection.length + (manualDomainQuery.trim() ? 1 : 0);

  return (
    <div className={cn('rounded-[22px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_22px_58px_-34px_rgba(15,23,42,0.34)] backdrop-blur-xl dark:border-slate-800/90 dark:bg-slate-950/88 dark:shadow-[0_28px_70px_-34px_rgba(2,6,23,0.82)]', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
            {t('careeros.map.remap_title', { defaultValue: 'Remap directions' })}
          </div>
          <div className="mt-1 max-w-[16rem] text-xs leading-5 text-slate-500 dark:text-slate-400">
            {t('careeros.map.remap_body', { defaultValue: 'Useful mainly for guests or whenever you want to steer the map toward specific domains.' })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setRemapOpen((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {remapOpen
            ? t('careeros.map.hide_remap', { defaultValue: 'Hide' })
            : t('careeros.map.show_remap', { defaultValue: 'Choose' })}
        </button>
      </div>

      {remapOpen ? (
        <>
          <div className="mt-4">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {t('careeros.map.custom_domain_label', { defaultValue: 'Custom domain' })}
            </label>
            <input
              type="text"
              value={manualDomainQuery}
              onChange={(event) => setManualDomainQuery(event.target.value)}
              placeholder={t('careeros.map.custom_domain_placeholder', { defaultValue: 'Např. HR, právo, farmacie, učitelé...' })}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-cyan-300 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-cyan-500/60 dark:focus:ring-cyan-900/40"
            />
            <div className="mt-2 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
              {t('careeros.map.custom_domain_hint', { defaultValue: 'Váš vlastní obor prohledá názvy rolí, shrnutí, firmy i skill tagy a podle toho mapu přesměruje.' })}
            </div>
          </div>
          <div className="mt-4 flex max-h-[220px] flex-wrap gap-2 overflow-y-auto pr-1">
            {availableDomains.map((domain) => {
              const active = manualDomainSelection.includes(domain.value);
              return (
                <button
                  key={domain.value}
                  type="button"
                  onClick={() => {
                    setManualDomainSelection((current) => {
                      if (current.includes(domain.value)) return current.filter((item) => item !== domain.value);
                      if (current.length >= 5) return [...current.slice(1), domain.value];
                      return [...current, domain.value];
                    });
                  }}
                  className={cn(
                    'rounded-full border px-3 py-2 text-xs font-semibold transition',
                    active
                      ? 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-500/50 dark:bg-cyan-950/30 dark:text-cyan-200'
                      : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300',
                  )}
                >
                  {domain.label || getLocalizedDomainLabel(domain.value, t)}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {activeFilterCount > 0
                ? t('careeros.map.remap_active', { defaultValue: '{{count}} filters active', count: activeFilterCount })
                : t('careeros.map.remap_system_default', { defaultValue: 'System default is active' })}
            </div>
            <button
              type="button"
              onClick={() => {
                setManualDomainSelection([]);
                setManualDomainQuery('');
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('careeros.map.reset_remap', { defaultValue: 'Reset' })}
            </button>
          </div>
        </>
      ) : (
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {activeFilterCount > 0
            ? t('careeros.map.remap_active', { defaultValue: '{{count}} filters active', count: activeFilterCount })
            : t('careeros.map.remap_system_default', { defaultValue: 'System default is active' })}
        </div>
      )}
    </div>
  );
};
void DomainRemapPanel;

const Navbar: React.FC<any> = () => null;

const CareerPathStage: React.FC<{
  userLabel: string;
  headline: string;
  userProfilePhoto: string | null;
  isGuest: boolean;
  formattedJobsCount: string;
  formattedActiveCandidates: string;
  nodes: PositionedPathNode[];
  branchRoles: PositionedRoleNode[];
  selectedPathId: string | null;
  activeBranchRoleId: string | null;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  onNodeClick: (node: PositionedPathNode) => void;
  onClusterRoleClick: (role: RoleNode) => void;
  onOpenAuth: (mode?: 'login' | 'register') => Promise<void> | void;
  nodeOffsets: Record<string, CareerMapNodeOffset>;
  onNodeOffsetChange: (nodeKey: string, nextOffset: CareerMapNodeOffset) => void;
  onResetLayout: () => void;
  interactive?: boolean;
}> = ({
  userLabel,
  userProfilePhoto,
  isGuest,
  formattedJobsCount,
  formattedActiveCandidates,
  nodes,
  branchRoles,
  selectedPathId,
  activeBranchRoleId,
  zoom,
  setZoom,
  onNodeClick,
  onClusterRoleClick,
  onOpenAuth,
  nodeOffsets,
  onNodeOffsetChange,
  onResetLayout,
  interactive = true,
}) => {
  const { t, i18n } = useTranslation();
  const locale = String(i18n.resolvedLanguage || i18n.language || 'en').split('-')[0].toLowerCase();
  const stageRef = useRef<HTMLDivElement>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isAnimatingCamera, setIsAnimatingCamera] = useState(false);
  const canvasDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const nodeDragRef = useRef<{
    pointerId: number;
    nodeKey: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const stageCopy = {
    guestTitle: t('careeros.workflow.guest_title', { defaultValue: locale === 'cs' ? 'Začněte svou kariérní mapu' : 'Start your career map' }),
    guestBody: t('careeros.workflow.guest_body', {
      defaultValue: locale === 'cs'
        ? 'Uvidíte, který další směr dává smysl právě pro vás, proč a kam se můžete rozvinout dál.'
        : 'See which direction makes the most sense for you now, why, and how the path can unfold next.',
    }),
    guestCta: t('careeros.workflow.guest_cta', { defaultValue: locale === 'cs' ? 'Začít mapovat směr' : 'Start mapping' }),
    startLabel: t('careeros.workflow.start_label', { defaultValue: locale === 'cs' ? 'Vaše současná situace' : 'Your current situation' }),
    startFallback: t('careeros.workflow.start_fallback', {
      defaultValue: locale === 'cs'
        ? 'Tady právě stojíte. Odtud se mapa rozvíjí do směrů, které dávají smysl pro vaši další kariérní volbu.'
        : 'This is where you stand now. From here, the map unfolds into directions worth exploring next.',
    }),
    rolesShort: t('careeros.workflow.roles_short', { defaultValue: locale === 'cs' ? 'rolí' : 'roles' }),
    statsTitle: t('careeros.workflow.stats_title', { defaultValue: locale === 'cs' ? 'Kariérní mapa' : 'Career map' }),
    jobsLabel: t('careeros.workflow.jobs_label', { defaultValue: locale === 'cs' ? 'V databázi právě máme' : 'We currently have' }),
    jobsBody: t('careeros.workflow.jobs_body', { defaultValue: locale === 'cs' ? 'aktivních nabídek.' : 'active jobs in the database.' }),
    onlineLabel: t('careeros.workflow.online_label', { defaultValue: locale === 'cs' ? 'Právě online' : 'Online now' }),
    onlineBody: t('careeros.workflow.online_body', { defaultValue: locale === 'cs' ? 'uchazečů v systému' : 'candidates in the system' }),
    reset: t('careeros.workflow.reset', { defaultValue: locale === 'cs' ? 'Reset mapy' : 'Reset map' }),
  };

  const onRemapDirection = (_slotId?: string, _nodeId?: string) => {};
  const onRemapRole = (_slotId?: string, _roleId?: string) => {};

  const CANVAS_WIDTH = 1840;
  const CANVAS_HEIGHT = 1120;
  const startCardPosition = { x: 88, y: 486, width: 246, height: 100 };
  const startAnchorPoint = {
    x: startCardPosition.x + startCardPosition.width,
    y: startCardPosition.y + startCardPosition.height / 2,
  };
  const treeJunctionPoint = { x: startAnchorPoint.x + 144, y: startAnchorPoint.y };
  const treeRecommendedSlots = useMemo(
    () => [
      { x: treeJunctionPoint.x + 248, y: treeJunctionPoint.y + 8, laneY: treeJunctionPoint.y + 8, railX: treeJunctionPoint.x + 96 },
      { x: treeJunctionPoint.x + 414, y: treeJunctionPoint.y - 194, laneY: treeJunctionPoint.y - 82, railX: treeJunctionPoint.x + 112 },
      { x: treeJunctionPoint.x + 426, y: treeJunctionPoint.y + 254, laneY: treeJunctionPoint.y + 92, railX: treeJunctionPoint.x + 114 },
      { x: treeJunctionPoint.x + 736, y: treeJunctionPoint.y - 360, laneY: treeJunctionPoint.y - 176, railX: treeJunctionPoint.x + 204 },
      { x: treeJunctionPoint.x + 852, y: treeJunctionPoint.y + 142, laneY: treeJunctionPoint.y + 36, railX: treeJunctionPoint.x + 276 },
      { x: treeJunctionPoint.x + 744, y: treeJunctionPoint.y + 426, laneY: treeJunctionPoint.y + 188, railX: treeJunctionPoint.x + 210 },
    ],
    [treeJunctionPoint.x, treeJunctionPoint.y],
  );

  const visibleNodes = useMemo(
    () =>
      nodes.map((node) => {
        const slot = treeRecommendedSlots[node.distanceRank] || treeRecommendedSlots[treeRecommendedSlots.length - 1];
        const positioned = applyNodeOffset(slot.x, slot.y, node.nodeKey, nodeOffsets);
        return {
          ...node,
          x: positioned.x,
          y: positioned.y,
          laneY: Number(slot.laneY || positioned.y),
          railX: Number(slot.railX || treeJunctionPoint.x + 96),
        };
      }),
    [nodeOffsets, nodes, treeJunctionPoint.x, treeRecommendedSlots],
  );

  const activeNode = useMemo(
    () => visibleNodes.find((node) => node.id === selectedPathId) || visibleNodes[0] || null,
    [selectedPathId, visibleNodes],
  );

  const visibleBranchRoles = useMemo(() => {
    if (!activeNode || branchRoles.length === 0) return [];
    const middleIndex = (branchRoles.length - 1) / 2;
    return branchRoles.map((role, index) => {
      const baseX = activeNode.x + 372;
      const baseY = activeNode.y + (index - middleIndex) * 102;
      const positioned = applyNodeOffset(baseX, baseY, role.nodeKey, nodeOffsets);
      return {
        ...role,
        x: positioned.x,
        y: positioned.y,
      };
    });
  }, [activeNode, branchRoles, nodeOffsets]);

  const branchSignature = useMemo(
    () => visibleBranchRoles.map((role) => role.id).join('|'),
    [visibleBranchRoles],
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (nodeDragRef.current || canvasDragRef.current) return;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const branchExpanded = visibleBranchRoles.length > 0 && activeNode;
    let focusX = (startCardPosition.x + treeJunctionPoint.x) / 2;
    let focusY = treeJunctionPoint.y;

    if (branchExpanded) {
      const branchNodes = [activeNode!, ...visibleBranchRoles];
      const branchMinY = Math.min(...branchNodes.map((node) => node.y));
      const branchMaxY = Math.max(...branchNodes.map((node) => node.y));
      const branchRoleMaxX = visibleBranchRoles.length
        ? Math.max(...visibleBranchRoles.map((role) => role.x))
        : activeNode!.x;
      const branchWidth = Math.max(260, branchRoleMaxX - activeNode!.x);
      focusX = activeNode!.x + branchWidth * 0.32;
      focusY = (branchMinY + branchMaxY) / 2;
    } else if (visibleNodes.length > 0) {
      const rootMinY = Math.min(...visibleNodes.map((node) => node.y));
      const rootMaxY = Math.max(...visibleNodes.map((node) => node.y));
      const nearestNodeX = Math.min(...visibleNodes.map((node) => node.x));
      const rootLeadX = (treeJunctionPoint.x + nearestNodeX) / 2;
      focusX = Math.max(startCardPosition.x + startCardPosition.width * 0.72, rootLeadX);
      focusY = (rootMinY + rootMaxY + treeJunctionPoint.y) / 3;
    }

    const desiredScreenX = branchExpanded ? rect.width * 0.34 : rect.width * 0.36;
    const desiredScreenY = rect.height * 0.5;

    setIsAnimatingCamera(true);
    setCanvasOffset({
      x: desiredScreenX - focusX * zoom,
      y: desiredScreenY - focusY * zoom,
    });
    const timer = window.setTimeout(() => setIsAnimatingCamera(false), CAREER_MAP_CAMERA_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [
    activeNode,
    branchSignature,
    selectedPathId,
    startCardPosition.height,
    startCardPosition.width,
    startCardPosition.x,
    startCardPosition.y,
    treeJunctionPoint.x,
    treeJunctionPoint.y,
    visibleNodes,
    visibleBranchRoles,
    zoom,
  ]);

  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!interactive) return;
    event.preventDefault();
    stepZoom(setZoom, event.deltaY < 0 ? 'in' : 'out');
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || nodeDragRef.current) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, [data-map-control="true"]')) return;
    setIsAnimatingCamera(false);
    canvasDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: canvasOffset.x,
      originY: canvasOffset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const nodeDrag = nodeDragRef.current;
    if (nodeDrag && nodeDrag.pointerId === event.pointerId) {
      onNodeOffsetChange(nodeDrag.nodeKey, {
        x: nodeDrag.originX + Math.round((event.clientX - nodeDrag.startX) / zoom),
        y: nodeDrag.originY + Math.round((event.clientY - nodeDrag.startY) / zoom),
      });
      return;
    }

    const canvasDrag = canvasDragRef.current;
    if (!canvasDrag || canvasDrag.pointerId !== event.pointerId) return;
    setCanvasOffset({
      x: canvasDrag.originX + (event.clientX - canvasDrag.startX),
      y: canvasDrag.originY + (event.clientY - canvasDrag.startY),
    });
  };

  const handleCanvasPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (nodeDragRef.current?.pointerId === event.pointerId) {
      nodeDragRef.current = null;
    }
    if (canvasDragRef.current?.pointerId === event.pointerId) {
      canvasDragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  const beginNodeDrag = (event: React.PointerEvent<HTMLElement>, nodeKey: string) => {
    if (!interactive) return;
    event.stopPropagation();
    setIsAnimatingCamera(false);
    nodeDragRef.current = {
      pointerId: event.pointerId,
      nodeKey,
      startX: event.clientX,
      startY: event.clientY,
      originX: Number(nodeOffsets[nodeKey]?.x || 0),
      originY: Number(nodeOffsets[nodeKey]?.y || 0),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return (
    <div
      ref={stageRef}
      className={cn(
        'relative h-full w-full overflow-hidden',
        interactive ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none',
      )}
      onWheel={handleCanvasWheel}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerEnd}
      onPointerCancel={handleCanvasPointerEnd}
    >
      <StageBackground accent="emerald" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(255,255,255,0.3)_62%,rgba(255,255,255,0.5))] dark:bg-[radial-gradient(circle_at_center,rgba(2,6,23,0.04),rgba(2,6,23,0.14)_62%,rgba(2,6,23,0.24))]" />
      <div
        className="absolute inset-0"
        style={{
          transform: `translate3d(${canvasOffset.x}px, ${canvasOffset.y}px, 0) scale(${zoom})`,
          transformOrigin: '0 0',
          transition: isAnimatingCamera ? `transform ${CAREER_MAP_CAMERA_DURATION_MS}ms ${CAREER_MAP_CAMERA_EASING}` : undefined,
          willChange: isAnimatingCamera ? 'transform' : undefined,
        }}
      >
        <div className="absolute inset-0">
          <svg
            className="pointer-events-none absolute left-0 top-0"
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          >
            <path
              d={buildWorkflowCurve(startAnchorPoint.x, startAnchorPoint.y, treeJunctionPoint.x, treeJunctionPoint.y, 0.42)}
              fill="none"
              stroke="rgba(15,23,42,0.18)"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <motion.path
              d={buildWorkflowCurve(startAnchorPoint.x, startAnchorPoint.y, treeJunctionPoint.x, treeJunctionPoint.y, 0.42)}
              fill="none"
              stroke="rgba(255,255,255,0.68)"
              strokeWidth="1"
              strokeDasharray="7 12"
              opacity="0.22"
              strokeLinecap="round"
              animate={{ strokeDashoffset: [0, -19] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
            />
            {visibleNodes.map((node) => {
              const tone = toneClasses[node.tone];
              const active = selectedPathId === node.id;
              const startX = treeJunctionPoint.x;
              const endX = node.x - 40;
              const laneY = Number((node as any).laneY ?? node.y);
              const railX = Number((node as any).railX ?? treeJunctionPoint.x + 96);
              const guidePath = buildWorkflowRailPath(startX, treeJunctionPoint.y, railX, laneY, endX, node.y);
              return (
                <g key={`tree-line-${node.id}`}>
                  <path
                    d={guidePath}
                    fill="none"
                    stroke={tone.line}
                    strokeWidth={active ? '2.35' : '1.55'}
                    opacity={active ? '0.7' : '0.22'}
                    strokeLinecap="round"
                  />
                  <motion.path
                    d={guidePath}
                    fill="none"
                    stroke="rgba(255,255,255,0.72)"
                    strokeWidth="1"
                    strokeDasharray="6 11"
                    opacity={active ? '0.3' : '0.08'}
                    strokeLinecap="round"
                    animate={{ strokeDashoffset: active ? [0, -16] : [0, -10] }}
                    transition={{ duration: active ? 1.5 : 2.4, repeat: Infinity, ease: 'linear' }}
                  />
                </g>
              );
            })}
            {activeNode && visibleBranchRoles.map((role) => {
              const tone = toneClasses[activeNode.tone];
              const startX = activeNode.x + 58;
              const endX = role.x - 22;
              const branchPath = buildWorkflowCurve(startX, activeNode.y, endX, role.y, 0.3);
              return (
                <g key={`branch-line-${role.id}`}>
                  <path
                    d={branchPath}
                    fill="none"
                    stroke={tone.line}
                    strokeWidth="1.7"
                    opacity="0.34"
                    strokeLinecap="round"
                  />
                  <motion.path
                    d={branchPath}
                    fill="none"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth="1"
                    strokeDasharray="6 10"
                    opacity="0.18"
                    strokeLinecap="round"
                    animate={{ strokeDashoffset: [0, -12] }}
                    transition={{ duration: 1.7, repeat: Infinity, ease: 'linear' }}
                  />
                </g>
              );
            })}
            <circle
              cx={treeJunctionPoint.x}
              cy={treeJunctionPoint.y}
              r="4"
              fill="rgba(255,255,255,0.92)"
              stroke="rgba(15,23,42,0.14)"
              strokeWidth="1.5"
            />
          </svg>

          <div className="absolute z-20" style={{ left: startCardPosition.x, top: startCardPosition.y }}>
            {isGuest ? (
              <button
                type="button"
                data-map-control="true"
                onClick={() => void onOpenAuth('register')}
                className="rounded-full border border-white/70 bg-white/88 px-5 py-3 text-sm font-semibold text-cyan-700 shadow-[0_18px_40px_-26px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/90 dark:text-cyan-200"
              >
                {stageCopy.guestCta}
              </button>
            ) : (
              <div className="flex items-center gap-3 rounded-[22px] border border-white/70 bg-white/84 px-4 py-3 shadow-[0_18px_44px_-34px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/88">
                <div className="relative flex h-[58px] w-[58px] items-center justify-center rounded-full border border-emerald-200 bg-white shadow-sm dark:border-cyan-500/30 dark:bg-slate-950/92">
                  <div className="absolute inset-2 rounded-full bg-gradient-to-br from-emerald-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900" />
                  <div className="relative z-10 h-[42px] w-[42px] overflow-hidden rounded-full border-2 border-white dark:border-slate-800">
                    <NodeImage src={userProfilePhoto} alt={userLabel} fallback={initials(userLabel)} className="h-full w-full object-cover" />
                  </div>
                </div>
                <div className="min-w-[220px] max-w-[320px]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                    {stageCopy.startLabel}
                  </div>
                  <div className="mt-1 text-[14px] font-bold text-slate-900 dark:text-slate-100">{userLabel}</div>
                  <div className="mt-1 text-[12px] leading-5 text-cyan-700 dark:text-cyan-300">
                    {stageCopy.startFallback}
                  </div>
                </div>
              </div>
            )}
          </div>

          {visibleNodes.map((node) => {
            const active = selectedPathId === node.id;
            const deemphasized = Boolean(selectedPathId) && selectedPathId !== node.id && visibleBranchRoles.length > 0;
            return (
              <div key={node.id} className="absolute z-20" style={{ left: Math.round(node.x), top: Math.round(node.y), transform: 'translate(-50%, -50%)' }}>
                <div className="relative">
                  <div className={cn('flex flex-col items-center transition-opacity', deemphasized ? 'opacity-45' : 'opacity-100')}>
                    <button
                      type="button"
                      onPointerDown={(event) => beginNodeDrag(event, node.nodeKey)}
                      onClick={() => onNodeClick(node)}
                      className="group flex flex-col items-center"
                      disabled={!interactive}
                    >
                      <div className={cn(
                        'relative h-[88px] w-[88px] rounded-[34px] border border-white/85 bg-white/98 p-[6px] shadow-[0_24px_44px_-20px_rgba(15,23,42,0.34)] backdrop-blur-xl transition-transform duration-200 dark:border-slate-700/80 dark:bg-slate-950/92',
                        active ? 'scale-[1.04] ring-2 ring-cyan-300 shadow-[0_24px_44px_-22px_rgba(8,145,178,0.34)] dark:ring-cyan-400/60' : 'group-hover:scale-[1.03] group-hover:shadow-[0_22px_40px_-22px_rgba(15,23,42,0.26)]',
                      )}>
                        <DirectionNodeMedia
                          directionKey={node.domainKey}
                          icon={node.directionIcon}
                          title={node.title}
                          className="h-full w-full"
                        />
                      </div>
                      <div className="mt-2.5 max-w-[196px] rounded-[18px] border border-white/60 bg-white/68 px-3 py-2 text-center shadow-[0_12px_28px_-24px_rgba(15,23,42,0.24)] backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-950/72">
                        <div className="text-[14px] font-semibold leading-[1.15] text-slate-900 dark:text-slate-100">{node.title}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
                          {node.roleNodes.length} {stageCopy.rolesShort}
                        </div>
                        <div className="mt-1.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                          {compactText(node.preview || node.summary, 56)}
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      data-map-control="true"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemapDirection(node.slotId, node.id);
                      }}
                      className="hidden"
                      title={t('careeros.map.remap_direction_node', { defaultValue: 'Přemapovat směr' })}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {visibleBranchRoles.map((role) => (
            <div key={role.id} className="absolute z-20" style={{ left: Math.round(role.x), top: Math.round(role.y), transform: 'translate(-50%, -50%)' }}>
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  onPointerDown={(event) => beginNodeDrag(event, role.nodeKey)}
                  onClick={() => onClusterRoleClick(role)}
                  className="text-left"
                  disabled={!interactive}
                >
                  <RolePreviewPill
                    title={role.title}
                    count={role.offerCount}
                    directionKey={role.directionKey}
                    active={activeBranchRoleId === role.id}
                  />
                </button>
                <button
                  type="button"
                  data-map-control="true"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemapRole(role.slotId, role.id);
                  }}
                  className="hidden"
                  title={t('careeros.map.remap_role_node', { defaultValue: 'Přemapovat roli' })}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute right-5 top-10 z-[36] min-w-[214px] max-w-[214px] rounded-[22px] border border-white/70 bg-white/78 px-4 py-4 text-left shadow-[0_16px_42px_-38px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-cyan-500/20 dark:bg-slate-950/84 dark:shadow-[0_18px_42px_-30px_rgba(2,6,23,0.74)] xl:right-6">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
          {stageCopy.statsTitle}
        </div>
        <div className="mt-3 rounded-[20px] border border-slate-200/70 bg-white/76 px-3.5 py-3 dark:border-slate-700/80 dark:bg-slate-900/94">
          <div className="text-[20px] font-bold leading-none text-slate-900 dark:text-slate-100">{formattedJobsCount}</div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
            {stageCopy.jobsLabel}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-300">
            {stageCopy.jobsBody}
          </div>
          <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-left dark:bg-slate-900/80">
            <div className="text-[18px] font-bold leading-none text-slate-900 dark:text-slate-100">{formattedActiveCandidates}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              {stageCopy.onlineLabel}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-300">
              {stageCopy.onlineBody}
            </div>
          </div>
          <button
            type="button"
            data-map-control="true"
            onClick={onResetLayout}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan-200 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {stageCopy.reset}
          </button>
        </div>
      </div>

      <GalaxyCanvasControls zoom={zoom} setZoom={setZoom} className="absolute bottom-6 left-6 z-[32] w-auto" />

      {isGuest ? (
        <div className="absolute bottom-8 left-[310px] z-[34] max-w-[280px] rounded-[24px] border border-white/70 bg-white/92 px-5 py-4 shadow-[0_22px_56px_-34px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/92">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
            {stageCopy.guestTitle}
          </div>
          <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {stageCopy.guestBody}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const CareerPathSetupState: React.FC<{
  isGuest: boolean;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
}> = ({ isGuest, onOpenAuth, onOpenProfile }) => {
  const { t } = useTranslation();

  return (
    <div className="relative h-full w-full overflow-hidden">
      <StageBackground accent="emerald" />
      <div className="absolute inset-0 flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-2xl rounded-[32px] border border-white/70 bg-white/90 p-6 text-center shadow-[0_32px_90px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-950/88 dark:shadow-[0_36px_96px_-44px_rgba(2,6,23,0.72)] sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cyan-50 text-cyan-600 shadow-sm dark:bg-cyan-950/50 dark:text-cyan-300">
            <Bot className="h-7 w-7" />
          </div>
          <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
            {t('careeros.map.setup_badge', { defaultValue: 'Rozvojová cesta' })}
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {isGuest
              ? t('careeros.map.guest_locked_title', { defaultValue: 'Aby rozvojová cesta dávala smysl, potřebujeme nejdřív váš profil' })
              : t('careeros.map.profile_locked_title', { defaultValue: 'Doplňte profil a my pak připravíme smysluplnou rozvojovou cestu' })}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-[15px]">
            {isGuest
              ? t('careeros.map.guest_locked_body', { defaultValue: 'Bez přihlášení a vyplněného profilu bychom jen hádali podle obecných nabídek. Přihlaste se, doplňte pár informací o sobě a pak vám ukážeme směry, které budou vycházet z vašich zkušeností, preferencí a cílů.' })
              : t('careeros.map.profile_locked_body', { defaultValue: 'Zatím nemáme dost podkladů, abychom vám ukázali relevantní směry. Stačí doplnit cílovou roli, obor nebo pár zkušeností a systém bude mít z čeho vycházet.' })}
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={isGuest ? onOpenAuth : onOpenProfile}
              className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-500"
            >
              {isGuest
                ? t('careeros.map.guest_locked_cta', { defaultValue: 'Přihlásit se a začít' })
                : t('careeros.map.profile_locked_cta', { defaultValue: 'Doplnit profil' })}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const navigationStepIcon = (kind: string) => {
  if (kind === 'learning_step' || kind === 'skill_gap') return BookOpen;
  if (kind === 'proof_step') return Sparkles;
  if (kind === 'bridge_role') return TrendingUp;
  if (kind === 'offer_activation') return Briefcase;
  if (kind === 'profile_fill' || kind === 'intent_clarify') return Bot;
  return CheckCircle2;
};

const navigationFrictionClasses: Record<string, string> = {
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-300',
  medium: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-300',
  high: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/25 dark:text-rose-300',
};

const NavigationPanel: React.FC<{
  route: CareerNavigationRoute | null;
  visible: boolean;
  resolving: boolean;
  onClose: () => void;
  onEditGoal: () => void;
  onOpenStep: (stepId: string) => void;
  onSelectAlternative: (alternative: CareerNavigationGoalAlternative) => void;
}> = ({ route, visible, resolving, onClose, onEditGoal, onOpenStep, onSelectAlternative }) => {
  const { i18n } = useTranslation();
  const navigationCopy = useMemo(() => getNavigationUiCopy(i18n.resolvedLanguage || i18n.language || 'en'), [i18n.language, i18n.resolvedLanguage]);
  return (
    <AnimatePresence>
      {route && visible ? (
        <motion.aside
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}
          className={cn(shellPanel, 'absolute bottom-6 right-6 top-6 z-[66] hidden w-[380px] overflow-hidden rounded-[28px] xl:block')}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-5 pb-4 pt-5 dark:border-slate-800/80">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{navigationCopy.badge}</span>
                </div>
                <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-800 dark:text-slate-100">{route.destinationLabel}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{route.summary}</div>
              </div>
              <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-slate-200 bg-white/92 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/76">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{navigationCopy.eta}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{route.etaLabel}</div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-white/92 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/76">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{navigationCopy.confidence}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{route.confidence}%</div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-white/92 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/76">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{navigationCopy.steps}</div>
                  <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{route.steps.length}</div>
                </div>
              </div>

              {resolving ? (
                <div className="mt-4 rounded-[20px] border border-cyan-100 bg-cyan-50/90 px-4 py-3 text-sm text-cyan-700 dark:border-cyan-900/40 dark:bg-cyan-950/24 dark:text-cyan-200">
                  {navigationCopy.resolving}
                </div>
              ) : null}

              {route.goal.alternatives.length > 0 && route.goal.status !== 'resolved' ? (
                <div className="mt-5 rounded-[24px] border border-slate-200 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/76">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {navigationCopy.alternatives}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {route.goal.alternatives.map((alternative) => (
                      <button
                        key={alternative.id}
                        type="button"
                        onClick={() => onSelectAlternative(alternative)}
                        className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-900/40 dark:bg-cyan-950/24 dark:text-cyan-200 dark:hover:bg-cyan-950/34"
                      >
                        {alternative.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {route.likelyFrictions.length > 0 ? (
                <div className="mt-5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {navigationCopy.friction}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {route.likelyFrictions.map((item) => (
                      <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/76 dark:text-slate-200">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {route.missingSignalHint ? (
                <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-200">
                  {route.missingSignalHint}
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                {route.steps.map((step, index) => {
                  const Icon = navigationStepIcon(step.kind);
                  return (
                    <div key={step.id} className="rounded-[24px] border border-slate-200 bg-white/92 p-4 dark:border-slate-800 dark:bg-slate-900/78">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/30 dark:text-cyan-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{index + 1}. {step.title}</div>
                            <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]', navigationFrictionClasses[step.friction])}>
                              {step.friction}
                            </span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.body}</p>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {step.etaLabel} • {step.confidence}%
                            </div>
                            <button
                              type="button"
                              onClick={() => onOpenStep(step.id)}
                              className="inline-flex items-center gap-1 rounded-full bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white"
                            >
                              {step.ctaLabel}
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-slate-800/80">
              <button
                type="button"
                onClick={onEditGoal}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200"
              >
                {navigationCopy.editGoal}
              </button>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
};

const LearningPathView: React.FC<{
  analysis: LearningGapAnalysis;
  onOpenProfile: () => void;
}> = ({ analysis, onOpenProfile }) => {
  const { t } = useTranslation();
  return (
  <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-[1720px] px-4 py-10 lg:pl-[280px] lg:pr-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{t('careeros.learning.title', { defaultValue: 'Skills Gap Analysis' })}</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {t('careeros.learning.comparing', { defaultValue: 'Comparing your current profile ({{role}}) with', role: analysis.currentRole })} <span className="font-semibold text-cyan-600 dark:text-cyan-300">{analysis.targetRole}</span>.
        </p>
      </div>

      <div className={cn(shellPanel, 'mb-8 rounded-[26px] p-6')}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{t('careeros.learning.intent_title', { defaultValue: 'Current direction' })}</div>
            <div className="mt-2 text-xl font-semibold text-slate-800 dark:text-slate-100">{analysis.intentSummary}</div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {analysis.intentReady
                ? t('careeros.learning.intent_ready_body', { defaultValue: 'This path now follows your profile intent first and only falls back to the selected map path when your profile direction is still missing.' })
                : t('careeros.learning.intent_missing_body', { defaultValue: 'Set a primary domain or target role in profile so the learning path stops guessing and starts following your real direction.' })}
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenProfile}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white"
          >
            {t('careeros.learning.edit_direction', { defaultValue: 'Edit direction in profile' })}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(280px,1fr)_120px_minmax(280px,1fr)] lg:items-center">
        <div className={cn(shellPanel, 'rounded-[26px] p-6')}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{t('careeros.learning.current_skills', { defaultValue: 'Current Skills' })}</div>
          <div className="mt-5 space-y-4">
            {analysis.currentSkills.length > 0 ? analysis.currentSkills.map((skill) => (
              <div key={skill} className="flex items-center justify-between gap-4">
                <span className="text-lg font-medium text-slate-800 dark:text-slate-100">{skill}</span>
                <CheckCircle2 className="h-5 w-5 text-cyan-500" />
              </div>
            )) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">{t('careeros.learning.add_skills_hint', { defaultValue: 'Add your current skills in the profile to improve matching.' })}</div>
            )}
          </div>
        </div>

        <div className="hidden h-full items-center justify-center lg:flex">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white text-cyan-600 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-cyan-300">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        <div className={cn(shellPanel, 'rounded-[26px] p-6')}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{t('careeros.learning.target_skills', { defaultValue: 'Target Skills' })}</div>
          <div className="mt-5 space-y-4">
            {analysis.targetSkills.length > 0 ? analysis.targetSkills.map((skill) => {
              const missing = analysis.missingSkills.some((item) => normalizeSkillKey(item) === normalizeSkillKey(skill));
              return (
                <div key={skill} className="flex items-center justify-between gap-4">
                  <span className={cn('text-lg font-medium dark:text-slate-100', missing ? 'text-orange-600 dark:text-orange-300' : 'text-slate-800')}>{skill}</span>
                  {missing ? <span className="text-lg font-semibold text-orange-400 dark:text-orange-300">-</span> : <CheckCircle2 className="h-5 w-5 text-cyan-500 dark:text-cyan-300" />}
                </div>
              );
            }) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">{t('careeros.learning.target_skills_hint', { defaultValue: 'Target role skills will appear as soon as challenge requirements are available.' })}</div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-3 text-3xl font-bold tracking-[-0.04em] text-slate-800 dark:text-slate-100">{t('careeros.learning.marketplace_title', { defaultValue: 'Recommended Learning Marketplace' })}</div>
      <p className="mb-6 max-w-3xl text-base text-slate-500 dark:text-slate-400">
        {t('careeros.learning.marketplace_body', { defaultValue: 'This marketplace now only shows real learning resources. If there is no provider data for your path yet, it will say that honestly instead of fabricating courses.' })}
      </p>
      {analysis.resourceState === 'loading' ? (
        <div className={cn(shellPanel, 'rounded-[28px] p-6 text-sm text-slate-500 dark:text-slate-400')}>
          {t('careeros.learning.loading_resources', { defaultValue: 'Loading real learning resources for this direction...' })}
        </div>
      ) : null}
      {analysis.resourceState !== 'loading' && analysis.resourceEmptyTitle ? (
        <div className={cn(shellPanel, 'rounded-[28px] p-6')}>
          <div className="text-xl font-semibold text-slate-800 dark:text-slate-100">{analysis.resourceEmptyTitle}</div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{analysis.resourceEmptyBody}</p>
        </div>
      ) : null}
      {analysis.resources.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-3">
          {analysis.resources.map((resource) => (
            <div key={resource.id} className={cn(shellPanel, 'rounded-[28px] p-6')}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-cyan-600 dark:bg-slate-900/80 dark:text-cyan-300">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">{resource.provider}</div>
                </div>
                <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300">
                  {t('careeros.learning.match', { defaultValue: '{{count}}% Match', count: resource.match })}
                </span>
              </div>
              <div className="mt-5 text-2xl font-bold tracking-[-0.03em] text-slate-800 dark:text-slate-100">{resource.title}</div>
              <div className="mt-2 text-base text-slate-500 dark:text-slate-400">
                {resource.matchedSkills.length > 0
                  ? t('careeros.learning.missing_for_skills', { defaultValue: 'Useful for {{skills}}', skills: resource.matchedSkills.join(', ') })
                  : t('careeros.learning.missing_for_role', { defaultValue: 'Useful for the next move into {{role}}', role: analysis.targetRole })}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/72">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t('careeros.learning.format_label', { defaultValue: 'Format' })}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{resource.formatLabel}</div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/72">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t('careeros.learning.level_label', { defaultValue: 'Level' })}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{resource.levelLabel}</div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/72">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{t('careeros.learning.price_label', { defaultValue: 'Price' })}</div>
                  <div className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{resource.priceLabel}</div>
                </div>
              </div>
              <div className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">{resource.reason}</div>
              <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3 text-sm text-cyan-800 dark:border-cyan-900/50 dark:bg-cyan-950/26 dark:text-cyan-200">
                {resource.marketplaceNote}
              </div>
              <div className="mt-5 flex items-center justify-between gap-4 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-slate-400 dark:text-slate-500">{resource.duration}</span>
                  {resource.rating > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
                      <Star className="h-3.5 w-3.5 fill-current text-amber-400" />
                      {resource.rating.toFixed(1)}
                    </span>
                  ) : null}
                  {resource.reviewCount > 0 ? (
                    <span className="text-slate-400 dark:text-slate-500">{t('careeros.learning.reviews', { defaultValue: '{{count}} reviews', count: resource.reviewCount })}</span>
                  ) : null}
                </div>
                {resource.url ? (
                  <a href={resource.url} target="_blank" rel="noreferrer" className="font-semibold text-cyan-600 dark:text-cyan-300">
                    {t('careeros.learning.open_provider', { defaultValue: 'Open provider' })}
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  </div>
  );
};

const marketMetricToneClasses: Record<MarketTrendMetric['tone'], string> = {
  emerald: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-300',
};

const MarketTrendsView: React.FC<{
  analysis: MarketTrendAnalysis;
  onOpenLearningPath: () => void;
}> = ({ analysis, onOpenLearningPath }) => {
  const { t } = useTranslation();
  return (
  <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-[1640px] px-4 py-10 lg:pl-[280px] lg:pr-8">
      <div className="mb-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">{t('careeros.market.title', { defaultValue: 'Market Trends' })}</div>
        <h1 className="mt-2 text-3xl font-bold text-slate-800 dark:text-slate-100">{t('careeros.market.live_pulse', { defaultValue: 'Live market pulse for {{scope}}', scope: analysis.scopeTitle })}</h1>
        <p className="mt-3 max-w-4xl text-slate-500 dark:text-slate-400">{analysis.summary}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {analysis.metrics.map((metric) => (
          <div key={metric.label} className={cn(shellPanel, 'rounded-[24px] p-6')}>
            <div className={cn('inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]', marketMetricToneClasses[metric.tone])}>
              {metric.label}
            </div>
            <div className="mt-5 text-3xl font-bold tracking-[-0.04em] text-slate-800 dark:text-slate-100">{metric.value}</div>
            <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{metric.detail}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 2xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]">
        <div className="space-y-6">
          <div className={cn(shellPanel, 'rounded-[28px] p-6')}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/36 dark:text-sky-300">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{t('careeros.market.demanding_skills', { defaultValue: 'Demanding Skills' })}</div>
                <div className="mt-1 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('careeros.market.demanding_skills_title', { defaultValue: 'What keeps showing up in the market' })}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {analysis.topSkills.length > 0 ? analysis.topSkills.map((skill) => (
                <div key={skill.label} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/72">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{skill.label}</div>
                  <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{t('careeros.market.appears_in_roles', { defaultValue: 'Appears in {{count}} active roles', count: skill.count })}</div>
              </div>
            )) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">{t('careeros.market.skill_demand_hint', { defaultValue: 'Skill demand will appear as soon as current roles publish structured requirements.' })}</div>
              )}
            </div>
          </div>

          <div className={cn(shellPanel, 'rounded-[28px] p-6')}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{t('careeros.market.interpretation', { defaultValue: 'Interpretation' })}</div>
            <div className="mt-2 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('careeros.market.interpretation_title', { defaultValue: 'How to read the signal' })}</div>
            <div className="mt-5 space-y-4">
              {analysis.narratives.map((item) => (
                <div key={item.title} className="rounded-[22px] border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-900/76">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={cn(shellPanel, 'rounded-[28px] p-6')}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/36 dark:text-cyan-300">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{t('careeros.market.ai_impact', { defaultValue: 'AI Impact' })}</div>
                <div className="mt-1 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('careeros.market.ai_impact_title', { defaultValue: 'How AI is changing this direction' })}</div>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {analysis.aiSignals.map((signal) => (
                <div key={signal.title} className="rounded-[22px] border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-900/76">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{signal.title}</div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-cyan-600 dark:bg-slate-950/80 dark:text-cyan-300">{signal.value}</div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{signal.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={cn(shellPanel, 'rounded-[28px] p-6')}>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-950/24 dark:text-orange-300">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{t('careeros.market.suggested_move', { defaultValue: 'Suggested Move' })}</div>
                <div className="mt-1 text-xl font-semibold text-slate-800 dark:text-slate-100">{t('careeros.market.suggested_move_title', { defaultValue: 'Translate the signal into action' })}</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {t('careeros.market.suggested_move_body', { defaultValue: 'Move from market reading to execution by using the strongest missing skills as your immediate learning queue, then open handshakes in the clusters with the strongest demand momentum.' })}
            </p>
            <button
              type="button"
              onClick={onOpenLearningPath}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {t('careeros.learning.open_learning_path', { defaultValue: 'Open Learning Path' })}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

const MiniChallengesView: React.FC<{
  cards: Array<{
    id: string;
    title: string;
    company: string;
    duration: string;
    scope: string;
    reward: string;
    summary: string;
    action: 'open_challenge' | 'manage_profile_challenge';
  }>;
  onOpenChallenge: (id: string) => void;
  onOpenProfile: () => void;
}> = ({ cards, onOpenChallenge, onOpenProfile }) => {
  const { t } = useTranslation();
  return (
  <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-[1640px] px-4 py-10 lg:pl-[280px] lg:pr-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">{t('careeros.mini.title', { defaultValue: 'Mini Challenges' })}</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">{t('careeros.mini.subtitle', { defaultValue: 'One-off collaborations, short helping hands or weekend gigs where both sides can quickly see if it clicks.' })}</p>
      </div>
      {cards.length === 0 ? (
        <div className={cn(shellPanel, 'rounded-[24px] p-6')}>
          <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{t('careeros.mini.empty_title', { defaultValue: 'No real mini challenges in this feed yet' })}</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {t('careeros.mini.empty_body', { defaultValue: 'This section now shows only true micro collaborations or clearly project-scoped opportunities, so standard remote jobs no longer leak in here.' })}
          </p>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                try {
                  window.sessionStorage.setItem(PROFILE_INITIAL_TAB_STORAGE_KEY, 'challenges');
                } catch {
                  // Ignore storage issues and still open the profile.
                }
              }
              onOpenProfile();
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            {t('careeros.mini.open_profile_cta', { defaultValue: 'Zadat mini výzvu z profilu' })}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.id} className={cn(shellPanel, 'rounded-[24px] p-6')}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{card.title}</div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{card.company}</div>
              </div>
              <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300">{card.duration}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{card.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:!bg-slate-900 dark:!text-slate-100">
                {card.scope}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:!bg-slate-900 dark:!text-slate-100">
                {card.reward}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (card.action === 'manage_profile_challenge') {
                  if (typeof window !== 'undefined') {
                    try {
                      window.sessionStorage.setItem(PROFILE_INITIAL_TAB_STORAGE_KEY, 'challenges');
                    } catch {
                      // Ignore storage issues and still open the profile.
                    }
                  }
                  onOpenProfile();
                  return;
                }
                onOpenChallenge(card.id);
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {card.action === 'manage_profile_challenge'
                ? t('careeros.mini.manage_profile_cta', { defaultValue: 'Open mini challenge' })
                : t('careeros.mini.open_challenge', { defaultValue: 'Open challenge' })}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  </div>
  );
};

const CareerOSCandidateWorkspace: React.FC<CareerOSCandidateWorkspaceProps> = ({
  jobs,
  selectedJobId,
  savedJobIds,
  userProfile,
  hasNativeChallenges,
  lane,
  setLane,
  totalCount,
  isLoadingJobs,
  loadingMore,
  hasMore,
  currentPage,
  pageSize,
  remoteOnly,
  enableCommuteFilter,
  filterMinSalary,
  filterBenefits,
  filterMaxDistance,
  filterWorkArrangement,
  globalSearch,
  abroadOnly,
  filterContractType,
  filterExperience,
  filterLanguageCodes,
  discoveryMode,
  searchDiagnostics,
  searchTerm,
  setSearchTerm,
  filterCity,
  setFilterCity,
  performSearch,
  setRemoteOnly,
  setFilterWorkArrangement,
  setGlobalSearch,
  setAbroadOnly,
  setEnableCommuteFilter,
  setFilterMinSalary,
  setFilterBenefits,
  setFilterMaxDistance,
  setDiscoveryMode,
  setFilterContractType,
  setFilterExperience,
  setFilterLanguageCodes,
  handleJobSelect,
  handleToggleSave,
  loadMoreJobs,
  goToPage,
  onOpenProfile,
  onOpenAuth,
  onOpenCompaniesLanding,
  homeResetToken = 0,
  initialNavigationState,
  onNavigationStateChange,
}) => {
  const initialSelectedPathId = null;
  const initialExpandedPathId = null;
  const initialBranchRoleId = null;
  const initialActiveLayer: CareerOSLayer = 'marketplace';
  const initialCanvasZoom = Number.isFinite(initialNavigationState?.canvasZoom)
    ? Math.max(0.72, Math.min(1.4, Number(initialNavigationState?.canvasZoom)))
    : 1;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<CareerOSNotification[]>([]);
  const [profileMiniChallenges, setProfileMiniChallenges] = useState<Job[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [notificationsStorageHydrated, setNotificationsStorageHydrated] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [domainRemapOpen, setDomainRemapOpen] = useState(false);
  const [manualDomainSelection] = useState<string[]>([]);
  const [manualDomainQuery] = useState('');
  const [databaseJobCount, setDatabaseJobCount] = useState<number | null>(null);
  const [careerMapPoolJobs, setCareerMapPoolJobs] = useState<Job[] | null>(null);
  const [careerMapPoolMeta, setCareerMapPoolMeta] = useState<{
    scope: 'domestic' | 'all';
    country_code?: string | null;
    base_pool_count: number;
    filtered_count: number;
    generated_at?: string | null;
    cache_age_seconds?: number | null;
    database_total_count: number;
  } | null>(null);
  const [liveCandidateDelta, setLiveCandidateDelta] = useState(0);
  const [learningResources, setLearningResources] = useState<LearningResource[]>([]);
  const [learningResourcesLoading, setLearningResourcesLoading] = useState(false);
  const [navigationComposerOpen, setNavigationComposerOpen] = useState(false);
  const [navigationGoalInput, setNavigationGoalInput] = useState('');
  const [navigationUseMarketPreferences, setNavigationUseMarketPreferences] = useState(true);
  const [navigationRoute, setNavigationRoute] = useState<CareerNavigationRoute | null>(null);
  const [navigationResolving, setNavigationResolving] = useState(false);
  const [careerMapNodePositions, setCareerMapNodePositions] = useState<Record<string, CareerMapNodeOffset>>(
    () => sanitizeCareerMapNodeOffsets(userProfile.preferences?.careerMapLayout?.positions),
  );
  const [careerMapBranchOverrides, setCareerMapBranchOverrides] = useState<CareerMapBranchOverrides>(
    () => userProfile.preferences?.careerMapLayout?.branchOverrides || createEmptyBranchOverrides(),
  );
  const deferredJobs = useDeferredValue(jobs);
  const { t, i18n } = useTranslation();
  const activeLocale = String(i18n.resolvedLanguage || i18n.language || userProfile.preferredLocale || 'en');
  const navigationUiCopy = useMemo(() => getNavigationUiCopy(activeLocale), [activeLocale]);
  const careerMapCountryCode = useMemo(
    () => resolveCareerMapCountryCode(userProfile, activeLocale),
    [activeLocale, userProfile],
  );
  const careerMapPoolScope: 'domestic' | 'all' = globalSearch || abroadOnly ? 'all' : 'domestic';
  const careerMapBenefitsKey = useMemo(() => filterBenefits.join('|'), [filterBenefits]);
  const careerMapContractTypesKey = useMemo(() => filterContractType.join('|'), [filterContractType]);
  const careerMapCommuteLat = userProfile.coordinates?.lat;
  const careerMapCommuteLng = userProfile.coordinates?.lon;
  const effectiveCareerMapJobs = careerMapPoolJobs ?? deferredJobs;
  const careerMapSourceJobs = useMemo(() => buildCareerMapSourceJobs(effectiveCareerMapJobs), [effectiveCareerMapJobs]);

  const workspace = useMemo(
    () =>
      measureSyncPerf('careeros:workspace-map', () => mapJobsToCareerOSCandidateWorkspace({
        jobs: careerMapSourceJobs,
        userProfile,
        savedJobIds,
        selectedJobId,
        remoteOnly,
        enableCommuteFilter,
        filterMinSalary,
        filterBenefits,
        discoveryMode,
        totalCount,
        searchDiagnostics,
      })),
    [
      careerMapSourceJobs,
      userProfile,
      savedJobIds,
      selectedJobId,
      remoteOnly,
      enableCommuteFilter,
      filterMinSalary,
      filterBenefits,
      discoveryMode,
      totalCount,
      searchDiagnostics,
    ],
  );

  const [activeLayer, setActiveLayer] = useState<CareerOSLayer>(initialActiveLayer);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(initialSelectedPathId);
  const [expandedPathId, setExpandedPathId] = useState<string | null>(initialExpandedPathId);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(initialBranchRoleId);
  const [panelChallenge, setPanelChallenge] = useState<CareerOSChallenge | null>(() => {
    const initialPanelChallengeId = initialNavigationState?.panelChallengeId;
    if (!initialPanelChallengeId) return null;
    return workspace.challenges.find((challenge) => challenge.id === initialPanelChallengeId) || null;
  });
  const [panelDismissed, setPanelDismissed] = useState<boolean>(initialNavigationState?.panelDismissed ?? true);
  const [canvasZoom, setCanvasZoom] = useState(initialCanvasZoom);
  const shouldLoadCareerMapPool = activeLayer === 'career_path' || activeLayer === 'job_offers';
  const dbCountCacheKey = 'jobshaman:workspace:global-job-count';
  const learningPathRequiresSetup = !hasCareerPathProfileSignal(userProfile);
  const isGuestCareerPath = !userProfile.isLoggedIn;
  const shouldLoadDatabaseCount = activeLayer === 'career_path' || activeLayer === 'job_offers';
  const shouldLoadLearningResources = activeLayer === 'learning_path';
  const shouldLoadProfileMiniChallenges = userProfile.isLoggedIn;
  const shouldLoadNotifications = notificationsOpen;
  const shouldPrefetchMoreCareerMapJobs =
    activeLayer === 'career_path'
    && !careerMapPoolJobs
    && !expandedPathId
    && jobs.length < 360
    && hasMore
    && !loadingMore
    && !isLoadingJobs;

  const allPathNodes = useMemo(
    () => measureSyncPerf(
      'careeros:path-nodes',
      () => buildPathNodes(careerMapSourceJobs, workspace.challenges, userProfile, t, manualDomainSelection, manualDomainQuery),
    ),
    [careerMapSourceJobs, manualDomainQuery, manualDomainSelection, t, workspace.challenges, userProfile],
  );
  const pathNodes = useMemo<PositionedPathNode[]>(() => {
    const usedIds = new Set<string>();
    const mapped = TREE_DIRECTION_SLOTS
      .map((slot) => {
        const overrideId = careerMapBranchOverrides.directionSlots?.[slot.id];
        const candidate = allPathNodes.find((node) => node.id === overrideId && !usedIds.has(node.id))
          || allPathNodes.find((node) => !usedIds.has(node.id));
        if (!candidate) return null;
        usedIds.add(candidate.id);
        return {
          ...candidate,
          slotId: slot.id,
          nodeKey: getDirectionPositionKey(candidate.id),
          baseX: slot.x,
          baseY: slot.y,
          x: slot.x,
          y: slot.y,
          distanceRank: slot.distanceRank,
        };
      });
    return mapped.filter((node): node is NonNullable<typeof node> => node !== null);
  }, [allPathNodes, careerMapBranchOverrides.directionSlots]);
  const challengeGraphSignature = useMemo(
    () => workspace.challenges.map((challenge) => challenge.id).join('|'),
    [workspace.challenges],
  );

  const selectedPath = useMemo(
    () => pathNodes.find((node) => node.id === selectedPathId) || pathNodes[0] || null,
    [pathNodes, selectedPathId],
  );
  const branchPath = useMemo(
    () => pathNodes.find((node) => node.id === expandedPathId) || null,
    [expandedPathId, pathNodes],
  );
  const branchRoles = useMemo<PositionedRoleNode[]>(() => {
    if (!branchPath) return [];
    const overrideSlots = careerMapBranchOverrides.roleSlots?.[branchPath.id] || {};
    const usedIds = new Set<string>();
    return TREE_ROLE_SLOT_OFFSETS
      .map((offset, index) => {
        const slotId = `role_${index + 1}`;
        const overrideId = overrideSlots[slotId];
        const candidate = branchPath.roleNodes.find((role) => role.id === overrideId && !usedIds.has(role.id))
          || branchPath.roleNodes.find((role) => !usedIds.has(role.id));
        if (!candidate) return null;
        usedIds.add(candidate.id);
        return {
          ...candidate,
          slotId,
          pathId: branchPath.id,
          directionKey: branchPath.domainKey,
          nodeKey: getRolePositionKey(branchPath.id, candidate.id),
          baseX: branchPath.baseX + 340 + index * 24,
          baseY: branchPath.baseY + offset,
          offerCount: buildJobOfferLayerJobs(careerMapSourceJobs, branchPath, candidate).length,
        };
      })
      .filter((role): role is PositionedRoleNode => Boolean(role));
  }, [branchPath, careerMapBranchOverrides.roleSlots, careerMapSourceJobs]);
  const selectedRole = useMemo(
    () => branchRoles.find((role) => role.id === selectedRoleId) || branchRoles[0] || selectedPath?.roleNodes[0] || null,
    [branchRoles, selectedPath, selectedRoleId],
  );

  const benefitCandidates = useMemo(() => topFilterCandidates(careerMapSourceJobs), [careerMapSourceJobs]);
  const visibleJobsCount = Math.max(0, databaseJobCount ?? 0);
  const mappedPoolCount = careerMapPoolMeta?.filtered_count ?? careerMapSourceJobs.length;
  const formattedJobsCount = useMemo(
    () => (databaseJobCount === null ? '...' : new Intl.NumberFormat(activeLocale).format(visibleJobsCount)),
    [activeLocale, databaseJobCount, visibleJobsCount],
  );
  const formattedMappedPoolCount = useMemo(
    () => new Intl.NumberFormat(activeLocale).format(mappedPoolCount),
    [activeLocale, mappedPoolCount],
  );
  const simulatedActiveCandidates = useMemo(() => {
    const now = new Date();
    const daySeed = Number(
      `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`,
    );
    const base = 16 + (daySeed % 8);
    const trafficLift = Math.min(22, Math.floor(visibleJobsCount / 320));
    const hour = now.getHours();
    const hourAdjustment = hour >= 20
      ? -7
      : hour >= 18
        ? -4
        : hour >= 9 && hour <= 17
          ? 3
          : hour >= 6 && hour < 9
            ? 1
            : -2;
    const weekendAdjustment = now.getDay() === 0 || now.getDay() === 6 ? -3 : 0;
    return Math.max(8, base + trafficLift + hourAdjustment + weekendAdjustment);
  }, [visibleJobsCount]);
  const liveCandidatesNow = Math.max(6, simulatedActiveCandidates + liveCandidateDelta);
  const formattedActiveCandidates = useMemo(
    () => new Intl.NumberFormat(activeLocale).format(liveCandidatesNow),
    [activeLocale, liveCandidatesNow],
  );
  const availableDomains = useMemo(
    () => {
      const discovered = careerMapSourceJobs
        .map((job) => resolveJobDomain(job))
        .filter(Boolean)
        .map((domain) => String(domain));
      const preferred = [
        String(userProfile.preferences?.searchProfile?.primaryDomain || ''),
        ...(userProfile.preferences?.searchProfile?.secondaryDomains || []).map((domain) => String(domain || '')),
      ].filter(Boolean);

      const labelsByValue = new Map<string, string>();
      REMAP_PRIORITY_DOMAIN_OPTIONS.forEach((option) => {
        labelsByValue.set(option.value, option.label || getLocalizedDomainLabel(option.value, t));
      });
      [...preferred, ...discovered]
        .filter((domain) => domain && domain !== 'general')
        .forEach((domain) => {
          if (!labelsByValue.has(domain)) {
            labelsByValue.set(domain, getLocalizedDomainLabel(domain, t));
          }
        });

      const prioritized = REMAP_PRIORITY_DOMAIN_OPTIONS
        .map((option) => ({ value: option.value, label: labelsByValue.get(option.value) || option.label || getLocalizedDomainLabel(option.value, t) }));
      const remaining = Array.from(labelsByValue.entries())
        .filter(([value]) => !REMAP_PRIORITY_DOMAIN_OPTIONS.some((option) => option.value === value))
        .map(([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label, i18n.language || 'cs'));

      return [...prioritized, ...remaining];
    },
    [careerMapSourceJobs, t, i18n.language, userProfile.preferences?.searchProfile?.primaryDomain, userProfile.preferences?.searchProfile?.secondaryDomains],
  );
  const scopedMarketJobs = useMemo(() => {
    if (selectedPath?.challenges?.length) {
      const selectedIds = new Set(selectedPath.challenges.map((challenge) => challenge.id));
      const matching = careerMapSourceJobs.filter((job) => selectedIds.has(String(job.id)));
      if (matching.length > 0) return matching;
    }
    return careerMapSourceJobs.slice(0, 12);
  }, [careerMapSourceJobs, selectedPath]);
  const jobOfferLayerJobs = useMemo(
    () => buildJobOfferLayerJobs(careerMapSourceJobs, selectedPath, selectedRole),
    [careerMapSourceJobs, selectedPath, selectedRole],
  );
  const learningResourceSearchTerms = useMemo(
    () => {
      const searchProfile = userProfile.preferences?.searchProfile;
      const targetRole = String(searchProfile?.targetRole || userProfile.preferences?.desired_role || '').trim();
      const primaryDomain = String(searchProfile?.primaryDomain || searchProfile?.inferredPrimaryDomain || '').trim();
      const targetSource = selectedPath?.challenges?.length ? selectedPath.challenges : workspace.challenges.slice(0, 12);
      const targetSkills = uniqStrings(targetSource.flatMap((challenge) => challenge.requiredSkills).filter(Boolean)).slice(0, 6);
      const knownSkills = new Set(
        uniqStrings([
          ...(Array.isArray(userProfile.skills) ? userProfile.skills : []),
          ...(Array.isArray(userProfile.inferredSkills) ? userProfile.inferredSkills : []),
          ...(Array.isArray(userProfile.strengths) ? userProfile.strengths : []),
          ...(Array.isArray(userProfile.certifications) ? userProfile.certifications : []),
        ]).map(normalizeSkillKey),
      );
      const missingSkills = targetSkills.filter((skill) => !knownSkills.has(normalizeSkillKey(skill)));

      return uniqStrings([
        ...(missingSkills.length > 0 ? missingSkills : targetSkills),
        targetRole,
        primaryDomain ? getLocalizedDomainLabel(primaryDomain, t) : '',
      ].filter(Boolean)).slice(0, 6);
    },
    [selectedPath, t, userProfile.certifications, userProfile.inferredSkills, userProfile.preferences?.desired_role, userProfile.preferences?.searchProfile, userProfile.skills, userProfile.strengths, workspace.challenges],
  );

  useEffect(() => {
    if (!shouldLoadCareerMapPool) return;
    let cancelled = false;

    void getCareerMapPool({
      countryCode: careerMapPoolScope === 'domestic' ? careerMapCountryCode : undefined,
      scope: careerMapPoolScope,
      limit: 1400,
      userLat: enableCommuteFilter ? careerMapCommuteLat : undefined,
      userLng: enableCommuteFilter ? careerMapCommuteLng : undefined,
      radiusKm: enableCommuteFilter ? filterMaxDistance : undefined,
      remoteOnly,
      workArrangement: filterWorkArrangement,
      contractTypes: filterContractType,
      benefits: filterBenefits,
      minSalary: filterMinSalary || undefined,
    })
      .then((result) => {
        if (cancelled) return;
        setCareerMapPoolJobs(result.jobs);
        setCareerMapPoolMeta(result.meta);
        if (result.meta.database_total_count > 0) {
          setDatabaseJobCount((current) => current ?? result.meta.database_total_count);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCareerMapPoolJobs(null);
        setCareerMapPoolMeta(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    careerMapCommuteLat,
    careerMapCommuteLng,
    careerMapCountryCode,
    careerMapPoolScope,
    enableCommuteFilter,
    careerMapBenefitsKey,
    filterMaxDistance,
    filterMinSalary,
    filterWorkArrangement,
    careerMapContractTypesKey,
    remoteOnly,
    shouldLoadCareerMapPool,
  ]);

  useEffect(() => {
    if (!shouldLoadDatabaseCount) return;
    let cancelled = false;

    if (typeof window !== 'undefined') {
      try {
        const cached = window.sessionStorage.getItem(dbCountCacheKey);
        if (cached) {
          const parsed = Number(cached);
          if (Number.isFinite(parsed) && parsed >= 0) {
            setDatabaseJobCount(parsed);
          }
        }
      } catch {
        // Ignore storage issues and continue with live fetch.
      }
    }

    void getMainDatabaseJobCount()
      .then((count) => {
        if (cancelled || !Number.isFinite(count) || count < 0) return;
        setDatabaseJobCount(count);
        if (typeof window !== 'undefined') {
          try {
            window.sessionStorage.setItem(dbCountCacheKey, String(count));
          } catch {
            // Ignore storage issues.
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDatabaseJobCount((current) => current ?? 0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dbCountCacheKey, shouldLoadDatabaseCount]);

  useEffect(() => {
    if (!shouldPrefetchMoreCareerMapJobs) return;
    const timer = window.setTimeout(() => {
      loadMoreJobs();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [loadMoreJobs, shouldPrefetchMoreCareerMapJobs]);

  useEffect(() => {
    if (activeLayer !== 'career_path') return;
    const intervalMs = 45_000 + Math.floor(Math.random() * 20_000);
    const intervalId = window.setInterval(() => {
      setLiveCandidateDelta((current) => {
        const drift = Math.random() < 0.55 ? 1 : -1;
        const next = current + drift;
        if (next > 4) return 3;
        if (next < -4) return -3;
        return next;
      });
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeLayer]);

  useEffect(() => {
    if (!shouldLoadLearningResources) return;
    let cancelled = false;

    const loadLearningResources = async () => {
      const searchProfile = userProfile.preferences?.searchProfile;
      const hasIntent = Boolean(searchProfile?.primaryDomain || searchProfile?.inferredPrimaryDomain || searchProfile?.targetRole || userProfile.preferences?.desired_role);
      if (!hasIntent || learningResourceSearchTerms.length === 0) {
        setLearningResources([]);
        setLearningResourcesLoading(false);
        return;
      }

      setLearningResourcesLoading(true);
      try {
        const mergedQuery = Array.from(new Set(learningResourceSearchTerms.map((item) => item.trim()).filter(Boolean))).join(' | ');
        const resourceCollections = mergedQuery ? [
          await fetchLearningResources({
            skillName: mergedQuery,
            status: 'active',
          }),
        ] : [];
        const merged = Array.from(
          new Map(
            resourceCollections
              .flat()
              .filter(Boolean)
              .map((resource) => [resource.id, resource]),
          ).values(),
        );
        if (!cancelled) {
          setLearningResources(merged);
        }
      } catch (error) {
        console.warn('[CareerOS] Failed to load learning resources:', error);
        if (!cancelled) {
          setLearningResources([]);
        }
      } finally {
        if (!cancelled) {
          setLearningResourcesLoading(false);
        }
      }
    };

    void loadLearningResources();

    return () => {
      cancelled = true;
    };
  }, [learningResourceSearchTerms, shouldLoadLearningResources, userProfile.preferences?.desired_role, userProfile.preferences?.searchProfile]);

  const learningGapAnalysis = useMemo(
    () => buildLearningGapAnalysis(userProfile, selectedPath, workspace.challenges, learningResources, learningResourcesLoading, t),
    [learningResources, learningResourcesLoading, selectedPath, t, userProfile, workspace.challenges],
  );
  const marketTrendAnalysis = useMemo(
    () => buildMarketTrendAnalysis(scopedMarketJobs, selectedPath, userProfile, t),
    [scopedMarketJobs, selectedPath, t, userProfile],
  );
  const miniChallengeCards = useMemo(
    () => buildMiniChallengeCards(deferredJobs, profileMiniChallenges, userProfile, t),
    [deferredJobs, profileMiniChallenges, t, userProfile],
  );
  const navigationPathOptions = useMemo<CareerNavigationPathOption[]>(
    () =>
      pathNodes.map((node) => ({
        id: node.id,
        title: node.title,
        summary: node.summary,
        preview: node.preview,
        primaryDomain: (node.challenges.find((challenge) => challenge.matchedDomains?.[0])?.matchedDomains?.[0] || null) as CareerNavigationPathOption['primaryDomain'],
        challengeIds: node.challenges.map((challenge) => challenge.id),
        x: node.x,
        y: node.y,
        roleOptions: node.roleNodes.map((role) => ({
          id: role.id,
          title: role.title,
          challengeIds: role.challenges.map((challenge) => challenge.id),
        })),
        topSkills: uniqStrings(node.challenges.flatMap((challenge) => challenge.requiredSkills).filter(Boolean)).slice(0, 6),
      })),
    [pathNodes],
  );
  const navigationMiniChallenges = useMemo<CareerNavigationMiniChallengeOption[]>(
    () =>
      miniChallengeCards
        .filter((card) => card.action === 'open_challenge')
        .map((card) => ({
          id: card.id,
          title: card.title,
          summary: card.summary,
        })),
    [miniChallengeCards],
  );
  const navigationLearningSignal = useMemo(
    () => ({
      currentRole: learningGapAnalysis.currentRole,
      targetRole: learningGapAnalysis.targetRole,
      targetDomainLabel: learningGapAnalysis.targetDomainLabel,
      intentReady: learningGapAnalysis.intentReady,
      skillDataReady: learningGapAnalysis.skillDataReady,
      currentSkills: learningGapAnalysis.currentSkills,
      targetSkills: learningGapAnalysis.targetSkills,
      missingSkills: learningGapAnalysis.missingSkills,
      hasResourceMatches: learningGapAnalysis.resources.length > 0,
    }),
    [learningGapAnalysis],
  );
  const notificationStorageKey = useMemo(() => `careeros.notifications.read.${userProfile.id || 'guest'}`, [userProfile.id]);
  const notificationMatchCandidates = useMemo(
    () =>
      workspace.challenges.map((challenge) => ({
        id: challenge.id,
        title: challenge.title,
        company: challenge.company,
        score: challenge.jhiScore,
        location: challenge.location,
        salary: challenge.salary,
        isSaved: challenge.isSaved,
      })),
    [workspace.challenges],
  );
  const unreadNotificationCount = useMemo(
    () => notificationItems.filter((notification) => !readNotificationIds.includes(notification.id)).length,
    [notificationItems, readNotificationIds],
  );

  useEffect(() => {
    if (!DEBUG_CAREER_OS) return;
    console.log('[CareerOS] Workspace graph diagnostics:', {
      jobs: deferredJobs.length,
      workspaceChallenges: workspace.challenges.length,
      pathNodes: pathNodes.length,
      selectedPathId,
      selectedPathChallenges: selectedPath?.challenges.length || 0,
    });
  }, [deferredJobs.length, pathNodes.length, selectedPath?.challenges.length, selectedPathId, workspace.challenges.length]);

  useEffect(() => {
    markPerf('careeros:graph:end');
    measurePerf('careeros:graph', 'careeros:graph:start', 'careeros:graph:end');
  }, [activeLayer, expandedPathId, pathNodes, selectedPathId]);

  useEffect(() => {
    if (activeLayer === 'market_trends' && !MARKET_TRENDS_ENABLED) {
      setActiveLayer('marketplace');
    }
  }, [activeLayer]);

  useEffect(() => {
    setActiveLayer('marketplace');
    setExpandedPathId(null);
    setSelectedRoleId(null);
  }, [userProfile.id]);

  useEffect(() => {
    if (!homeResetToken) return;
    setActiveLayer('marketplace');
    setExpandedPathId(null);
    setSelectedRoleId(null);
    setPanelChallenge(null);
    setPanelDismissed(true);
  }, [homeResetToken]);

  useEffect(() => {
    setCareerMapNodePositions(sanitizeCareerMapNodeOffsets(userProfile.preferences?.careerMapLayout?.positions));
    setCareerMapBranchOverrides(userProfile.preferences?.careerMapLayout?.branchOverrides || createEmptyBranchOverrides());
  }, [userProfile.id]);

  useEffect(() => {
    if (!selectedPathId && pathNodes[0]) {
      setSelectedPathId(pathNodes[0].id);
      return;
    }
    if (selectedPathId && !pathNodes.some((node) => node.id === selectedPathId)) {
      setSelectedPathId(pathNodes[0]?.id || null);
    }
    if (expandedPathId && !pathNodes.some((node) => node.id === expandedPathId)) {
      setExpandedPathId(null);
    }
  }, [expandedPathId, pathNodes, selectedPathId]);

  useEffect(() => {
    if (!branchRoles.length) {
      setSelectedRoleId(null);
      return;
    }
    if (!selectedRoleId || !branchRoles.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId(branchRoles[0].id);
    }
  }, [branchRoles, selectedRoleId]);

  useEffect(() => {
    setExpandedPathId(null);
    setSelectedRoleId(null);
    setPanelChallenge(null);
    setPanelDismissed(true);
  }, [challengeGraphSignature]);

  useEffect(() => {
    if (!onNavigationStateChange) return;
    onNavigationStateChange({
      activeLayer,
      selectedPathId,
      expandedPathId,
      activeBranchRoleId: selectedRoleId,
      panelChallengeId: panelChallenge?.id || null,
      panelDismissed,
      canvasZoom,
    });
  }, [activeLayer, canvasZoom, expandedPathId, onNavigationStateChange, panelChallenge?.id, panelDismissed, selectedPathId, selectedRoleId]);

  const careerMapLayoutSnapshot = useMemo(
    () => JSON.stringify({
      positions: careerMapNodePositions,
      branchOverrides: careerMapBranchOverrides,
    }),
    [careerMapBranchOverrides, careerMapNodePositions],
  );
  const careerMapLayoutPersistedRef = useRef<string>('');

  useEffect(() => {
    const loadedSnapshot = JSON.stringify({
      positions: sanitizeCareerMapNodeOffsets(userProfile.preferences?.careerMapLayout?.positions),
      branchOverrides: userProfile.preferences?.careerMapLayout?.branchOverrides || createEmptyBranchOverrides(),
    });
    careerMapLayoutPersistedRef.current = loadedSnapshot;
  }, [userProfile.id]);

  useEffect(() => {
    if (!userProfile.isLoggedIn || !userProfile.id) return;
    if (careerMapLayoutSnapshot === careerMapLayoutPersistedRef.current) return;
    const timer = window.setTimeout(() => {
      void persistUserProfile(userProfile.id!, {
        preferences: {
          ...userProfile.preferences,
          careerMapLayout: {
            positions: careerMapNodePositions,
            branchOverrides: careerMapBranchOverrides,
          },
        },
      }).then(() => {
        careerMapLayoutPersistedRef.current = careerMapLayoutSnapshot;
      }).catch((error) => {
        console.warn('[CareerOS] Failed to persist career map layout:', error);
      });
    }, 550);
    return () => window.clearTimeout(timer);
  }, [
    careerMapBranchOverrides,
    careerMapLayoutSnapshot,
    careerMapNodePositions,
    userProfile.id,
    userProfile.isLoggedIn,
    userProfile.preferences,
  ]);

  useEffect(() => {
    if (!panelChallenge) return;
    const refreshedChallenge = workspace.challenges.find((challenge) => challenge.id === panelChallenge.id) || null;
    if (!refreshedChallenge) {
      setPanelChallenge(null);
      return;
    }
    if (refreshedChallenge !== panelChallenge) {
      setPanelChallenge(refreshedChallenge);
    }
  }, [panelChallenge, workspace.challenges]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setNotificationsStorageHydrated(false);
    try {
      const raw = window.localStorage.getItem(notificationStorageKey);
      setReadNotificationIds(raw ? JSON.parse(raw) : []);
    } catch {
      setReadNotificationIds([]);
    }
    setNotificationsStorageHydrated(true);
  }, [notificationStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !notificationsStorageHydrated) return;
    try {
      const raw = window.localStorage.getItem(notificationStorageKey);
      const storedIds = raw ? JSON.parse(raw) : [];
      const mergedIds = Array.from(new Set([...(Array.isArray(storedIds) ? storedIds : []), ...readNotificationIds]));
      window.localStorage.setItem(notificationStorageKey, JSON.stringify(mergedIds));
    } catch {
      window.localStorage.setItem(notificationStorageKey, JSON.stringify(readNotificationIds));
    }
  }, [notificationStorageKey, notificationsStorageHydrated, readNotificationIds]);

  useEffect(() => {
    if (!shouldLoadNotifications) return;
    let cancelled = false;

    const buildNotifications = async () => {
      const items = await buildCareerOSNotificationFeed({
        locale: i18n.language || userProfile.preferredLocale || 'cs',
        matchCandidates: notificationMatchCandidates,
        userProfile: {
          id: userProfile.id,
          dailyDigestEnabled: userProfile.dailyDigestEnabled,
          dailyDigestLastSentAt: userProfile.dailyDigestLastSentAt,
          dailyDigestPushEnabled: userProfile.dailyDigestPushEnabled,
          dailyDigestTime: userProfile.dailyDigestTime,
          dailyDigestTimezone: userProfile.dailyDigestTimezone,
        },
        t,
        maxItems: 8,
      });
      if (!cancelled) {
        startTransition(() => {
          setNotificationItems(items);
        });
      }
    };

    void buildNotifications();
    const intervalId = window.setInterval(() => {
      void buildNotifications();
    }, userProfile.id ? 90_000 : 180_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    i18n.language,
    notificationMatchCandidates,
    shouldLoadNotifications,
    t,
    userProfile.dailyDigestEnabled,
    userProfile.dailyDigestLastSentAt,
    userProfile.dailyDigestPushEnabled,
    userProfile.dailyDigestTime,
    userProfile.dailyDigestTimezone,
    userProfile.id,
    userProfile.preferredLocale,
  ]);

  useEffect(() => {
    if (!shouldLoadProfileMiniChallenges) return;
    let cancelled = false;

    const loadProfileMiniChallenges = async () => {
      if (!userProfile.isLoggedIn) {
        if (!cancelled) setProfileMiniChallenges([]);
        return;
      }
      try {
        const jobs = await listProfileMiniChallenges();
        if (!cancelled) {
          startTransition(() => {
            setProfileMiniChallenges((current) => {
              if (jobs.length === 0 && current.length > 0) {
                return current;
              }
              return jobs;
            });
          });
        }
      } catch (error) {
        console.warn('[CareerOS] Failed to load profile mini challenges:', error);
      }
    };

    void loadProfileMiniChallenges();
    return () => {
      cancelled = true;
    };
  }, [shouldLoadProfileMiniChallenges, userProfile.id, userProfile.isLoggedIn]);

  useEffect(() => {
    if (activeLayer !== 'job_offers') {
      setPanelChallenge(null);
    }
  }, [activeLayer]);

  const submitSearch = useCallback(() => {
    setFiltersOpen(false);
    setActiveLayer('marketplace');
    setPanelChallenge(null);
    performSearch(searchTerm);
  }, [performSearch, searchTerm]);

  const handleCareerMapNodeOffsetChange = useCallback((nodeKey: string, nextOffset: CareerMapNodeOffset) => {
    setCareerMapNodePositions((current) => ({
      ...current,
      [nodeKey]: {
        x: Math.round(nextOffset.x),
        y: Math.round(nextOffset.y),
      },
    }));
  }, []);

  const handleResetCareerMapLayout = useCallback(() => {
    setCanvasZoom(1);
    setCareerMapNodePositions(createEmptyNodeOffsets());
    setCareerMapBranchOverrides(createEmptyBranchOverrides());
    setActiveLayer('career_path');
    setExpandedPathId(null);
    setSelectedRoleId(null);
  }, []);

  const handlePathNodeClick = useCallback((node: PathNode) => {
    markPerf('careeros:graph:start');
    setSelectedPathId(node.id);
    setPanelDismissed(false);
    setExpandedPathId(node.id);
    setSelectedRoleId(null);
    setActiveLayer('career_path');
  }, []);

  const handleRoleNodeClick = useCallback((role: RoleNode) => {
    markPerf('careeros:graph:start');
    setSelectedRoleId(role.id);
    setPanelDismissed(false);
    setPanelChallenge(role.featuredChallenge);
    setActiveLayer('job_offers');
  }, []);

  const handleSidebarNavigate = useCallback((layer: CareerOSLayer) => {
    markPerf('careeros:graph:start');
    setPanelDismissed(false);
    if (layer === 'market_trends' && !MARKET_TRENDS_ENABLED) {
      setActiveLayer('marketplace');
      setExpandedPathId(null);
      setPanelDismissed(true);
      setPanelChallenge(null);
      return;
    }
    if (layer === 'career_path') {
      setActiveLayer('career_path');
      setPanelDismissed(true);
      setPanelChallenge(null);
      return;
    }
    setActiveLayer(layer);
  }, []);

  const handleNotificationAction = (notification: CareerOSNotification) => {
    setNotificationsOpen(false);
    setReadNotificationIds((current) => Array.from(new Set([...current, notification.id])));
    if (notification.kind === 'high_match' && notification.challengeId) {
      handleJobSelect(notification.challengeId);
      return;
    }
    if (notification.kind === 'signal_boost' && notification.challengeId) {
      handleJobSelect(notification.challengeId);
      return;
    }
    onOpenProfile();
  };

  const applyNavigationGoal = (goal: CareerNavigationGoal) => {
    const route = buildCareerNavigationRoute({
      goal,
      userProfile,
      pathOptions: navigationPathOptions,
      learning: navigationLearningSignal,
      miniChallenges: navigationMiniChallenges,
      useMarketPreferences: navigationUseMarketPreferences,
      locale: activeLocale,
    });
    setNavigationRoute(route);
    setActiveLayer('career_path');
    setPanelDismissed(true);
    setPanelChallenge(null);
    if (route.targetPathId) {
      setSelectedPathId(route.targetPathId);
      setExpandedPathId(null);
    }
    if (route.targetRoleId) {
      setSelectedRoleId(route.targetRoleId);
    }
  };

  const handleNavigationSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!userProfile.isLoggedIn) {
      void onOpenAuth('register');
      return;
    }

    const heuristicGoal = inferCareerNavigationGoal({
      goalText: navigationGoalInput,
      userProfile,
      pathOptions: navigationPathOptions,
      locale: activeLocale,
    });
    applyNavigationGoal(heuristicGoal);
    setNavigationComposerOpen(false);
    setNavigationResolving(true);

    try {
      const aiGoal = await resolveCareerNavigationGoalWithAi(navigationGoalInput, userProfile, activeLocale);
      if (!aiGoal) return;
      const mergedGoal = mergeCareerNavigationGoalWithAi({
        baseGoal: heuristicGoal,
        aiResult: aiGoal,
        pathOptions: navigationPathOptions,
        locale: activeLocale,
      });
      if (
        mergedGoal.targetRole !== heuristicGoal.targetRole
        || mergedGoal.primaryDomain !== heuristicGoal.primaryDomain
        || mergedGoal.confidence !== heuristicGoal.confidence
      ) {
        applyNavigationGoal(mergedGoal);
      }
    } finally {
      setNavigationResolving(false);
    }
  };

  const handleNavigationStepOpen = (stepId: string) => {
    if (!navigationRoute) return;
    const step = navigationRoute.steps.find((item) => item.id === stepId);
    if (!step) return;

    switch (step.ctaTarget.kind) {
      case 'open_profile':
        onOpenProfile();
        return;
      case 'open_learning_path':
        setActiveLayer('learning_path');
        return;
      case 'open_mini_challenges':
        setActiveLayer('mini_challenges');
        return;
      case 'open_path': {
        if (!step.ctaTarget.pathId) return;
        setActiveLayer('career_path');
        setSelectedPathId(step.ctaTarget.pathId);
        setExpandedPathId(null);
        setPanelDismissed(true);
        return;
      }
      case 'open_offers': {
        if (!step.ctaTarget.pathId) return;
        const targetPath = pathNodes.find((node) => node.id === step.ctaTarget.pathId) || null;
        const targetRole = targetPath?.roleNodes.find((role) => role.id === step.ctaTarget.roleId) || targetPath?.roleNodes[0] || null;
        setSelectedPathId(step.ctaTarget.pathId);
        setSelectedRoleId(targetRole?.id || null);
        setExpandedPathId(null);
        setPanelChallenge(targetRole?.featuredChallenge || targetPath?.featuredChallenge || null);
        setPanelDismissed(false);
        setActiveLayer('job_offers');
        return;
      }
      default:
        return;
    }
  };

  const handleNavigationAlternativeSelect = (alternative: CareerNavigationGoalAlternative) => {
    if (!navigationRoute) return;
    const nextGoal = buildCareerNavigationGoalFromAlternative(navigationRoute.goal, alternative);
    applyNavigationGoal(nextGoal);
  };

  const mainLayerNode = useMemo(() => measureSyncPerf('careeros:main-layer', () => {
    if (activeLayer === 'career_path' || (activeLayer === 'job_offers' && (!selectedPath || !selectedRole)) || !selectedPath) {
      return (
        <CareerPathStage
          userLabel={workspace.userLabel}
          headline={workspace.headline}
          userProfilePhoto={safeImage(userProfile.photo || (userProfile as any).avatarUrl || (userProfile as any).avatar_url || null)}
          isGuest={!userProfile.isLoggedIn}
          formattedJobsCount={formattedJobsCount}
          formattedActiveCandidates={formattedActiveCandidates}
          nodes={pathNodes}
          branchRoles={branchRoles}
          selectedPathId={selectedPath?.id || null}
          activeBranchRoleId={selectedRole?.id || null}
          zoom={canvasZoom}
          setZoom={setCanvasZoom}
          onNodeClick={handlePathNodeClick}
          onClusterRoleClick={handleRoleNodeClick}
          onOpenAuth={onOpenAuth}
          nodeOffsets={careerMapNodePositions}
          onNodeOffsetChange={handleCareerMapNodeOffsetChange}
          onResetLayout={handleResetCareerMapLayout}
        />
      );
    }

    if (activeLayer === 'job_offers' && selectedPath && selectedRole) {
      return (
        <div className="relative h-full overflow-y-auto px-4 pb-8 pt-6 lg:pl-[320px] lg:pr-6">
          <NeuralCircuitTexture className="pointer-events-none absolute inset-0 opacity-[0.24]" />
          <div className="relative z-10 space-y-5">
            <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 shadow-sm dark:border-slate-700 dark:bg-slate-950/96 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      markPerf('careeros:graph:start');
                      setActiveLayer('career_path');
                      setPanelChallenge(null);
                      setExpandedPathId(selectedPath.id);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 dark:border-cyan-500/30 dark:bg-cyan-950/30 dark:text-cyan-200 dark:hover:bg-cyan-950/40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    {t('careeros.offers_stage.return_to_roles', { defaultValue: 'Zpět na role' })}
                  </button>
                  <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
                    {selectedPath.title}
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-100">
                    {selectedRole.title}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    {t('careeros.offers_stage.offer_count', {
                      defaultValue: '{{count}} aktivních nabídek',
                      count: jobOfferLayerJobs.length,
                    })}
                  </span>
                </div>
              </div>
            </div>

            <MarketplacePage
              hasNativeChallenges={hasNativeChallenges}
              jobs={jobOfferLayerJobs}
              selectedJobId={selectedJobId}
              savedJobIds={savedJobIds}
              userProfile={userProfile}
              lane={lane}
              discoveryMode={discoveryMode}
              searchDiagnostics={searchDiagnostics}
              setDiscoveryMode={setDiscoveryMode}
              setLane={setLane}
              totalCount={jobOfferLayerJobs.length}
              isLoadingJobs={isLoadingJobs}
              loadingMore={false}
              hasMore={false}
              currentPage={1}
              pageSize={Math.max(1, jobOfferLayerJobs.length)}
              handleJobSelect={handleJobSelect}
              handleToggleSave={handleToggleSave}
              loadMoreJobs={() => {}}
              goToPage={() => {}}
              onOpenProfile={onOpenProfile}
              filterMinSalary={filterMinSalary}
              setFilterMinSalary={setFilterMinSalary}
              filterBenefits={filterBenefits}
              setFilterBenefits={setFilterBenefits}
              remoteOnly={remoteOnly}
              setRemoteOnly={setRemoteOnly}
              enableCommuteFilter={enableCommuteFilter}
              setEnableCommuteFilter={setEnableCommuteFilter}
              filterMaxDistance={filterMaxDistance}
              setFilterMaxDistance={setFilterMaxDistance}
              onOpenAuth={onOpenAuth}
              showSidebar={false}
              embeddedInCareerOS
              embeddedVariant="career_map_offers"
            />
          </div>
        </div>
      );
    }

    if (activeLayer === 'learning_path') {
      if (learningPathRequiresSetup) {
        return (
          <CareerPathSetupState
            isGuest={isGuestCareerPath}
            onOpenAuth={onOpenAuth}
            onOpenProfile={onOpenProfile}
          />
        );
      }
      return <LearningPathView analysis={learningGapAnalysis} onOpenProfile={onOpenProfile} />;
    }

    if (activeLayer === 'marketplace') {
      return (
        <div
          className={cn(
            'relative flex h-full overflow-y-auto px-4 pb-8 pt-6 lg:pr-6',
            sidebarCollapsed ? 'lg:pl-[104px]' : 'lg:pl-[320px]'
          )}
        >
          <NeuralCircuitTexture className="pointer-events-none absolute inset-0 opacity-[0.34]" />
          <div className="pointer-events-none absolute left-[14%] top-[12%] h-[320px] w-[320px] rounded-full bg-emerald-300/10 blur-[120px]" />
          <div className="pointer-events-none absolute bottom-[10%] right-[12%] h-[420px] w-[420px] rounded-full bg-sky-300/10 blur-[140px]" />
          <div className="relative z-10 min-w-0 flex-1">
            <MarketplacePage
              hasNativeChallenges={hasNativeChallenges}
              jobs={jobs}
              selectedJobId={selectedJobId}
              savedJobIds={savedJobIds}
              userProfile={userProfile}
              lane={lane}
              discoveryMode={discoveryMode}
              searchDiagnostics={searchDiagnostics}
              setDiscoveryMode={setDiscoveryMode}
              setLane={setLane}
              totalCount={totalCount}
              isLoadingJobs={isLoadingJobs}
              loadingMore={loadingMore}
              hasMore={hasMore}
              currentPage={currentPage}
              pageSize={pageSize}
              handleJobSelect={handleJobSelect}
              handleToggleSave={handleToggleSave}
              loadMoreJobs={loadMoreJobs}
              goToPage={goToPage}
              onOpenProfile={onOpenProfile}
              filterMinSalary={filterMinSalary}
              setFilterMinSalary={setFilterMinSalary}
              filterBenefits={filterBenefits}
              setFilterBenefits={setFilterBenefits}
              remoteOnly={remoteOnly}
              setRemoteOnly={setRemoteOnly}
              enableCommuteFilter={enableCommuteFilter}
              setEnableCommuteFilter={setEnableCommuteFilter}
              filterMaxDistance={filterMaxDistance}
              setFilterMaxDistance={setFilterMaxDistance}
              onOpenAuth={onOpenAuth}
              showSidebar={false}
              embeddedInCareerOS
            />
          </div>
        </div>
      );
    }

    if (activeLayer === 'mini_challenges') {
      return <MiniChallengesView cards={miniChallengeCards} onOpenChallenge={handleJobSelect} onOpenProfile={onOpenProfile} />;
    }

    if (activeLayer === 'market_trends' && MARKET_TRENDS_ENABLED) {
      return <MarketTrendsView analysis={marketTrendAnalysis} onOpenLearningPath={() => setActiveLayer('learning_path')} />;
    }

    return null;
  }), [
    activeLayer,
    availableDomains,
    canvasZoom,
    discoveryMode,
    domainRemapOpen,
    expandedPathId,
    filterBenefits,
    filterContractType,
    filterExperience,
    filterLanguageCodes,
    filterMaxDistance,
    filterMinSalary,
    filterWorkArrangement,
    formattedActiveCandidates,
    formattedJobsCount,
    formattedMappedPoolCount,
    globalSearch,
    handleJobSelect,
    handlePathNodeClick,
    handleRoleNodeClick,
    hasMore,
    hasNativeChallenges,
    isGuestCareerPath,
    isLoadingJobs,
    jobs,
    lane,
    learningGapAnalysis,
    learningPathRequiresSetup,
    loadingMore,
    manualDomainQuery,
    manualDomainSelection,
    marketTrendAnalysis,
    navigationRoute,
    onOpenAuth,
    onOpenProfile,
    pageSize,
    panelChallenge,
    pathNodes,
    performSearch,
    remoteOnly,
    savedJobIds,
    searchDiagnostics,
    searchTerm,
    selectedJobId,
    selectedPath,
    selectedRole,
    setDiscoveryMode,
    setDomainRemapOpen,
    setFilterBenefits,
    setFilterCity,
    setFilterContractType,
    setFilterExperience,
    setFilterLanguageCodes,
    setFilterMaxDistance,
    setFilterMinSalary,
    setFilterWorkArrangement,
    setGlobalSearch,
    setLane,
    setRemoteOnly,
    setSearchTerm,
    setEnableCommuteFilter,
    setCanvasZoom,
    setAbroadOnly,
    totalCount,
    unreadNotificationCount,
    userProfile,
    workspace.headline,
    workspace.userLabel,
    workspace.challenges,
    abroadOnly,
    enableCommuteFilter,
    currentPage,
    filterCity,
  ]);

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <NeuralCircuitTexture className="opacity-[0.42]" />
      <div className="pointer-events-none absolute left-[14%] top-[14%] h-[360px] w-[360px] rounded-full bg-emerald-300/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[8%] right-[12%] h-[440px] w-[440px] rounded-full bg-sky-300/10 blur-[140px]" />

      <Navbar
        userProfile={userProfile}
        notificationCount={unreadNotificationCount}
        notificationsOpen={notificationsOpen}
        setNotificationsOpen={setNotificationsOpen}
        notifications={notificationItems}
        onNotificationAction={handleNotificationAction}
        onOpenProfile={onOpenProfile}
        onOpenCompaniesLanding={onOpenCompaniesLanding}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterCity={filterCity}
        setFilterCity={setFilterCity}
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
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
        discoveryMode={discoveryMode}
        setDiscoveryMode={setDiscoveryMode}
        filterContractType={filterContractType}
        setFilterContractType={setFilterContractType}
        filterExperience={filterExperience}
        setFilterExperience={setFilterExperience}
        filterLanguageCodes={filterLanguageCodes}
        setFilterLanguageCodes={setFilterLanguageCodes}
        filterBenefits={filterBenefits}
        setFilterBenefits={setFilterBenefits}
        benefitCandidates={benefitCandidates}
        onSubmit={submitSearch}
      />

      {(activeLayer === 'career_path' || activeLayer === 'job_offers') ? (
        <div className="pointer-events-none absolute left-3 right-3 top-[88px] z-[74] lg:hidden">
          <div className="pointer-events-auto rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/96 dark:shadow-[0_30px_90px_-40px_rgba(2,6,23,0.82)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>{navigationUiCopy.badge}</span>
                </div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {navigationRoute
                    ? navigationRoute.summary
                    : navigationUiCopy.subtitle}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!userProfile.isLoggedIn) {
                      void onOpenAuth('register');
                      return;
                    }
                    setNavigationComposerOpen((current) => !current);
                  }}
                  className={cn(shellCtaButton, 'pointer-events-auto')}
                >
                  {navigationRoute
                    ? navigationUiCopy.changeGoal
                    : navigationUiCopy.openCta}
                  <ChevronRight className="h-4 w-4" />
                </button>
                {navigationRoute ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNavigationRoute(null);
                      setNavigationResolving(false);
                    }}
                    className={shellSecondaryButton}
                  >
                    {navigationUiCopy.clear}
                  </button>
                ) : null}
              </div>
            </div>

            {navigationComposerOpen ? (
              <form className="mt-3 grid gap-3 border-t border-slate-200/80 pt-3 dark:border-slate-800/80 lg:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => { void handleNavigationSubmit(event); }}>
                <div className="space-y-3">
                  <input
                    value={navigationGoalInput}
                    onChange={(event) => setNavigationGoalInput(event.target.value)}
                    placeholder={navigationUiCopy.placeholder}
                    className={shellInput}
                  />
                  <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={navigationUseMarketPreferences}
                      onChange={(event) => setNavigationUseMarketPreferences(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    {navigationUiCopy.useMarketPrefs}
                  </label>
                </div>
                <div className="flex flex-col gap-2 lg:min-w-[190px]">
                  <button
                    type="submit"
                    disabled={!navigationGoalInput.trim() || navigationResolving}
                    className={cn(shellCtaButton, '!disabled:cursor-not-allowed !disabled:opacity-60')}
                  >
                    {navigationResolving ? <Bot className="h-4 w-4 animate-pulse" /> : <TrendingUp className="h-4 w-4" />}
                    {navigationUiCopy.submit}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNavigationComposerOpen(false)}
                    className={shellSecondaryButton}
                  >
                    {t('common.close', { defaultValue: 'Close' })}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="absolute left-6 top-6 z-[72] hidden lg:flex lg:flex-col lg:gap-4">
        <GalaxyLayerSidebar
          title={t('careeros.sidebar.title', { defaultValue: getCareerOSSidebarCopy(String(i18n.resolvedLanguage || i18n.language || 'en')).title })}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          items={sidebarLayers.map((layer) => ({
            id: layer.id,
            icon: layer.icon,
            active: layer.id === 'career_path' ? activeLayer === 'career_path' || activeLayer === 'job_offers' : activeLayer === layer.id,
            label: getCareerOSLayerLabel(t, layer.id, String(i18n.resolvedLanguage || i18n.language || 'en')),
            onClick: () => handleSidebarNavigate(layer.id),
          }))}
        />
        {activeLayer === 'marketplace' ? (
          <div className={cn('self-start', sidebarCollapsed ? 'w-16' : 'w-72')}>
            <MarketplaceSidebar
              jobCount={totalCount}
              savedCount={savedJobIds.length}
              remoteOnly={remoteOnly}
              filterMinSalary={filterMinSalary}
              filterBenefits={filterBenefits}
              enableCommuteFilter={enableCommuteFilter}
              filterMaxDistance={filterMaxDistance}
              currentPage={currentPage}
              pageSize={pageSize}
              hasMore={hasMore}
              discoveryMode={discoveryMode}
              lane={lane}
              onOpenProfile={onOpenProfile}
              collapsed={sidebarCollapsed}
            />
          </div>
        ) : null}
        {activeLayer === 'job_offers' ? (
          <GalaxyCanvasControls
            zoom={canvasZoom}
            setZoom={setCanvasZoom}
            className={cn('self-start', sidebarCollapsed ? 'w-auto' : 'w-72')}
          />
        ) : null}
        {(activeLayer === 'career_path' || activeLayer === 'job_offers') ? (
          <div className={cn('self-start', sidebarCollapsed ? 'w-auto' : 'w-72')}>
            <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/96 dark:shadow-[0_30px_90px_-40px_rgba(2,6,23,0.82)]">
              {sidebarCollapsed ? (
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!userProfile.isLoggedIn) {
                        void onOpenAuth('register');
                        return;
                      }
                      setNavigationComposerOpen((current) => !current);
                    }}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-cyan-600 text-white shadow-[0_18px_38px_rgba(8,145,178,0.22)]"
                    aria-label={navigationRoute ? navigationUiCopy.changeGoal : navigationUiCopy.openCta}
                    title={navigationRoute ? navigationUiCopy.changeGoal : navigationUiCopy.openCta}
                  >
                    <TrendingUp className="h-4 w-4" />
                  </button>
                  {navigationRoute ? (
                    <button
                      type="button"
                      onClick={() => {
                        setNavigationRoute(null);
                        setNavigationResolving(false);
                      }}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200"
                      aria-label={navigationUiCopy.clear}
                      title={navigationUiCopy.clear}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>{navigationUiCopy.badge}</span>
                      </div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {navigationRoute ? navigationRoute.summary : navigationUiCopy.subtitle}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!userProfile.isLoggedIn) {
                            void onOpenAuth('register');
                            return;
                          }
                          setNavigationComposerOpen((current) => !current);
                        }}
                        className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(8,145,178,0.22)]"
                      >
                        {navigationRoute ? navigationUiCopy.changeGoal : navigationUiCopy.openCta}
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      {navigationRoute ? (
                        <button
                          type="button"
                          onClick={() => {
                            setNavigationRoute(null);
                            setNavigationResolving(false);
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200"
                        >
                          {navigationUiCopy.clear}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {navigationComposerOpen ? (
                    <form className="mt-3 grid gap-3 border-t border-slate-200/80 pt-3 dark:border-slate-800/80" onSubmit={(event) => { void handleNavigationSubmit(event); }}>
                      <div className="space-y-3">
                        <input
                          value={navigationGoalInput}
                          onChange={(event) => setNavigationGoalInput(event.target.value)}
                          placeholder={navigationUiCopy.placeholder}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-slate-100 dark:focus:border-cyan-400 dark:focus:ring-cyan-950/40"
                        />
                        <label className="inline-flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={navigationUseMarketPreferences}
                            onChange={(event) => setNavigationUseMarketPreferences(event.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          />
                          <span>{navigationUiCopy.useMarketPrefs}</span>
                        </label>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          type="submit"
                          disabled={!navigationGoalInput.trim() || navigationResolving}
                          className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {navigationResolving ? <Bot className="h-4 w-4 animate-pulse" /> : <TrendingUp className="h-4 w-4" />}
                          {navigationUiCopy.submit}
                        </button>
                        <button
                          type="button"
                          onClick={() => setNavigationComposerOpen(false)}
                          className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200"
                        >
                          {t('common.close', { defaultValue: 'Close' })}
                        </button>
                      </div>
                    </form>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="absolute inset-0">{mainLayerNode}</div>

      <NavigationPanel
        route={navigationRoute}
        visible={activeLayer === 'career_path'}
        resolving={navigationResolving}
        onClose={() => {
          setNavigationRoute(null);
          setNavigationResolving(false);
        }}
        onEditGoal={() => setNavigationComposerOpen(true)}
        onOpenStep={handleNavigationStepOpen}
        onSelectAlternative={handleNavigationAlternativeSelect}
      />

    </div>
  );
};

export default React.memo(CareerOSCandidateWorkspace);
