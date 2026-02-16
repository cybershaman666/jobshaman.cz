/**
 * SERVER-SIDE ONLY: Billing verification service
 * This replaces all client-side billing verification for security.
 */

import { authenticatedFetch } from './csrfService';
import { BACKEND_URL } from '../constants';

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

const SUBSCRIPTION_STATUS_CACHE_KEY = 'subscription_status_cache_v1';

type SubscriptionStatus = {
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
};

const readCachedSubscriptionStatus = (userId: string): SubscriptionStatus | null => {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_STATUS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId?: string; data?: SubscriptionStatus };
    if (!parsed?.data || parsed.userId !== userId) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCachedSubscriptionStatus = (userId: string, data: SubscriptionStatus): void => {
  try {
    localStorage.setItem(
      SUBSCRIPTION_STATUS_CACHE_KEY,
      JSON.stringify({ userId, data, cachedAt: new Date().toISOString() })
    );
  } catch {
    // ignore storage failures
  }
};

/**
 * SERVER-SIDE ONLY: Verify if user can access a premium feature
 * This function should ONLY be called from the backend API endpoints
 * Automatically includes CSRF token via authenticatedFetch
 */
export async function verifyServerSideBilling(
  check: ServerSideBillingCheck
): Promise<BillingVerificationResult> {
  try {
    const response = await authenticatedFetch(`${BACKEND_URL}/verify-billing`, {
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
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  try {
    console.log('🔄 Calling subscription-status endpoint for userId:', userId);

    // MOCK DATA INTERCEPTION
    if (userId === 'mock_company_id') {
      console.log('⚠️ Mock Company ID detected - returning mock subscription data locally');
      const mockResult: SubscriptionStatus = {
        tier: 'business', // Default to business for testing
        tierName: 'Business Plan (Mock)',
        status: 'active',
        daysUntilRenewal: 30,
        currentPeriodStart: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        assessmentsAvailable: 10,
        assessmentsUsed: 2,
        jobPostingsAvailable: 999
      };
      writeCachedSubscriptionStatus(userId, mockResult);
      return mockResult;
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await authenticatedFetch(`${BACKEND_URL}/subscription-status?userId=${userId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.warn(`⚠️ Subscription status returned ${response.status}:`, response.statusText);
          const isRetryable = response.status >= 500;
          if (isRetryable && attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          throw new Error(`Failed to get subscription status: ${response.status}`);
        }

        const data: SubscriptionStatus = await response.json();
        console.log('✅ Subscription status retrieved:', data);
        writeCachedSubscriptionStatus(userId, data);
        return data;
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isAborted = lastError.name === 'AbortError';
        const looksLikeNetworkError = lastError.message?.toLowerCase().includes('networkerror');
        if ((isAborted || looksLikeNetworkError) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw lastError;
      }
    }
    throw lastError || new Error('Failed to get subscription status');
  } catch (error) {
    const isAborted = error instanceof Error && error.name === 'AbortError';
    if (isAborted) {
      console.warn('⏱️ Subscription status request TIMED OUT. The server is likely waking up from sleep.');
    } else {
      console.warn('Error getting subscription status (falling back to free tier):', error);
    }
    const cached = readCachedSubscriptionStatus(userId);
    if (cached) {
      console.log('ℹ️ Using cached subscription status due to backend unavailability.');
      return cached;
    }
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
