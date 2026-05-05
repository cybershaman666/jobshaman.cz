import React from 'react';
import {
  BookOpen,
  Building2,
  Check,
  LayoutDashboard,
  Loader2,
  Paperclip,
  Settings2,
  Sparkles,
  Users,
} from 'lucide-react';

import type {
  ApplicationMessageAttachment,
  CompanyProfile,
  DialogueDetail,
  DialogueMessage,
  StoredAsset,
  UserProfile,
} from '../../types';
import {
  fetchCompanyApplicationDetail,
  fetchCompanyApplicationMessages,
  sendCompanyApplicationMessage,
} from '../../services/v2DialogueService';

import { InsightBadge } from '../candidate/CandidateShell';
import { cn } from '../cn';
import { deriveDashboardMetrics } from '../derivations';
import type { CalendarEvent, CandidateInsight, Company, HandshakeBlueprint, Role } from '../models';
import type { RecruiterTab } from '../routing';
import { roleFamilyLabel, generateAiBlueprint } from '../shellDomain';
import { getApplicationStatusCopy } from '../status';
import {
  fieldClass,
  panelClass,
  pillEyebrowClass,
  primaryButtonClass,
  secondaryButtonClass,
  shellPageClass,
  textareaClass,
} from '../ui/shellStyles';
import {
  AttachmentChip,
} from '../shared/dialogueUi';
import { RecruiterDashboardV2 } from './RecruiterDashboardV2';
import { DashboardLayoutV2 } from '../ui/DashboardLayoutV2';

export const RecruiterActivationPage: React.FC<{
  userProfile: UserProfile;
  busy: boolean;
  onActivate: (input: { companyName: string; website: string; industry: string }) => Promise<void>;
  t: (key: string, options?: { defaultValue?: string; account?: string }) => string;
}> = ({ userProfile, busy, onActivate, t }) => {
  const [companyName, setCompanyName] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const [industry, setIndustry] = React.useState('');
  const [error, setError] = React.useState('');

  const handleSubmit = async () => {
    setError('');
    try {
      await onActivate({ companyName, website, industry });
    } catch (activationError) {
      setError(activationError instanceof Error ? activationError.message : t('rebuild.recruiter.activation_error', { defaultValue: 'Failed to activate recruiter workspace.' }));
    }
  };

  return (
    <div className={shellPageClass}>
      <div className={cn(panelClass, 'mx-auto max-w-3xl p-8')}>
        <div className={pillEyebrowClass}>{t('rebuild.recruiter.activation_label', { defaultValue: 'Recruiter activation' })}</div>
        <h1 className="mt-3 text-[3rem] font-semibold leading-[0.95] tracking-[-0.07em] text-slate-900">{t('rebuild.recruiter.activation_title', { defaultValue: 'Turn your account into a company workspace.' })}</h1>
        <p className="mt-4 text-base leading-8 text-slate-600">
          {t('rebuild.recruiter.activation_copy', {
            defaultValue: '{{account}} is signed in. Add the company shell you want to manage and we will switch the account into Recruiter OS.',
            account: userProfile.email || userProfile.name || t('rebuild.recruiter.your_account', { defaultValue: 'Your account' }),
          })}
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-600">
            {t('rebuild.recruiter.company_name', { defaultValue: 'Company name' })}
            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            {t('rebuild.recruiter.industry', { defaultValue: 'Industry' })}
            <input value={industry} onChange={(event) => setIndustry(event.target.value)} className={fieldClass} />
          </label>
          <label className="block text-sm font-medium text-slate-600 md:col-span-2">
            {t('rebuild.recruiter.website', { defaultValue: 'Website' })}
            <input value={website} onChange={(event) => setWebsite(event.target.value)} className={fieldClass} />
          </label>
        </div>
        {error ? <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" disabled={busy || !companyName.trim()} onClick={() => void handleSubmit()} className={cn(primaryButtonClass, 'disabled:cursor-not-allowed disabled:opacity-60')}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
            {t('rebuild.recruiter.activate', { defaultValue: 'Activate Recruiter OS' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export const RecruiterShell: React.FC<{
  tab: RecruiterTab;
  navigate: (path: string) => void;
  userProfile: UserProfile;
  roles: Role[];
  blueprintLibrary: HandshakeBlueprint[];
  setBlueprintLibrary: React.Dispatch<React.SetStateAction<HandshakeBlueprint[]>>;
  roleAssignments: Record<string, string>;
  setRoleAssignments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  companyLibrary: Company[];
  setCompanyLibrary: React.Dispatch<React.SetStateAction<Company[]>>;
  recruiterCompany: CompanyProfile | null;
  recruiterCompanyHydrated: Company | null;
  onSaveRecruiterBrand: (company: Company) => Promise<void>;
  onCreateChallenge: (input: {
    title: string;
    roleFamily: Role['roleFamily'];
    location: string;
    workModel: Role['workModel'];
    summary: string;
    firstStep: string;
    salaryFrom: number | null;
    salaryTo: number | null;
    skills: string[];
  }) => Promise<Role>;
  onAiDraftChallenge: (input: {
    title?: string;
    roleFamily?: Role['roleFamily'];
    location?: string;
    workModel?: Role['workModel'];
    summary?: string;
    firstStep?: string;
    skills?: string[];
  }) => Promise<Record<string, unknown>>;
  onAiAssistChallenge: (roleId: string) => Promise<Role>;
  onPublishChallenge: (roleId: string) => Promise<Role>;
  onUploadCompanyAsset: (
    file: File,
    target: 'logo' | 'cover' | 'gallery' | 'reviewer-avatar' | 'handshake-material',
    companyId: string,
  ) => Promise<StoredAsset>;
  brandSaving: boolean;
  candidateInsights: CandidateInsight[];
  allRegisteredCandidates: CandidateInsight[];
  calendarEvents: CalendarEvent[];
  dashboardMetrics: ReturnType<typeof deriveDashboardMetrics>;
  rolePipelineStats: Record<string, { hasSubmission: boolean; hasSchedule: boolean }>;
  recruiterSearch: string;
  onRecruiterSearchChange: (value: string) => void;
  onSignOut: () => void;
  currentLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  t: (key: string, options?: Record<string, unknown> & { defaultValue?: string }) => string;
  i18n: { language: string; changeLanguage: (lng: string) => Promise<unknown> };
}> = ({
  tab,
  navigate,
  userProfile,
  roles,
  blueprintLibrary,
  setBlueprintLibrary,
  roleAssignments: _roleAssignments,
  setRoleAssignments,
  companyLibrary,
  setCompanyLibrary,
  recruiterCompany,
  recruiterCompanyHydrated,
  onSaveRecruiterBrand,
  onCreateChallenge,
  onAiDraftChallenge,
  onAiAssistChallenge,
  onPublishChallenge,
  onUploadCompanyAsset,
  brandSaving,
  candidateInsights,
  allRegisteredCandidates,
  calendarEvents,
  dashboardMetrics,
  rolePipelineStats: _rolePipelineStats,
  recruiterSearch,
  onRecruiterSearchChange: _onRecruiterSearchChange,
  onSignOut,
  currentLanguage,
  onLanguageChange,
  t,
  i18n: _i18n,
}) => {
  const [selectedCandidateId, setSelectedCandidateId] = React.useState(candidateInsights[0]?.id || '');
  const [draftRoleFamily, setDraftRoleFamily] = React.useState<Role['roleFamily']>('engineering');
  const [draftRoleTitle, setDraftRoleTitle] = React.useState('');
  const [draftRoleLocation, setDraftRoleLocation] = React.useState(recruiterCompany?.address || recruiterCompanyHydrated?.headquarters || 'Praha');
  const [draftRoleWorkModel, setDraftRoleWorkModel] = React.useState<Role['workModel']>('Hybrid');
  const [draftRoleSummary, setDraftRoleSummary] = React.useState('');
  const [draftRoleFirstStep, setDraftRoleFirstStep] = React.useState('');
  const [draftRoleSalaryFrom, setDraftRoleSalaryFrom] = React.useState('');
  const [draftRoleSalaryTo, setDraftRoleSalaryTo] = React.useState('');
  const [draftRoleSkills, setDraftRoleSkills] = React.useState('');
  const [challengeSaving, setChallengeSaving] = React.useState(false);
  const [challengeAiDraftBusy, setChallengeAiDraftBusy] = React.useState(false);
  const [challengeBusyId, setChallengeBusyId] = React.useState<string | null>(null);
  const [challengeNotice, setChallengeNotice] = React.useState('');
  const [challengeError, setChallengeError] = React.useState('');
  const [selectedCompanyId, setSelectedCompanyId] = React.useState(recruiterCompanyHydrated?.id || companyLibrary[0]?.id || '');
  const [selectedRecruiterDialogueDetail, setSelectedRecruiterDialogueDetail] = React.useState<DialogueDetail | null>(null);
  const [selectedRecruiterDialogueMessages, setSelectedRecruiterDialogueMessages] = React.useState<DialogueMessage[]>([]);
  const [recruiterDialogueLoading, setRecruiterDialogueLoading] = React.useState(false);
  const [recruiterMessageBusy, setRecruiterMessageBusy] = React.useState(false);
  const [recruiterMessageDraft, setRecruiterMessageDraft] = React.useState('');
  const [recruiterMessageAttachments, setRecruiterMessageAttachments] = React.useState<ApplicationMessageAttachment[]>([]);

  const [_recruiterThreadNotice, setRecruiterThreadNotice] = React.useState('');
  const [_recruiterThreadError, setRecruiterThreadError] = React.useState('');
  const [brandAssetBusy, setBrandAssetBusy] = React.useState<string | null>(null);
  const recruiterAttachmentInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!companyLibrary.some((company) => company.id === selectedCompanyId)) {
      setSelectedCompanyId(recruiterCompanyHydrated?.id || companyLibrary[0]?.id || '');
    }
  }, [companyLibrary, recruiterCompanyHydrated, selectedCompanyId]);

  const selectedCompany = companyLibrary.find((company) => company.id === selectedCompanyId)
    || (recruiterCompanyHydrated && recruiterCompanyHydrated.id === selectedCompanyId ? recruiterCompanyHydrated : null)
    || recruiterCompanyHydrated
    || companyLibrary[0];

  const draftCompleteness = React.useMemo(() => {
    const required = [draftRoleTitle, draftRoleSummary, draftRoleFirstStep].filter((value) => value.trim()).length;
    return Math.round((required / 3) * 100);
  }, [draftRoleFirstStep, draftRoleSummary, draftRoleTitle]);

  const challengeScore = React.useMemo(() => {
    let score = 34;
    if (draftRoleTitle.trim().length >= 12) score += 14;
    if (draftRoleSummary.trim().length >= 80) score += 22;
    if (draftRoleFirstStep.trim().length >= 80) score += 18;
    if (draftRoleSkills.split(',').filter((item) => item.trim()).length >= 3) score += 8;
    if (draftRoleLocation.trim()) score += 4;
    return Math.min(96, score);
  }, [draftRoleFirstStep, draftRoleLocation, draftRoleSkills, draftRoleSummary, draftRoleTitle]);

  const challengeChecks = React.useMemo(() => [
    {
      label: t('rebuild.recruiter.check_well_defined_goal', { defaultValue: 'Well-defined goal' }),
      copy: draftRoleTitle.trim().length >= 12 ? t('rebuild.recruiter.check_goal_ok', { defaultValue: 'Challenge is specific and understandable.' }) : t('rebuild.recruiter.check_goal_hint', { defaultValue: 'Name the outcome, not just the position.' }),
      done: draftRoleTitle.trim().length >= 12,
    },
    {
      label: t('rebuild.recruiter.check_clear_impact', { defaultValue: 'Clear impact' }),
      copy: draftRoleSummary.trim().length >= 80 ? t('rebuild.recruiter.check_impact_ok', { defaultValue: 'Impact on team or business is described.' }) : t('rebuild.recruiter.check_impact_hint', { defaultValue: 'Explain why the challenge matters.' }),
      done: draftRoleSummary.trim().length >= 80,
    },
    {
      label: t('rebuild.recruiter.check_motivating_context', { defaultValue: 'Motivating context' }),
      copy: draftRoleSummary.trim().length >= 140 ? t('rebuild.recruiter.check_context_ok', { defaultValue: 'Candidate will understand the broader situation.' }) : t('rebuild.recruiter.check_context_hint', { defaultValue: 'Add background and expectations.' }),
      done: draftRoleSummary.trim().length >= 140,
    },
    {
      label: t('rebuild.recruiter.check_realistic_scope', { defaultValue: 'Realistic scope' }),
      copy: draftRoleFirstStep.trim().length >= 80 ? t('rebuild.recruiter.check_scope_ok', { defaultValue: 'Assessment task is feasible.' }) : t('rebuild.recruiter.check_scope_hint', { defaultValue: 'Describe specific deliverables.' }),
      done: draftRoleFirstStep.trim().length >= 80,
    },
  ], [draftRoleFirstStep, draftRoleSummary, draftRoleTitle, t]);




  const applyAiDraftOutput = (output: Record<string, unknown>) => {
    const title = String(output.title || '').trim();
    const problemStatement = String(output.problem_statement || '').trim();
    const taskBrief = String(output.task_brief || output.candidate_task || '').trim();
    const skills = Array.isArray(output.skills) ? output.skills.map((item) => String(item).trim()).filter(Boolean) : [];
    if (title) setDraftRoleTitle(title);
    if (problemStatement) setDraftRoleSummary(problemStatement);
    if (taskBrief) setDraftRoleFirstStep(taskBrief);
    if (skills.length) setDraftRoleSkills(skills.slice(0, 10).join(', '));
    setChallengeNotice(t('rebuild.recruiter.ai_draft_ready', { defaultValue: 'Mistral has prepared a draft of the challenge and assessment. Review it and confirm by saving.' }));
  };

  const handleMistralDraftAssist = async () => {
    setChallengeAiDraftBusy(true);
    setChallengeError('');
    setChallengeNotice('');
    try {
      const output = await onAiDraftChallenge({
        title: draftRoleTitle,
        roleFamily: draftRoleFamily,
        location: draftRoleLocation,
        workModel: draftRoleWorkModel,
        summary: draftRoleSummary,
        firstStep: draftRoleFirstStep,
        skills: draftRoleSkills.split(',').map((item) => item.trim()).filter(Boolean),
      });
      applyAiDraftOutput(output);
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : t('rebuild.recruiter.ai_draft_error', { defaultValue: 'Failed to create AI proposal.' }));
    } finally {
      setChallengeAiDraftBusy(false);
    }
  };

  const handleCreateChallenge = async () => {
    setChallengeError('');
    setChallengeNotice('');
    const title = draftRoleTitle.trim();
    const summary = draftRoleSummary.trim();
    const firstStep = draftRoleFirstStep.trim();
    if (!title || !summary || !firstStep) {
      setChallengeError(t('rebuild.recruiter.incomplete_challenge_error', { defaultValue: 'Please fill in the title, challenge context, and first step for the candidate.' }));
      return;
    }
    setChallengeSaving(true);
    try {
      const blueprint = generateAiBlueprint(draftRoleFamily, title);
      const createdRole = await onCreateChallenge({
        title,
        roleFamily: draftRoleFamily,
        location: draftRoleLocation.trim() || selectedCompany?.headquarters || t('rebuild.recruiter.location_tbd', { defaultValue: 'Lokalita bude upřesněna' }),
        workModel: draftRoleWorkModel,
        summary,
        firstStep,
        salaryFrom: draftRoleSalaryFrom ? Number(draftRoleSalaryFrom) : null,
        salaryTo: draftRoleSalaryTo ? Number(draftRoleSalaryTo) : null,
        skills: draftRoleSkills.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 12),
      });
      const assignedBlueprint = { ...blueprint, id: `${blueprint.id}-${createdRole.id}` };
      setBlueprintLibrary((current) => [assignedBlueprint, ...current]);
      setRoleAssignments((current) => ({ ...current, [createdRole.id]: assignedBlueprint.id }));
      setChallengeNotice(t('rebuild.recruiter.challenge_saved', { defaultValue: 'Challenge is saved and ready for candidate handshake.' }));
      setDraftRoleTitle('');
      setDraftRoleSummary('');
      setDraftRoleFirstStep('');
      setDraftRoleSkills('');
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : t('rebuild.recruiter.challenge_save_error', { defaultValue: 'Failed to save the challenge.' }));
    } finally {
      setChallengeSaving(false);
    }
  };

  const handleAiAssistChallenge = async (roleId: string) => {
    setChallengeBusyId(roleId);
    setChallengeError('');
    setChallengeNotice('');
    try {
      await onAiAssistChallenge(roleId);
      setChallengeNotice(t('rebuild.recruiter.ai_tasks_ready', { defaultValue: 'AI task proposal is ready. Please confirm it before publication.' }));
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : 'AI návrh se nepodařilo vytvořit.');
    } finally {
      setChallengeBusyId(null);
    }
  };

  const handlePublishChallenge = async (roleId: string) => {
    setChallengeBusyId(roleId);
    setChallengeError('');
    setChallengeNotice('');
    try {
      await onPublishChallenge(roleId);
      setChallengeNotice(t('rebuild.recruiter.challenge_published', { defaultValue: 'Challenge is published in the marketplace and ready for handshake.' }));
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : t('rebuild.recruiter.publish_error', { defaultValue: 'Failed to publish the challenge.' }));
    } finally {
      setChallengeBusyId(null);
    }
  };

  const updateSelectedCompany = (updater: (company: Company) => Company) => {
    if (!selectedCompany) return;
    setCompanyLibrary((current) => {
      const exists = current.some((company) => company.id === selectedCompany.id);
      if (!exists) return [updater(selectedCompany), ...current];
      return current.map((company) => (company.id === selectedCompany.id ? updater(company) : company));
    });
  };

  const handleCompanyAssetUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    target: 'logo' | 'cover' | 'gallery' | 'reviewer-avatar' | 'handshake-material',
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedCompany?.id) return;
    setBrandAssetBusy(target);
    try {
      const asset = await onUploadCompanyAsset(file, target, selectedCompany.id);
      updateSelectedCompany((company) => {
        if (target === 'logo') {
          return { ...company, logo: asset.url, logoAsset: asset };
        }
        if (target === 'cover') {
          return { ...company, coverImage: asset.url, coverAsset: asset };
        }
        if (target === 'reviewer-avatar') {
          return {
            ...company,
            reviewerAvatarAsset: asset,
            reviewer: { ...company.reviewer, avatarUrl: asset.url },
          };
        }
        if (target === 'gallery') {
          return { ...company, gallery: [...company.gallery, asset] };
        }
        return { ...company, handshakeMaterials: [...company.handshakeMaterials, asset] };
      });
    } finally {
      setBrandAssetBusy(null);
    }
  };

  const normalizedRecruiterSearch = recruiterSearch.trim().toLowerCase();
  const visibleRoles = React.useMemo(
    () => roles.filter((role) => {
      if (!normalizedRecruiterSearch) return true;
      const haystack = [role.title, role.companyName, role.team, role.location, role.summary, ...role.skills].join(' ').toLowerCase();
      return haystack.includes(normalizedRecruiterSearch);
    }),
    [normalizedRecruiterSearch, roles],
  );

  const talentPoolCandidates = React.useMemo(() => {
    if (tab !== 'talent-pool') return candidateInsights;
    const roleTokens = new Set(
      visibleRoles
        .flatMap((role) => [role.title, role.challenge, role.summary, ...role.skills])
        .join(' ')
        .toLowerCase()
        .split(/[^a-z0-9á-ž]+/i)
        .filter((token) => token.length > 3),
    );
    return allRegisteredCandidates
      .map((candidate) => {
        const candidateTokens = [candidate.headline, candidate.recommendation, ...candidate.topSignals]
          .join(' ')
          .toLowerCase()
          .split(/[^a-z0-9á-ž]+/i)
          .filter((token) => token.length > 3);
        const overlap = candidateTokens.filter((token) => roleTokens.has(token)).length;
        const score = roleTokens.size > 0
          ? Math.max(35, Math.min(96, 48 + overlap * 8 + Math.min(candidate.topSignals.length * 3, 12)))
          : Math.max(35, Math.min(82, candidate.matchPercent || 50));
        return {
          ...candidate,
          matchPercent: score,
          verifiedScore: score,
          internalNote: overlap > 0
            ? `${t('rebuild.recruiter.relevant_signals', { defaultValue: 'Relevant signals relative to current challenges' })}: ${overlap}.`
            : t('rebuild.recruiter.no_strong_link', { defaultValue: 'No strong link to active challenges yet.' }),
        };
      })
      .sort((left, right) => right.matchPercent - left.matchPercent);
  }, [allRegisteredCandidates, candidateInsights, tab, visibleRoles]);
  const visibleCandidateInsights = React.useMemo(
    () => talentPoolCandidates.filter((candidate) => {
      if (!normalizedRecruiterSearch) return true;
      const haystack = [
        candidate.candidateName,
        candidate.headline,
        candidate.location,
        candidate.recommendation,
        candidate.internalNote,
        ...candidate.topSignals,
      ].join(' ').toLowerCase();
      return haystack.includes(normalizedRecruiterSearch);
    }),
    [talentPoolCandidates, normalizedRecruiterSearch],
  );

  React.useEffect(() => {
    if (!visibleCandidateInsights.some((candidate) => candidate.id === selectedCandidateId)) {
      setSelectedCandidateId(visibleCandidateInsights[0]?.id || '');
    }
  }, [selectedCandidateId, visibleCandidateInsights]);

  const selectedCandidate = visibleCandidateInsights.find((candidate) => candidate.id === selectedCandidateId) || visibleCandidateInsights[0];
  const selectedRecruiterDialogueId = React.useMemo(
    () => (selectedCandidate?.id.startsWith('application-') ? selectedCandidate.id.replace('application-', '') : ''),
    [selectedCandidate?.id],
  );
  const selectedCandidateScoreLabel = React.useMemo(() => {
    const score = selectedCandidate?.verifiedScore || selectedCandidate?.matchPercent || 0;
    if (score >= 85) return t('rebuild.recruiter.match_very_strong', { defaultValue: 'Very strong match' });
    if (score >= 70) return t('rebuild.recruiter.match_strong', { defaultValue: 'Strong match' });
    if (score >= 55) return t('rebuild.recruiter.match_good', { defaultValue: 'Good match' });
    if (score > 0) return t('rebuild.recruiter.match_exploratory', { defaultValue: 'Exploratory match' });
    return t('rebuild.recruiter.match_none', { defaultValue: 'No evaluation yet' });
  }, [selectedCandidate?.matchPercent, selectedCandidate?.verifiedScore]);

  React.useEffect(() => {
    if (!selectedRecruiterDialogueId) {
      setSelectedRecruiterDialogueDetail(null);
      setSelectedRecruiterDialogueMessages([]);
      setRecruiterDialogueLoading(false);
      return;
    }
    let active = true;
    setRecruiterDialogueLoading(true);
    void Promise.all([
      fetchCompanyApplicationDetail(selectedRecruiterDialogueId),
      fetchCompanyApplicationMessages(selectedRecruiterDialogueId),
    ])
      .then(([detail, messages]) => {
        if (!active) return;
        setSelectedRecruiterDialogueDetail(detail);
        setSelectedRecruiterDialogueMessages(messages);

      })
      .catch((error) => {
        console.error('Failed to load recruiter dialogue thread in rebuild shell', error);
        if (!active) return;
        setSelectedRecruiterDialogueDetail(null);
        setSelectedRecruiterDialogueMessages([]);
      })
      .finally(() => {
        if (active) setRecruiterDialogueLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedRecruiterDialogueId]);


  const visibleCalendarEvents = React.useMemo(
    () => calendarEvents.filter((event) => {
      if (!normalizedRecruiterSearch) return true;
      return `${event.title} ${event.note} ${event.stage}`.toLowerCase().includes(normalizedRecruiterSearch);
    }),
    [calendarEvents, normalizedRecruiterSearch],
  );

  const scopedDashboardMetrics = React.useMemo(
    () => normalizedRecruiterSearch
      ? {
          ...dashboardMetrics,
          curatedRoles: visibleRoles.filter((role) => role.source === 'curated').length,
          importedRoles: visibleRoles.filter((role) => role.source === 'imported').length,
          candidates: visibleCandidateInsights.length,
          interviewsBooked: visibleCalendarEvents.filter((event) => event.stage === 'panel').length,
        }
      : dashboardMetrics,
    [dashboardMetrics, normalizedRecruiterSearch, visibleCalendarEvents, visibleCandidateInsights.length, visibleRoles],
  );


  const handleRecruiterSendMessage = async () => {
    if (!selectedRecruiterDialogueId || (!recruiterMessageDraft.trim() && recruiterMessageAttachments.length === 0)) return;
    setRecruiterMessageBusy(true);
    try {
      setRecruiterThreadError('');
      setRecruiterThreadNotice('');
      const message = await sendCompanyApplicationMessage(selectedRecruiterDialogueId, {
        body: recruiterMessageDraft.trim(),
        attachments: recruiterMessageAttachments,
      });
      if (!message) throw new Error('Failed to send recruiter message.');
      setSelectedRecruiterDialogueMessages((current) => [...current, message]);
      setRecruiterMessageDraft('');
      setRecruiterMessageAttachments([]);
      setRecruiterThreadNotice('Recruiter message sent into the live dialogue lane.');
    } catch (error) {
      setRecruiterThreadError(error instanceof Error ? error.message : 'Failed to send recruiter message.');
    } finally {
      setRecruiterMessageBusy(false);
    }
  };


  const navItems: Array<{ id: RecruiterTab; label: string; icon: React.ComponentType<{ size?: string | number; className?: string }>; path: string }> = [
    { id: 'dashboard', label: t('rebuild.recruiter.nav_dashboard', { defaultValue: 'Overview' }), icon: LayoutDashboard, path: '/recruiter' },
    { id: 'roles', label: t('rebuild.recruiter.nav_roles', { defaultValue: 'Roles' }), icon: BookOpen, path: '/recruiter/roles' },
    { id: 'talent-pool', label: t('rebuild.recruiter.nav_candidates', { defaultValue: 'Candidates' }), icon: Users, path: '/recruiter/talent-pool' },
    { id: 'settings', label: t('rebuild.recruiter.nav_company_profile', { defaultValue: 'Company profile' }), icon: Settings2, path: '/recruiter/settings' },
  ];
  const workspaceTitle = tab === 'roles'
    ? t('rebuild.recruiter.nav_roles', { defaultValue: 'Role' })
    : tab === 'talent-pool'
      ? t('rebuild.recruiter.nav_candidates', { defaultValue: 'Kandidáti' })
      : t('rebuild.recruiter.nav_company_profile', { defaultValue: 'Firemní profil' });
  const workspaceSubtitle = tab === 'roles'
    ? t('rebuild.recruiter.subtitle_roles', { defaultValue: 'Role assignments, evidence of ability, and skill-first selection management.' })
    : tab === 'talent-pool'
      ? t('rebuild.recruiter.subtitle_candidates', { defaultValue: 'Candidate profiles, recruiter readout, and shared threads in one decision space.' })
      : t('rebuild.recruiter.subtitle_settings', { defaultValue: 'Brand, media, and contact persons as a single source of truth.' });

  const shouldRenderDashboardV2 = tab === 'dashboard';
  if (shouldRenderDashboardV2) {
    return (
      <RecruiterDashboardV2
        navigate={navigate}
        userProfile={userProfile}
        recruiterCompany={recruiterCompanyHydrated || recruiterCompany}
        roles={visibleRoles}
        blueprintLibrary={blueprintLibrary}
        candidateInsights={visibleCandidateInsights}
        dashboardMetrics={scopedDashboardMetrics}
        onSignOut={onSignOut}
        currentLanguage={currentLanguage}
        onLanguageChange={onLanguageChange}
        t={t}
      />
    );
  }

  return (
    <DashboardLayoutV2
      userRole="recruiter"
      navItems={navItems}
      activeItemId={tab}
      onNavigate={(_id, path) => { if (path) navigate(path); }}
      userProfile={userProfile}
      onSignOut={onSignOut}
      title={workspaceTitle}
      subtitle={workspaceSubtitle}
      searchValue={recruiterSearch}
      onSearchChange={_onRecruiterSearchChange}
      onPrimaryActionClick={() => navigate('/recruiter/roles')}
      currentLanguage={currentLanguage}
      onLanguageChange={onLanguageChange}
      contentClassName={tab === 'roles' ? 'max-w-none' : undefined}
      actionRegion={
        <button type="button" onClick={() => navigate('/candidate/insights')} className={secondaryButtonClass}>
          {t('rebuild.recruiter.candidate_view', { defaultValue: 'Candidate view' })}
        </button>
      }
      t={t}
    >

          {Boolean(false) ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.recruiter.command_center', { defaultValue: 'Company overview' })}</div>
                  <h1 className="mt-2 text-[2.7rem] font-semibold tracking-[-0.06em] text-slate-900">{t('rebuild.recruiter.command_desc', { defaultValue: 'Overview of roles, candidates, and next steps.' })}</h1>
                </div>
                <button type="button" onClick={() => navigate('/recruiter/roles')} className={primaryButtonClass}>{t('rebuild.recruiter.create_process', { defaultValue: 'Create process' })} <Sparkles size={16} /></button>
              </div>
              <div className="grid gap-4 xl:grid-cols-4">
                <InsightBadge label={t('rebuild.badge.curated_roles', { defaultValue: 'Curated roles' })} value={String(scopedDashboardMetrics.curatedRoles)} />
                <InsightBadge label={t('rebuild.badge.blueprints', { defaultValue: 'Blueprints' })} value={String(scopedDashboardMetrics.blueprints)} />
                <InsightBadge label={t('rebuild.badge.candidates', { defaultValue: 'Candidates' })} value={String(scopedDashboardMetrics.candidates)} />
                <InsightBadge label={t('rebuild.badge.interviews_booked', { defaultValue: 'Interviews booked' })} value={String(scopedDashboardMetrics.interviewsBooked)} />
              </div>
              <div className="grid gap-5 xl:grid-cols-[320px_1fr_320px]">
                <div className={cn(panelClass, 'p-5')}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.recruiter.refine', { defaultValue: 'Refine analysis' })}</div>
                  <div className="mt-4 space-y-5 text-sm text-slate-700">
                    <div>
                      <div className="font-semibold">{t('rebuild.recruiter.exp_level', { defaultValue: 'Experience level' })}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {([t('rebuild.level.senior', { defaultValue: 'Senior' }), t('rebuild.level.lead', { defaultValue: 'Lead' }), t('rebuild.level.principal', { defaultValue: 'Principal' })] as const).map((level, index) => (
                          <span key={level} className={cn('rounded-full px-3 py-1.5', index === 0 ? 'bg-[#12AFCB] text-white' : 'bg-slate-100')}>{level}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold">{t('rebuild.recruiter.competencies', { defaultValue: 'Core competencies' })}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {['PyTorch', 'NLP', 'Transformers', 'Docker', 'Kubernetes'].map((tag, index) => (
                          <span key={tag} className={cn('rounded-full px-3 py-1.5 text-xs font-medium', index < 3 ? 'bg-[#12AFCB] text-white' : 'bg-slate-100')}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    <button type="button" className={secondaryButtonClass}>{t('rebuild.recruiter.apply_filters', { defaultValue: 'Apply filters' })}</button>
                  </div>
                </div>
                <div className={cn(panelClass, 'p-6')}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xl font-semibold tracking-[-0.04em] text-slate-900">{t('rebuild.recruiter.competency_matrix', { defaultValue: 'Aggregated competency matrix' })}</div>
                      <div className="mt-2 text-sm text-slate-500">{t('rebuild.recruiter.competency_matrix_copy', { defaultValue: 'Performance across the current selection pool.' })}</div>
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">{t('rebuild.recruiter.overall', { defaultValue: 'Overall' })}</div>
                  </div>
                  <div className="mt-8 flex items-center justify-center">
                    <svg width="360" height="280" viewBox="0 0 360 280" className="max-w-full">
                      <polygon points="180,24 284,86 252,210 108,210 76,86" fill="rgba(18,175,203,0.10)" stroke="#12AFCB" strokeWidth="3" />
                      {[
                        t('rebuild.recruiter.axis_technical_depth', { defaultValue: 'Technical Depth' }),
                        t('rebuild.recruiter.axis_soft_skills', { defaultValue: 'Soft Skills' }),
                        t('rebuild.recruiter.axis_logic', { defaultValue: 'Logic' }),
                        t('rebuild.recruiter.axis_leadership', { defaultValue: 'Leadership' }),
                        t('rebuild.recruiter.axis_creativity', { defaultValue: 'Creativity' }),
                        t('rebuild.recruiter.axis_agility', { defaultValue: 'Agility' }),
                      ].map((label, index) => (
                        <text key={label} x={[180, 310, 280, 180, 65, 35][index]} y={[14, 88, 226, 248, 226, 88][index]} fontSize="11" fill="#64748b" textAnchor="middle">{label}</text>
                      ))}
                    </svg>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.recruiter.elite_tier', { defaultValue: 'Elite talent tier' })}</div>
                  {visibleCandidateInsights.slice(0, 4).map((candidate, index) => (
                    <div key={candidate.id} className={cn(panelClass, 'flex items-center justify-between gap-3 p-4', index === 0 && 'border-[#12AFCB]/40')}>
                      <div>
                        <div className="text-lg font-semibold tracking-[-0.03em] text-slate-900">{candidate.candidateName}</div>
                        <div className="mt-1 text-sm text-slate-500">{candidate.matchPercent}% {t('rebuild.recruiter.technical_match', { defaultValue: 'technical match' })}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-[#0f95ac]">{t('rebuild.recruiter.rank', { defaultValue: 'Rank' })} #{index + 1}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-400">{t('rebuild.recruiter.high_signal', { defaultValue: 'High signal' })}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'roles' ? (
            <div className="space-y-6">
              <div className="rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_24px_80px_-64px_rgba(15,23,42,0.42)] dark:shadow-none">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <button type="button" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-[#1f5fbf]">
                      <span>←</span>
                      {t('rebuild.recruiter.back_to_roles', { defaultValue: 'Back to roles' })}
                    </button>
                    <h1 className="text-[2rem] font-semibold tracking-[-0.045em] text-slate-900">{t('rebuild.recruiter.create_challenge_title', { defaultValue: 'Create a new challenge ✨' })}</h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{t('rebuild.recruiter.create_challenge_desc', { defaultValue: 'A quality challenge will attract the right people. Describe the situation, impact, and first assessment task.' })}</p>
                  </div>
                  <button type="button" onClick={() => void handleCreateChallenge()} disabled={challengeSaving} className={cn(primaryButtonClass, 'rounded-[8px] bg-[#c28a2c] hover:bg-[#a87421] disabled:cursor-not-allowed disabled:opacity-60')}>
                    {challengeSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    {t('rebuild.recruiter.save_challenge', { defaultValue: 'Save challenge' })}
                  </button>
                </div>

                <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
                  <div className="space-y-4">
                    <section className="grid overflow-hidden rounded-[8px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 md:grid-cols-[230px_minmax(0,1fr)]">
                      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-5 md:border-b-0 md:border-r">
                        {[
                          ['1', t('rebuild.recruiter.step1_title', { defaultValue: 'Essence of the challenge' }), t('rebuild.recruiter.step1_desc', { defaultValue: 'What is the goal and why it matters' }), draftRoleTitle || draftRoleSummary],
                          ['2', t('rebuild.recruiter.step2_title', { defaultValue: 'Area and collaboration' }), t('rebuild.recruiter.step2_desc', { defaultValue: 'Categorization and way of working' }), draftRoleFamily || draftRoleWorkModel],
                          ['3', t('rebuild.recruiter.step3_title', { defaultValue: 'Context for candidate' }), t('rebuild.recruiter.step3_desc', { defaultValue: 'Background, motivation, and expectations' }), draftRoleSummary],
                          ['4', t('rebuild.recruiter.step4_title', { defaultValue: 'Assessment task' }), t('rebuild.recruiter.step4_desc', { defaultValue: 'First skill test' }), draftRoleFirstStep],
                          ['5', t('rebuild.recruiter.step5_title', { defaultValue: 'Preview and publication' }), t('rebuild.recruiter.step5_desc', { defaultValue: 'Check and publish' }), draftCompleteness === 100 ? 'done' : ''],
                        ].map(([index, label, copy, value], itemIndex) => {
                          const active = itemIndex === 0;
                          const complete = String(value).trim().length > 0;
                          return (
                            <div key={label} className={cn('flex gap-3 rounded-[8px] px-3 py-3', active ? 'bg-[#fff7e8]' : '')}>
                              <span className={cn('mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold', active ? 'border-[#c28a2c] bg-[#c28a2c] text-white dark:border-amber-600 dark:bg-amber-600' : complete ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400' : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400')}>
                                {complete && !active ? <Check size={13} /> : index}
                              </span>
                              <span>
                                <span className={cn('block text-sm font-bold', active ? 'text-[#9a6a1d]' : 'text-slate-800')}>{label}</span>
                                <span className="block text-xs leading-5 text-slate-500">{copy}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h2 className="text-lg font-bold text-slate-900">{t('rebuild.recruiter.section1_heading', { defaultValue: '1. Essence of the challenge' })}</h2>
                          <button type="button" onClick={() => void handleMistralDraftAssist()} disabled={challengeAiDraftBusy} className={cn(secondaryButtonClass, 'rounded-[8px] px-3 py-2 text-sm disabled:opacity-60')}>
                            {challengeAiDraftBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                            {t('rebuild.recruiter.mistral_assist', { defaultValue: 'Mistral will help formulate' })}
                          </button>
                        </div>
                        <div className="mt-5 space-y-5">
                          <label className="block text-sm font-semibold text-slate-700">
                            {t('rebuild.recruiter.challenge_name', { defaultValue: 'Challenge name' })}
                            <input value={draftRoleTitle} onChange={(event) => setDraftRoleTitle(event.target.value)} placeholder="E.g. Speed up dashboard loading by 50%" className={cn(fieldClass, 'rounded-[8px] bg-white dark:bg-slate-800 dark:border-slate-700 text-base dark:text-slate-200')} />
                          </label>
                          <label className="block text-sm font-semibold text-slate-700">
                            {t('rebuild.recruiter.why_important', { defaultValue: 'Why is it important?' })}
                            <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{t('rebuild.recruiter.impact_desc', { defaultValue: 'Describe the impact you want to achieve.' })}</span>
                            <textarea value={draftRoleSummary} onChange={(event) => setDraftRoleSummary(event.target.value)} rows={4} placeholder="E.g. Users wait too long for data and leave. We need to improve performance and increase satisfaction." className={cn(textareaClass, 'rounded-[8px] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200')} />
                          </label>
                          <label className="block text-sm font-semibold text-slate-700">
                            {t('rebuild.recruiter.what_to_solve', { defaultValue: 'What should the candidate solve?' })}
                            <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{t('rebuild.recruiter.solve_desc', { defaultValue: 'Briefly describe what the candidate should deliver or prove.' })}</span>
                            <textarea value={draftRoleFirstStep} onChange={(event) => setDraftRoleFirstStep(event.target.value)} rows={4} placeholder="E.g. Analyze current state, propose improvement and show measurable procedure." className={cn(textareaClass, 'rounded-[8px] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200')} />
                          </label>
                          <div className="rounded-[8px] border border-[#ead2a2] bg-[#fff8ea] p-4">
                            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a87421]">{t('rebuild.recruiter.shaman_advice', { defaultValue: 'Shaman\'s advice' })}</div>
                            <p className="mt-2 text-sm leading-6 text-slate-700">{t('rebuild.recruiter.shaman_advice_text', { defaultValue: 'A great challenge is specific, measurable, and inspiring. Describe the outcome, not just the task.' })}</p>
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-[8px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
                      <h2 className="text-lg font-bold text-slate-900">{t('rebuild.recruiter.section2_heading', { defaultValue: '2. Area and collaboration' })}</h2>
                      <div className="mt-5 grid gap-4 md:grid-cols-3">
                        <label className="block text-sm font-semibold text-slate-700">
                          {t('rebuild.recruiter.field_area', { defaultValue: 'Area' })}
                          <select value={draftRoleFamily} onChange={(event) => setDraftRoleFamily(event.target.value as Role['roleFamily'])} className={cn(fieldClass, 'rounded-[8px] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200')}>
                            {Object.keys(roleFamilyLabel).map((family) => <option key={family} value={family}>{roleFamilyLabel[family as Role['roleFamily']]}</option>)}
                          </select>
                        </label>
                        <label className="block text-sm font-semibold text-slate-700">
                          {t('rebuild.recruiter.collab_type', { defaultValue: 'Collaboration type' })}
                          <select value={draftRoleWorkModel} onChange={(event) => setDraftRoleWorkModel(event.target.value as Role['workModel'])} className={cn(fieldClass, 'rounded-[8px] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200')}>
                            <option value="Hybrid">{t('rebuild.recruiter.work_hybrid', { defaultValue: 'Hybrid' })}</option>
                            <option value="Remote">{t('rebuild.recruiter.work_remote', { defaultValue: 'Remote' })}</option>
                            <option value="On-site">{t('rebuild.recruiter.work_onsite', { defaultValue: 'On-site' })}</option>
                          </select>
                        </label>
                        <label className="block text-sm font-semibold text-slate-700">
                          {t('rebuild.recruiter.location', { defaultValue: 'Location' })}
                          <input value={draftRoleLocation} onChange={(event) => setDraftRoleLocation(event.target.value)} className={cn(fieldClass, 'rounded-[8px] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200')} />
                        </label>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <label className="block text-sm font-semibold text-slate-600">
                          {t('rebuild.recruiter.salary_from', { defaultValue: 'Salary from' })}
                          <input type="number" value={draftRoleSalaryFrom} onChange={(event) => setDraftRoleSalaryFrom(event.target.value)} className={cn(fieldClass, 'rounded-[8px] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200')} />
                        </label>
                        <label className="block text-sm font-semibold text-slate-600">
                          {t('rebuild.recruiter.salary_to', { defaultValue: 'Salary to' })}
                          <input type="number" value={draftRoleSalaryTo} onChange={(event) => setDraftRoleSalaryTo(event.target.value)} className={cn(fieldClass, 'rounded-[8px] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200')} />
                        </label>
                        <label className="block text-sm font-semibold text-slate-600">
                          {t('rebuild.recruiter.skills', { defaultValue: 'Skills' })}
                          <input value={draftRoleSkills} onChange={(event) => setDraftRoleSkills(event.target.value)} placeholder="SQL, performance, analysis..." className={cn(fieldClass, 'rounded-[8px] bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200')} />
                        </label>
                      </div>
                      {challengeError ? <div className="mt-4 rounded-[8px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{challengeError}</div> : null}
                      {challengeNotice ? <div className="mt-4 rounded-[8px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{challengeNotice}</div> : null}
                    </section>
                  </div>

                  <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
                    <section className="rounded-[8px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#1f5fbf]">
                        <Sparkles size={14} />
                        {t('rebuild.recruiter.ai_assistant', { defaultValue: 'AI asistent' })}
                      </div>
                      <div className="mt-4 space-y-3">
                        {challengeChecks.map((item) => (
                          <div key={item.label} className="rounded-[8px] border border-slate-200 bg-[#f8fbff] p-3">
                            <div className="flex items-start gap-3">
                              <span className={cn('mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full', item.done ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400')}>
                                <Check size={13} />
                              </span>
                              <span>
                                <span className="block text-sm font-bold text-slate-900">{item.label}</span>
                                <span className="block text-xs leading-5 text-slate-600">{item.copy}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 rounded-[8px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#2f6fca] bg-[#eff6ff] text-lg font-bold text-[#1f5fbf]">{challengeScore}%</div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{t('rebuild.recruiter.challenge_score', { defaultValue: 'Challenge score' })}</div>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{t('rebuild.recruiter.score_desc', { defaultValue: 'This challenge has the potential to attract relevant candidates.' })}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => void handleMistralDraftAssist()} disabled={challengeAiDraftBusy} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#1f5fbf] disabled:opacity-60">
                          {challengeAiDraftBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                          {t('rebuild.recruiter.improve_score', { defaultValue: 'How to improve the score via Mistral →' })}
                        </button>
                      </div>
                    </section>

                    <section className="rounded-[8px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{t('rebuild.recruiter.candidate_preview', { defaultValue: 'Candidate preview' })}</div>
                        <button type="button" className="rounded-[6px] bg-[#fff3df] px-2.5 py-1 text-[11px] font-bold text-[#9a6a1d]">{t('rebuild.recruiter.full_preview', { defaultValue: 'Show full preview' })}</button>
                      </div>
                      <div className="pt-5">
                        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{roleFamilyLabel[draftRoleFamily]}</div>
                        <h3 className="mt-3 text-[1.35rem] font-semibold leading-tight tracking-[-0.035em] text-slate-900">{draftRoleTitle || t('rebuild.recruiter.enter_challenge', { defaultValue: 'Enter the challenge the candidate should solve' })}</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{draftRoleSummary || t('rebuild.recruiter.preview_placeholder', { defaultValue: 'A brief context will be written here: what is happening, why it hurts, and what result would help the company.' })}</p>
                        <div className="mt-4 space-y-2 text-sm text-slate-600">
                          <div>☕ {draftRoleWorkModel === 'Hybrid' ? t('rebuild.recruiter.hybrid_collab', { defaultValue: 'Hybrid collaboration' }) : draftRoleWorkModel}</div>
                          <div>⌖ {draftRoleLocation || 'Lokalita bude upřesněna'}</div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(draftRoleSkills.split(',').map((skill) => skill.trim()).filter(Boolean).slice(0, 4).length ? draftRoleSkills.split(',').map((skill) => skill.trim()).filter(Boolean).slice(0, 4) : ['Analýza', 'Návrh', 'Priorizace']).map((skill) => (
                            <span key={skill} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">{skill}</span>
                          ))}
                        </div>
                        <div className="mt-5 flex items-center justify-between rounded-[8px] border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-800">
                          <span>{t('rebuild.recruiter.first_task_assessment', { defaultValue: 'First task - 14-day assessment' })}</span>
                          <span>›</span>
                        </div>
                      </div>
                    </section>
                  </aside>
                </div>

                <div className="sticky bottom-4 z-20 mt-6 rounded-[8px] border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-4 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.45)] dark:shadow-none backdrop-blur">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('rebuild.recruiter.draft_challenge', { defaultValue: 'Draft challenge' })}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-emerald-700"><Check size={13} /> {t('rebuild.recruiter.auto_saved', { defaultValue: 'Automaticky uloženo lokálně' })}</div>
                    </div>
                    <div className="hidden flex-1 items-center justify-center gap-3 text-xs font-bold text-slate-400 lg:flex">
                      {['Podstata výzvy', 'Oblast a spolupráce', 'Kontext', 'Assessment', 'Náhled'].map((label, index) => (
                        <React.Fragment key={label}>
                          <span className={cn('inline-flex items-center gap-2', index === 0 ? 'text-[#c28a2c]' : '')}>
                            <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-full border', index === 0 ? 'border-[#c28a2c] bg-[#c28a2c] text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-300')}>{index + 1}</span>
                            {label}
                          </span>
                          {index < 4 ? <span className="h-px w-10 bg-slate-200" /> : null}
                        </React.Fragment>
                      ))}
                    </div>
                    <button type="button" onClick={() => void handleMistralDraftAssist()} disabled={challengeAiDraftBusy} className={cn(primaryButtonClass, 'rounded-[8px] bg-[#c28a2c] hover:bg-[#a87421] disabled:opacity-60')}>
                      {challengeAiDraftBusy ? <Loader2 size={16} className="animate-spin" /> : null}
                      {t('rebuild.recruiter.continue_with_ai', { defaultValue: 'Continue with AI' })}
                      <span>→</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{t('rebuild.recruiter.published_surface', { defaultValue: 'Published Surface' })}</div>
                    <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-slate-900">{t('rebuild.recruiter.challenges_and_assessments', { defaultValue: 'Challenges and assessment procedures' })}</h2>
                </div>
              </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {visibleRoles.length === 0 ? (
                    <div className="rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm leading-7 text-slate-600 dark:text-slate-400">
                      {t('rebuild.recruiter.no_challenges_yet', { defaultValue: 'You do not have any challenges entered yet. Once you save one, it will appear here and the candidate can open it as a handshake.' })}
                    </div>
                  ) : null}
                  {visibleRoles.map((role) => {
                    const blueprint = blueprintLibrary.find((item) => item.id === role.blueprintId) || blueprintLibrary.find((item) => item.roleFamily === role.roleFamily);
                    return (
                    <div key={role.id} className="rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-[0_18px_60px_-52px_rgba(15,23,42,0.35)] dark:shadow-none">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-[6px] bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{roleFamilyLabel[role.roleFamily]}</span>
                            <span className="rounded-[6px] bg-[#dbeafe] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#1f5fbf]">Assessment</span>
                          </div>
                          <h3 className="mt-3 text-[1.65rem] font-semibold leading-tight tracking-[-0.045em] text-slate-900">{role.title}</h3>
                          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{role.summary || role.challenge}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{role.workModel} · {role.location}</span>
                          <button
                            type="button"
                            disabled={challengeBusyId === role.id}
                            onClick={() => void handleAiAssistChallenge(role.id)}
                            className={cn(secondaryButtonClass, 'rounded-[8px] px-4 py-3 text-sm disabled:opacity-60')}
                          >
                            {challengeBusyId === role.id ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                            {t('rebuild.recruiter.ai_tasks', { defaultValue: 'AI tasks' })}
                          </button>
                          <button
                            type="button"
                            disabled={challengeBusyId === role.id}
                            onClick={() => void handlePublishChallenge(role.id)}
                            className={cn(primaryButtonClass, 'rounded-[8px] px-4 py-3 text-sm disabled:opacity-60')}
                          >
                            {challengeBusyId === role.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                            {t('rebuild.recruiter.publish', { defaultValue: 'Publikovat' })}
                          </button>
                        </div>
                      </div>
                      {blueprint ? <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {blueprint.steps.map((step) => (
                          <div key={step.id} className="rounded-[8px] border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-bold text-slate-900">{step.title}</div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{step.type.replaceAll('_', ' ')}</div>
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-600">{step.helper}</div>
                          </div>
                        ))}
                      </div> : null}
                    </div>
                  );})}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'talent-pool' ? (
            <div className="space-y-7">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="max-w-3xl">
                  <div className={pillEyebrowClass}>{t('rebuild.talent_pool.label', { defaultValue: 'Talent Intelligence' })}</div>
                  <h1 className="mt-3 text-[3.2rem] font-semibold leading-[0.95] tracking-[-0.07em] text-[color:var(--shell-text-primary)]">
                    {t('rebuild.talent_pool.heading', { defaultValue: 'Talent exploration and cognitive maps.' })}
                  </h1>
                  <p className="mt-4 text-base leading-7 text-[color:var(--shell-text-secondary)]">
                    {t('rebuild.talent_pool.copy', { defaultValue: 'Unified decision interface for managing candidates, readouts, and shared communication threads.' })}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button type="button" className={secondaryButtonClass}>
                    <Users size={16} /> {t('rebuild.talent_pool.export', { defaultValue: 'Export pool' })}
                  </button>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
                {/* Candidate List Sidebar */}
                <div className="space-y-4">
                  <div className={cn(panelClass, 'p-1')}>
                    <div className="max-h-[70vh] space-y-1 overflow-y-auto p-2">
                      {visibleCandidateInsights.length === 0 ? (
                        <div className="p-8 text-center text-sm leading-7 text-[color:var(--shell-text-muted)]">
                          {t('rebuild.talent_pool.empty', { defaultValue: 'The talent pool does not have any loaded candidates yet.' })}
                        </div>
                      ) : (
                        visibleCandidateInsights.map((candidate) => {
                          const isActive = candidate.id === selectedCandidate?.id;
                          const isLegacy = candidate.id.startsWith('legacy-');

                          return (
                            <button
                              key={candidate.id}
                              type="button"
                              onClick={() => setSelectedCandidateId(candidate.id)}
                              className={cn(
                                'group relative w-full rounded-[18px] border p-3.5 text-left transition-all duration-200',
                                isActive
                                  ? 'border-[#d9c39a] bg-white dark:bg-slate-800 shadow-[0_12px_30px_-20px_rgba(169,104,23,0.15)] ring-1 ring-[#d9c39a]/30'
                                  : 'border-transparent hover:bg-white dark:hover:bg-slate-800 hover:border-[#e8ded1] dark:hover:border-slate-700 hover:shadow-sm'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-slate-100 text-sm font-bold text-slate-600">
                                    {candidate.avatar_url ? (
                                      <img src={candidate.avatar_url} alt="" className="h-full w-full rounded-[inherit] object-cover" />
                                    ) : (
                                      candidate.candidateName.slice(0, 1)
                                    )}
                                  </div>
                                  {isLegacy && (
                                    <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-400 text-[7px] font-black text-white ring-2 ring-white">L</div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[14px] font-semibold text-[#111827]">{candidate.candidateName}</div>
                                  <div className="truncate text-[11px] text-[#6a7380]">{candidate.headline || t('rebuild.recruiter.applicant', { defaultValue: 'Applicant' })}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[13px] font-bold text-[#2496ab]">{candidate.matchPercent}%</div>
                                  <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Match</div>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Candidate Detail Area */}
                {selectedCandidate && visibleCandidateInsights.some((candidate) => candidate.id === selectedCandidate.id) ? (
                  <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
                    <div className="space-y-6">
                      <section className="rounded-[28px] border border-[#e8ded1] dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm dark:shadow-none">
                        <div className="flex flex-wrap items-center justify-between gap-6">
                          <div className="flex items-center gap-6">
                            <div className="h-20 w-20 rounded-[22px] bg-slate-50 p-1 ring-1 ring-slate-100">
                              {selectedCandidate.avatar_url ? (
                                <img src={selectedCandidate.avatar_url} alt="" className="h-full w-full rounded-[18px] object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center rounded-[18px] bg-white dark:bg-slate-800 text-2xl font-bold text-slate-400 dark:text-slate-600">{selectedCandidate.candidateName.slice(0, 1)}</div>
                              )}
                            </div>
                            <div>
                              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#2496ab]">{t('rebuild.candidate_profile.label', { defaultValue: 'Talent Profile' })}</div>
                              <h2 className="mt-1 text-3xl font-semibold tracking-tight text-[#111827]">{selectedCandidate.candidateName}</h2>
                              <div className="mt-2 flex items-center gap-3 text-sm">
                                <span className="font-semibold text-slate-600">{selectedCandidate.headline}</span>
                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                <span className="text-slate-400">{selectedCandidate.location}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className="rounded-[14px] border border-transparent bg-rose-50 px-5 py-2.5 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-100">
                              Reject
                            </button>
                            <button type="button" className="rounded-[14px] border border-[#e8ded1] dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-2.5 text-[13px] font-semibold text-[#273243] dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700">
                              Schedule
                            </button>
                            <button type="button" className="rounded-[14px] bg-[#f6d999] px-6 py-2.5 text-[13px] font-bold text-[#4a3515] shadow-sm transition hover:bg-[#f3d58c]">
                              Hire Flow
                            </button>
                          </div>
                        </div>

                        <div className="mt-10 grid gap-8 md:grid-cols-2">
                          <div className="space-y-6">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-[color:var(--shell-text-muted)]">{t('rebuild.recruiter.skills_cognition', { defaultValue: 'Skills and cognition' })}</h3>
                            <div className="space-y-5">
                              {selectedCandidate.skills.map((skill) => (
                                <div key={skill.label} className="group">
                                  <div className="mb-2 flex items-center justify-between">
                                    <span className="text-sm font-bold text-[color:var(--shell-text-primary)]">{skill.label}</span>
                                    <span className="text-xs font-bold text-[color:var(--shell-accent-cyan)]">{skill.score / 10}/10</span>
                                  </div>
                                  <div className="h-2 rounded-full bg-[color:var(--shell-track)]">
                                    <div
                                      className="h-full rounded-full bg-[color:var(--shell-accent-cyan)] transition-all duration-1000"
                                      style={{ width: `${skill.score}%` }}
                                    />
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {skill.tags.map((tag) => (
                                      <span key={tag} className="rounded-full bg-[color:var(--shell-button-secondary-bg)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--shell-text-secondary)] ring-1 ring-[color:var(--shell-panel-border)]">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-6">
                            <h3 className="text-sm font-bold uppercase tracking-widest text-[color:var(--shell-text-muted)]">{t('rebuild.recruiter.personal_story', { defaultValue: 'Personal story and bio' })}</h3>
                            <div className="rounded-[24px] bg-[color:var(--shell-button-secondary-bg)] p-6 text-sm leading-8 text-[color:var(--shell-text-secondary)] ring-1 ring-[color:var(--shell-panel-border)]">
                              {selectedCandidate.bio || t('rebuild.talent_pool.no_bio', { defaultValue: 'The candidate has not filled in their personal story yet.' })}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {selectedCandidate.topSignals.map((signal) => (
                                <span key={signal} className="rounded-full bg-[color:var(--shell-accent-soft)] px-3 py-1.5 text-xs font-bold text-[color:var(--shell-accent)] ring-1 ring-[color:var(--shell-accent-soft)]">
                                  ✧ {signal}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Dialogue Section Integrated better */}
                      <section className={cn(panelClass, 'p-8')}>
                        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--shell-header-border)] pb-6">
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--shell-text-muted)]">{t('rebuild.recruiter.live_dialogue_lane', { defaultValue: 'Real-time Dialogue' })}</div>
                            <h3 className="mt-1 text-2xl font-bold text-[color:var(--shell-text-primary)]">{t('rebuild.recruiter.shared_thread', { defaultValue: 'Shared communication thread' })}</h3>
                          </div>
                          {selectedRecruiterDialogueDetail?.status && (
                            <span className={cn('rounded-full px-4 py-1 text-xs font-bold uppercase tracking-widest', getApplicationStatusCopy(selectedRecruiterDialogueDetail.status).tone)}>
                              {getApplicationStatusCopy(selectedRecruiterDialogueDetail.status).label}
                            </span>
                          )}
                        </div>

                        <div className="mt-8">
                          {recruiterDialogueLoading ? (
                            <div className="flex h-32 items-center justify-center gap-3 text-[color:var(--shell-text-muted)]">
                              <Loader2 size={20} className="animate-spin" />
                              {t('rebuild.recruiter.loading_dialogue', { defaultValue: 'Navazuji spojení s vláknem...' })}
                            </div>
                          ) : !selectedRecruiterDialogueId ? (
                            <div className="rounded-[24px] border border-dashed border-[color:var(--shell-panel-border)] bg-[color:var(--shell-button-secondary-bg)] p-10 text-center text-sm leading-8 text-[color:var(--shell-text-muted)]">
                              {t('rebuild.recruiter.no_native_thread', { defaultValue: 'Tento kandidát zatím nemá aktivní komunikační vlákno. Jakmile odpoví na některou z vašich výzev, uvidíte zde celou historii v reálném čase.' })}
                            </div>
                          ) : (
                            <div className="space-y-6">
                              <div className="space-y-4">
                                {selectedRecruiterDialogueMessages.length === 0 ? (
                                  <div className="text-center text-sm text-[color:var(--shell-text-subtle)] py-4">{t('rebuild.recruiter.no_messages', { defaultValue: 'Žádné zprávy k zobrazení.' })}</div>
                                ) : (
                                  selectedRecruiterDialogueMessages.slice(-8).map((message) => {
                                    const isRecruiter = message.sender_role === 'recruiter';
                                    return (
                                      <div key={message.id} className={cn('flex flex-col', isRecruiter ? 'items-end' : 'items-start')}>
                                        <div className={cn(
                                          'max-w-[85%] rounded-[24px] px-5 py-4 text-sm leading-7 shadow-lg transition-all',
                                          isRecruiter
                                            ? 'bg-[linear-gradient(145deg,var(--shell-bg-accent),var(--shell-bg-base))] text-[color:var(--shell-text-primary)] ring-1 ring-[color:var(--shell-panel-border)]'
                                            : 'bg-[color:var(--shell-button-secondary-bg)] text-[color:var(--shell-text-secondary)] ring-1 ring-[color:var(--shell-panel-border)]'
                                        )}>
                                          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest opacity-50">
                                            {isRecruiter ? t('rebuild.recruiter.you_label', { defaultValue: 'Vy' }) : (selectedRecruiterDialogueDetail?.candidate_profile_snapshot?.name || t('rebuild.recruiter.candidate_label', { defaultValue: 'Kandidát' }))} · {new Date(message.created_at).toLocaleTimeString()}
                                          </div>
                                          <div>{message.body}</div>
                                          {message.attachments.length > 0 && (
                                            <div className="mt-4 flex flex-wrap gap-2">
                                              {message.attachments.map((at, idx) => <AttachmentChip key={idx} attachment={at} inverted={isRecruiter} />)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              <div className="relative mt-8">
                                <textarea
                                  value={recruiterMessageDraft}
                                  onChange={(e) => setRecruiterMessageDraft(e.target.value)}
                                  rows={3}
                                  className={cn(textareaClass, 'pr-32')}
                                  placeholder={t('rebuild.recruiter.write_next_message', { defaultValue: 'Napište zprávu kandidátovi...' })}
                                />
                                <div className="absolute bottom-4 right-4 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => recruiterAttachmentInputRef.current?.click()}
                                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--shell-button-secondary-bg)] text-[color:var(--shell-text-secondary)] hover:bg-[color:var(--shell-button-secondary-hover)]"
                                  >
                                    <Paperclip size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRecruiterSendMessage()}
                                    disabled={recruiterMessageBusy || !recruiterMessageDraft.trim()}
                                    className={cn(primaryButtonClass, 'h-11 px-6')}
                                  >
                                    {recruiterMessageBusy ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                    {t('rebuild.actions.send', { defaultValue: 'Send' })}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    </div>

                    {/* Right sidebar with stats */}
                    <div className="space-y-6">
                      <div className="rounded-[28px] border border-[#e8ded1] bg-[linear-gradient(180deg,#fffdf9,white)] p-7 shadow-sm">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c67a18]">Verified Resonance</div>
                        <div className="mt-8 flex items-baseline gap-2">
                          <span className="text-5xl font-semibold tracking-tighter text-[#111827]">{selectedCandidate.verifiedScore}</span>
                          <span className="text-lg font-bold text-slate-400">%</span>
                        </div>
                        <div className="mt-2 text-sm font-bold text-[#c67a18]">{selectedCandidateScoreLabel}</div>
                        <div className="mt-6 h-[4px] rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-[#d58a22] transition-all duration-1000" style={{ width: `${selectedCandidate.verifiedScore}%` }} />
                        </div>
                        <p className="mt-6 text-[13px] font-medium leading-6 text-slate-500 italic">“{selectedCandidate.internalNote}”</p>
                      </div>

                      <section className={cn(panelClass, 'p-6')}>
                        <h4 className="text-sm font-bold uppercase tracking-widest text-[color:var(--shell-text-muted)]">Recruiter Insight</h4>
                        <div className="mt-5 space-y-4">
                          <div className="text-sm leading-8 text-[color:var(--shell-text-secondary)]">
                            {selectedCandidate.recommendation}
                          </div>
                        </div>
                      </section>

                      <section className="rounded-[24px] border border-[#e8ded1] dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm dark:shadow-none">
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{t('rebuild.recruiter.candidate_metadata', { defaultValue: 'Candidate metadata' })}</h4>
                        <div className="mt-5 space-y-3">
                          <div className="flex justify-between text-[13px]">
                            <span className="text-slate-500">{t('rebuild.recruiter.profile_source', { defaultValue: 'Profile source' })}:</span>
                            <span className="font-semibold text-slate-900">{selectedCandidate.id.startsWith('legacy-') ? 'Legacy' : 'Native'}</span>
                          </div>
                          <div className="flex justify-between text-[13px]">
                            <span className="text-slate-500">{t('rebuild.recruiter.location_label', { defaultValue: 'Location' })}:</span>
                            <span className="font-semibold text-slate-900">{selectedCandidate.location}</span>
                          </div>
                          <div className="flex justify-between text-[13px]">
                            <span className="text-slate-500">{t('rebuild.recruiter.created_at', { defaultValue: 'Created at' })}:</span>
                            <span className="font-semibold text-slate-900">{selectedCandidate.created_at ? new Date(selectedCandidate.created_at).toLocaleDateString() : t('rebuild.recruiter.unknown', { defaultValue: 'Unknown' })}</span>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className={cn(panelClass, 'flex items-center justify-center p-20')}>
                    <div className="max-w-md text-center">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--shell-track)] text-[color:var(--shell-accent)]">
                        <Users size={32} />
                      </div>
                      <h3 className="mt-6 text-2xl font-bold text-[color:var(--shell-text-primary)]">{t('rebuild.recruiter.select_candidate_detail', { defaultValue: 'Select a candidate for a detailed cognitive map' })}</h3>
                      <p className="mt-4 text-sm leading-7 text-[color:var(--shell-text-muted)]">
                        {t('rebuild.recruiter.select_candidate_desc', { defaultValue: 'Here you will see a detailed analysis of skills, histories, and common communication with the selected talent.' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {tab === 'settings' ? (
            <div className="space-y-6">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.recruiter.settings_label', { defaultValue: 'Firemní profil' })}</div>
                <h1 className="mt-2 text-[2.7rem] font-semibold tracking-[-0.06em] text-slate-900">{t('rebuild.recruiter.settings_title', { defaultValue: 'Logo, fotografie, popis firmy a kontaktní osoba.' })}</h1>
              </div>
              <div className="flex flex-wrap gap-3">
                {companyLibrary.map((company) => (
                  <button key={company.id} type="button" onClick={() => setSelectedCompanyId(company.id)} className={cn('inline-flex items-center gap-3 rounded-[18px] border px-4 py-3 text-left transition', company.id === selectedCompany?.id ? 'border-[#255DAB] bg-[#255DAB]/6 text-[#255DAB] dark:border-blue-400 dark:text-blue-400' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400')}>
                    <img src={company.logo} alt={company.name} className="h-9 w-9 rounded-xl object-cover" loading="lazy" />
                    <span className="font-semibold">{company.name}</span>
                  </button>
                ))}
              </div>
              {selectedCompany ? (
                <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
                  <div className={cn(panelClass, 'p-6')}>
                    <div className="text-sm font-semibold text-slate-900">{t('rebuild.recruiter.brand_editor', { defaultValue: 'Brand editor' })}</div>
                    <div className="mt-5 space-y-4">
                      <label className="block text-sm font-medium text-slate-600">{t('rebuild.recruiter.company_name', { defaultValue: 'Company name' })}<input value={selectedCompany.name} onChange={(event) => updateSelectedCompany((company) => ({ ...company, name: event.target.value }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]" /></label>
                      <label className="block text-sm font-medium text-slate-600">{t('rebuild.recruiter.tagline', { defaultValue: 'Tagline' })}<input value={selectedCompany.tagline} onChange={(event) => updateSelectedCompany((company) => ({ ...company, tagline: event.target.value }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]" /></label>
                      <label className="block text-sm font-medium text-slate-600">{t('rebuild.recruiter.narrative', { defaultValue: 'Narrative' })}<textarea value={selectedCompany.narrative} onChange={(event) => updateSelectedCompany((company) => ({ ...company, narrative: event.target.value }))} rows={5} className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 outline-none transition focus:border-[#255DAB]" /></label>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-600">
                          {t('rebuild.recruiter.upload_cover', { defaultValue: 'Upload cover image' })}
                          <input type="file" accept="image/*" onChange={(event) => void handleCompanyAssetUpload(event, 'cover')} className={cn(fieldClass, 'mt-2')} />
                        </label>
                        <label className="block text-sm font-medium text-slate-600">
                          {t('rebuild.recruiter.upload_logo', { defaultValue: 'Upload logo' })}
                          <input type="file" accept="image/*" onChange={(event) => void handleCompanyAssetUpload(event, 'logo')} className={cn(fieldClass, 'mt-2')} />
                        </label>
                      </div>
                      <label className="block text-sm font-medium text-slate-600">{t('rebuild.recruiter.cover_image_url', { defaultValue: 'Cover image URL' })}<input value={selectedCompany.coverImage} onChange={(event) => updateSelectedCompany((company) => ({ ...company, coverImage: event.target.value }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]" /></label>
                      <label className="block text-sm font-medium text-slate-600">{t('rebuild.recruiter.logo_url', { defaultValue: 'Logo URL' })}<input value={selectedCompany.logo} onChange={(event) => updateSelectedCompany((company) => ({ ...company, logo: event.target.value }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]" /></label>
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">{t('rebuild.recruiter.gallery', { defaultValue: 'Company gallery' })}</div>
                          <label className={cn(secondaryButtonClass, 'cursor-pointer')}>
                            <input type="file" accept="image/*" onChange={(event) => void handleCompanyAssetUpload(event, 'gallery')} className="hidden" />
                            {brandAssetBusy === 'gallery' ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                            {t('rebuild.recruiter.add_gallery', { defaultValue: 'Add photo' })}
                          </label>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {selectedCompany.gallery.map((asset) => (
                            <div key={asset.id} className="overflow-hidden rounded-[18px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800">
                              <img src={asset.url} alt={asset.name} className="h-28 w-full object-cover" loading="lazy" />
                              <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-slate-500">
                                <span className="truncate">{asset.name}</span>
                                <button type="button" onClick={() => updateSelectedCompany((company) => ({ ...company, gallery: company.gallery.filter((item) => item.id !== asset.id) }))} className="font-semibold text-rose-600">
                                  {t('rebuild.recruiter.remove_media', { defaultValue: 'Remove' })}
                                </button>
                              </div>
                            </div>
                          ))}
                          {selectedCompany.gallery.length === 0 ? <div className="text-sm text-slate-500">{t('rebuild.recruiter.gallery_empty', { defaultValue: 'Add office, production or team photos that candidates should see before the handshake.' })}</div> : null}
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-600">{t('rebuild.recruiter.primary_color', { defaultValue: 'Primary' })}<input value={selectedCompany.theme.primary} onChange={(event) => updateSelectedCompany((company) => ({ ...company, theme: { ...company.theme, primary: event.target.value } }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]" /></label>
                        <label className="block text-sm font-medium text-slate-600">{t('rebuild.recruiter.accent_color', { defaultValue: 'Accent' })}<input value={selectedCompany.theme.accent} onChange={(event) => updateSelectedCompany((company) => ({ ...company, theme: { ...company.theme, accent: event.target.value } }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]" /></label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block text-sm font-medium text-slate-600">{t('rebuild.recruiter.reviewer_name', { defaultValue: 'Reviewer name' })}<input value={selectedCompany.reviewer.name} onChange={(event) => updateSelectedCompany((company) => ({ ...company, reviewer: { ...company.reviewer, name: event.target.value } }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]" /></label>
                        <label className="block text-sm font-medium text-slate-600">{t('rebuild.recruiter.reviewer_role', { defaultValue: 'Reviewer role' })}<input value={selectedCompany.reviewer.role} onChange={(event) => updateSelectedCompany((company) => ({ ...company, reviewer: { ...company.reviewer, role: event.target.value } }))} className="mt-2 w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#255DAB]" /></label>
                      </div>
                      <label className="block text-sm font-medium text-slate-600">
                        {t('rebuild.recruiter.reviewer_avatar', { defaultValue: 'Reviewer photo' })}
                        <input type="file" accept="image/*" onChange={(event) => void handleCompanyAssetUpload(event, 'reviewer-avatar')} className={cn(fieldClass, 'mt-2')} />
                      </label>
                      <label className="block text-sm font-medium text-slate-600">{t('rebuild.recruiter.reviewer_intro', { defaultValue: 'Reviewer intro' })}<textarea value={selectedCompany.reviewer.intro} onChange={(event) => updateSelectedCompany((company) => ({ ...company, reviewer: { ...company.reviewer, intro: event.target.value } }))} rows={4} className="mt-2 w-full rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 outline-none transition focus:border-[#255DAB]" /></label>
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900">{t('rebuild.recruiter.handshake_materials', { defaultValue: 'Handshake materials' })}</div>
                          <label className={cn(secondaryButtonClass, 'cursor-pointer')}>
                            <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mp3,.wav,.zip" onChange={(event) => void handleCompanyAssetUpload(event, 'handshake-material')} className="hidden" />
                            {brandAssetBusy === 'handshake-material' ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
                            {t('rebuild.recruiter.add_material', { defaultValue: 'Add material' })}
                          </label>
                        </div>
                        <div className="mt-4 space-y-2">
                          {selectedCompany.handshakeMaterials.map((asset) => (
                            <div key={asset.id} className="flex items-center justify-between gap-3 rounded-[16px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 px-3 py-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-slate-900">{asset.title || asset.name}</div>
                                <div className="truncate text-xs text-slate-500">{asset.content_type || asset.mime_type || 'file'}</div>
                              </div>
                              <button type="button" onClick={() => updateSelectedCompany((company) => ({ ...company, handshakeMaterials: company.handshakeMaterials.filter((item) => item.id !== asset.id) }))} className="text-xs font-semibold text-rose-600">
                                {t('rebuild.recruiter.remove_material', { defaultValue: 'Remove' })}
                              </button>
                            </div>
                          ))}
                          {selectedCompany.handshakeMaterials.length === 0 ? <div className="text-sm text-slate-500">{t('rebuild.recruiter.materials_empty', { defaultValue: 'Upload decks, process docs, videos or briefs that should be visible before or during the handshake.' })}</div> : null}
                        </div>
                      </div>
                      {brandAssetBusy ? <div className="text-sm text-slate-500">{t('rebuild.recruiter.uploading_media', { defaultValue: 'Uploading media...' })}</div> : null}
                      {recruiterCompany && selectedCompany ? <button type="button" onClick={() => void onSaveRecruiterBrand(selectedCompany)} disabled={brandSaving || selectedCompany.id !== recruiterCompany.id} className={cn(primaryButtonClass, 'w-full disabled:cursor-not-allowed disabled:opacity-60')}>{brandSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{t('rebuild.recruiter.save_brand', { defaultValue: 'Save brand to company profile' })}</button> : null}
                    </div>
                  </div>
                  <div className="space-y-5">
                    <div className={cn(panelClass, 'overflow-hidden')}>
                      <div className="relative min-h-[18rem]">
                        <img src={selectedCompany.coverImage} alt={selectedCompany.name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
                        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,15,33,0.16),rgba(5,15,33,0.82))]" />
                        <div className="relative flex min-h-[18rem] items-end p-6 text-white">
                          <div className="max-w-2xl">
                            <div className="flex items-center gap-4">
                              <img src={selectedCompany.logo} alt={selectedCompany.name} className="h-14 w-14 rounded-2xl border border-white/12 object-cover" loading="lazy" />
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">{selectedCompany.domain}</div>
                                <div className="text-xl font-semibold tracking-[-0.04em]">{selectedCompany.name}</div>
                              </div>
                            </div>
                            <h3 className="mt-5 text-[2.4rem] font-semibold leading-[0.96] tracking-[-0.06em]">{selectedCompany.tagline}</h3>
                            <p className="mt-4 text-sm leading-7 text-white/84">{selectedCompany.narrative}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                      <div className={cn(panelClass, 'p-6')}>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{t('rebuild.recruiter.live_preview', { defaultValue: 'Live recruiter preview' })}</div>
                        <div className="mt-4 flex items-center gap-3">
                          <img src={selectedCompany.reviewer.avatarUrl} alt={selectedCompany.reviewer.name} className="h-14 w-14 rounded-2xl object-cover" loading="lazy" />
                          <div>
                            <div className="text-lg font-semibold tracking-[-0.03em] text-slate-900">{selectedCompany.reviewer.name}</div>
                            <div className="text-sm text-slate-500">{selectedCompany.reviewer.role}</div>
                          </div>
                        </div>
                        <blockquote className="mt-5 text-sm leading-7 text-slate-600">“{selectedCompany.reviewer.intro}”</blockquote>
                        <div className="mt-5 flex flex-wrap gap-2">
                          {[selectedCompany.theme.primary, selectedCompany.theme.secondary, selectedCompany.theme.accent].map((color) => (
                            <span key={color} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                              {color}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className={cn(panelClass, 'p-6')}>
                        <div className="text-sm font-semibold text-slate-900">{t('rebuild.recruiter.where_changes_appear', { defaultValue: 'Where changes appear' })}</div>
                        <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                          <div>{t('rebuild.recruiter.changes_marketplace_cards', { defaultValue: 'Marketplace cards use the updated company name and logo immediately.' })}</div>
                          <div>{t('rebuild.recruiter.changes_role_briefing', { defaultValue: 'Role briefing and journey screens pull the latest cover, narrative and reviewer identity.' })}</div>
                          <div>{t('rebuild.recruiter.changes_source_of_truth', { defaultValue: 'Both candidate and company will see the same current version of the company profile.' })}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
    </DashboardLayoutV2>
  );
};
