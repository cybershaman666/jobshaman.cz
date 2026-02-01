import { UserProfile, CompanyProfile } from '../types';

export type PremiumFeature =
    | 'COVER_LETTER'
    | 'CV_OPTIMIZATION'
    | 'AI_JOB_ANALYSIS'
    | 'COMPANY_AI_AD'
    | 'COMPANY_RECOMMENDATIONS'
    | 'COMPANY_UNLIMITED_JOBS';

/**
 * Checks if a user is an administrator (server-side verified only).
 * SECURITY: This function should only be used for display purposes.
 * All authorization checks MUST happen on the server.
 */
export const isAdminUser = async (_email?: string): Promise<boolean> => {
    // Always false on client-side - admin verification happens server-side only
    return false;
};

/**
 * DEPRECATED: This function is client-side only and insecure.
 * All billing verification must happen on the server.
 */
export const canCandidateUseFeature = (_user: UserProfile, _feature: PremiumFeature): boolean => {
    console.warn('⚠️  SECURITY WARNING: canCandidateUseFeature is deprecated and insecure. Use server-side verification instead.');
    // Always return false to force server-side verification
    return false;
};

/**
 * Checks if a company's subscription is expired.
 */
export const isSubscriptionExpired = (company: CompanyProfile): boolean => {
    if (!company.subscription?.expiresAt) return false;

    const expiryDate = new Date(company.subscription.expiresAt);
    const now = new Date();
    return expiryDate < now;
};

/**
 * Checks if a company can use a specific premium feature.
 */
export const canCompanyUseFeature = (company: CompanyProfile, feature: PremiumFeature, _userEmail?: string): boolean => {
    // Basic rules for features
    const tier = company.subscription?.tier || 'basic';

    // Enterprise has everything
    if (tier === 'enterprise') return true;

    switch (feature) {
        case 'COMPANY_RECOMMENDATIONS':
            return tier === 'business'; // Enterprise already returned true at line 50
        case 'COMPANY_UNLIMITED_JOBS':
            return false; // Only enterprise (line 50)
        default:
            return true;
    }
};

/**
 * Checks if a company can post a new job.
 */
export const canCompanyPostJob = (company: CompanyProfile, _userEmail?: string): { allowed: boolean; reason?: string } => {
    const tier = company.subscription?.tier || 'free';
    const activeJobs = company.subscription?.usage?.activeJobsCount || 0;

    // Trial/Free tier limit: 3 active jobs
    if ((tier === 'free' || tier === 'basic') && activeJobs >= 3) {
        return {
            allowed: false,
            reason: 'Dosáhli jste limitu 3 aktivních inzerátů pro váš aktuální plán.'
        };
    }

    // Trial and Business tier limit: 20 active jobs (example limit, can be adjusted)
    if ((tier === 'trial' || tier === 'business') && activeJobs >= 20) {
        return {
            allowed: false,
            reason: 'Dosáhli jste limitu 20 aktivních inzerátů pro váš tarif.'
        };
    }

    return { allowed: true };
};

/**
 * Get count of remaining AI assessments for company.
 */
export const getRemainingAssessments = (company: CompanyProfile): number => {
    // Check subscription expiry first
    if (isSubscriptionExpired(company)) {
        return 0;
    }

    const tier = company.subscription?.tier || 'basic';
    const used = company.subscription?.usage?.aiAssessmentsUsed || 0;

    if (tier === 'enterprise') return 999999; // Practically unlimited
    if (tier === 'business' || tier === 'assessment_bundle' || tier === 'trial') return Math.max(0, 10 - used);

    return 0; // No free assessments
};