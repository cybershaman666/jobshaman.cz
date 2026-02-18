import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';

const API_URL = BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const sendWelcomeEmail = async (locale: string, appUrl: string): Promise<boolean> => {
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
};
