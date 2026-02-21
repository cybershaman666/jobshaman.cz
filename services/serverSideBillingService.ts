/**
 * SERVER-SIDE ONLY: Billing verification service
 * This replaces all client-side billing verification for security.
 */

import { authenticatedFetch, isBackendNetworkCooldownActive } from './csrfService';
import { BILLING_BACKEND_URL } from '../constants';

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
const SUBSCRIPTION_STATUS_NETWORK_COOLDOWN_MS = 60_000;
let subscriptionStatusNetworkCooldownUntil = 0;
let lastSubscriptionStatusLogAt = 0;
const subscriptionStatusInFlight = new Map<string, Promise<SubscriptionStatus>>();

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

const isLikelyNetworkError = (error: unknown): boolean => {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('cors') || msg.includes('cooldown');
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
    const response = await authenticatedFetch(`${BILLING_BACKEND_URL}/verify-billing`, {
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
  if (subscriptionStatusInFlight.has(userId)) {
    return subscriptionStatusInFlight.get(userId)!;
  }

  const run = (async (): Promise<SubscriptionStatus> => {
  try {
    if (Date.now() < subscriptionStatusNetworkCooldownUntil || isBackendNetworkCooldownActive()) {
      const cached = readCachedSubscriptionStatus(userId);
      if (cached) return cached;
      return {
        tier: 'free',
        tierName: 'Free',
        status: 'inactive',
        assessmentsAvailable: 0,
        assessmentsUsed: 0,
        jobPostingsAvailable: 0
      };
    }

    // MOCK DATA INTERCEPTION
    if (userId === 'mock_company_id') {
      const mockResult: SubscriptionStatus = {
        tier: 'professional',
        tierName: 'Professional Plan (Mock)',
        status: 'active',
        daysUntilRenewal: 30,
        currentPeriodStart: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        assessmentsAvailable: 150,
        assessmentsUsed: 2,
        jobPostingsAvailable: 20
      };
      writeCachedSubscriptionStatus(userId, mockResult);
      return mockResult;
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await authenticatedFetch(`${BILLING_BACKEND_URL}/subscription-status?userId=${userId}`, {
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
        writeCachedSubscriptionStatus(userId, data);
        return data;
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isAborted = lastError.name === 'AbortError';
        const looksLikeNetworkError = isLikelyNetworkError(lastError);
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
    if (isLikelyNetworkError(error)) {
      subscriptionStatusNetworkCooldownUntil = Date.now() + SUBSCRIPTION_STATUS_NETWORK_COOLDOWN_MS;
      const now = Date.now();
      if (now - lastSubscriptionStatusLogAt > 15_000) {
        console.warn('⚠️ Subscription status backend unavailable. Using cached/free fallback.');
        lastSubscriptionStatusLogAt = now;
      }
    }
    const isAborted = error instanceof Error && error.name === 'AbortError';
    if (isAborted && import.meta.env.DEV) {
      console.warn('⏱️ Subscription status request TIMED OUT. The server is likely waking up from sleep.');
    } else if (!isLikelyNetworkError(error)) {
      console.warn('Error getting subscription status (falling back to free tier):', error);
    }
    const cached = readCachedSubscriptionStatus(userId);
    if (cached) {
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
  })();

  subscriptionStatusInFlight.set(userId, run);
  try {
    return await run;
  } finally {
    subscriptionStatusInFlight.delete(userId);
  }
}
