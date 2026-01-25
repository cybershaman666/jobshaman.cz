/**
 * SERVER-SIDE ONLY: Billing verification service
 * This replaces all client-side billing verification for security.
 */

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
 */
export async function verifyServerSideBilling(
  check: ServerSideBillingCheck
): Promise<BillingVerificationResult> {
  try {
    const response = await fetch('/api/verify-billing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${check.userId}`
      },
      body: JSON.stringify({
        feature: check.feature,
        endpoint: check.endpoint
      })
    });

    if (!response.ok) {
      return {
        hasAccess: false,
        reason: 'Billing verification failed'
      };
    }

    return await response.json();
  } catch (error) {
    console.error('Billing verification error:', error);
    return {
      hasAccess: false,
      reason: 'Unable to verify subscription'
    };
  }
}

/**
 * CLIENT-SIDE: Get subscription status for display purposes only
 * This does NOT grant access - it's just for UI display
 */
export async function getSubscriptionStatus(userId: string): Promise<{
  tier: string;
  status: string;
  expiresAt?: string;
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
      status: 'inactive'
    };
  }
}