import type { Job } from '../types';

const stripDiacritics = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeDedupText = (value?: string | number | null): string =>
  stripDiacritics(String(value ?? ''))
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const normalizeTokenText = (value?: string | number | null): string =>
  normalizeDedupText(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const stripTrailingTokenPattern = (tokens: string[], patterns: string[][]): string[] => {
  const out = [...tokens];
  for (;;) {
    const match = patterns.find((pattern) => {
      if (out.length < pattern.length) return false;
      const start = out.length - pattern.length;
      return pattern.every((token, i) => out[start + i] === token);
    });
    if (!match) break;
    out.splice(out.length - match.length, match.length);
  }
  return out;
};

const normalizeTitleCoreForDedup = (value?: string | null): string => {
  const tokens = normalizeTokenText(value).split(' ').filter(Boolean);
  if (tokens.length === 0) return '';

  // Strip common gender markers (mostly DE/AT job boards).
  const stripped = stripTrailingTokenPattern(tokens, [
    ['m', 'w', 'd'],
    ['m', 'f', 'd'],
    ['f', 'm', 'd'],
    ['m', 'd', 'w'],
    ['m', 'z'],
    ['w', 'm', 'd'],
  ]);

  return stripped.join(' ').trim();
};

const normalizeCompanyCoreForDedup = (value?: string | null): string => {
  const tokens = normalizeTokenText(value).split(' ').filter(Boolean);
  if (tokens.length === 0) return '';

  const corporateSuffixPatterns: string[][] = [
    ['s', 'r', 'o'], // s.r.o.
    ['a', 's'], // a.s.
    ['spol', 's', 'r', 'o'], // spol. s r o (best-effort)
    ['gmbh'],
    ['ag'],
    ['se'],
    ['kg'],
    ['gbr'],
    ['ltd'],
    ['limited'],
    ['inc'],
    ['llc'],
    ['corp'],
    ['corporation'],
    ['company'],
    ['co'],
    ['bv'],
    ['oy'],
    ['ab'],
    ['sa'],
    ['sarl'],
    ['srl'],
    ['spa'],
  ];

  const stripped = stripTrailingTokenPattern(tokens, corporateSuffixPatterns);
  return stripped.join(' ').trim();
};

const normalizeDedupUrl = (value?: string | null): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw);
    url.hash = '';
    // Strip common tracking params, but keep identity params like job_id, id, gh_jid, etc.
    const trackingParams = new Set([
      'gclid',
      'fbclid',
      'msclkid',
      'igshid',
      'mc_cid',
      'mc_eid',
      'vero_id',
      'vero_conv',
      'yclid',
      'gbraid',
      'wbraid',
      'ref',
      'referrer',
      'ref_src',
      'src',
      'source',
      'campaign',
      'campaignid',
      'adgroupid',
      'creative',
      'keyword',
      'placement',
    ]);

    const shouldDropParam = (key: string): boolean => {
      const k = key.toLowerCase();
      if (k.startsWith('utm_')) return true;
      if (k.startsWith('pk_')) return true;
      if (k.startsWith('ga_')) return true;
      if (k.startsWith('sc_')) return true;
      if (k.startsWith('spm_')) return true;
      if (k === 'cmp' || k === 'cmpid' || k === 'cmp_id') return true;
      return trackingParams.has(k);
    };

    // URLSearchParams iteration is ordered; sort the remaining params for a stable canonical form.
    const keptEntries: Array<[string, string]> = [];
    url.searchParams.forEach((val, key) => {
      if (!shouldDropParam(key)) {
        keptEntries.push([key, val]);
      }
    });
    keptEntries.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    url.search = keptEntries.length
      ? `?${new URLSearchParams(keptEntries).toString()}`
      : '';

    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    return `${url.origin.toLowerCase()}${pathname}${url.search}`;
  } catch {
    return raw.toLowerCase().replace(/\/+$/, '');
  }
};

export const getJobDedupKeys = (job: Partial<Job>): string[] => {
  const keys = new Set<string>();
  const id = normalizeDedupText(job.id);
  const title = normalizeDedupText(job.title);
  const titleCore = normalizeTitleCoreForDedup(job.title ?? null);
  const company = normalizeDedupText(job.company);
  const companyCore = normalizeCompanyCoreForDedup(job.company ?? null);
  const location = normalizeDedupText(job.location);
  const url = normalizeDedupUrl(job.url);

  if (id) keys.add(`id:${id}`);
  if (url) keys.add(`url:${url}`);

  if (title && company) {
    if (location) {
      keys.add(`role-location:${title}|${company}|${location}`);
    }
    if (url) {
      keys.add(`role-url:${title}|${company}|${url}`);
    }
  }

  // Extra, more tolerant keys to catch near-identical listings coming from different scrapers/sources.
  // Keep these as additive keys so we don't accidentally *weaken* existing dedupe behavior.
  if (titleCore && companyCore) {
    if (location) {
      keys.add(`role-core-location:${titleCore}|${companyCore}|${location}`);
    }
    if (url) {
      keys.add(`role-core-url:${titleCore}|${companyCore}|${url}`);
    }
  }

  return Array.from(keys);
};

export const dedupeJobsList = <T extends Partial<Job>>(jobs: T[]): T[] => {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const job of jobs) {
    const keys = getJobDedupKeys(job);
    if (keys.length === 0) {
      deduped.push(job);
      continue;
    }
    if (keys.some((key) => seen.has(key))) {
      continue;
    }
    keys.forEach((key) => seen.add(key));
    deduped.push(job);
  }

  return deduped;
};
