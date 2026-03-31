import React, { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'markdown-to-jsx';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Copy, Eye, Loader2, PauseCircle, PlayCircle, Plus, RefreshCw, Save, Sparkles, UploadCloud, Users, XCircle } from 'lucide-react';
import {
  CompanyHumanContextPersonOption,
  CompanyProfile,
  Job,
  JobChallengeFormat,
  JobDraft,
  JobHiringStage,
  JobPublicPerson,
  JobValidationReport,
  JobVersion,
  MicroJobCollaborationMode,
  MicroJobKind,
  MicroJobLongTermPotential
} from '../types';
import {
  createCompanyJobDraft,
  createEditDraftFromRole,
  fetchCompanySchemaRolloutStatus,
  fetchCompanyHumanContextPeople,
  duplicateRoleIntoDraft,
  isMissingFeatureError,
  listCompanyJobDrafts,
  listRoleVersions,
  publishCompanyJobDraft,
  updateCompanyJobDraft,
  updateCompanyRoleLifecycle,
  CompanySchemaRolloutStatus,
  validateCompanyJobDraft
} from '../services/companyJobDraftService';
import { optimizeJobDescription } from '../services/geminiService';
import { cn } from './ui/primitives';

type JobDraftTextSection =
  | 'role_summary'
  | 'team_intro'
  | 'responsibilities'
  | 'requirements'
  | 'nice_to_have'
  | 'application_instructions';

type JobDraftHandshakeField =
  | 'first_reply_prompt'
  | 'company_truth_hard'
  | 'company_truth_fail'
  | 'company_goal';

type MicroJobEditorState = {
  challenge_format: JobChallengeFormat;
  kind: MicroJobKind | null;
  time_estimate: string;
  collaboration_modes: MicroJobCollaborationMode[];
  long_term_potential: MicroJobLongTermPotential | null;
};

interface CompanyJobEditorProps {
  companyProfile: CompanyProfile;
  jobs: Job[];
  userEmail?: string;
  seedJobId?: string | null;
  createDraftSignal?: number;
  draftSeedPayload?: Partial<JobDraft> | null;
  onDraftSeedConsumed?: () => void;
  onSeedConsumed?: () => void;
  onJobLifecycleChange?: (
    jobId: string | number,
    status: 'active' | 'paused' | 'closed' | 'archived',
    options?: { skipAudit?: boolean; refreshJobs?: boolean }
  ) => void;
}

const TEXT_SECTIONS: Array<{ key: JobDraftTextSection }> = [
  { key: 'role_summary' },
  { key: 'team_intro' },
  { key: 'responsibilities' },
  { key: 'requirements' },
  { key: 'nice_to_have' },
  { key: 'application_instructions' }
];

const MICRO_JOB_TEXT_SECTIONS: Array<{ key: JobDraftTextSection }> = [
  { key: 'role_summary' },
  { key: 'responsibilities' },
  { key: 'application_instructions' }
];

const DEFAULT_VALIDATION: JobValidationReport = {
  blockingIssues: [],
  warnings: [],
  suggestions: [],
  transparencyScore: 0,
  clarityScore: 0
};

type LocalValidationMessages = {
  role_title_required: string;
  role_summary_required: string;
  role_goal_required: string;
  role_truth_hard_required: string;
  role_truth_fail_required: string;
  micro_job_kind_required: string;
  micro_job_time_required: string;
  micro_job_budget_required: string;
  micro_job_collaboration_required: string;
  salary_visible_required: string;
  location_required: string;
  application_destination_required: string;
  requirements_thin: string;
  benefits_required: string;
  first_reply_prompt_required: string;
  role_summary_expand: string;
  vague_benefits_replace: string;
};

const DEFAULT_LOCAL_VALIDATION_MESSAGES: LocalValidationMessages = {
  role_title_required: 'Add a role title.',
  role_summary_required: 'Add a role summary.',
  role_goal_required: 'Add a concrete goal (what outcome this role should drive).',
  role_truth_hard_required: 'Add what is genuinely hard about this role.',
  role_truth_fail_required: 'Add what type of person usually fails here.',
  micro_job_kind_required: 'Choose what kind of mini challenge this is.',
  micro_job_time_required: 'Add a realistic time estimate for the mini challenge.',
  micro_job_budget_required: 'Add a budget or reward range for the mini challenge.',
  micro_job_collaboration_required: 'Choose at least one collaboration type for the mini challenge.',
  salary_visible_required: 'Add a visible salary range to improve transparency.',
  location_required: 'Add a public location or workplace address.',
  application_destination_required: 'Add an application destination or clear instructions.',
  requirements_thin: 'Requirements are still thin. Add at least two concrete must-haves.',
  benefits_required: 'List at least one concrete benefit.',
  first_reply_prompt_required: 'Add a first reply prompt so candidates know how to begin the handshake.',
  role_summary_expand: 'Expand the role summary so candidates understand what success looks like.',
  vague_benefits_replace: 'Replace vague benefits with specifics candidates can evaluate.',
};

const ensureArray = <T,>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];

const normalizeValidationReport = (value: Partial<JobValidationReport> | null | undefined): JobValidationReport => ({
  blockingIssues: ensureArray(value?.blockingIssues),
  warnings: ensureArray(value?.warnings),
  suggestions: ensureArray(value?.suggestions),
  transparencyScore: typeof value?.transparencyScore === 'number' ? value.transparencyScore : 0,
  clarityScore: typeof value?.clarityScore === 'number' ? value.clarityScore : 0
});

const getLocalDraftStorageKey = (companyId?: string) => `jobshaman-company-job-drafts:${companyId || 'unknown'}`;
const getLocalVersionStorageKey = (companyId?: string) => `jobshaman-company-job-versions:${companyId || 'unknown'}`;

const readLocalJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeLocalJson = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore local storage errors in compatibility mode
  }
};

const normalizeNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const compactLines = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const DEFAULT_HIRING_STAGE: JobHiringStage = 'collecting_cvs';
const MAX_HUMAN_CONTEXT_RESPONDERS = 3;

type HumanContextEditorState = {
  publisher: JobPublicPerson | null;
  responders: JobPublicPerson[];
};

const HIRING_STAGE_OPTIONS: Array<{ value: JobHiringStage; label: string }> = [
  { value: 'collecting_cvs', label: 'Collecting CVs' },
  { value: 'reviewing_first_10', label: 'Reviewing first 10 candidates' },
  { value: 'shortlisting', label: 'Shortlisting' },
  { value: 'final_interviews', label: 'Final interviews' },
  { value: 'offer_stage', label: 'Offer stage' }
];

const MICRO_JOB_KIND_OPTIONS: Array<{ value: MicroJobKind; label: string }> = [
  { value: 'one_off_task', label: 'One-off task' },
  { value: 'short_project', label: 'Short project' },
  { value: 'audit_review', label: 'Audit / review' },
  { value: 'prototype', label: 'Prototype' },
  { value: 'experiment', label: 'Experiment' }
];

const MICRO_JOB_COLLABORATION_OPTIONS: Array<{ value: MicroJobCollaborationMode; label: string }> = [
  { value: 'remote', label: 'Remote' },
  { value: 'async', label: 'Async' },
  { value: 'call', label: 'Call' }
];

const normalizeHiringStage = (value: unknown): JobHiringStage | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'collecting_cvs' ||
    normalized === 'reviewing_first_10' ||
    normalized === 'shortlisting' ||
    normalized === 'final_interviews' ||
    normalized === 'offer_stage'
  ) {
    return normalized as JobHiringStage;
  }
  return null;
};

const normalizeChallengeFormat = (value: unknown): JobChallengeFormat => {
  if (typeof value !== 'string') return 'standard';
  return value.trim().toLowerCase() === 'micro_job' ? 'micro_job' : 'standard';
};

const normalizeMicroJobKind = (value: unknown): MicroJobKind | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'one_off_task' ||
    normalized === 'short_project' ||
    normalized === 'audit_review' ||
    normalized === 'prototype' ||
    normalized === 'experiment'
  ) {
    return normalized as MicroJobKind;
  }
  return null;
};

const normalizeMicroJobCollaborationModes = (value: unknown): MicroJobCollaborationMode[] => {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const seen = new Set<MicroJobCollaborationMode>();
  const normalized: MicroJobCollaborationMode[] = [];

  source.forEach((item) => {
    const next = String(item || '').trim().toLowerCase();
    if (next === 'remote' || next === 'async' || next === 'call') {
      const mode = next as MicroJobCollaborationMode;
      if (!seen.has(mode)) {
        seen.add(mode);
        normalized.push(mode);
      }
    }
  });

  return normalized;
};

const normalizeMicroJobLongTermPotential = (value: unknown): MicroJobLongTermPotential | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'yes' || normalized === 'maybe' || normalized === 'no') {
    return normalized as MicroJobLongTermPotential;
  }
  return null;
};

const trimText = (value: unknown, limit = 240): string => String(value ?? '').trim().slice(0, limit);

const normalizeMicroJobState = (value: unknown): MicroJobEditorState => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    challenge_format: normalizeChallengeFormat(source.challenge_format),
    kind: normalizeMicroJobKind(source.kind),
    time_estimate: trimText(source.time_estimate, 80),
    collaboration_modes: normalizeMicroJobCollaborationModes(source.collaboration_modes),
    long_term_potential: normalizeMicroJobLongTermPotential(source.long_term_potential)
  };
};

const createEmptyMicroJobState = (): MicroJobEditorState => ({
  challenge_format: 'standard',
  kind: null,
  time_estimate: '',
  collaboration_modes: [],
  long_term_potential: null
});

const normalizeHumanContextPerson = (
  value: unknown,
  personKind: 'publisher' | 'responder'
): JobPublicPerson | null => {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const userId = trimText(source.user_id ?? source.person_id, 120);
  if (!userId) return null;
  return {
    user_id: userId,
    person_kind: personKind,
    display_name: trimText(source.display_name, 120),
    display_role: trimText(source.display_role, 120),
    avatar_url: trimText(source.avatar_url, 500) || null,
    short_context: trimText(source.short_context, 280) || null,
    display_order: typeof source.display_order === 'number' ? source.display_order : undefined
  };
};

const normalizeHumanContextState = (value: unknown): HumanContextEditorState => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const publisher = normalizeHumanContextPerson(source.publisher, 'publisher');
  const responders: JobPublicPerson[] = [];
  const usedIds = new Set<string>(publisher?.user_id ? [publisher.user_id] : []);
  const rawResponders = Array.isArray(source.responders) ? source.responders : [];

  rawResponders.forEach((item) => {
    const responder = normalizeHumanContextPerson(item, 'responder');
    const userId = responder?.user_id || '';
    if (!responder || !userId || usedIds.has(userId) || responders.length >= MAX_HUMAN_CONTEXT_RESPONDERS) return;
    usedIds.add(userId);
    responders.push({
      ...responder,
      display_order: responders.length + 1
    });
  });

  return {
    publisher,
    responders
  };
};

const createEmptyHumanContext = (): HumanContextEditorState => ({
  publisher: null,
  responders: []
});

const createHumanContextPersonFromOption = (
  option: CompanyHumanContextPersonOption,
  personKind: 'publisher' | 'responder'
): JobPublicPerson => ({
  user_id: option.user_id,
  person_kind: personKind,
  display_name: option.display_name,
  display_role: trimText(option.display_role, 120),
  avatar_url: option.avatar_url || null,
  short_context: trimText(option.short_context, 280) || null
});

const buildLocalHumanContextPeople = (companyProfile: CompanyProfile): CompanyHumanContextPersonOption[] => {
  const seen = new Set<string>();
  return ensureArray(companyProfile.members).flatMap((member) => {
    const userId = trimText(member.userId, 120);
    if (!userId || seen.has(userId)) return [];
    seen.add(userId);
    return [{
      user_id: userId,
      display_name: trimText(member.name || member.email, 120) || 'Team member',
      avatar_url: trimText(member.avatar, 500) || null,
      email: trimText(member.email, 180) || null,
      display_role: trimText(member.companyRole, 120) || null,
      short_context: trimText(member.teamBio, 280) || null
    }];
  });
};

const hydrateHumanContextPerson = (
  person: JobPublicPerson | null,
  peopleById: Map<string, CompanyHumanContextPersonOption>
): JobPublicPerson | null => {
  if (!person) return null;
  const fallback = person.user_id ? peopleById.get(person.user_id) : undefined;
  return {
    ...person,
    display_name: person.display_name || fallback?.display_name || fallback?.email || 'Team member',
    avatar_url: person.avatar_url || fallback?.avatar_url || null,
    short_context: person.short_context || fallback?.short_context || null,
    display_role: person.display_role || fallback?.display_role || ''
  };
};

const getDraftHumanContext = (
  draft: JobDraft | null,
  peopleById: Map<string, CompanyHumanContextPersonOption>
): HumanContextEditorState => {
  const editorState = ((draft?.editor_state || {}) as Record<string, unknown>);
  const normalized = normalizeHumanContextState(editorState.human_context);
  return {
    publisher: hydrateHumanContextPerson(normalized.publisher, peopleById),
    responders: normalized.responders.map((person, index) => ({
      ...hydrateHumanContextPerson(person, peopleById)!,
      display_order: index + 1
    }))
  };
};

const initialsFromName = (value: string): string => {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return 'JS';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};

const extractHandshakeFields = (draft: Partial<JobDraft> | null | undefined): Record<JobDraftHandshakeField, string> => {
  const editorState = ((draft?.editor_state || {}) as Record<string, unknown>);
  const handshake = ((editorState.handshake || {}) as Record<string, unknown>);
  return {
    first_reply_prompt: String(draft?.first_reply_prompt ?? handshake.first_reply_prompt ?? '').trim(),
    company_truth_hard: String(draft?.company_truth_hard ?? handshake.company_truth_hard ?? '').trim(),
    company_truth_fail: String(draft?.company_truth_fail ?? handshake.company_truth_fail ?? '').trim(),
    company_goal: String(draft?.company_goal ?? handshake['company_goal'] ?? '').trim(),
  };
};

const extractMicroJobState = (draft: Partial<JobDraft> | null | undefined): MicroJobEditorState => {
  const editorState = ((draft?.editor_state || {}) as Record<string, unknown>);
  return normalizeMicroJobState(editorState.micro_job);
};

const toDraftInput = (draft: JobDraft) => {
  const handshake = extractHandshakeFields(draft);
  const humanContext = normalizeHumanContextState(((draft.editor_state || {}) as Record<string, unknown>).human_context);
  const microJob = extractMicroJobState(draft);
  const isMicroJob = microJob.challenge_format === 'micro_job';
  return {
    status: draft.status,
    title: draft.title,
    role_summary: draft.role_summary,
    team_intro: draft.team_intro,
    responsibilities: draft.responsibilities,
    requirements: draft.requirements,
    nice_to_have: draft.nice_to_have,
    benefits_structured: isMicroJob ? [] : (draft.benefits_structured || []),
    salary_from: draft.salary_from ?? null,
    salary_to: draft.salary_to ?? null,
    salary_currency: draft.salary_currency,
    salary_timeframe: microJob.challenge_format === 'micro_job'
      ? 'project_total'
      : draft.salary_timeframe,
    contract_type: isMicroJob ? null : (draft.contract_type || null),
    work_model: draft.work_model || null,
    workplace_address: draft.workplace_address || null,
    location_public: draft.location_public || null,
    application_instructions: draft.application_instructions,
    contact_email: draft.contact_email || null,
    quality_report: draft.quality_report || null,
    ai_suggestions: draft.ai_suggestions || null,
    editor_state: {
      ...((draft.editor_state || {}) as Record<string, unknown>),
      selected_section: ((draft.editor_state || {}) as Record<string, unknown>).selected_section || 'role_summary',
      hiring_stage: normalizeHiringStage(draft.hiring_stage) || DEFAULT_HIRING_STAGE,
      handshake,
      micro_job: microJob,
      human_context: humanContext
    }
  };
};

const composePreviewMarkdown = (
  draft: JobDraft,
  companyName: string,
  labels: {
    untitledRole: string;
    company: string;
    challengeFormat: string;
    challengeFormatStandard: string;
    challengeFormatMicroJob: string;
    microJobType: string;
    microJobTimeEstimate: string;
    microJobCollaboration: string;
    microJobLongTermPotential: string;
    location: string;
    workSetup: string;
    contract: string;
    compensation: string;
    salaryTimeframeFallback: string;
    locationFallback: string;
    roleSummary: string;
    teamIntro: string;
    responsibilities: string;
    requirements: string;
    niceToHave: string;
    goal: string;
    benefits: string;
    applicationDetails: string;
    firstReply: string;
    companyTruthHard: string;
    companyTruthFail: string;
    workSetupOnSite: string;
    workSetupHybrid: string;
    workSetupRemote: string;
    microJobKindValues: Record<MicroJobKind, string>;
    microJobCollaborationValues: Record<MicroJobCollaborationMode, string>;
    microJobLongTermPotentialValues: Record<MicroJobLongTermPotential, string>;
  }
): string => {
  const handshake = extractHandshakeFields(draft);
  const microJob = extractMicroJobState(draft);
  const isMicroJob = microJob.challenge_format === 'micro_job';
  const compensationSuffix = microJob.challenge_format === 'micro_job'
    ? ''
    : ` / ${draft.salary_timeframe || labels.salaryTimeframeFallback}`;
  const microJobCollaboration = microJob.collaboration_modes
    .map((mode) => labels.microJobCollaborationValues[mode] || mode)
    .join(', ');
  const microJobLongTermPotential = microJob.long_term_potential
    ? (labels.microJobLongTermPotentialValues[microJob.long_term_potential] || microJob.long_term_potential)
    : '';
  const normalizedWorkModel = String(draft.work_model || '').trim().toLowerCase();
  const localizedWorkModel =
    normalizedWorkModel === 'on-site' || normalizedWorkModel === 'onsite' || normalizedWorkModel === 'on site'
      ? labels.workSetupOnSite
      : normalizedWorkModel === 'hybrid'
        ? labels.workSetupHybrid
        : normalizedWorkModel === 'remote'
          ? labels.workSetupRemote
          : draft.work_model || '';
  const sections: string[] = [
    `# ${draft.title || labels.untitledRole}`,
    `**${labels.company}:** ${companyName}`,
    `**${labels.challengeFormat}:** ${microJob.challenge_format === 'micro_job' ? labels.challengeFormatMicroJob : labels.challengeFormatStandard}`,
    (draft.location_public || labels.locationFallback) ? `**${labels.location}:** ${draft.location_public || labels.locationFallback}` : '',
    localizedWorkModel ? `**${labels.workSetup}:** ${localizedWorkModel}` : '',
    !isMicroJob && draft.contract_type ? `**${labels.contract}:** ${draft.contract_type}` : '',
    draft.salary_from || draft.salary_to
      ? `**${labels.compensation}:** ${draft.salary_from || '—'} - ${draft.salary_to || '—'} ${draft.salary_currency || 'CZK'}${compensationSuffix}`
      : '',
    microJob.challenge_format === 'micro_job' && microJob.kind ? `**${labels.microJobType}:** ${labels.microJobKindValues[microJob.kind] || microJob.kind.replace(/_/g, ' ')}` : '',
    microJob.challenge_format === 'micro_job' && microJob.time_estimate ? `**${labels.microJobTimeEstimate}:** ${microJob.time_estimate}` : '',
    microJob.challenge_format === 'micro_job' && microJobCollaboration ? `**${labels.microJobCollaboration}:** ${microJobCollaboration}` : '',
    microJob.challenge_format === 'micro_job' && microJobLongTermPotential ? `**${labels.microJobLongTermPotential}:** ${microJobLongTermPotential}` : '',
    draft.role_summary ? `## ${labels.roleSummary}\n${draft.role_summary}` : '',
    !isMicroJob && handshake.company_goal ? `## ${labels.goal}\n${handshake.company_goal}` : '',
    !isMicroJob && draft.team_intro ? `## ${labels.teamIntro}\n${draft.team_intro}` : '',
    draft.responsibilities ? `## ${labels.responsibilities}\n${compactLines(draft.responsibilities).map((line) => `- ${line}`).join('\n')}` : '',
    !isMicroJob && draft.requirements ? `## ${labels.requirements}\n${compactLines(draft.requirements).map((line) => `- ${line}`).join('\n')}` : '',
    !isMicroJob && draft.nice_to_have ? `## ${labels.niceToHave}\n${compactLines(draft.nice_to_have).map((line) => `- ${line}`).join('\n')}` : '',
    handshake.first_reply_prompt ? `## ${labels.firstReply}\n${handshake.first_reply_prompt}` : '',
    !isMicroJob && handshake.company_truth_hard ? `## ${labels.companyTruthHard}\n${handshake.company_truth_hard}` : '',
    !isMicroJob && handshake.company_truth_fail ? `## ${labels.companyTruthFail}\n${handshake.company_truth_fail}` : '',
    !isMicroJob && draft.benefits_structured?.length ? `## ${labels.benefits}\n${draft.benefits_structured.map((line) => `- ${line}`).join('\n')}` : '',
    draft.application_instructions ? `## ${labels.applicationDetails}\n${draft.application_instructions}` : ''
  ];

  return sections.filter(Boolean).join('\n\n');
};

const createBaseDraft = (companyProfile: CompanyProfile, userEmail?: string): Partial<JobDraft> => ({
  title: '',
  company_goal: '',
  first_reply_prompt: '',
  company_truth_hard: '',
  company_truth_fail: '',
  role_summary: '',
  team_intro: '',
  responsibilities: '',
  requirements: '',
  nice_to_have: '',
  benefits_structured: [],
  salary_currency: 'CZK',
  salary_timeframe: 'monthly',
  contract_type: 'HPP',
  work_model: 'On-site',
  workplace_address: companyProfile.address || '',
  location_public: companyProfile.address || '',
  application_instructions: '',
  contact_email: userEmail || '',
  status: 'draft',
  editor_state: {
    selected_section: 'role_summary',
    hiring_stage: DEFAULT_HIRING_STAGE,
    handshake: {
      first_reply_prompt: '',
      company_truth_hard: '',
      company_truth_fail: '',
      company_goal: ''
    },
    micro_job: createEmptyMicroJobState(),
    human_context: createEmptyHumanContext()
  },
  hiring_stage: DEFAULT_HIRING_STAGE
});

const mergeDraftSeed = (
  companyProfile: CompanyProfile,
  userEmail: string | undefined,
  seed?: Partial<JobDraft> | null
): Partial<JobDraft> => {
  const base = createBaseDraft(companyProfile, userEmail);
  if (!seed) return base;
  const baseHandshake = extractHandshakeFields(base);
  const seedHandshake = extractHandshakeFields(seed);
  return {
    ...base,
    ...seed,
    editor_state: {
      ...(base.editor_state || {}),
      ...((seed.editor_state || {}) as Record<string, unknown>),
      handshake: {
        ...baseHandshake,
        ...seedHandshake,
      },
    },
    company_goal: seed.company_goal ?? seedHandshake.company_goal ?? base.company_goal,
    first_reply_prompt: seed.first_reply_prompt ?? seedHandshake.first_reply_prompt ?? base.first_reply_prompt,
    company_truth_hard: seed.company_truth_hard ?? seedHandshake.company_truth_hard ?? base.company_truth_hard,
    company_truth_fail: seed.company_truth_fail ?? seedHandshake.company_truth_fail ?? base.company_truth_fail,
  };
};

const createLocalValidationReport = (
  draft: JobDraft,
  messages: LocalValidationMessages = DEFAULT_LOCAL_VALIDATION_MESSAGES
): JobValidationReport => {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  const title = draft.title.trim();
  const roleSummary = draft.role_summary.trim();
  const requirements = compactLines(draft.requirements);
  const benefits = draft.benefits_structured?.filter(Boolean) || [];
  const hasSalary = typeof draft.salary_from === 'number' || typeof draft.salary_to === 'number';
  const location = (draft.location_public || draft.workplace_address || '').trim();
  const contactEmail = (draft.contact_email || '').trim();
  const handshake = extractHandshakeFields(draft);
  const microJob = extractMicroJobState(draft);
  const isMicroJob = microJob.challenge_format === 'micro_job';

  if (!title) blockingIssues.push(messages.role_title_required);
  if (!roleSummary) blockingIssues.push(messages.role_summary_required);
  if (!isMicroJob && !handshake.company_goal) blockingIssues.push(messages.role_goal_required);
  if (!isMicroJob && !handshake.company_truth_hard) blockingIssues.push(messages.role_truth_hard_required);
  if (!isMicroJob && !handshake.company_truth_fail) blockingIssues.push(messages.role_truth_fail_required);
  if (isMicroJob && !microJob.kind) blockingIssues.push(messages.micro_job_kind_required);
  if (isMicroJob && !microJob.time_estimate) blockingIssues.push(messages.micro_job_time_required);
  if (isMicroJob && microJob.collaboration_modes.length === 0) blockingIssues.push(messages.micro_job_collaboration_required);
  if (isMicroJob && !hasSalary) {
    blockingIssues.push(messages.micro_job_budget_required);
  } else if (!hasSalary) {
    warnings.push(messages.salary_visible_required);
  }
  if (!location) warnings.push(messages.location_required);
  if (!contactEmail && !draft.application_instructions.trim()) blockingIssues.push(messages.application_destination_required);
  if (!isMicroJob && requirements.length < 2) warnings.push(messages.requirements_thin);
  if (!isMicroJob && benefits.length === 0) warnings.push(messages.benefits_required);
  if (!handshake.first_reply_prompt) warnings.push(messages.first_reply_prompt_required);
  if (roleSummary.length < 120) suggestions.push(messages.role_summary_expand);
  if (!isMicroJob && benefits.some((item) => /competitive|great culture|dynamic/i.test(item))) {
    suggestions.push(messages.vague_benefits_replace);
  }

  const transparencyBase = 100 - (blockingIssues.length * 18) - (warnings.length * 8);
  const clarityBase = 100 - (blockingIssues.length * 15) - (warnings.length * 6) - (suggestions.length * 4);

  return {
    blockingIssues,
    warnings,
    suggestions,
    transparencyScore: Math.max(0, Math.min(100, transparencyBase)),
    clarityScore: Math.max(0, Math.min(100, clarityBase))
  };
};

const createLocalDraftRecord = (
  companyProfile: CompanyProfile,
  userEmail: string | undefined,
  seed?: Partial<JobDraft>
): JobDraft => {
  const now = new Date().toISOString();
  const base = createBaseDraft(companyProfile, userEmail);
  return {
    ...base,
    ...seed,
    id: seed?.id || `local-${crypto.randomUUID()}`,
    company_id: seed?.company_id || companyProfile.id || 'local',
    status: seed?.status || 'draft',
    title: seed?.title ?? '',
    first_reply_prompt: extractHandshakeFields(seed).first_reply_prompt,
    company_truth_hard: extractHandshakeFields(seed).company_truth_hard,
    company_truth_fail: extractHandshakeFields(seed).company_truth_fail,
    role_summary: seed?.role_summary ?? '',
    team_intro: seed?.team_intro ?? '',
    responsibilities: seed?.responsibilities ?? '',
    requirements: seed?.requirements ?? '',
    nice_to_have: seed?.nice_to_have ?? '',
    benefits_structured: seed?.benefits_structured || [],
    salary_currency: seed?.salary_currency || 'CZK',
    salary_timeframe: seed?.salary_timeframe || 'monthly',
    application_instructions: seed?.application_instructions ?? '',
    hiring_stage: normalizeHiringStage(seed?.hiring_stage) || DEFAULT_HIRING_STAGE,
    created_at: seed?.created_at || now,
    updated_at: now,
  } as JobDraft;
};

const normalizeDraft = (draft: JobDraft): JobDraft => {
  const editorState = ((draft.editor_state || {}) as Record<string, unknown>);
  const hiringStage = normalizeHiringStage(draft.hiring_stage ?? editorState.hiring_stage) || DEFAULT_HIRING_STAGE;
  const handshake = extractHandshakeFields(draft);
  const microJob = normalizeMicroJobState(editorState.micro_job);
  const humanContext = normalizeHumanContextState(editorState.human_context);

  return {
    ...draft,
    ...handshake,
    hiring_stage: hiringStage,
    salary_timeframe: microJob.challenge_format === 'micro_job'
      ? (draft.salary_timeframe || 'project_total')
      : (draft.salary_timeframe || 'monthly'),
    benefits_structured: ensureArray(draft.benefits_structured),
    quality_report: normalizeValidationReport(draft.quality_report),
    editor_state: {
      ...editorState,
      selected_section: editorState.selected_section || 'role_summary',
      hiring_stage: hiringStage,
      handshake,
      micro_job: microJob,
      human_context: humanContext
    }
  };
};

const normalizeDraftRows = (rows: JobDraft[] | null | undefined): JobDraft[] =>
  ensureArray(rows).map(normalizeDraft);

const normalizeVersionRows = (rows: JobVersion[] | null | undefined): JobVersion[] =>
  ensureArray(rows);

const createLocalDraftFromJob = (
  job: Job,
  companyProfile: CompanyProfile,
  userEmail?: string
): JobDraft => createLocalDraftRecord(companyProfile, userEmail, {
  job_id: job.id,
  status: 'published_linked',
  title: job.title || '',
  company_goal: job.companyGoal || '',
  role_summary: job.description || '',
  responsibilities: '',
  requirements: '',
  nice_to_have: '',
  benefits_structured: Array.isArray(job.benefits) ? job.benefits : [],
  salary_from: job.salary_from ?? null,
  salary_to: job.salary_to ?? null,
  salary_currency: 'CZK',
  salary_timeframe: job.salary_timeframe || (job.challenge_format === 'micro_job' ? 'project_total' : 'monthly'),
  contract_type: null,
  work_model: job.work_model || job.type || null,
  workplace_address: job.location || '',
  location_public: job.location || '',
  application_instructions: '',
  contact_email: userEmail || '',
  hiring_stage: job.hiring_stage || DEFAULT_HIRING_STAGE,
  editor_state: {
    selected_section: 'role_summary',
    hiring_stage: job.hiring_stage || DEFAULT_HIRING_STAGE,
    handshake: {
      first_reply_prompt: '',
      company_truth_hard: '',
      company_truth_fail: '',
      company_goal: ''
    },
    micro_job: {
      challenge_format: job.challenge_format || 'standard',
      kind: job.micro_job_kind || null,
      time_estimate: job.micro_job_time_estimate || '',
      collaboration_modes: job.micro_job_collaboration_modes || [],
      long_term_potential: job.micro_job_long_term_potential || null
    },
    human_context: createEmptyHumanContext()
  }
});

const CompanyJobEditor: React.FC<CompanyJobEditorProps> = ({
  companyProfile,
  jobs,
  userEmail,
  seedJobId,
  createDraftSignal = 0,
  draftSeedPayload,
  onDraftSeedConsumed,
  onSeedConsumed,
  onJobLifecycleChange
}) => {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<JobDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [draft, setDraft] = useState<JobDraft | null>(null);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [versions, setVersions] = useState<JobVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');
  const [previewMode, setPreviewMode] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [schemaStatus, setSchemaStatus] = useState<CompanySchemaRolloutStatus | null>(null);
  const [usesLocalFallback, setUsesLocalFallback] = useState(false);
  const [highlightedDraftId, setHighlightedDraftId] = useState<string | null>(null);
  const [optimizingSection, setOptimizingSection] = useState<JobDraftTextSection | null>(null);
  const [pendingAiSection, setPendingAiSection] = useState<JobDraftTextSection | null>(null);
  const [pendingAiResult, setPendingAiResult] = useState<{ rewrittenText: string; removedCliches: string[]; improvedClarity: string } | null>(null);
  const [humanContextPeople, setHumanContextPeople] = useState<CompanyHumanContextPersonOption[]>([]);
  const [loadingHumanContextPeople, setLoadingHumanContextPeople] = useState(false);
  const lastHandledCreateDraftSignal = useRef(0);
  const highlightResetTimer = useRef<number | null>(null);
  const fallbackHumanContextPeople = useMemo(() => buildLocalHumanContextPeople(companyProfile), [companyProfile]);
  const humanContextPeopleById = useMemo(
    () => new Map(humanContextPeople.map((person) => [person.user_id, person])),
    [humanContextPeople]
  );
  const humanContextState = useMemo(
    () => getDraftHumanContext(draft, humanContextPeopleById),
    [draft, humanContextPeopleById]
  );
  const microJobState = useMemo(
    () => extractMicroJobState(draft),
    [draft]
  );
  const isMicroJobDraft = microJobState.challenge_format === 'micro_job';
  const visibleTextSections = useMemo(
    () => (isMicroJobDraft ? MICRO_JOB_TEXT_SECTIONS : TEXT_SECTIONS),
    [isMicroJobDraft]
  );

  const linkedJob = useMemo(
    () => jobs.find((item) => draft?.job_id != null && String(item.id) === String(draft.job_id)) || null,
    [jobs, draft?.job_id]
  );

  const validation = normalizeValidationReport(draft?.quality_report || DEFAULT_VALIDATION);
  const activeSection = (draft?.editor_state?.selected_section as JobDraftTextSection | undefined) || 'role_summary';
  const localDraftStorageKey = useMemo(() => getLocalDraftStorageKey(companyProfile.id), [companyProfile.id]);
  const localVersionStorageKey = useMemo(() => getLocalVersionStorageKey(companyProfile.id), [companyProfile.id]);
  const validationMessages = useMemo<LocalValidationMessages>(() => ({
    role_title_required: t('company.job_editor.validation_role_title_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.role_title_required }),
    role_summary_required: t('company.job_editor.validation_role_summary_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.role_summary_required }),
    role_goal_required: t('company.job_editor.validation_role_goal_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.role_goal_required }),
    role_truth_hard_required: t('company.job_editor.validation_role_truth_hard_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.role_truth_hard_required }),
    role_truth_fail_required: t('company.job_editor.validation_role_truth_fail_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.role_truth_fail_required }),
    micro_job_kind_required: t('company.job_editor.validation_micro_job_kind_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.micro_job_kind_required }),
    micro_job_time_required: t('company.job_editor.validation_micro_job_time_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.micro_job_time_required }),
    micro_job_budget_required: t('company.job_editor.validation_micro_job_budget_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.micro_job_budget_required }),
    micro_job_collaboration_required: t('company.job_editor.validation_micro_job_collaboration_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.micro_job_collaboration_required }),
    salary_visible_required: t('company.job_editor.validation_salary_visible_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.salary_visible_required }),
    location_required: t('company.job_editor.validation_location_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.location_required }),
    application_destination_required: t('company.job_editor.validation_application_destination_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.application_destination_required }),
    requirements_thin: t('company.job_editor.validation_requirements_thin', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.requirements_thin }),
    benefits_required: t('company.job_editor.validation_benefits_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.benefits_required }),
    first_reply_prompt_required: t('company.job_editor.validation_first_reply_prompt_required', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.first_reply_prompt_required }),
    role_summary_expand: t('company.job_editor.validation_role_summary_expand', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.role_summary_expand }),
    vague_benefits_replace: t('company.job_editor.validation_vague_benefits_replace', { defaultValue: DEFAULT_LOCAL_VALIDATION_MESSAGES.vague_benefits_replace }),
  }), [t]);

  const getLifecycleStatusLabel = (status: 'active' | 'paused' | 'closed' | 'archived') => (
    t(`company.job_editor.lifecycle_status.${status}`, { defaultValue: status })
  );

  const getValidationStatusMessage = (blockingIssuesCount: number) => (
    blockingIssuesCount === 0
      ? t('company.job_editor.feedback.validation_ready', { defaultValue: 'Draft is ready to publish.' })
      : t('company.job_editor.feedback.validation_blocking', { defaultValue: 'Validation finished. Fix blocking issues before publishing.' })
  );

  const loadLocalDrafts = (): JobDraft[] => {
    const rows = normalizeDraftRows(readLocalJson<JobDraft[]>(localDraftStorageKey, []));
    return rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  };

  const persistLocalDrafts = (rows: JobDraft[]) => {
    writeLocalJson(localDraftStorageKey, rows);
  };

  const upsertLocalDraft = (next: JobDraft) => {
    const nextRows = [next, ...loadLocalDrafts().filter((item) => item.id !== next.id)];
    persistLocalDrafts(nextRows);
    return nextRows;
  };

  const loadLocalVersions = (): JobVersion[] => readLocalJson<JobVersion[]>(localVersionStorageKey, []);

  useEffect(() => {
    let active = true;
    const loadSchemaStatus = async () => {
      try {
        const status = await fetchCompanySchemaRolloutStatus();
        if (!active) return;
        setSchemaStatus(status);
      } catch {
        if (active) setSchemaStatus(null);
      }
    };
    loadSchemaStatus();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadHumanContextPeople = async () => {
      if (!companyProfile.id || usesLocalFallback) {
        setHumanContextPeople(fallbackHumanContextPeople);
        return;
      }
      setLoadingHumanContextPeople(true);
      try {
        const rows = await fetchCompanyHumanContextPeople();
        if (!active) return;
        setHumanContextPeople(rows.length > 0 ? rows : fallbackHumanContextPeople);
      } catch (error) {
        console.error('Failed to load company human context people:', error);
        if (active) setHumanContextPeople(fallbackHumanContextPeople);
      } finally {
        if (active) setLoadingHumanContextPeople(false);
      }
    };
    void loadHumanContextPeople();
    return () => {
      active = false;
    };
  }, [companyProfile.id, fallbackHumanContextPeople, usesLocalFallback]);

  useEffect(() => {
    let active = true;
    const loadDrafts = async () => {
      setLoadingDrafts(true);
      try {
        const items = normalizeDraftRows(await listCompanyJobDrafts());
        if (!active) return;
        setDrafts(items);
        if (!selectedDraftId && items[0]) {
          setSelectedDraftId(items[0].id);
          setDraft(items[0]);
        }
      } catch (error) {
        if (isMissingFeatureError(error)) {
          const localDrafts = loadLocalDrafts();
          if (!active) return;
          setUsesLocalFallback(true);
          setDrafts(localDrafts);
          if (!selectedDraftId && localDrafts[0]) {
            setSelectedDraftId(localDrafts[0].id);
            setDraft(localDrafts[0]);
          }
          setStatusMessage(t('company.job_editor.feedback.compatibility_mode_api_unavailable', { defaultValue: 'Structured draft API is not available on this backend yet. Using local compatibility mode.' }));
        } else {
          console.error('Failed to load company drafts:', error);
          if (active) setErrorMessage(t('company.job_editor.feedback.load_drafts_failed', { defaultValue: 'Unable to load drafts right now.' }));
        }
      } finally {
        if (active) setLoadingDrafts(false);
      }
    };
    loadDrafts();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!draft?.job_id) {
      setVersions([]);
      return;
    }
    if (usesLocalFallback) {
      const localRows = loadLocalVersions().filter((item) => String(item.job_id) === String(draft.job_id));
      setVersions(localRows.sort((a, b) => b.version_number - a.version_number));
      return;
    }
    let active = true;
    const loadVersions = async () => {
      setVersionsLoading(true);
      try {
        const rows = normalizeVersionRows(await listRoleVersions(draft.job_id as string | number));
        if (!active) return;
        setVersions(rows);
      } catch (error) {
        console.error('Failed to load job versions:', error);
        if (active) setVersions([]);
      } finally {
        if (active) setVersionsLoading(false);
      }
    };
    loadVersions();
    return () => {
      active = false;
    };
  }, [draft?.job_id, usesLocalFallback]);

  useEffect(() => {
    if (!seedJobId) return;
    let active = true;
    const openSeedDraft = async () => {
      try {
        const nextDraft = normalizeDraft(await createEditDraftFromRole(seedJobId));
        if (!active) return;
        setDrafts((prev) => {
          const withoutDuplicate = prev.filter((item) => item.id !== nextDraft.id);
          return [nextDraft, ...withoutDuplicate];
        });
        setSelectedDraftId(nextDraft.id);
        setDraft(nextDraft);
        setStatusMessage(t('company.job_editor.feedback.edit_draft_opened', { defaultValue: 'Opened a safe edit draft for the selected job.' }));
      } catch (error) {
        if (isMissingFeatureError(error)) {
          const job = jobs.find((item) => String(item.id) === String(seedJobId));
          if (!job || !active) return;
          const nextDraft = normalizeDraft(createLocalDraftFromJob(job, companyProfile, userEmail));
          setUsesLocalFallback(true);
          upsertLocalDraft(nextDraft);
          setDrafts((prev) => [nextDraft, ...prev.filter((item) => item.id !== nextDraft.id)]);
          setSelectedDraftId(nextDraft.id);
          setDraft(nextDraft);
          setStatusMessage(t('company.job_editor.feedback.edit_draft_opened_local', { defaultValue: 'Opened a local compatibility draft for this job.' }));
        } else {
          console.error('Failed to create edit draft:', error);
          if (active) setErrorMessage(t('company.job_editor.feedback.edit_draft_open_failed', { defaultValue: 'Unable to open an edit draft for this role.' }));
        }
      } finally {
        if (active) onSeedConsumed?.();
      }
    };
    openSeedDraft();
    return () => {
      active = false;
    };
  }, [seedJobId, onSeedConsumed, jobs, companyProfile, userEmail]);

  const updateDraft = (next: JobDraft) => {
    const normalized = normalizeDraft(next);
    setDraft(normalized);
    setSelectedDraftId(normalized.id);
    setDrafts((prev) => [normalized, ...prev.filter((item) => item.id !== normalized.id)]);
    if (usesLocalFallback || String(normalized.id).startsWith('local-')) {
      upsertLocalDraft(normalized);
    }
  };

  const flashDraftHighlight = (draftId: string) => {
    setHighlightedDraftId(draftId);
    if (highlightResetTimer.current) {
      window.clearTimeout(highlightResetTimer.current);
    }
    highlightResetTimer.current = window.setTimeout(() => {
      setHighlightedDraftId((current) => (current === draftId ? null : current));
      highlightResetTimer.current = null;
    }, 2500);
  };

  const handleCreateDraft = async (seed?: Partial<JobDraft> | null) => {
    setErrorMessage(null);
    setStatusMessage(null);
    setSaving(true);
    const draftInput = mergeDraftSeed(companyProfile, userEmail, seed);
    try {
      if (usesLocalFallback) {
        const created = normalizeDraft(createLocalDraftRecord(companyProfile, userEmail, draftInput));
        updateDraft(created);
        flashDraftHighlight(created.id);
        setStatusMessage(t('company.job_editor.feedback.draft_created_local', { defaultValue: 'Draft created in local compatibility mode.' }));
        return;
      }
      const created = normalizeDraft(await createCompanyJobDraft(draftInput));
      updateDraft(created);
      flashDraftHighlight(created.id);
      setStatusMessage(t('company.job_editor.feedback.draft_created', { defaultValue: 'Draft created. You can save partial progress at any time.' }));
    } catch (error) {
      if (isMissingFeatureError(error)) {
        setUsesLocalFallback(true);
        const created = normalizeDraft(createLocalDraftRecord(companyProfile, userEmail, draftInput));
        updateDraft(created);
        flashDraftHighlight(created.id);
        setStatusMessage(t('company.job_editor.feedback.draft_created_local_fallback', { defaultValue: 'Draft API is not available here yet. Created a local compatibility draft instead.' }));
      } else {
        console.error('Failed to create job draft:', error);
        setErrorMessage(t('company.job_editor.feedback.draft_create_failed', { defaultValue: 'Draft creation failed. Please try again.' }));
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!createDraftSignal || createDraftSignal === lastHandledCreateDraftSignal.current) return;
    lastHandledCreateDraftSignal.current = createDraftSignal;
    void handleCreateDraft(draftSeedPayload);
    onDraftSeedConsumed?.();
  }, [createDraftSignal, draftSeedPayload, onDraftSeedConsumed]);

  useEffect(() => {
    return () => {
      if (highlightResetTimer.current) {
        window.clearTimeout(highlightResetTimer.current);
      }
    };
  }, []);

  const handleSelectDraft = (nextDraft: JobDraft) => {
    const normalized = normalizeDraft(nextDraft);
    setDraft(normalized);
    setSelectedDraftId(normalized.id);
    setPendingAiResult(null);
    setPendingAiSection(null);
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const patchDraft = (changes: Partial<JobDraft>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...changes,
        updated_at: new Date().toISOString()
      };
    });
  };

  const patchHumanContext = (nextHumanContext: HumanContextEditorState) => {
    if (!draft) return;
    patchDraft({
      editor_state: {
        ...(draft.editor_state || {}),
        human_context: normalizeHumanContextState(nextHumanContext)
      }
    });
  };

  const patchMicroJobState = (changes: Partial<MicroJobEditorState>) => {
    if (!draft) return;
    const nextState = normalizeMicroJobState({
      ...extractMicroJobState(draft),
      ...changes
    });
    patchDraft({
      contract_type: nextState.challenge_format === 'micro_job' ? '' : draft.contract_type,
      salary_timeframe: nextState.challenge_format === 'micro_job' ? 'project_total' : 'monthly',
      editor_state: {
        ...(draft.editor_state || {}),
        micro_job: nextState
      }
    });
  };

  const toggleMicroJobCollaboration = (mode: MicroJobCollaborationMode) => {
    const nextModes = microJobState.collaboration_modes.includes(mode)
      ? microJobState.collaboration_modes.filter((item) => item !== mode)
      : [...microJobState.collaboration_modes, mode];
    patchMicroJobState({ collaboration_modes: nextModes });
  };

  const handlePublisherChange = (userId: string) => {
    if (!userId) {
      patchHumanContext({
        ...humanContextState,
        publisher: null
      });
      return;
    }
    const option = humanContextPeopleById.get(userId);
    if (!option) return;
    const nextPublisher = createHumanContextPersonFromOption(option, 'publisher');
    patchHumanContext({
      publisher: nextPublisher,
      responders: humanContextState.responders.filter((person) => person.user_id !== userId)
    });
  };

  const handlePublisherFieldChange = (field: 'display_name' | 'display_role' | 'short_context') => (
    value: string
  ) => {
    if (!humanContextState.publisher) return;
    patchHumanContext({
      ...humanContextState,
      publisher: {
        ...humanContextState.publisher,
        [field]: value
      }
    });
  };

  const handleResponderChange = (index: number, userId: string) => {
    const nextResponders = [...humanContextState.responders];
    if (!userId) {
      nextResponders.splice(index, 1);
      patchHumanContext({
        ...humanContextState,
        responders: nextResponders
      });
      return;
    }
    const option = humanContextPeopleById.get(userId);
    if (!option) return;
    nextResponders[index] = createHumanContextPersonFromOption(option, 'responder');
    patchHumanContext({
      publisher: humanContextState.publisher?.user_id === userId ? null : humanContextState.publisher,
      responders: nextResponders
    });
  };

  const handleResponderFieldChange = (
    index: number,
    field: 'display_name' | 'display_role' | 'short_context',
    value: string
  ) => {
    const nextResponders = humanContextState.responders.map((person, responderIndex) => (
      responderIndex === index
        ? {
            ...person,
            [field]: value
          }
        : person
    ));
    patchHumanContext({
      ...humanContextState,
      responders: nextResponders
    });
  };

  const handleAddResponder = () => {
    if (humanContextState.responders.length >= MAX_HUMAN_CONTEXT_RESPONDERS) return;
    const nextOption = humanContextPeople.find((person) => (
      person.user_id !== humanContextState.publisher?.user_id &&
      !humanContextState.responders.some((responder) => responder.user_id === person.user_id)
    )) || humanContextPeople[0];
    if (!nextOption) return;
    patchHumanContext({
      ...humanContextState,
      responders: [
        ...humanContextState.responders,
        createHumanContextPersonFromOption(nextOption, 'responder')
      ]
    });
  };

  const handleRemoveResponder = (index: number) => {
    patchHumanContext({
      ...humanContextState,
      responders: humanContextState.responders.filter((_, responderIndex) => responderIndex !== index)
    });
  };

  const handleSaveDraft = async () => {
    if (!draft?.id) return;
    setErrorMessage(null);
    setStatusMessage(null);
    setSaving(true);
    try {
      if (usesLocalFallback) {
        const saved = {
          ...draft,
          quality_report: draft.quality_report || createLocalValidationReport(draft, validationMessages),
          updated_at: new Date().toISOString()
        };
        updateDraft(saved);
        setStatusMessage(t('company.job_editor.feedback.draft_saved_local', { defaultValue: 'Draft saved locally.' }));
        return;
      }
      const saved = await updateCompanyJobDraft(draft.id, toDraftInput(draft));
      updateDraft(saved);
      setStatusMessage(t('company.job_editor.feedback.draft_saved', { defaultValue: 'Draft saved.' }));
    } catch (error) {
      if (isMissingFeatureError(error)) {
        setUsesLocalFallback(true);
        const saved = {
          ...draft,
          quality_report: draft.quality_report || createLocalValidationReport(draft, validationMessages),
          updated_at: new Date().toISOString()
        };
        updateDraft(saved);
        setStatusMessage(t('company.job_editor.feedback.draft_saved_local_fallback', { defaultValue: 'Draft API unavailable. Changes were saved locally.' }));
      } else {
        console.error('Failed to save job draft:', error);
        setErrorMessage(t('company.job_editor.feedback.draft_save_failed', { defaultValue: 'Saving failed. Your local changes are still visible, but not yet persisted.' }));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleValidateDraft = async () => {
    if (!draft?.id) return;
    setErrorMessage(null);
    setStatusMessage(null);
    setValidating(true);
    try {
      if (usesLocalFallback) {
        const report = createLocalValidationReport(draft, validationMessages);
        const saved: JobDraft = {
          ...draft,
          quality_report: report,
          status: report.blockingIssues.length === 0 ? 'ready_for_publish' : 'draft',
          updated_at: new Date().toISOString()
        };
        updateDraft(saved);
        setStatusMessage(getValidationStatusMessage(report.blockingIssues.length));
        return;
      }
      const report = await validateCompanyJobDraft(draft.id);
      const saved = await updateCompanyJobDraft(draft.id, {
        ...toDraftInput(draft),
        quality_report: report,
        status: report.blockingIssues.length === 0 ? 'ready_for_publish' : 'draft'
      });
      updateDraft(saved);
      setStatusMessage(getValidationStatusMessage(report.blockingIssues.length));
    } catch (error) {
      if (isMissingFeatureError(error)) {
        setUsesLocalFallback(true);
        const report = createLocalValidationReport(draft, validationMessages);
        const saved: JobDraft = {
          ...draft,
          quality_report: report,
          status: report.blockingIssues.length === 0 ? 'ready_for_publish' : 'draft',
          updated_at: new Date().toISOString()
        };
        updateDraft(saved);
        setStatusMessage(getValidationStatusMessage(report.blockingIssues.length));
      } else {
        console.error('Failed to validate draft:', error);
        setErrorMessage(t('company.job_editor.feedback.validation_failed', { defaultValue: 'Validation failed. Please try again.' }));
      }
    } finally {
      setValidating(false);
    }
  };

  const handleOptimizeSection = async (section: JobDraftTextSection) => {
    if (!draft) return;
    const currentValue = draft[section] || '';
    if (!currentValue.trim()) return;
    setOptimizingSection(section);
    setPendingAiResult(null);
    setPendingAiSection(null);
    setErrorMessage(null);
    try {
      const result = await optimizeJobDescription(currentValue, companyProfile);
      setPendingAiSection(section);
      setPendingAiResult(result);
    } catch (error) {
      console.error('Failed to optimize section:', error);
      setErrorMessage(t('company.job_editor.feedback.ai_failed', { defaultValue: 'AI suggestion failed. Please try again.' }));
    } finally {
      setOptimizingSection(null);
    }
  };

  const applyAiSuggestion = () => {
    if (!draft || !pendingAiSection || !pendingAiResult) return;
    const nextAiSuggestions = {
      ...(draft.ai_suggestions || {}),
      [pendingAiSection]: {
        improvedClarity: pendingAiResult.improvedClarity,
        removedCliches: pendingAiResult.removedCliches
      }
    };
    patchDraft({
      [pendingAiSection]: pendingAiResult.rewrittenText,
      ai_suggestions: nextAiSuggestions
    } as Partial<JobDraft>);
    setPendingAiResult(null);
    setPendingAiSection(null);
    setStatusMessage(t('company.job_editor.feedback.ai_applied', { defaultValue: 'AI suggestion applied to the selected section.' }));
  };

  const dismissAiSuggestion = () => {
    setPendingAiResult(null);
    setPendingAiSection(null);
  };

  const handlePublishDraft = async () => {
    if (!draft?.id) return;
    setErrorMessage(null);
    setStatusMessage(null);
    setPublishing(true);
    try {
      let nextDraft = draft;
      if (usesLocalFallback) {
        const report = createLocalValidationReport(nextDraft, validationMessages);
        nextDraft = {
          ...nextDraft,
          quality_report: report,
          status: report.blockingIssues.length === 0 ? 'ready_for_publish' : 'draft',
          updated_at: new Date().toISOString()
        };
        updateDraft(nextDraft);
        if (report.blockingIssues.length > 0) {
          setErrorMessage(t('company.job_editor.feedback.publish_blocking', { defaultValue: 'This draft still has blocking issues. Review the validation panel before publishing.' }));
          setPublishing(false);
          return;
        }
        setErrorMessage(t('company.job_editor.feedback.publish_api_required', { defaultValue: 'Publishing now requires the backend role API. This local compatibility draft can stay saved, but it cannot publish directly into the old jobs table anymore.' }));
        return;
      }

      if (!draft.quality_report || normalizeValidationReport(draft.quality_report).blockingIssues.length > 0) {
        const report = await validateCompanyJobDraft(draft.id);
        nextDraft = await updateCompanyJobDraft(draft.id, {
          ...toDraftInput(draft),
          quality_report: report,
          status: report.blockingIssues.length === 0 ? 'ready_for_publish' : 'draft'
        });
        updateDraft(nextDraft);
        if (report.blockingIssues.length > 0) {
          setErrorMessage(t('company.job_editor.feedback.publish_blocking', { defaultValue: 'This draft still has blocking issues. Review the validation panel before publishing.' }));
          setPublishing(false);
          return;
        }
      }

      const response = await publishCompanyJobDraft(nextDraft.id, changeSummary.trim() || undefined);
      const publishedDraft: JobDraft = {
        ...nextDraft,
        job_id: response.job_id,
        status: 'published_linked'
      };
      updateDraft(publishedDraft);
      setChangeSummary('');
      setStatusMessage(
        response.version_number > 1
          ? t('company.job_editor.feedback.publish_success_versioned', { defaultValue: 'Update published as version {{version}}.', version: response.version_number })
          : t('company.job_editor.feedback.publish_success', { defaultValue: 'Job published successfully.' })
      );
      onJobLifecycleChange?.(response.job_id, 'active', { skipAudit: true, refreshJobs: true });
    } catch (error) {
      if (isMissingFeatureError(error)) {
        setErrorMessage(t('company.job_editor.feedback.publish_api_unavailable', { defaultValue: 'Draft publishing API is not available on this backend yet. Direct publishing to the legacy jobs table has been disabled.' }));
      } else {
        console.error('Failed to publish draft:', error);
        setErrorMessage(t('company.job_editor.feedback.publish_failed', { defaultValue: 'Publishing failed. Please validate and try again.' }));
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleDuplicate = async () => {
    if (!draft?.job_id) return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      if (usesLocalFallback) {
        const duplicated = createLocalDraftRecord(companyProfile, userEmail, {
          ...draft,
          id: undefined,
          job_id: null,
          status: 'draft',
          created_at: undefined,
          updated_at: undefined
        });
        updateDraft(duplicated);
        setStatusMessage(t('company.job_editor.feedback.duplicate_local', { defaultValue: 'A new local draft was created from the live job.' }));
        return;
      }
      const duplicated = await duplicateRoleIntoDraft(draft.job_id);
      updateDraft(duplicated);
      setStatusMessage(t('company.job_editor.feedback.duplicate_success', { defaultValue: 'A new duplicate draft was created from the live job.' }));
    } catch (error) {
      if (isMissingFeatureError(error)) {
        setUsesLocalFallback(true);
        const duplicated = createLocalDraftRecord(companyProfile, userEmail, {
          ...draft,
          id: undefined,
          job_id: null,
          status: 'draft',
          created_at: undefined,
          updated_at: undefined
        });
        updateDraft(duplicated);
        setStatusMessage(t('company.job_editor.feedback.duplicate_local', { defaultValue: 'A new local draft was created from the live job.' }));
      } else {
        console.error('Failed to duplicate job into draft:', error);
        setErrorMessage(t('company.job_editor.feedback.duplicate_failed', { defaultValue: 'Duplicate draft could not be created.' }));
      }
    }
  };

  const handleLifecycleChange = async (status: 'active' | 'paused' | 'closed' | 'archived') => {
    if (!draft?.job_id) return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      if (usesLocalFallback) {
        setErrorMessage(t('company.job_editor.feedback.lifecycle_api_required', { defaultValue: 'Lifecycle changes now require the backend role API. Direct updates to the legacy jobs table have been disabled.' }));
        return;
      }
      const result = await updateCompanyRoleLifecycle(draft.job_id, status);
      if (!result.ok) {
        setErrorMessage(t('company.job_editor.feedback.lifecycle_failed', { defaultValue: 'Lifecycle update failed.' }));
        return;
      }
      setStatusMessage(t('company.job_editor.feedback.lifecycle_moved', { defaultValue: 'Live job moved to {{status}}.', status: getLifecycleStatusLabel(status) }));
      onJobLifecycleChange?.(draft.job_id, status, { skipAudit: true, refreshJobs: false });
    } catch (error) {
      if (isMissingFeatureError(error)) {
        setErrorMessage(t('company.job_editor.feedback.lifecycle_api_unavailable_direct', { defaultValue: 'Lifecycle API is not available on this backend yet. Direct compatibility updates to the legacy jobs table have been disabled.' }));
      } else {
        console.error('Failed to update lifecycle:', error);
        setErrorMessage(t('company.job_editor.feedback.lifecycle_failed', { defaultValue: 'Lifecycle update failed.' }));
      }
    }
  };

  const previewLabels = useMemo(() => ({
    untitledRole: t('company.job_editor.untitled_role', { defaultValue: 'Untitled role' }),
    company: t('company.job_editor.preview_labels.company', { defaultValue: 'Company' }),
    challengeFormat: t('company.job_editor.preview_labels.challenge_format', { defaultValue: 'Challenge format' }),
    challengeFormatStandard: t('company.job_editor.challenge_format_options.standard', { defaultValue: 'Standard challenge' }),
    challengeFormatMicroJob: t('company.job_editor.challenge_format_options.micro_job', { defaultValue: 'Mini challenge' }),
    microJobType: t('company.job_editor.preview_labels.micro_job_type', { defaultValue: 'Mini challenge type' }),
    microJobTimeEstimate: t('company.job_editor.preview_labels.micro_job_time', { defaultValue: 'Time estimate' }),
    microJobCollaboration: t('company.job_editor.preview_labels.micro_job_collaboration', { defaultValue: 'Collaboration' }),
    microJobLongTermPotential: t('company.job_editor.preview_labels.micro_job_long_term', { defaultValue: 'Long-term potential' }),
    location: t('company.job_editor.preview_labels.location', { defaultValue: 'Location' }),
    workSetup: t('company.job_editor.preview_labels.work_setup', { defaultValue: 'Work setup' }),
    contract: t('company.job_editor.preview_labels.contract', { defaultValue: 'Contract' }),
    compensation: t('company.job_editor.preview_labels.compensation', { defaultValue: 'Compensation' }),
    salaryTimeframeFallback: t('company.job_editor.preview_labels.salary_timeframe_fallback', { defaultValue: 'month' }),
    locationFallback: t('company.job_editor.feedback.location_unspecified', { defaultValue: 'Location not specified' }),
    roleSummary: t('company.job_editor.section_labels.role_summary', { defaultValue: 'Role Summary' }),
    goal: t('company.job_editor.section_labels.goal', { defaultValue: 'Goal' }),
    teamIntro: t('company.job_editor.section_labels.team_intro', { defaultValue: 'Team Intro' }),
    responsibilities: t('company.job_editor.section_labels.responsibilities', { defaultValue: 'Responsibilities' }),
    requirements: t('company.job_editor.section_labels.requirements', { defaultValue: 'Requirements' }),
    niceToHave: t('company.job_editor.section_labels.nice_to_have', { defaultValue: 'Nice to Have' }),
    firstReply: t('company.job_editor.handshake.first_reply', { defaultValue: 'First reply' }),
    companyTruthHard: t('company.job_editor.handshake.truth_hard', { defaultValue: 'Company truth: what is actually hard?' }),
    companyTruthFail: t('company.job_editor.handshake.truth_fail', { defaultValue: 'Company truth: who typically fails here?' }),
    benefits: t('company.job_editor.benefits_label', { defaultValue: 'Benefits' }),
    applicationDetails: t('company.job_editor.section_labels.application_instructions', { defaultValue: 'Application Details' }),
    workSetupOnSite: t('company.job_editor.work_setup_options.on_site', { defaultValue: 'On-site' }),
    workSetupHybrid: t('company.job_editor.work_setup_options.hybrid', { defaultValue: 'Hybrid' }),
    workSetupRemote: t('company.job_editor.work_setup_options.remote', { defaultValue: 'Remote' }),
    microJobKindValues: {
      one_off_task: t('company.job_editor.micro_job_kind_options.one_off_task', { defaultValue: 'One-off task' }),
      short_project: t('company.job_editor.micro_job_kind_options.short_project', { defaultValue: 'Short project' }),
      audit_review: t('company.job_editor.micro_job_kind_options.audit_review', { defaultValue: 'Audit / review' }),
      prototype: t('company.job_editor.micro_job_kind_options.prototype', { defaultValue: 'Prototype' }),
      experiment: t('company.job_editor.micro_job_kind_options.experiment', { defaultValue: 'Experiment' })
    },
    microJobCollaborationValues: {
      remote: t('company.job_editor.micro_job_collaboration_options.remote', { defaultValue: 'Remote' }),
      async: t('company.job_editor.micro_job_collaboration_options.async', { defaultValue: 'Async' }),
      call: t('company.job_editor.micro_job_collaboration_options.call', { defaultValue: 'Call' })
    },
    microJobLongTermPotentialValues: {
      yes: t('company.job_editor.micro_job_long_term_options.yes', { defaultValue: 'Yes' }),
      maybe: t('company.job_editor.micro_job_long_term_options.maybe', { defaultValue: 'Maybe' }),
      no: t('company.job_editor.micro_job_long_term_options.no', { defaultValue: 'No' })
    }
  }), [t]);

  const previewMarkdown = useMemo(() => (draft ? composePreviewMarkdown(draft, companyProfile.name, previewLabels) : ''), [draft, companyProfile.name, previewLabels]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px] animate-in fade-in">
      <div className="space-y-4">
        <div className="company-surface-elevated rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.96))] p-4 shadow-[0_22px_44px_-34px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.94))] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">
                {t('company.job_editor.title', { defaultValue: 'Role studio' })}
              </div>
              <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                {t('company.job_editor.subtitle', { defaultValue: 'Create, review, and publish a role from one calm workspace.' })}
              </div>
              {usesLocalFallback ? (
                <div className="company-pill-surface mt-2 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:border-amber-900/30 dark:bg-slate-950/45 dark:text-amber-200">
                  <AlertTriangle size={12} />
                  {t('company.job_editor.compat_mode', { defaultValue: 'Compatibility mode: local drafts and direct publish fallback' })}
                </div>
              ) : null}
            </div>
            <button
              onClick={() => {
                void handleCreateDraft();
              }}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_14px_26px_-18px_rgba(15,23,42,0.9)] hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t('company.job_editor.new_draft', { defaultValue: 'New draft' })}
            </button>
          </div>

          <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {t('company.job_editor.resume_draft', { defaultValue: 'Role drafts' })}
          </div>

          {loadingDrafts ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading', { defaultValue: 'Loading...' })}</div>
          ) : drafts.length === 0 ? (
            <div className="company-surface-soft rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 p-4 text-sm text-slate-500 dark:bg-slate-950/20 dark:text-slate-400">
              {t('company.job_editor.no_drafts', { defaultValue: 'No drafts yet. Create one to start shaping your next role.' })}
            </div>
          ) : (
            <div className="space-y-2">
              {drafts.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectDraft(item)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${
                    highlightedDraftId === item.id
                      ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-200 dark:border-amber-700 dark:bg-amber-900/20 dark:ring-amber-900/40'
                      : item.id === selectedDraftId
                        ? 'border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-900/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950/30 dark:hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.title || t('company.job_editor.untitled_role', { defaultValue: 'Untitled role' })}
                    </div>
                    {highlightedDraftId === item.id ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                        {t('company.job_editor.new_badge', { defaultValue: 'New' })}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{item.status.replace(/_/g, ' ')}</span>
                    <span>{new Date(item.updated_at).toLocaleDateString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {schemaStatus ? (
          <div className="company-surface rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_20px_42px_-34px_rgba(15,23,42,0.42)] dark:border-slate-800 dark:bg-slate-900/92 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('company.job_editor.rollout_schema_check', { defaultValue: 'Rollout schema check' })}
              </div>
              <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                schemaStatus.all_ready
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
              }`}>
                {schemaStatus.all_ready
                  ? t('company.job_editor.rollout_ready', { defaultValue: 'Ready' })
                  : t('company.job_editor.rollout_attention', { defaultValue: 'Attention' })}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: 'job_applications', probe: schemaStatus.job_applications },
                { label: 'job_drafts', probe: schemaStatus.job_drafts },
                { label: 'job_versions', probe: schemaStatus.job_versions }
              ].map(({ label, probe }) => (
                <div key={label} className="company-surface-soft rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 px-3 py-2 dark:bg-slate-950/20">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {t(`company.job_editor.rollout_tables.${label}`, { defaultValue: label })}
                    </span>
                    <span className={probe.ready ? 'text-amber-600 dark:text-amber-300' : 'text-rose-600 dark:text-rose-300'}>
                      {probe.ready
                        ? t('company.job_editor.rollout_ok', { defaultValue: 'ok' })
                        : t('company.job_editor.rollout_missing', { defaultValue: 'missing' })}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.rollout_sample_rows', { defaultValue: 'sample rows' })}: {probe.sample_rows}
                    {probe.issue ? ` • ${probe.issue}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {draft?.job_id ? (
          <div className="company-surface rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_20px_42px_-34px_rgba(15,23,42,0.42)] dark:border-slate-800 dark:bg-slate-900/92 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('company.job_editor.versions', { defaultValue: 'Versions' })}
              </div>
              {versionsLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
            </div>
            {versions.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {t('company.job_editor.no_versions', { defaultValue: 'No published versions yet.' })}
              </div>
            ) : (
              <div className="space-y-2">
                {versions.slice(0, 5).map((version) => (
                  <div key={version.id} className="company-surface-soft rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 px-3 py-2 dark:bg-slate-950/20">
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {t('company.job_editor.version_label', { defaultValue: 'Version' })} {version.version_number}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {new Date(version.published_at).toLocaleString()}
                    </div>
                    {version.change_summary && (
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{version.change_summary}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        {!draft ? (
          <div className="company-surface rounded-[24px] border border-dashed border-slate-200 dark:border-slate-800 bg-white/90 p-8 text-center text-slate-500 shadow-[0_20px_42px_-34px_rgba(15,23,42,0.35)] dark:bg-slate-900/90 dark:text-slate-400">
            {t('company.job_editor.empty_state', { defaultValue: 'Choose an existing draft or start a new one to begin.' })}
          </div>
        ) : (
          <>
            <div className="company-surface rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_22px_44px_-34px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900/92 space-y-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">
                    {t('company.job_editor.role_basics', { defaultValue: 'Role essentials' })}
                  </div>
                  <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.role_basics_desc', { defaultValue: 'The key details candidates expect to see right away.' })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="company-pill-surface inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {t('company.job_editor.save', { defaultValue: 'Save draft' })}
                  </button>
                  <button
                    onClick={handleValidateDraft}
                    disabled={validating}
                    className="company-pill-surface inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50"
                  >
                    {validating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    {t('company.job_editor.validate', { defaultValue: 'Validate' })}
                  </button>
                  <button
                    onClick={handlePublishDraft}
                    disabled={publishing}
                    className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_14px_26px_-18px_rgba(5,150,105,0.7)] hover:bg-amber-500 disabled:opacity-50"
                  >
                    {publishing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                    {draft.job_id
                      ? t('company.job_editor.publish_update', { defaultValue: 'Publish update' })
                      : t('company.job_editor.publish', { defaultValue: 'Publish job' })}
                  </button>
                </div>
              </div>

              {statusMessage && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  {statusMessage}
                </div>
              )}
              {errorMessage && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.role_title', { defaultValue: 'Role title' })}
                  </label>
                  <input
                    value={draft.title}
                    onChange={(e) => patchDraft({ title: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                    placeholder={t('company.job_editor.role_title_placeholder', { defaultValue: 'Senior Product Designer' })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.challenge_format_label', { defaultValue: 'Challenge format' })}
                  </label>
                  <select
                    value={microJobState.challenge_format}
                    onChange={(e) => patchMicroJobState({
                      challenge_format: normalizeChallengeFormat(e.target.value),
                      kind: normalizeChallengeFormat(e.target.value) === 'micro_job' ? microJobState.kind : null,
                      time_estimate: normalizeChallengeFormat(e.target.value) === 'micro_job' ? microJobState.time_estimate : '',
                      collaboration_modes: normalizeChallengeFormat(e.target.value) === 'micro_job' ? microJobState.collaboration_modes : [],
                      long_term_potential: normalizeChallengeFormat(e.target.value) === 'micro_job' ? microJobState.long_term_potential : null
                    })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                  >
                    <option value="standard">
                      {t('company.job_editor.challenge_format_options.standard', { defaultValue: 'Standard challenge' })}
                    </option>
                    <option value="micro_job">
                      {t('company.job_editor.challenge_format_options.micro_job', { defaultValue: 'Mini challenge' })}
                    </option>
                  </select>
                  <div className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                    {isMicroJobDraft
                      ? t('company.job_editor.challenge_format_help_micro', {
                          defaultValue: 'Mini challenge means a quick collaboration up to roughly 40 hours or up to 30 days.'
                        })
                      : t('company.job_editor.challenge_format_help_standard', {
                          defaultValue: 'Use the standard challenge for regular open roles, recurring hiring, and full processes.'
                        })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.hiring_stage_label', { defaultValue: 'Hiring status' })}
                  </label>
                  <select
                    value={draft.hiring_stage || DEFAULT_HIRING_STAGE}
                    onChange={(e) => patchDraft({ hiring_stage: e.target.value as JobHiringStage })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                  >
                    {HIRING_STAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(`company.job_editor.hiring_stage_options.${option.value}`, { defaultValue: option.label })}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.hiring_stage_help', {
                      defaultValue: 'Candidates will see where the process currently is and whether you are still actively reviewing.'
                    })}
                  </div>
                </div>

                {isMicroJobDraft ? (
                  <div className="space-y-4 rounded-2xl border border-cyan-200/80 bg-cyan-50/70 p-4 md:col-span-2 dark:border-cyan-900/40 dark:bg-cyan-950/20">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {t('company.job_editor.micro_job_title', { defaultValue: 'Mini challenge setup' })}
                      </div>
                      <div className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                        {t('company.job_editor.micro_job_desc', {
                          defaultValue: 'Use this for one-off help, short audits, prototypes, experiments, and quick project work with a smaller commitment.'
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          {t('company.job_editor.micro_job_kind_label', { defaultValue: 'Mini challenge type' })}
                        </label>
                        <select
                          value={microJobState.kind || ''}
                          onChange={(e) => patchMicroJobState({ kind: normalizeMicroJobKind(e.target.value) })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                        >
                          <option value="">
                            {t('company.job_editor.micro_job_kind_placeholder', { defaultValue: 'Choose a type' })}
                          </option>
                          {MICRO_JOB_KIND_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {t(`company.job_editor.micro_job_kind_options.${option.value}`, { defaultValue: option.label })}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          {t('company.job_editor.micro_job_time_label', { defaultValue: 'Time estimate' })}
                        </label>
                        <input
                          value={microJobState.time_estimate}
                          onChange={(e) => patchMicroJobState({ time_estimate: trimText(e.target.value, 80) })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                          placeholder={t('company.job_editor.micro_job_time_placeholder', { defaultValue: '5-10 h, 20 h, 1 week' })}
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          {t('company.job_editor.micro_job_collaboration_label', { defaultValue: 'Collaboration type' })}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {MICRO_JOB_COLLABORATION_OPTIONS.map((option) => {
                            const active = microJobState.collaboration_modes.includes(option.value);
                            return (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => toggleMicroJobCollaboration(option.value)}
                                className={cn(
                                  'rounded-full border px-3 py-2 text-xs font-semibold transition',
                                  active
                                    ? 'border-cyan-500 bg-cyan-600 text-white shadow-[0_10px_24px_-18px_rgba(8,145,178,0.85)]'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                                )}
                              >
                                {t(`company.job_editor.micro_job_collaboration_options.${option.value}`, { defaultValue: option.label })}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                          {t('company.job_editor.micro_job_collaboration_help', {
                            defaultValue: 'Explain whether the work happens fully remote, mostly async, or depends on a quick call with the team.'
                          })}
                        </div>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          {t('company.job_editor.micro_job_long_term_label', { defaultValue: 'Can this turn into a longer collaboration?' })}
                        </label>
                        <select
                          value={microJobState.long_term_potential || ''}
                          onChange={(e) => patchMicroJobState({ long_term_potential: normalizeMicroJobLongTermPotential(e.target.value) })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                        >
                          <option value="">
                            {t('company.job_editor.micro_job_long_term_placeholder', { defaultValue: 'Choose an option' })}
                          </option>
                          {(['yes', 'maybe', 'no'] as MicroJobLongTermPotential[]).map((option) => (
                            <option key={option} value={option}>
                              {t(`company.job_editor.micro_job_long_term_options.${option}`, {
                                defaultValue: option === 'yes' ? 'Yes' : option === 'maybe' ? 'Maybe' : 'No'
                              })}
                            </option>
                          ))}
                        </select>
                        <div className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                          {t('company.job_editor.micro_job_long_term_help', {
                            defaultValue: 'Use this to signal whether the mini challenge can realistically grow into a longer working relationship.'
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {isMicroJobDraft
                      ? t('company.job_editor.budget_from', { defaultValue: 'Budget from' })
                      : t('company.job_editor.salary_from', { defaultValue: 'Salary from' })}
                  </label>
                  <input
                    value={draft.salary_from ?? ''}
                    onChange={(e) => patchDraft({ salary_from: normalizeNumber(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                    placeholder={isMicroJobDraft
                      ? t('company.job_editor.budget_from_placeholder', { defaultValue: '5000' })
                      : t('company.job_editor.salary_from_placeholder', { defaultValue: '60000' })}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {isMicroJobDraft
                      ? t('company.job_editor.budget_to', { defaultValue: 'Budget to' })
                      : t('company.job_editor.salary_to', { defaultValue: 'Salary to' })}
                  </label>
                  <input
                    value={draft.salary_to ?? ''}
                    onChange={(e) => patchDraft({ salary_to: normalizeNumber(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                    placeholder={isMicroJobDraft
                      ? t('company.job_editor.budget_to_placeholder', { defaultValue: '15000' })
                      : t('company.job_editor.salary_to_placeholder', { defaultValue: '90000' })}
                    inputMode="numeric"
                  />
                </div>

                {!isMicroJobDraft ? (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {t('company.job_editor.contract_type', { defaultValue: 'Contract type' })}
                    </label>
                    <input
                      value={draft.contract_type || ''}
                      onChange={(e) => patchDraft({ contract_type: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                      placeholder={t('company.job_editor.contract_type_placeholder', { defaultValue: 'HPP' })}
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.work_setup', { defaultValue: 'Work setup' })}
                  </label>
                  <select
                    value={draft.work_model || 'On-site'}
                    onChange={(e) => patchDraft({ work_model: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                  >
                    <option value="On-site">{t('company.job_editor.work_setup_options.on_site', { defaultValue: 'On-site' })}</option>
                    <option value="Hybrid">{t('company.job_editor.work_setup_options.hybrid', { defaultValue: 'Hybrid' })}</option>
                    <option value="Remote">{t('company.job_editor.work_setup_options.remote', { defaultValue: 'Remote' })}</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.public_location', { defaultValue: 'Public location' })}
                  </label>
                  <input
                    value={draft.location_public || ''}
                    onChange={(e) => patchDraft({ location_public: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                    placeholder={t('company.job_editor.public_location_placeholder', { defaultValue: 'Prague / Hybrid' })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.workplace_address', { defaultValue: 'Workplace address' })}
                  </label>
                  <input
                    value={draft.workplace_address || ''}
                    onChange={(e) => patchDraft({ workplace_address: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                    placeholder={companyProfile.address || t('company.job_editor.workplace_address_placeholder', { defaultValue: 'Office address' })}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.contact_email', { defaultValue: 'Contact email' })}
                  </label>
                  <input
                    value={draft.contact_email || ''}
                    onChange={(e) => patchDraft({ contact_email: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white"
                    placeholder={userEmail || t('company.job_editor.contact_email_placeholder', { defaultValue: 'jobs@company.com' })}
                  />
                </div>
              </div>
            </div>

            <div className="company-surface rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_22px_44px_-34px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900/92 space-y-4">
              <div>
                <div className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">
                  {t('company.job_editor.handshake.title', { defaultValue: 'Handshake / first reply' })}
                </div>
                <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {isMicroJobDraft
                    ? t('company.job_editor.micro_job_handshake_desc', {
                        defaultValue: 'Keep the opening brief short. Explain what the candidate should react to first and what a useful first response looks like.'
                      })
                    : t('company.job_editor.handshake.desc', {
                        defaultValue: 'The company goes first. Set the opening prompt and answer the two truth questions candidates should see before they respond.'
                      })}
                </div>
              </div>

              <div className={`grid grid-cols-1 gap-4 ${isMicroJobDraft ? '' : 'md:grid-cols-2'}`}>
                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.handshake.first_reply', { defaultValue: 'First reply' })}
                  </label>
                  <textarea
                    value={draft.first_reply_prompt || ''}
                    onChange={(e) => patchDraft({ first_reply_prompt: e.target.value })}
                    className="min-h-[92px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                    placeholder={t('company.job_editor.handshake.first_reply_placeholder', {
                      defaultValue: 'Describe the first real situation candidates should respond to and what kind of trade-off you want to see.'
                    })}
                  />
                </div>

                {!isMicroJobDraft ? (
                  <>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        {t('company.job_editor.handshake.goal', { defaultValue: 'Goal (what outcome should this role drive?)' })}
                      </label>
                      <textarea
                        value={draft.company_goal || ''}
                        onChange={(e) => patchDraft({ company_goal: e.target.value })}
                        className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                        placeholder={t('company.job_editor.handshake.goal_placeholder', {
                          defaultValue: 'Example: Reduce dispatch estimate errors from 30% to under 10% within 90 days by unifying data from X/Y/Z.'
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        {t('company.job_editor.handshake.truth_hard', { defaultValue: 'What is actually hard about this role?' })}
                      </label>
                      <textarea
                        value={draft.company_truth_hard || ''}
                        onChange={(e) => patchDraft({ company_truth_hard: e.target.value })}
                        className="min-h-[132px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                        placeholder={t('company.job_editor.handshake.truth_hard_placeholder', {
                          defaultValue: 'Name the uncomfortable reality of the role: where people struggle, what creates pressure, and what the team cannot hide.'
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        {t('company.job_editor.handshake.truth_fail', { defaultValue: 'What type of person typically fails here?' })}
                      </label>
                      <textarea
                        value={draft.company_truth_fail || ''}
                        onChange={(e) => patchDraft({ company_truth_fail: e.target.value })}
                        className="min-h-[132px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                        placeholder={t('company.job_editor.handshake.truth_fail_placeholder', {
                          defaultValue: 'Be explicit about the mismatch: what working style, mindset, or pace usually does not work in this team.'
                        })}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            <div className="company-surface rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_22px_44px_-34px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900/92 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">
                    {t('company.job_editor.human_context_title', { defaultValue: 'Human context for this challenge' })}
                  </div>
                  <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.human_context_desc', { defaultValue: 'Pick the people who can appear publicly on native JobShaman challenges, so candidates know who published the role and who will likely reply.' })}
                  </div>
                </div>
                <div className="company-pill-surface inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <Users size={12} />
                  {loadingHumanContextPeople
                    ? t('company.job_editor.human_context_loading', { defaultValue: 'Loading team' })
                    : t('company.job_editor.human_context_selected', {
                        defaultValue: '{{count}} selected',
                        count: humanContextState.responders.length + (humanContextState.publisher ? 1 : 0)
                      })}
                </div>
              </div>

              {humanContextPeople.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-950/20 dark:text-slate-400">
                  {t('company.job_editor.human_context_empty', { defaultValue: 'No active company members are available yet. Add members first, then select who should be visible here.' })}
                </div>
              ) : (
                <>
                  <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/20">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {t('company.job_editor.human_context_publisher', { defaultValue: 'This challenge was published by' })}
                    </div>
                    <select
                      value={humanContextState.publisher?.user_id || ''}
                      onChange={(e) => handlePublisherChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                    >
                      <option value="">{t('company.job_editor.human_context_hidden', { defaultValue: 'Keep this hidden' })}</option>
                      {humanContextPeople.map((person) => (
                        <option key={`publisher-${person.user_id}`} value={person.user_id}>
                          {person.display_name}{person.email ? ` • ${person.email}` : ''}
                        </option>
                      ))}
                    </select>

                    {humanContextState.publisher ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/30 space-y-3">
                        <div className="flex items-start gap-3">
                          {humanContextState.publisher.avatar_url ? (
                            <img
                              src={humanContextState.publisher.avatar_url}
                              alt={humanContextState.publisher.display_name}
                              className="h-12 w-12 rounded-2xl object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-sm font-semibold text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-200">
                              {initialsFromName(humanContextState.publisher.display_name)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {humanContextState.publisher.display_name}
                            </div>
                            <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                              {humanContextPeopleById.get(humanContextState.publisher.user_id || '')?.email || t('company.job_editor.human_context_public_profile', { defaultValue: 'Public profile snapshot' })}
                            </div>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            value={humanContextState.publisher.display_name}
                            onChange={(e) => handlePublisherFieldChange('display_name')(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                            placeholder={t('company.job_editor.human_context_name_placeholder', { defaultValue: 'Public name' })}
                          />
                          <input
                            value={humanContextState.publisher.display_role || ''}
                            onChange={(e) => handlePublisherFieldChange('display_role')(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                            placeholder={t('company.job_editor.human_context_role_placeholder', { defaultValue: 'Public role, e.g. Head of Engineering' })}
                          />
                        </div>
                        <textarea
                          value={humanContextState.publisher.short_context || ''}
                          onChange={(e) => handlePublisherFieldChange('short_context')(e.target.value)}
                          className="min-h-[92px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                          placeholder={t('company.job_editor.human_context_context_placeholder', { defaultValue: 'Short public context, for example what this person owns or what part of the project they lead.' })}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/20">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {t('company.job_editor.human_context_responders', { defaultValue: 'Who will likely respond' })}
                      </div>
                      <button
                        type="button"
                        onClick={handleAddResponder}
                        disabled={humanContextState.responders.length >= MAX_HUMAN_CONTEXT_RESPONDERS}
                        className="company-pill-surface inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50"
                      >
                        <Plus size={14} />
                        {t('company.job_editor.human_context_add_responder', { defaultValue: 'Add responder' })}
                      </button>
                    </div>

                    {humanContextState.responders.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 px-4 py-4 text-sm leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-950/10 dark:text-slate-400">
                        {t('company.job_editor.human_context_responders_empty', { defaultValue: 'Add one to three team members who are likely to take the first dialogue with the candidate.' })}
                      </div>
                    ) : null}

                    {humanContextState.responders.map((person, index) => (
                      <div key={`${person.user_id || 'responder'}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/30 space-y-3">
                        <div className="flex items-start gap-3">
                          {person.avatar_url ? (
                            <img
                              src={person.avatar_url}
                              alt={person.display_name}
                              className="h-11 w-11 rounded-2xl object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-sm font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
                              {initialsFromName(person.display_name)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <select
                              value={person.user_id || ''}
                              onChange={(e) => handleResponderChange(index, e.target.value)}
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                            >
                              <option value="">{t('company.job_editor.human_context_select_person', { defaultValue: 'Select a person' })}</option>
                              {humanContextPeople.map((option) => (
                                <option key={`responder-${index}-${option.user_id}`} value={option.user_id}>
                                  {option.display_name}{option.email ? ` • ${option.email}` : ''}
                                </option>
                              ))}
                            </select>
                            <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                              {humanContextPeopleById.get(person.user_id || '')?.email || t('company.job_editor.human_context_public_profile', { defaultValue: 'Public profile snapshot' })}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveResponder(index)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            aria-label={t('company.job_editor.human_context_remove_responder', { defaultValue: 'Remove responder' })}
                          >
                            <XCircle size={16} />
                          </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            value={person.display_name}
                            onChange={(e) => handleResponderFieldChange(index, 'display_name', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                            placeholder={t('company.job_editor.human_context_name_placeholder', { defaultValue: 'Public name' })}
                          />
                          <input
                            value={person.display_role || ''}
                            onChange={(e) => handleResponderFieldChange(index, 'display_role', e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                            placeholder={t('company.job_editor.human_context_role_placeholder', { defaultValue: 'Public role, e.g. Product Lead' })}
                          />
                        </div>
                        <textarea
                          value={person.short_context || ''}
                          onChange={(e) => handleResponderFieldChange(index, 'short_context', e.target.value)}
                          className="min-h-[84px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                          placeholder={t('company.job_editor.human_context_context_placeholder', { defaultValue: 'Short public context, for example what this person owns or what part of the project they lead.' })}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-cyan-200/70 bg-cyan-50/70 px-4 py-3 text-xs leading-6 text-cyan-900 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-100">
                    {t('company.job_editor.human_context_note', { defaultValue: 'Only explicit opt-in people selected here are shown publicly, and only on native JobShaman challenges. Imported listings stay anonymous.' })}
                  </div>
                </>
              )}
            </div>

            <div className="company-surface rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_22px_44px_-34px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900/92 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">
                    {t('company.job_editor.sections', { defaultValue: 'Role story' })}
                  </div>
                  <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.sections_desc', { defaultValue: 'Shape each section separately so the final post stays clear and candidate-friendly.' })}
                  </div>
                </div>
                <button
                  onClick={() => setPreviewMode((prev) => !prev)}
                  className="company-pill-surface inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Eye size={14} />
                  {previewMode ? t('company.job_editor.hide_preview', { defaultValue: 'Hide preview' }) : t('company.job_editor.show_preview', { defaultValue: 'Show preview' })}
                </button>
              </div>

              <div className="space-y-5">
                {visibleTextSections.map((section) => (
                  <div key={section.key} className="company-surface-soft rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-950/10">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {t(`company.job_editor.section_labels.${section.key}`, { defaultValue: section.key.replace(/_/g, ' ') })}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {draft.ai_suggestions?.[section.key]
                            ? t('company.job_editor.section_ai_polished', { defaultValue: 'Polished with AI support.' })
                            : t('company.job_editor.section_human_hint', { defaultValue: 'Write this part in a clear, human tone.' })}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          patchDraft({
                            editor_state: {
                              ...(draft.editor_state || {}),
                              selected_section: section.key
                            }
                          });
                          void handleOptimizeSection(section.key);
                        }}
                        disabled={optimizingSection === section.key || !draft[section.key]?.trim()}
                        className="company-pill-surface inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-50"
                      >
                        {optimizingSection === section.key ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {t('company.job_editor.improve_section', { defaultValue: 'Improve this section' })}
                      </button>
                    </div>
                    <textarea
                      value={draft[section.key] || ''}
                      onChange={(e) => patchDraft({ [section.key]: e.target.value } as Partial<JobDraft>)}
                      onFocus={() => patchDraft({
                        editor_state: {
                          ...(draft.editor_state || {}),
                          selected_section: section.key
                        }
                      })}
                      className={`min-h-[140px] w-full rounded-xl border px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white dark:[color-scheme:dark] ${
                        activeSection === section.key
                          ? 'border-cyan-200 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/10'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950/40'
                      }`}
                      placeholder={t(`company.job_editor.section_placeholders.${section.key}`, { defaultValue: '' })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="company-surface rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_22px_44px_-34px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900/92 space-y-4">
              <div className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">
                {isMicroJobDraft
                  ? t('company.job_editor.final_review_title', { defaultValue: 'Final review' })
                  : t('company.job_editor.benefits_title', { defaultValue: 'Benefits and final review' })}
              </div>
              {!isMicroJobDraft ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.benefits_label', { defaultValue: 'Benefits' })}
                  </label>
                  <textarea
                    value={(draft.benefits_structured || []).join('\n')}
                    onChange={(e) => patchDraft({ benefits_structured: compactLines(e.target.value) })}
                    className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                    placeholder={t('company.job_editor.benefits_placeholder', { defaultValue: 'Add one benefit per line.' })}
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  {t('company.job_editor.change_summary_label', { defaultValue: 'What changed in this update?' })}
                </label>
                <input
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white dark:[color-scheme:dark]"
                  placeholder={t('company.job_editor.change_summary_placeholder', { defaultValue: 'Summarize the changes for your team.' })}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4">
        {draft ? (
          <>
            {pendingAiResult && pendingAiSection ? (
              <div className="rounded-[24px] border border-indigo-200 bg-indigo-50 p-4 shadow-[0_20px_42px_-34px_rgba(99,102,241,0.45)] space-y-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                    {t('company.job_editor.ai_suggestion', { defaultValue: 'AI suggestion ready' })}
                  </div>
                  <span className="text-[11px] uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
                    {pendingAiSection.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-sm text-slate-700 dark:text-slate-200">{pendingAiResult.improvedClarity}</div>
                {ensureArray(pendingAiResult.removedCliches).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ensureArray(pendingAiResult.removedCliches).map((item) => (
                      <span key={item} className="company-pill-surface rounded-md border border-indigo-200 bg-white px-2 py-1 text-[11px] text-indigo-700 dark:border-indigo-900/40 dark:bg-slate-900 dark:text-indigo-300">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={applyAiSuggestion}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    <CheckCircle2 size={14} />
                    {t('company.job_editor.apply_ai', { defaultValue: 'Apply suggestion' })}
                  </button>
                  <button
                    onClick={dismissAiSuggestion}
                    className="company-pill-surface inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <XCircle size={14} />
                    {t('company.job_editor.dismiss_ai', { defaultValue: 'Dismiss' })}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="company-surface rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/92 p-4 space-y-4 shadow-[0_20px_42px_-34px_rgba(15,23,42,0.42)]">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('company.job_editor.validation', { defaultValue: 'Validation and quality checks' })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="company-surface-soft rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/20 p-3">
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.transparency', { defaultValue: 'Transparency' })}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{validation.transparencyScore}</div>
                </div>
                <div className="company-surface-soft rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/20 p-3">
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.clarity', { defaultValue: 'Clarity' })}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{validation.clarityScore}</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/30 dark:bg-rose-950/20">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-rose-700 dark:text-rose-300">
                    <AlertTriangle size={14} />
                    {t('company.job_editor.blocking', { defaultValue: 'Blocking issues' })}
                  </div>
                  {validation.blockingIssues.length === 0 ? (
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                      {t('company.job_editor.no_blocking_issues', { defaultValue: 'No blocking issues.' })}
                    </div>
                  ) : (
                    <div className="space-y-1 text-sm text-rose-700 dark:text-rose-300">
                      {validation.blockingIssues.map((item) => (
                        <div key={item}>• {item}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-950/20">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                    {t('company.job_editor.warnings', { defaultValue: 'Warnings' })}
                  </div>
                  {validation.warnings.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {t('company.job_editor.no_warnings', { defaultValue: 'No warnings.' })}
                    </div>
                  ) : (
                    <div className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                      {validation.warnings.map((item) => (
                        <div key={item}>• {item}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="company-surface-soft rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/30">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.suggestions', { defaultValue: 'Suggestions' })}
                  </div>
                  {validation.suggestions.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {t('company.job_editor.no_suggestions', { defaultValue: 'No suggestions yet.' })}
                    </div>
                  ) : (
                    <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                      {validation.suggestions.map((item) => (
                        <div key={item}>• {item}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="company-surface rounded-[24px] border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/92 p-4 space-y-4 shadow-[0_20px_42px_-34px_rgba(15,23,42,0.42)]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t('company.job_editor.preview_panel', { defaultValue: 'Live preview' })}
                </div>
                {linkedJob && (
                  <span className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.live_status', { defaultValue: 'Live status' })}: {String((linkedJob as any)?.status || 'active')}
                  </span>
                )}
              </div>

              {previewMode ? (
                <div className="company-surface-soft max-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 p-4">
                  <article className="prose prose-slate max-w-none dark:prose-invert prose-headings:text-slate-950 dark:prose-headings:text-white prose-p:text-slate-700 dark:prose-p:text-slate-200 prose-strong:text-slate-900 dark:prose-strong:text-slate-100 prose-li:text-slate-700 dark:prose-li:text-slate-200">
                    <Markdown options={{ forceBlock: true }}>
                      {previewMarkdown}
                    </Markdown>
                  </article>
                </div>
              ) : (
                <div className="company-surface-soft rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/20 p-4 text-sm text-slate-500 dark:text-slate-400">
                  {t('company.job_editor.preview_hidden', { defaultValue: 'Preview is hidden. Use the toggle in the editor to show it again.' })}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDuplicate}
                  disabled={!draft.job_id}
                  className="company-pill-surface inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <Copy size={14} />
                  {t('company.job_editor.duplicate', { defaultValue: 'Duplicate' })}
                </button>
                <button
                  onClick={() => handleLifecycleChange('paused')}
                  disabled={!draft.job_id}
                  className="company-pill-surface inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <PauseCircle size={14} />
                  {t('company.job_editor.pause', { defaultValue: 'Pause' })}
                </button>
                <button
                  onClick={() => handleLifecycleChange('active')}
                  disabled={!draft.job_id}
                  className="company-pill-surface inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <PlayCircle size={14} />
                  {t('company.job_editor.reopen', { defaultValue: 'Reopen' })}
                </button>
                <button
                  onClick={() => handleLifecycleChange('closed')}
                  disabled={!draft.job_id}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-950/20 disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  {t('company.job_editor.close', { defaultValue: 'Close' })}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default CompanyJobEditor;
