
export interface JHI {
  score: number; // 0-100
  financial: number;
  timeCost: number;
  mentalLoad: number;
  growth: number;
  values: number;
}

export interface NoiseMetrics {
  score: number; // 0-100, where 100 is pure fluff
  flags: string[];
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
  website?: string;
  description?: string;
  members?: RecruiterMember[];
  subscription?: {
    tier: CompanyServiceTier;
    expiresAt?: string;
    usage?: CompanyUsageStats;
  };
}

export type CompanyServiceTier = 'basic' | 'business' | 'enterprise';

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
  salaryRange?: string;
  aiEstimatedSalary?: SalaryEstimate; // New field for AI fallback
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
  contextualRelevance?: ContextualRelevanceScore; // New field for benefit relevance analysis
  // New fields for Career Pathfinder
  required_skills: string[];
  lat?: number;
  lng?: number;
  salary_from?: number;
  salary_to?: number;
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
  values: string[];
}

export enum ViewState {
  LIST = 'LIST',
  DETAIL = 'DETAIL',
  SAVED = 'SAVED',
  PROFILE = 'PROFILE',
  PROFILE_EDITOR = 'PROFILE_EDITOR',
  COMPANY_DASHBOARD = 'COMPANY_DASHBOARD',
  MARKETPLACE = 'MARKETPLACE'
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
  parsedData?: {
    name?: string;
    email?: string;
    phone?: string;
    jobTitle?: string;
    skills?: string[];
    workHistory?: WorkExperience[];
    education?: Education[];
    cvText?: string;
  };
  uploadedAt: string;
  lastUsed?: string; // When this CV was last used for application
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
  skills?: string[];
  workHistory?: WorkExperience[];
  education?: Education[];
  cvAnalysis?: CVAnalysis;
  preferences: {
    workLifeBalance: number; // 1-100
    financialGoals: number; // 1-100
    commuteTolerance: number; // Minutes
    priorities: string[]; // e.g. "Dog Friendly", "Wheelchair Access"
  };
  // New fields for CV management
  currentCVId?: string; // ID of currently selected CV
  cvs?: CVDocument[]; // All uploaded CVs
  subscription?: {
    tier: CandidateSubscriptionTier;
    expiresAt?: string;
    usage?: CandidateUsageStats;
  };
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
  // New fields for marketplace with government funding
  is_government_funded?: boolean;
  funding_amount_czk?: number;
  affiliate_url?: string;
  location?: string;
  lat?: number;
  lng?: number;
  status?: 'active' | 'draft' | 'archived';
  partner_name?: string;
}

export interface MarketplacePartner {
  id: string;
  name: string;
  contact_email: string;
  commission_rate: number;
  partner_type: 'online_platform' | 'driving_school' | 'training_center';
  created_at: string;
}

export interface AssessmentResult {
  id: string;
  candidate_id: string;
  skill_name: string;
  score: number; // 0-100
  assessment_type: string;
  completed_at: string;
}

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
  questions: {
    text: string;
    type: 'Code' | 'Open' | 'Scenario';
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
