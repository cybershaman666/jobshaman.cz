import { loadStripe } from '@stripe/stripe-js';

// TODO: Replace with your real Stripe Publishable Key from the dashboard
const STRIPE_PUBLIC_KEY = 'pk_live_51StCnSG2Aezsy59epwvFwsyhMk0N9ySXq0U5fYgWBoTpfzZnX2rMCaQ41XEfGgWZoI3lWD2P0mUxF169hQYZV5Cc00Yl5xKCGh';
// TODO: Replace with your real Render backend URL
const BACKEND_URL = 'https://jobshaman-cz.onrender.com';

/**
 * Initiates a Stripe Checkout session for a specific subscription tier.
 * @param tier 'premium' for candidates, 'business' for companies
 * @param userId The ID of the user or company to associate with the payment
 */
export const redirectToCheckout = async (tier: 'premium' | 'business', userId: string) => {
    try {
        const response = await fetch(`${BACKEND_URL}/create-checkout-session`, {
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
            alert('Chyba při inicializaci platby. Zkuste to prosím později.');
        }
    } catch (error) {
        console.error('Stripe error:', error);
        alert('Nepodařilo se spojit s platebním serverem.');
    }
};

/**
 * Helper to check URL for payment status and show feedback to the user.
 */
export const checkPaymentStatus = () => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('payment');

    if (status === 'success') {
        alert('Platba byla úspěšná! Vítejte v prémiové verzi JobShaman. 🎉');
        // Clean up the URL
        window.history.replaceState({}, document.title, "/");
    } else if (status === 'cancel') {
        alert('Platba byla zrušena.');
        window.history.replaceState({}, document.title, "/");
    }
};
