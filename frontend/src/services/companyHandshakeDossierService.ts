import type {
  CompanyApplicationRow,
  DialogueDossier,
  JobSignalBoostBrief,
  JobSignalBoostRecruiterReadout,
  JobSignalBoostSummaryItem,
} from '../types';

export interface CompanyHandshakeScoreCard {
  key: JobSignalBoostSummaryItem['key'];
  label: string;
  score: number;
  benchmark: number;
  delta: number;
  verdict: string;
}

export interface CompanyHandshakeResponseSection {
  id: string;
  title: string;
  body: string;
}

export interface CompanyHandshakeEvidenceBlock {
  title: string;
  body: string;
}

export interface CompanyHandshakeTaskMeta {
  kicker: string;
  timebox?: string | null;
  scenarioTitle?: string | null;
  scenarioContext?: string | null;
  coreProblem?: string | null;
  constraints: string[];
  deliverableTitle?: string | null;
  recruiterReadingGuide?: string | null;
}

export interface CompanyHandshakeIdentityLayer {
  locked: boolean;
  alias: string;
  revealTitle: string;
  revealBody: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  linkedin?: string | null;
  jobTitle?: string | null;
  skills: string[];
  values: string[];
}

export interface CompanyHandshakeDecisionView {
  alias: string;
  spotlight: {
    kicker: string;
    title: string;
    summary: string;
    candidateMove: string;
    businessImpact: string;
    nextStep: string;
    benchmarkLabel: string;
  };
  task: CompanyHandshakeTaskMeta;
  responseSections: CompanyHandshakeResponseSection[];
  scoreCards: CompanyHandshakeScoreCard[];
  evidenceBlocks: CompanyHandshakeEvidenceBlock[];
  strengths: string[];
  riskFlags: string[];
  stretchAreas: string[];
  whatCvDoesNotShow: string[];
  followUpQuestions: string[];
  fitHeadline?: string | null;
  validationFocus: string[];
  softSignals: string[];
  identity: CompanyHandshakeIdentityLayer;
}

const scoreLabels: Record<JobSignalBoostSummaryItem['key'], string> = {
  context_read: 'Context read',
  decision_quality: 'Decision quality',
  risk_judgment: 'Risk judgment',
  role_specificity: 'Role specificity',
};

const scoreBenchmarks: Record<JobSignalBoostSummaryItem['key'], number> = {
  context_read: 63,
  decision_quality: 61,
  risk_judgment: 58,
  role_specificity: 57,
};

const safeString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const safeRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const titleizeKey = (value: string): string => value
  .split(/[_-]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const aliasFromDossier = (dossier: DialogueDossier | null | undefined): string => {
  const basis = String(
    dossier?.candidate_id
    || dossier?.id
    || dossier?.candidate_email
    || dossier?.candidate_name
    || 'candidate'
  ).replace(/[^a-z0-9]/gi, '').toUpperCase();
  const suffix = basis.slice(-4) || 'A1';
  return `Signal ${suffix}`;
};

const buildFallbackSummaryItems = (dossier: DialogueDossier): JobSignalBoostSummaryItem[] => {
  const layers = safeRecord(dossier.fit_evidence?.layers || {}) || {};
  const fitScores = Object.values(layers)
    .map((entry) => safeRecord(entry))
    .map((entry) => Number(entry?.score ?? entry?.value ?? entry?.percentile ?? 0))
    .filter((value) => Number.isFinite(value));
  const baseline = fitScores.length
    ? Math.round(fitScores.reduce((sum, value) => sum + value, 0) / fitScores.length)
    : 66;
  const items: JobSignalBoostSummaryItem[] = [
    { key: 'context_read', label: scoreLabels.context_read, score: baseline + 4 },
    { key: 'decision_quality', label: scoreLabels.decision_quality, score: baseline + 1 },
    { key: 'risk_judgment', label: scoreLabels.risk_judgment, score: baseline - 2 },
    { key: 'role_specificity', label: scoreLabels.role_specificity, score: baseline + 2 },
  ];
  return items.map((item) => ({ ...item, score: Math.max(35, Math.min(92, item.score)) }));
};

const buildResponseSections = (
  brief: JobSignalBoostBrief | null,
  responsePayload: Record<string, string>,
): CompanyHandshakeResponseSection[] => {
  const structured = brief?.structured_sections || [];
  const fromBrief = structured
    .map((section) => ({
      id: section.id,
      title: section.title,
      body: safeString(responsePayload[section.id]) || '',
    }))
    .filter((section) => section.body);

  if (fromBrief.length) return fromBrief;

  const fromPayload = Object.entries(responsePayload)
    .map(([key, value]) => ({
      id: key,
      title: titleizeKey(key),
      body: safeString(value) || '',
    }))
    .filter((section) => section.body);

  return fromPayload.slice(0, 4);
};

const deriveCandidateMove = (
  responseSections: CompanyHandshakeResponseSection[],
  recruiterReadout: JobSignalBoostRecruiterReadout | null,
): string => (
  recruiterReadout?.headline
  || responseSections[0]?.body
  || 'Candidate shows a credible first move instead of generic motivation.'
);

const deriveBusinessImpact = (
  scoreCards: CompanyHandshakeScoreCard[],
  recruiterReadout: JobSignalBoostRecruiterReadout | null,
): string => {
  const topCard = [...scoreCards].sort((left, right) => right.score - left.score)[0];
  if (recruiterReadout?.fit_context?.headline) return recruiterReadout.fit_context.headline;
  if (!topCard) return 'Useful early signal for who deserves a real next step.';
  return `${topCard.label} lands ${Math.abs(topCard.delta)} points above the usual early applicant baseline.`;
};

const deriveEvidenceBlocks = (
  task: CompanyHandshakeTaskMeta,
  responseSections: CompanyHandshakeResponseSection[],
  recruiterReadout: JobSignalBoostRecruiterReadout | null,
): CompanyHandshakeEvidenceBlock[] => {
  const sections = responseSections.slice(0, 3).map((section) => ({
    title: section.title,
    body: section.body,
  }));
  const excerpt = safeString(recruiterReadout?.evidence_excerpt);
  if (excerpt) {
    sections.unshift({
      title: 'Evidence highlight',
      body: excerpt,
    });
  }
  if (!sections.length && task.coreProblem) {
    sections.push({
      title: 'Assessment task',
      body: task.coreProblem,
    });
  }
  return sections.slice(0, 4);
};

const deriveSummary = (
  alias: string,
  scoreCards: CompanyHandshakeScoreCard[],
): string => {
  const strongest = [...scoreCards].sort((left, right) => right.score - left.score)[0];
  if (!strongest) {
    return `${alias} gave the team a real decision signal before any CV-first filtering.`;
  }
  return `${alias} reacted to a real operating problem and produced strongest evidence in ${strongest.label.toLowerCase()}.`;
};

const deriveValidationFocus = (recruiterReadout: JobSignalBoostRecruiterReadout | null): string[] => (
  recruiterReadout?.fit_context?.recruiter_validation_focus?.length
    ? recruiterReadout.fit_context.recruiter_validation_focus
    : recruiterReadout?.follow_up_questions?.slice(0, 2) || []
);

const deriveSoftSignals = (recruiterReadout: JobSignalBoostRecruiterReadout | null): string[] => (
  recruiterReadout?.fit_context?.recruiter_soft_signals?.length
    ? recruiterReadout.fit_context.recruiter_soft_signals
    : recruiterReadout?.strength_signals?.slice(0, 3) || []
);

export const buildCompanyHandshakeDecisionView = (
  dossier: DialogueDossier,
): CompanyHandshakeDecisionView => {
  const alias = aliasFromDossier(dossier);
  const applicationPayload = safeRecord(dossier.application_payload) || {};
  const responsePayload = (safeRecord(applicationPayload.practical_assessment_response) || {}) as Record<string, string>;
  const normalizedBrief = (safeRecord(applicationPayload.practical_assessment_brief) || null) as unknown as JobSignalBoostBrief | null;
  const fallbackBrief = (safeRecord(applicationPayload.signal_boost_brief) || null) as unknown as JobSignalBoostBrief | null;
  const effectiveBrief = normalizedBrief || fallbackBrief;
  const recruiterReadout = dossier.signal_boost?.recruiter_readout || null;
  const signalSummary = dossier.signal_boost?.signal_summary || null;

  const summaryItems = signalSummary?.items?.length
    ? signalSummary.items
    : buildFallbackSummaryItems(dossier);
  const scoreCards = summaryItems.map((item) => {
    const benchmark = scoreBenchmarks[item.key];
    const delta = item.score - benchmark;
    return {
      key: item.key,
      label: item.label || scoreLabels[item.key],
      score: item.score,
      benchmark,
      delta,
      verdict: delta >= 10 ? 'Clearly above baseline' : delta >= 4 ? 'Above baseline' : delta <= -6 ? 'Needs validation' : 'Comparable baseline',
    };
  });

  const task: CompanyHandshakeTaskMeta = {
    kicker: effectiveBrief?.kicker || 'Practical assessment',
    timebox: effectiveBrief?.timebox || null,
    scenarioTitle: effectiveBrief?.scenario_title || effectiveBrief?.how_to_title || null,
    scenarioContext: effectiveBrief?.scenario_context || effectiveBrief?.job_excerpt || null,
    coreProblem: effectiveBrief?.core_problem || safeString(applicationPayload.company_goal) || dossier.job_title || null,
    constraints: effectiveBrief?.constraints || [],
    deliverableTitle: effectiveBrief?.deliverable_title || null,
    recruiterReadingGuide: effectiveBrief?.recruiter_reading_guide || null,
  };

  const resolvedResponsePayload = Object.keys(responsePayload).length
    ? responsePayload
    : Object.fromEntries(
        Object.entries(safeRecord(applicationPayload.response_payload) || {})
          .map(([key, value]) => [key, safeString(value) || ''])
          .filter(([, value]) => value)
      );
  const responseSections = buildResponseSections(effectiveBrief, resolvedResponsePayload);
  const evidenceBlocks = deriveEvidenceBlocks(task, responseSections, recruiterReadout);
  const candidateMove = deriveCandidateMove(responseSections, recruiterReadout);
  const businessImpact = deriveBusinessImpact(scoreCards, recruiterReadout);
  const nextStep = recruiterReadout?.recommended_next_step || 'Open a short follow-up conversation and validate ownership depth on the live team problem.';
  const summary = deriveSummary(alias, scoreCards);

  const identity = dossier.candidate_profile_snapshot || {};
  return {
    alias,
    spotlight: {
      kicker: 'Anonymous skill-first dossier',
      title: `${alias} already behaves like part of the team`,
      summary,
      candidateMove,
      businessImpact,
      nextStep,
      benchmarkLabel: scoreCards[0]
        ? `${scoreCards.filter((item) => item.delta >= 0).length}/${scoreCards.length} scorecards land at or above typical applicant baseline`
        : 'Decision signal ready before CV reveal',
    },
    task,
    responseSections,
    scoreCards,
    evidenceBlocks,
    strengths: recruiterReadout?.strength_signals || [],
    riskFlags: recruiterReadout?.risk_flags || [],
    stretchAreas: recruiterReadout?.fit_context?.stretch_areas || [],
    whatCvDoesNotShow: recruiterReadout?.what_cv_does_not_show || [],
    followUpQuestions: recruiterReadout?.follow_up_questions || [],
    fitHeadline: recruiterReadout?.fit_context?.headline || null,
    validationFocus: deriveValidationFocus(recruiterReadout),
    softSignals: deriveSoftSignals(recruiterReadout),
    identity: {
      locked: true,
      alias,
      revealTitle: 'Identity unlock stays earned',
      revealBody: 'Name, direct contact, and full profile stay hidden until the team wants to continue the conversation.',
      name: identity.name || dossier.candidate_name || null,
      email: identity.email || dossier.candidate_email || null,
      phone: identity.phone || null,
      avatarUrl: null,
      linkedin: identity.linkedin || null,
      jobTitle: identity.jobTitle || null,
      skills: identity.skills || [],
      values: identity.values || [],
    },
  };
};

export const getCompanyDialogueAlias = (
  dialogue: Pick<CompanyApplicationRow, 'id' | 'candidate_id' | 'candidate_email' | 'candidate_name'>,
): string => aliasFromDossier(dialogue as unknown as DialogueDossier);
