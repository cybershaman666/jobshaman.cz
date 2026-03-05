import { UserProfile, CompanyProfile } from '../types';

export type PremiumFeature =
    | 'COVER_LETTER'
    | 'CV_OPTIMIZATION'
    | 'AI_JOB_ANALYSIS'
    | 'COMPANY_AI_AD'
    | 'COMPANY_RECOMMENDATIONS'
    | 'COMPANY_UNLIMITED_JOBS';

const getRoleOpensLimit = (tier: string): number => {
    switch (tier) {
        case 'enterprise':
            return 999999;
        case 'professional':
            return 25;
        case 'growth':
            return 10;
        case 'starter':
            return 3;
        case 'trial':
        case 'free':
        default:
            return 1;
    }
};

const getDialogueSlotsLimit = (tier: string): number => {
    switch (tier) {
        case 'enterprise':
            return 999999;
        case 'professional':
            return 100;
        case 'growth':
            return 40;
        case 'starter':
            return 12;
        case 'trial':
        case 'free':
        default:
            return 3;
    }
};

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
    const tier = company.subscription?.tier || 'free';

    // Enterprise has everything
    if (tier === 'enterprise') return true;

    switch (feature) {
        case 'COMPANY_AI_AD':
            return tier === 'starter' || tier === 'growth' || tier === 'professional';
        case 'COMPANY_RECOMMENDATIONS':
            return tier === 'growth' || tier === 'professional'; // Enterprise already returned true above
        case 'COMPANY_UNLIMITED_JOBS':
            return false; // Only enterprise (line 50)
        default:
            return false;
    }
};

export const getCompanyRoleCapacity = (company: CompanyProfile): { used: number; limit: number; remaining: number } => {
    const tier = String(company.subscription?.tier || 'free').toLowerCase();
    const used = Number(
        company.subscription?.usage?.roleOpensUsed
        ?? company.subscription?.usage?.activeJobsCount
        ?? 0
    );
    const limit = getRoleOpensLimit(tier);
    const remaining = limit >= 999999 ? 999999 : Math.max(0, limit - used);
    return { used, limit, remaining };
};

export const getCompanyDialogueCapacity = (company: CompanyProfile): { used: number; limit: number; remaining: number } => {
    const tier = String(company.subscription?.tier || 'free').toLowerCase();
    const used = Number(company.subscription?.usage?.activeDialogueSlotsUsed ?? 0);
    const limit = getDialogueSlotsLimit(tier);
    const remaining = limit >= 999999 ? 999999 : Math.max(0, limit - used);
    return { used, limit, remaining };
};

export const canCompanyOpenRole = (company: CompanyProfile, _userEmail?: string): { allowed: boolean; reason?: string } => {
    const { used, limit } = getCompanyRoleCapacity(company);
    if (limit < 999999 && used >= limit) {
        return {
            allowed: false,
            reason: `Dosáhli jste limitu ${limit} otevření role pro váš aktuální plán.`
        };
    }
    return { allowed: true };
};

export const canCompanyOpenDialogue = (company: CompanyProfile): { allowed: boolean; reason?: string } => {
    const { used, limit } = getCompanyDialogueCapacity(company);
    if (limit < 999999 && used >= limit) {
        return {
            allowed: false,
            reason: `Dosáhli jste limitu ${limit} aktivních dialogových slotů pro váš aktuální plán.`
        };
    }
    return { allowed: true };
};

/**
 * Legacy alias. Prefer canCompanyOpenRole().
 */
export const canCompanyPostJob = (company: CompanyProfile, _userEmail?: string): { allowed: boolean; reason?: string } => {
    return canCompanyOpenRole(company, _userEmail);
};

/**
 * Get count of remaining AI assessments for company.
 */
export const getRemainingAssessments = (company: CompanyProfile): number => {
    // Check subscription expiry first
    if (isSubscriptionExpired(company)) {
        return 0;
    }

    const tier = company.subscription?.tier || 'starter';
    const used = company.subscription?.usage?.aiAssessmentsUsed || 0;

    if (tier === 'enterprise') return 999999; // Practically unlimited
    if (tier === 'professional') return Math.max(0, 150 - used);
    if (tier === 'growth') return Math.max(0, 60 - used);
    if (tier === 'starter') return Math.max(0, 15 - used);

    return 0; // No free assessments
};
