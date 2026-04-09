import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Save,
  Send,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Target,
  Zap,
  Users,
  MessageSquare,
  Upload,
  X,
  MapPin,
  Wallet,
} from 'lucide-react';
import type { CompanyProfile, JobChallengeFormat, JobDraft } from '../../../types';
import {
  createCompanyJobDraft,
  updateCompanyJobDraft,
  publishCompanyJobDraft,
} from '../../../services/companyJobDraftService';
import { callAiExecute } from '../../../services/mistralService';
import { uploadExternalAsset } from '../../../services/externalAssetService';

interface ChallengeEditorProps {
  companyProfile: CompanyProfile | null;
  initialFormat?: JobChallengeFormat;
  draft?: JobDraft | null;
  onBack: () => void;
  onSaved?: (draft: JobDraft) => void;
  onPublished?: (jobId: string) => void;
}

type EditorSection = 'essentials' | 'handshake' | 'human' | 'story' | 'benefits';

interface JobDraftUpsertInput {
  title?: string;
  challenge_format?: JobChallengeFormat;
  role_summary?: string;
  responsibilities?: string;
  requirements?: string;
  team_intro?: string;
  nice_to_have?: string;
  application_instructions?: string;
  first_reply_prompt?: string;
  company_goal?: string;
  company_truth_hard?: string;
  company_truth_fail?: string;
  publisher_name?: string;
  publisher_photo_url?: string | null;
  responders?: Array<{ name: string; role: string; photo?: string }>;
  benefits_structured?: string[];
  salary_from?: number | null;
  salary_to?: number | null;
  salary_currency?: string;
  salary_timeframe?: string;
  work_model?: string | null;
  workplace_address?: string | null;
  location_public?: string | null;
  contact_email?: string | null;
  editor_state?: Record<string, unknown> | null;
}

const formatPlaceholder = 'Write a real situation, not a slogan.';

const extractOptimizedText = (payload: any): string => {
  const direct = String(payload?.improved_text || '').trim();
  if (direct) return direct;
  const rewritten = String(payload?.result?.rewrittenText || '').trim();
  return rewritten;
};

const parseMoneyInput = (value: string): number | null => {
  const normalized = String(value || '').replace(/\s+/g, '').replace(',', '.').trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseTaggedHandshake = (value: string) => {
  const read = (tag: string) => {
    const match = value.match(new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\n\\[[^\\]]+\\]|$)`, 'i'));
    return String(match?.[1] || '').trim();
  };
  return {
    task: read('task'),
    goal: read('goal'),
    hard: read('hard'),
    fail: read('fail')
  };
};

export const ChallengeEditor: React.FC<ChallengeEditorProps> = ({
  companyProfile,
  initialFormat = 'standard',
  draft,
  onBack,
  onSaved,
  onPublished,
}) => {
  const { t } = useTranslation();
  const draftEditorState = (draft?.editor_state || {}) as Record<string, any>;
  const draftMicroJob = (draftEditorState.micro_job || {}) as Record<string, any>;
  const draftPublisher = (draftEditorState.publisher || {}) as Record<string, any>;

  // Init from existing draft
  const [format, setFormat] = useState<JobChallengeFormat>((draftMicroJob.challenge_format as JobChallengeFormat) || initialFormat);
  const [title, setTitle] = useState(draft?.title || '');
  const [roleSummary, setRoleSummary] = useState(draft?.role_summary || '');
  const [responsibilities, setResponsibilities] = useState(draft?.responsibilities || '');
  const [requirements, setRequirements] = useState(draft?.requirements || '');
  const [teamIntro, setTeamIntro] = useState(draft?.team_intro || '');
  const [niceToHave, setNiceToHave] = useState(draft?.nice_to_have || '');
  const [applicationInstructions, setApplicationInstructions] = useState(draft?.application_instructions || '');
  const [firstReplyPrompt, setFirstReplyPrompt] = useState(draft?.first_reply_prompt || '');
  const [companyGoal, setCompanyGoal] = useState(draft?.company_goal || '');
  const [companyTruthHard, setCompanyTruthHard] = useState(draft?.company_truth_hard || '');
  const [companyTruthFail, setCompanyTruthFail] = useState(draft?.company_truth_fail || '');
  const [publisherName, setPublisherName] = useState(String(draftPublisher.name || companyProfile?.name || ''));
  const [publisherPhoto, setPublisherPhoto] = useState<string | null>(String(draftPublisher.photo || '').trim() || null);
  const [responders, setResponders] = useState<Array<{ name: string; role: string; photo?: string }>>(
    Array.isArray(draftEditorState.responders) ? draftEditorState.responders : []
  );
  const [benefits, setBenefits] = useState<string[]>(draft?.benefits_structured || []);
  const [locationPublic, setLocationPublic] = useState(draft?.location_public || '');
  const [workplaceAddress, setWorkplaceAddress] = useState(draft?.workplace_address || '');
  const [workModel, setWorkModel] = useState(draft?.work_model || '');
  const [salaryFrom, setSalaryFrom] = useState(draft?.salary_from != null ? String(draft.salary_from) : '');
  const [salaryTo, setSalaryTo] = useState(draft?.salary_to != null ? String(draft.salary_to) : '');
  const [salaryCurrency, setSalaryCurrency] = useState(draft?.salary_currency || 'CZK');
  const [salaryTimeframe, setSalaryTimeframe] = useState(draft?.salary_timeframe || 'month');

  // UI state
  const [activeSection, setActiveSection] = useState<EditorSection>('essentials');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(draft?.id || null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const validationIssues: Array<{ type: 'error' | 'warning' | 'suggestion'; message: string }> = [];
  if (!title.trim()) validationIssues.push({ type: 'error', message: t('challenge_editor.validation.no_title', { defaultValue: 'Chybí název výzvy' }) });
  if (!roleSummary.trim()) validationIssues.push({ type: 'error', message: t('challenge_editor.validation.no_summary', { defaultValue: 'Chybí shrnutí role' }) });
  if (!responsibilities.trim()) validationIssues.push({ type: 'warning', message: t('challenge_editor.validation.no_responsibilities', { defaultValue: 'Chybí zodpovědnosti' }) });
  if (!requirements.trim()) validationIssues.push({ type: 'warning', message: t('challenge_editor.validation.no_requirements', { defaultValue: 'Chybí požadavky' }) });
  if (!publisherName.trim()) validationIssues.push({ type: 'warning', message: t('challenge_editor.validation.no_publisher', { defaultValue: 'Chybí jméno náboráře' }) });

  if (!locationPublic.trim()) validationIssues.push({ type: 'warning', message: t('challenge_editor.validation.no_location', { defaultValue: 'Public location is missing.' }) });
  if (!salaryFrom.trim() && !salaryTo.trim()) validationIssues.push({ type: 'suggestion', message: t('challenge_editor.validation.no_salary', { defaultValue: 'Salary is missing, which usually hurts trust and conversion.' }) });
  const errorCount = validationIssues.filter(i => i.type === 'error').length;
  const isMiniChallenge = format === 'micro_job';

  // Upload publisher photo
  const handlePhotoUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsUploadingPhoto(true);
    try {
      const asset = await uploadExternalAsset(file, 'attachment');
      setPublisherPhoto(asset.url);
    } catch (err) {
      console.error('Photo upload failed:', err);
      setError(t('challenge_editor.upload_error', { defaultValue: 'Nahrání fotky se nezdařilo' }));
    } finally {
      setIsUploadingPhoto(false);
    }
  }, [t]);

  // AI Optimize — uses Mistral via backend /ai/execute
  const handleAIOptimize = useCallback(async (section: string, currentValue: string) => {
    if (!currentValue.trim()) return;
    setIsOptimizing(true);
    setError(null);
    try {
      const result = await callAiExecute('optimize_job_description', {
        currentDescription: currentValue,
        companyProfile: companyProfile ? {
          name: companyProfile.name,
          industry: companyProfile.industry,
          values: companyProfile.values,
          philosophy: companyProfile.philosophy,
        } : null,
        sectionName: section,
      });
      const optimized = extractOptimizedText(result);
      if (optimized) {
        switch (section) {
          case 'role_summary': setRoleSummary(optimized); break;
          case 'responsibilities': setResponsibilities(optimized); break;
          case 'requirements': setRequirements(optimized); break;
          case 'team_intro': setTeamIntro(optimized); break;
          case 'nice_to_have': setNiceToHave(optimized); break;
          case 'application_instructions': setApplicationInstructions(optimized); break;
          case 'first_reply_prompt': setFirstReplyPrompt(optimized); break;
          case 'company_goal': setCompanyGoal(optimized); break;
          case 'company_truth_hard': setCompanyTruthHard(optimized); break;
          case 'company_truth_fail': setCompanyTruthFail(optimized); break;
        }
      } else {
        setError(t('challenge_editor.ai_error', { defaultValue: 'Mistral returned an empty suggestion.' }));
      }
    } catch (err) {
      console.error('AI optimization failed:', err);
      setError(t('challenge_editor.ai_error', { defaultValue: 'AI optimalizace se nezdařila. Zkuste to znovu.' }));
    } finally {
      setIsOptimizing(false);
    }
  }, [companyProfile, t]);

  const handleGenerateHandshakeDraft = useCallback(async () => {
    if (!title.trim() || !roleSummary.trim()) {
      setError(t('challenge_editor.handshake_needs_basics', { defaultValue: 'Fill in the title and role summary first so Mistral has enough context.' }));
      return;
    }

    setIsOptimizing(true);
    setError(null);
    try {
      const roleContext = [
        `Role: ${title}`,
        `Summary: ${roleSummary}`,
        `Responsibilities: ${responsibilities}`,
        `Requirements: ${requirements}`,
        `Location: ${locationPublic}`,
        `Work model: ${workModel}`,
        `Salary: ${salaryFrom || '?'}-${salaryTo || '?'} ${salaryCurrency} / ${salaryTimeframe}`,
        `Benefits: ${benefits.filter(Boolean).join(', ')}`
      ].join('\n');

      const result = await callAiExecute('optimize_job_description', {
        currentDescription: `Write a practical hiring handshake in Czech for this role.
Return ONLY these four blocks:
[task]
...
[goal]
...
[hard]
...
[fail]
...

Rules:
- Make the task feel like a real problem from practice.
- Keep it short enough for a 10-20 minute response.
- Show what good judgment looks like.
- Avoid generic HR language.

Context:
${roleContext}`,
        companyProfile: companyProfile ? {
          name: companyProfile.name,
          industry: companyProfile.industry,
          values: companyProfile.values,
          philosophy: companyProfile.philosophy,
        } : null,
        sectionName: 'handshake_generator',
      });

      const optimized = extractOptimizedText(result);
      const parsed = parseTaggedHandshake(optimized);
      if (!parsed.task || !parsed.goal || !parsed.hard || !parsed.fail) {
        setError(t('challenge_editor.ai_error', { defaultValue: 'Mistral did not return a usable handshake draft. Add a bit more role detail and try again.' }));
        return;
      }

      setFirstReplyPrompt(parsed.task);
      setCompanyGoal(parsed.goal);
      setCompanyTruthHard(parsed.hard);
      setCompanyTruthFail(parsed.fail);
    } catch (err) {
      console.error('Handshake generation failed:', err);
      setError(t('challenge_editor.ai_error', { defaultValue: 'Mistral could not draft the handshake right now.' }));
    } finally {
      setIsOptimizing(false);
    }
  }, [benefits, companyProfile, locationPublic, requirements, responsibilities, roleSummary, salaryCurrency, salaryFrom, salaryTimeframe, salaryTo, t, title, workModel]);

  // Build draft payload
  const buildDraftPayload = useCallback((): JobDraftUpsertInput => ({
    title,
    challenge_format: format,
    role_summary: roleSummary,
    responsibilities,
    requirements,
    team_intro: teamIntro,
    nice_to_have: niceToHave,
    application_instructions: applicationInstructions,
    first_reply_prompt: isMiniChallenge ? undefined : firstReplyPrompt,
    company_goal: isMiniChallenge ? undefined : companyGoal,
    company_truth_hard: isMiniChallenge ? undefined : companyTruthHard,
    company_truth_fail: isMiniChallenge ? undefined : companyTruthFail,
    publisher_name: publisherName,
    publisher_photo_url: publisherPhoto,
    responders,
    benefits_structured: benefits.filter(Boolean),
    salary_from: parseMoneyInput(salaryFrom),
    salary_to: parseMoneyInput(salaryTo),
    salary_currency: salaryCurrency,
    salary_timeframe: salaryTimeframe,
    work_model: workModel || null,
    workplace_address: workplaceAddress || null,
    location_public: locationPublic || null,
    contact_email: companyProfile ? '' : undefined,
    editor_state: {
      micro_job: { challenge_format: format },
      publisher: { name: publisherName, photo: publisherPhoto },
      responders,
    },
  }), [title, format, roleSummary, responsibilities, requirements, teamIntro, niceToHave, applicationInstructions, firstReplyPrompt, companyGoal, companyTruthHard, companyTruthFail, publisherName, publisherPhoto, responders, benefits, salaryFrom, salaryTo, salaryCurrency, salaryTimeframe, workModel, workplaceAddress, locationPublic, isMiniChallenge, companyProfile]);

  // Save draft
  const handleSave = useCallback(async () => {
    if (errorCount > 0) return;
    setIsSaving(true);
    setError(null);
    try {
      const payload = buildDraftPayload();
      let result: JobDraft;
      if (savedDraftId) {
        result = await updateCompanyJobDraft(savedDraftId, payload);
      } else {
        result = await createCompanyJobDraft(payload);
        setSavedDraftId(result.id);
      }
      setSaveFeedback(t('challenge_editor.saved', { defaultValue: 'Koncept uložen!' }));
      setTimeout(() => setSaveFeedback(null), 3000);
      onSaved?.(result);
    } catch (err) {
      console.error('Save failed:', err);
      setError(t('challenge_editor.save_error', { defaultValue: 'Uložení se nezdařilo' }));
    } finally {
      setIsSaving(false);
    }
  }, [errorCount, savedDraftId, buildDraftPayload, t, onSaved]);

  // Publish
  const handlePublish = useCallback(async () => {
    if (errorCount > 0) return;
    setIsPublishing(true);
    setError(null);
    try {
      // Save first, then publish
      const payload = buildDraftPayload();
      let draftId = savedDraftId;
      if (!draftId) {
        const draft = await createCompanyJobDraft(payload);
        draftId = draft.id;
        setSavedDraftId(draftId);
      } else {
        await updateCompanyJobDraft(draftId, payload);
      }
      const result = await publishCompanyJobDraft(String(draftId));
      setSaveFeedback(t('challenge_editor.published', { defaultValue: 'Výzva publikována!' }));
      setTimeout(() => setSaveFeedback(null), 3000);
      onPublished?.(String(result.job_id || draftId));
    } catch (err) {
      console.error('Publish failed:', err);
      setError(t('challenge_editor.publish_error', { defaultValue: 'Publikování se nezdařilo' }));
    } finally {
      setIsPublishing(false);
    }
  }, [errorCount, savedDraftId, buildDraftPayload, t, onPublished]);

  const sections: Array<{ key: EditorSection; icon: React.ComponentType<any>; label: string }> = [
    { key: 'essentials', icon: Target, label: t('challenge_editor.sections.essentials', { defaultValue: 'Základy' }) },
    { key: 'handshake', icon: MessageSquare, label: t('challenge_editor.sections.handshake', { defaultValue: 'Handshake' }) },
    { key: 'human', icon: Users, label: t('challenge_editor.sections.human', { defaultValue: 'Lidé' }) },
    { key: 'story', icon: Sparkles, label: t('challenge_editor.sections.story', { defaultValue: 'Příběh role' }) },
    { key: 'benefits', icon: CheckCircle, label: t('challenge_editor.sections.benefits', { defaultValue: 'Benefity' }) },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-50 pt-[var(--app-header-offset)] dark:bg-slate-950">
      {/* Sticky Header */}
      <div className="flex-shrink-0 sticky top-[var(--app-header-offset)] z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft size={18} className="text-slate-500" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isMiniChallenge
                    ? t('challenge_editor.mini_title', { defaultValue: 'Nová mini-výzva' })
                    : t('challenge_editor.standard_title', { defaultValue: 'Nová výzva' })}
                </h1>
                {isMiniChallenge && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                    <Zap size={10} />
                    MINI
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {companyProfile?.name || ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {errorCount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                <AlertTriangle size={12} />
                {errorCount}
              </span>
            )}

            {/* Save Draft */}
            <button
              onClick={handleSave}
              disabled={isSaving || isPublishing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saveFeedback || t('challenge_editor.save_draft', { defaultValue: 'Uložit koncept' })}
            </button>

            {/* Publish */}
            <button
              onClick={handlePublish}
              disabled={isPublishing || isSaving || errorCount > 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPublishing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {t('challenge_editor.publish', { defaultValue: 'Publikovat' })}
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/20 border-t border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertTriangle size={14} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600">×</button>
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex gap-1 px-4 pb-3 overflow-x-auto">
          {sections.map(({ key, icon: Icon, label }) => {
            if (isMiniChallenge && key === 'handshake') return null;
            const isActive = activeSection === key;
            return (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Essentials */}
          {activeSection === 'essentials' && (
            <div className="space-y-5">
              {/* Format */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  {t('challenge_editor.format_title', { defaultValue: 'Formát výzvy' })}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFormat('standard')}
                    className={`p-4 rounded-xl border-2 text-left transition-colors ${
                      format === 'standard' ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t('challenge_editor.format_standard', { defaultValue: 'Skill-first výzva' })}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {t('challenge_editor.format_standard_desc', { defaultValue: 'Praktický problém z role, který vytvoří použitelný hiring signál' })}
                    </div>
                  </button>
                  <button
                    onClick={() => setFormat('micro_job')}
                    className={`p-4 rounded-xl border-2 text-left transition-colors ${
                      format === 'micro_job' ? 'border-violet-500 bg-violet-500/5' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t('challenge_editor.format_mini', { defaultValue: 'Mini-výzva' })}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {t('challenge_editor.format_mini_desc', { defaultValue: 'Rychlý úkol/projekt — shrnutí, zodpovědnosti, instrukce' })}
                    </div>
                  </button>
                </div>
              </div>

              {/* Title */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
                <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
                  {t('challenge_editor.title_label', { defaultValue: 'Název výzvy' })}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={isMiniChallenge
                    ? t('challenge_editor.title_mini_placeholder', { defaultValue: 'např. Oprava webu pro e-shop' })
                    : t('challenge_editor.title_standard_placeholder', { defaultValue: 'např. Frontend Developer – React & Next.js' })}
                  className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              {/* Role Summary with AI */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t('challenge_editor.summary_label', { defaultValue: 'Shrnutí role' })}
                  </label>
                  <button
                    onClick={() => handleAIOptimize('role_summary', roleSummary)}
                    disabled={isOptimizing || !roleSummary.trim()}
                    className="inline-flex items-center gap-1 text-xs text-[var(--accent)] disabled:opacity-50"
                  >
                    <Sparkles size={12} />
                    {isOptimizing ? t('challenge_editor.ai_working', { defaultValue: 'AI pracuje...' }) : t('challenge_editor.ai_improve', { defaultValue: 'Vylepšit AI' })}
                  </button>
                </div>
                <textarea
                  value={roleSummary}
                  onChange={(e) => setRoleSummary(e.target.value)}
                  placeholder={isMiniChallenge
                    ? t('challenge_editor.summary_mini_placeholder', { defaultValue: 'Stručně popište úkol a co se očekává...' })
                    : t('challenge_editor.summary_standard_placeholder', { defaultValue: 'Popište roli, tým a co bude kandidát dělat...' })}
                  rows={4}
                  className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <MapPin size={16} className="text-[var(--accent)]" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t('challenge_editor.location_title', { defaultValue: 'Location and work model' })}
                    </h3>
                  </div>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={locationPublic}
                      onChange={(e) => setLocationPublic(e.target.value)}
                      placeholder={t('challenge_editor.location_public', { defaultValue: 'Public location, e.g. Prague / hybrid' })}
                      className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <input
                      type="text"
                      value={workplaceAddress}
                      onChange={(e) => setWorkplaceAddress(e.target.value)}
                      placeholder={t('challenge_editor.workplace_address', { defaultValue: 'Office or workplace address' })}
                      className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <select
                      value={workModel}
                      onChange={(e) => setWorkModel(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    >
                      <option value="">{t('challenge_editor.work_model_default', { defaultValue: 'Select work model' })}</option>
                      <option value="onsite">{t('challenge_editor.work_model_onsite', { defaultValue: 'On-site' })}</option>
                      <option value="hybrid">{t('challenge_editor.work_model_hybrid', { defaultValue: 'Hybrid' })}</option>
                      <option value="remote">{t('challenge_editor.work_model_remote', { defaultValue: 'Remote' })}</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Wallet size={16} className="text-[var(--accent)]" />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {t('challenge_editor.salary_title', { defaultValue: 'Salary transparency' })}
                    </h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={salaryFrom}
                      onChange={(e) => setSalaryFrom(e.target.value)}
                      placeholder={t('challenge_editor.salary_from', { defaultValue: 'From' })}
                      className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={salaryTo}
                      onChange={(e) => setSalaryTo(e.target.value)}
                      placeholder={t('challenge_editor.salary_to', { defaultValue: 'To' })}
                      className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <select
                      value={salaryCurrency}
                      onChange={(e) => setSalaryCurrency(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    >
                      <option value="CZK">CZK</option>
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                    </select>
                    <select
                      value={salaryTimeframe}
                      onChange={(e) => setSalaryTimeframe(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    >
                      <option value="month">{t('challenge_editor.salary_month', { defaultValue: 'Per month' })}</option>
                      <option value="year">{t('challenge_editor.salary_year', { defaultValue: 'Per year' })}</option>
                      <option value="hour">{t('challenge_editor.salary_hour', { defaultValue: 'Per hour' })}</option>
                      <option value="project_total">{t('challenge_editor.salary_project', { defaultValue: 'Per project' })}</option>
                    </select>
                  </div>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    {t('challenge_editor.salary_desc', { defaultValue: 'Show a real range. Missing salary usually lowers trust and response quality.' })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Handshake */}
          {activeSection === 'handshake' && !isMiniChallenge && (
            <div className="space-y-5">
              <div className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/5 shadow-sm p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-medium text-[var(--accent)]">
                      <Sparkles size={12} />
                      {t('challenge_editor.handshake_ai_badge', { defaultValue: 'Mistral assist' })}
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">
                      {t('challenge_editor.handshake_ai_title', { defaultValue: 'Generate the practical handshake from the role context' })}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {t('challenge_editor.handshake_ai_desc', { defaultValue: 'Mistral uses the role summary, location, salary and responsibilities to draft a short real-world assessment instead of a generic recruiter prompt.' })}
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateHandshakeDraft}
                    disabled={isOptimizing}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-dark)] disabled:opacity-50"
                  >
                    {isOptimizing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {t('challenge_editor.handshake_ai_cta', { defaultValue: 'Generate handshake draft' })}
                  </button>
                </div>
              </div>
              {[
                { key: 'first_reply_prompt', label: t('challenge_editor.first_reply_title', { defaultValue: 'Praktický task – co má kandidát skutečně vyřešit?' }), desc: t('challenge_editor.first_reply_desc', { defaultValue: 'Zadejte krátký úkol z praxe. Ideálně takový, na kterém během 10–20 minut uvidíte úsudek, priority a první tah.' }), value: firstReplyPrompt, setter: setFirstReplyPrompt },
                { key: 'company_goal', label: t('challenge_editor.company_goal_title', { defaultValue: 'Problém firmy – co má tahle role změnit?' }), desc: t('challenge_editor.company_goal_desc', { defaultValue: 'Tady definujete reálný problém, který kandidát řeší. Ne obecný claim o roli.' }), value: companyGoal, setter: setCompanyGoal },
                { key: 'company_truth_hard', label: t('challenge_editor.truth_hard_title', { defaultValue: 'Co je na situaci skutečně těžké?' }), desc: t('challenge_editor.truth_hard_desc', { defaultValue: 'Buďte upřímní. Právě tady vzniká rozhodovací hodnota practical assessmentu.' }), value: companyTruthHard, setter: setCompanyTruthHard },
                { key: 'company_truth_fail', label: t('challenge_editor.truth_fail_title', { defaultValue: 'Na čem obvykle lidé selžou nebo co špatně odhadnou?' }), desc: t('challenge_editor.truth_fail_desc', { defaultValue: 'Tohle dává kandidátovi jasný tradeoff a firmě lepší srovnání mezi odpověďmi.' }), value: companyTruthFail, setter: setCompanyTruthFail },
              ].map(({ key, label, desc, value, setter }) => (
                <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{label}</h3>
                      {desc && <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>}
                    </div>
                    <button
                      onClick={() => handleAIOptimize(key, value)}
                      disabled={isOptimizing || !value.trim()}
                      className="inline-flex items-center gap-1 text-xs text-[var(--accent)] disabled:opacity-50"
                    >
                      <Sparkles size={12} />
                      {t('challenge_editor.ai_improve', { defaultValue: 'Improve with Mistral' })}
                    </button>
                  </div>
                  <textarea
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={formatPlaceholder}
                    rows={3}
                    className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Human */}
          {activeSection === 'human' && (
            <div className="space-y-5">
              {/* Publisher with photo upload */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                  {t('challenge_editor.publisher_title', { defaultValue: 'Kdo výzvu publikuje?' })}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  {t('challenge_editor.publisher_desc', { defaultValue: 'Kandidát uvidí jméno a fotku náboráře. Osobní kontakt = důvěra.' })}
                </p>
                <div className="flex items-start gap-4">
                  {/* Photo */}
                  <div className="flex-shrink-0">
                    {publisherPhoto ? (
                      <div className="relative w-16 h-16 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        <img src={publisherPhoto} alt={publisherName} className="w-full h-full object-cover" />
                        <button
                          onClick={() => setPublisherPhoto(null)}
                          className="absolute top-0 right-0 p-1 bg-slate-900/60 text-white rounded-full hover:bg-rose-600 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer hover:border-[var(--accent)] transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoUpload(file);
                          }}
                        />
                        {isUploadingPhoto ? <Loader2 size={20} className="animate-spin text-slate-400" /> : <Upload size={20} className="text-slate-400" />}
                      </label>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={publisherName}
                      onChange={(e) => setPublisherName(e.target.value)}
                      placeholder={t('challenge_editor.publisher_placeholder', { defaultValue: 'např. Jana Nováková – HR Manager' })}
                      className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                  </div>
                </div>
              </div>

              {/* Responders */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t('challenge_editor.responders_title', { defaultValue: 'Odpovědní lidé (až 3)' })}
                  </h3>
                  <button
                    onClick={() => {
                      if (responders.length < 3) setResponders([...responders, { name: '', role: '' }]);
                    }}
                    disabled={responders.length >= 3}
                    className="text-xs text-[var(--accent)] disabled:opacity-50"
                  >
                    + {t('challenge_editor.add_responder', { defaultValue: 'Přidat' })}
                  </button>
                </div>
                {responders.map((r, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={r.name}
                      onChange={(e) => {
                        const updated = [...responders];
                        updated[i] = { ...r, name: e.target.value };
                        setResponders(updated);
                      }}
                      placeholder="Jméno"
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <input
                      type="text"
                      value={r.role}
                      onChange={(e) => {
                        const updated = [...responders];
                        updated[i] = { ...r, role: e.target.value };
                        setResponders(updated);
                      }}
                      placeholder="Role"
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <button
                      onClick={() => setResponders(responders.filter((_, idx) => idx !== i))}
                      className="px-2 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {responders.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    {t('challenge_editor.responders_empty', { defaultValue: 'Zatím žádní. Kandidáti mohou pokládat otázky vybraným členům týmu.' })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Story */}
          {activeSection === 'story' && (
            <div className="space-y-5">
              {[
                { key: 'responsibilities', label: t('challenge_editor.responsibilities_label', { defaultValue: 'Zodpovědnosti' }), value: responsibilities, setter: setResponsibilities, rows: 5 },
                { key: 'requirements', label: t('challenge_editor.requirements_label', { defaultValue: 'Požadavky' }), value: requirements, setter: setRequirements, rows: 5 },
                { key: 'team_intro', label: t('challenge_editor.team_intro_label', { defaultValue: 'Představení týmu' }), value: teamIntro, setter: setTeamIntro, rows: 3 },
                { key: 'nice_to_have', label: t('challenge_editor.nice_to_have_label', { defaultValue: 'Výhody (nice to have)' }), value: niceToHave, setter: setNiceToHave, rows: 3 },
                { key: 'application_instructions', label: t('challenge_editor.application_label', { defaultValue: 'Jak se přihlásit' }), value: applicationInstructions, setter: setApplicationInstructions, rows: 3 },
              ].map(({ key, label, value, setter, rows }) => (
                <div key={key} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-slate-900 dark:text-white">{label}</label>
                    <button
                      onClick={() => handleAIOptimize(key, value)}
                      disabled={isOptimizing || !value.trim()}
                      className="inline-flex items-center gap-1 text-xs text-[var(--accent)] disabled:opacity-50"
                    >
                      <Sparkles size={12} />
                      {isOptimizing ? t('challenge_editor.ai_working', { defaultValue: 'AI pracuje...' }) : t('challenge_editor.ai_improve', { defaultValue: 'Vylepšit AI' })}
                    </button>
                  </div>
                  <textarea
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder="..."
                    rows={rows}
                    className="w-full px-4 py-3 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Benefits */}
          {activeSection === 'benefits' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                {t('challenge_editor.benefits_title', { defaultValue: 'Benefity' })}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {t('challenge_editor.benefits_desc', { defaultValue: 'Co nabízíte navíc? Flexibilní hodiny, remote, vzdělávací rozpočet...' })}
              </p>
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  '3 remote days without manager-by-manager approval',
                  'Flexible start around school or family routine',
                  'Learning budget plus time to use it',
                  'Commute support or paid parking',
                  'Relocation or housing support',
                  'Mental health and recovery support'
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      if (!benefits.includes(suggestion)) setBenefits([...benefits, suggestion]);
                    }}
                    className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {benefits.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={b}
                      onChange={(e) => {
                        const updated = [...benefits];
                        updated[i] = e.target.value;
                        setBenefits(updated);
                      }}
                      placeholder="např. 4 dny home office"
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    />
                    <button
                      onClick={() => setBenefits(benefits.filter((_, idx) => idx !== i))}
                      className="px-2 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setBenefits([...benefits, ''])}
                  className="text-sm text-[var(--accent)] hover:underline"
                >
                  + {t('challenge_editor.add_benefit', { defaultValue: 'Přidat benefit' })}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
