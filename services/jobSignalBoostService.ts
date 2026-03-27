import { BACKEND_URL } from '../constants';
import type { JobSignalBoostBrief, JobSignalBoostOutput, JobSignalBoostQualityFlags } from '../types';
import { authenticatedFetch } from './csrfService';

const parseErrorDetail = async (response: Response, fallback: string): Promise<string> => {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === 'string') return payload.detail;
    if (payload?.detail?.message) return String(payload.detail.message);
  } catch {
    // ignore malformed error payloads
  }
  return fallback;
};

const isOptionalSignalBoostFeedUnavailable = (status: number): boolean => (
  [401, 403, 404, 409, 501, 503].includes(status)
);

const mapOutput = (payload: any): JobSignalBoostOutput => ({
  id: String(payload?.id || ''),
  share_slug: String(payload?.share_slug || ''),
  share_url: String(payload?.share_url || ''),
  locale: String(payload?.locale || 'en'),
  status: String(payload?.status || 'draft'),
  job_snapshot: payload?.job_snapshot && typeof payload.job_snapshot === 'object' ? payload.job_snapshot : {},
  candidate_snapshot: payload?.candidate_snapshot && typeof payload.candidate_snapshot === 'object'
    ? payload.candidate_snapshot
    : { name: 'JobShaman member' },
  scenario_payload: payload?.scenario_payload as JobSignalBoostBrief,
  response_payload: payload?.response_payload && typeof payload.response_payload === 'object' ? payload.response_payload : {},
  recruiter_readout: payload?.recruiter_readout && typeof payload.recruiter_readout === 'object' ? payload.recruiter_readout : null,
  signal_summary: payload?.signal_summary && typeof payload.signal_summary === 'object' ? payload.signal_summary : null,
  quality_flags: payload?.quality_flags as JobSignalBoostQualityFlags,
  analytics: payload?.analytics && typeof payload.analytics === 'object' ? payload.analytics : undefined,
  created_at: payload?.created_at ?? null,
  updated_at: payload?.updated_at ?? null,
  published_at: payload?.published_at ?? null,
});

export const fetchSignalBoostBrief = async (
  jobId: string | number,
  locale: string,
): Promise<JobSignalBoostBrief> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/jobs/${jobId}/signal-boost/brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, 'Failed to generate Signal Boost brief.'));
  }
  const payload = await response.json();
  return payload?.brief as JobSignalBoostBrief;
};

export const publishSignalBoostOutput = async (
  jobId: string | number,
  payload: {
    locale: string;
    responsePayload: Record<string, string>;
    scenarioPayload?: JobSignalBoostBrief | null;
    status?: 'draft' | 'published';
  },
): Promise<{ output: JobSignalBoostOutput; qualityFlags: JobSignalBoostQualityFlags }> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/jobs/${jobId}/signal-boost/outputs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locale: payload.locale,
      response_payload: payload.responsePayload,
      scenario_payload: payload.scenarioPayload || null,
      status: payload.status || 'published',
    }),
  });

  if (!response.ok) {
    const parsed = await response.json().catch(() => null);
    const detail = parsed?.detail;
    if (detail && typeof detail === 'object' && detail.quality_flags) {
      const error = new Error(detail.message || 'Signal Boost needs more detail before publishing.') as Error & {
        qualityFlags?: JobSignalBoostQualityFlags;
      };
      error.qualityFlags = detail.quality_flags as JobSignalBoostQualityFlags;
      throw error;
    }
    throw new Error(await parseErrorDetail(response, 'Failed to publish Signal Boost output.'));
  }

  const data = await response.json();
  return {
    output: mapOutput(data?.output),
    qualityFlags: data?.quality_flags as JobSignalBoostQualityFlags,
  };
};

export const generateSignalBoostStarter = async (
  jobId: string | number,
  payload: {
    locale: string;
    responsePayload: Record<string, string>;
  },
): Promise<{ responsePayload: Record<string, string>; meta?: { used_ai?: boolean } }> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/jobs/${jobId}/signal-boost/starter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locale: payload.locale,
      response_payload: payload.responsePayload,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, 'Failed to generate a Signal Boost starter.'));
  }

  const data = await response.json();
  return {
    responsePayload: data?.response_payload && typeof data.response_payload === 'object' ? data.response_payload : {},
    meta: data?.meta && typeof data.meta === 'object' ? data.meta : undefined,
  };
};

export const fetchLatestSignalBoostOutputForJob = async (
  jobId: string | number,
): Promise<JobSignalBoostOutput | null> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/jobs/${jobId}/signal-boost/output`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, 'Failed to load existing Signal Boost output.'));
  }

  const data = await response.json();
  return mapOutput(data?.output);
};

export const fetchMySignalBoostOutputs = async (
  limit: number = 12,
  options?: {
    includeArchived?: boolean;
  },
): Promise<JobSignalBoostOutput[]> => {
  const params = new URLSearchParams({
    limit: String(limit),
  });
  if (options?.includeArchived) {
    params.set('include_archived', '1');
  }
  const response = await authenticatedFetch(`${BACKEND_URL}/signal-boost/me?${params.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (isOptionalSignalBoostFeedUnavailable(response.status)) {
    return [];
  }
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, 'Failed to load Signal Boost outputs.'));
  }

  const data = await response.json();
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(mapOutput);
};

export const revokeSignalBoostOutput = async (
  outputId: string,
): Promise<JobSignalBoostOutput> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/signal-boost/${encodeURIComponent(outputId)}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, 'Failed to revoke Signal Boost link.'));
  }

  const data = await response.json();
  return mapOutput(data?.output);
};

export const updateSignalBoostOutput = async (
  outputId: string,
  payload: {
    locale: string;
    responsePayload: Record<string, string>;
    scenarioPayload?: JobSignalBoostBrief | null;
    status?: 'draft' | 'published';
  },
): Promise<{ output: JobSignalBoostOutput; qualityFlags: JobSignalBoostQualityFlags }> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/signal-boost/${outputId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locale: payload.locale,
      response_payload: payload.responsePayload,
      scenario_payload: payload.scenarioPayload || null,
      status: payload.status || 'published',
    }),
  });

  if (!response.ok) {
    const parsed = await response.json().catch(() => null);
    const detail = parsed?.detail;
    if (detail && typeof detail === 'object' && detail.quality_flags) {
      const error = new Error(detail.message || 'Signal Boost needs more detail before publishing.') as Error & {
        qualityFlags?: JobSignalBoostQualityFlags;
      };
      error.qualityFlags = detail.quality_flags as JobSignalBoostQualityFlags;
      throw error;
    }
    throw new Error(await parseErrorDetail(response, 'Failed to update Signal Boost output.'));
  }

  const data = await response.json();
  return {
    output: mapOutput(data?.output),
    qualityFlags: data?.quality_flags as JobSignalBoostQualityFlags,
  };
};

export const fetchPublicSignalBoostOutput = async (
  shareSlug: string,
): Promise<JobSignalBoostOutput> => {
  const response = await fetch(`${BACKEND_URL}/signal-boost/${encodeURIComponent(shareSlug)}`, {
    method: 'GET',
    credentials: 'omit',
  });
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response, 'Failed to load Signal Boost output.'));
  }
  const payload = await response.json();
  return mapOutput(payload?.output);
};

export const recordSignalBoostEvent = async (
  outputId: string,
  eventType: 'share_copy' | 'recruiter_cta_click' | 'open_original_listing',
): Promise<void> => {
  try {
    await fetch(`${BACKEND_URL}/signal-boost/${encodeURIComponent(outputId)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType }),
      credentials: 'omit',
    });
  } catch {
    // event failures should stay silent
  }
};
