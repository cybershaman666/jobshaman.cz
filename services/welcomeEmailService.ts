import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';

const API_URL = BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const sendWelcomeEmail = async (locale: string, appUrl: string): Promise<boolean> => {
    try {
        const response = await authenticatedFetch(`${API_URL}/auth/welcome-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                locale,
                app_url: appUrl
            })
        });

        if (!response.ok) {
            const detail = await response.text();
            console.warn('Welcome email request failed:', response.status, detail);
            return false;
        }

        return true;
    } catch (error) {
        // Network errors from sleeping/unreachable backend should not break app startup flow.
        console.warn('Welcome email request unavailable:', error);
        return false;
    }
};
