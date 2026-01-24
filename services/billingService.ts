import { UserProfile, CompanyProfile } from '../types';

export type PremiumFeature =
    | 'COVER_LETTER'
    | 'CV_OPTIMIZATION'
    | 'ATC_HACK'
    | 'COMPANY_AI_AD'
    | 'COMPANY_RECOMMENDATIONS'
    | 'COMPANY_UNLIMITED_JOBS';

/**
 * Checks if a user is an administrative tester.
 */
export const isAdminTester = (email?: string): boolean => {
    return email === 'misahlavacu@gmail.com';
};

/**
 * Checks if a candidate has access to a premium AI feature.
 */
export const canCandidateUseFeature = (user: UserProfile, feature: PremiumFeature): boolean => {
    if (isAdminTester(user.email)) return true;

    const tier = user.subscription?.tier || 'free';

    if (tier === 'premium') return true;

    // Free tier features
    const freeFeatures: PremiumFeature[] = []; // Currently no AI features are free
    return freeFeatures.includes(feature);
};

/**
 * Checks if a company has access to a specific service level feature.
 */
export const canCompanyUseFeature = (company: CompanyProfile, feature: PremiumFeature, userEmail?: string): boolean => {
    if (isAdminTester(userEmail)) return true;

    const tier = company.subscription?.tier || 'basic';

    if (tier === 'enterprise') return true;

    if (tier === 'business') {
        const businessFeatures: PremiumFeature[] = [
            'COMPANY_AI_AD',
            'COMPANY_RECOMMENDATIONS',
            'COMPANY_UNLIMITED_JOBS'
        ];
        return businessFeatures.includes(feature);
    }

    // Basic tier features
    const basicFeatures: PremiumFeature[] = [];
    return basicFeatures.includes(feature);
};

/**
 * Checks if a company can post more jobs based on their current plan.
 */
export const canCompanyPostJob = (company: CompanyProfile, userEmail?: string): { allowed: boolean; reason?: string } => {
    if (isAdminTester(userEmail)) return { allowed: true };

    const tier = company.subscription?.tier || 'basic';
    const activeJobsCount = company.subscription?.usage?.activeJobsCount || 0;

    if (tier !== 'basic') return { allowed: true };

    if (activeJobsCount >= 5) {
        return {
            allowed: false,
            reason: 'Dosáhli jste limitu 5 inzerátů pro tarif Základní. Upgradujte na Business pro neomezený počet.'
        };
    }

    return { allowed: true };
};

/**
 * Get the count of remaining AI assessments for the company.
 */
export const getRemainingAssessments = (company: CompanyProfile): number => {
    const tier = company.subscription?.tier || 'basic';
    const used = company.subscription?.usage?.aiAssessmentsUsed || 0;

    if (tier === 'enterprise') return 999999; // Practically unlimited
    if (tier === 'business' || tier === 'assessment_bundle') return Math.max(0, 10 - used);

    return 0; // No free assessments
};
