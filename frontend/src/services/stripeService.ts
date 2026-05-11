// import { loadStripe } from '@stripe/stripe-js';

export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

import { BILLING_BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';

const API_URL = BILLING_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Initiates a Stripe Checkout session for a specific subscription tier.
 * @param tier 'premium' for personal users (14.99 EUR one-time / 2 months), 'starter'/'growth'/'professional' for companies
 * @param userId The ID of the user or company to associate with the payment
 */
export const redirectToCheckout = async (tier: 'premium' | 'starter' | 'growth' | 'professional', userId: string) => {
    try {
        if (!STRIPE_PUBLIC_KEY) {
            throw new Error('Stripe public key not configured. Set VITE_STRIPE_PUBLISHABLE_KEY before opening checkout.');
        }
        const response = await authenticatedFetch(`${API_URL}/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tier,
                userId,
                successUrl: window.location.origin + '/recruiter/billing?payment=success',
                cancelUrl: window.location.origin + '/recruiter/billing?payment=cancel',
            }),
        });

        const session = await response.json();

        if (session.url) {
            window.location.href = session.url;
        } else {
            console.error('Failed to create checkout session:', session);
            const errorMessage = session.error || 'Platba se nezdařila. Zkuste to prosím později.';
            alert(errorMessage);
        }
    } catch (error) {
        console.error('Stripe error:', error instanceof Error ? error.message : 'Unknown error');

        // More specific error messages
        if (error instanceof Error) {
            if (error.message.includes('fetch')) {
                alert('Nelze se připojit k platební bráně. Zkontrolujte připojení k internetu a zkuste to znovu.');
            } else if (error.message.includes('timeout')) {
                alert('Platební server neodpovídá. Zkuste to prosím za chvíli znovu.');
            } else {
                alert(`Došlo k chybě: ${error.message}. Zkuste to prosím později.`);
            }
        } else {
            alert('Došlo k nečekané chybě. Zkuste to prosím později nebo kontaktujte podporu.');
        }
    }
};

/**
 * Open Stripe Customer Portal for managing payment methods, invoices, and subscription.
 */
export const openBillingPortal = async (): Promise<void> => {
    try {
        const response = await authenticatedFetch(`${API_URL}/create-billing-portal-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                returnUrl: window.location.origin + '/recruiter/billing',
            }),
        });
        const session = await response.json();
        if (session.url) {
            window.location.href = session.url;
        } else {
            console.error('Failed to create billing portal session:', session);
            alert(session.detail || 'Nepodařilo se otevřít správu plateb.');
        }
    } catch (error) {
        console.error('Billing portal error:', error);
        alert('Nepodařilo se otevřít správu plateb. Zkuste to prosím později.');
    }
};

/**
 * Cancel active subscription via server-side endpoint.
 */
export const cancelSubscription = async (): Promise<boolean> => {
    try {
        const response = await authenticatedFetch(`${API_URL}/cancel-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            console.error('Cancel subscription error:', err);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Cancel subscription error:', error);
        return false;
    }
};

/**
 * Helper to check URL for payment status and show feedback to the user.
 */
export const checkPaymentStatus = (): 'success' | 'cancel' | null => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('payment');

    if (status === 'success') {
        // Clean up the URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return 'success';
    } else if (status === 'cancel') {
        window.history.replaceState({}, document.title, window.location.pathname);
        return 'cancel';
    }

    return null;
};
