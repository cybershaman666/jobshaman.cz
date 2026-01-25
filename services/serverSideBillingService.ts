/**
 * SERVER-SIDE ONLY: Billing verification service
 * This replaces all client-side billing verification for security.
 */

import { authenticatedFetch } from './csrfService';

export interface ServerSideBillingCheck {
  userId: string;
  feature: string;
  endpoint: string;
}

export interface BillingVerificationResult {
  hasAccess: boolean;
  subscriptionTier?: string;
  reason?: string;
  usage?: {
    current: number;
    limit: number;
    remaining: number;
  };
}

/**
 * SERVER-SIDE ONLY: Verify if user can access a premium feature
 * This function should ONLY be called from the backend API endpoints
 * Automatically includes CSRF token via authenticatedFetch
 */
export async function verifyServerSideBilling(
  check: ServerSideBillingCheck
): Promise<BillingVerificationResult> {
  try {
    const response = await authenticatedFetch('/api/verify-billing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        feature: check.feature,
        endpoint: check.endpoint
      })
    });

    if (!response.ok) {
      // Handle CSRF token errors
      if (response.status === 403) {
        const error = await response.json();
        if (error.detail && error.detail.includes('CSRF')) {
          console.error('❌ CSRF token validation failed. Please refresh the page.');
          return {
            hasAccess: false,
            reason: 'Ověření selhalo. Prosím, osvěžte stránku a zkuste znovu.'
          };
        }
      }
      
      return {
        hasAccess: false,
        reason: 'Ověření poplatku selhalo'
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Billing verification error:', error);
    return {
      hasAccess: false,
      reason: 'Nelze ověřit odběr'
    };
  }
}

/**
 * CLIENT-SIDE: Get detailed subscription status for display purposes only
 * This does NOT grant access - it's just for UI display
 * Returns comprehensive billing information including usage limits and renewal dates
 */
export async function getSubscriptionStatus(userId: string): Promise<{
  tier: string;
  tierName: string;
  status: string;
  expiresAt?: string;
  daysUntilRenewal?: number;
  currentPeriodStart?: string;
  assessmentsAvailable: number;
  assessmentsUsed: number;
  jobPostingsAvailable: number;
  stripeSubscriptionId?: string;
  canceledAt?: string;
}> {
  try {
    const response = await fetch(`/api/subscription-status?userId=${userId}`);
    if (!response.ok) {
      throw new Error('Failed to get subscription status');
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return {
      tier: 'free',
      tierName: 'Free',
      status: 'inactive',
      assessmentsAvailable: 0,
      assessmentsUsed: 0,
      jobPostingsAvailable: 0
    };
  }
}