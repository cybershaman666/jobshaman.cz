import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';
import { UserProfile } from '../types';

export interface AIGuidedProfileStep {
    id: string;
    text: string;
}

export interface AIGuidedProfileResponse {
    profileUpdates: Partial<UserProfile>;
    aiProfile: Record<string, any>;
    cv_ai_text: string;
    cv_summary: string;
}

export const generateProfileFromStory = async (
    steps: AIGuidedProfileStep[],
    language: string = 'cs',
    existingProfile?: Partial<UserProfile>
): Promise<AIGuidedProfileResponse> => {
    const response = await authenticatedFetch(`${BACKEND_URL}/ai/profile-from-story`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            steps,
            language,
            existingProfile
        })
    });

    if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'AI profiling failed');
    }

    return response.json();
};
