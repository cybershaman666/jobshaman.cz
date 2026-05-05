import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';
import { AIGuidedProfileResponseV2, UserProfile } from '../types';
import { enrichSearchProfileWithInference } from './candidateIntentService';

export interface AIGuidedProfileStep {
    id: string;
    text: string;
}

export interface CandidateProfileReadiness {
    narrative_completed: boolean;
    jcfpm_completed: boolean;
    profile_depth: number;
    matching_ready: boolean;
    missing_steps: string[];
}

export interface CandidateProfileOnboardingCompleteResponse extends AIGuidedProfileResponseV2 {
    profile: Record<string, unknown>;
    readiness: CandidateProfileReadiness;
    fallback_used?: boolean;
}

interface CareerGoalResolution {
    targetRole?: string;
    primaryDomain?: string | null;
    seniority?: string | null;
    workModeHint?: string | null;
    confidence?: number;
}

const normalizeProfileLanguage = (language: string = 'cs'): 'cs' | 'en' => {
    const normalized = language.toLowerCase().split('-')[0];
    return normalized === 'en' ? 'en' : 'cs';
};

const sanitizeProfileSteps = (steps: AIGuidedProfileStep[]): AIGuidedProfileStep[] => {
    const sanitizedSteps = (steps || [])
        .map(step => ({ id: step.id, text: (step.text || '').trim() }))
        .filter(step => step.text.length > 0);

    if (sanitizedSteps.length === 0) {
        throw new Error('At least one non-empty step is required');
    }

    return sanitizedSteps;
};

export const generateProfileFromStory = async (
    steps: AIGuidedProfileStep[],
    language: string = 'cs',
    existingProfile?: Partial<UserProfile>
): Promise<AIGuidedProfileResponseV2> => {
    const sanitizedSteps = sanitizeProfileSteps(steps);

    const response = await authenticatedFetch(`${BACKEND_URL}/ai/profile/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            steps: sanitizedSteps,
            language: normalizeProfileLanguage(language),
            existingProfile
        })
    });

    if (!response.ok) {
        let detail = '';
        try {
            const errorBody = await response.json();
            detail = errorBody?.detail || errorBody?.message || '';
        } catch {
            detail = await response.text();
        }
        if (response.status === 403 && /premium subscription required/i.test(detail || '')) {
            throw new Error('AI průvodce je dostupný pouze pro aktivní Premium předplatné.');
        }
        throw new Error(detail || `AI profiling failed (${response.status})`);
    }

    return response.json();
};

export const completeProfileOnboardingFromStory = async (
    steps: AIGuidedProfileStep[],
    language: string = 'cs',
    existingProfile?: Partial<UserProfile>
): Promise<CandidateProfileOnboardingCompleteResponse> => {
    const sanitizedSteps = sanitizeProfileSteps(steps);

    const response = await authenticatedFetch(`${BACKEND_URL}/api/v2/candidate/ritual/complete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            steps: sanitizedSteps,
            language: normalizeProfileLanguage(language)
        })
    });

    if (!response.ok) {
        let detail = '';
        try {
            const errorBody = await response.json();
            detail = errorBody?.detail || errorBody?.message || '';
        } catch {
            detail = await response.text();
        }
        throw new Error(detail || `Profile onboarding completion failed (${response.status})`);
    }

    const result = await response.json() as CandidateProfileOnboardingCompleteResponse;
    const modelUsed = String(result?.meta?.model_used || '').toLowerCase();
    if (result?.fallback_used || modelUsed === 'local-fallback') {
        throw new Error('Onboarding nebyl zpracován přes AI. Zkontroluj dostupnost backendu a Mistral integrace.');
    }

    const hasStructuredRoleSignal = Boolean(
        (result.profile_updates as any)?.preferences?.desired_role
        || (result.profile_updates as any)?.preferences?.searchProfile?.targetRole
        || (result.profile_updates as any)?.preferences?.searchProfile?.inferredTargetRole
    );

    if (!hasStructuredRoleSignal) {
        try {
            const resolution = await resolveCareerGoalFromNarrative(
                result.ai_profile?.story || sanitizedSteps.map((step) => step.text).join('\n\n'),
                language,
                existingProfile,
            );
            if (resolution.targetRole || resolution.primaryDomain || resolution.seniority || resolution.workModeHint) {
                const profileUpdates = (result.profile_updates || {}) as Record<string, any>;
                const preferences = { ...(profileUpdates.preferences || {}) };
                const searchProfile = { ...(preferences.searchProfile || {}) };

                if (resolution.targetRole && !preferences.desired_role) {
                    preferences.desired_role = resolution.targetRole;
                }
                if (resolution.targetRole && !searchProfile.inferredTargetRole) {
                    searchProfile.inferredTargetRole = resolution.targetRole;
                }
                if (resolution.primaryDomain && !searchProfile.inferredPrimaryDomain) {
                    searchProfile.inferredPrimaryDomain = resolution.primaryDomain;
                }
                if (resolution.seniority && !searchProfile.seniority) {
                    searchProfile.seniority = resolution.seniority;
                }
                if (resolution.workModeHint && !searchProfile.preferredWorkArrangement) {
                    searchProfile.preferredWorkArrangement = resolution.workModeHint === 'onsite' ? 'on-site' : resolution.workModeHint;
                }
                if (typeof resolution.confidence === 'number' && !searchProfile.inferenceConfidence) {
                    searchProfile.inferenceConfidence = Math.max(0, Math.min(100, Math.round(resolution.confidence)));
                }
                if (!searchProfile.inferenceSource) {
                    searchProfile.inferenceSource = 'onboarding';
                }

                preferences.searchProfile = searchProfile;
                (result.profile_updates as Record<string, any>).preferences = preferences;
            }
        } catch (intentError) {
            console.warn('Career goal resolution after onboarding failed:', intentError);
        }
    }

    return result;
};

const asStringList = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const items = value
        .map(item => typeof item === 'string' ? item.trim() : '')
        .filter(Boolean);
    return items.length > 0 ? Array.from(new Set(items)) : undefined;
};

const mergeStringLists = (...values: Array<unknown>): string[] | undefined => {
    const merged = values.flatMap(value => asStringList(value) || []);
    return merged.length > 0 ? Array.from(new Set(merged)) : undefined;
};

const firstText = (...values: Array<unknown>): string | undefined => {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
};

export const buildUserProfileUpdatesFromAIProfile = (
    response: AIGuidedProfileResponseV2,
    existingProfile?: Partial<UserProfile>
): Partial<UserProfile> => {
    const rawUpdates = (response.profile_updates || {}) as Partial<UserProfile> & Record<string, unknown>;
    const aiProfile = (response.ai_profile || {}) as AIGuidedProfileResponseV2['ai_profile'] & Record<string, unknown>;
    const updates: Partial<UserProfile> = { ...rawUpdates };

    const story = firstText(rawUpdates.story, aiProfile.story);
    if (story) updates.story = story;

    const cvAiText = firstText(rawUpdates.cvAiText, rawUpdates.cv_ai_text, response.cv_ai_text, response.cv_summary);
    if (cvAiText) updates.cvAiText = cvAiText;

    const jobTitle = firstText(rawUpdates.jobTitle, rawUpdates.job_title);
    if (jobTitle) updates.jobTitle = jobTitle;

    const listFields: Array<[
        keyof UserProfile,
        unknown,
        unknown,
        unknown
    ]> = [
        ['skills', existingProfile?.skills, rawUpdates.skills, undefined],
        ['hobbies', existingProfile?.hobbies, rawUpdates.hobbies, aiProfile.hobbies],
        ['volunteering', existingProfile?.volunteering, rawUpdates.volunteering, aiProfile.volunteering],
        ['leadership', existingProfile?.leadership, rawUpdates.leadership, aiProfile.leadership],
        ['strengths', existingProfile?.strengths, rawUpdates.strengths, aiProfile.strengths],
        ['values', existingProfile?.values, rawUpdates.values, aiProfile.values],
        ['inferredSkills', existingProfile?.inferredSkills, rawUpdates.inferredSkills || rawUpdates.inferred_skills, aiProfile.inferred_skills],
        ['awards', existingProfile?.awards, rawUpdates.awards, aiProfile.awards],
        ['certifications', existingProfile?.certifications, rawUpdates.certifications, aiProfile.certifications],
        ['sideProjects', existingProfile?.sideProjects, rawUpdates.sideProjects || rawUpdates.side_projects, aiProfile.side_projects],
        ['motivations', existingProfile?.motivations, rawUpdates.motivations, aiProfile.motivations],
        ['workPreferences', existingProfile?.workPreferences, rawUpdates.workPreferences || rawUpdates.work_preferences, aiProfile.work_preferences],
    ];

    listFields.forEach(([field, existing, raw, ai]) => {
        const merged = mergeStringLists(existing, raw, ai);
        if (merged) {
            (updates as Record<string, unknown>)[field] = merged;
        }
    });

    updates.preferences = {
        workLifeBalance: existingProfile?.preferences?.workLifeBalance ?? 50,
        financialGoals: existingProfile?.preferences?.financialGoals ?? 50,
        commuteTolerance: existingProfile?.preferences?.commuteTolerance ?? 45,
        priorities: existingProfile?.preferences?.priorities ?? [],
        ...(existingProfile?.preferences || {}),
        ...(rawUpdates.preferences || {}),
        candidate_onboarding_v2: {
            ...(existingProfile?.preferences?.candidate_onboarding_v2 || {}),
            ...((rawUpdates.preferences as UserProfile['preferences'] | undefined)?.candidate_onboarding_v2 || {}),
            completed_at: new Date().toISOString(),
            last_step: 'profile_nudge',
            interest_reveal: firstText(
                existingProfile?.preferences?.candidate_onboarding_v2?.interest_reveal,
                aiProfile.story
            ),
        },
    };

    const enrichedProfile = enrichSearchProfileWithInference({
        ...(existingProfile || {}),
        ...updates,
        preferences: updates.preferences,
    } as UserProfile);

    updates.preferences = {
        ...updates.preferences,
        searchProfile: enrichedProfile,
    };

    return updates;
};

const resolveCareerGoalFromNarrative = async (
    goalText: string,
    language: string,
    existingProfile?: Partial<UserProfile>
): Promise<CareerGoalResolution> => {
    const response = await authenticatedFetch(`${BACKEND_URL}/ai/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'resolve_career_navigation_goal',
            params: {
                goalText: String(goalText || '').trim().slice(0, 5000),
                locale: normalizeProfileLanguage(language),
                userProfile: existingProfile || {},
            },
        }),
    });

    if (!response.ok) {
        let detail = '';
        try {
            const errorBody = await response.json();
            detail = errorBody?.detail || errorBody?.message || '';
        } catch {
            detail = await response.text();
        }
        throw new Error(detail || `Career goal resolution failed (${response.status})`);
    }

    return await response.json() as CareerGoalResolution;
};
