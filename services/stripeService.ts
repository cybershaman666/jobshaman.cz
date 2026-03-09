// import { loadStripe } from '@stripe/stripe-js';

export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!STRIPE_PUBLIC_KEY) {
    throw new Error(
        '❌ CRITICAL: Stripe public key not configured.\n' +
        'Set VITE_STRIPE_PUBLISHABLE_KEY environment variable in .env or .env.local with your Stripe publishable key.\n' +
        'Example: VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_actual_key_here'
    );
}

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
        const response = await authenticatedFetch(`${API_URL}/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tier,
                userId,
                successUrl: window.location.origin + '/?payment=success',
                cancelUrl: window.location.origin + '/?payment=cancel',
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
 * Helper to check URL for payment status and show feedback to the user.
 */
export const checkPaymentStatus = (): 'success' | 'cancel' | null => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('payment');

    if (status === 'success') {
        alert('Platba byla úspěšná! Vítejte v prémiové verzi JobShaman. 🎉');
        // Clean up the URL
        window.history.replaceState({}, document.title, "/");
        return 'success';
    } else if (status === 'cancel') {
        alert('Platba byla zrušena.');
        window.history.replaceState({}, document.title, "/");
        return 'cancel';
    }

    return null;
};
