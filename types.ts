
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
export type SearchLanguageCode = 'cs' | 'sk' | 'en' | 'de' | 'pl';
export type CandidateDomainKey =
  | 'product_management'
  | 'hospitality'
  | 'customer_support'
  | 'operations'
  | 'sales'
  | 'marketing'
  | 'finance'
  | 'it'
  | 'engineering'
  | 'healthcare'
  | 'education'
  | 'logistics'
  | 'manufacturing'
  | 'retail';
export type CandidateSeniority = 'entry' | 'junior' | 'medior' | 'senior' | 'lead';
export type CandidateInferenceSource = 'manual' | 'profile' | 'cv' | 'history' | 'skills' | 'mixed' | 'none';
export type CandidateMatchBucket = 'best_fit' | 'adjacent' | 'broader';

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

export interface CandidateSearchProfile {
  nearBorder: boolean;
  dogCount: number;
  wantsContractorRoles: boolean;
  wantsDogFriendlyOffice: boolean;
  wantsRemoteRoles: boolean;
  remoteLanguageCodes: SearchLanguageCode[];
  preferredBenefitKeys: string[];
  defaultEnableCommuteFilter: boolean;
  defaultMaxDistanceKm: number;
  primaryDomain?: CandidateDomainKey | null;
  secondaryDomains?: CandidateDomainKey[];
  targetRole?: string;
  seniority?: CandidateSeniority | null;
  includeAdjacentDomains?: boolean;
  inferredPrimaryDomain?: CandidateDomainKey | null;
  inferredTargetRole?: string;
  inferenceSource?: CandidateInferenceSource;
  inferenceConfidence?: number | null;
}

export interface CandidateIntentProfile {
  primaryDomain: CandidateDomainKey | null;
  secondaryDomains: CandidateDomainKey[];
  targetRole: string;
  seniority: CandidateSeniority | null;
  includeAdjacentDomains: boolean;
  inferredPrimaryDomain: CandidateDomainKey | null;
  inferredTargetRole: string;
  inferenceSource: CandidateInferenceSource;
  inferenceConfidence: number;
  usedManualDomain: boolean;
  usedManualRole: boolean;
  usedManualSeniority: boolean;
}

export interface JobSearchFilters {
  searchTerm?: string;
  filterCity?: string;
  filterContractTypes?: string[];
  filterBenefits?: string[];
  filterMinSalary?: number;
  filterDatePosted?: string;
  filterExperienceLevels?: string[];
  filterMaxDistance?: number;
  enableCommuteFilter?: boolean;
  filterLanguageCodes?: SearchLanguageCode[];
  globalSearch?: boolean;
  abroadOnly?: boolean;
  remoteOnly?: boolean;
  intentPrimaryDomain?: CandidateDomainKey | null;
  intentTargetRole?: string;
  intentSeniority?: CandidateSeniority | null;
}

export type DiscoveryFilterSource = 'default' | 'user_toggle';

export interface DiscoveryFilterSourceMap {
  searchTerm?: DiscoveryFilterSource;
  filterCity?: DiscoveryFilterSource;
  filterContractTypes?: DiscoveryFilterSource;
  filterBenefits?: DiscoveryFilterSource;
  filterMinSalary?: DiscoveryFilterSource;
  filterDatePosted?: DiscoveryFilterSource;
  filterExperienceLevels?: DiscoveryFilterSource;
  filterMaxDistance?: DiscoveryFilterSource;
  enableCommuteFilter?: DiscoveryFilterSource;
  filterLanguageCodes?: DiscoveryFilterSource;
  globalSearch?: DiscoveryFilterSource;
  abroadOnly?: DiscoveryFilterSource;
  remoteOnly?: DiscoveryFilterSource;
}

export interface SearchProviderStatus {
  state: 'healthy' | 'degraded' | 'open';
  failure_count: number;
  cooldown_until?: string | null;
  last_error?: string | null;
  last_failure_at?: string | null;
  last_success_at?: string | null;
}

export interface SearchDiagnosticsMeta {
  provider_status?: Partial<Record<'jooble' | 'weworkremotely' | 'arbeitnow', SearchProviderStatus>>;
  fallback_mode?: 'none' | 'cache_only' | 'cache_seeded' | 'live_seeded' | 'degraded' | 'async_overlay' | 'empty' | 'internal_only';
  cache_hit?: boolean;
  degraded_reasons?: string[];
  empty_result_cause?: string | null;
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
  activeDialogueSlotsUsed: number;
  roleOpensUsed: number;
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

export type JobHiringStage =
  | 'collecting_cvs'
  | 'reviewing_first_10'
  | 'shortlisting'
  | 'final_interviews'
  | 'offer_stage';

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
  contact_email?: string | null;
  jhi: JHI;
  noiseMetrics: NoiseMetrics;
  transparency: TransparencyMetrics;
  market: MarketContext;
  companyProfile?: CompanyProfile;
  tags: string[];
  benefits: string[];
  contextualRelevance?: ContextualRelevanceScore;
  required_skills: string[];
  challenge?: string;
  risk?: string;
  firstStepPrompt?: string;
  listingKind?: 'challenge' | 'imported';
  companyPageSummary?: string;
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
  hiring_stage?: JobHiringStage | null;
  open_dialogues_count?: number;
  dialogue_capacity_limit?: number;
  reaction_window_hours?: number;
  reaction_window_days?: number;
  priorityScore?: number;
  matchBucket?: CandidateMatchBucket;
  matchReasons?: string[];
  matchedDomains?: CandidateDomainKey[];
  inferredDomain?: CandidateDomainKey | null;
  inferredSeniority?: CandidateSeniority | null;
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
  company_id?: string | null;
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  role_summary?: string | null;
  first_reply_prompt?: string | null;
  company_truth_hard?: string | null;
  company_truth_fail?: string | null;
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
  open_dialogues_count?: number | null;
  dialogue_capacity_limit?: number | null;
  reaction_window_hours?: number | null;
  reaction_window_days?: number | null;
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
  hasJcfpm?: boolean;
  jcfpmShareLevel?: ApplicationJcfpmShareLevel;
  jcfpmSharedAt?: string;
  jcfpmComparisonSignals?: Array<{
    key: string;
    label: string;
    score: number;
  }>;
  values: string[];
}

export interface CompanyApplicationRow {
  id: string;
  job_id: string | number;
  candidate_id: string;
  status:
    | 'pending'
    | 'reviewed'
    | 'shortlisted'
    | 'rejected'
    | 'hired'
    | 'withdrawn'
    | 'closed'
    | 'closed_timeout'
    | 'closed_rejected'
    | 'closed_withdrawn'
    | 'closed_role_filled';
  created_at?: string;
  submitted_at?: string;
  updated_at?: string;
  dialogue_deadline_at?: string | null;
  dialogue_current_turn?: 'candidate' | 'company' | null;
  dialogue_timeout_hours?: number;
  dialogue_closed_reason?: string | null;
  dialogue_closed_at?: string | null;
  dialogue_is_overdue?: boolean;
  job_title?: string;
  candidate_name?: string;
  candidate_email?: string;
  hasCoverLetter?: boolean;
  hasCv?: boolean;
  jcfpmShareLevel?: ApplicationJcfpmShareLevel;
  hasJcfpm?: boolean;
  candidateHeadline?: string;
}

export type ApplicationJcfpmShareLevel = 'summary' | 'full_report' | 'do_not_share';

export interface EmployerVisibleJcfpmSummary {
  schema_version: 'jcfpm-share-v1';
  share_level: 'summary';
  completed_at?: string;
  confidence?: number;
  archetype?: {
    title: string;
    title_en?: string;
    description?: string;
    description_en?: string;
    icon?: string;
  } | null;
  top_dimensions: Array<{
    dimension: JcfpmDimensionId;
    percentile: number;
    label?: string;
  }>;
  strengths: string[];
  environment_fit_summary?: string[];
  jhi_adjustment_summary?: Array<{
    field: string;
    from: number;
    to: number;
    reason: string;
  }>;
  comparison_signals?: Array<{
    key: string;
    label: string;
    score: number;
  }>;
}

export interface EmployerVisibleJcfpmFullReport extends Omit<EmployerVisibleJcfpmSummary, 'share_level'> {
  share_level: 'full_report';
  dimension_scores: Array<{
    dimension: JcfpmDimensionId;
    raw_score: number;
    percentile: number;
    percentile_band?: string;
    label?: string;
  }>;
  fit_scores: Array<{
    title: string;
    fit_score: number;
    salary_range?: string | null;
    growth_potential?: string | null;
    ai_impact?: string | null;
    remote_friendly?: string | null;
  }>;
  narrative_summary?: {
    ideal_environment?: string[];
    development_areas?: string[];
    next_steps?: string[];
  };
}

export interface DialogueDossier {
  id: string;
  job_id: string | number;
  company_id?: string;
  candidate_id?: string;
  source?: string;
  status: CompanyApplicationRow['status'];
  submitted_at?: string;
  updated_at?: string;
  dialogue_deadline_at?: string | null;
  dialogue_current_turn?: 'candidate' | 'company' | null;
  dialogue_timeout_hours?: number;
  dialogue_closed_reason?: string | null;
  dialogue_closed_at?: string | null;
  dialogue_is_overdue?: boolean;
  reviewed_at?: string;
  reviewed_by?: string;
  cover_letter?: string | null;
  cv_document_id?: string | null;
  cv_snapshot?: {
    id?: string;
    label?: string;
    originalName?: string;
    fileUrl?: string;
  } | null;
  candidate_profile_snapshot?: {
    name?: string;
    email?: string;
    phone?: string;
    jobTitle?: string;
    linkedin?: string;
    skills?: string[];
    values?: string[];
    preferredCountryCode?: string;
  } | null;
  jcfpm_share_level?: ApplicationJcfpmShareLevel;
  shared_jcfpm_payload?: EmployerVisibleJcfpmSummary | EmployerVisibleJcfpmFullReport | null;
  application_payload?: Record<string, unknown> | null;
  job_title?: string;
  candidate_name?: string;
  candidate_email?: string;
  assets?: ExternalAsset[];
  audio_transcript_status?: DialogueTranscriptStatus;
  ai_summary_status?: DialogueAISummaryStatus;
  fit_evidence_status?: DialogueFitEvidenceStatus;
  ai_summary?: {
    summary: string;
    updated_at?: string | null;
  } | null;
  fit_evidence?: {
    layers: FiveLayerFitScore;
    updated_at?: string | null;
  } | null;
}

export type ApplicationDossier = DialogueDossier;

export interface CandidateApplicationJobSnapshot {
  title?: string | null;
  company?: string | null;
  location?: string | null;
  url?: string | null;
  source?: string | null;
  contact_email?: string | null;
}

export interface DialogueSummary {
  id: string;
  job_id: string | number;
  company_id?: string;
  status: CompanyApplicationRow['status'];
  submitted_at?: string;
  updated_at?: string;
  dialogue_deadline_at?: string | null;
  dialogue_current_turn?: 'candidate' | 'company' | null;
  dialogue_timeout_hours?: number;
  dialogue_closed_reason?: string | null;
  dialogue_closed_at?: string | null;
  dialogue_is_overdue?: boolean;
  source?: string;
  has_cover_letter?: boolean;
  has_cv?: boolean;
  has_jcfpm?: boolean;
  jcfpm_share_level?: ApplicationJcfpmShareLevel;
  company_name?: string | null;
  company_website?: string | null;
  job_snapshot?: CandidateApplicationJobSnapshot | null;
}

export type CandidateApplicationSummary = DialogueSummary;

export interface DialogueDetail extends DialogueSummary {
  reviewed_at?: string;
  reviewed_by?: string;
  cover_letter?: string | null;
  cv_document_id?: string | null;
  cv_snapshot?: DialogueDossier['cv_snapshot'];
  candidate_profile_snapshot?: DialogueDossier['candidate_profile_snapshot'];
  shared_jcfpm_payload?: DialogueDossier['shared_jcfpm_payload'];
  application_payload?: Record<string, unknown> | null;
  assets?: ExternalAsset[];
  audio_transcript_status?: DialogueTranscriptStatus;
  ai_summary_status?: DialogueAISummaryStatus;
  fit_evidence_status?: DialogueFitEvidenceStatus;
  ai_summary?: {
    summary: string;
    updated_at?: string | null;
  } | null;
  fit_evidence?: {
    layers: FiveLayerFitScore;
    updated_at?: string | null;
  } | null;
}

export type CandidateApplicationDetail = DialogueDetail;

export interface CandidateDialogueCapacity {
  active: number;
  limit: number;
  remaining: number;
}

export type DialogueTranscriptStatus = 'ready' | 'pending' | 'unavailable' | 'not_applicable';
export type DialogueAISummaryStatus = 'ready' | 'pending' | 'unavailable';
export type DialogueFitEvidenceStatus = 'ready' | 'pending' | 'unavailable';

export interface FiveLayerFitScore {
  [layer: string]: unknown;
}

export interface ExternalAsset {
  id?: string | null;
  asset_id?: string | null;
  provider?: string | null;
  storage_provider?: string | null;
  bucket?: string | null;
  object_key?: string | null;
  kind?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  filename?: string | null;
  download_url?: string | null;
  transcript_status?: DialogueTranscriptStatus;
  name: string;
  url: string;
  path?: string | null;
  size?: number | null;
  content_type?: string | null;
}

export interface UploadSession {
  asset_id: string;
  kind: string;
  upload_token: string;
  upload_url: string;
  upload_method?: string;
  upload_headers?: Record<string, string> | null;
  direct_upload?: boolean;
  expires_at: string;
  max_size_bytes: number;
  provider: string;
}

export interface DialogueMessageAttachment {
  name: string;
  url: string;
  id?: string | null;
  asset_id?: string | null;
  provider?: string | null;
  storage_provider?: string | null;
  bucket?: string | null;
  object_key?: string | null;
  kind?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  filename?: string | null;
  download_url?: string | null;
  transcript_status?: DialogueTranscriptStatus;
  path?: string | null;
  size?: number | null;
  content_type?: string | null;
}

export type ApplicationMessageAttachment = DialogueMessageAttachment;

export interface DialogueMessage {
  id: string;
  application_id: string;
  company_id?: string | null;
  candidate_id?: string | null;
  sender_user_id?: string | null;
  sender_role: 'candidate' | 'recruiter';
  body: string;
  attachments: DialogueMessageAttachment[];
  audio_transcript_status?: DialogueTranscriptStatus;
  created_at: string;
  read_by_candidate_at?: string | null;
  read_by_company_at?: string | null;
}

export type ApplicationMessage = DialogueMessage;

export type JobDraftStatus = 'draft' | 'ready_for_publish' | 'published_linked' | 'archived';

export interface JobValidationReport {
  blockingIssues: string[];
  warnings: string[];
  suggestions: string[];
  transparencyScore: number;
  clarityScore: number;
}

export interface JobDraft {
  id: string;
  company_id: string;
  job_id?: string | number | null;
  status: JobDraftStatus;
  title: string;
  first_reply_prompt?: string;
  company_truth_hard?: string;
  company_truth_fail?: string;
  role_summary: string;
  team_intro: string;
  responsibilities: string;
  requirements: string;
  nice_to_have: string;
  benefits_structured: string[];
  salary_from?: number | null;
  salary_to?: number | null;
  salary_currency: string;
  salary_timeframe: string;
  contract_type?: string | null;
  work_model?: string | null;
  workplace_address?: string | null;
  location_public?: string | null;
  application_instructions: string;
  contact_email?: string | null;
  hiring_stage?: JobHiringStage | null;
  quality_report?: JobValidationReport | null;
  ai_suggestions?: Record<string, unknown> | null;
  editor_state?: Record<string, unknown> | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobVersion {
  id: string;
  job_id: string | number;
  draft_id?: string | null;
  version_number: number;
  published_snapshot: Record<string, unknown>;
  change_summary?: string | null;
  published_by?: string | null;
  published_at: string;
}

export enum ViewState {
  LIST = 'LIST',
  DETAIL = 'DETAIL',
  SAVED = 'SAVED',
  PROFILE = 'PROFILE',
  PROFILE_EDITOR = 'PROFILE_EDITOR',
  COMPANY_DASHBOARD = 'COMPANY_DASHBOARD',
  ASSESSMENT = 'ASSESSMENT',
  JCFPM = 'JCFPM'
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

export type ApplicationDraftTone = 'concise' | 'assertive' | 'warm';

export interface ApplicationDraftSuggestion {
  draftText: string;
  fitScore?: number | null;
  fitReasons: string[];
  fitWarnings: string[];
  language: string;
  tone: ApplicationDraftTone;
  usedFallback?: boolean;
  modelMeta?: Record<string, unknown> | null;
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
  externalAssetId?: string;
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
    searchProfile?: CandidateSearchProfile;
    desired_role?: string;
    desired_salary_min?: number | null;
    desired_salary_max?: number | null;
    desired_employment_type?: 'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary';
    desired_employment_types?: Array<'full_time' | 'part_time' | 'contract' | 'internship' | 'temporary'>;
    profile_visibility?: 'private' | 'recruiter' | 'public';
    linkedIn?: string;
    portfolio?: string;
    github?: string;
    activation_v1?: CandidateActivationStateV1;
    jcfpm_v1?: JcfpmSnapshotV1;
    jcfpm_jhi_adjustment_v1?: JcfpmJhiAdjustmentV1;
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
  | 'd6_ai_readiness'
  | 'd7_cognitive_reflection'
  | 'd8_digital_eq'
  | 'd9_systems_thinking'
  | 'd10_ambiguity_interpretation'
  | 'd11_problem_decomposition'
  | 'd12_moral_compass';

export type JcfpmItemType =
  | 'likert'
  | 'mcq'
  | 'scenario_choice'
  | 'ordering'
  | 'image_choice'
  | 'drag_drop';

export interface JcfpmLocalizedTextMap {
  [locale: string]: string | undefined;
}

export interface JcfpmLocalizedPayloadMap {
  [locale: string]: Record<string, unknown> | undefined;
}

export interface JcfpmItem {
  id: string;
  dimension: JcfpmDimensionId;
  subdimension?: string | null;
  prompt: string;
  prompt_i18n?: JcfpmLocalizedTextMap | null;
  subdimension_i18n?: JcfpmLocalizedTextMap | null;
  reverse_scoring?: boolean;
  sort_order?: number;
  item_type?: JcfpmItemType;
  payload?: Record<string, unknown> | null;
  payload_i18n?: JcfpmLocalizedPayloadMap | null;
  assets?: Record<string, unknown> | null;
  pool_key?: string | null;
  variant_index?: number | null;
}

export interface JcfpmScore {
  dimension: JcfpmDimensionId;
  raw_score: number;
  percentile: number;
  percentile_band: string;
  label: string;
  consistency?: number; // 0-100 score
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

export interface JcfpmSubdimensionScore {
  dimension: JcfpmDimensionId;
  subdimension: string;
  raw_score: number;
  normalized: number;
}

export interface JcfpmBigFiveProfile {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  derived?: boolean;
}

export interface JcfpmTemperamentProfile {
  label: 'cholerik' | 'sangvinik' | 'melancholik' | 'flegmatik';
  dominance: number;
  reactivity: number;
  confidence: number;
  notes?: string[];
}

export interface JcfpmTraitsProfile {
  big_five: JcfpmBigFiveProfile;
  temperament: JcfpmTemperamentProfile;
}

export interface JcfpmJhiAdjustmentItem {
  field: string;
  from: number;
  to: number;
  reason: string;
  reason_i18n?: Record<string, string>;
}

export interface JcfpmJhiAdjustmentV1 {
  version: 'jcfpm-jhi-adjustment-v1';
  generated_at: string;
  inputs: {
    d2_social: number;
    d3_motivational: number;
    d4_energy: number;
    d5_values: number;
    d6_ai_readiness: number;
  };
  changes: JcfpmJhiAdjustmentItem[];
}

export interface JcfpmSnapshotV1 {
  schema_version: 'jcfpm-v1';
  completed_at: string;
  responses: Record<string, unknown>;
  item_ids?: string[];
  variant_seed?: string;
  dimension_scores: JcfpmScore[];
  subdimension_scores?: JcfpmSubdimensionScore[];
  traits?: JcfpmTraitsProfile;
  fit_scores: JcfpmRoleFit[];
  ai_report?: JcfpmAIReport | null;
  percentile_summary: Record<JcfpmDimensionId, number>;
  confidence: number;
  archetype?: {
    title: string;
    title_en: string;
    description: string;
    description_en: string;
    icon: string;
  } | null;
}

export interface AssessmentResult {
  id: string;
  company_id: string;
  candidate_id?: string;
  invitation_id?: string;
  application_id?: string;
  job_id?: string | number;
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
  company_id?: string | null;
  source_job_id?: string | number | null;
  status?: 'active' | 'archived';
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
