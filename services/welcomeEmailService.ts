import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';

const API_URL = BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const sendWelcomeEmail = async (locale: string, appUrl: string): Promise<boolean> => {
    try {
        const payload = JSON.stringify({
            locale,
            app_url: appUrl
        });
        const endpointCandidates = [`${API_URL}/auth/welcome-email`, `${API_URL}/welcome-email`];
        let lastResponse: Response | null = null;

        for (const endpoint of endpointCandidates) {
            const response = await authenticatedFetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            });
            lastResponse = response;
            if (response.status === 404) {
                continue;
            }
            if (response.ok) {
                return true;
            }
            const detail = await response.text();
            console.warn('Welcome email request failed:', response.status, detail);
            return false;
        }

        if (lastResponse && lastResponse.status === 404) {
            // Optional endpoint in some deployments; avoid noisy warnings in console.
            return false;
        }
        return false;
    } catch (error) {
        // Network errors from sleeping/unreachable backend should not break app startup flow.
        console.warn('Welcome email request unavailable:', error);
        return false;
    }
};
