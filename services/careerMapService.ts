import { BACKEND_URL } from '../constants';
import { CareerMapGraphModel, CareerMapInferRequest, CareerMapInferResponse, CareerMapTaxonomyResponse, Job } from '../types';

let cachedTaxonomy: CareerMapTaxonomyResponse | null = null;
let cachedTaxonomyAt = 0;
let careerMapUnavailable = false;

const TAXONOMY_TTL_MS = 15 * 60 * 1000;

const resolveBackendUrl = (): string => {
  const candidates = [
    import.meta.env.VITE_SEARCH_API_URL,
    import.meta.env.VITE_SEARCH_BACKEND_URL,
    import.meta.env.VITE_BACKEND_URL,
    import.meta.env.VITE_API_URL,
    BACKEND_URL,
  ].filter(Boolean) as string[];
  return String(candidates[0] || 'http://localhost:8000').replace(/\/$/, '');
};

export const fetchCareerMapTaxonomy = async (): Promise<CareerMapTaxonomyResponse> => {
  if (careerMapUnavailable) {
    throw new Error('CareerMap unavailable');
  }
  const now = Date.now();
  if (cachedTaxonomy && now - cachedTaxonomyAt < TAXONOMY_TTL_MS) return cachedTaxonomy;

  const baseUrl = resolveBackendUrl();
  const res = await fetch(`${baseUrl}/api/career-map/taxonomy`);
  if (!res.ok) {
    if (res.status === 404 || res.status === 501) {
      careerMapUnavailable = true;
      throw new Error(`CareerMap unavailable (${res.status})`);
    }
    throw new Error(`CareerMap taxonomy failed (${res.status})`);
  }
  const json = (await res.json()) as CareerMapTaxonomyResponse;
  cachedTaxonomy = json;
  cachedTaxonomyAt = now;
  return json;
};

export const inferCareerMapJobs = async (jobs: Job[]): Promise<CareerMapInferResponse> => {
  if (careerMapUnavailable) {
    throw new Error('CareerMap unavailable');
  }
  const baseUrl = resolveBackendUrl();
  const payload: CareerMapInferRequest = {
    jobs: (jobs || []).map((job) => ({
      id: job.id,
      title: job.title,
      description: job.description || null,
      required_skills: job.required_skills?.slice(0, 40) ?? null,
    })),
  };
  const res = await fetch(`${baseUrl}/api/career-map/infer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    if (res.status === 404 || res.status === 501) {
      careerMapUnavailable = true;
      throw new Error(`CareerMap unavailable (${res.status})`);
    }
    throw new Error(`CareerMap infer failed (${res.status})`);
  }
  return (await res.json()) as CareerMapInferResponse;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const tokenize = (value: string): string[] => {
  const tokens = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+.#\s-]+/g, ' ')
    .replace(/[_/]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 3);
  // de-noise some common junk
  return tokens.filter((t) => !['the', 'and', 'with', 'for', 'from', 'you', 'our', 'your', 'role', 'work', 'job'].includes(t));
};

const cosineSimilarity = (a: Record<string, number>, b: Record<string, number>): number => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const v of Object.values(a)) na += v * v;
  for (const v of Object.values(b)) nb += v * v;
  if (na <= 0 || nb <= 0) return 0;
  const [small, large] = Object.keys(a).length < Object.keys(b).length ? [a, b] : [b, a];
  for (const [k, v] of Object.entries(small)) {
    const w = large[k];
    if (w) dot += v * w;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (!a.size && !b.size) return 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const v of small) if (large.has(v)) inter++;
  const union = a.size + b.size - inter;
  return union <= 0 ? 0 : inter / union;
};

const buildDynamicRoleFamilyRelations = (
  jobs: Job[],
  inferredById: CareerMapGraphModel['inferredById'],
  baseRelations: Record<string, Record<string, number>>
): Record<string, Record<string, number>> => {
  const families = new Set<string>();
  for (const row of Object.values(inferredById || {})) {
    const fam = row?.primary_role_family || null;
    if (fam) families.add(String(fam));
  }
  const familyTokens: Record<string, Record<string, number>> = {};
  const familyDomains: Record<string, Set<string>> = {};

  for (const job of jobs || []) {
    const inferred = inferredById?.[job.id];
    const family = inferred?.primary_role_family;
    if (!family) continue;
    const famKey = String(family);
    const textParts = [
      job.title,
      job.company,
      inferred?.primary_domain,
      ...(job.required_skills || []),
    ].filter(Boolean).map((v) => String(v));
    const tokens = tokenize(textParts.join(' '));
    const tf = (familyTokens[famKey] ||= {});
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
    const ds = (familyDomains[famKey] ||= new Set<string>());
    if (inferred?.primary_domain) ds.add(String(inferred.primary_domain).toLowerCase());
    (inferred?.domains || []).slice(0, 3).forEach((d) => {
      if (d?.key) ds.add(String(d.key).toLowerCase());
    });
  }

  const famList = Array.from(families);
  const out: Record<string, Record<string, number>> = {};

  const base = baseRelations || {};
  for (const [s, targets] of Object.entries(base)) {
    out[s] ||= {};
    for (const [t, w] of Object.entries(targets || {})) {
      const val = clamp01(Number(w) || 0);
      out[s][t] = Math.max(out[s][t] || 0, val);
    }
  }

  for (let i = 0; i < famList.length; i++) {
    for (let j = i + 1; j < famList.length; j++) {
      const a = famList[i];
      const b = famList[j];
      const ca = familyTokens[a] || {};
      const cb = familyTokens[b] || {};
      const simText = cosineSimilarity(ca, cb);
      const simDomain = jaccard(familyDomains[a] || new Set(), familyDomains[b] || new Set());
      const sim = clamp01(0.65 * simText + 0.35 * simDomain);
      // Keep it subtle vs taxonomy, only materialize decent signals.
      const dynamic = sim >= 0.18 ? clamp01(sim * 0.65) : 0;
      if (dynamic <= 0) continue;
      out[a] ||= {};
      out[b] ||= {};
      out[a][b] = Math.max(out[a][b] || 0, dynamic);
      out[b][a] = Math.max(out[b][a] || 0, dynamic);
    }
  }

  return out;
};

export const buildCareerMapGraphModel = async (jobs: Job[]): Promise<CareerMapGraphModel> => {
  const [taxonomy, inference] = await Promise.all([fetchCareerMapTaxonomy(), inferCareerMapJobs(jobs)]);
  const inferredById: CareerMapGraphModel['inferredById'] = {};
  for (const row of inference.jobs || []) inferredById[row.id] = row;
  const dynamicRelations = buildDynamicRoleFamilyRelations(jobs, inferredById, taxonomy.role_family_relations || {});
  return {
    taxonomy: {
      ...taxonomy,
      role_family_relations: dynamicRelations,
    },
    inference,
    inferredById,
  };
};
