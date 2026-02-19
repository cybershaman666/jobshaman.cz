import { authenticatedFetch } from './csrfService';
import { BACKEND_URL } from '../constants';

export interface AdminSubscriptionFilters {
  q?: string;
  tier?: string;
  status?: string;
  kind?: 'company' | 'user';
  limit?: number;
  offset?: number;
}

export interface AdminSubscriptionUpdate {
  subscription_id?: string;
  target_type?: 'company' | 'user';
  target_id?: string;
  tier?: string;
  status?: string;
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  set_trial_days?: number;
  set_trial_until?: string;
}

export async function getAdminSubscriptions(filters: AdminSubscriptionFilters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.tier) params.set('tier', filters.tier);
  if (filters.status) params.set('status', filters.status);
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));

  const response = await authenticatedFetch(`${BACKEND_URL}/admin/subscriptions?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load subscriptions');
  }

  return response.json();
}

export async function updateAdminSubscription(payload: AdminSubscriptionUpdate) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/subscriptions/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = error.detail || error.message || `HTTP ${response.status}`;
    throw new Error(`Failed to update subscription: ${detail}`);
  }

  return response.json();
}

export async function getAdminNotifications(daysAhead: number = 7) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/notifications?days_ahead=${daysAhead}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load notifications');
  }

  return response.json();
}

export async function getAdminSubscriptionAudit(subscriptionId: string, limit: number = 50) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/subscriptions/${subscriptionId}/audit?limit=${limit}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load audit log');
  }

  return response.json();
}

export async function getAdminStats() {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/stats`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load stats');
  }

  return response.json();
}

export async function getAdminAiQuality(days: number = 30) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/ai-quality?days=${days}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load AI quality stats');
  }

  return response.json();
}

export async function adminSearch(query: string, kind: 'company' | 'user') {
  const params = new URLSearchParams({ query, kind });
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/search?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Search failed');
  }

  return response.json();
}

export async function getAdminUserDigest(userId: string) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/users/${userId}/digest`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load user digest settings');
  }

  return response.json();
}

export async function updateAdminUserDigest(userId: string, payload: { daily_digest_enabled?: boolean }) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/users/${userId}/digest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = error.detail || error.message || `HTTP ${response.status}`;
    throw new Error(`Failed to update user digest: ${detail}`);
  }

  return response.json();
}
