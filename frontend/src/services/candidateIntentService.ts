import candidateIntentTaxonomyRaw from '../shared/candidate_intent_taxonomy.json';
import {
  CandidateDomainKey,
  CandidateIntentProfile,
  CandidateMatchBucket,
  CandidateSearchProfile,
  CandidateSeniority,
  Job,
  UserProfile,
} from '../types';

type DomainLabels = Record<'cs' | 'sk' | 'en' | 'de' | 'pl', string>;

interface DomainDefinition {
  labels: DomainLabels;
  keywords: string[];
  related: CandidateDomainKey[];
}

interface CandidateIntentTaxonomy {
  version: string;
  domains: Record<CandidateDomainKey, DomainDefinition>;
}

const candidateIntentTaxonomy = ((candidateIntentTaxonomyRaw as any)?.default || candidateIntentTaxonomyRaw) as CandidateIntentTaxonomy;
const TAXONOMY_DOMAINS = candidateIntentTaxonomy.domains;
const DOMAIN_KEYS = Object.keys(TAXONOMY_DOMAINS) as CandidateDomainKey[];

const normalizeLocale = (locale?: string): keyof DomainLabels => {
  const base = String(locale || 'en').split('-')[0].toLowerCase();
  if (base === 'at') return 'de';
  if (base === 'cs' || base === 'sk' || base === 'de' || base === 'pl') return base;
  return 'en';
};

const normalizeText = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/+.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseTimestampMs = (value: unknown): number => {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getFreshnessPriorityBoost = (job: Job): number => {
  const timestampMs = parseTimestampMs((job as any).scrapedAt || (job as any).postedAt);
  if (!timestampMs) return 0;
  const ageHours = Math.max(0, (Date.now() - timestampMs) / 3_600_000);
  if (ageHours <= 24) return 18;
  if (ageHours <= 72) return 10;
  if (ageHours <= 168) return 4;
  return 0;
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const STATIC_CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  praha: { lat: 50.0755, lon: 14.4378 },
  prague: { lat: 50.0755, lon: 14.4378 },
  brno: { lat: 49.1951, lon: 16.6068 },
  ostrava: { lat: 49.8209, lon: 18.2625 },
  olomouc: { lat: 49.5938, lon: 17.2509 },
  breclav: { lat: 48.7590, lon: 16.8820 },
  znojmo: { lat: 48.8560, lon: 16.0488 },
  jihlava: { lat: 49.3961, lon: 15.5912 },
  bratislava: { lat: 48.1486, lon: 17.1077 },
  wien: { lat: 48.2082, lon: 16.3738 },
  vienna: { lat: 48.2082, lon: 16.3738 },
};

const pushIfPresent = (items: string[], value: unknown) => {
  const text = String(value || '').trim();
  if (text) items.push(text);
};

const uniqueStrings = (items: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const value = String(item || '').trim();
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
};

// External sources (especially Jooble) behave poorly when we send multiple roles at once
// (often treated like an AND query). This reduces a composite role string to one
// reasonably specific segment.
export const getCandidateIntentRoleSeedKeyword = (role: unknown): string => {
  const raw = String(role || '').trim();
  if (!raw) return '';

  const cleaned = raw
    .replace(/\(([^)]{0,48})\)/g, ' ') // drop short parentheticals
    .replace(/\s+/g, ' ')
    .trim();

  // Split on common composite separators: "A | B", "A, B", "A / B", "A • B"
  const parts = cleaned
    .split(/[|,/•·\n\r]+/g)
    .map((part) => part.trim())
    .filter(Boolean);

  const candidates = (parts.length ? parts : [cleaned])
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  // Prefer a short multi-word phrase (e.g. "Product Manager") over a very long one.
  const reasonable = candidates.find((part) => part.length >= 4 && part.length <= 38);
  if (reasonable) return reasonable;

  const first = candidates[0] || '';
  return first.length > 45 ? first.slice(0, 45).trim() : first;
};

const collectCandidateTextChunks = (profile: UserProfile): string[] => {
  const chunks: string[] = [];
  pushIfPresent(chunks, profile.preferences?.candidate_onboarding_v2?.interest_reveal);
  pushIfPresent(chunks, profile.preferences?.desired_role);
  pushIfPresent(chunks, profile.jobTitle);
  pushIfPresent(chunks, profile.cvText);
  pushIfPresent(chunks, profile.cvAiText);
  pushIfPresent(chunks, profile.story);
  (profile.skills || []).forEach((item) => pushIfPresent(chunks, item));
  (profile.inferredSkills || []).forEach((item) => pushIfPresent(chunks, item));
  (profile.strengths || []).forEach((item) => pushIfPresent(chunks, item));
  (profile.motivations || []).forEach((item) => pushIfPresent(chunks, item));
  (profile.sideProjects || []).forEach((item) => pushIfPresent(chunks, item));
  (profile.hobbies || []).forEach((item) => pushIfPresent(chunks, item));
  (profile.values || []).forEach((item) => pushIfPresent(chunks, item));
  (profile.workPreferences || []).forEach((item) => pushIfPresent(chunks, item));
  (profile.workHistory || []).forEach((item) => {
    pushIfPresent(chunks, item.role);
    pushIfPresent(chunks, item.company);
    pushIfPresent(chunks, item.description);
  });
  (profile.education || []).forEach((item) => {
    pushIfPresent(chunks, item.degree);
    pushIfPresent(chunks, item.field);
    pushIfPresent(chunks, item.school);
  });
  return chunks;
};

const scoreDomains = (chunks: string[]): Array<{ domain: CandidateDomainKey; score: number }> => {
  const normalizedChunks = chunks.map(normalizeText).filter(Boolean);
  if (normalizedChunks.length === 0) return [];

  const joined = normalizedChunks.join(' \n ');
  const hasWholeWord = (text: string, token: string): boolean => {
    if (!token) return false;
    if (token.length < 3) return false;
    const escaped = escapeRegExp(token);
    return new RegExp(`\\b${escaped}\\b`).test(text);
  };
  const hasPhrase = (text: string, phrase: string): boolean => {
    if (!phrase) return false;
    const escaped = escapeRegExp(phrase);
    return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(text);
  };

  const scores = DOMAIN_KEYS.map((domain) => {
    const definition = TAXONOMY_DOMAINS[domain];
    const score = definition.keywords.reduce((acc, keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      if (!normalizedKeyword) return acc;
      const keywordParts = normalizedKeyword.split(' ').filter(Boolean);
      if (keywordParts.length > 1) {
        if (hasPhrase(joined, normalizedKeyword)) return acc + 3.5;
        const meaningfulParts = keywordParts.filter((part) => part.length >= 3);
        if (meaningfulParts.length >= 2 && meaningfulParts.every((part) => hasWholeWord(joined, part))) {
          return acc + 2;
        }
        return acc;
      }
      if (hasWholeWord(joined, normalizedKeyword)) return acc + 3;
      return acc;
    }, 0);
    return { domain, score };
  });

  return scores.filter((item) => item.score > 0).sort((a, b) => b.score - a.score);
};

const inferSeniorityFromText = (...sources: Array<string | null | undefined>): CandidateSeniority | null => {
  const text = normalizeText(sources.filter(Boolean).join(' '));
  if (!text) return null;
  if (/\b(lead|principal|head of|director|manager|vedouci|veduci|team lead)\b/.test(text)) return 'lead';
  if (/\b(senior|expert|staff|architekt|architect)\b/.test(text)) return 'senior';
  if (/\b(medior|mid|intermediate)\b/.test(text)) return 'medior';
  if (/\b(junior|graduate|absolvent)\b/.test(text)) return 'junior';
  if (/\b(intern|internship|trainee|entry)\b/.test(text)) return 'entry';
  return null;
};

const normalizeTargetRole = (value: unknown): string => String(value || '').trim();

const getFallbackRoleFromHistory = (profile: UserProfile): string => {
  const firstHistoryRole = profile.workHistory?.find((item) => String(item?.role || '').trim())?.role;
  return normalizeTargetRole(firstHistoryRole);
};

const uniqueDomains = (domains: Array<CandidateDomainKey | null | undefined>): CandidateDomainKey[] => {
  const seen = new Set<CandidateDomainKey>();
  return domains.filter((domain): domain is CandidateDomainKey => Boolean(domain)).filter((domain) => {
    if (seen.has(domain)) return false;
    seen.add(domain);
    return true;
  });
};

export const getCandidateIntentDomainOptions = (locale?: string): Array<{ key: CandidateDomainKey; label: string }> => {
  const normalizedLocale = normalizeLocale(locale);
  return DOMAIN_KEYS.map((domain) => ({
    key: domain,
    label: TAXONOMY_DOMAINS[domain].labels[normalizedLocale],
  }));
};

export const getCandidateIntentDomainLabel = (domain: CandidateDomainKey | null | undefined, locale?: string): string => {
  if (!domain || !TAXONOMY_DOMAINS[domain]) return '';
  return TAXONOMY_DOMAINS[domain].labels[normalizeLocale(locale)];
};

export const getCandidateIntentDomainSeedKeyword = (domain: CandidateDomainKey | null | undefined): string => {
  if (!domain || !TAXONOMY_DOMAINS[domain]) return '';
  const definition = TAXONOMY_DOMAINS[domain];
  const candidates: string[] = [];
  // Prefer taxonomy keywords because they're mostly English and match external sources better.
  (definition.keywords || []).forEach((kw) => {
    const raw = String(kw || '').trim();
    if (raw) candidates.push(raw);
  });
  candidates.push(String(definition.labels.en || '').trim());

  const stop = new Set(['and', 'or', 'the', 'a', 'an', 'for', 'with', 'to', 'of', 'in']);
  const normalized = candidates
    .map((value) => ({ raw: value, norm: normalizeText(value) }))
    .filter((item) => item.norm);

  // Prefer a single, specific token to avoid turning the external search into an AND query.
  const singleToken = normalized.find((item) => {
    const parts = item.norm.split(' ').filter(Boolean);
    if (parts.length !== 1) return false;
    const tok = parts[0];
    if (tok.length < 4) return false;
    if (stop.has(tok)) return false;
    return true;
  });
  if (singleToken) return singleToken.raw;

  // Fallback to the first reasonably short phrase.
  const shortPhrase = normalized.find((item) => item.norm.length <= 18);
  return shortPhrase?.raw || String(definition.labels.en || '').trim();
};

export const resolveCandidateIntentProfile = (profile: UserProfile): CandidateIntentProfile => {
  const searchProfile = profile.preferences?.searchProfile || ({} as CandidateSearchProfile);
  const onboardingInterest = normalizeTargetRole(profile.preferences?.candidate_onboarding_v2?.interest_reveal);
  const onboardingChunks = uniqueStrings([
    onboardingInterest,
    ...(profile.motivations || []),
    ...(profile.sideProjects || []),
    ...(profile.hobbies || []),
  ]);
  const candidateChunks = collectCandidateTextChunks(profile);
  const onboardingDomainScores = onboardingChunks.length > 0 ? scoreDomains(onboardingChunks) : [];
  const inferredDomainScores = scoreDomains(candidateChunks);
  const inferredPrimaryDomain = searchProfile.inferredPrimaryDomain || onboardingDomainScores[0]?.domain || inferredDomainScores[0]?.domain || null;
  const inferredSecondaryDomains = uniqueDomains(
    (onboardingDomainScores.length > 0 ? onboardingDomainScores : inferredDomainScores)
      .slice(1, 3)
      .map((item) => item.domain)
  );
  const allowHistoryRoleFallback = !onboardingInterest || Boolean(normalizeTargetRole(searchProfile.targetRole) || normalizeTargetRole(profile.preferences?.desired_role));

  const explicitRole =
    normalizeTargetRole(searchProfile.targetRole) ||
    normalizeTargetRole(profile.preferences?.desired_role) ||
    (allowHistoryRoleFallback ? normalizeTargetRole(profile.jobTitle) || getFallbackRoleFromHistory(profile) : '');

  const inferredRole =
    normalizeTargetRole(searchProfile.inferredTargetRole) ||
    normalizeTargetRole(profile.preferences?.desired_role) ||
    (allowHistoryRoleFallback ? normalizeTargetRole(profile.jobTitle) || getFallbackRoleFromHistory(profile) : '');

  const inferredSeniority =
    inferSeniorityFromText(explicitRole, profile.cvAiText, profile.cvText, profile.story, onboardingInterest) ||
    null;

  const manualPrimaryDomain = searchProfile.primaryDomain || null;
  const manualSecondaryDomains = uniqueDomains(searchProfile.secondaryDomains || []);
  const manualAvoidDomains = uniqueDomains(searchProfile.avoidDomains || []);
  const manualSeniority = searchProfile.seniority || null;
  const includeAdjacentDomains = searchProfile.includeAdjacentDomains ?? true;

  const activePrimaryDomain = manualPrimaryDomain || inferredPrimaryDomain;
  const activeSecondaryDomains =
    manualSecondaryDomains.length > 0
      ? manualSecondaryDomains.filter((domain) => domain !== activePrimaryDomain).slice(0, 2)
      : inferredSecondaryDomains.filter((domain) => domain !== activePrimaryDomain).slice(0, 2);

  const inferenceConfidence = searchProfile.inferenceConfidence ?? Math.min(100, Math.round((inferredDomainScores[0]?.score || 0) * 10));
  const inferenceSource =
    searchProfile.inferenceSource ||
    (onboardingInterest
      ? 'onboarding'
      : undefined) ||
    (profile.cvAiText || profile.cvText
      ? 'cv'
      : profile.workHistory?.length
        ? 'history'
        : profile.skills?.length || profile.inferredSkills?.length
          ? 'skills'
          : profile.jobTitle
            ? 'profile'
            : 'none');

  return {
    primaryDomain: activePrimaryDomain,
    secondaryDomains: activeSecondaryDomains,
    avoidDomains: manualAvoidDomains.filter((domain) => domain !== activePrimaryDomain && !activeSecondaryDomains.includes(domain)).slice(0, 3),
    targetRole: normalizeTargetRole(searchProfile.targetRole) || inferredRole,
    seniority: manualSeniority || inferredSeniority,
    includeAdjacentDomains,
    inferredPrimaryDomain,
    inferredTargetRole: inferredRole,
    inferenceSource,
    inferenceConfidence,
    usedManualDomain: Boolean(manualPrimaryDomain),
    usedManualRole: Boolean(normalizeTargetRole(searchProfile.targetRole)),
    usedManualSeniority: Boolean(manualSeniority),
  };
};

export const enrichSearchProfileWithInference = (profile: UserProfile): CandidateSearchProfile => {
  const existing = profile.preferences?.searchProfile || ({} as CandidateSearchProfile);
  const resolved = resolveCandidateIntentProfile(profile);
  return {
    ...existing,
    includeAdjacentDomains: existing.includeAdjacentDomains ?? true,
    secondaryDomains: uniqueDomains(existing.secondaryDomains || []),
    avoidDomains: uniqueDomains(existing.avoidDomains || []).slice(0, 3),
    inferredPrimaryDomain: resolved.inferredPrimaryDomain,
    inferredTargetRole: resolved.inferredTargetRole,
    inferenceSource: resolved.inferenceSource,
    inferenceConfidence: resolved.inferenceConfidence,
  };
};

const getRelatedDomains = (domain: CandidateDomainKey | null): CandidateDomainKey[] => {
  if (!domain || !TAXONOMY_DOMAINS[domain]) return [];
  return TAXONOMY_DOMAINS[domain].related || [];
};

const resolveDomainOverrideFromTitle = (title: string): CandidateDomainKey | null => {
  const text = normalizeText(title);
  if (!text) return null;
  if (/\b(kuryr|kurier|ridic sk b|ridic|rozvoz|rozvozce|delivery driver|delivery courier|courier)\b/.test(text)) return 'logistics';
  if (/\b(zdravotni sestra|prakticka sestra|zdravotni bratr|sestra|sanitar|zachranar|paramedik)\b/.test(text)) return 'healthcare';
  if (/\b(auto mechanik|automechanik|mechanik vozidel|mechanik|technik udrzby|udrzbar|udrzba|servisni technik)\b/.test(text)) return 'engineering';
  if (/\b(ucetni|mzdova ucetni|accountant|bookkeeper|controller|controlling|payroll)\b/.test(text)) return 'finance';
  if (/\b(product manager|product owner|produktovy manager|produkt manager|produkt owner)\b/.test(text)) return 'product_management';
  if (/\b(project manager|projektovy manazer|projektovy manager|manazer projektu|stavbyvedouci)\b/.test(text)) return 'operations';
  if (/\b(barista|cisnik|kuchar|recepcni|receptionist|housekeeping|concierge)\b/.test(text)) return 'hospitality';
  // Manufacturing overrides (strong domain signal)
  if (/\b(cnc|serizovac|operator vyrob|linek operator|machine operator|lisovac|soustruh)\b/.test(text)) return 'manufacturing';
  return null;
};

const scoreDomainsForJob = (job: Job): Array<{ domain: CandidateDomainKey; score: number }> => {
  const title = normalizeText(job.title || '');
  const context = normalizeText([job.challenge, job.risk, ...(job.tags || [])].filter(Boolean).join(' '));
  const description = normalizeText(job.description || '');
  const company = normalizeText(job.company || '');
  const benefits = normalizeText((job.benefits || []).join(' '));

  const sources: Array<{ text: string; weight: number }> = [
    { text: title, weight: 8 },
    { text: context, weight: 4 },
    { text: description, weight: 2 },
    { text: company, weight: 1 },
    { text: benefits, weight: 1 },
  ].filter((item) => item.text);

  if (!sources.length) return [];

  const matchStrength = (text: string, keyword: string): number => {
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) return 0;
    const parts = normalizedKeyword.split(' ').filter(Boolean);
    if (parts.length > 1) {
      if (new RegExp(`(^|\\s)${escapeRegExp(normalizedKeyword)}(\\s|$)`).test(text)) return 1;
      const meaningful = parts.filter((part) => part.length >= 3);
      if (meaningful.length >= 2 && meaningful.every((part) => new RegExp(`\\b${escapeRegExp(part)}\\b`).test(text))) return 0.6;
      return 0;
    }
    if (normalizedKeyword.length < 3) return 0;
    return new RegExp(`\\b${escapeRegExp(normalizedKeyword)}\\b`).test(text) ? 1 : 0;
  };

  const scores = DOMAIN_KEYS.map((domain) => {
    const definition = TAXONOMY_DOMAINS[domain];
    const score = (definition.keywords || []).reduce((acc, keyword) => {
      const keywordScore = sources.reduce((sum, source) => sum + source.weight * matchStrength(source.text, keyword), 0);
      return acc + keywordScore;
    }, 0);
    return { domain, score };
  }).filter((item) => item.score > 0);

  return scores.sort((a, b) => b.score - a.score);
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const resolveJobDomains = (job: Job): {
  domains: CandidateDomainKey[];
  primaryDomain: CandidateDomainKey | null;
  topScore: number;
  secondScore: number;
  scoreGap: number;
  confidence: number;
  source: 'title_override' | 'taxonomy';
} => {
  const override = resolveDomainOverrideFromTitle(job.title || '');
  if (override) {
    const domains = uniqueDomains([override, ...getRelatedDomains(override)].slice(0, 3));
    return {
      domains,
      primaryDomain: domains[0] || override,
      topScore: 1,
      secondScore: 0,
      scoreGap: 1,
      confidence: 1,
      source: 'title_override',
    };
  }
  const scores = scoreDomainsForJob(job);
  const topScore = Number(scores[0]?.score || 0);
  const secondScore = Number(scores[1]?.score || 0);
  const scoreGap = Math.max(0, topScore - secondScore);
  // Confidence is driven primarily by how far ahead the winner is compared to runner-up.
  // If runner-up is close, we prefer a neutral UI over a wrong domain accent.
  const confidence = topScore <= 0 ? 0 : clamp01(scoreGap / Math.max(8, secondScore + 2));
  const domains = uniqueDomains(scores.slice(0, 3).map((item) => item.domain));
  return {
    domains,
    primaryDomain: domains[0] || null,
    topScore,
    secondScore,
    scoreGap,
    confidence,
    source: 'taxonomy',
  };
};

const roleSignalScore = (jobTitle: string, targetRole: string): number => {
  const normalizedJobTitle = normalizeText(jobTitle);
  const normalizedTargetRole = normalizeText(targetRole);
  if (!normalizedJobTitle || !normalizedTargetRole) return 0;
  if (normalizedJobTitle.includes(normalizedTargetRole)) return 1;

  const roleTerms = normalizedTargetRole.split(' ').filter((part) => part.length > 2);
  if (roleTerms.length === 0) return 0;
  const matches = roleTerms.filter((part) => normalizedJobTitle.includes(part)).length;
  return matches / roleTerms.length;
};

const seniorityDistance = (left: CandidateSeniority | null, right: CandidateSeniority | null): number => {
  const order: CandidateSeniority[] = ['entry', 'junior', 'medior', 'senior', 'lead'];
  if (!left || !right) return 0;
  return Math.abs(order.indexOf(left) - order.indexOf(right));
};

const getStaticCoords = (value: string): { lat: number; lon: number } | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const entries = Object.entries(STATIC_CITY_COORDS).sort((left, right) => right[0].length - left[0].length);
  for (const [key, coords] of entries) {
    if (normalized.includes(key)) return coords;
  }
  return null;
};

const calculateAirDistanceKm = (
  left: { lat: number; lon: number },
  right: { lat: number; lon: number },
): number => {
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const earthRadiusKm = 6371;
  const dLat = toRad(right.lat - left.lat);
  const dLon = toRad(right.lon - left.lon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(left.lat)) * Math.cos(toRad(right.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const inferTargetRoleDomain = (targetRole: string): CandidateDomainKey | null => {
  const override = resolveDomainOverrideFromTitle(targetRole);
  if (override) return override;
  const inferred = scoreDomains([targetRole])[0]?.domain || null;
  return inferred;
};

const isFrontlineHospitalityRole = (job: Job): boolean => {
  const text = normalizeText([job.title, job.description, job.challenge].filter(Boolean).join(' '));
  if (!text) return false;
  return /\b(cisnik|čašnik|casnik|waiter|server|barista|receptionist|recepcni|housekeeping|concierge|kuchar|cook)\b/.test(text);
};

const isManualIndustrialRole = (job: Job): boolean => {
  const text = normalizeText([job.title, job.description, job.challenge, ...(job.tags || [])].filter(Boolean).join(' '));
  if (!text) return false;
  return /\b(montazni|montaz|delnik|de lnik|operator vyrob|operator výroby|vyroba|výroba|assembly|assembler|production operator|factory worker|manual worker|obalovac|skladnik|picker|packer|expedient)\b/.test(text);
};

const collectCandidateQualificationText = (profile: UserProfile): string => normalizeText([
  profile.preferences?.desired_role,
  profile.jobTitle,
  profile.cvText,
  profile.cvAiText,
  profile.story,
  ...(profile.skills || []),
  ...(profile.inferredSkills || []),
  ...(profile.workHistory || []).flatMap((item) => [item.role, item.description, item.company]),
  ...(profile.education || []).flatMap((item) => [item.degree, item.field, item.school]),
].filter(Boolean).join(' '));

const missingDriverQualification = (profileText: string, jobText: string): boolean => {
  const normalized = normalizeText(jobText);
  if (!/\b(ridic|řidič|driver|truck driver|delivery driver|kuryr|kurýr)\b/.test(normalized)) return false;

  const hasHeavyLicenseRequirement =
    /\b(c\+e|ce|c1|skupin[ay] c|skupin[ay] d|ridicsk[yae]* opravneni c|ridicsk[yae]* opravneni d|license c|license d|group c|group d|cdl)\b/.test(normalized);
  if (!hasHeavyLicenseRequirement) return false;

  const hasCandidateLicense =
    /\b(c\+e|ce|c1|skupin[ay] c|skupin[ay] d|cdl|ridicsk[yae]* opravneni c|ridicsk[yae]* opravneni d|license c|license d|group c|group d)\b/.test(profileText);
  return !hasCandidateLicense;
};

const missingRoleSpecificQualification = (profile: UserProfile, job: Job, targetRole: string): boolean => {
  const profileText = collectCandidateQualificationText(profile);
  const jobText = normalizeText([job.title, job.description, job.challenge, ...(job.tags || []), ...(job.required_skills || [])].filter(Boolean).join(' '));
  if (!jobText) return false;

  if (missingDriverQualification(profileText, jobText)) return true;

  const knowledgeTarget = isKnowledgeRoleTarget(targetRole);
  const candidateHasCulinaryBackground = /\b(kuchar|kuchař|chef|cook|gastronom|restaurant|kitchen|kuchyne|kuchyň)\b/.test(profileText);
  const jobIsCulinary = /\b(kuchar|kuchař|chef|cook|sous chef|pizza[rř]|kitchen)\b/.test(jobText);
  if (knowledgeTarget && jobIsCulinary && !candidateHasCulinaryBackground) return true;

  const candidateHasFrontlineHospitalityBackground = /\b(cisnik|čašnik|casnik|waiter|server|barista|receptionist|recepcni|housekeeping|concierge|hostes|hostess)\b/.test(profileText);
  const jobIsFrontlineHospitality = /\b(cisnik|čašnik|casnik|waiter|server|barista|receptionist|recepcni|housekeeping|concierge|hostes|hostess)\b/.test(jobText);
  if (knowledgeTarget && jobIsFrontlineHospitality && !candidateHasFrontlineHospitalityBackground) return true;

  const candidateHasHealthcareQualification = /\b(sestra|nurse|paramedic|zdravotn|sanitar|sanit[aá]r|physio|lekar|lékař)\b/.test(profileText);
  const jobNeedsHealthcareQualification = /\b(zdravotni sestra|nurse|paramedic|sanitar|prakticka sestra|registered nurse)\b/.test(jobText);
  if (knowledgeTarget && jobNeedsHealthcareQualification && !candidateHasHealthcareQualification) return true;

  return false;
};

const isKnowledgeRoleTarget = (targetRole: string): boolean => {
  const text = normalizeText(targetRole);
  if (!text) return false;
  return /\b(product|manager|architect|architekt|operations|strategy|system|ai|owner|consultant|lead|director|engineer|designer|analyst)\b/.test(text);
};

const getFallbackDistancePenalty = (profile: UserProfile, job: Job, isRemote: boolean): number => {
  if (isRemote) return 0;
  if (Number.isFinite(Number(job.distanceKm))) return 0;

  const userCoords = profile.coordinates || getStaticCoords(profile.address || '');
  const jobCoords = getStaticCoords(job.location || '');
  if (!userCoords || !jobCoords) return 0;

  const fallbackDistanceKm = calculateAirDistanceKm(userCoords, jobCoords);
  if (fallbackDistanceKm > 150) return -42;
  if (fallbackDistanceKm > 80) return -24;
  if (fallbackDistanceKm > 40) return -12;
  return 0;
};

const inferJobWorkArrangement = (job: Job): Exclude<Job['type'], undefined> => {
  const normalizedType = normalizeText(String(job.type || ''));
  const normalizedModel = normalizeText(String(job.work_model || ''));
  const normalizedDescription = normalizeText([job.title, job.location, job.description].filter(Boolean).join(' '));
  const haystack = `${normalizedType} ${normalizedModel} ${normalizedDescription}`.trim();
  if (/\b(remote|home office|work from home|wfh|z domova|na dalku|zdalna)\b/.test(haystack)) return 'Remote';
  if (/\b(hybrid)\b/.test(haystack)) return 'Hybrid';
  return 'On-site';
};

const resolvePreferredWorkArrangement = (profile: UserProfile): 'remote' | 'hybrid' | 'onsite' | null => {
  const searchProfile = profile.preferences?.searchProfile;
  const explicit = searchProfile?.preferredWorkArrangement;
  if (explicit) return explicit;
  if (searchProfile?.wantsRemoteRoles) return 'remote';
  const homeOfficePreference = Number(profile.jhiPreferences?.workStyle?.homeOfficePreference || 0);
  if (homeOfficePreference >= 72) return 'remote';
  if (homeOfficePreference >= 52) return 'hybrid';
  if (homeOfficePreference > 0 && homeOfficePreference <= 30) return 'onsite';
  return null;
};

const scoreRoleComponent = (job: Job, targetRole: string): number => {
  const roleScore = roleSignalScore(job.title, targetRole);
  if (roleScore >= 1) return 35;
  if (roleScore >= 0.75) return 28;
  if (roleScore >= 0.5) return 20;
  if (roleScore >= 0.34) return 12;
  return 0;
};

const scoreDomainComponent = (
  primaryJobDomain: CandidateDomainKey | null,
  intent: CandidateIntentProfile,
  targetRoleDomain: CandidateDomainKey | null,
): number => {
  if (!primaryJobDomain) return 0;
  if (intent.avoidDomains.includes(primaryJobDomain)) return -26;
  if (targetRoleDomain && primaryJobDomain === targetRoleDomain) return 25;
  if (intent.primaryDomain && primaryJobDomain === intent.primaryDomain) return 22;
  if (intent.secondaryDomains.includes(primaryJobDomain)) return 14;
  if (intent.includeAdjacentDomains) {
    if (targetRoleDomain && getRelatedDomains(targetRoleDomain).includes(primaryJobDomain)) return 10;
    if (intent.primaryDomain && getRelatedDomains(intent.primaryDomain).includes(primaryJobDomain)) return 8;
  }
  return -8;
};

const scoreSeniorityComponent = (
  inferredSeniority: CandidateSeniority | null,
  requestedSeniority: CandidateSeniority | null,
): number => {
  if (!requestedSeniority || !inferredSeniority) return 0;
  const distance = seniorityDistance(requestedSeniority, inferredSeniority);
  if (distance === 0) return 8;
  if (distance === 1) return 3;
  return -8;
};

const scoreDistanceComponent = (profile: UserProfile, job: Job, isRemote: boolean): number => {
  if (isRemote) return 8;

  const explicitDistance = Number(job.distanceKm);
  if (Number.isFinite(explicitDistance)) {
    if (explicitDistance <= 10) return 10;
    if (explicitDistance <= 25) return 8;
    if (explicitDistance <= 45) return 5;
    if (explicitDistance <= 80) return 1;
    if (explicitDistance <= 120) return -8;
    return -16;
  }

  const fallbackPenalty = getFallbackDistancePenalty(profile, job, isRemote);
  return fallbackPenalty === 0 ? 0 : Math.max(-16, fallbackPenalty);
};

const scoreWorkModeComponent = (profile: UserProfile, arrangement: 'Remote' | 'Hybrid' | 'On-site'): number => {
  const preferred = resolvePreferredWorkArrangement(profile);
  if (!preferred) return 0;
  if (preferred === 'remote') {
    if (arrangement === 'Remote') return 12;
    if (arrangement === 'Hybrid') return 6;
    return -10;
  }
  if (preferred === 'hybrid') {
    if (arrangement === 'Hybrid') return 10;
    if (arrangement === 'Remote') return 4;
    return 4;
  }
  if (arrangement === 'On-site') return 10;
  if (arrangement === 'Hybrid') return 4;
  return -12;
};

const scoreSalaryGrowthFreshnessComponent = (profile: UserProfile, job: Job): number => {
  let score = 0;

  const growth = Number(job.jhi?.growth || 0);
  if (profile.jhiPreferences?.hardConstraints?.growthRequired) {
    score += growth >= 55 ? 6 : -10;
  } else if (growth > 0) {
    score += Math.min(4, Math.round(growth / 25));
  }

  const salaryHigh = Math.max(Number(job.salary_from || 0), Number(job.salary_to || 0));
  const minNet = Number(profile.jhiPreferences?.hardConstraints?.minNetMonthly || 0);
  if (salaryHigh > 0 && minNet > 0) {
    score += salaryHigh >= minNet ? 4 : -6;
  } else if (salaryHigh > 0) {
    score += Math.min(3, Math.round(salaryHigh / 40000));
  }

  score += Math.round((getFreshnessPriorityBoost(job) / 18) * 8);
  return score;
};

const getBackendRelevanceComponent = (job: Job): number => {
  const backendScore = Number(job.searchDiagnostics?.backendScore ?? (job as any).hybrid_score ?? job.searchScore ?? 0);
  if (!Number.isFinite(backendScore) || backendScore <= 0) return 0;
  if (backendScore <= 1) return Math.round(backendScore * 8);
  return Math.min(8, Math.round(backendScore / 12));
};

export const annotateJobsForCandidate = (
  jobs: Job[],
  profile: UserProfile,
  locale?: string
): Job[] => {
  return sortJobsForDiscovery(computeCandidateAnnotations(jobs, profile, locale));
};

export const computeCandidateAnnotations = (
  jobs: Job[],
  profile: UserProfile,
  locale?: string
): Job[] => {
  const intent = resolveCandidateIntentProfile(profile);
  const targetRoleDomain = inferTargetRoleDomain(intent.targetRole);
  const explicitRoleMode = Boolean(intent.usedManualRole && intent.targetRole);

  return jobs
    .map((job) => {
      const jobDomainInference = resolveJobDomains(job);
      const jobDomains = jobDomainInference.domains;
      const primaryJobDomain = jobDomainInference.primaryDomain;
      const inferredSeniority = inferSeniorityFromText(job.title, job.description, job.challenge, job.risk);
      const arrangement = inferJobWorkArrangement(job);
      const isRemote = arrangement === 'Remote';
      const roleScore = roleSignalScore(job.title, intent.targetRole);
      const roleComponent = scoreRoleComponent(job, intent.targetRole);
      const domainComponent = scoreDomainComponent(primaryJobDomain, intent, targetRoleDomain);
      const seniorityComponent = scoreSeniorityComponent(inferredSeniority, intent.seniority);
      const workModeComponent = scoreWorkModeComponent(profile, arrangement);
      const distanceComponent = scoreDistanceComponent(profile, job, isRemote);
      const salaryGrowthFreshnessComponent = scoreSalaryGrowthFreshnessComponent(profile, job);
      const backendRelevanceComponent = getBackendRelevanceComponent(job);
      const qualificationMismatch = missingRoleSpecificQualification(profile, job, intent.targetRole);
      const explicitDomainMismatch = Boolean(
        explicitRoleMode &&
        targetRoleDomain &&
        primaryJobDomain &&
        primaryJobDomain !== targetRoleDomain &&
        !getRelatedDomains(targetRoleDomain).includes(primaryJobDomain)
      );
      const shouldHideDomainReasons =
        qualificationMismatch
        || explicitDomainMismatch
        || (explicitRoleMode && roleScore < 0.34);
      const reasons: string[] = [];
      let priorityScore =
        roleComponent +
        domainComponent +
        seniorityComponent +
        workModeComponent +
        distanceComponent +
        salaryGrowthFreshnessComponent +
        backendRelevanceComponent;

      if (roleComponent >= 20 && intent.targetRole) {
        reasons.push(intent.targetRole);
      }
      if (!shouldHideDomainReasons && primaryJobDomain && domainComponent >= 8) {
        reasons.push(getCandidateIntentDomainLabel(primaryJobDomain, locale));
      }
      if (workModeComponent >= 8) {
        reasons.push(
          arrangement === 'Remote'
            ? 'Remote'
            : arrangement === 'Hybrid'
              ? 'Hybrid'
              : locale === 'cs'
                ? 'On-site'
                : 'On-site'
        );
      }
      if (distanceComponent >= 8) {
        reasons.push(locale === 'cs' ? 'blízko' : 'nearby');
      }
      if (salaryGrowthFreshnessComponent >= 7) {
        reasons.push(locale === 'cs' ? 'čerstvé' : 'fresh');
      }

      if (qualificationMismatch) {
        priorityScore -= 28;
      }
      if (explicitRoleMode && roleScore < 0.34) {
        priorityScore -= 18;
      }
      if (explicitDomainMismatch) {
        priorityScore -= 18;
      }
      if (
        explicitRoleMode &&
        isKnowledgeRoleTarget(intent.targetRole) &&
        isFrontlineHospitalityRole(job) &&
        roleScore < 0.5
      ) {
        priorityScore -= 20;
      }
      if (
        explicitRoleMode &&
        isKnowledgeRoleTarget(intent.targetRole) &&
        isManualIndustrialRole(job)
      ) {
        priorityScore -= 20;
      }

      let matchBucket: CandidateMatchBucket = 'broader';
      if (priorityScore >= 58) {
        matchBucket = 'best_fit';
      } else if (priorityScore >= 32) {
        matchBucket = 'adjacent';
      }
      if (qualificationMismatch || (explicitRoleMode && roleScore < 0.2 && explicitDomainMismatch)) {
        matchBucket = 'broader';
      }

      return {
        ...job,
        priorityScore,
        matchBucket,
        matchReasons: uniqueStrings(
          reasons.concat(
            shouldHideDomainReasons
              ? []
              : uniqueDomains(jobDomains)
                  .filter((domain) => {
                    if (!intent.primaryDomain && !targetRoleDomain) return true;
                    if (domain === targetRoleDomain || domain === intent.primaryDomain) return true;
                    if (intent.secondaryDomains.includes(domain)) return true;
                    return Boolean(
                      (targetRoleDomain && getRelatedDomains(targetRoleDomain).includes(domain))
                      || (intent.primaryDomain && getRelatedDomains(intent.primaryDomain).includes(domain))
                    );
                  })
                  .slice(0, 2)
                  .map((domain) => getCandidateIntentDomainLabel(domain, locale))
          )
        ).slice(0, 3),
        matchedDomains: jobDomains,
        inferredDomain: primaryJobDomain,
        inferredDomainConfidence: jobDomainInference.confidence,
        inferredDomainScoreGap: jobDomainInference.scoreGap,
        inferredDomainSource: jobDomainInference.source,
        inferredSeniority,
        searchDiagnostics: {
          source: job.searchDiagnostics?.source || (job.listingKind === 'imported' ? 'cached_external' : 'native'),
          ...(job.searchDiagnostics?.titleMatchScore !== undefined ? { titleMatchScore: job.searchDiagnostics.titleMatchScore } : {}),
          ...(job.searchDiagnostics?.backendScore !== undefined ? { backendScore: job.searchDiagnostics.backendScore } : {}),
          profileBoost: priorityScore,
          external: Boolean(job.searchDiagnostics?.external ?? job.listingKind === 'imported'),
          ...(job.searchDiagnostics?.filteredOutBy ? { filteredOutBy: job.searchDiagnostics.filteredOutBy } : {})
        }
      };
    });
};

export const sortJobsForDiscovery = <T extends Job>(jobs: T[]): T[] => {
  return [...jobs].sort((left, right) => {
    const bucketRank = (bucket: CandidateMatchBucket | undefined) => (bucket === 'best_fit' ? 3 : bucket === 'adjacent' ? 2 : 1);
    const bucketDiff = bucketRank(right.matchBucket) - bucketRank(left.matchBucket);
    if (bucketDiff !== 0) return bucketDiff;
    const scoreDiff = Number(right.priorityScore || 0) - Number(left.priorityScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    const freshnessDiff = parseTimestampMs((right as any).scrapedAt || (right as any).postedAt) - parseTimestampMs((left as any).scrapedAt || (left as any).postedAt);
    if (freshnessDiff !== 0) return freshnessDiff;
    const jhiDiff = Number(right.jhi?.score || 0) - Number(left.jhi?.score || 0);
    if (jhiDiff !== 0) return jhiDiff;
    return 0;
  });
};

export const getCandidateIntentSignals = (profile: UserProfile, locale?: string): string[] => {
  const intent = resolveCandidateIntentProfile(profile);
  const signals: string[] = [];
  if (intent.primaryDomain) signals.push(getCandidateIntentDomainLabel(intent.primaryDomain, locale));
  if (intent.targetRole) signals.push(intent.targetRole);
  if (intent.seniority) signals.push(intent.seniority);
  if (intent.avoidDomains.length > 0) {
    signals.push(...intent.avoidDomains.map((domain) => `${locale === 'cs' ? 'Vyhnout se' : locale === 'sk' ? 'Vyhnúť sa' : locale === 'de' ? 'Meiden' : locale === 'pl' ? 'Unikaj' : 'Avoid'} ${getCandidateIntentDomainLabel(domain, locale)}`));
  }
  return signals.filter(Boolean);
};
