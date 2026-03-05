/**
 * SERVER-SIDE ONLY: Billing verification service
 * This replaces all client-side billing verification for security.
 */

import { authenticatedFetch } from './csrfService';
import { BILLING_BACKEND_URL } from '../constants';
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
const SUBSCRIPTION_STATUS_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
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
  jobPostingsUsed?: number;
  roleOpensAvailable?: number;
  roleOpensUsed?: number;
  dialogueSlotsAvailable?: number;
  dialogueSlotsUsed?: number;
  stripeSubscriptionId?: string;
  canceledAt?: string;
};

type SubscriptionStatusCache = {
  userId?: string;
  data?: SubscriptionStatus;
  cachedAt?: string;
};

const normalizeSubscriptionStatus = (status: SubscriptionStatus): SubscriptionStatus => {
  const normalizedTier = String(status?.tier || 'free').toLowerCase();
  const derivedRoleOpensAvailable = normalizedTier === 'enterprise'
    ? 999
    : normalizedTier === 'professional'
      ? 25
      : normalizedTier === 'growth'
        ? 10
        : normalizedTier === 'starter'
          ? 3
          : 1;
  const derivedDialogueSlotsAvailable = normalizedTier === 'enterprise'
    ? 999
    : normalizedTier === 'professional'
      ? 100
      : normalizedTier === 'growth'
        ? 40
        : normalizedTier === 'starter'
          ? 12
          : 3;

  const roleOpensUsed = status.roleOpensUsed ?? status.jobPostingsUsed ?? 0;
  const roleOpensAvailable = status.roleOpensAvailable ?? status.jobPostingsAvailable ?? derivedRoleOpensAvailable;
  const dialogueSlotsUsed = status.dialogueSlotsUsed ?? 0;
  const dialogueSlotsAvailable = status.dialogueSlotsAvailable ?? derivedDialogueSlotsAvailable;

  return {
    ...status,
    roleOpensUsed,
    roleOpensAvailable,
    dialogueSlotsUsed,
    dialogueSlotsAvailable,
    jobPostingsUsed: status.jobPostingsUsed ?? roleOpensUsed,
    jobPostingsAvailable: status.jobPostingsAvailable ?? roleOpensAvailable
  };
};

const readCachedSubscriptionStatus = (userId: string): { data: SubscriptionStatus; cachedAt?: string } | null => {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_STATUS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SubscriptionStatusCache;
    if (!parsed?.data || parsed.userId !== userId) return null;
    return { data: parsed.data, cachedAt: parsed.cachedAt };
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

const readFreshCachedSubscriptionStatus = (userId: string): SubscriptionStatus | null => {
  const cached = readCachedSubscriptionStatus(userId);
  if (!cached) return null;
  if (!cached.cachedAt) return cached.data;
  const cachedAt = new Date(cached.cachedAt).getTime();
  if (!Number.isFinite(cachedAt)) return cached.data;
  if (Date.now() - cachedAt > SUBSCRIPTION_STATUS_CACHE_MAX_AGE_MS) return null;
  return cached.data;
};

const isLikelyNetworkError = (error: unknown): boolean => {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('cors');
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
    const freshCached = readFreshCachedSubscriptionStatus(userId);
    if (freshCached) {
      return freshCached;
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
        jobPostingsAvailable: 20,
        roleOpensAvailable: 25,
        roleOpensUsed: 1,
        dialogueSlotsAvailable: 100,
        dialogueSlotsUsed: 4,
      };
      const normalizedMockResult = normalizeSubscriptionStatus(mockResult);
      writeCachedSubscriptionStatus(userId, normalizedMockResult);
      return normalizedMockResult;
    }

    const maxRetries = 3;
    let lastError: Error | null = null;
    // subscription-status endpoint is guaranteed only on the main backend.
    // Keep probing tight to avoid noisy 404s and long fallback chains.
    const statusBackends = Array.from(new Set([BACKEND_URL].filter(Boolean)));
    const statusPaths = ['/subscription-status'];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let response: Response | null = null;
        let lastStatusBackendError: Error | null = null;

        outer: for (const backendBaseUrl of statusBackends) {
          for (const statusPath of statusPaths) {
            try {
              const candidate = await authenticatedFetch(`${backendBaseUrl}${statusPath}?userId=${userId}`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json'
                }
              });

              // Try alternative backend/path combos on Not Found.
              if (candidate.status === 404) {
                continue;
              }
              response = candidate;
              break outer;
            } catch (backendErr: any) {
              lastStatusBackendError = backendErr instanceof Error ? backendErr : new Error(String(backendErr));
            }
          }
        }

        if (!response) {
          if (lastStatusBackendError) throw lastStatusBackendError;
          throw new Error('Failed to get subscription status: no backend responded');
        }

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
        const normalized = normalizeSubscriptionStatus(data);
        writeCachedSubscriptionStatus(userId, normalized);
        return normalized;
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
    const isAborted = error instanceof Error && error.name === 'AbortError';
    if (isLikelyNetworkError(error) || isAborted) {
      console.warn('⚠️ Subscription status backend unavailable. Using cached/free fallback.');
    }
    if (!isLikelyNetworkError(error) && !isAborted) {
      console.warn('Error getting subscription status (falling back to free tier):', error);
    }
    const cached = readCachedSubscriptionStatus(userId);
    if (cached) {
      return normalizeSubscriptionStatus(cached.data);
    }
    return normalizeSubscriptionStatus({
      tier: 'free',
      tierName: 'Free',
      status: 'inactive',
      assessmentsAvailable: 0,
      assessmentsUsed: 0,
      jobPostingsAvailable: 0,
      roleOpensAvailable: 0,
      roleOpensUsed: 0,
      dialogueSlotsAvailable: 0,
      dialogueSlotsUsed: 0,
    });
  }
  })();

  subscriptionStatusInFlight.set(userId, run);
  try {
    return await run;
  } finally {
    subscriptionStatusInFlight.delete(userId);
  }
}
