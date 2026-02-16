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
    const sanitizedSteps = (steps || [])
        .map(step => ({ id: step.id, text: (step.text || '').trim() }))
        .filter(step => step.text.length > 0);

    if (sanitizedSteps.length === 0) {
        throw new Error('At least one non-empty step is required');
    }

    const response = await authenticatedFetch(`${BACKEND_URL}/ai/profile/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            steps: sanitizedSteps,
            language,
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
        throw new Error(detail || `AI profiling failed (${response.status})`);
    }

    return response.json();
};
