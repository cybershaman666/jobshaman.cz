import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  ChevronUp,
  Clock3,
  Coins,
  Dog,
  Globe2,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  Home,
  Layers,
  Mail,
  RotateCcw,
  TrainFront,
  Sparkles,
  Star,
  TrendingUp,
  UtensilsCrossed,
  X,
} from 'lucide-react';

import type { Job, JobWorkArrangementFilter, LearningResource, SearchLanguageCode, TransportMode, UserProfile } from '../../types';
import { fetchLearningResources } from '../../services/learningResourceService';
import { listProfileMiniChallenges } from '../../services/profileMiniChallengeService';
import { getMainDatabaseJobCount } from '../../services/jobService';
import { cn } from '../ui/primitives';
import TransportModeSelector from '../TransportModeSelector';
import { resolveJobDomain } from '../../utils/domainAccents';
import {
  type CareerOSChallenge,
  type CareerOSLayer,
  mapJobsToCareerOSCandidateWorkspace,
} from '../../src/app/careeros/model/viewModels';
import { buildCareerOSNotificationFeed } from '../../src/app/careeros/model/notificationFeed';
import MarketplacePage, { type MarketplacePageProps } from '../../src/pages/marketplace/MarketplacePage';

const PROFILE_INITIAL_TAB_STORAGE_KEY = 'jobshaman.profile.initialTab';
const DEBUG_CAREER_OS =
  import.meta.env.DEV || String(import.meta.env.VITE_DEBUG_CAREER_OS || '').toLowerCase() === 'true';
const MARKET_TRENDS_ENABLED =
  String(import.meta.env.VITE_ENABLE_CAREEROS_MARKET_TRENDS || 'false').toLowerCase() === 'true';

interface CareerOSCandidateWorkspaceProps extends MarketplacePageProps {
  onOpenCompanyPage: (companyId: string) => void;
  onOpenCompaniesLanding: () => void;
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
  panelChallengeId: string | null;
  panelDismissed: boolean;
  canvasZoom: number;
}

interface PathNode {
  id: string;
  domainKey: string;
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

interface ExpandedClusterChild {
  role: RoleNode;
  x: number;
  y: number;
  textPos: 'left' | 'right';
}

interface OfferNode {
  challenge: CareerOSChallenge;
  x: number;
  y: number;
  textPos: 'left' | 'right';
  labelPlacement: 'left' | 'right' | 'top' | 'bottom';
}

interface RemapDomainOption {
  value: string;
  label?: string;
}

export interface CareerOSNotification {
  id: string;
  kind: 'company_message' | 'dialogue_update' | 'high_match' | 'digest';
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

const shellPanel =
  'border border-slate-200/70 bg-white/78 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/62 dark:shadow-[0_22px_58px_-36px_rgba(2,6,23,0.7)]';

const filterChipInactiveClass =
  'border border-white/60 bg-white/60 text-slate-700 backdrop-blur-xl hover:border-cyan-200/80 hover:text-cyan-700 dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-cyan-500/50 dark:hover:bg-slate-900/80 dark:hover:text-cyan-200';


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
} as const;

const sidebarLayers: Array<{ id: CareerOSLayer; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'career_path', icon: TrendingUp },
  { id: 'marketplace', icon: Briefcase },
  { id: 'mini_challenges', icon: Sparkles },
  { id: 'learning_path', icon: BookOpen },
  ...(MARKET_TRENDS_ENABLED
    ? [{ id: 'market_trends' as CareerOSLayer, icon: BarChart3 }]
    : []),
];

const pathLayoutPresets: Record<number, Array<{ x: number; y: number }>> = {
  1: [{ x: 0, y: -250 }],
  2: [
    { x: -280, y: -40 },
    { x: 280, y: -40 },
  ],
  3: [
    { x: 0, y: -290 },
    { x: -315, y: 120 },
    { x: 315, y: 120 },
  ],
  4: [
    { x: -285, y: -170 },
    { x: 285, y: -170 },
    { x: -255, y: 175 },
    { x: 255, y: 175 },
  ],
  5: [
    { x: 0, y: -300 },
    { x: -330, y: -75 },
    { x: 330, y: -75 },
    { x: -225, y: 225 },
    { x: 225, y: 225 },
  ],
};

const buildAdaptiveOrbit = (
  count: number,
  radiusX: number,
  radiusY: number,
  startAngle = -Math.PI / 2,
): Array<{ x: number; y: number; angle: number }> => {
  if (count <= 1) {
    return [{ x: 0, y: -radiusY, angle: startAngle }];
  }

  return Array.from({ length: count }, (_, index) => {
    const angle = startAngle + (index / count) * Math.PI * 2;
    return {
      x: Math.cos(angle) * radiusX,
      y: Math.sin(angle) * radiusY,
      angle,
    };
  });
};

const getAdaptivePathLayoutSlots = (count: number): Array<{ x: number; y: number }> => {
  const preset = pathLayoutPresets[count];
  if (preset) return preset;

  return buildAdaptiveOrbit(count, 340, 270).map(({ x, y }) => ({ x, y }));
};

const buildSideClusterLayout = (count: number): Array<{ x: number; y: number; textPos: 'left' | 'right' }> => {
  if (count <= 0) return [];
  if (count === 1) {
    return [{ x: 260, y: 0, textPos: 'right' }];
  }

  const leftCount = Math.ceil(count / 2);
  const rightCount = Math.floor(count / 2);
  const leftYs = Array.from({ length: leftCount }, (_, index) => {
    if (leftCount === 1) return 0;
    return -150 + (index * 300) / (leftCount - 1);
  });
  const rightYs = Array.from({ length: rightCount }, (_, index) => {
    if (rightCount === 1) return 0;
    return -150 + (index * 300) / (rightCount - 1);
  });

  const positions: Array<{ x: number; y: number; textPos: 'left' | 'right' }> = [];
  let leftIndex = 0;
  let rightIndex = 0;

  for (let index = 0; index < count; index += 1) {
    const placeOnLeft = index % 2 === 0;
    if (placeOnLeft && leftIndex < leftYs.length) {
      positions.push({
        x: -250 - (leftIndex % 2 === 0 ? 8 : 24),
        y: leftYs[leftIndex],
        textPos: 'left',
      });
      leftIndex += 1;
      continue;
    }

    positions.push({
      x: 250 + (rightIndex % 2 === 0 ? 8 : 24),
      y: rightYs[rightIndex] ?? 0,
      textPos: 'right',
    });
    rightIndex += 1;
  }

  return positions;
};

const initials = (value: string): string => {
  const parts = String(value || 'JS').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return 'JS';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};

const titleCase = (value: string): string =>
  value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());

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

const challengeTone = (challenge: CareerOSChallenge): keyof typeof toneClasses =>
  challenge.listingKind === 'imported' || challenge.jhiScore < 70 ? 'orange' : 'emerald';

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

const compactText = (value: string, max = 40): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 1)).trim()}…`;
};

const twoLineClampStyle: React.CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
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

const REMAP_PRIORITY_DOMAIN_OPTIONS: RemapDomainOption[] = [
  { value: 'logistics' },
  { value: 'healthcare' },
  { value: 'retail' },
  { value: 'automotive' },
  { value: 'education', label: 'Učitelé' },
  { value: 'customer_support', label: 'Customer support' },
];

const getLocalizedDomainLabel = (domain: string, t: TFunction): string =>
  t(`careeros.domains.${domain}`, {
    defaultValue: domainLabelMap[domain] || domain.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
  });

const normalizeRemapQuery = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/+.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeRoleClusterTitle = (value: string): string => {
  const normalized = String(value || '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+\|\s+|\s+@\s+|\s+at\s+/i)[0]
    .replace(/\b(senior|junior|lead|principal|staff|mid|medior|sr\.?|jr\.?|remote|hybrid|part[- ]time|full[- ]time)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || String(value || '').trim() || 'Role';
};

const getChallengePrimaryDomain = (challenge: CareerOSChallenge, job?: Job | null): string =>
  challenge.matchedDomains?.[0] || resolveJobDomain(job || ({} as Job)) || 'general';

const challengeMatchesCustomDomainQuery = (challenge: CareerOSChallenge, customDomainQuery: string): boolean => {
  const normalizedQuery = normalizeRemapQuery(customDomainQuery);
  if (!normalizedQuery) return true;

  const tokens = normalizedQuery.split(' ').filter((token) => token.length >= 2);
  const searchableText = normalizeRemapQuery([
    challenge.title,
    challenge.company,
    challenge.challengeSummary,
    challenge.companyGoal,
    challenge.location,
    ...challenge.requiredSkills,
    ...challenge.topTags,
  ].filter(Boolean).join(' '));

  if (!searchableText) return false;
  if (searchableText.includes(normalizedQuery)) return true;
  return tokens.length > 0 && tokens.every((token) => searchableText.includes(token));
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
              companies: topCompanies.join(' · '),
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

const getCareerOSLayerLabel = (t: TFunction, layer: CareerOSLayer): string => {
  switch (layer) {
    case 'career_path':
      return t('careeros.layers.career_path', { defaultValue: 'Career Map' });
    case 'marketplace':
      return t('careeros.layers.marketplace', { defaultValue: 'Cards' });
    case 'learning_path':
      return t('careeros.layers.learning_path', { defaultValue: 'Learning Path' });
    case 'mini_challenges':
      return t('careeros.layers.mini_challenges', { defaultValue: 'Mini Challenges' });
    case 'market_trends':
      return t('careeros.layers.market_trends', { defaultValue: 'Market Trends' });
    case 'job_offers':
      return t('careeros.layers.job_offers', { defaultValue: 'Offer Layer' });
    default:
      return layer;
  }
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
  challenges: CareerOSChallenge[],
  userProfile: UserProfile,
  t: TFunction,
  selectedDomains: string[] = [],
  customDomainQuery = '',
): PathNode[] => {
  const grouped = new Map<string, CareerOSChallenge[]>();
  const jobsById = new Map(jobs.map((job) => [String(job.id), job]));
  const preferredDomains = uniqStrings([
    userProfile.preferences?.searchProfile?.primaryDomain || '',
    ...(userProfile.preferences?.searchProfile?.secondaryDomains || []),
  ]);
  const normalizedCustomDomainQuery = normalizeRemapQuery(customDomainQuery);

  challenges.forEach((challenge) => {
    if (!challengeMatchesCustomDomainQuery(challenge, normalizedCustomDomainQuery)) return;
    const fallbackJob = jobsById.get(String(challenge.id)) || null;
    const domainKey = getChallengePrimaryDomain(challenge, fallbackJob);
    const bucket = grouped.get(domainKey) || [];
    bucket.push(challenge);
    grouped.set(domainKey, bucket);
  });

  const rankedDomains = Array.from(grouped.entries())
    .map(([domainKey, items]) => {
      const sorted = [...items].sort((left, right) => right.jhiScore - left.jhiScore);
      const roleNodes = buildRoleNodes(domainKey, sorted, t);
      const featuredChallenge = sorted[0];
      const preferenceBoost = selectedDomains.includes(domainKey)
        ? 60
        : preferredDomains.includes(domainKey)
          ? 24
          : 0;
      const customQueryBoost = normalizedCustomDomainQuery ? Math.min(24, sorted.length * 4) : 0;
      const genericPenalty = domainKey === 'general' ? 36 : 0;
      return {
        domainKey,
        items: sorted,
        roleNodes,
        featuredChallenge,
        score: averageNumber(sorted.map((item) => item.jhiScore)) + roleNodes.length * 4 + sorted.length + preferenceBoost + customQueryBoost - genericPenalty,
      };
    })
    .filter((item) => item.featuredChallenge && item.roleNodes.length > 0)
    .filter((item) => selectedDomains.length === 0 || selectedDomains.includes(item.domainKey))
    .filter((item, _, list) => item.domainKey !== 'general' || list.length === 1)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  const layoutSlots = getAdaptivePathLayoutSlots(rankedDomains.length);

  return rankedDomains.map((cluster, index) => {
    const baseSlot = layoutSlots[index] || { x: 0, y: -250 };
    const gravity: PathNode['gravity'] = index < 2 ? 'strong' : 'soft';
    const gravityFactor = gravity === 'strong' ? 0.94 : 1;
    const slot = {
      x: Number(baseSlot.x) * gravityFactor,
      y: Number(baseSlot.y) * gravityFactor,
    };
    const domainLabel = getLocalizedDomainLabel(cluster.domainKey, t);
    const topRoleLabels = cluster.roleNodes.slice(0, 2).map((role) => role.title);

    return {
      id: `domain:${cluster.domainKey}`,
      domainKey: cluster.domainKey,
      title: domainLabel,
      subtitle: t('careeros.map.domain_roles_offers', {
        defaultValue: '{{roles}} roles · {{offers}} offers',
        roles: cluster.roleNodes.length,
        offers: cluster.items.length,
      }),
      summary: t('careeros.map.domain_summary', {
        defaultValue: '{{domain}} split into concrete role lanes based on your current filters and nearby offers.',
        domain: domainLabel,
      }),
      preview: topRoleLabels.length > 0
        ? t('careeros.map.domain_preview_roles', {
            defaultValue: 'Top roles: {{roles}}',
            roles: topRoleLabels.join(' · '),
          })
        : t('careeros.map.domain_preview_default', {
            defaultValue: 'Open this cluster to see role lanes in this direction.',
          }),
      tags: topRoleLabels.length > 0 ? topRoleLabels : Array.from(new Set(cluster.items.flatMap((item) => item.topTags))).slice(0, 2),
      tone: averageNumber(cluster.items.map((item) => item.jhiScore)) >= 72 ? 'emerald' : 'orange',
      challengeCount: cluster.items.length,
      gravity,
      featuredChallenge: cluster.featuredChallenge,
      challenges: cluster.items,
      roleNodes: cluster.roleNodes,
      imageUrl: cluster.featuredChallenge.coverImageUrl || cluster.featuredChallenge.avatarUrl || null,
      x: slot.x,
      y: slot.y,
      textPos: slot.x < 0 ? 'left' : 'right',
    };
  });
};

const buildOfferNodes = (selectedRole: RoleNode | null) => {
  if (!selectedRole) return [];

  const unique = Array.from(new Map(selectedRole.challenges.map((challenge) => [challenge.id, challenge])).values())
    .slice(0, 18);

  return unique.map<OfferNode>((challenge, index, list) => {
    const total = Math.max(1, list.length);
    const ringCapacities = [4, 5, 6, 8];
    let ringIndex = 0;
    let itemsBeforeRing = 0;
    while (ringIndex < ringCapacities.length - 1 && index >= itemsBeforeRing + ringCapacities[ringIndex]) {
      itemsBeforeRing += ringCapacities[ringIndex];
      ringIndex += 1;
    }
    const itemsInRing = Math.min(ringCapacities[ringIndex], total - itemsBeforeRing);
    const ringPosition = index - itemsBeforeRing;
    const angle = (ringPosition / Math.max(1, itemsInRing)) * Math.PI * 2 - Math.PI / 2;
    const baseRadiusX = (total <= 6 ? 210 : total <= 10 ? 235 : 255) + ringIndex * 92 + (ringPosition % 2 === 0 ? 0 : 14);
    const baseRadiusY = Math.max(170, baseRadiusX * 0.78);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const labelPlacement =
      Math.abs(cos) > Math.abs(sin)
        ? (cos < 0 ? 'left' : 'right')
        : (sin < 0 ? 'top' : 'bottom');

    return {
      challenge,
      x: cos * baseRadiusX,
      y: sin * baseRadiusY,
      textPos: cos < 0 ? 'left' : 'right',
      labelPlacement,
    };
  });
};

const buildExpandedClusterChildren = (node: PathNode | null): ExpandedClusterChild[] => {
  if (!node) return [];

  const visibleRoles = node.roleNodes.slice(0, 8);
  const layout = buildSideClusterLayout(visibleRoles.length);

  return visibleRoles.map((role, index) => {
    const slot = layout[index] || { x: 250, y: 0, textPos: 'right' as const };
    return {
      role,
      x: slot.x,
      y: slot.y,
      textPos: slot.textPos,
    };
  });
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

  const source = jobs
    .filter(isLikelyMiniChallenge)
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

  return [...profileJobCards, ...jobCards].slice(0, 6);
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

const NeuralCircuitTexture: React.FC<{
  accent?: 'emerald' | 'blue';
  className?: string;
  masked?: boolean;
}> = ({ accent = 'emerald', className, masked = false }) => {
  const accentStroke = accent === 'blue' ? '#60a5fa' : '#10b981';

  return (
    <div
      className={cn('pointer-events-none absolute -inset-[12%] overflow-hidden', className)}
      style={masked ? {
        maskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 52%, rgba(0,0,0,0.42) 82%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 52%, rgba(0,0,0,0.42) 82%, transparent 100%)',
      } : undefined}
    >
      <svg className="h-full w-full opacity-[0.3]" viewBox="0 0 1440 1024" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <filter id={`careeros-neural-glow-${accent}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g fill="none" strokeLinecap="round" strokeLinejoin="round" filter={`url(#careeros-neural-glow-${accent})`}>
          <path d="M82 180C210 210 252 296 346 318C446 342 504 232 622 236C758 240 800 392 936 404C1046 414 1128 326 1246 338C1318 346 1376 398 1416 452" stroke={accentStroke} strokeWidth="1.55" strokeDasharray="3 12" />
          <path d="M34 742C130 704 222 612 318 624C430 638 476 804 596 810C716 816 776 650 900 642C1034 632 1100 760 1236 756C1320 754 1382 720 1420 684" stroke="#3b82f6" strokeWidth="1.45" strokeDasharray="4 14" />
          <path d="M224 78C286 128 292 222 358 270C442 330 578 314 656 378C736 444 748 594 838 648C948 714 1126 672 1214 752" stroke="#f59e0b" strokeWidth="1.25" strokeDasharray="2 10" opacity="0.74" />
          <path d="M1048 72C976 154 1012 292 936 370C860 448 716 438 640 516C568 590 572 738 492 806C422 866 302 888 234 950" stroke={accentStroke} strokeWidth="1.25" strokeDasharray="3 11" opacity="0.7" />
          <path d="M128 496C240 458 308 364 420 374C544 386 602 560 736 572C868 584 942 448 1086 458C1210 466 1324 560 1416 612" stroke="#0f766e" strokeWidth="1.1" strokeDasharray="5 15" opacity="0.52" />
          <path d="M116 876C194 804 226 712 316 694C424 672 540 776 646 748C762 718 798 556 918 526C1040 494 1174 596 1288 574" stroke="#38bdf8" strokeWidth="1.1" strokeDasharray="4 13" opacity="0.48" />

          <path d="M356 318H508L566 236H684" stroke="#94a3b8" strokeWidth="0.95" opacity="0.5" />
          <path d="M900 642H1016L1084 756H1216" stroke="#94a3b8" strokeWidth="0.95" opacity="0.5" />
          <path d="M838 648V564L936 404H1082" stroke="#94a3b8" strokeWidth="0.95" opacity="0.46" />
          <path d="M318 624V548L358 270H468" stroke="#94a3b8" strokeWidth="0.95" opacity="0.46" />
          <path d="M646 748V664L736 572H882" stroke="#94a3b8" strokeWidth="0.9" opacity="0.38" />
          <path d="M420 374V290L508 318H632" stroke="#94a3b8" strokeWidth="0.9" opacity="0.38" />
        </g>

        <g>
          {[
            [356, 318],
            [566, 236],
            [936, 404],
            [318, 624],
            [838, 648],
            [1216, 756],
            [234, 950],
            [1048, 72],
            [508, 318],
            [1016, 642],
            [736, 572],
            [646, 748],
            [420, 374],
            [1288, 574],
          ].map(([cx, cy], index) => (
            <g key={`${cx}-${cy}-${index}`}>
              <circle cx={cx} cy={cy} r="17" fill="white" opacity="0.72" />
              <circle cx={cx} cy={cy} r="7" fill={index % 3 === 0 ? accentStroke : index % 3 === 1 ? '#3b82f6' : '#f59e0b'} opacity="0.68" />
              <circle cx={cx} cy={cy} r="2.5" fill="white" opacity="0.95" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};

const StageBackground: React.FC<{ accent?: 'emerald' | 'blue' }> = ({ accent = 'emerald' }) => (
  <>
    <style>
      {`
        @keyframes careeros-dash-flow {
          from { stroke-dashoffset: 96; }
          to { stroke-dashoffset: 0; }
        }
      `}
    </style>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.08),transparent_28%),radial-gradient(circle_at_82%_78%,rgba(59,130,246,0.08),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#f7fafc_52%,#f5f8fb_100%)] dark:bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.08),transparent_26%),radial-gradient(circle_at_82%_78%,rgba(59,130,246,0.08),transparent_28%),linear-gradient(180deg,#020617_0%,#020817_52%,#030712_100%)]" />
    <NeuralCircuitTexture accent={accent} masked className="opacity-[0.74]" />
    <div className="pointer-events-none absolute left-[14%] top-[8%] h-[520px] w-[520px] rounded-full bg-emerald-400/8 blur-[140px]" />
    <div className="pointer-events-none absolute bottom-[4%] right-[8%] h-[620px] w-[620px] rounded-full bg-blue-400/8 blur-[165px]" />
    <div className="pointer-events-none absolute right-[24%] top-[34%] h-[420px] w-[420px] rounded-full bg-orange-400/8 blur-[120px]" />

    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
      <svg className="h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id={`careeros-soft-glow-${accent}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform="translate(500, 500)" filter={`url(#careeros-soft-glow-${accent})`}>
          <circle
            cx="0"
            cy="0"
            r="150"
            fill="none"
            stroke={accent === 'blue' ? '#60a5fa' : '#10b981'}
            strokeWidth="0.5"
            strokeDasharray="4 12"
            className="animate-[spin_60s_linear_infinite]"
          />
          <circle
            cx="0"
            cy="0"
            r="280"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="0.5"
            strokeDasharray="8 24"
            className="animate-[spin_90s_linear_infinite_reverse]"
          />
          <circle
            cx="0"
            cy="0"
            r="450"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="0.5"
            strokeDasharray="12 36"
            className="animate-[spin_120s_linear_infinite]"
          />
        </g>
      </svg>
    </div>
  </>
);

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

const clampZoom = (value: number): number => Math.max(0.72, Math.min(1.6, Number(value.toFixed(2))));

const stepZoom = (
  setZoom: React.Dispatch<React.SetStateAction<number>>,
  direction: 'in' | 'out',
): void => {
  const delta = direction === 'in' ? 0.08 : -0.08;
  setZoom((current) => clampZoom(current + delta));
};

const CanvasControls: React.FC<{
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  className?: string;
}> = ({ zoom, setZoom, className }) => (
  <div className={cn('rounded-[20px] border border-slate-200/90 bg-white/94 p-2.5 shadow-[0_20px_48px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/86 dark:shadow-[0_20px_48px_-30px_rgba(2,6,23,0.72)]', className)}>
    <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Zoom</div>
    <div className="mt-1.5 flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => stepZoom(setZoom, 'out')}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        -
      </button>
      <div className="min-w-[56px] text-center text-xs font-semibold text-slate-700 dark:text-slate-200">{Math.round(zoom * 100)}%</div>
      <button
        type="button"
        onClick={() => stepZoom(setZoom, 'in')}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        +
      </button>
    </div>
    <button
      type="button"
      onClick={() => setZoom(1)}
      className="mt-1.5 w-full rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
    >
      Reset
    </button>
  </div>
);

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
  onSubmit: () => void;
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
  discoveryMode,
  setDiscoveryMode,
  filterContractType,
  setFilterContractType,
  filterExperience,
  setFilterExperience,
  filterLanguageCodes,
  setFilterLanguageCodes,
  filterBenefits,
  setFilterBenefits,
  benefitCandidates,
  onSubmit,
}) => {
  const { t } = useTranslation();
  if (!open) return null;

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
    + filterExperience.length
    + filterLanguageCodes.length
    + filterBenefits.length
    + Number(discoveryMode === 'micro_jobs');

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
        className="absolute left-1/2 top-[calc(100%+12px)] z-[80] flex max-h-[min(78vh,820px)] w-[min(94vw,980px)] -translate-x-1/2 flex-col overflow-hidden rounded-[28px] border border-white/55 bg-white/68 p-4 shadow-[0_28px_90px_-30px_rgba(15,23,42,0.45)] backdrop-blur-2xl dark:border-slate-700/80 dark:bg-slate-950/86 dark:shadow-[0_28px_90px_-30px_rgba(2,6,23,0.82)] sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600">{t('careeros.filters.title', { defaultValue: 'Advanced Filters' })}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('careeros.filters.subtitle', { defaultValue: 'Reality filters, commute logic and life-fit presets from the shell.' })}</div>
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
                  setDiscoveryMode('all');
                  setFilterContractType([]);
                  setFilterExperience([]);
                  setFilterLanguageCodes([]);
                  setFilterBenefits([]);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/55 px-3 py-2 text-xs font-semibold text-slate-700 backdrop-blur-xl transition hover:border-cyan-200/80 hover:text-cyan-700 dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-cyan-500/50 dark:hover:text-cyan-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('careeros.filters.reset', { defaultValue: 'Reset' })}
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
          <div className="mb-4 rounded-[24px] border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.6),rgba(255,255,255,0.28))] p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.72),rgba(15,23,42,0.46))]">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.presets', { defaultValue: 'Reality presets' })}</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setDiscoveryMode('all');
                  setRemoteOnly(false);
                  setFilterWorkArrangement('all');
                  setEnableCommuteFilter(true);
                  setFilterMaxDistance(20);
                }}
                className={cn(filterChipClass, enableCommuteFilter && filterMaxDistance <= 20 ? 'bg-cyan-600 text-white' : filterChipInactiveClass)}
              >
                <span className="inline-flex items-center gap-2"><TrainFront className="h-4 w-4" /> {t('careeros.filters.presets_less_commute', { defaultValue: 'Less commute, less stress' })}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscoveryMode('all');
                  setRemoteOnly(false);
                  setFilterWorkArrangement('remote');
                  setEnableCommuteFilter(false);
                }}
                className={cn(filterChipClass, selectedWorkArrangement === 'remote' && !enableCommuteFilter ? 'bg-cyan-600 text-white' : filterChipInactiveClass)}
              >
                <span className="inline-flex items-center gap-2"><Home className="h-4 w-4" /> {t('careeros.filters.presets_remote_first', { defaultValue: 'Remote first' })}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscoveryMode('all');
                  setFilterMinSalary(60000);
                }}
                className={cn(filterChipClass, filterMinSalary >= 60000 ? 'bg-cyan-600 text-white' : filterChipInactiveClass)}
              >
                <span className="inline-flex items-center gap-2"><Coins className="h-4 w-4" /> {t('careeros.filters.presets_money_first', { defaultValue: 'Money-first' })}</span>
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div className="space-y-3 rounded-[24px] border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.58),rgba(255,255,255,0.26))] p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.72),rgba(15,23,42,0.46))]">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.search', { defaultValue: 'Search' })}</span>
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder={t('careeros.filters.search_placeholder', { defaultValue: 'Role, mission, company' })}
                    className="w-full rounded-[18px] border border-white/70 bg-white/72 px-4 py-3 text-sm text-slate-700 outline-none backdrop-blur-xl focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.city', { defaultValue: 'City / Location' })}</span>
                  <input
                    value={filterCity}
                    onChange={(event) => setFilterCity(event.target.value)}
                    placeholder={t('careeros.filters.city_placeholder', { defaultValue: 'Prague, Vienna...' })}
                    className="w-full rounded-[18px] border border-white/70 bg-white/72 px-4 py-3 text-sm text-slate-700 outline-none backdrop-blur-xl focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[20px] border border-white/60 bg-white/52 p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/60">
                  <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    <span>{t('careeros.filters.commute_distance', { defaultValue: 'Commute Distance' })}</span>
                    <span className="text-cyan-600">{filterMaxDistance} km</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={120}
                    step={5}
                    value={filterMaxDistance}
                    onChange={(event) => setFilterMaxDistance(Number(event.target.value))}
                    className="careeros-cyan-range w-full"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[20, 50, 80].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFilterMaxDistance(value)}
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
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.scope', { defaultValue: 'Scope' })}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      { id: 'all' as const, label: t('careeros.filters.scope_all', { defaultValue: 'All challenges' }) },
                      { id: 'micro_jobs' as const, label: t('careeros.filters.scope_mini', { defaultValue: 'Mini challenges' }) },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setDiscoveryMode(item.id)}
                        className={cn(
                          filterChipClass,
                          discoveryMode === item.id ? 'bg-cyan-600 text-white' : filterChipInactiveClass,
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-white/60 bg-white/52 p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/60">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.transport_mode', { defaultValue: 'Transport mode' })}</div>
                <TransportModeSelector
                  selectedMode={transportMode}
                  onModeChange={setTransportMode}
                  compact
                />
              </div>

              <div className="rounded-[20px] border border-white/60 bg-white/52 p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/60">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.comp_floor', { defaultValue: 'Comp floor' })}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[0, 40000, 60000, 90000].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilterMinSalary(value)}
                      className={cn(
                        filterChipClass,
                          filterMinSalary === value ? 'bg-cyan-600 text-white' : filterChipInactiveClass,
                      )}
                    >
                      {value === 0 ? t('careeros.filters.any', { defaultValue: 'Any' }) : value.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-[24px] border border-white/55 bg-[linear-gradient(135deg,rgba(255,255,255,0.58),rgba(255,255,255,0.26))] p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.72),rgba(15,23,42,0.46))]">
            <div className="rounded-[20px] border border-white/60 bg-white/52 p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/60">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.work_arrangement', { defaultValue: 'Typ práce' })}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('careeros.filters.work_arrangement_desc', { defaultValue: 'Vyber, jestli chceš hlavně práci na dálku, na místě nebo něco mezi tím.' })}</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {([
                  ['remote', t('careeros.filters.arrangement_remote', { defaultValue: 'Remote' })],
                  ['onsite', t('careeros.filters.arrangement_onsite', { defaultValue: 'On-site' })],
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

            <div className="rounded-[20px] border border-white/60 bg-white/52 p-4 backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-900/60">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.search_scope', { defaultValue: 'Kde hledat' })}</div>
              <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('careeros.filters.search_scope_desc', { defaultValue: 'Domácí trh drží jen místní nabídky, příhraničí hlídá dojezd a vše pustí i širší okolí.' })}</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {([
                  ['domestic', t('careeros.filters.scope_domestic', { defaultValue: 'Domácí trh' })],
                  ['border', t('careeros.filters.scope_border', { defaultValue: 'Příhraničí' })],
                  ['all', t('careeros.filters.scope_all_markets', { defaultValue: 'Vše' })],
                ] as Array<['domestic' | 'border' | 'all', string]>).map(([value, label]) => {
                  const active = geographicScope === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setAbroadOnly(false);
                        if (value === 'domestic') {
                          setGlobalSearch(false);
                          setEnableCommuteFilter(false);
                          return;
                        }
                        if (value === 'border') {
                          setGlobalSearch(false);
                          setEnableCommuteFilter(true);
                          return;
                        }
                        setGlobalSearch(true);
                        setEnableCommuteFilter(false);
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

            <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.contract_type', { defaultValue: 'Contract type' })}</div>
            <div className="flex flex-wrap gap-2">
              {['employee', 'contractor'].map((value) => {
                const active = filterContractType.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setFilterContractType(active ? filterContractType.filter((item) => item !== value) : [...filterContractType, value])
                    }
                    className={cn(filterChipClass, active ? 'bg-cyan-600 text-white' : filterChipInactiveClass)}
                  >
                    {value === 'employee' ? t('careeros.filters.employee', { defaultValue: 'Employee' }) : t('careeros.filters.contractor', { defaultValue: 'Contractor' })}
                  </button>
                );
              })}
            </div>

            <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.experience', { defaultValue: 'Experience' })}</div>
            <div className="flex flex-wrap gap-2">
              {['junior', 'medior', 'senior'].map((value) => {
                const active = filterExperience.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setFilterExperience(active ? filterExperience.filter((item) => item !== value) : [...filterExperience, value])
                    }
                    className={cn(filterChipClass, active ? 'bg-cyan-600 text-white' : filterChipInactiveClass)}
                  >
                    {t(`careeros.filters.experience_levels.${value}`, { defaultValue: titleCase(value) })}
                  </button>
                );
              })}
            </div>

            <div className="pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.languages', { defaultValue: 'Languages' })}</div>
            <div className="flex flex-wrap gap-2">
              {(['cs', 'en', 'de', 'pl', 'sk'] as SearchLanguageCode[]).map((value) => {
                const active = filterLanguageCodes.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setFilterLanguageCodes(active ? filterLanguageCodes.filter((item) => item !== value) : [...filterLanguageCodes, value])
                    }
                    className={cn(filterChipClass, active ? 'bg-cyan-600 text-white' : filterChipInactiveClass)}
                  >
                    {value.toUpperCase()}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.filters.life_benefits', { defaultValue: 'Life & benefits' })}</div>
            <div className="flex flex-wrap gap-2">
              {combinedBenefits.map((benefit) => {
                const active = filterBenefits.includes(benefit.key);
                return (
                  <button
                    key={benefit.key}
                    type="button"
                    onClick={() =>
                      setFilterBenefits(active ? filterBenefits.filter((item) => item !== benefit.key) : [...filterBenefits, benefit.key])
                    }
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

            <button
              type="button"
              onClick={onSubmit}
              className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_34px_-22px_rgba(8,145,178,0.7)]"
            >
              {t('careeros.filters.apply', { defaultValue: 'Apply search' })}
              <ChevronRight className="h-4 w-4" />
            </button>
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
    <div className={cn('rounded-[24px] border border-slate-200/80 bg-white/92 p-4 shadow-[0_22px_58px_-30px_rgba(15,23,42,0.48)] backdrop-blur-xl dark:border-slate-800/90 dark:bg-slate-950/88 dark:shadow-[0_28px_70px_-34px_rgba(2,6,23,0.82)]', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
            {t('careeros.map.remap_title', { defaultValue: 'Remap directions' })}
          </div>
          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
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
        <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          {activeFilterCount > 0
            ? t('careeros.map.remap_active', { defaultValue: '{{count}} filters active', count: activeFilterCount })
            : t('careeros.map.remap_system_default', { defaultValue: 'System default is active' })}
        </div>
      )}
    </div>
  );
};

const Navbar: React.FC<any> = () => null;

const Sidebar: React.FC<{
  activeLayer: CareerOSLayer;
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  onNavigate: (layer: CareerOSLayer) => void;
}> = ({
  activeLayer,
  collapsed,
  setCollapsed,
  onNavigate,
}) => {
  const { t } = useTranslation();
  return (
    <aside
      className={cn(
        shellPanel,
        'max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[26px] p-4',
        collapsed ? 'w-24' : 'w-72',
      )}
    >
      <div className="mb-2 flex items-center justify-between px-2 py-2">
        {!collapsed ? <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('careeros.sidebar.title', { defaultValue: 'Reality Filter' })}</h3> : null}
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          className={cn('text-slate-400 transition-transform hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300', collapsed ? 'rotate-90' : '-rotate-90')}
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-2">
        {sidebarLayers.map((layer) => {
          const Icon = layer.icon;
          const active = layer.id === 'career_path' ? activeLayer === 'career_path' || activeLayer === 'job_offers' : activeLayer === layer.id;

          return (
            <button
              key={layer.id}
              type="button"
              onClick={() => onNavigate(layer.id)}
              className={cn(
                'flex items-center gap-3 rounded-xl py-3 font-medium transition-all',
                collapsed ? 'justify-center px-0' : 'px-4',
                active ? 'border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100' : 'border border-transparent text-slate-500 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-900/50',
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  active ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              {!collapsed ? <span className="whitespace-nowrap">{getCareerOSLayerLabel(t, layer.id)}</span> : null}
            </button>
          );
        })}
      </div>

      {!collapsed ? (
        <></>
      ) : null}
    </aside>
  );
};

const CareerPathStage: React.FC<{
  userLabel: string;
  headline: string;
  userProfilePhoto: string | null;
  formattedJobsCount: string;
  formattedActiveCandidates: string;
  nodes: PathNode[];
  selectedPathId: string | null;
  expandedPathId: string | null;
  activeClusterRoleId: string | null;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  onNodeClick: (node: PathNode) => void;
  onClusterRoleClick: (role: RoleNode) => void;
  onOpenOfferLayer: (node: PathNode) => void;
  onCollapseCluster: () => void;
  showDefaultHud: boolean;
  remapOpen: boolean;
  setRemapOpen: React.Dispatch<React.SetStateAction<boolean>>;
  availableDomains: RemapDomainOption[];
  manualDomainSelection: string[];
  setManualDomainSelection: React.Dispatch<React.SetStateAction<string[]>>;
  manualDomainQuery: string;
  setManualDomainQuery: React.Dispatch<React.SetStateAction<string>>;
  interactive?: boolean;
}> = ({ userLabel, headline, userProfilePhoto, formattedJobsCount, formattedActiveCandidates, nodes, selectedPathId, expandedPathId, activeClusterRoleId, zoom, setZoom, onNodeClick, onClusterRoleClick, onOpenOfferLayer, onCollapseCluster, showDefaultHud, remapOpen, setRemapOpen, availableDomains, manualDomainSelection, setManualDomainSelection, manualDomainQuery, setManualDomainQuery, interactive = true }) => {
  const { t } = useTranslation();
  const expandedNode = nodes.find((node) => node.id === expandedPathId) || null;
  const expandedChildren = useMemo(() => buildExpandedClusterChildren(expandedNode), [expandedNode]);
  const remainingExpandedCount = expandedNode ? Math.max(0, expandedNode.roleNodes.length - expandedChildren.length) : 0;
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null);
  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!interactive) return;
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect) {
      const nextX = ((event.clientX - rect.left) / rect.width) * 100;
      const nextY = ((event.clientY - rect.top) / rect.height) * 100;
      setZoomOrigin({
        x: Math.max(0, Math.min(100, nextX)),
        y: Math.max(0, Math.min(100, nextY)),
      });
    }
    stepZoom(setZoom, event.deltaY < 0 ? 'in' : 'out');
  };

  return (
  <div ref={stageRef} className={cn('relative h-full w-full overflow-hidden', !interactive && 'pointer-events-none')} onWheel={handleCanvasWheel}>
    <StageBackground accent="emerald" />
    <motion.div
      drag={interactive}
      dragMomentum={false}
      dragConstraints={{ left: -620, right: 620, top: -520, bottom: 520 }}
      className={cn('absolute inset-0', interactive ? 'cursor-grab active:cursor-grabbing' : '')}
    >
      <div className={cn('absolute inset-0 transition-all duration-300', expandedNode ? 'scale-[0.98] opacity-20 blur-[2px]' : '')}>
        <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%` }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="-900 -560 1800 1120">
          <defs>
            <filter id="careeros-path-line-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {nodes.map((node) => {
            const dist = Math.hypot(node.x, node.y) || 1;
            const dx = node.x / dist;
            const dy = node.y / dist;
            const tone = toneClasses[node.tone];
            const strong = node.gravity === 'strong';
            const elevated = strong || hoveredPathId === node.id || selectedPathId === node.id;

            return (
              <g key={`line-${node.id}`}>
                <line x1={dx * 84} y1={dy * 84} x2={dx * (dist - 52)} y2={dy * (dist - 52)} stroke={tone.line} strokeWidth={elevated ? '1.25' : '1'} opacity={elevated ? '0.24' : '0.2'} />
                <line
                  x1={dx * 84}
                  y1={dy * 84}
                  x2={dx * (dist - 52)}
                  y2={dy * (dist - 52)}
                  stroke={tone.line}
                  strokeWidth={elevated ? '2.4' : '1.8'}
                  strokeDasharray="8 8"
                  filter="url(#careeros-path-line-glow)"
                  opacity={elevated ? '0.86' : '0.64'}
                  style={{ animation: 'careeros-dash-flow 4s linear infinite' }}
                />
              </g>
            );
          })}
            </svg>

            {!expandedNode && showDefaultHud ? (
              <div className="pointer-events-none absolute right-6 top-6 z-[32] min-w-[240px] rounded-[18px] border border-white/70 bg-white/88 px-4 py-3 text-right shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-950/82">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  {t('careeros.map.title', { defaultValue: 'Neural Career Map' })}
                </div>
                <div className="mt-3 grid gap-2">
                  <div className="rounded-2xl border border-slate-200/80 bg-white/78 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/72">
                    <div className="text-[18px] font-bold leading-none text-slate-900 dark:text-slate-100">{formattedJobsCount}</div>
                    <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {t('workspace.feed.stats_jobs_label', { defaultValue: 'V databázi právě máme' })}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {t('workspace.feed.stats_jobs_body', { defaultValue: 'aktivních nabídek.' })}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-cyan-200/70 bg-cyan-50/70 px-3 py-2 dark:border-cyan-900/60 dark:bg-cyan-950/18">
                    <div className="flex items-center justify-end gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-cyan-500 shadow-[0_0_0_4px_rgba(6,182,212,0.12)] dark:bg-cyan-300" />
                      <div className="text-[18px] font-bold leading-none text-slate-900 dark:text-slate-100">{formattedActiveCandidates}</div>
                    </div>
                    <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {t('workspace.feed.stats_live_label', { defaultValue: 'Právě ve výzvách' })}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {t('workspace.feed.stats_live_body', { defaultValue: 'Počet uchazečů online' })}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
          <div className="flex flex-col items-center">
            <div className="relative flex h-[124px] w-[124px] items-center justify-center rounded-full border border-emerald-500/30 bg-white shadow-[inset_0_0_20px_rgba(16,185,129,0.1),0_10px_40px_rgba(16,185,129,0.2)] backdrop-blur-xl dark:border-cyan-500/30 dark:bg-slate-950/90 dark:shadow-[inset_0_0_20px_rgba(8,145,178,0.18),0_10px_40px_rgba(8,145,178,0.18)]">
              <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-emerald-500/10 to-orange-500/10 blur-md" />
              <div className="relative z-10 h-[104px] w-[104px] overflow-hidden rounded-full border-2 border-white shadow-md dark:border-slate-800">
                <NodeImage
                  src={userProfilePhoto}
                  alt={userLabel}
                  fallback={initials(userLabel)}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white/90 px-5 py-2 text-center shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-slate-950 dark:shadow-[0_24px_64px_rgba(2,6,23,0.55)]">
              <div className="text-[15px] font-bold text-slate-800 dark:text-slate-100">{userLabel}</div>
              <div className="text-[13px] font-medium text-cyan-600 dark:text-cyan-300">{compactText(headline.replace(/^Map the next move for /i, ''), 34)}</div>
            </div>
          </div>
            </div>

            <AnimatePresence>
          {nodes.map((node, index) => {
            const tone = toneClasses[node.tone];
            const active = selectedPathId === node.id;
            const strong = node.gravity === 'strong';
            const elevated = strong || hoveredPathId === node.id || active;

            return (
              <div key={node.id} className="absolute left-1/2 top-1/2 z-20" style={{ transform: 'translate(-50%, -50%)' }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.88, x: 0, y: 0 }}
                  animate={{ opacity: elevated ? 1 : 0.88, scale: elevated ? 1.04 : 0.96, x: node.x, y: node.y }}
                  transition={{ delay: index * 0.05, type: 'spring', stiffness: 220, damping: 18 }}
                  className="relative flex flex-col items-center"
                >
                  <button
                    type="button"
                    onClick={() => onNodeClick(node)}
                    onMouseEnter={() => interactive && setHoveredPathId(node.id)}
                    onMouseLeave={() => interactive && setHoveredPathId((current) => (current === node.id ? null : current))}
                    onFocus={() => interactive && setHoveredPathId(node.id)}
                    onBlur={() => interactive && setHoveredPathId((current) => (current === node.id ? null : current))}
                    disabled={!interactive}
                    className={cn(
                      'group relative flex flex-col items-center justify-start rounded-[28px] border border-transparent bg-transparent px-3 pt-2 transition-all duration-200 hover:scale-105',
                      elevated ? 'h-[182px] w-[226px]' : 'h-[170px] w-[206px]',
                      active ? 'scale-105' : '',
                    )}
                  >
                    <div
                      className={cn(
                        'relative flex items-center justify-center rounded-full border bg-white/88 backdrop-blur-md transition-all duration-200 group-hover:scale-110 dark:bg-slate-950/82',
                        elevated ? 'h-[90px] w-[90px]' : 'h-[80px] w-[80px]',
                        tone.ring,
                        tone.glow,
                        active ? 'border-emerald-400 shadow-[0_0_34px_rgba(16,185,129,0.28)]' : '',
                      )}
                    >
                      <div className={cn('absolute inset-1 rounded-full opacity-20 blur-md', node.tone === 'emerald' ? 'bg-emerald-500' : 'bg-orange-500')} />
                    {node.challengeCount > 1 ? (
                      <div className={cn('relative z-10 overflow-hidden rounded-full border border-white shadow-sm', elevated ? 'h-[68px] w-[68px]' : 'h-[58px] w-[58px]')}>
                        <NodeImage
                          src={node.imageUrl}
                          alt={node.title}
                          fallback={initials(node.title)}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-900/26" />
                        <div className="absolute inset-x-0 bottom-1 flex items-center justify-center gap-1 text-white">
                          <Layers className="h-3.5 w-3.5" />
                          <span className="text-[10px] font-bold">{node.challengeCount}</span>
                        </div>
                      </div>
                    ) : (
                      <div className={cn('relative z-10 overflow-hidden rounded-full border border-white shadow-sm', elevated ? 'h-[66px] w-[66px]' : 'h-[56px] w-[56px]')}>
                        <NodeImage
                          src={node.imageUrl}
                          alt={node.title}
                          fallback={initials(node.title)}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                      <div className="absolute -right-1 -top-1 rounded-full border border-white bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                        {node.challengeCount}
                      </div>
                    </div>

                    <div
                      className={cn(
                        'mt-2 w-full rounded-2xl border text-center shadow-sm backdrop-blur-md transition-colors',
                        elevated ? 'px-4 py-3.5' : 'px-3.5 py-3.5',
                        active ? 'border-cyan-200 bg-white/95 dark:border-cyan-500/50 dark:bg-slate-950/90' : 'border-slate-200/80 bg-white/88 dark:border-slate-800 dark:bg-slate-950/78',
                      )}
                    >
                      <div
                        className="min-h-[2.5rem] text-[13px] font-bold leading-tight text-slate-800 dark:text-slate-100"
                        style={twoLineClampStyle}
                        title={node.title}
                      >
                        {node.title}
                      </div>
                      <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-cyan-600 dark:text-cyan-300">
                        {t('careeros.map.career_direction', { defaultValue: 'Career direction' })}
                      </div>
                      <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        {node.subtitle}
                      </div>
                      <div className="mt-2 text-[10px] leading-4 text-slate-600 dark:text-slate-300">
                        {compactText(node.preview || node.summary, elevated ? 84 : 64)}
                      </div>
                    </div>
                  </button>

                </motion.div>
              </div>
            );
          })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
    {!expandedNode && showDefaultHud ? (
      <>
        <DomainRemapPanel
          remapOpen={remapOpen}
          setRemapOpen={setRemapOpen}
          availableDomains={availableDomains}
          manualDomainSelection={manualDomainSelection}
          setManualDomainSelection={setManualDomainSelection}
          manualDomainQuery={manualDomainQuery}
          setManualDomainQuery={setManualDomainQuery}
          className="absolute bottom-6 right-6 z-[32] w-[min(26rem,calc(100vw-3rem))]"
        />
        <CanvasControls
          zoom={zoom}
          setZoom={setZoom}
          className="absolute bottom-6 left-6 z-[32] w-auto"
        />
      </>
    ) : null}
    <AnimatePresence>
      {expandedNode ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[40] bg-white/18 backdrop-blur-[6px] dark:bg-slate-950/40"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute left-8 top-8 z-[42] flex items-center gap-3 lg:left-[312px]">
              <button
                type="button"
                onClick={onCollapseCluster}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/92 px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-950/82 dark:text-slate-200"
              >
                <ChevronLeft className="h-4 w-4" />
                {t('careeros.map.return_to_map', { defaultValue: 'Return to map' })}
              </button>
            </div>

            <div className="pointer-events-none absolute left-1/2 top-8 z-[42] -translate-x-1/2 rounded-full border border-white/70 bg-white/88 px-5 py-2 text-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-950/82 dark:text-slate-400">
              {t('careeros.map.cluster_layer', { defaultValue: 'Cluster Layer' })}
            </div>

            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="-900 -560 1800 1120">
              {expandedChildren.map((child) => {
                const dist = Math.hypot(child.x, child.y) || 1;
                const ux = child.x / dist;
                const uy = child.y / dist;
                return (
                  <g key={`overlay-cluster-line-${child.role.id}`}>
                    <line x1={ux * 66} y1={uy * 66} x2={child.x - ux * 34} y2={child.y - uy * 34} stroke="#60a5fa" strokeWidth="1" opacity="0.24" />
                    <line
                      x1={ux * 66}
                      y1={uy * 66}
                      x2={child.x - ux * 34}
                      y2={child.y - uy * 34}
                      stroke="#60a5fa"
                      strokeWidth="2"
                      strokeDasharray="6 6"
                      opacity="0.82"
                      filter="url(#careeros-path-line-glow)"
                      style={{ animation: 'careeros-dash-flow 4s linear infinite' }}
                    />
                  </g>
                );
              })}
            </svg>

            <div className="absolute left-1/2 top-1/2 z-[42] -translate-x-1/2 -translate-y-1/2">
              <div className="flex flex-col items-center">
                <div className="relative flex h-[148px] w-[148px] items-center justify-center rounded-full border border-emerald-300/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-cyan-500/30 dark:bg-slate-950/90 dark:shadow-[0_18px_40px_rgba(2,6,23,0.45)]">
                  <div className="relative z-10 h-[114px] w-[114px] overflow-hidden rounded-full border-2 border-white shadow-md dark:border-slate-800">
                    <NodeImage
                      src={expandedNode.imageUrl}
                      alt={expandedNode.title}
                      fallback={initials(expandedNode.title)}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-900/26" />
                    <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1 text-white">
                      <Layers className="h-4 w-4" />
                      <span className="text-xs font-bold">{expandedNode.roleNodes.length}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white/92 px-5 py-3 text-center shadow-lg backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/88 dark:shadow-[0_24px_64px_rgba(2,6,23,0.45)]">
                  <div className="text-[15px] font-bold text-slate-800 dark:text-slate-100">{expandedNode.title}</div>
                  <div className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{expandedNode.subtitle}</div>
                  <div className="mt-2 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {t('careeros.map.roles_here', {
                      defaultValue: '{{count}} roles here',
                      count: expandedChildren.length,
                    })}
                    {remainingExpandedCount > 0 ? `, ${t('careeros.map.more_roles', { defaultValue: '{{count}} more roles', count: remainingExpandedCount })}` : ''}
                  </div>
                </div>
                {interactive ? (
                  <button
                    type="button"
                    onClick={() => onOpenOfferLayer(expandedNode)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/92 px-5 py-2.5 text-sm font-semibold text-cyan-700 shadow-sm backdrop-blur-md dark:border-cyan-500/40 dark:bg-slate-950/86 dark:text-cyan-300"
                  >
                    {t('careeros.map.open_top_role_offers', { defaultValue: 'Open top role offers' })}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="mt-4 rounded-full border border-white/70 bg-white/86 px-5 py-2 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/82 dark:text-slate-300">
                    {t('careeros.map.layer_2_cluster', { defaultValue: 'Layer 2: Cluster' })}
                  </div>
                )}
              </div>
            </div>

            {expandedChildren.map((child, index) => {
              const activeChild = activeClusterRoleId === child.role.id;
              return (
                <div key={child.role.id} className="absolute left-1/2 top-1/2 z-[43]" style={{ transform: 'translate(-50%, -50%)' }}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.7, x: 0, y: 0 }}
                    animate={{ opacity: 1, scale: 1, x: child.x, y: child.y }}
                    transition={{ delay: 0.06 * index, type: 'spring', stiffness: 240, damping: 20 }}
                    className="relative flex items-center"
                  >
                    {child.textPos === 'left' ? (
                      <div className="pointer-events-none absolute right-full mr-4 hidden w-[220px] text-right xl:block">
                        <div
                          className="text-[13px] font-semibold leading-5 text-slate-800 dark:text-slate-100"
                          style={twoLineClampStyle}
                          title={child.role.title}
                        >
                          {child.role.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{child.role.subtitle}</div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => onClusterRoleClick(child.role)}
                      className={cn(
                        'relative flex h-[62px] w-[62px] items-center justify-center rounded-full border border-blue-200 bg-white/95 shadow-[0_0_16px_rgba(59,130,246,0.12)] backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-blue-400 dark:border-blue-500/40 dark:bg-slate-950/84 dark:hover:border-blue-400',
                        activeChild ? 'scale-110 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.22)] dark:border-blue-400 dark:shadow-[0_0_24px_rgba(59,130,246,0.26)]' : '',
                      )}
                      >
                        <div className="h-[52px] w-[52px] overflow-hidden rounded-full">
                          <NodeImage
                          src={child.role.imageUrl}
                          alt={child.role.title}
                          fallback={initials(child.role.title)}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </button>

                    {child.textPos === 'right' ? (
                      <div className="pointer-events-none absolute left-full ml-4 hidden w-[220px] text-left xl:block">
                        <div
                          className="text-[13px] font-semibold leading-5 text-slate-800 dark:text-slate-100"
                          style={twoLineClampStyle}
                          title={child.role.title}
                        >
                          {child.role.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{child.role.subtitle}</div>
                      </div>
                    ) : null}
                  </motion.div>
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
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

const JobOffersStage: React.FC<{
  selectedPath: PathNode;
  selectedRole: RoleNode;
  selectedChallengeId: string | null;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  onBack: () => void;
  onOfferClick: (challenge: CareerOSChallenge) => void;
}> = ({ selectedPath, selectedRole, selectedChallengeId, zoom, setZoom, onBack, onOfferClick }) => {
  const { t } = useTranslation();
  const offers = useMemo(() => buildOfferNodes(selectedRole), [selectedRole]);
  const stageRef = useRef<HTMLDivElement>(null);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (rect) {
      const nextX = ((event.clientX - rect.left) / rect.width) * 100;
      const nextY = ((event.clientY - rect.top) / rect.height) * 100;
      setZoomOrigin({
        x: Math.max(0, Math.min(100, nextX)),
        y: Math.max(0, Math.min(100, nextY)),
      });
    }
    stepZoom(setZoom, event.deltaY < 0 ? 'in' : 'out');
  };

  return (
    <div ref={stageRef} className="relative h-full w-full overflow-hidden" onWheel={handleCanvasWheel}>
      <StageBackground accent="blue" />
      <button
        type="button"
        onClick={onBack}
        className="absolute left-8 top-8 z-[90] inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/90 px-5 py-2.5 text-sm font-semibold text-cyan-600 shadow-[0_0_16px_rgba(8,145,178,0.12)] backdrop-blur-md transition-all hover:-translate-x-1 hover:bg-white dark:!border-slate-700/90 dark:!bg-slate-950 dark:!text-slate-100 dark:hover:!bg-slate-900 lg:left-[312px]"
      >
        <ChevronLeft className="h-5 w-5" />
        {t('careeros.offers_stage.return_to_roles', { defaultValue: 'Return to roles' })}
      </button>

      <div className="absolute left-1/2 top-8 z-30 -translate-x-1/2 text-center">
        <h2 className="text-lg font-medium uppercase tracking-[0.22em] text-cyan-600 drop-shadow-[0_0_10px_rgba(8,145,178,0.2)] dark:text-cyan-300">
          {t('careeros.offers_stage.active_opportunities', { defaultValue: 'Active opportunities' })}: {selectedRole.title}
        </h2>
        <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{selectedPath.title}</div>
      </div>

      <motion.div
        drag
        dragMomentum={false}
        dragConstraints={{ left: -540, right: 540, top: -420, bottom: 420 }}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      >
        <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%` }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="-900 -560 1800 1120">
            <defs>
              <filter id="careeros-offer-line-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {offers.map((offer) => {
              const dist = Math.hypot(offer.x, offer.y) || 1;
              const dx = offer.x / dist;
              const dy = offer.y / dist;
              return (
                <g key={`offer-line-${offer.challenge.id}`}>
                  <line x1={dx * 88} y1={dy * 88} x2={dx * (dist - 48)} y2={dy * (dist - 48)} stroke="#60a5fa" strokeWidth="1" opacity="0.22" />
                  <line
                    x1={dx * 88}
                    y1={dy * 88}
                    x2={dx * (dist - 48)}
                    y2={dy * (dist - 48)}
                    stroke="#60a5fa"
                    strokeWidth="2"
                    strokeDasharray="6 6"
                    opacity="0.75"
                    filter="url(#careeros-offer-line-glow)"
                    style={{ animation: 'careeros-dash-flow 4s linear infinite' }}
                  />
                </g>
              );
            })}
            </svg>

            <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
            <div className="flex flex-col items-center">
              <div className="relative flex h-[140px] w-[140px] items-center justify-center rounded-full border-2 border-emerald-400 bg-white shadow-[inset_0_0_30px_rgba(16,185,129,0.1),0_0_50px_rgba(16,185,129,0.2)] backdrop-blur-xl dark:border-cyan-500/30 dark:bg-slate-950/90 dark:shadow-[inset_0_0_30px_rgba(8,145,178,0.16),0_0_50px_rgba(8,145,178,0.12)]">
                <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-ping opacity-45" />
                <div className="relative z-10 h-[116px] w-[116px] overflow-hidden rounded-full border-2 border-white shadow-md dark:border-slate-800">
                  <NodeImage
                    src={selectedRole.imageUrl || selectedPath.imageUrl}
                    alt={selectedRole.title}
                    fallback={initials(selectedRole.title)}
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
              <div className="mt-4 rounded-full border border-cyan-200 bg-white/90 px-6 py-2 shadow-[0_0_15px_rgba(8,145,178,0.1)] backdrop-blur-md dark:!border-slate-700/90 dark:!bg-slate-950">
                <div className="text-[16px] font-bold text-cyan-600 dark:!text-slate-100">{selectedRole.title}</div>
              </div>
            </div>
            </div>

            <AnimatePresence>
            {offers.map((offer, index) => {
              const active = selectedChallengeId === offer.challenge.id;
              return (
                <div key={offer.challenge.id} className="absolute left-1/2 top-1/2 z-20" style={{ transform: 'translate(-50%, -50%)' }}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.88, x: 0, y: 0 }}
                    animate={{ opacity: 1, scale: 1, x: offer.x, y: offer.y }}
                    transition={{ delay: index * 0.06, type: 'spring', stiffness: 220, damping: 18 }}
                  >
                    <button type="button" onClick={() => onOfferClick(offer.challenge)} className="group relative flex flex-col items-center">
                      <div
                        className={cn(
                          'relative flex h-[74px] w-[74px] items-center justify-center rounded-full border border-blue-200 bg-white/86 shadow-[0_0_16px_rgba(59,130,246,0.1)] backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:border-blue-400 group-hover:shadow-[0_0_26px_rgba(59,130,246,0.2)] dark:border-blue-500/40 dark:bg-slate-950/82',
                          active ? 'scale-110 border-blue-400 shadow-[0_0_26px_rgba(59,130,246,0.25)]' : '',
                        )}
                      >
                        <div className="absolute inset-1 rounded-full bg-blue-500/10 blur-sm" />
                        <div className="relative z-10 h-[62px] w-[62px] overflow-hidden rounded-full border border-white/70">
                          <NodeImage
                            src={offer.challenge.coverImageUrl || offer.challenge.avatarUrl}
                            alt={offer.challenge.title}
                            fallback={initials(offer.challenge.company)}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>

                      <div
                        className={cn(
                          'pointer-events-none absolute w-[148px] rounded-[18px] border px-3 py-2 text-center shadow-sm backdrop-blur-md transition-colors',
                          offer.labelPlacement === 'left' && 'right-full mr-6 top-1/2 -translate-y-1/2',
                          offer.labelPlacement === 'right' && 'left-full ml-6 top-1/2 -translate-y-1/2',
                          offer.labelPlacement === 'top' && 'bottom-full mb-4 left-1/2 -translate-x-1/2',
                          offer.labelPlacement === 'bottom' && 'top-full mt-4 left-1/2 -translate-x-1/2',
                          active ? 'border-blue-200 bg-white/96 dark:border-blue-500/50 dark:bg-slate-950/90' : 'border-slate-200/80 bg-white/88 dark:border-slate-800 dark:bg-slate-950/78',
                        )}
                      >
                        <div className="text-[11px] font-semibold leading-tight text-slate-800 dark:text-slate-100">{compactText(offer.challenge.company, 24)}</div>
                        <div className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{compactText(offer.challenge.title, 34)}</div>
                      </div>
                    </button>
                  </motion.div>
                </div>
              );
            })}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const PathPanel: React.FC<{
  node: PathNode | null;
  expanded: boolean;
  visible: boolean;
  onClose: () => void;
  onToggleExpand: () => void;
  onExploreOffers: () => void;
  onPreviewRole: (role: RoleNode) => void;
}> = ({ node, expanded, visible, onClose, onToggleExpand, onExploreOffers, onPreviewRole }) => {
  const { t } = useTranslation();
  return (
  <AnimatePresence>
    {node && visible ? (
      <motion.aside
        initial={{ x: 420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className={cn(shellPanel, 'absolute bottom-6 right-6 top-6 z-[66] hidden w-[350px] overflow-hidden rounded-[28px] xl:block')}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-5 pb-4 pt-5 dark:border-slate-800/80">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">{t('careeros.path_panel.title', { defaultValue: 'Career Node' })}</div>
              <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-800 dark:text-slate-100">{node.title}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('careeros.path_panel.roles_in_domain', { defaultValue: '{{count}} role lanes in this domain', count: node.roleNodes.length })}</div>
            </div>
            <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {node.tags.map((tag) => (
                <span key={tag} className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold', toneClasses[node.tone].chip)}>
                  {tag}
                </span>
              ))}
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-300">{node.summary}</p>

            <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/75">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.path_panel.top_role', { defaultValue: 'Top role lane' })}</div>
              <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{node.roleNodes[0]?.title || node.featuredChallenge.title}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{node.roleNodes[0]?.subtitle || node.featuredChallenge.company}</div>
            </div>

            <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.path_panel.inside_cluster', { defaultValue: 'Inside this cluster' })}</div>
              <div className="mt-3 space-y-2">
                {node.roleNodes.slice(0, 5).map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => onPreviewRole(role)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-cyan-300 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-cyan-500/50"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{compactText(role.title, 30)}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{role.subtitle}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-slate-800/80">
            <button
              type="button"
              onClick={onToggleExpand}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200"
            >
              {expanded ? t('careeros.path_panel.collapse', { defaultValue: 'Collapse cluster' }) : t('careeros.path_panel.expand', { defaultValue: 'Expand cluster' })}
            </button>
            <button
              type="button"
              onClick={onExploreOffers}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {t('careeros.path_panel.open_offer_layer', { defaultValue: 'Open offer layer' })}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </motion.aside>
    ) : null}
  </AnimatePresence>
  );
};

const ChallengePanel: React.FC<{
  challenge: CareerOSChallenge | null;
  onClose: () => void;
  onOpenChallenge: () => void;
  onToggleSave: () => void;
  onOpenCompany: (() => void) | null;
}> = ({ challenge, onClose, onOpenChallenge, onToggleSave, onOpenCompany }) => {
  const { t } = useTranslation();
  return (
  <AnimatePresence>
    {challenge ? (
      <motion.aside
        initial={{ x: 420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 24 }}
        className={cn(shellPanel, 'absolute bottom-6 right-6 top-6 z-[66] hidden w-[350px] overflow-hidden rounded-[28px] xl:block')}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-5 pb-4 pt-5 dark:border-slate-800/80">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-300">
                {challenge.listingKind === 'imported'
                  ? t('careeros.challenge_panel.imported', { defaultValue: 'Imported opportunity' })
                  : t('careeros.challenge_panel.selected', { defaultValue: 'Selected offer' })}
              </div>
              <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-800 dark:text-slate-100">{challenge.title}</div>
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {challenge.company} · {challenge.location}
              </div>
            </div>
            <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {challenge.topTags.map((tag) => (
                <span key={tag} className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold', toneClasses[challengeTone(challenge)].chip)}>
                  {tag}
                </span>
              ))}
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-700 dark:text-slate-300">{challenge.challengeSummary}</p>

            <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/75">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('careeros.challenge_panel.handshake_move', { defaultValue: 'First handshake move' })}</div>
              <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{challenge.firstStepPrompt}</div>
            </div>

            <div className="mt-3 rounded-[20px] border border-slate-200 bg-slate-50/85 p-4 dark:!border-slate-700/90 dark:!bg-slate-950">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:!text-cyan-300">{t('careeros.challenge_panel.reality', { defaultValue: 'Reality' })}</div>
              <div className="mt-2 text-sm leading-6 text-slate-700 dark:!text-slate-200">{challenge.riskSummary}</div>
            </div>
          </div>

          <div className="grid gap-2 border-t border-slate-200/80 px-5 py-4 dark:border-slate-800/80">
            <button
              type="button"
              onClick={onOpenChallenge}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(8,145,178,0.22)]"
            >
              {t('careeros.challenge_panel.open_full', { defaultValue: 'Open full challenge' })}
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleSave}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200"
            >
              {challenge.isSaved ? t('careeros.challenge_panel.saved', { defaultValue: 'Saved' }) : t('careeros.challenge_panel.save', { defaultValue: 'Save challenge' })}
            </button>
            {onOpenCompany ? (
              <button
                type="button"
                onClick={onOpenCompany}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200"
              >
                {t('careeros.challenge_panel.open_company', { defaultValue: 'Open company' })}
              </button>
            ) : null}
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
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/72 dark:text-slate-300">{card.scope}</span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950/72 dark:text-slate-300">{card.reward}</span>
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
  onOpenCompanyPage,
  onOpenCompaniesLanding,
  initialNavigationState,
  onNavigationStateChange,
}) => {
  const initialSelectedPathId = initialNavigationState?.selectedPathId ?? null;
  const initialExpandedPathId = initialNavigationState?.expandedPathId ?? null;
  const initialActiveLayer = initialNavigationState?.activeLayer ?? 'career_path';
  const initialCanvasZoom = Number.isFinite(initialNavigationState?.canvasZoom)
    ? Math.max(0.72, Math.min(1.4, Number(initialNavigationState?.canvasZoom)))
    : 0.94;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState<CareerOSNotification[]>([]);
  const [profileMiniChallenges, setProfileMiniChallenges] = useState<Job[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [notificationsStorageHydrated, setNotificationsStorageHydrated] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [domainRemapOpen, setDomainRemapOpen] = useState(false);
  const [manualDomainSelection, setManualDomainSelection] = useState<string[]>([]);
  const [manualDomainQuery, setManualDomainQuery] = useState('');
  const [databaseJobCount, setDatabaseJobCount] = useState<number | null>(null);
  const [liveCandidateDelta, setLiveCandidateDelta] = useState(0);
  const [learningResources, setLearningResources] = useState<LearningResource[]>([]);
  const [learningResourcesLoading, setLearningResourcesLoading] = useState(false);

  const workspace = useMemo(
    () =>
      mapJobsToCareerOSCandidateWorkspace({
        jobs,
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
      }),
    [
      jobs,
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
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [panelChallenge, setPanelChallenge] = useState<CareerOSChallenge | null>(() => {
    const initialPanelChallengeId = initialNavigationState?.panelChallengeId;
    if (!initialPanelChallengeId) return null;
    return workspace.challenges.find((challenge) => challenge.id === initialPanelChallengeId) || null;
  });
  const [panelDismissed, setPanelDismissed] = useState<boolean>(initialNavigationState?.panelDismissed ?? true);
  const [canvasZoom, setCanvasZoom] = useState(initialCanvasZoom);
  const { t, i18n } = useTranslation();
  const activeLocale = String(i18n.resolvedLanguage || i18n.language || userProfile.preferredLocale || 'en');
  const dbCountCacheKey = 'jobshaman:workspace:global-job-count';
  const careerPathRequiresSetup = !userProfile.isLoggedIn || !hasCareerPathProfileSignal(userProfile);
  const isGuestCareerPath = !userProfile.isLoggedIn;

  const pathNodes = useMemo(
    () => buildPathNodes(jobs, workspace.challenges, userProfile, t, manualDomainSelection, manualDomainQuery),
    [jobs, manualDomainQuery, manualDomainSelection, t, workspace.challenges, userProfile],
  );

  const selectedPath = useMemo(
    () => pathNodes.find((node) => node.id === selectedPathId) || pathNodes[0] || null,
    [pathNodes, selectedPathId],
  );
  const selectedRole = useMemo(
    () => selectedPath?.roleNodes.find((role) => role.id === selectedRoleId) || selectedPath?.roleNodes[0] || null,
    [selectedPath, selectedRoleId],
  );

  const benefitCandidates = useMemo(() => topFilterCandidates(jobs), [jobs]);
  const visibleJobsCount = Math.max(0, databaseJobCount ?? 0);
  const formattedJobsCount = useMemo(
    () => (databaseJobCount === null ? '...' : new Intl.NumberFormat(activeLocale).format(visibleJobsCount)),
    [activeLocale, databaseJobCount, visibleJobsCount],
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
      const discovered = jobs
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
    [jobs, t, i18n.language, userProfile.preferences?.searchProfile?.primaryDomain, userProfile.preferences?.searchProfile?.secondaryDomains],
  );
  const scopedMarketJobs = useMemo(() => {
    if (selectedPath?.challenges?.length) {
      const selectedIds = new Set(selectedPath.challenges.map((challenge) => challenge.id));
      const matching = jobs.filter((job) => selectedIds.has(String(job.id)));
      if (matching.length > 0) return matching;
    }
    return jobs.slice(0, 12);
  }, [jobs, selectedPath]);

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
  }, [dbCountCacheKey]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
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
  }, [learningResourceSearchTerms, userProfile.preferences?.desired_role, userProfile.preferences?.searchProfile]);

  const learningGapAnalysis = useMemo(
    () => buildLearningGapAnalysis(userProfile, selectedPath, workspace.challenges, learningResources, learningResourcesLoading, t),
    [learningResources, learningResourcesLoading, selectedPath, t, userProfile, workspace.challenges],
  );
  const marketTrendAnalysis = useMemo(
    () => buildMarketTrendAnalysis(scopedMarketJobs, selectedPath, userProfile, t),
    [scopedMarketJobs, selectedPath, t, userProfile],
  );
  const miniChallengeCards = useMemo(
    () => buildMiniChallengeCards(jobs, profileMiniChallenges, userProfile, t),
    [jobs, profileMiniChallenges, t, userProfile],
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
      jobs: jobs.length,
      workspaceChallenges: workspace.challenges.length,
      pathNodes: pathNodes.length,
      selectedPathId,
      selectedPathChallenges: selectedPath?.challenges.length || 0,
    });
  }, [jobs.length, pathNodes.length, selectedPath?.challenges.length, selectedPathId, workspace.challenges.length]);

  useEffect(() => {
    if (activeLayer === 'market_trends' && !MARKET_TRENDS_ENABLED) {
      setActiveLayer('career_path');
    }
  }, [activeLayer]);

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
    if (!selectedPath?.roleNodes?.length) {
      setSelectedRoleId(null);
      return;
    }
    if (!selectedRoleId || !selectedPath.roleNodes.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId(selectedPath.roleNodes[0].id);
    }
  }, [selectedPath, selectedRoleId]);

  useEffect(() => {
    if (!onNavigationStateChange) return;
    onNavigationStateChange({
      activeLayer,
      selectedPathId,
      expandedPathId,
      panelChallengeId: panelChallenge?.id || null,
      panelDismissed,
      canvasZoom,
    });
  }, [activeLayer, canvasZoom, expandedPathId, onNavigationStateChange, panelChallenge?.id, panelDismissed, selectedPathId]);

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
        setNotificationItems(items);
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
    let cancelled = false;

    const loadProfileMiniChallenges = async () => {
      if (!userProfile.isLoggedIn) {
        if (!cancelled) setProfileMiniChallenges([]);
        return;
      }
      try {
        const jobs = await listProfileMiniChallenges();
        if (!cancelled) {
          setProfileMiniChallenges(jobs);
        }
      } catch (error) {
        console.warn('[CareerOS] Failed to load profile mini challenges:', error);
        if (!cancelled) {
          setProfileMiniChallenges([]);
        }
      }
    };

    void loadProfileMiniChallenges();
    return () => {
      cancelled = true;
    };
  }, [userProfile.id, userProfile.isLoggedIn]);

  useEffect(() => {
    if (activeLayer !== 'job_offers') {
      setPanelChallenge(null);
    }
  }, [activeLayer]);

  const submitSearch = () => {
    setFiltersOpen(false);
    setActiveLayer('career_path');
    setPanelChallenge(null);
    performSearch(searchTerm);
  };

  const handlePathNodeClick = (node: PathNode) => {
    setSelectedPathId(node.id);
    setSelectedRoleId(node.roleNodes[0]?.id || null);
    setPanelDismissed(false);
    setExpandedPathId(node.id);
  };

  const handleOfferClick = (challenge: CareerOSChallenge) => {
    setPanelDismissed(false);
    setPanelChallenge(challenge);
  };

  const handleRoleNodeClick = (role: RoleNode) => {
    setSelectedRoleId(role.id);
    setPanelDismissed(false);
    setPanelChallenge(role.featuredChallenge);
    setActiveLayer('job_offers');
  };

  const handleSidebarNavigate = (layer: CareerOSLayer) => {
    setPanelDismissed(false);
    if (layer === 'market_trends' && !MARKET_TRENDS_ENABLED) {
      setActiveLayer('career_path');
      setExpandedPathId(null);
      setPanelDismissed(true);
      setPanelChallenge(null);
      return;
    }
    if (layer === 'career_path') {
      setActiveLayer('career_path');
      setExpandedPathId(null);
      setPanelDismissed(true);
      setPanelChallenge(null);
      return;
    }
    setActiveLayer(layer);
  };

  const handleNotificationAction = (notification: CareerOSNotification) => {
    setNotificationsOpen(false);
    setReadNotificationIds((current) => Array.from(new Set([...current, notification.id])));
    if (notification.kind === 'high_match' && notification.challengeId) {
      handleJobSelect(notification.challengeId);
      return;
    }
    onOpenProfile();
  };

  const renderMainLayer = () => {
    if (activeLayer === 'career_path') {
      if (careerPathRequiresSetup) {
        return (
          <CareerPathSetupState
            isGuest={isGuestCareerPath}
            onOpenAuth={onOpenAuth}
            onOpenProfile={onOpenProfile}
          />
        );
      }
    }

    if (activeLayer === 'career_path' || !selectedPath) {
      return (
        <CareerPathStage
          userLabel={workspace.userLabel}
          headline={workspace.headline}
          userProfilePhoto={safeImage(userProfile.photo)}
          formattedJobsCount={formattedJobsCount}
          formattedActiveCandidates={formattedActiveCandidates}
          nodes={pathNodes}
          selectedPathId={selectedPath?.id || null}
          expandedPathId={expandedPathId}
          activeClusterRoleId={selectedRole?.id || null}
          zoom={canvasZoom}
          setZoom={setCanvasZoom}
          onNodeClick={handlePathNodeClick}
          onClusterRoleClick={handleRoleNodeClick}
          onOpenOfferLayer={(node) => {
            setSelectedPathId(node.id);
            setSelectedRoleId(node.roleNodes[0]?.id || null);
            setPanelDismissed(false);
            setPanelChallenge(node.roleNodes[0]?.featuredChallenge || node.featuredChallenge);
            setActiveLayer('job_offers');
          }}
          onCollapseCluster={() => setExpandedPathId(null)}
          showDefaultHud={activeLayer === 'career_path' && !expandedPathId}
          remapOpen={domainRemapOpen}
          setRemapOpen={setDomainRemapOpen}
          availableDomains={availableDomains}
          manualDomainSelection={manualDomainSelection}
          setManualDomainSelection={setManualDomainSelection}
          manualDomainQuery={manualDomainQuery}
          setManualDomainQuery={setManualDomainQuery}
        />
      );
    }

    if (activeLayer === 'job_offers' && selectedPath && selectedRole) {
      return (
        <JobOffersStage
          selectedPath={selectedPath}
          selectedRole={selectedRole}
          selectedChallengeId={panelChallenge?.id || null}
          zoom={canvasZoom}
          setZoom={setCanvasZoom}
          onBack={() => {
            setActiveLayer('career_path');
            setPanelChallenge(null);
            setExpandedPathId(selectedPath?.id || null);
          }}
          onOfferClick={handleOfferClick}
        />
      );
    }

    if (activeLayer === 'learning_path') {
      return <LearningPathView analysis={learningGapAnalysis} onOpenProfile={onOpenProfile} />;
    }

    if (activeLayer === 'marketplace') {
      return (
        <div className="relative h-full overflow-y-auto px-4 pb-8 pt-6 lg:pl-[320px] lg:pr-6">
          <NeuralCircuitTexture className="pointer-events-none absolute inset-0 opacity-[0.34]" />
          <div className="pointer-events-none absolute left-[14%] top-[12%] h-[320px] w-[320px] rounded-full bg-emerald-300/10 blur-[120px]" />
          <div className="pointer-events-none absolute bottom-[10%] right-[12%] h-[420px] w-[420px] rounded-full bg-sky-300/10 blur-[140px]" />
          <div className="relative z-10">
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
  };

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

      <div className="absolute left-6 top-6 z-[72] hidden lg:flex lg:flex-col lg:gap-4">
        <Sidebar
          activeLayer={activeLayer}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          onNavigate={handleSidebarNavigate}
        />
        {!(activeLayer === 'career_path' && !expandedPathId) && (activeLayer === 'career_path' || activeLayer === 'job_offers') ? (
          <CanvasControls
            zoom={canvasZoom}
            setZoom={setCanvasZoom}
            className={cn('self-start', sidebarCollapsed ? 'w-24' : 'w-72')}
          />
        ) : null}
      </div>

      <div className="absolute inset-0">{renderMainLayer()}</div>

      <PathPanel
        node={selectedPath}
        visible={!careerPathRequiresSetup && !panelDismissed && activeLayer === 'career_path' && expandedPathId === selectedPath?.id}
        expanded={expandedPathId === selectedPath?.id}
        onClose={() => setPanelDismissed(true)}
        onToggleExpand={() => {
          if (!selectedPath) return;
          setExpandedPathId((current) => (current === selectedPath.id ? null : selectedPath.id));
        }}
        onExploreOffers={() => {
          if (!selectedPath || !selectedRole) return;
          setExpandedPathId(selectedPath.id);
          setPanelChallenge(selectedRole.featuredChallenge);
          setActiveLayer('job_offers');
        }}
        onPreviewRole={handleRoleNodeClick}
      />

      <ChallengePanel
        challenge={!panelDismissed && activeLayer === 'job_offers' ? panelChallenge || selectedRole?.featuredChallenge || null : null}
        onClose={() => setPanelDismissed(true)}
        onOpenChallenge={() => {
          const target = panelChallenge || selectedRole?.featuredChallenge;
          if (target) handleJobSelect(target.id);
        }}
        onToggleSave={() => {
          const target = panelChallenge || selectedRole?.featuredChallenge;
          if (target) handleToggleSave(target.id);
        }}
        onOpenCompany={
          (panelChallenge || selectedRole?.featuredChallenge)?.companyId
            ? () => onOpenCompanyPage(String((panelChallenge || selectedRole?.featuredChallenge)?.companyId))
            : null
        }
      />
    </div>
  );
};

export default CareerOSCandidateWorkspace;
