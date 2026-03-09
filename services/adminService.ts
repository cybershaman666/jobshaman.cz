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

export interface AdminCrmLeadPayload {
  company_name: string;
  contact_name?: string;
  contact_role?: string;
  email?: string;
  phone?: string;
  website?: string;
  country?: string;
  city?: string;
  status?: 'new' | 'contacted' | 'qualified' | 'meeting' | 'proposal' | 'won' | 'lost';
  priority?: 'low' | 'medium' | 'high';
  source?: 'manual' | 'outbound' | 'inbound' | 'referral' | 'event';
  notes?: string;
  next_follow_up_at?: string;
  last_contacted_at?: string;
  linked_company_id?: string;
  metadata?: Record<string, unknown>;
}

export interface AdminFounderBoardCardPayload {
  title: string;
  body?: string;
  card_type?: 'idea' | 'opinion' | 'task' | 'note';
  status?: 'inbox' | 'active' | 'done' | 'archived';
  priority?: 'low' | 'medium' | 'high';
  assignee_name?: string;
  assignee_email?: string;
  metadata?: Record<string, unknown>;
}

export interface AdminFounderBoardCommentPayload {
  body: string;
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

export async function getAdminCrmEntityDetail(kind: 'company' | 'user' | 'lead', entityId: string) {
  const params = new URLSearchParams({ kind, entity_id: entityId });
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/crm/entity-detail?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load CRM entity detail');
  }

  return response.json();
}

export async function getAdminCrmEntities(params: { q?: string; kind?: 'company' | 'user' | 'all'; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.kind) search.set('kind', params.kind);
  if (params.limit) search.set('limit', String(params.limit));

  const response = await authenticatedFetch(`${BACKEND_URL}/admin/crm/entities?${search.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load CRM entities');
  }

  return response.json();
}

export async function getAdminCrmLeads(params: { q?: string; status?: string; limit?: number; offset?: number } = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.status) search.set('status', params.status);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.offset) search.set('offset', String(params.offset));

  const response = await authenticatedFetch(`${BACKEND_URL}/admin/crm/leads?${search.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (response.status === 404) {
    return { items: [], count: 0, unsupported: true };
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load CRM leads');
  }

  return response.json();
}

export async function createAdminCrmLead(payload: AdminCrmLeadPayload) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/crm/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (response.status === 404) {
    throw new Error('CRM leads support is not deployed on the current backend yet');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to create CRM lead');
  }

  return response.json();
}

export async function updateAdminCrmLead(leadId: string, payload: Partial<AdminCrmLeadPayload>) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/crm/leads/${leadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (response.status === 404) {
    throw new Error('CRM leads support is not deployed on the current backend yet');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update CRM lead');
  }

  return response.json();
}

export async function getAdminFounderBoard(params: { q?: string; status?: string; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.status) search.set('status', params.status);
  if (params.limit) search.set('limit', String(params.limit));

  const response = await authenticatedFetch(`${BACKEND_URL}/admin/founder-board?${search.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (response.status === 404) {
    return { items: [], count: 0, unsupported: true };
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load founder board');
  }

  return response.json();
}

export async function createAdminFounderBoardCard(payload: AdminFounderBoardCardPayload) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/founder-board`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (response.status === 404) {
    throw new Error('Founder board support is not deployed on the current backend yet');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to create founder board card');
  }

  return response.json();
}

export async function updateAdminFounderBoardCard(cardId: string, payload: Partial<AdminFounderBoardCardPayload>) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/founder-board/${cardId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (response.status === 404) {
    throw new Error('Founder board support is not deployed on the current backend yet');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to update founder board card');
  }

  return response.json();
}

export async function createAdminFounderBoardComment(cardId: string, payload: AdminFounderBoardCommentPayload) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/founder-board/${cardId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (response.status === 404) {
    throw new Error('Founder board comments are not deployed on the current backend yet');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to create founder board comment');
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

export async function adminSearch(query: string, kind: 'company' | 'user' | 'lead') {
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

export async function getAdminPushSubscriptions(params: { q?: string; limit?: number; offset?: number; activeOnly?: boolean } = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.offset) search.set('offset', String(params.offset));
  if (params.activeOnly !== undefined) search.set('active_only', params.activeOnly ? 'true' : 'false');

  const response = await authenticatedFetch(`${BACKEND_URL}/admin/push-subscriptions?${search.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load push subscriptions');
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

export async function updateAdminUserDigest(userId: string, payload: {
  daily_digest_enabled?: boolean;
  daily_digest_push_enabled?: boolean;
  daily_digest_time?: string;
  daily_digest_timezone?: string;
}) {
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

export async function getAdminJobRoles(params: { q?: string; limit?: number; offset?: number } = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.limit) search.set('limit', String(params.limit));
  if (params.offset) search.set('offset', String(params.offset));

  const response = await authenticatedFetch(`${BACKEND_URL}/admin/jcfpm/job-roles?${search.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || 'Failed to load job roles');
  }

  return response.json();
}

export async function createAdminJobRole(payload: {
  title: string;
  d1: number;
  d2: number;
  d3: number;
  d4: number;
  d5: number;
  d6: number;
  salary_range?: string;
  growth_potential?: string;
  ai_impact?: string;
  ai_intensity?: string;
  remote_friendly?: string;
  weights?: Record<string, unknown>;
}) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/jcfpm/job-roles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = error.detail || error.message || `HTTP ${response.status}`;
    throw new Error(`Failed to create job role: ${detail}`);
  }

  return response.json();
}

export async function updateAdminJobRole(roleId: string, payload: {
  title?: string;
  d1?: number;
  d2?: number;
  d3?: number;
  d4?: number;
  d5?: number;
  d6?: number;
  salary_range?: string;
  growth_potential?: string;
  ai_impact?: string;
  ai_intensity?: string;
  remote_friendly?: string;
  weights?: Record<string, unknown>;
}) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/jcfpm/job-roles/${roleId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = error.detail || error.message || `HTTP ${response.status}`;
    throw new Error(`Failed to update job role: ${detail}`);
  }

  return response.json();
}

export async function deleteAdminJobRole(roleId: string) {
  const response = await authenticatedFetch(`${BACKEND_URL}/admin/jcfpm/job-roles/${roleId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = error.detail || error.message || `HTTP ${response.status}`;
    throw new Error(`Failed to delete job role: ${detail}`);
  }

  return response.json();
}
