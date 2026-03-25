import type { CandidateDomainKey, CandidateSeniority, Job, UserProfile } from '../../../../types';
import { resolveJobDomain } from '../../../../utils/domainAccents';

export interface CareerPathCluster {
  id: string;
  title: string;
  summary: string;
  preview: string;
  tags: string[];
  strategy: 'bridge' | 'progression' | 'adjacent' | 'direct';
  challengeIds: string[];
  score: number;
}

interface CandidateCareerSignals {
  currentRoleText: string;
  primaryDomain: CandidateDomainKey | null;
  secondaryDomains: CandidateDomainKey[];
  targetRole: string;
  explicitTargetRole: string;
  allowIntentionalShift: boolean;
  seniority: CandidateSeniority | null;
  experienceYears: number;
  text: string;
  currentRoleBreadth: number;
  currentRoleIsManagerial: boolean;
  currentRoleIsOperationsScope: boolean;
  currentRoleIsPeopleScope: boolean;
  currentRoleIsFrontlineScope: boolean;
  hasHospitalityFrontline: boolean;
  hasCustomerCommunication: boolean;
  hasLanguages: boolean;
  hasLeadershipPotential: boolean;
  hasAdminCoordination: boolean;
  hasPeopleOpsPotential: boolean;
  hasTechDigitalFluency: boolean;
}

const domainLabels: Partial<Record<CandidateDomainKey, string>> = {
  customer_support: 'Customer support',
  education: 'Education',
  engineering: 'Engineering',
  finance: 'Finance',
  healthcare: 'Healthcare',
  hospitality: 'Hospitality',
  it: 'IT & software',
  logistics: 'Logistics',
  manufacturing: 'Manufacturing',
  marketing: 'Marketing',
  operations: 'Operations',
  product_management: 'Product management',
  retail: 'Retail',
  sales: 'Sales',
};

interface JobCareerSignals {
  id: string;
  title: string;
  text: string;
  domains: CandidateDomainKey[];
  roleSeniority: CandidateSeniority | null;
  roleBreadth: number;
  isManagerial: boolean;
  isCustomerSupport: boolean;
  isFrontOfficeLead: boolean;
  isPeopleOps: boolean;
  isOperationsCoordination: boolean;
  isOperationsManagement: boolean;
  isSalesRelationship: boolean;
  isTechnicalSupport: boolean;
  isAdminBackoffice: boolean;
}

interface CareerPathPattern {
  id: string;
  title: string;
  strategy: 'bridge' | 'progression' | 'adjacent';
  tags: string[];
  score: (candidate: CandidateCareerSignals, job: JobCareerSignals) => number;
  summary: (candidate: CandidateCareerSignals, jobs: JobCareerSignals[]) => string;
}

const normalizeText = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/+.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const uniqueStrings = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  });
  return out;
};

const humanizeDomain = (domain: CandidateDomainKey | null | undefined): string => {
  if (!domain) return '';
  return domainLabels[domain] || domain.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
};

const compactText = (value: string, max = 96): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 1)).trim()}...`;
};

const hasAny = (text: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(text));

const sumDurationYears = (profile: UserProfile): number => {
  const items = Array.isArray(profile.workHistory) ? profile.workHistory : [];
  const total = items.reduce((sum, item) => {
    const duration = normalizeText(item.duration || '');
    if (!duration) return sum + 0.8;

    const yearMatch = duration.match(/(\d+(?:[.,]\d+)?)\s*(year|years|yr|yrs|rok|roky|let)/);
    if (yearMatch) return sum + Number(yearMatch[1].replace(',', '.'));

    const monthMatch = duration.match(/(\d+(?:[.,]\d+)?)\s*(month|months|mesic|mesice|mesicu|mesicu|mes|months?)/);
    if (monthMatch) return sum + (Number(monthMatch[1].replace(',', '.')) / 12);

    return sum + 0.8;
  }, 0);

  return Number(total.toFixed(1));
};

const inferRoleSeniority = (text: string): CandidateSeniority | null => {
  if (!text) return null;
  if (/\b(head|director|lead|manager|team lead|vedouci|supervisor)\b/.test(text)) return 'lead';
  if (/\b(senior|staff|expert|specialist ii|architect)\b/.test(text)) return 'senior';
  if (/\b(medior|mid|intermediate)\b/.test(text)) return 'medior';
  if (/\b(junior|associate|coordinator|assistant)\b/.test(text)) return 'junior';
  if (/\b(entry|trainee|intern|graduate)\b/.test(text)) return 'entry';
  return null;
};

const inferRoleBreadth = (text: string): number => {
  if (!text) return 1;
  if (/\b(chief|director|head of|head|general manager)\b/.test(text)) return 5;
  if (/\b(operations manager|business operations manager|service operations|hotel operations|project manager|program manager|office manager|front office manager|account manager|people manager|lead)\b/.test(text)) return 4;
  if (/\b(manager|recruiter|hr coordinator|customer success manager|specialist|analyst|consultant)\b/.test(text)) return 3;
  if (/\b(coordinator|support|associate|administrator|assistant)\b/.test(text)) return 2;
  return 1;
};

const buildCandidateSignals = (profile: UserProfile): CandidateCareerSignals => {
  const searchProfile = profile.preferences?.searchProfile;
  const latestHistoryRole = profile.workHistory?.find((item) => String(item?.role || '').trim())?.role || '';
  const currentRoleText = String(profile.jobTitle || latestHistoryRole || '').trim();
  const explicitTargetRole = String(searchProfile?.targetRole || profile.preferences?.desired_role || '').trim();
  const text = normalizeText([
    profile.jobTitle,
    profile.preferences?.desired_role,
    searchProfile?.targetRole,
    profile.cvText,
    profile.cvAiText,
    profile.story,
    ...(profile.skills || []),
    ...(profile.inferredSkills || []),
    ...(profile.strengths || []),
    ...(profile.leadership || []),
    ...(profile.certifications || []),
    ...(profile.workHistory || []).flatMap((item) => [item.role, item.company, item.description, item.duration]),
  ].filter(Boolean).join(' '));

  const remoteLanguageCodes = profile.preferences?.searchProfile?.remoteLanguageCodes || [];
  const languageSignals = ['english', 'german', 'deutsch', 'french', 'spanish', 'italian', 'polish', 'czech', 'slovak', 'nemcina', 'anglictina', 'jazyk'];

  return {
    currentRoleText,
    primaryDomain: searchProfile?.primaryDomain || searchProfile?.inferredPrimaryDomain || null,
    secondaryDomains: searchProfile?.secondaryDomains || [],
    targetRole: String(explicitTargetRole || currentRoleText).trim(),
    explicitTargetRole,
    allowIntentionalShift: Boolean(explicitTargetRole && normalizeText(explicitTargetRole) !== normalizeText(currentRoleText)),
    seniority: searchProfile?.seniority || inferRoleSeniority(text),
    experienceYears: Math.max(sumDurationYears(profile), profile.workHistory?.length ? 0.8 : 0),
    text,
    currentRoleBreadth: inferRoleBreadth(normalizeText(currentRoleText)),
    currentRoleIsManagerial: /\b(manager|lead|director|head|supervisor)\b/.test(normalizeText(currentRoleText)),
    currentRoleIsOperationsScope: /\b(operations|business operations|service operations|hotel operations|office manager|project manager)\b/.test(normalizeText(currentRoleText)),
    currentRoleIsPeopleScope: /\b(hr|recruit|people|talent)\b/.test(normalizeText(currentRoleText)),
    currentRoleIsFrontlineScope: /\b(reception|front desk|front office|guest service|customer support|customer success)\b/.test(normalizeText(currentRoleText)),
    hasHospitalityFrontline: hasAny(text, [/\b(reception|recepcni|receptionist|front desk|concierge|guest service|hotel|booking|reservation)\b/]),
    hasCustomerCommunication: hasAny(text, [/\b(customer|client|guest|communication|service|care|support|complaint|relationship)\b/]),
    hasLanguages: remoteLanguageCodes.length > 1 || hasAny(text, languageSignals.map((item) => new RegExp(`\\b${item}\\b`))),
    hasLeadershipPotential: Boolean((profile.leadership || []).length) || hasAny(text, [/\b(team lead|shift lead|supervisor|training|mentor|vedouci|leadership|manager)\b/]),
    hasAdminCoordination: hasAny(text, [/\b(coordinat|schedule|booking|reservation|office|admin|administrative|planning|excel|crm|operations|back office)\b/]),
    hasPeopleOpsPotential: hasAny(text, [/\b(hr|human resources|recruit|onboarding|interview|people ops|talent)\b/]),
    hasTechDigitalFluency: hasAny(text, [/\b(crm|zendesk|jira|ticket|software|digital|excel|ai|automation|tech|system)\b/]),
  };
};

const buildJobSignals = (job: Job): JobCareerSignals => {
  const text = normalizeText([
    job.title,
    job.description,
    job.challenge,
    job.risk,
    ...(job.tags || []),
    ...(job.required_skills || []),
  ].filter(Boolean).join(' '));

  const primaryDomain = resolveJobDomain(job);
  const domains = uniqueStrings([...(job.matchedDomains || []), primaryDomain].filter(Boolean) as string[]) as CandidateDomainKey[];

  return {
    id: String(job.id),
    title: String(job.title || 'Career direction'),
    text,
    domains,
    roleSeniority: inferRoleSeniority(text),
    roleBreadth: inferRoleBreadth(text),
    isManagerial: /\b(manager|lead|director|head|supervisor)\b/.test(text),
    isCustomerSupport: hasAny(text, [/\b(customer support|customer success|support specialist|helpdesk|service desk|client care|care specialist)\b/]),
    isFrontOfficeLead: hasAny(text, [/\b(front office manager|guest relations manager|reception manager|office manager|shift lead|team lead)\b/]),
    isPeopleOps: hasAny(text, [/\b(hr|recruiter|recruitment|talent acquisition|people ops|hr coordinator|hr admin|onboarding specialist)\b/]),
    isOperationsCoordination: hasAny(text, [/\b(operations coordinator|operations specialist|office manager|project coordinator|back office|administrative support|coordinator)\b/]),
    isOperationsManagement: hasAny(text, [/\b(operations manager|business operations manager|service operations manager|head of operations|operations lead|project manager)\b/]),
    isSalesRelationship: hasAny(text, [/\b(account manager|customer success manager|business development|sales|client partner|relationship manager)\b/]),
    isTechnicalSupport: hasAny(text, [/\b(it support|technical support|implementation specialist|support engineer|service desk)\b/]),
    isAdminBackoffice: hasAny(text, [/\b(back office|administrative|office support|scheduler|coordinator|assistant)\b/]),
  };
};

const getRegressionPenalty = (candidate: CandidateCareerSignals, job: JobCareerSignals): number => {
  if (candidate.allowIntentionalShift) return 0;

  let penalty = 0;
  const breadthDiff = Math.max(0, candidate.currentRoleBreadth - job.roleBreadth);

  if (candidate.currentRoleIsManagerial && breadthDiff > 0) {
    penalty += 10 + breadthDiff * 8;
  }

  if (candidate.currentRoleIsOperationsScope && !job.isOperationsManagement && job.isFrontOfficeLead) {
    penalty += 30;
  }

  if (candidate.currentRoleIsOperationsScope && !job.isOperationsManagement && job.isCustomerSupport) {
    penalty += 22;
  }

  if (candidate.currentRoleIsOperationsScope && job.isPeopleOps) {
    penalty += 12;
  }

  if (candidate.currentRoleIsPeopleScope && job.isCustomerSupport) {
    penalty += 10;
  }

  if (!candidate.currentRoleIsFrontlineScope && candidate.currentRoleIsManagerial && !job.isManagerial && job.roleBreadth <= 2) {
    penalty += 12;
  }

  return penalty;
};

const patternScoreFromTargetRole = (candidate: CandidateCareerSignals, phrases: string[]): number =>
  phrases.some((phrase) => normalizeText(candidate.targetRole).includes(normalizeText(phrase))) ? 8 : 0;

const chooseTopRoleTitles = (jobs: JobCareerSignals[]): string =>
  uniqueStrings(jobs.map((job) => job.title))
    .slice(0, 3)
    .join(' · ');

const buildClusterPreview = (
  title: string,
  strategy: CareerPathCluster['strategy'],
  jobs: JobCareerSignals[],
): string => {
  const text = normalizeText([title, ...jobs.map((job) => job.title)].join(' '));

  if (/\b(product|architect|systems|analyst|technical|engineer|it|devops|integration)\b/.test(text)) {
    return 'Tady spojuješ technické myšlení s realnym dopadem.';
  }
  if (/\b(customer support|customer success|support|helpdesk|service desk)\b/.test(text)) {
    return 'Tady zúročíš komunikaci, klid a cit pro lidi.';
  }
  if (/\b(front office|operations manager|office manager|guest relations)\b/.test(text)) {
    return 'Tady roste tvoje odpovědnost za chod, tým a kvalitu služby.';
  }
  if (/\b(hr|people|recruit|talent|onboarding)\b/.test(text)) {
    return 'Tady měníš práci s lidmi v nábor, onboarding a koordinaci.';
  }
  if (/\b(account|sales|business development|client partner)\b/.test(text)) {
    return 'Tady stavíš vztahy, důvěru a obchodní momentum.';
  }

  if (strategy === 'progression') {
    return 'Tady roste tvoje odpovědnost, vliv a rozhodování.';
  }
  if (strategy === 'adjacent') {
    return 'Tady otevíráš nový směr bez ztráty toho, co už umíš.';
  }
  if (strategy === 'bridge') {
    return 'Tady přenášíš své silné stránky do příbuzného směru.';
  }
  return 'Tady navazuješ na to, co už děláš dobře.';
};

const getPathPatterns = (): CareerPathPattern[] => [
  {
    id: 'operations-manager',
    title: 'Operations Manager',
    strategy: 'progression',
    tags: ['Core path', 'Leadership scope', 'Operational ownership'],
    score: (candidate, job) => {
      if (!job.isOperationsManagement) return -100;
      let score = 0;
      if (job.isOperationsManagement) score += 22;
      if (job.domains.includes('operations')) score += 10;
      if (candidate.currentRoleIsOperationsScope) score += 12;
      if (candidate.currentRoleIsManagerial && job.isManagerial) score += 8;
      if (candidate.experienceYears >= 3) score += 4;
      score += patternScoreFromTargetRole(candidate, ['operations manager', 'business operations', 'project manager', 'head of operations']);
      score -= getRegressionPenalty(candidate, job);
      return score;
    },
    summary: (_candidate, jobs) =>
      `Builds on existing operational ownership instead of sending you back into narrower frontline work. Best when the current profile already carries coordination, process responsibility or team leadership, as seen in ${chooseTopRoleTitles(jobs) || 'operations management roles'}.`,
  },
  {
    id: 'customer-support-specialist',
    title: 'Customer Support Specialist',
    strategy: 'bridge',
    tags: ['Bridge role', 'Language leverage', 'People-facing'],
    score: (candidate, job) => {
      if (!(job.isCustomerSupport || job.isTechnicalSupport || job.domains.includes('customer_support'))) return -100;
      let score = 0;
      if (job.isCustomerSupport) score += 18;
      if (job.isTechnicalSupport) score += 6;
      if (job.domains.includes('customer_support')) score += 8;
      if (candidate.hasCustomerCommunication) score += 8;
      if (candidate.hasHospitalityFrontline) score += 8;
      if (candidate.hasLanguages) score += 5;
      if (candidate.hasTechDigitalFluency && (job.isTechnicalSupport || /crm|ticket|zendesk/.test(job.text))) score += 4;
      score += patternScoreFromTargetRole(candidate, ['customer support', 'customer success', 'support specialist', 'helpdesk']);
      score -= getRegressionPenalty(candidate, job);
      return score;
    },
    summary: (candidate, jobs) =>
      `Turns guest communication, calm issue-solving${candidate.hasLanguages ? ' and language confidence' : ''} into structured support work. Best for roles like ${chooseTopRoleTitles(jobs) || 'customer support'} where service empathy needs a more digital workflow.`,
  },
  {
    id: 'front-office-manager',
    title: 'Front Office Manager',
    strategy: 'progression',
    tags: ['Progression step', 'Leadership path', 'Hospitality'],
    score: (candidate, job) => {
      if (!job.isFrontOfficeLead) return -100;
      let score = 0;
      if (job.isFrontOfficeLead) score += 20;
      if (job.domains.includes('hospitality')) score += 6;
      if (job.domains.includes('operations')) score += 5;
      if (candidate.hasHospitalityFrontline) score += 10;
      if (candidate.hasLeadershipPotential) score += 8;
      if (candidate.experienceYears >= 2) score += 6;
      if (candidate.experienceYears < 1.5) score -= 8;
      if (candidate.seniority === 'lead' || candidate.seniority === 'senior') score += 4;
      score += patternScoreFromTargetRole(candidate, ['front office manager', 'guest relations manager', 'office manager']);
      score -= getRegressionPenalty(candidate, job);
      return score;
    },
    summary: (candidate, jobs) =>
      `A next-step path for someone who already handles guests, coordination and daily pressure. ${candidate.experienceYears >= 2 ? 'Your experience profile suggests readiness for shift ownership, team guidance and service quality control.' : 'This path becomes strongest once you add a bit more visible ownership or team coordination.'} Active roles here include ${chooseTopRoleTitles(jobs) || 'front office leadership roles'}.`,
  },
  {
    id: 'hr-people-coordinator',
    title: 'HR & People Coordinator',
    strategy: 'adjacent',
    tags: ['Adjacent move', 'People ops', 'Coordination'],
    score: (candidate, job) => {
      if (!job.isPeopleOps) return -100;
      let score = 0;
      if (job.isPeopleOps) score += 18;
      if (/\b(onboarding|interview|candidate communication|talent acquisition)\b/.test(job.text)) score += 8;
      if (job.isAdminBackoffice) score += 4;
      if (candidate.hasCustomerCommunication) score += 6;
      if (candidate.hasAdminCoordination) score += 6;
      if (candidate.hasLanguages) score += 3;
      if (candidate.hasHospitalityFrontline) score += 4;
      if (candidate.hasPeopleOpsPotential) score += 4;
      score += patternScoreFromTargetRole(candidate, ['hr', 'recruiter', 'people coordinator', 'talent']);
      score -= getRegressionPenalty(candidate, job);
      return score;
    },
    summary: (_candidate, jobs) =>
      `Uses communication, scheduling discipline and people-facing confidence for hiring and onboarding work. This is a strong adjacent move when your background already mixes service calm with coordination, especially for roles like ${chooseTopRoleTitles(jobs) || 'HR coordination'}.`,
  },
  {
    id: 'operations-coordinator',
    title: 'Operations Coordinator',
    strategy: 'bridge',
    tags: ['Bridge role', 'Process-heavy', 'Coordination'],
    score: (candidate, job) => {
      if (!job.isOperationsCoordination) return -100;
      let score = 0;
      if (job.isOperationsCoordination) score += 18;
      if (job.isAdminBackoffice) score += 7;
      if (job.isPeopleOps) score -= 12;
      if (job.domains.includes('operations')) score += 8;
      if (candidate.hasAdminCoordination) score += 8;
      if (candidate.hasHospitalityFrontline) score += 4;
      if (candidate.hasTechDigitalFluency) score += 4;
      if (candidate.primaryDomain === 'operations') score += 5;
      score += patternScoreFromTargetRole(candidate, ['operations', 'office manager', 'coordinator', 'back office']);
      score -= getRegressionPenalty(candidate, job);
      return score;
    },
    summary: (_candidate, jobs) =>
      `A strong path when your background already includes booking, scheduling, handovers or service coordination. It channels real-world execution into calmer process roles like ${chooseTopRoleTitles(jobs) || 'operations coordination'}.`,
  },
  {
    id: 'technical-support-specialist',
    title: 'Technical Support Specialist',
    strategy: 'adjacent',
    tags: ['Adjacent move', 'Digital workflow', 'Support + systems'],
    score: (candidate, job) => {
      if (!job.isTechnicalSupport) return -100;
      let score = 0;
      if (job.isTechnicalSupport) score += 18;
      if (job.isCustomerSupport) score += 5;
      if (job.domains.includes('it')) score += 6;
      if (candidate.hasCustomerCommunication) score += 5;
      if (candidate.hasTechDigitalFluency) score += 8;
      if (candidate.hasLanguages) score += 3;
      score += patternScoreFromTargetRole(candidate, ['technical support', 'it support', 'implementation']);
      score -= getRegressionPenalty(candidate, job);
      return score;
    },
    summary: (_candidate, jobs) =>
      `Best when people-facing communication is already there and the next step is stronger digital or systems fluency. This path suits service-oriented candidates who can translate real problems into tool-based support, especially in ${chooseTopRoleTitles(jobs) || 'technical support roles'}.`,
  },
  {
    id: 'account-client-partner',
    title: 'Account & Client Partner',
    strategy: 'adjacent',
    tags: ['Adjacent move', 'Relationship-led', 'Commercial edge'],
    score: (candidate, job) => {
      if (!job.isSalesRelationship) return -100;
      let score = 0;
      if (job.isSalesRelationship) score += 18;
      if (job.domains.includes('sales')) score += 8;
      if (candidate.hasCustomerCommunication) score += 7;
      if (candidate.hasLanguages) score += 3;
      if (candidate.hasLeadershipPotential) score += 2;
      score += patternScoreFromTargetRole(candidate, ['account manager', 'business development', 'sales']);
      score -= getRegressionPenalty(candidate, job);
      return score;
    },
    summary: (_candidate, jobs) =>
      `This path turns trust-building and relationship handling into revenue-facing work. It works best where communication already feels natural and the next step is stronger ownership of clients, as seen in ${chooseTopRoleTitles(jobs) || 'account-facing roles'}.`,
  },
];

const fallbackClusterTitle = (job: JobCareerSignals): string => {
  const normalizedTitle = String(job.title || '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+\|\s+|\s+@\s+|\s+at\s+/i)[0]
    .replace(/\b(senior|junior|lead|principal|staff|mid|medior|sr\.?|jr\.?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalizedTitle) {
    return normalizedTitle
      .split(' ')
      .slice(0, 4)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  }

  return humanizeDomain(job.domains[0]) || 'Career Direction';
};

const fallbackClusterSummary = (job: JobCareerSignals): string => {
  const domainLabel = humanizeDomain(job.domains[0]);
  if (domainLabel) {
    return `A direct path inside ${domainLabel.toLowerCase()} based on live roles that already overlap with your current discovery feed.`;
  }
  return 'A direct cluster built from strongly overlapping roles in the current discovery feed.';
};

const buildTitleScopedFallbackClusters = (
  assignments: Array<{
    clusterId: string;
    title: string;
    summary: string;
    tags: string[];
    strategy: CareerPathCluster['strategy'];
    signal: JobCareerSignals;
    score: number;
  }>,
): CareerPathCluster[] => {
  const grouped = new Map<string, typeof assignments>();

  assignments.forEach((item) => {
    const fallbackTitle = fallbackClusterTitle(item.signal);
    const key = `title:${normalizeText(fallbackTitle || item.signal.title || item.signal.id) || item.signal.id}`;
    const bucket = grouped.get(key) || [];
    bucket.push({
      ...item,
      clusterId: key,
      title: fallbackTitle || item.title,
      summary: fallbackClusterSummary(item.signal),
      tags: item.tags.length > 0 ? item.tags : ['Direct match'],
      strategy: 'direct',
      score: Math.max(item.score, 10),
    });
    grouped.set(key, bucket);
  });

  return Array.from(grouped.entries())
    .map(([id, items]) => {
      const sortedSignals = [...items].sort((left, right) => right.score - left.score);
      const topScore = Math.max(...sortedSignals.map((item) => item.score), 0);
      const clusterTitle = sortedSignals[0]?.title || fallbackClusterTitle(sortedSignals[0]?.signal);
      const strategy: CareerPathCluster['strategy'] = 'direct';
      return {
        id,
        title: clusterTitle || 'Career Direction',
        summary: sortedSignals[0]?.summary || fallbackClusterSummary(sortedSignals[0].signal),
        preview: compactText(buildClusterPreview(clusterTitle || 'Career Direction', strategy, sortedSignals.map((item) => item.signal)), 92),
        tags: uniqueStrings(sortedSignals.flatMap((item) => item.tags)).slice(0, 3),
        strategy,
        challengeIds: sortedSignals.map((item) => item.signal.id),
        score: topScore + items.length * 3,
      };
    })
    .sort((left, right) => right.score - left.score || right.challengeIds.length - left.challengeIds.length);
};

export const buildCareerPathClusters = (input: {
  jobs: Job[];
  userProfile: UserProfile;
}): CareerPathCluster[] => {
  const { jobs, userProfile } = input;
  const candidate = buildCandidateSignals(userProfile);
  const patterns = getPathPatterns();

  const assignments = jobs.reduce<Array<{
    clusterId: string;
    title: string;
    summary: string;
    tags: string[];
    strategy: CareerPathCluster['strategy'];
    signal: JobCareerSignals;
    score: number;
  }>>((items, job) => {
    const signal = buildJobSignals(job);
    const regressionPenalty = getRegressionPenalty(candidate, signal);

    if (!candidate.allowIntentionalShift && candidate.currentRoleIsManagerial && regressionPenalty >= 24 && !signal.isOperationsManagement) {
      return items;
    }

    const scoredPatterns = patterns
      .map((pattern) => ({ pattern, score: pattern.score(candidate, signal) }))
      .sort((left, right) => right.score - left.score);

    const best = scoredPatterns[0];
    if (best && best.score >= 20) {
      items.push({
        clusterId: best.pattern.id,
        title: best.pattern.title,
        summary: best.pattern.summary(candidate, [signal]),
        tags: best.pattern.tags,
        strategy: best.pattern.strategy,
        signal,
        score: best.score,
      });
      return items;
    }

    const fallbackTitle = fallbackClusterTitle(signal);
    items.push({
      clusterId: `direct:${normalizeText(fallbackTitle || signal.title || signal.id) || signal.id}`,
      title: fallbackTitle,
      summary: fallbackClusterSummary(signal),
      tags: ['Direct match'],
      strategy: 'direct' as const,
      signal,
      score: 10 + (signal.domains[0] && signal.domains[0] === candidate.primaryDomain ? 6 : 0),
    });
    return items;
  }, []);

  const grouped = new Map<string, typeof assignments>();
  assignments.forEach((item) => {
    const bucket = grouped.get(item.clusterId) || [];
    bucket.push(item);
    grouped.set(item.clusterId, bucket);
  });

  const clusters = Array.from(grouped.entries())
    .map(([id, items]) => {
      const topScore = Math.max(...items.map((item) => item.score), 0);
      const sortedSignals = [...items].sort((left, right) => right.score - left.score);
      const clusterTitle = sortedSignals[0]?.title || 'Career Direction';
      const strategy = sortedSignals[0]?.strategy || 'direct';
      const tags = uniqueStrings(sortedSignals.flatMap((item) => item.tags)).slice(0, 3);
      const summary =
        strategy !== 'direct'
          ? (() => {
              const pattern = patterns.find((candidatePattern) => candidatePattern.id === id);
              return pattern
                ? pattern.summary(candidate, sortedSignals.map((item) => item.signal))
                : sortedSignals[0]?.summary || fallbackClusterSummary(sortedSignals[0].signal);
            })()
          : sortedSignals[0]?.summary || fallbackClusterSummary(sortedSignals[0].signal);

      return {
        id,
        title: clusterTitle,
        summary,
        preview: compactText(buildClusterPreview(clusterTitle, strategy, sortedSignals.map((item) => item.signal)), 92),
        tags,
        strategy,
        challengeIds: sortedSignals.map((item) => item.signal.id),
        score: topScore + items.length * 3,
      };
    })
    .sort((left, right) => right.score - left.score || right.challengeIds.length - left.challengeIds.length);

  if (jobs.length >= 4 && clusters.length <= 1) {
    const titleScoped = buildTitleScopedFallbackClusters(assignments);
    if (titleScoped.length > clusters.length) {
      console.log('[CareerOS] Fallback title-scoped clustering applied:', {
        jobs: jobs.length,
        initialClusters: clusters.length,
        fallbackClusters: titleScoped.length,
      });
      return titleScoped;
    }
  }

  return clusters;
};
