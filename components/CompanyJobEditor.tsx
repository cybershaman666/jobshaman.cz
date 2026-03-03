import React, { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'markdown-to-jsx';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Copy, Eye, Loader2, PauseCircle, PlayCircle, RefreshCw, Save, Sparkles, UploadCloud, XCircle } from 'lucide-react';
import { CompanyProfile, Job, JobDraft, JobHiringStage, JobValidationReport, JobVersion } from '../types';
import {
  createCompanyJobDraft,
  createEditDraftFromJob,
  fetchCompanySchemaRolloutStatus,
  duplicateJobIntoDraft,
  isMissingFeatureError,
  listCompanyJobDrafts,
  listJobVersions,
  publishCompanyJobDraft,
  updateCompanyJobDraft,
  updateCompanyJobLifecycle,
  CompanySchemaRolloutStatus,
  validateCompanyJobDraft
} from '../services/companyJobDraftService';
import { optimizeJobDescription } from '../services/geminiService';
import { supabase } from '../services/supabaseService';

type JobDraftTextSection =
  | 'role_summary'
  | 'team_intro'
  | 'responsibilities'
  | 'requirements'
  | 'nice_to_have'
  | 'application_instructions';

interface CompanyJobEditorProps {
  companyProfile: CompanyProfile;
  jobs: Job[];
  userEmail?: string;
  seedJobId?: string | null;
  createDraftSignal?: number;
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

const DEFAULT_VALIDATION: JobValidationReport = {
  blockingIssues: [],
  warnings: [],
  suggestions: [],
  transparencyScore: 0,
  clarityScore: 0
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

const HIRING_STAGE_OPTIONS: Array<{ value: JobHiringStage; label: string }> = [
  { value: 'collecting_cvs', label: 'Collecting CVs' },
  { value: 'reviewing_first_10', label: 'Reviewing first 10 candidates' },
  { value: 'shortlisting', label: 'Shortlisting' },
  { value: 'final_interviews', label: 'Final interviews' },
  { value: 'offer_stage', label: 'Offer stage' }
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

const attachHiringStageMetadata = (description: string, hiringStage?: JobHiringStage | null): string => {
  const normalizedStage = normalizeHiringStage(hiringStage) || DEFAULT_HIRING_STAGE;
  const marker = `<!-- jobshaman:hiring_stage=${normalizedStage} -->`;
  const trimmedDescription = description.trim();
  return trimmedDescription ? `${marker}\n\n${trimmedDescription}` : marker;
};

const toDraftInput = (draft: JobDraft) => ({
  status: draft.status,
  title: draft.title,
  role_summary: draft.role_summary,
  team_intro: draft.team_intro,
  responsibilities: draft.responsibilities,
  requirements: draft.requirements,
  nice_to_have: draft.nice_to_have,
  benefits_structured: draft.benefits_structured || [],
  salary_from: draft.salary_from ?? null,
  salary_to: draft.salary_to ?? null,
  salary_currency: draft.salary_currency,
  salary_timeframe: draft.salary_timeframe,
  contract_type: draft.contract_type || null,
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
    hiring_stage: normalizeHiringStage(draft.hiring_stage) || DEFAULT_HIRING_STAGE
  }
});

const composePreviewMarkdown = (
  draft: JobDraft,
  companyName: string,
  labels: {
    untitledRole: string;
    company: string;
    location: string;
    workSetup: string;
    contract: string;
    compensation: string;
    salaryTimeframeFallback: string;
    roleSummary: string;
    teamIntro: string;
    responsibilities: string;
    requirements: string;
    niceToHave: string;
    benefits: string;
    applicationDetails: string;
  }
): string => {
  const sections: string[] = [
    `# ${draft.title || labels.untitledRole}`,
    `**${labels.company}:** ${companyName}`,
    draft.location_public ? `**${labels.location}:** ${draft.location_public}` : '',
    draft.work_model ? `**${labels.workSetup}:** ${draft.work_model}` : '',
    draft.contract_type ? `**${labels.contract}:** ${draft.contract_type}` : '',
    draft.salary_from || draft.salary_to
      ? `**${labels.compensation}:** ${draft.salary_from || '—'} - ${draft.salary_to || '—'} ${draft.salary_currency || 'CZK'} / ${draft.salary_timeframe || labels.salaryTimeframeFallback}`
      : '',
    draft.role_summary ? `## ${labels.roleSummary}\n${draft.role_summary}` : '',
    draft.team_intro ? `## ${labels.teamIntro}\n${draft.team_intro}` : '',
    draft.responsibilities ? `## ${labels.responsibilities}\n${compactLines(draft.responsibilities).map((line) => `- ${line}`).join('\n')}` : '',
    draft.requirements ? `## ${labels.requirements}\n${compactLines(draft.requirements).map((line) => `- ${line}`).join('\n')}` : '',
    draft.nice_to_have ? `## ${labels.niceToHave}\n${compactLines(draft.nice_to_have).map((line) => `- ${line}`).join('\n')}` : '',
    draft.benefits_structured?.length ? `## ${labels.benefits}\n${draft.benefits_structured.map((line) => `- ${line}`).join('\n')}` : '',
    draft.application_instructions ? `## ${labels.applicationDetails}\n${draft.application_instructions}` : ''
  ];

  return sections.filter(Boolean).join('\n\n');
};

const createBaseDraft = (companyProfile: CompanyProfile, userEmail?: string): Partial<JobDraft> => ({
  title: '',
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
    hiring_stage: DEFAULT_HIRING_STAGE
  },
  hiring_stage: DEFAULT_HIRING_STAGE
});

const createLocalValidationReport = (draft: JobDraft): JobValidationReport => {
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

  if (!title) blockingIssues.push('Add a role title.');
  if (!roleSummary) blockingIssues.push('Add a role summary.');
  if (!hasSalary) warnings.push('Add a visible salary range to improve transparency.');
  if (!location) warnings.push('Add a public location or workplace address.');
  if (!contactEmail && !draft.application_instructions.trim()) blockingIssues.push('Add an application destination or clear instructions.');
  if (requirements.length < 2) warnings.push('Requirements are still thin. Add at least two concrete must-haves.');
  if (benefits.length === 0) warnings.push('List at least one concrete benefit.');
  if (roleSummary.length < 120) suggestions.push('Expand the role summary so candidates understand what success looks like.');
  if (benefits.some((item) => /competitive|great culture|dynamic/i.test(item))) {
    suggestions.push('Replace vague benefits with specifics candidates can evaluate.');
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

  return {
    ...draft,
    hiring_stage: hiringStage,
    benefits_structured: ensureArray(draft.benefits_structured),
    quality_report: normalizeValidationReport(draft.quality_report),
    editor_state: {
      ...editorState,
      selected_section: editorState.selected_section || 'role_summary',
      hiring_stage: hiringStage
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
  role_summary: job.description || '',
  responsibilities: '',
  requirements: '',
  nice_to_have: '',
  benefits_structured: Array.isArray(job.benefits) ? job.benefits : [],
  salary_from: job.salary_from ?? null,
  salary_to: job.salary_to ?? null,
  salary_currency: 'CZK',
  salary_timeframe: job.salary_timeframe || 'monthly',
  contract_type: null,
  work_model: job.work_model || job.type || null,
  workplace_address: job.location || '',
  location_public: job.location || '',
  application_instructions: '',
  contact_email: userEmail || '',
  hiring_stage: job.hiring_stage || DEFAULT_HIRING_STAGE,
});

const CompanyJobEditor: React.FC<CompanyJobEditorProps> = ({
  companyProfile,
  jobs,
  userEmail,
  seedJobId,
  createDraftSignal = 0,
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
  const lastHandledCreateDraftSignal = useRef(0);
  const highlightResetTimer = useRef<number | null>(null);

  const linkedJob = useMemo(
    () => jobs.find((item) => draft?.job_id != null && String(item.id) === String(draft.job_id)) || null,
    [jobs, draft?.job_id]
  );

  const validation = normalizeValidationReport(draft?.quality_report || DEFAULT_VALIDATION);
  const activeSection = (draft?.editor_state?.selected_section as JobDraftTextSection | undefined) || 'role_summary';
  const localDraftStorageKey = useMemo(() => getLocalDraftStorageKey(companyProfile.id), [companyProfile.id]);
  const localVersionStorageKey = useMemo(() => getLocalVersionStorageKey(companyProfile.id), [companyProfile.id]);

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

  const persistLocalVersions = (rows: JobVersion[]) => {
    writeLocalJson(localVersionStorageKey, rows);
  };

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
          setStatusMessage('Structured draft API is not available on this backend yet. Using local compatibility mode.');
        } else {
          console.error('Failed to load company drafts:', error);
          if (active) setErrorMessage('Unable to load drafts right now.');
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
        const rows = normalizeVersionRows(await listJobVersions(draft.job_id as string | number));
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
        const nextDraft = normalizeDraft(await createEditDraftFromJob(seedJobId));
        if (!active) return;
        setDrafts((prev) => {
          const withoutDuplicate = prev.filter((item) => item.id !== nextDraft.id);
          return [nextDraft, ...withoutDuplicate];
        });
        setSelectedDraftId(nextDraft.id);
        setDraft(nextDraft);
        setStatusMessage('Opened a safe edit draft for the selected job.');
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
          setStatusMessage('Opened a local compatibility draft for this job.');
        } else {
          console.error('Failed to create edit draft:', error);
          if (active) setErrorMessage('Unable to open edit draft for this role.');
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

  const handleCreateDraft = async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    setSaving(true);
    try {
      if (usesLocalFallback) {
        const created = normalizeDraft(createLocalDraftRecord(companyProfile, userEmail));
        updateDraft(created);
        flashDraftHighlight(created.id);
        setStatusMessage('Draft created in local compatibility mode.');
        return;
      }
      const created = normalizeDraft(await createCompanyJobDraft(createBaseDraft(companyProfile, userEmail)));
      updateDraft(created);
      flashDraftHighlight(created.id);
      setStatusMessage('Draft created. You can save partial progress at any time.');
    } catch (error) {
      if (isMissingFeatureError(error)) {
        setUsesLocalFallback(true);
        const created = normalizeDraft(createLocalDraftRecord(companyProfile, userEmail));
        updateDraft(created);
        flashDraftHighlight(created.id);
        setStatusMessage('Draft API is not available here yet. Created a local compatibility draft instead.');
      } else {
        console.error('Failed to create job draft:', error);
        setErrorMessage('Draft creation failed. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!createDraftSignal || createDraftSignal === lastHandledCreateDraftSignal.current) return;
    lastHandledCreateDraftSignal.current = createDraftSignal;
    void handleCreateDraft();
  }, [createDraftSignal]);

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

  const handleSaveDraft = async () => {
    if (!draft?.id) return;
    setErrorMessage(null);
    setStatusMessage(null);
    setSaving(true);
    try {
      if (usesLocalFallback) {
        const saved = {
          ...draft,
          quality_report: draft.quality_report || createLocalValidationReport(draft),
          updated_at: new Date().toISOString()
        };
        updateDraft(saved);
        setStatusMessage('Draft saved locally.');
        return;
      }
      const saved = await updateCompanyJobDraft(draft.id, toDraftInput(draft));
      updateDraft(saved);
      setStatusMessage('Draft saved.');
    } catch (error) {
      if (isMissingFeatureError(error)) {
        setUsesLocalFallback(true);
        const saved = {
          ...draft,
          quality_report: draft.quality_report || createLocalValidationReport(draft),
          updated_at: new Date().toISOString()
        };
        updateDraft(saved);
        setStatusMessage('Draft API unavailable. Changes were saved locally.');
      } else {
        console.error('Failed to save job draft:', error);
        setErrorMessage('Saving failed. Your local changes are still visible, but not yet persisted.');
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
        const report = createLocalValidationReport(draft);
        const saved: JobDraft = {
          ...draft,
          quality_report: report,
          status: report.blockingIssues.length === 0 ? 'ready_for_publish' : 'draft',
          updated_at: new Date().toISOString()
        };
        updateDraft(saved);
        setStatusMessage(report.blockingIssues.length === 0 ? 'Draft is ready to publish.' : 'Validation finished. Fix blocking issues before publishing.');
        return;
      }
      const report = await validateCompanyJobDraft(draft.id);
      const saved = await updateCompanyJobDraft(draft.id, {
        ...toDraftInput(draft),
        quality_report: report,
        status: report.blockingIssues.length === 0 ? 'ready_for_publish' : 'draft'
      });
      updateDraft(saved);
      setStatusMessage(report.blockingIssues.length === 0 ? 'Draft is ready to publish.' : 'Validation finished. Fix blocking issues before publishing.');
    } catch (error) {
      if (isMissingFeatureError(error)) {
        setUsesLocalFallback(true);
        const report = createLocalValidationReport(draft);
        const saved: JobDraft = {
          ...draft,
          quality_report: report,
          status: report.blockingIssues.length === 0 ? 'ready_for_publish' : 'draft',
          updated_at: new Date().toISOString()
        };
        updateDraft(saved);
        setStatusMessage(report.blockingIssues.length === 0 ? 'Draft is ready to publish.' : 'Validation finished. Fix blocking issues before publishing.');
      } else {
        console.error('Failed to validate draft:', error);
        setErrorMessage('Validation failed. Please try again.');
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
      setErrorMessage('AI suggestion failed. Please try again.');
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
    setStatusMessage('AI suggestion applied to the selected section.');
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
        const report = createLocalValidationReport(nextDraft);
        nextDraft = {
          ...nextDraft,
          quality_report: report,
          status: report.blockingIssues.length === 0 ? 'ready_for_publish' : 'draft',
          updated_at: new Date().toISOString()
        };
        updateDraft(nextDraft);
        if (report.blockingIssues.length > 0) {
          setErrorMessage('This draft still has blocking issues. Review the validation panel before publishing.');
          setPublishing(false);
          return;
        }
        if (!supabase) {
          setErrorMessage('Supabase is unavailable, so local compatibility mode cannot publish this draft yet.');
          setPublishing(false);
          return;
        }

        const jobPayload = {
          title: nextDraft.title,
          company: companyProfile.name,
          description: attachHiringStageMetadata(
            composePreviewMarkdown(nextDraft, companyProfile.name, previewLabels),
            nextDraft.hiring_stage
          ),
          location: nextDraft.location_public || nextDraft.workplace_address || 'Location not specified',
          salary_from: nextDraft.salary_from ?? null,
          salary_to: nextDraft.salary_to ?? null,
          salary_currency: nextDraft.salary_currency || 'CZK',
          salary_timeframe: nextDraft.salary_timeframe || 'month',
          benefits: nextDraft.benefits_structured || [],
          contact_email: nextDraft.contact_email || null,
          workplace_address: nextDraft.workplace_address || null,
          company_id: companyProfile.id,
          contract_type: nextDraft.contract_type || null,
          work_type: nextDraft.work_model || null,
          source: 'jobshaman.cz',
          scraped_at: new Date().toISOString(),
          status: 'active'
        };

        let publishedJobId = nextDraft.job_id;
        if (nextDraft.job_id) {
          const { data, error } = await supabase
            .from('jobs')
            .update(jobPayload)
            .eq('id', nextDraft.job_id)
            .select('id')
            .single();
          if (error) throw error;
          publishedJobId = data?.id || nextDraft.job_id;
        } else {
          const { data, error } = await supabase
            .from('jobs')
            .insert(jobPayload)
            .select('id')
            .single();
          if (error) throw error;
          publishedJobId = data?.id;
        }

        const existingVersions = loadLocalVersions();
        const currentVersions = existingVersions.filter((item) => String(item.job_id) === String(publishedJobId));
        const nextVersionNumber = currentVersions.length > 0
          ? Math.max(...currentVersions.map((item) => item.version_number)) + 1
          : 1;
        const versionRecord: JobVersion = {
          id: `local-version-${crypto.randomUUID()}`,
          job_id: publishedJobId as string | number,
          draft_id: nextDraft.id,
          version_number: nextVersionNumber,
          published_snapshot: {
            title: nextDraft.title,
            description: jobPayload.description,
            location: jobPayload.location,
            benefits: nextDraft.benefits_structured || [],
          },
          change_summary: changeSummary.trim() || null,
          published_by: userEmail || null,
          published_at: new Date().toISOString()
        };
        persistLocalVersions([versionRecord, ...existingVersions]);
        setVersions((prev) => [versionRecord, ...prev]);

        const publishedDraft: JobDraft = {
          ...nextDraft,
          job_id: publishedJobId,
          status: 'published_linked',
          updated_at: new Date().toISOString()
        };
        updateDraft(publishedDraft);
        setChangeSummary('');
        setStatusMessage(nextVersionNumber > 1 ? `Update published as version ${nextVersionNumber}.` : 'Job published successfully.');
        onJobLifecycleChange?.(publishedJobId as string | number, 'active', { skipAudit: true, refreshJobs: true });
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
          setErrorMessage('This draft still has blocking issues. Review the validation panel before publishing.');
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
      setStatusMessage(response.version_number > 1 ? `Update published as version ${response.version_number}.` : 'Job published successfully.');
      onJobLifecycleChange?.(response.job_id, 'active', { skipAudit: true, refreshJobs: true });
    } catch (error) {
      if (isMissingFeatureError(error)) {
        setUsesLocalFallback(true);
        setErrorMessage('Draft publishing API is not available on this backend yet. Save once more and publish again in compatibility mode.');
      } else {
        console.error('Failed to publish draft:', error);
        setErrorMessage('Publishing failed. Please validate and try again.');
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
        setStatusMessage('A new local draft was created from the live job.');
        return;
      }
      const duplicated = await duplicateJobIntoDraft(draft.job_id);
      updateDraft(duplicated);
      setStatusMessage('A new duplicate draft was created from the live job.');
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
        setStatusMessage('A new local draft was created from the live job.');
      } else {
        console.error('Failed to duplicate job into draft:', error);
        setErrorMessage('Duplicate draft could not be created.');
      }
    }
  };

  const handleLifecycleChange = async (status: 'active' | 'paused' | 'closed' | 'archived') => {
    if (!draft?.job_id) return;
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      if (usesLocalFallback) {
        if (!supabase) {
          setErrorMessage('Supabase is unavailable, so lifecycle updates cannot be applied right now.');
          return;
        }
        const { error } = await supabase
          .from('jobs')
          .update({ status })
          .eq('id', draft.job_id);
        if (error) {
          setErrorMessage('Lifecycle update failed.');
          return;
        }
        setStatusMessage(`Live job moved to ${status}.`);
        onJobLifecycleChange?.(draft.job_id, status, { skipAudit: false, refreshJobs: false });
        return;
      }
      const result = await updateCompanyJobLifecycle(draft.job_id, status);
      if (!result.ok && result.via === 'unavailable') {
        setUsesLocalFallback(true);
        if (!supabase) {
          setErrorMessage('Lifecycle API is not available on this backend yet.');
          return;
        }
        const { error } = await supabase
          .from('jobs')
          .update({ status })
          .eq('id', draft.job_id);
        if (error) {
          setErrorMessage('Lifecycle update failed.');
          return;
        }
        setStatusMessage(`Live job moved to ${status}.`);
        onJobLifecycleChange?.(draft.job_id, status, { skipAudit: false, refreshJobs: false });
        return;
      }
      if (!result.ok) {
        setErrorMessage('Lifecycle update failed.');
        return;
      }
      setStatusMessage(`Live job moved to ${status}.`);
      onJobLifecycleChange?.(draft.job_id, status, { skipAudit: true, refreshJobs: false });
    } catch (error) {
      if (isMissingFeatureError(error)) {
        setUsesLocalFallback(true);
        setErrorMessage('Lifecycle API is not available on this backend yet. Try again and the editor will use direct compatibility mode.');
      } else {
        console.error('Failed to update lifecycle:', error);
        setErrorMessage('Lifecycle update failed.');
      }
    }
  };

  const previewLabels = useMemo(() => ({
    untitledRole: t('company.job_editor.untitled_role', { defaultValue: 'Untitled role' }),
    company: t('company.job_editor.preview_labels.company', { defaultValue: 'Company' }),
    location: t('company.job_editor.preview_labels.location', { defaultValue: 'Location' }),
    workSetup: t('company.job_editor.preview_labels.work_setup', { defaultValue: 'Work setup' }),
    contract: t('company.job_editor.preview_labels.contract', { defaultValue: 'Contract' }),
    compensation: t('company.job_editor.preview_labels.compensation', { defaultValue: 'Compensation' }),
    salaryTimeframeFallback: t('company.job_editor.preview_labels.salary_timeframe_fallback', { defaultValue: 'month' }),
    roleSummary: t('company.job_editor.section_labels.role_summary', { defaultValue: 'Role Summary' }),
    teamIntro: t('company.job_editor.section_labels.team_intro', { defaultValue: 'Team Intro' }),
    responsibilities: t('company.job_editor.section_labels.responsibilities', { defaultValue: 'Responsibilities' }),
    requirements: t('company.job_editor.section_labels.requirements', { defaultValue: 'Requirements' }),
    niceToHave: t('company.job_editor.section_labels.nice_to_have', { defaultValue: 'Nice to Have' }),
    benefits: t('company.job_editor.benefits_label', { defaultValue: 'Benefits' }),
    applicationDetails: t('company.job_editor.section_labels.application_instructions', { defaultValue: 'Application Details' })
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
              onClick={handleCreateDraft}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_14px_26px_-18px_rgba(15,23,42,0.9)] hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t('company.job_editor.new_draft', { defaultValue: 'New draft' })}
            </button>
          </div>

          <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
            {t('company.job_editor.resume_draft', { defaultValue: 'Resume draft' })}
          </div>

          {loadingDrafts ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading') || 'Loading...'}</div>
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
                      ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200 dark:border-emerald-700 dark:bg-emerald-900/20 dark:ring-emerald-900/40'
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
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
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
                Rollout schema check
              </div>
              <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
                schemaStatus.all_ready
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
              }`}>
                {schemaStatus.all_ready ? 'Ready' : 'Attention'}
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
                    <span className="font-medium text-slate-800 dark:text-slate-100">{label}</span>
                    <span className={probe.ready ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}>
                      {probe.ready ? 'ok' : 'missing'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    sample rows: {probe.sample_rows}
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
                    className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-[0_14px_26px_-18px_rgba(5,150,105,0.7)] hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {publishing ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                    {draft.job_id
                      ? t('company.job_editor.publish_update', { defaultValue: 'Publish update' })
                      : t('company.job_editor.publish', { defaultValue: 'Publish job' })}
                  </button>
                </div>
              </div>

              {statusMessage && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white"
                    placeholder={t('company.job_editor.role_title_placeholder', { defaultValue: 'Senior Product Designer' })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.hiring_stage', { defaultValue: 'Hiring status' })}
                  </label>
                  <select
                    value={draft.hiring_stage || DEFAULT_HIRING_STAGE}
                    onChange={(e) => patchDraft({ hiring_stage: e.target.value as JobHiringStage })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white"
                  >
                    {HIRING_STAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {t(`company.job_editor.hiring_stage.${option.value}`, { defaultValue: option.label })}
                      </option>
                    ))}
                  </select>
                  <div className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.hiring_stage_desc', {
                      defaultValue: 'Candidates will see where the process currently is and whether you are still actively reviewing.'
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.salary_from', { defaultValue: 'Salary from' })}
                  </label>
                  <input
                    value={draft.salary_from ?? ''}
                    onChange={(e) => patchDraft({ salary_from: normalizeNumber(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white"
                    placeholder={t('company.job_editor.salary_from_placeholder', { defaultValue: '60000' })}
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.salary_to', { defaultValue: 'Salary to' })}
                  </label>
                  <input
                    value={draft.salary_to ?? ''}
                    onChange={(e) => patchDraft({ salary_to: normalizeNumber(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white"
                    placeholder={t('company.job_editor.salary_to_placeholder', { defaultValue: '90000' })}
                    inputMode="numeric"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.contract_type', { defaultValue: 'Contract type' })}
                  </label>
                  <input
                    value={draft.contract_type || ''}
                    onChange={(e) => patchDraft({ contract_type: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white"
                    placeholder={t('company.job_editor.contract_type_placeholder', { defaultValue: 'HPP' })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('company.job_editor.work_setup', { defaultValue: 'Work setup' })}
                  </label>
                  <select
                    value={draft.work_model || 'On-site'}
                    onChange={(e) => patchDraft({ work_model: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white"
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
                {TEXT_SECTIONS.map((section) => (
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
                      className={`min-h-[140px] w-full rounded-xl border px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:text-white ${
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
                {t('company.job_editor.benefits_title', { defaultValue: 'Benefits and final review' })}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  {t('company.job_editor.benefits_label', { defaultValue: 'Benefits' })}
                </label>
                <textarea
                  value={(draft.benefits_structured || []).join('\n')}
                  onChange={(e) => patchDraft({ benefits_structured: compactLines(e.target.value) })}
                  className="min-h-[100px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white"
                  placeholder={t('company.job_editor.benefits_placeholder', { defaultValue: 'Add one benefit per line.' })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  {t('company.job_editor.change_summary_label', { defaultValue: 'What changed in this update?' })}
                </label>
                <input
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-white"
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
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">Transparency</div>
                  <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{validation.transparencyScore}</div>
                </div>
                <div className="company-surface-soft rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/20 p-3">
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">Clarity</div>
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
                    <div className="text-sm text-emerald-700 dark:text-emerald-300">No blocking issues.</div>
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
                    <div className="text-sm text-slate-500 dark:text-slate-400">No warnings.</div>
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
                    <div className="text-sm text-slate-500 dark:text-slate-400">No suggestions yet.</div>
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
