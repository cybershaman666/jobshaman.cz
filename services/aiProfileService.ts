import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';
import { AIGuidedProfileResponseV2, UserProfile } from '../types';

export interface AIGuidedProfileStep {
    id: string;
    text: string;
}

export const generateProfileFromStory = async (
    steps: AIGuidedProfileStep[],
    language: string = 'cs',
    existingProfile?: Partial<UserProfile>
): Promise<AIGuidedProfileResponseV2> => {
    const response = await authenticatedFetch(`${BACKEND_URL}/ai/profile/generate`, {
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
