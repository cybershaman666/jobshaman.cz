import type { JHI, JHIPreferences, JobWorkArrangementFilter, StoredAsset, TaxProfile, TransportMode } from '../types';

export type RoleSource = 'curated' | 'imported';
export type MarketplaceCountryCode = 'CZ' | 'SK' | 'PL' | 'DE' | 'AT' | 'FI' | 'SE' | 'NO' | 'DK' | string;
export type RoleFamily =
  | 'engineering'
  | 'design'
  | 'product'
  | 'operations'
  | 'sales'
  | 'care'
  | 'frontline'
  | 'marketing'
  | 'finance'
  | 'people'
  | 'education'
  | 'health'
  | 'construction'
  | 'logistics'
  | 'legal';

export type BlueprintStepType =
  | 'identity'
  | 'motivation'
  | 'skill_alignment'
  | 'scenario_response'
  | 'portfolio_or_proof'
  | 'task_workspace'
  | 'reflection'
  | 'jcfpm_profile'
  | 'results_summary'
  | 'schedule_request';

export interface CompanyBrandTheme {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
  glow: string;
}

export interface ReviewerProfile {
  name: string;
  role: string;
  avatarUrl: string;
  intro: string;
  meetingLabel: string;
  durationMinutes: number;
  tool: string;
}

export interface Company {
  id: string;
  name: string;
  tagline: string;
  domain: string;
  industry?: string;
  tone?: string;
  values?: string[];
  philosophy?: string;
  headquarters: string;
  narrative: string;
  coverImage: string;
  logo: string;
  logoAsset?: StoredAsset | null;
  coverAsset?: StoredAsset | null;
  gallery: StoredAsset[];
  handshakeMaterials: StoredAsset[];
  theme: CompanyBrandTheme;
  reviewer: ReviewerProfile;
  reviewerAvatarAsset?: StoredAsset | null;
}

export interface HandshakeBlueprintStep {
  id: string;
  type: BlueprintStepType;
  title: string;
  prompt: string;
  helper: string;
  required: boolean;
  uiVariant: 'split_form' | 'story_field' | 'signal_matrix' | 'workspace' | 'result_panel' | 'scheduler';
}

export interface HandshakeBlueprint {
  id: string;
  name: string;
  roleFamily: RoleFamily;
  tone: 'visionary' | 'technical' | 'human' | 'precision';
  overview: string;
  benchmarkLabels: string[];
  aiGeneratorNote: string;
  scheduleEnabled: boolean;
  steps: HandshakeBlueprintStep[];
}

export interface RoleSlotAvailability {
  available: boolean;
  reason?: string | null;
  existingHandshakeId?: string | null;
  candidate?: { active: number; limit: number; remaining: number };
  companyChallenge?: { active: number; limit: number; remaining: number };
}

export interface Role {
  id: string;
  companyId: string;
  companyName?: string;
  companyLogo?: string;
  companyCoverImage?: string;
  companyNarrative?: string;
  title: string;
  team: string;
  location: string;
  countryCode: MarketplaceCountryCode;
  workModel: 'Remote' | 'Hybrid' | 'On-site';
  source: RoleSource;
  roleFamily: RoleFamily;
  level: 'Junior' | 'Mid' | 'Senior' | 'Lead';
  salaryFrom: number;
  salaryTo: number;
  currency: 'CZK' | 'EUR' | 'PLN';
  heroImage: string;
  summary: string;
  challenge: string;
  mission: string;
  firstStep: string;
  description: string;
  roleSummary?: string | null;
  sourceUrl?: string;
  contractType?: string | null;
  salaryTimeframe?: string | null;
  companyTruthHard?: string | null;
  companyTruthFail?: string | null;
  outboundUrl?: string;
  importedNote?: string;
  skills: string[];
  benefits: string[];
  coordinates: { lat: number; lng: number };
  blueprintId?: string;
  assessmentTasks?: Array<Record<string, any>>;
  handshakeBlueprint?: Record<string, any> | HandshakeBlueprint;
  capacityPolicy?: Record<string, any>;
  slotAvailability?: RoleSlotAvailability | null;
  featuredInsights: string[];
  matchScore?: number | null;
  recommendationFit?: RoleRecommendationFit | null;
}

export type RoleRecommendationIntent = 'safe_match' | 'growth_path' | 'income_now' | 'exploration';

export interface MarketplaceSection {
  id: string;
  title: string;
  description: string;
  items: Role[];
  intent?: RoleRecommendationIntent;
}

export interface RoleRecommendationFitComponent {
  label: string;
  score: number;
  evidence: string[];
  caveats: string[];
}

export interface RoleRecommendationFit {
  components: {
    skillMatch: RoleRecommendationFitComponent;
    evidenceQuality: RoleRecommendationFitComponent;
    growthPotential: RoleRecommendationFitComponent;
    valuesAlignment: RoleRecommendationFitComponent;
    riskPenalty: RoleRecommendationFitComponent;
  };
  reasons: string[];
  caveats: string[];
  riskFlags: string[];
  formula?: {
    version?: string;
    expression?: string;
    weights?: Record<string, number>;
  };
}

export interface CandidatePreferenceProfile {
  name: string;
  legalName: string;
  preferredAlias: string;
  story: string;
  address: string;
  coordinates: { lat: number; lon: number };
  transportMode: TransportMode;
  commuteFilterEnabled: boolean;
  commuteToleranceMinutes: number;
  borderSearchEnabled: boolean;
  searchRadiusKm: number;
  taxProfile: TaxProfile;
  jhiPreferences: JHIPreferences;
  portfolioUrl: string;
  linkedInUrl: string;
}

export interface MarketplaceFilters {
  city: string;
  targetRole: string;
  roleFamily: RoleFamily | 'all';
  workArrangement: JobWorkArrangementFilter;
  remoteOnly: boolean;
  crossBorder: boolean;
  enableCommuteFilter: boolean;
  radiusKm: number;
  minSalary: number;
  transportMode: TransportMode;
  benefits: string[];
  curatedOnly: boolean;
}

export interface RoleEvaluationSnapshot {
  roleId: string;
  jhi: JHI;
  takeHomeMonthly: number;
  commuteMonthlyCost: number;
  commuteMinutesOneWay: number;
  commuteDistanceKm: number;
  avoidedCommuteCost: number;
  benefitsValue: number;
  grossMonthlySalary: number;
  estimatedTaxAndInsurance: number;
  financialScoreAdjustment: number;
  taxEffectiveRate: number;
  taxBreakdownDetails: string[];
  taxRuleVersion?: string;
  isContractorMode: boolean;
  parkingWarning?: string;
  isRelocation?: boolean;
  totalRealMonthlyValue: number;
  borderFitLabel: string;
  borderEligible: boolean;
  taxRuleLabel: string;
  summary: string;
}

export interface CandidateSubmissionSnapshot {
  activeCvName?: string;
  activeCvUrl?: string;
  activeCvSummary?: string;
  candidateJobTitle?: string;
  keySkills: string[];
  taxSummary: string;
  commuteSummary: string;
  realMonthlyValue: number;
  takeHomeMonthly: number;
  commuteMinutesOneWay: number;
  jhiScore: number;
  borderFitLabel: string;
}

export interface CandidateJourneySession {
  roleId: string;
  currentStepId: string;
  answers: Record<string, string | string[]>;
  applicationId?: string;
  applicationStatus?: string;
  backendSession?: Record<string, any>;
  slotAvailability?: RoleSlotAvailability | null;
  liveHydratedAt?: string;
  submittedAt?: string;
  scheduledSlot?: string;
  candidateName?: string;
  candidateLocation?: string;
  candidateScore?: number;
  reviewerSummary?: string;
  submissionSnapshot?: CandidateSubmissionSnapshot;
}

export interface CandidateInsight {
  id: string;
  candidateName: string;
  headline: string;
  location: string;
  matchPercent: number;
  verifiedScore: number;
  topSignals: string[];
  recommendation: string;
  internalNote: string;
  skills: Array<{ label: string; score: number; tags: string[] }>;
  avatar_url?: string;
  bio?: string;
  created_at?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  stage: 'initial' | 'assessment' | 'panel' | 'offer';
  day: number;
  time: string;
  note: string;
}

export interface JcfpmQuestion {
  id: string;
  dimension:
    | 'd1_cognitive'
    | 'd2_social'
    | 'd3_motivational'
    | 'd4_energy'
    | 'd5_values'
    | 'd6_ai_readiness'
    | 'd7_cognitive_reflection'
    | 'd8_digital_eq'
    | 'd9_systems_thinking'
    | 'd10_ambiguity_interpretation'
    | 'd11_problem_decomposition'
    | 'd12_moral_compass'
    | 'i1_love'
    | 'i2_good_at'
    | 'i3_world_needs'
    | 'i4_paid_for';
  prompt: string;
  item_type?: string;
  section?: string;
  scale_min?: number | null;
  scale_max?: number | null;
  reverse_scoring?: boolean;
  locale_used?: string;
  translation_status?: string;
  payload?: any;
}

export interface JCFPMSession {
  answers: Record<string, number | string | string[]>;
  completedAt?: string;
  archetypeTitle?: string;
  summary?: string;
}
