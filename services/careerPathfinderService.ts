import { Job, UserProfile, FinancialReality, SkillsGapAnalysis, LearningResource, BenefitValuation } from '../types';
import { calculateFinancialReality } from './financialService';
import { analyzeSkillsGap } from './pathfinderService';
import { fetchLearningResources, fetchBenefitValuations, checkCompanyAssessment } from './supabaseService';

export interface CareerPathfinderResult {
  financialReality: FinancialReality & { commuteDetails: { distance: number; monthlyCost: number } } | null;
  skillsGapAnalysis: SkillsGapAnalysis | null;
  hasAssessment: boolean;
  isLoading: boolean;
  error: string | null;
}

export class CareerPathfinderService {
  private static instance: CareerPathfinderService;
  private learningResourcesCache: LearningResource[] = [];
  private benefitValuationsCache: BenefitValuation[] = [];
  private lastCacheUpdate = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): CareerPathfinderService {
    if (!CareerPathfinderService.instance) {
      CareerPathfinderService.instance = new CareerPathfinderService();
    }
    return CareerPathfinderService.instance;
  }

  private async ensureDataFreshness(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCacheUpdate > this.CACHE_DURATION) {
      try {
        const [resources, valuations] = await Promise.all([
          fetchLearningResources(),
          fetchBenefitValuations()
        ]);
        
        this.learningResourcesCache = resources;
        this.benefitValuationsCache = valuations;
        this.lastCacheUpdate = now;
      } catch (error) {
        console.error('Error refreshing Career Pathfinder data:', error);
      }
    }
  }

  async analyzeJobOpportunity(
    job: Job,
    userProfile: UserProfile
  ): Promise<CareerPathfinderResult> {
    try {
      // Ensure we have fresh data
      await this.ensureDataFreshness();

      const result: CareerPathfinderResult = {
        financialReality: null,
        skillsGapAnalysis: null,
        hasAssessment: false,
        isLoading: true,
        error: null
      };

      // Check if company has assessment module
      if (job.company_id) {
        result.hasAssessment = await checkCompanyAssessment(job.company_id);
      }

      // Parallel execution of financial and skills analysis
      const [financialResult, skillsResult] = await Promise.allSettled([
        this.calculateFinancialAnalysis(job, userProfile),
        this.calculateSkillsAnalysis(job, userProfile)
      ]);

      // Handle financial analysis result
      if (financialResult.status === 'fulfilled') {
        result.financialReality = financialResult.value;
      } else {
        console.error('Financial analysis failed:', financialResult.reason);
      }

      // Handle skills analysis result
      if (skillsResult.status === 'fulfilled') {
        result.skillsGapAnalysis = skillsResult.value;
      } else {
        console.error('Skills analysis failed:', skillsResult.reason);
      }

      result.isLoading = false;
      return result;

    } catch (error) {
      console.error('Job opportunity analysis failed:', error);
      return {
        financialReality: null,
        skillsGapAnalysis: null,
        hasAssessment: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private async calculateFinancialAnalysis(
    job: Job,
    userProfile: UserProfile
  ): Promise<FinancialReality & { commuteDetails: { distance: number; monthlyCost: number } } | null> {
    try {
      // Check if we have necessary data for financial analysis
      const hasSalary = job.salary_from || 
        (job.salaryRange && job.salaryRange !== 'Mzda neuvedena' && job.salaryRange !== 'Salary not specified') || 
        job.aiEstimatedSalary;

      if (!hasSalary) {
        return null; // Cannot calculate without salary information
      }

      const result = await calculateFinancialReality(job, userProfile, this.benefitValuationsCache);
      return result; // May be null if salary parsing fails
    } catch (error) {
      console.error('Financial calculation error:', error);
      return null;
    }
  }

  private async calculateSkillsAnalysis(
    job: Job,
    userProfile: UserProfile
  ): Promise<SkillsGapAnalysis | null> {
    try {
      // Check if we have necessary data for skills analysis
      const hasRequiredSkills = job.required_skills && job.required_skills.length > 0;
      const hasCandidateSkills = userProfile.skills && userProfile.skills.length > 0;

      if (!hasRequiredSkills || !hasCandidateSkills) {
        return null; // Cannot analyze without skills data
      }

      return analyzeSkillsGap(job, userProfile, this.learningResourcesCache);
    } catch (error) {
      console.error('Skills analysis error:', error);
      return null;
    }
  }

  // Utility methods for quick checks
  static canCalculateFinancialReality(job: Job): boolean {
    return !!(job.salary_from || job.salaryRange || job.aiEstimatedSalary);
  }

  static canAnalyzeSkills(job: Job, userProfile: UserProfile): boolean {
    return !!(job.required_skills?.length && userProfile.skills?.length);
  }

  static hasTransparentSalary(job: Job): boolean {
    return !!(job.salaryRange && job.salaryRange !== "Mzda neuvedena") || 
              !!(job.salary_from && job.salary_to);
  }

  static shouldShowSkillsGap(analysis: SkillsGapAnalysis | null): boolean {
    return !!(analysis && analysis.missing_skills.length > 0);
  }

  static shouldHighlightGrowth(analysis: SkillsGapAnalysis | null): boolean {
    return !!(analysis && analysis.recommended_resources.length > 0);
  }
}

// Export convenience functions
export const analyzeJobForPathfinder = (
  job: Job,
  userProfile: UserProfile
): Promise<CareerPathfinderResult> => {
  const service = CareerPathfinderService.getInstance();
  return service.analyzeJobOpportunity(job, userProfile);
};

export const preloadPathfinderData = async (): Promise<void> => {
  const service = CareerPathfinderService.getInstance();
  await service['ensureDataFreshness']();
};