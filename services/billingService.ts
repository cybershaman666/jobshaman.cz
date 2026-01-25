import { UserProfile, CompanyProfile } from '../types';

export type PremiumFeature =
    | 'COVER_LETTER'
    | 'CV_OPTIMIZATION'
    | 'ATC_HACK'
    | 'COMPANY_AI_AD'
    | 'COMPANY_RECOMMENDATIONS'
    | 'COMPANY_UNLIMITED_JOBS';

/**
 * Checks if a user is an administrator (server-side verified only).
 * SECURITY: This function should only be used for display purposes.
 * All authorization checks MUST happen on the server.
 */
export const isAdminUser = async (email?: string): Promise<boolean> => {
    // Always false on client-side - admin verification happens server-side only
    return false;
};

/**
 * DEPRECATED: This function is client-side only and insecure.
 * All billing verification must happen on the server.
 */
export const canCandidateUseFeature = (user: UserProfile, feature: PremiumFeature): boolean => {
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
 * DEPRECATED: This function is client-side only and insecure.
 * All billing verification must happen on the server.
 */
export const canCompanyUseFeature = (company: CompanyProfile, feature: PremiumFeature, userEmail?: string): boolean => {
    console.warn('⚠️  SECURITY WARNING: canCompanyUseFeature is deprecated and insecure. Use server-side verification instead.');
    // Always return false to force server-side verification
    return false;
};

/**
 * DEPRECATED: This function is client-side only and insecure.
 * All billing verification must happen on the server.
 */
export const canCompanyPostJob = (company: CompanyProfile, userEmail?: string): { allowed: boolean; reason?: string } => {
    console.warn('⚠️  SECURITY WARNING: canCompanyPostJob is deprecated and insecure. Use server-side verification instead.');
    // Always require server-side verification
    return { 
        allowed: false, 
        reason: 'Vyžaduje se ověření na serveru. Prosím, přihlaste se znovu.' 
    };
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
    if (tier === 'business' || tier === 'assessment_bundle') return Math.max(0, 10 - used);

    return 0; // No free assessments
};