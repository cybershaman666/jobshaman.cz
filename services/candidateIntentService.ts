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

const candidateIntentTaxonomy = candidateIntentTaxonomyRaw as CandidateIntentTaxonomy;
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

const pushIfPresent = (items: string[], value: unknown) => {
  const text = String(value || '').trim();
  if (text) items.push(text);
};

const collectCandidateTextChunks = (profile: UserProfile): string[] => {
  const chunks: string[] = [];
  pushIfPresent(chunks, profile.preferences?.desired_role);
  pushIfPresent(chunks, profile.jobTitle);
  pushIfPresent(chunks, profile.cvText);
  pushIfPresent(chunks, profile.cvAiText);
  pushIfPresent(chunks, profile.story);
  (profile.skills || []).forEach((item) => pushIfPresent(chunks, item));
  (profile.inferredSkills || []).forEach((item) => pushIfPresent(chunks, item));
  (profile.strengths || []).forEach((item) => pushIfPresent(chunks, item));
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

const collectJobTextChunks = (job: Job): string[] => {
  const chunks: string[] = [];
  pushIfPresent(chunks, job.title);
  pushIfPresent(chunks, job.description);
  pushIfPresent(chunks, job.challenge);
  pushIfPresent(chunks, job.risk);
  pushIfPresent(chunks, job.company);
  pushIfPresent(chunks, job.location);
  (job.tags || []).forEach((item) => pushIfPresent(chunks, item));
  (job.benefits || []).forEach((item) => pushIfPresent(chunks, item));
  return chunks;
};

const scoreDomains = (chunks: string[]): Array<{ domain: CandidateDomainKey; score: number }> => {
  const normalizedChunks = chunks.map(normalizeText).filter(Boolean);
  if (normalizedChunks.length === 0) return [];

  const joined = normalizedChunks.join(' \n ');
  const scores = DOMAIN_KEYS.map((domain) => {
    const definition = TAXONOMY_DOMAINS[domain];
    const score = definition.keywords.reduce((acc, keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      if (!normalizedKeyword) return acc;
      if (joined.includes(normalizedKeyword)) return acc + 3;
      const keywordParts = normalizedKeyword.split(' ').filter(Boolean);
      if (keywordParts.length > 1 && keywordParts.every((part) => joined.includes(part))) {
        return acc + 1.5;
      }
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

export const resolveCandidateIntentProfile = (profile: UserProfile): CandidateIntentProfile => {
  const searchProfile = profile.preferences?.searchProfile || ({} as CandidateSearchProfile);
  const candidateChunks = collectCandidateTextChunks(profile);
  const inferredDomainScores = scoreDomains(candidateChunks);
  const inferredPrimaryDomain = searchProfile.inferredPrimaryDomain || inferredDomainScores[0]?.domain || null;
  const inferredSecondaryDomains = uniqueDomains(inferredDomainScores.slice(1, 3).map((item) => item.domain));

  const explicitRole =
    normalizeTargetRole(searchProfile.targetRole) ||
    normalizeTargetRole(profile.preferences?.desired_role) ||
    normalizeTargetRole(profile.jobTitle) ||
    getFallbackRoleFromHistory(profile);

  const inferredRole =
    normalizeTargetRole(searchProfile.inferredTargetRole) ||
    normalizeTargetRole(profile.jobTitle) ||
    normalizeTargetRole(profile.preferences?.desired_role) ||
    getFallbackRoleFromHistory(profile);

  const inferredSeniority =
    inferSeniorityFromText(explicitRole, profile.cvAiText, profile.cvText, profile.story) ||
    null;

  const manualPrimaryDomain = searchProfile.primaryDomain || null;
  const manualSecondaryDomains = uniqueDomains(searchProfile.secondaryDomains || []);
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

const resolveJobDomains = (job: Job): CandidateDomainKey[] => {
  const scores = scoreDomains(collectJobTextChunks(job));
  return uniqueDomains(scores.slice(0, 3).map((item) => item.domain));
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

export const annotateJobsForCandidate = (
  jobs: Job[],
  profile: UserProfile,
  locale?: string
): Job[] => {
  const intent = resolveCandidateIntentProfile(profile);
  const localizedDomain = intent.primaryDomain ? getCandidateIntentDomainLabel(intent.primaryDomain, locale) : '';

  return jobs
    .map((job, index) => {
      const jobDomains = resolveJobDomains(job);
      const primaryJobDomain = jobDomains[0] || null;
      const inferredSeniority = inferSeniorityFromText(job.title, job.description, job.challenge, job.risk);
      const reasons: string[] = [];
      let priorityScore = 0;
      let matchBucket: CandidateMatchBucket = 'broader';

      const roleScore = roleSignalScore(job.title, intent.targetRole);
      if (roleScore >= 1) {
        priorityScore += 42;
        reasons.push(intent.targetRole);
      } else if (roleScore >= 0.5) {
        priorityScore += 24;
        reasons.push(intent.targetRole);
      }

      if (intent.primaryDomain && primaryJobDomain === intent.primaryDomain) {
        priorityScore += 34;
        matchBucket = 'best_fit';
        if (localizedDomain) reasons.push(localizedDomain);
      } else if (intent.secondaryDomains.includes(primaryJobDomain as CandidateDomainKey)) {
        priorityScore += 20;
        matchBucket = 'adjacent';
        if (primaryJobDomain) reasons.push(getCandidateIntentDomainLabel(primaryJobDomain, locale));
      } else if (
        intent.includeAdjacentDomains &&
        intent.primaryDomain &&
        getRelatedDomains(intent.primaryDomain).includes(primaryJobDomain as CandidateDomainKey)
      ) {
        priorityScore += 16;
        matchBucket = 'adjacent';
        if (primaryJobDomain) reasons.push(getCandidateIntentDomainLabel(primaryJobDomain, locale));
      }

      if (intent.seniority && inferredSeniority) {
        const distance = seniorityDistance(intent.seniority, inferredSeniority);
        if (distance === 0) {
          priorityScore += 8;
        } else if (distance === 1) {
          priorityScore += 4;
        } else {
          priorityScore -= 6;
        }
      }

      priorityScore += Math.min(12, Math.round((job.jhi?.score || 0) / 10));

      if (matchBucket === 'broader' && roleScore >= 0.5) {
        matchBucket = 'adjacent';
      }
      if (matchBucket === 'adjacent' && roleScore >= 1 && intent.primaryDomain && primaryJobDomain === intent.primaryDomain) {
        matchBucket = 'best_fit';
      }

      if (!intent.primaryDomain && !intent.targetRole) {
        priorityScore = (job.jhi?.score || 0) + Math.max(0, 40 - index);
      }

      return {
        ...job,
        priorityScore,
        matchBucket,
        matchReasons: uniqueDomains(jobDomains).slice(0, 2).map((domain) => getCandidateIntentDomainLabel(domain, locale)).filter(Boolean).concat(reasons).slice(0, 3),
        matchedDomains: jobDomains,
        inferredDomain: primaryJobDomain,
        inferredSeniority,
      };
    })
    .sort((left, right) => {
      const bucketRank = (bucket: CandidateMatchBucket | undefined) => (bucket === 'best_fit' ? 3 : bucket === 'adjacent' ? 2 : 1);
      const bucketDiff = bucketRank(right.matchBucket) - bucketRank(left.matchBucket);
      if (bucketDiff !== 0) return bucketDiff;
      const scoreDiff = Number(right.priorityScore || 0) - Number(left.priorityScore || 0);
      if (scoreDiff !== 0) return scoreDiff;
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
  return signals.filter(Boolean);
};

