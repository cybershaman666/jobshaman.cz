import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';
import { CareerOpsFeedResponse } from '../types';
import { dedupeJobsList } from '../utils/jobDedupe';

const parseTimestampMs = (value: unknown): number => {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const freshnessBonusForRadar = (job: Record<string, any>): number => {
  const timestampMs = parseTimestampMs(job.scrapedAt || job.scraped_at || job.postedAt || job.posted_at);
  if (!timestampMs) return 0;
  const ageHours = Math.max(0, (Date.now() - timestampMs) / 3_600_000);
  if (ageHours <= 24) return 16;
  if (ageHours <= 72) return 8;
  if (ageHours <= 168) return 3;
  return 0;
};

const fetchRawJobSpyJobs = async (limit: number = 24): Promise<Record<string, any>[]> => {
  try {
    const jobspyResponse = await authenticatedFetch(`${BACKEND_URL}/jobs/external/jobspy/search?page=0&page_size=${Math.max(1, Math.min(limit, 60))}`, {
      method: 'GET',
    });
    if (!jobspyResponse.ok) return [];
    const jobspyPayload = await jobspyResponse.json();
    return Array.isArray(jobspyPayload?.jobs) ? jobspyPayload.jobs : [];
  } catch {
    return [];
  }
};

const mapRawJobsToCareerOpsLite = (rawJobs: Record<string, any>[]) => rawJobs.map((job: Record<string, any>, index: number) => {
  const sourceSite = String(job.source_site || job.source || 'external').replace(/^jobspy:/i, '');
  const freshnessBonus = freshnessBonusForRadar(job);
  const heuristicFit = Number(job.jhi?.score || job.priorityScore || job.searchDiagnostics?.backendScore || 0)
    || (sourceSite.includes('linkedin') ? 62 : sourceSite.includes('indeed') ? 58 : sourceSite.includes('google') ? 56 : sourceSite.includes('zip') ? 54 : 48) + freshnessBonus;

  return {
    raw_job_id: String(job.id || `external-${index}`),
    company_key: String(job.company || `company-${index}`).toLowerCase().replace(/\s+/g, '-'),
    company: String(job.company || 'Unknown company'),
    title: String(job.title || 'Untitled role'),
    location: String(job.location || 'Location TBD'),
    country: job.country_code || null,
    source_site: sourceSite,
    job_type: job.contract_type || null,
    interval: job.salary_timeframe || null,
    job_url: job.url || job.job_url || null,
    description_excerpt: String(job.description || '').slice(0, 280),
    description_present: Boolean(String(job.description || '').trim()),
    is_remote: String(job.type || '').toLowerCase().includes('remote') || String(job.work_model || '').toLowerCase().includes('remote'),
    work_mode_normalized: String(job.work_model || job.type || 'unknown').toLowerCase(),
    freshness_bucket: String(job.freshness_bucket || 'fresh_external'),
    freshness_score: 0.6,
    language_code: job.language_code || null,
    inferred_seniority: null,
    primary_role_family: null,
    primary_domain: null,
    role_families: [],
    domains: [],
    scraped_at: job.scrapedAt || job.scraped_at || null,
    updated_at: null,
    expires_at: null,
    fit_score: heuristicFit,
    match_bucket: heuristicFit >= 60 ? 'best_fit' as const : 'adjacent' as const,
    fit_reasons: [
      String(job.company || 'External source'),
      String(job.location || 'Flexible location'),
      sourceSite || String(job.source || 'cached external'),
    ].filter(Boolean),
    action_type: 'new_high_fit_job' as const,
  };
});

const blendSupplementalJobSpyFeed = async (feed: CareerOpsFeedResponse): Promise<CareerOpsFeedResponse> => {
  const existingJobs = Array.isArray(feed?.jobs) ? feed.jobs : [];
  const hasNonWwrJobSpySignal = existingJobs.some((job: any) => {
    const sourceSite = String(job?.source_site || '').toLowerCase();
    return sourceSite.includes('linkedin') || sourceSite.includes('indeed') || sourceSite.includes('google') || sourceSite.includes('zip');
  });
  const allFitsZero = existingJobs.length > 0 && existingJobs.every((job: any) => Number(job?.fit_score || 0) <= 0);
  if (existingJobs.length > 0 && hasNonWwrJobSpySignal && !allFitsZero) {
    return feed;
  }

  const supplementalRaw = await fetchRawJobSpyJobs(24);
  if (!supplementalRaw.length) return feed;

  const supplementalJobs = mapRawJobsToCareerOpsLite(supplementalRaw)
    .sort((a, b) => Number(b.fit_score || 0) - Number(a.fit_score || 0));
  const mergedJobs = dedupeJobsList([...(existingJobs as any[]), ...supplementalJobs])
    .sort((a: any, b: any) => Number(b?.fit_score || 0) - Number(a?.fit_score || 0))
    .slice(0, Math.max(existingJobs.length, 18));

  return {
    ...feed,
    jobs: mergedJobs as any,
    actions: Array.isArray(feed?.actions) && feed.actions.length > 0
      ? feed.actions
      : supplementalJobs.slice(0, 8).map((job) => ({
          id: `supplemental:${job.raw_job_id}`,
          kind: 'new_high_fit_job',
          title: `${job.title} at ${job.company}`,
          subtitle: 'Supplemented from JobSpy cache',
          score: job.fit_score,
          job_id: job.raw_job_id,
          company_key: job.company_key,
          reason_lines: job.fit_reasons,
          source_url: job.job_url,
        })) as any,
  };
};

const buildCareerOpsLiteFallback = async (): Promise<CareerOpsFeedResponse> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/jobs/external/cached-feed?page=0&page_size=24`, {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error(`Career ops fallback failed (${response.status})`);
  }

  const payload = await response.json();
  let rawJobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
  const jobspyJobs = await fetchRawJobSpyJobs(24);
  if (jobspyJobs.length > 0) {
    rawJobs = dedupeJobsList([...rawJobs, ...jobspyJobs]);
  }

  const mappedJobs = mapRawJobsToCareerOpsLite(rawJobs)
    .sort((a, b) => Number(b.fit_score || 0) - Number(a.fit_score || 0));

  return {
    source: 'jobspy_career_ops_fallback',
    jobs: mappedJobs,
    companies: [],
    actions: mappedJobs.slice(0, 8).map((job: (typeof mappedJobs)[number]) => ({
      id: `fallback:${job.raw_job_id}`,
      kind: 'new_high_fit_job',
      title: `${job.title} at ${job.company}`,
      subtitle: 'Fallback radar built from external cached feed',
      score: job.fit_score,
      job_id: job.raw_job_id,
      company_key: job.company_key,
      reason_lines: job.fit_reasons,
      source_url: job.job_url,
    })),
    meta: {
      candidate_intent: null,
      recommendation_intelligence: null,
      counts: {
        raw_jobs_seen: Math.max(Number(payload?.total_count || 0), mappedJobs.length),
        enriched_jobs_scored: mappedJobs.length,
        companies_ranked: 0,
        actions: Math.min(8, mappedJobs.length),
      },
      fallback_mode: 'lite_cached_external',
    } as any,
  };
};

export const fetchCareerOpsFeed = async (options?: {
  refresh?: boolean;
  jobLimit?: number;
  companyLimit?: number;
  actionLimit?: number;
}): Promise<CareerOpsFeedResponse> => {
  const params = new URLSearchParams();
  if (options?.refresh) params.set('refresh', 'true');
  if (options?.jobLimit) params.set('job_limit', String(options.jobLimit));
  if (options?.companyLimit) params.set('company_limit', String(options.companyLimit));
  if (options?.actionLimit) params.set('action_limit', String(options.actionLimit));

  const query = params.toString();
  const url = `${BACKEND_URL}/jobs/external/jobspy/career-ops${query ? `?${query}` : ''}`;
  const response = await authenticatedFetch(url, { method: 'GET' });
  if (!response.ok) {
    if (response.status === 404) {
      return buildCareerOpsLiteFallback();
    }
    const text = await response.text().catch(() => '');
    throw new Error(text || `Career ops feed failed (${response.status})`);
  }
  const feed = (await response.json()) as CareerOpsFeedResponse;
  return blendSupplementalJobSpyFeed(feed);
};
