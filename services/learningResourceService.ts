import { BACKEND_URL, SEARCH_BACKEND_URL } from '../constants';
import type { LearningResource } from '../types';
import { authenticatedFetch } from './csrfService';
import { geocodeWithCaching } from './geocodingService';

type LearningResourceQueryOptions = {
  skillName?: string;
  status?: 'active' | 'draft' | 'archived' | 'all';
  partnerId?: string;
};

const LEARNING_RESOURCE_BACKEND_FALLBACKS = [
  'https://jobshaman-search-api.northflank.app',
  'https://api.jobshaman.cz',
];
const LEARNING_RESOURCES_UNAVAILABLE_KEY = 'jobshaman_learning_resources_unavailable_until';
const LEARNING_RESOURCES_UNAVAILABLE_TTL_MS = 5 * 60 * 1000;
const DEBUG_LEARNING_RESOURCES =
  import.meta.env.DEV || String(import.meta.env.VITE_DEBUG_LEARNING_RESOURCES || '').toLowerCase() === 'true';

const normalizeBackendBaseUrl = (value?: string): string | null => {
  if (!value) return null;
  try {
    const raw = String(value).trim();
    if (!raw) return null;
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return null;
  }
};

const resolveLearningResourceBackends = (): string[] => {
  const searchBase = normalizeBackendBaseUrl(SEARCH_BACKEND_URL);
  const coreBase = normalizeBackendBaseUrl(BACKEND_URL);
  const fallbackBases = LEARNING_RESOURCE_BACKEND_FALLBACKS
    .map((value) => normalizeBackendBaseUrl(value))
    .filter((base): base is string => !!base);
  return Array.from(
    new Set([searchBase, coreBase, ...fallbackBases].filter((base): base is string => !!base))
  ).filter((base) => !/code\.run/i.test(base));
};

const resolveLearningResourceReadBackend = (): string | null => {
  const candidates = resolveLearningResourceBackends();
  return candidates[0] || null;
};

const mapLearningResourceRow = (row: any): LearningResource => ({
  id: String(row?.id || ''),
  title: String(row?.title || ''),
  description: String(row?.description || ''),
  skill_tags: Array.isArray(row?.skill_tags) ? row.skill_tags.map((item: unknown) => String(item || '').trim()).filter(Boolean) : [],
  url: String(row?.url || row?.affiliate_url || ''),
  provider: String(row?.provider || ''),
  duration_hours: Number(row?.duration_hours || 0),
  difficulty: (['Beginner', 'Intermediate', 'Advanced'].includes(String(row?.difficulty || '')) ? row.difficulty : 'Beginner') as LearningResource['difficulty'],
  price: Number(row?.price || 0),
  currency: String(row?.currency || 'CZK'),
  rating: Number(row?.rating || 0),
  reviews_count: Number(row?.reviews_count || 0),
  created_at: String(row?.created_at || new Date().toISOString()),
  is_government_funded: Boolean(row?.is_government_funded),
  funding_amount_czk: row?.funding_amount_czk == null ? undefined : Number(row.funding_amount_czk),
  affiliate_url: row?.affiliate_url ? String(row.affiliate_url) : undefined,
  location: row?.location ? String(row.location) : undefined,
  lat: row?.lat == null ? undefined : Number(row.lat),
  lng: row?.lng == null ? undefined : Number(row.lng),
  status: (['active', 'draft', 'archived'].includes(String(row?.status || '')) ? row.status : 'active') as LearningResource['status'],
  partner_name: row?.partner_name ? String(row.partner_name) : undefined,
  partner_id: row?.partner_id ? String(row.partner_id) : null,
});

const buildQueryString = (options?: LearningResourceQueryOptions): string => {
  const params = new URLSearchParams();
  if (options?.skillName) params.set('skillName', options.skillName);
  if (options?.status) params.set('status', options.status);
  if (options?.partnerId) params.set('partnerId', options.partnerId);
  const query = params.toString();
  return query ? `?${query}` : '';
};

const parseListResponse = async (response: Response): Promise<LearningResource[]> => {
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(detail || `Learning resources request failed with ${response.status}`);
  }
  const payload = await response.json().catch(() => ({ items: [] }));
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.map(mapLearningResourceRow);
};

const enrichLocationPayload = async (payload: Partial<Record<string, any>>) => {
  const record: Record<string, any> = { ...payload };
  if (record.location !== undefined) {
    const trimmed = String(record.location || '').trim();
    if (!trimmed) {
      record.location = '';
      record.lat = null;
      record.lng = null;
    } else if (record.lat == null || record.lng == null) {
      try {
        const geo = await geocodeWithCaching(trimmed);
        if (geo) {
          record.lat = geo.lat;
          record.lng = geo.lon;
        }
      } catch (error) {
        console.warn('Learning resource geocoding failed:', error);
      }
    }
  }
  return record;
};

const shouldTryNextBackend = (response: Response): boolean => response.status === 404 || response.status === 405 || response.status === 501;

const isLikelyCorsOrNetworkError = (error: unknown): boolean => {
  const msg = String((error as any)?.message || error || '').toLowerCase();
  return msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('cors');
};

const readUnavailableUntil = (): number => {
  try {
    const raw = sessionStorage.getItem(LEARNING_RESOURCES_UNAVAILABLE_KEY);
    const parsed = Number(raw || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

const markTemporarilyUnavailable = (): void => {
  try {
    sessionStorage.setItem(
      LEARNING_RESOURCES_UNAVAILABLE_KEY,
      String(Date.now() + LEARNING_RESOURCES_UNAVAILABLE_TTL_MS),
    );
  } catch {
    // ignore storage failures
  }
};

const clearUnavailableMarker = (): void => {
  try {
    sessionStorage.removeItem(LEARNING_RESOURCES_UNAVAILABLE_KEY);
  } catch {
    // ignore storage failures
  }
};

export const fetchLearningResources = async (options?: LearningResourceQueryOptions): Promise<LearningResource[]> => {
  if (readUnavailableUntil() > Date.now()) return [];
  const base = resolveLearningResourceReadBackend();
  if (!base) return [];
  let lastError: Error | null = null;
  try {
    const response = await fetch(`${base}/learning-resources${buildQueryString(options)}`, {
      method: 'GET',
    });
    if (response.ok) {
      clearUnavailableMarker();
      return await parseListResponse(response);
    }
    lastError = new Error(await response.text().catch(() => `Learning resources request failed with ${response.status}`));
    if (!shouldTryNextBackend(response)) {
      return await parseListResponse(response);
    }
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error || 'Learning resources request failed'));
  }
  if (lastError && isLikelyCorsOrNetworkError(lastError)) {
    markTemporarilyUnavailable();
    if (DEBUG_LEARNING_RESOURCES) {
      console.warn('[Learning resources] backend temporarily unavailable, suppressing repeated fetches for this session window.');
    }
    return [];
  }
  if (DEBUG_LEARNING_RESOURCES) {
    console.error('Learning resources fetch error:', lastError || new Error('Learning resources request failed'));
  }
  return [];
};

export const fetchLearningResourcesByPartner = async (partnerId: string): Promise<LearningResource[]> => {
  if (readUnavailableUntil() > Date.now()) return [];
  const bases = resolveLearningResourceBackends();
  if (!bases.length) return [];
  let lastError: Error | null = null;
  for (const base of bases) {
    try {
      const response = await authenticatedFetch(`${base}/companies/${encodeURIComponent(partnerId)}/learning-resources`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        clearUnavailableMarker();
        return await parseListResponse(response);
      }
      if (shouldTryNextBackend(response)) {
        lastError = new Error(await response.text().catch(() => `Learning resources request failed with ${response.status}`));
        continue;
      }
      return await parseListResponse(response);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error || 'Learning resources request failed'));
      continue;
    }
  }
  if (lastError && isLikelyCorsOrNetworkError(lastError)) {
    markTemporarilyUnavailable();
    if (DEBUG_LEARNING_RESOURCES) {
      console.warn('[Learning resources] partner backend temporarily unavailable, suppressing repeated fetches for this session window.');
    }
    return [];
  }
  if (DEBUG_LEARNING_RESOURCES) {
    console.error('Learning resources by partner fetch error:', lastError || new Error('Learning resources request failed'));
  }
  return [];
};

export const createLearningResource = async (payload: Partial<Record<string, any>>): Promise<LearningResource> => {
  const partnerId = String(payload.partner_id || '').trim();
  if (!partnerId) throw new Error('Missing partner_id');
  const body = await enrichLocationPayload(payload);
  const bases = resolveLearningResourceBackends();
  if (!bases.length) throw new Error('No learning resource backend configured');
  let lastError: Error | null = null;
  for (const base of bases) {
    try {
      const response = await authenticatedFetch(`${base}/companies/${encodeURIComponent(partnerId)}/learning-resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        return mapLearningResourceRow(await response.json());
      }
      if (shouldTryNextBackend(response)) {
        lastError = new Error(await response.text().catch(() => `Learning resource create failed with ${response.status}`));
        continue;
      }
      const detail = await response.text().catch(() => '');
      throw new Error(detail || `Learning resource create failed with ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error || 'Learning resource create failed'));
      continue;
    }
  }
  throw lastError || new Error('Learning resource create failed');
};

export const updateLearningResource = async (resourceId: string, updates: Partial<Record<string, any>>): Promise<LearningResource> => {
  const partnerId = String(updates.partner_id || '').trim();
  if (!partnerId) throw new Error('Missing partner_id');
  const body = await enrichLocationPayload(updates);
  const bases = resolveLearningResourceBackends();
  if (!bases.length) throw new Error('No learning resource backend configured');
  let lastError: Error | null = null;
  for (const base of bases) {
    try {
      const response = await authenticatedFetch(
        `${base}/companies/${encodeURIComponent(partnerId)}/learning-resources/${encodeURIComponent(resourceId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (response.ok) {
        return mapLearningResourceRow(await response.json());
      }
      if (shouldTryNextBackend(response)) {
        lastError = new Error(await response.text().catch(() => `Learning resource update failed with ${response.status}`));
        continue;
      }
      const detail = await response.text().catch(() => '');
      throw new Error(detail || `Learning resource update failed with ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error || 'Learning resource update failed'));
      continue;
    }
  }
  throw lastError || new Error('Learning resource update failed');
};
