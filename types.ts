
export interface JHI {
  score: number; // 0-100
  baseScore: number; // Cross-user comparable baseline score
  personalizedScore: number; // User-specific score after preferences
  financial: number;
  timeCost: number;
  mentalLoad: number;
  growth: number;
  values: number;
  explanations?: string[];
}

export type SupportedCountryCode = 'CZ' | 'SK' | 'PL' | 'DE' | 'AT';
export type EmploymentType = 'employee' | 'contractor';
export type MaritalStatus = 'single' | 'married';
export type GermanTaxClass = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';

export interface TaxProfile {
  countryCode: SupportedCountryCode;
  taxYear: number;
  employmentType: EmploymentType;
  maritalStatus: MaritalStatus;
  spouseAnnualIncome?: number;
  childrenCount: number;
  isSingleParent?: boolean;
  specialReliefs?: string[];
  deTaxClass?: GermanTaxClass;
  deChurchTaxRate?: number; // 0, 0.08, 0.09
  deKvzRate?: number; // Zusatzbeitragssatz (%), e.g. 2.9
  atHas13th14th?: boolean; // Austria standard
}

export interface JHIPillarWeights {
  financial: number;
  timeCost: number;
  mentalLoad: number;
  growth: number;
  values: number;
}

export interface JHIHardConstraints {
  mustRemote: boolean;
  maxCommuteMinutes: number | null;
  minNetMonthly: number | null;
  excludeShift: boolean;
  growthRequired: boolean;
}

export interface JHIWorkStyle {
  peopleIntensity: number; // 0-100
  careerGrowthPreference: number; // 0-100
  homeOfficePreference: number; // 0-100
}

export interface JHIPreferences {
  pillarWeights: JHIPillarWeights;
  hardConstraints: JHIHardConstraints;
  workStyle: JHIWorkStyle;
}

export interface NoiseMetrics {
  score: number; // 0-100, where 100 is pure fluff
  flags: string[]; // Keep flags for backward compatibility or alias to keywords
  level: 'low' | 'medium' | 'high'; // Added level
  keywords: string[]; // Added keywords
  tone: 'Professional' | 'Casual' | 'Hype-heavy' | 'Toxic' | 'Dry' | 'Technical';
}

export interface TransparencyMetrics {
  turnoverRate: number; // Annual %
  avgTenure: number; // Years
  ghostingRate: number; // % of candidates never heard back
  hiringSpeed: string; // e.g. "Slow (4 weeks)"
  redFlags: string[]; // e.g. "Frequent reposting"
}

export interface MarketContext {
  marketAvgSalary: number; // Monthly CZK
  percentile: number; // Where this offer sits (0-100)
  inDemandSkills: string[]; // Skills that would boost salary
  p25?: number;
  p50?: number;
  p75?: number;
  iqr?: number;
  sampleSize?: number;
  dataWindowDays?: number;
  confidenceTier?: 'low' | 'medium' | 'high';
  sourceMode?: 'internal_only' | 'blended_internal_public' | 'public_fallback';
  fallbackReason?: string | null;
}

export interface BenchmarkTransparency {
  source_name: string;
  source_mode: 'internal_only' | 'blended_internal_public' | 'public_fallback' | 'offer_only';
  method_version?: string;
  updated_at: string;
  sample_size: number;
  data_window_days: number;
  iqr?: number;
  confidence_score: number;
  confidence_tier: 'low' | 'medium' | 'high';
  fallback_reason?: string | null;
  source_url?: string | null;
  period_label?: string | null;
  measure_type?: 'median' | 'average' | string | null;
  gross_net?: 'gross' | 'net' | string | null;
  employment_scope?: string | null;
  confidence_components?: {
    sample_size_component: number;
    variance_component: number;
    recency_component: number;
  };
  fallback_details?: {
    strict_region_sample?: number;
    country_sample?: number;
    profession_sample?: number;
    family_sample?: number;
    group_sample?: number;
    external_sample?: number;
  };
}

export interface SalaryBenchmarkResolved {
  job_id: number;
  insufficient_data: boolean;
  message?: string;
  role_family?: string;
  region_key?: string;
  seniority_band?: string;
  employment_type?: string;
  currency?: string;
  offer_salary_monthly?: number | null;
  p25?: number;
  p50?: number;
  p75?: number;
  iqr?: number;
  delta_vs_p50?: number;
  delta_vs_p50_pct?: number;
  percentile_in_segment?: number | null;
  transparency: BenchmarkTransparency;
}

export interface CandidateBenchmarkMetric {
  metric: 'assessment_avg' | 'shortlist_rate' | 'hire_rate';
  value: number | null;
  peer_value: number | null;
  delta_vs_peer: number | null;
  sample_size: number;
  source_name: string;
  source_mode: 'internal_only';
  data_window_days: number;
  updated_at: string;
  confidence_score: number;
  confidence_tier: 'low' | 'medium' | 'high';
  confidence_components: {
    sample_size_component: number;
    variance_component: number;
    recency_component: number;
  };
  insufficient_data: boolean;
  fallback_reason?: string | null;
  numerator?: number;
  denominator?: number;
  median?: number | null;
  coverage?: {
    assessed_candidates: number;
    total_candidates: number;
    coverage_ratio: number | null;
  };
}

export interface CandidateBenchmarkMetrics {
  company_id: string;
  job_id?: number | null;
  peer_group: {
    hiring_volume_band: 'small' | 'medium' | 'large';
    peer_company_count: number;
  };
  assessment: CandidateBenchmarkMetric;
  shortlist_rate: CandidateBenchmarkMetric;
  hire_rate: CandidateBenchmarkMetric;
  transparency: {
    source_name: string;
    source_mode: 'internal_only';
    data_window_days: number;
    updated_at: string;
    note: string;
  };
}

export interface CompanyProfile {
  id?: string;
  name: string;
  industry: string;
  tone: string; // e.g., "Professional but friendly", "Technical and dry"
  values: string[]; // e.g., ["Transparency", "Async-first"]
  philosophy: string; // Short mission statement
  ico?: string;
  dic?: string;
  address?: string;
  lat?: number | null;
  lng?: number | null;
  legal_address?: string;
  registry_info?: string;
  website?: string;
  description?: string;
  logo_url?: string;
  members?: RecruiterMember[];
  subscription?: {
    tier: CompanyServiceTier;
    expiresAt?: string;
    usage?: CompanyUsageStats;
  };
}

export type CompanyServiceTier = 'free' | 'trial' | 'starter' | 'growth' | 'professional' | 'enterprise';

export interface CompanyUsageStats {
  activeJobsCount: number;
  aiAssessmentsUsed: number;
  adOptimizationsUsed: number;
}

export interface RecruiterMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'recruiter';
  avatar?: string;
  joinedAt: string;
}

export interface SalaryEstimate {
  min: number;
  max: number;
  currency: string;
}

export interface Job {
  id: string;
  company_id?: string;
  title: string;
  company: string;
  location: string;
  type: 'Remote' | 'Hybrid' | 'On-site';
  work_model?: string;
  salaryRange?: string;
  aiEstimatedSalary?: SalaryEstimate;
  aiAnalysis?: AIAnalysisResult; // Cached analysis from DB
  description: string; // Markdown supported
  postedAt: string;
  scrapedAt?: string; // ISO Timestamp for sorting
  source: string;
  url?: string; // Original job posting URL
  jhi: JHI;
  noiseMetrics: NoiseMetrics;
  transparency: TransparencyMetrics;
  market: MarketContext;
  companyProfile?: CompanyProfile;
  tags: string[];
  benefits: string[];
  contextualRelevance?: ContextualRelevanceScore;
  required_skills: string[];
  aiMatchScore?: number;
  aiMatchReasons?: string[];
  aiMatchBreakdown?: JobRecommendationBreakdown;
  aiMatchModelVersion?: string;
  aiMatchScoringVersion?: string;
  aiRecommendationPosition?: number;
  aiRecommendationRequestId?: string;
  lat?: number;
  lng?: number;
  salary_from?: number;
  salary_to?: number;
  salary_timeframe?: string;
  constraint_compromises?: string[];
  constraint_mode?: 'strict' | 'near';
  distanceKm?: number;
  searchScore?: number;
  rankPosition?: number;
  requestId?: string;
  legality_status?: 'pending' | 'legal' | 'illegal' | 'review';
  legality_reasons?: string[];
  country_code?: string;
  language_code?: string;
}

export interface JobRecommendationBreakdown {
  skill_match: number;
  demand_boost: number;
  seniority_alignment: number;
  salary_alignment: number;
  geography_weight: number;
  missing_core_skills: string[];
  seniority_gap: number;
  component_scores: {
    alpha_skill: number;
    beta_demand: number;
    gamma_seniority: number;
    delta_salary: number;
    epsilon_geo: number;
  };
  total: number;
}

export interface AIGuidedProfileResponseV2 {
  profile_updates: Partial<UserProfile>;
  ai_profile: {
    story?: string;
    hobbies?: string[];
    volunteering?: string[];
    leadership?: string[];
    strengths?: string[];
    values?: string[];
    inferred_skills?: string[];
    awards?: string[];
    certifications?: string[];
    side_projects?: string[];
    motivations?: string[];
    work_preferences?: string[];
  };
  cv_ai_text: string;
  cv_summary: string;
  meta: {
    prompt_version: string;
    model_used: string;
    fallback_used: boolean;
    latency_ms: number;
    token_usage: { input: number; output: number };
  };
}

// Database representation of a job row (used when reading directly from Supabase)
export interface DatabaseJob {
  id: number;
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  benefits?: string[] | string | null;
  contract_type?: string;
  salary_from?: number | string | null;
  salary_to?: number | string | null;
  salary_timeframe?: string | null;
  work_type?: string;
  scraped_at?: string;
  source?: string;
  education_level?: string;
  url?: string;
  lat?: number | null;
  lng?: number | null;
  country_code?: string;
  language_code?: string;
  [key: string]: any;
}

export interface Candidate {
  id: string;
  name: string;
  role: string;
  experienceYears: number;
  salaryExpectation: number;
  skills: string[];
  bio: string;
  matchScore?: number; // AI calculated
  flightRisk: 'Low' | 'Medium' | 'High'; // Transparency metric
  flightRiskScore?: number;
  flightRiskBreakdown?: Array<{
    reason: string;
    impact_points: number;
  }>;
  flightRiskMethodVersion?: string;
  values: string[];
}

export interface CompanyApplicationRow {
  id: string;
  job_id: string | number;
  candidate_id: string;
  status: 'pending' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired';
  created_at?: string;
  job_title?: string;
  candidate_name?: string;
  candidate_email?: string;
}

export enum ViewState {
  LIST = 'LIST',
  DETAIL = 'DETAIL',
  SAVED = 'SAVED',
  PROFILE = 'PROFILE',
  PROFILE_EDITOR = 'PROFILE_EDITOR',
  COMPANY_DASHBOARD = 'COMPANY_DASHBOARD',
  ASSESSMENT = 'ASSESSMENT'
}

export interface AIAnalysisResult {
  summary: string;
  hiddenRisks: string[];
  culturalFit: string;
}

export interface AIAdOptimizationResult {
  rewrittenText: string;
  removedCliches: string[];
  improvedClarity: string;
}

export type TransportMode = 'car' | 'public' | 'bike' | 'walk';

export interface CVAnalysis {
  summary: string;
  currentLevel: string;
  suggestedCareerPath: string;
  marketValueEstimation: string;
  skillGaps: string[];
  upsellCourses: {
    name: string;
    description: string;
    estimatedSalaryBump: string;
    price: string;
  }[];
}

export interface ShamanAdvice {
  matchScore: number;
  missingSkills: string[];
  salaryImpact: string;
  seniorityLabel: string; // e.g. "Junior+" or "Solid Senior"
  reasoning: string;
  learningTimeHours: number;
}

export interface WorkExperience {
  id: string;
  role: string;
  company: string;
  duration: string;
  description: string;
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  field: string;
  year: string;
}

export interface CVDocument {
  id: string;
  userId: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  fileSize: number;
  contentType: string;
  isActive: boolean; // Currently selected CV
  label?: string;
  locale?: string;
  parsedData?: {
    name?: string;
    email?: string;
    phone?: string;
    jobTitle?: string;
    skills?: string[];
    workHistory?: WorkExperience[];
    education?: Education[];
    cvText?: string;
    cvAiText?: string;
  };
  uploadedAt: string;
  lastUsed?: string; // When this CV was last used for application
  parsedAt?: string;
}

export interface UserProfile {
  id?: string;
  email?: string;
  name: string;
  role?: 'candidate' | 'recruiter';
  jobTitle?: string;
  phone?: string;
  photo?: string; // Base64 string
  isLoggedIn: boolean;
  address: string;
  coordinates?: { lat: number; lon: number }; // Geocoded location
  transportMode: TransportMode;
  cvText?: string;
  cvUrl?: string;
  cvAiText?: string;
  skills?: string[];
  workHistory?: WorkExperience[];
  education?: Education[];
  cvAnalysis?: CVAnalysis;
  story?: string;
  hobbies?: string[];
  volunteering?: string[];
  leadership?: string[];
  strengths?: string[];
  values?: string[];
  inferredSkills?: string[];
  awards?: string[];
  certifications?: string[];
  sideProjects?: string[];
  motivations?: string[];
  workPreferences?: string[];
  preferences: {
    workLifeBalance: number; // 1-100
    financialGoals: number; // 1-100
    commuteTolerance: number; // Minutes
    priorities: string[]; // e.g. "Dog Friendly", "Wheelchair Access"
    desired_role?: string;
    desired_salary_min?: number | null;
    desired_salary_max?: number | null;
    desired_employment_type?: 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary';
    profile_visibility?: 'private' | 'recruiter' | 'public';
    linkedIn?: string;
    portfolio?: string;
    github?: string;
    activation_v1?: CandidateActivationStateV1;
    jcfpm_v1?: JcfpmSnapshotV1;
  };
  taxProfile?: TaxProfile;
  jhiPreferences?: JHIPreferences;
  hasAssessment?: boolean;
  subscription?: {
    tier: CandidateSubscriptionTier;
    expiresAt?: string;
    usage?: CandidateUsageStats;
  };
  welcomeEmailSent?: boolean;
  preferredLocale?: string;
  preferredCountryCode?: string;
  dailyDigestEnabled?: boolean;
  dailyDigestLastSentAt?: string;
  dailyDigestTime?: string;
  dailyDigestTimezone?: string;
  dailyDigestPushEnabled?: boolean;
}

export interface CandidateActivationStateV1 {
  location_verified: boolean;
  cv_ready: boolean;
  skills_confirmed_count: number;
  preferences_ready: boolean;
  first_quality_action_at?: string;
  completion_percent: number;
  last_prompted_step?: 'location' | 'skills' | 'preferences' | 'cv' | 'quality_action' | 'done';
}

export type JcfpmDimensionId =
  | 'd1_cognitive'
  | 'd2_social'
  | 'd3_motivational'
  | 'd4_energy'
  | 'd5_values'
  | 'd6_ai_readiness';

export interface JcfpmItem {
  id: string;
  dimension: JcfpmDimensionId;
  subdimension?: string | null;
  prompt: string;
  reverse_scoring?: boolean;
  sort_order?: number;
}

export interface JcfpmScore {
  dimension: JcfpmDimensionId;
  raw_score: number;
  percentile: number;
  percentile_band: string;
  label: string;
}

export interface JcfpmRoleFit {
  role_id?: string;
  title: string;
  fit_score: number;
  salary_range?: string | null;
  growth_potential?: string | null;
  ai_impact?: string | null;
  remote_friendly?: string | null;
}

export interface JcfpmAIReport {
  strengths: string[];
  ideal_environment: string[];
  top_roles: { title: string; reason: string }[];
  development_areas: string[];
  next_steps: string[];
  ai_readiness: string;
}

export interface JcfpmSnapshotV1 {
  schema_version: 'jcfpm-v1';
  completed_at: string;
  responses: Record<string, number>;
  dimension_scores: JcfpmScore[];
  fit_scores: JcfpmRoleFit[];
  ai_report?: JcfpmAIReport | null;
  percentile_summary: Record<JcfpmDimensionId, number>;
  confidence: number;
}

export interface AssessmentResult {
  id: string;
  company_id: string;
  candidate_id?: string;
  assessment_id: string;
  role: string;
  difficulty: string;
  questions_total: number;
  questions_correct: number;
  score: number;
  time_spent_seconds: number;
  answers?: { questionId: string; answer: string; isCorrect?: boolean }[] | Record<string, unknown>;
  feedback?: string;
  completed_at: string;
  ai_evaluation?: AssessmentEvaluation; // AI Feedback for Recruiter
}

export interface AssessmentEvaluation {
  pros: string[];
  cons: string[];
  summary: string;
  skillMatchScore: number; // 0-100 independent AI score
  questionFeedback?: {
    questionId: string;
    feedback: string;
  }[];
  recommendation?: string; // Qualitative recommendation for the founder
}

export interface AssessmentSignalFrame {
  timestamp: string;
  unlocked_skills: string[];
  narrative_integrity: number;
  confidence: number;
  evidence: string[];
}

export interface AssessmentJourneyDecisionPattern {
  structured_vs_improv: number;
  risk_tolerance: number;
  sequential_vs_parallel: number;
  stakeholder_orientation: number;
  uncertainty_markers: string[];
}

export interface AssessmentJourneyBehavioralConsistency {
  recurring_motifs: string[];
  consistency_pairs: string[];
  preference_scenario_tensions: string[];
}

export interface AssessmentJourneyEnergyBalance {
  enthusiasm_markers: string[];
  exhaustion_markers: string[];
  must_vs_want_ratio: number;
  locus_of_control: 'internal' | 'external' | 'mixed';
  monthly_energy_hours_left: number;
}

export interface AssessmentJourneyCulturalOrientation {
  transparency: string;
  conflict_response: string;
  hierarchy_vs_autonomy: string;
  process_vs_outcome: string;
  stability_vs_dynamics: string;
}

export interface AssessmentJourneyFinalProfile {
  transferable_strengths: string[];
  risk_zones: string[];
  amplify_environments: string[];
  drain_environments: string[];
}

export interface AssessmentJourneyTrace {
  phase_events: Array<{
    phase: 1 | 2 | 3 | 4 | 5;
    event: string;
    at: string;
  }>;
  micro_insights: Array<{
    phase: 1 | 2 | 3 | 4 | 5;
    text: string;
    insight_type: string;
    at: string;
  }>;
  mode_switches: Array<{
    from: AssessmentMode;
    to: AssessmentMode;
    at: string;
    step_index: number;
  }>;
  experience_meta?: {
    experience_style: 'adventure_v1';
    pace_mode: 'gentle';
    personalization_mode: 'strong';
  };
  response_quality?: {
    checkpoints: Array<{
      checkpoint_index: number;
      answer_depth: number;
      specificity: number;
      decisiveness: number;
      consistency_hint: number;
      dominant_zone: 'focus' | 'collab' | 'speed' | 'quality';
      notes: string[];
      at: string;
    }>;
    summary: {
      signal_quality: number;
      consistency_index: number;
      response_depth_avg: number;
      follow_up_flags: string[];
    };
  };
}

export type AssessmentNodeState =
  | 'locked'
  | 'available'
  | 'active'
  | 'completed_good'
  | 'completed_weak'
  | 'skipped';

export interface AssessmentGalaxyNode {
  id: string;
  questionId: string;
  category: 'Technical' | 'Situational' | 'Practical' | 'Logic';
  state: AssessmentNodeState;
  points: number;
  maxPoints: number;
  penaltyApplied: number;
  position3d: [number, number, number];
  position2d: { x: number; y: number };
}

export interface AssessmentGalaxyProgress {
  totalPoints: number;
  coverageByCategory: Record<'Technical' | 'Situational' | 'Practical' | 'Logic', number>;
  centerUnlocked: boolean;
  unlockReasons: string[];
  lockReasons: string[];
}

export interface AssessmentJourneyPayloadV1 {
  journey_version: 'journey-v1';
  technical: Record<string, string>;
  psychometric: Record<string, number>;
  decision_pattern: AssessmentJourneyDecisionPattern;
  behavioral_consistency: AssessmentJourneyBehavioralConsistency;
  energy_balance: AssessmentJourneyEnergyBalance;
  cultural_orientation: AssessmentJourneyCulturalOrientation;
  journey_trace: AssessmentJourneyTrace;
  final_profile: AssessmentJourneyFinalProfile;
  ai_disclaimer: {
    text: string;
    shown_at_phase: Array<1 | 2 | 3 | 4 | 5>;
  };
  assessment_mode_used: AssessmentMode;
  mode_switch_count: number;
  mode_switch_timestamps: string[];
}

export type AssessmentMode = 'game' | 'classic';

export interface AssessmentSessionPreference {
  mode: AssessmentMode;
  source: 'default' | 'user_toggle';
  updated_at: string;
}

export interface CultureResonanceFrame {
  candidate_vector: number[];
  company_vector: number[];
  match: number;
  tension_points: string[];
}

export interface ThreeSceneCapability {
  webgl: boolean;
  reducedMotion: boolean;
  qualityTier: 'low' | 'medium' | 'high';
}

export interface RealtimeSignalsResponse {
  frames: AssessmentSignalFrame[];
  merged_frame: AssessmentSignalFrame;
}

export interface GalaxyEvaluateNodeResponse {
  quality_tier: 'strong' | 'acceptable' | 'weak';
  points: number;
  penalty: number;
  evidence: string[];
}

export interface CultureResonanceResponse {
  frame: CultureResonanceFrame;
  recommendation: string;
  disclaimer: string;
}

export interface HappinessAuditInput {
  salary: number;
  tax_profile?: TaxProfile;
  commute_minutes_daily: number;
  commute_cost: number;
  work_mode: 'remote' | 'hybrid' | 'onsite';
  subjective_energy: number;
  home_office_days: number;
  role_shift: number;
}

export interface HappinessAuditOutput {
  time_ring: number;
  energy_ring: number;
  sustainability_score: number;
  drift_score: number;
  recommendations: string[];
  advisory_disclaimer: string;
}

export type CandidateSubscriptionTier = 'free' | 'premium';

export interface CandidateUsageStats {
  cvOptimizationsUsed: number;
  coverLettersGenerated: number;
  atcHacksUsed: number;
}

// New types for Career Pathfinder
export interface LearningResource {
  id: string;
  title: string;
  description: string;
  skill_tags: string[];
  url: string;
  provider: string;
  duration_hours: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  price: number;
  currency: string;
  rating: number;
  reviews_count: number;
  created_at: string;
  // Optional enrichment fields for learning resources
  is_government_funded?: boolean;
  funding_amount_czk?: number;
  affiliate_url?: string;
  location?: string;
  lat?: number;
  lng?: number;
  status?: 'active' | 'draft' | 'archived';
  partner_name?: string;
}

// Duplicate AssessmentResult removed

export interface BenefitValuation {
  id: string;
  benefit_name: string;
  monetary_value: number;
  currency: string;
  industry: string;
  updated_at: string;
}

export interface FinancialReality {
  currency: string;
  grossMonthlySalary: number;
  estimatedTaxAndInsurance: number;
  netBaseSalary: number; // Gross - Tax
  benefitsValue: number;
  commuteCost: number;
  avoidedCommuteCost: number; // For remote jobs, how much they SAVE
  finalRealMonthlyValue: number; // Net + Benefits - Commute
  scoreAdjustment: number;
  isIco: boolean; // Is contractor
  taxBreakdown?: {
    incomeTax: number;
    employeeSocial: number;
    employeeHealth: number;
    reliefsApplied: number;
    details: string[];
    effectiveRate: number;
  };
  ruleVersion?: string;
}

export interface SkillsGapAnalysis {
  match_percentage: number;
  missing_skills: string[];
  recommended_resources: LearningResource[];
}

export interface CareerPathfinderResult {
  financialReality: FinancialReality & { commuteDetails: { distance: number; monthlyCost: number } } | null;
  skillsGapAnalysis: SkillsGapAnalysis | null;
  hasAssessment: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface CommuteAnalysis {
  distanceKm: number;
  timeMinutes: number;
  monthlyCost: number;
  jhiImpact: number; // Negative score impact based on time
  parkingWarning?: string; // New field for parking alerts
  isRelocation?: boolean; // TRUE if distance is huge or country differs
  financialReality: FinancialReality; // New detailed financial breakdown
  jhi?: JHI; // Optional: detailed JHI breakdown by dimension
}

export interface BenefitInsight {
  name: string;
  category: 'Health' | 'Financial' | 'Lifestyle' | 'Growth';
  popularityScore: number; // 0-100 (Candidate preference)
  marketAdoption: number; // % of companies offering it
  impactOnRetention: 'High' | 'Medium' | 'Low';
}

export interface Assessment {
  id: string;
  title: string;
  role: string;
  description?: string;
  timeLimitSeconds?: number;
  questions: {
    id: string;
    text: string;
    type: 'Code' | 'Open' | 'Scenario' | 'MultipleChoice';
    category?: 'Technical' | 'Situational' | 'Practical' | 'Logic';
    options?: string[]; // For MultipleChoice
    correctAnswer?: string; // Optional: for auto-grading
  }[];
  createdAt: string;
}

export interface ContextualRelevanceScore {
  contextual_relevance_score: number; // 0-100
  flagged_benefits: FlaggedBenefit[];
  summary_text: string;
}

export interface FlaggedBenefit {
  benefit: string;
  relevance: 'relevant' | 'weakly_relevant' | 'context_mismatch';
  explanation: string;
  weight: number; // 1.0, 0.5, or 0.0
}

export type WorkMode = 'remote' | 'hybrid' | 'onsite' | 'field';
export type JobType = 'office' | 'field' | 'service' | 'technical' | 'care' | 'logistics';
export type LocationType = 'fixed' | 'multi-site' | 'mobile';
export type ScheduleType = 'fixed' | 'flexible' | 'shift-based';
