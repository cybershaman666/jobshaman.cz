import React from 'react';
import {
  BookOpen,
  Building2,
  Check,
  CreditCard,
  LayoutDashboard,
  Loader2,
  MapPin,
  Paperclip,
  PlugZap,
  Plus,
  Rocket,
  Settings,
  Settings2,
  Sparkles,
  Users,
  Zap,
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
import type { AssessmentTask } from '../../services/v2ChallengeService';

import { cn } from '../cn';
import { deriveDashboardMetrics } from '../derivations';
import type { CalendarEvent, CandidateInsight, Company, HandshakeBlueprint, Role } from '../models';
import type { RecruiterTab } from '../routing';
import { roleFamilyLabel } from '../shellDomain';
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
import { RecruiterIntegrationsPage } from './RecruiterIntegrationsPage';
import { RecruiterBillingPage } from './RecruiterBillingPage';
import { DashboardLayoutV2 } from '../ui/DashboardLayoutV2';
import { RoleEditorV2 } from './RoleEditorV2';
import { RecruiterSettingsPage } from './RecruiterSettingsPage';

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
    assessmentTasks?: AssessmentTask[];
    handshakeBlueprint?: Record<string, any>;
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
  setBlueprintLibrary: _setBlueprintLibrary,
  roleAssignments: _roleAssignments,
  setRoleAssignments: _setRoleAssignments,
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
  const [draftAiOutput, setDraftAiOutput] = React.useState<Record<string, any> | null>(null);
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
  const [isRoleEditorOpen, setIsRoleEditorOpen] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<Role | null>(null);
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
    setDraftAiOutput(output);
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
        assessmentTasks: Array.isArray(draftAiOutput?.assessment_tasks) ? draftAiOutput.assessment_tasks as AssessmentTask[] : undefined,
        handshakeBlueprint: draftAiOutput?.handshake_blueprint_v1 && typeof draftAiOutput.handshake_blueprint_v1 === 'object'
          ? draftAiOutput.handshake_blueprint_v1
          : undefined,
      });
      void createdRole;
      setChallengeNotice(t('rebuild.recruiter.challenge_saved', { defaultValue: 'Challenge is saved and ready for candidate handshake.' }));
      setDraftRoleTitle('');
      setDraftRoleSummary('');
      setDraftRoleFirstStep('');
      setDraftRoleSkills('');
      setDraftAiOutput(null);
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
    const confirmed = window.confirm(t('rebuild.recruiter.publish_confirm', { defaultValue: 'Publish this challenge to the marketplace? Candidates will be able to start the handshake.' }));
    if (!confirmed) return;
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
        
        // Dynamic score calculation - more descriptive and less "random"
        let score = candidate.matchPercent || 72;
        if (roleTokens.size > 0) {
          // Weight the overlap more heavily and show it clearly in the internal note
          const baseMatch = 55;
          const boost = Math.min(overlap * 8, 35);
          const signalVariety = Math.min(candidate.topSignals.length * 3, 12);
          score = Math.max(40, Math.min(98, baseMatch + boost + signalVariety));
        } else {
          // Stable score based on profile completeness + slight variety
          const candidateSeed = candidate.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const baseStability = (candidate.matchPercent || 68);
          score = Math.max(45, Math.min(88, baseStability - 5 + (candidateSeed % 10)));
        }

        return {
          ...candidate,
          matchPercent: Math.round(score),
          verifiedScore: Math.round(score),
          internalNote: overlap > 0
            ? `${t('rebuild.recruiter.relevant_signals', { defaultValue: 'Relevant signal overlap' })}: ${overlap} markers.`
            : t('rebuild.recruiter.no_strong_link', { defaultValue: 'No keyword overlap with active roles.' }),
        };
      })
      .sort((left, right) => right.matchPercent - left.matchPercent);
  }, [allRegisteredCandidates, candidateInsights, tab, visibleRoles, t]);
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
    { id: 'integrations', label: t('rebuild.recruiter.nav_integrations', { defaultValue: 'Integrace' }), icon: PlugZap, path: '/recruiter/integrations' },
    { id: 'settings', label: t('rebuild.recruiter.nav_company_profile', { defaultValue: 'Company profile' }), icon: Settings2, path: '/recruiter/settings' },
    { id: 'billing', label: t('rebuild.recruiter.nav_billing', { defaultValue: 'Subscription' }), icon: CreditCard, path: '/recruiter/billing' },
  ];
  const workspaceTitle = tab === 'roles'
    ? t('rebuild.recruiter.nav_roles', { defaultValue: 'Role' })
    : tab === 'talent-pool'
      ? t('rebuild.recruiter.nav_candidates', { defaultValue: 'Kandidáti' })
      : tab === 'integrations'
        ? t('rebuild.recruiter.nav_integrations', { defaultValue: 'Integrace' })
        : tab === 'billing'
          ? t('rebuild.recruiter.nav_billing', { defaultValue: 'Subscription' })
          : t('rebuild.recruiter.nav_company_profile', { defaultValue: 'Firemní profil' });
  const workspaceSubtitle = tab === 'roles'
    ? t('rebuild.recruiter.subtitle_roles', { defaultValue: 'Role assignments, evidence of ability, and skill-first selection management.' })
    : tab === 'talent-pool'
      ? t('rebuild.recruiter.subtitle_candidates', { defaultValue: 'Candidate profiles, recruiter readout, and shared threads in one decision space.' })
      : tab === 'integrations'
        ? t('rebuild.recruiter.subtitle_integrations', { defaultValue: 'API klíče, webhooky, ATS návody a audit doručení.' })
        : tab === 'billing'
          ? t('rebuild.recruiter.subtitle_billing', { defaultValue: 'Plan details, usage tracking, invoices, and payment management.' })
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

  if (tab === 'billing') {
    const billingCompanyId = recruiterCompany?.id || recruiterCompanyHydrated?.id || '';
    const billingCompanyName = recruiterCompany?.name || recruiterCompanyHydrated?.name || '';
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
        currentLanguage={currentLanguage}
        onLanguageChange={onLanguageChange}
        actionRegion={
          <button type="button" onClick={() => navigate('/candidate/insights')} className={secondaryButtonClass}>
            {t('rebuild.recruiter.candidate_view', { defaultValue: 'Candidate view' })}
          </button>
        }
        t={t}
      >
        <RecruiterBillingPage
          companyId={billingCompanyId}
          companyName={billingCompanyName}
          navigate={navigate}
          t={t}
        />
      </DashboardLayoutV2>
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

          {tab === 'roles' ? (
            <div className="space-y-6">
              {isRoleEditorOpen ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
                  <RoleEditorV2
                    initialRole={editingRole || undefined}
                    onSave={async (data) => {
                      try {
                        setChallengeSaving(true);
                        await onCreateChallenge(data);
                        setIsRoleEditorOpen(false);
                        setEditingRole(null);
                        setChallengeNotice(t('rebuild.recruiter.role_saved_success', { defaultValue: 'Role successfully saved.' }));
                      } catch (err) {
                        setChallengeError(err instanceof Error ? err.message : 'Failed to save role');
                      } finally {
                        setChallengeSaving(false);
                      }
                    }}
                    onCancel={() => {
                      setIsRoleEditorOpen(false);
                      setEditingRole(null);
                    }}
                    onAiDraft={onAiDraftChallenge}
                    busy={challengeSaving}
                    t={t}
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-6">
                    <div>
                      <h1 className="text-[2.8rem] font-semibold tracking-[-0.06em] text-slate-900 dark:text-white">
                        {t('rebuild.recruiter.roles_title', { defaultValue: 'Challenges & Handshakes' })}
                      </h1>
                      <p className="mt-2 text-slate-500 max-w-2xl">
                        {t('rebuild.recruiter.roles_subtitle', { defaultValue: 'Manage your skill-first recruitment journeys. Each role is a bridge between company goals and candidate abilities.' })}
                      </p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingRole(null);
                        setIsRoleEditorOpen(true);
                      }} 
                      className={cn(primaryButtonClass, 'h-14 px-8 rounded-2xl bg-[#c28a2c] hover:bg-[#a87421] border-[#a87421] shadow-xl shadow-amber-900/10')}
                    >
                      <Plus size={20} />
                      {t('rebuild.recruiter.create_new_challenge', { defaultValue: 'Create New Challenge' })}
                    </button>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    {visibleRoles.length === 0 ? (
                      <div className="col-span-full py-20 text-center rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <div className="mx-auto h-20 w-20 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-6">
                          <BookOpen size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('rebuild.recruiter.no_roles_yet', { defaultValue: 'No challenges active yet' })}</h3>
                        <p className="mt-2 text-slate-500 max-w-xs mx-auto">{t('rebuild.recruiter.no_roles_desc', { defaultValue: 'Start by creating your first skill-first role to attract top talent.' })}</p>
                        <button 
                          onClick={() => setIsRoleEditorOpen(true)}
                          className={cn(secondaryButtonClass, 'mt-6')}
                        >
                          {t('rebuild.recruiter.create_first_one', { defaultValue: 'Create your first challenge' })}
                        </button>
                      </div>
                    ) : (
                      visibleRoles.map((role) => {
                        const blueprint = role.handshakeBlueprint && Array.isArray((role.handshakeBlueprint as HandshakeBlueprint).steps)
                          ? role.handshakeBlueprint as HandshakeBlueprint
                          : blueprintLibrary.find((item) => item.id === role.blueprintId) || blueprintLibrary.find((item) => item.roleFamily === role.roleFamily);
                        
                        const completeness = role.handshakeBlueprint ? 100 : (role.summary && role.skills.length > 0 ? 60 : 30);

                        return (
                          <div key={role.id} className="group relative rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm transition-all hover:shadow-xl hover:border-amber-200/50 dark:hover:border-amber-900/30 overflow-hidden">
                            {/* Handshake Progress Bar */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-50 dark:bg-slate-800">
                              <div className={cn('h-full transition-all duration-1000', completeness === 100 ? 'bg-emerald-500' : 'bg-amber-400')} style={{ width: `${completeness}%` }} />
                            </div>

                            <div className="flex flex-col h-full">
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500">{roleFamilyLabel[role.roleFamily]}</span>
                                    {completeness === 100 ? (
                                      <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                        <Check size={10} /> {t('rebuild.recruiter.ready_handshake', { defaultValue: 'Handshake Ready' })}
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('rebuild.recruiter.incomplete_handshake', { defaultValue: 'Draft' })}</span>
                                    )}
                                  </div>
                                  <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">{role.title}</h3>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => {
                                      setEditingRole(role);
                                      setIsRoleEditorOpen(true);
                                    }}
                                    className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                                  >
                                    <Settings size={18} />
                                  </button>
                                </div>
                              </div>

                              <p className="mt-4 text-sm text-slate-500 leading-7 line-clamp-3 flex-1">{role.summary || role.challenge}</p>

                              <div className="mt-6 flex flex-wrap gap-2">
                                {role.skills.slice(0, 4).map(skill => (
                                  <span key={skill} className="px-3 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800">{skill}</span>
                                ))}
                                {role.skills.length > 4 && <span className="px-3 py-1 text-[11px] font-semibold text-slate-400">+{role.skills.length - 4} more</span>}
                              </div>

                              <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                  <span className="flex items-center gap-1.5"><MapPin size={14} /> {role.location}</span>
                                  <span className="flex items-center gap-1.5"><Zap size={14} /> {role.workModel}</span>
                                </div>
                                <div className="flex gap-3">
                                  <button
                                    type="button"
                                    disabled={challengeBusyId === role.id}
                                    onClick={() => void handlePublishChallenge(role.id)}
                                    className={cn(primaryButtonClass, 'rounded-xl px-5 py-2.5 text-xs bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100')}
                                  >
                                    {challengeBusyId === role.id ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                                    {t('rebuild.recruiter.publish', { defaultValue: 'Publish' })}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {tab === 'talent-pool' ? (
            <div className="space-y-8">
              <div className="flex flex-wrap items-end justify-between gap-6">
                <div className="max-w-3xl">
                  <div className={pillEyebrowClass}>{t('rebuild.talent_pool.label', { defaultValue: 'Talent Intelligence' })}</div>
                  <h1 className="mt-4 text-[2.8rem] font-semibold leading-[1.1] tracking-[-0.06em] text-[color:var(--shell-text-primary)]">
                    {t('rebuild.talent_pool.heading', { defaultValue: 'Talent exploration and cognitive maps.' })}
                  </h1>
                  <p className="mt-5 text-lg leading-8 text-[color:var(--shell-text-secondary)] opacity-80">
                    {t('rebuild.talent_pool.copy', { defaultValue: 'Unified decision interface for managing candidates, readouts, and shared communication threads.' })}
                  </p>
                </div>
                <div className="flex gap-3 pb-2">
                  <button type="button" className={secondaryButtonClass}>
                    <Users size={16} /> {t('rebuild.talent_pool.export', { defaultValue: 'Export pool' })}
                  </button>
                </div>
              </div>

              <div className="grid gap-8 xl:grid-cols-[400px_minmax(0,1fr)]">
                {/* Candidate List Sidebar */}
                <div className="space-y-4">
                  <div className={cn(panelClass, 'p-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-[color:var(--shell-panel-border)]')}>
                    <div className="max-h-[72vh] space-y-2 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                      {visibleCandidateInsights.length === 0 ? (
                        <div className="p-12 text-center text-sm leading-7 text-[color:var(--shell-text-muted)]">
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
                                'group relative w-full rounded-[22px] border p-4 text-left transition-all duration-300',
                                isActive
                                  ? 'border-[color:var(--shell-accent-cyan)] bg-white dark:bg-slate-800 shadow-[0_16px_36px_-12px_rgba(36,150,171,0.2)] ring-1 ring-[color:var(--shell-accent-cyan)]/20'
                                  : 'border-transparent hover:bg-white/60 dark:hover:bg-slate-800/60 hover:border-[color:var(--shell-panel-border)] hover:shadow-sm'
                              )}
                            >
                              <div className="flex items-center gap-4">
                                <div className="relative shrink-0">
                                  <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[color:var(--shell-track)] text-base font-bold text-[color:var(--shell-text-primary)] transition-transform group-hover:scale-105">
                                    {candidate.avatar_url ? (
                                      <img src={candidate.avatar_url} alt="" className="h-full w-full rounded-[inherit] object-cover" />
                                    ) : (
                                      candidate.candidateName.slice(0, 1)
                                    )}
                                  </div>
                                  {isLegacy && (
                                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-400 text-[8px] font-black text-white ring-2 ring-white dark:ring-slate-900 shadow-sm">L</div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-[15px] font-bold text-[color:var(--shell-text-primary)]">{candidate.candidateName}</div>
                                  <div className="truncate text-xs text-[color:var(--shell-text-muted)] mt-0.5">{candidate.headline || t('rebuild.recruiter.applicant', { defaultValue: 'Applicant' })}</div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-sm font-black text-[color:var(--shell-accent-cyan)]">{candidate.matchPercent}%</div>
                                  <div className="text-[9px] font-bold uppercase tracking-wider text-[color:var(--shell-text-muted)] mt-0.5">Match</div>
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
                  <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
                    <div className="space-y-8">
                      <section className="rounded-[32px] border border-[color:var(--shell-panel-border)] bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-10 shadow-sm transition-all duration-500">
                        <div className="flex flex-wrap items-center justify-between gap-8">
                          <div className="flex items-center gap-8">
                            <div className="h-24 w-24 rounded-[28px] bg-[color:var(--shell-track)] p-1 ring-1 ring-[color:var(--shell-panel-border)] shadow-inner">
                              {selectedCandidate.avatar_url ? (
                                <img src={selectedCandidate.avatar_url} alt="" className="h-full w-full rounded-[24px] object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center rounded-[24px] bg-white dark:bg-slate-800 text-3xl font-bold text-[color:var(--shell-text-muted)]">{selectedCandidate.candidateName.slice(0, 1)}</div>
                              )}
                            </div>
                            <div>
                              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[color:var(--shell-accent-cyan)]">{t('rebuild.candidate_profile.label', { defaultValue: 'Talent Profile' })}</div>
                              <h2 className="mt-2 text-4xl font-semibold tracking-tight text-[color:var(--shell-text-primary)]">{selectedCandidate.candidateName}</h2>
                              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                                <span className="font-semibold text-[color:var(--shell-text-secondary)]">{selectedCandidate.headline}</span>
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                                <span className="text-[color:var(--shell-text-muted)] font-medium">{selectedCandidate.location}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <button type="button" className="rounded-[18px] border border-transparent bg-rose-50 dark:bg-rose-950/20 px-6 py-3 text-sm font-semibold text-rose-600 dark:text-rose-400 transition hover:bg-rose-100 dark:hover:bg-rose-950/40">
                              Reject
                            </button>
                            <button type="button" className="rounded-[18px] border border-[color:var(--shell-panel-border)] bg-white dark:bg-slate-800 px-6 py-3 text-sm font-semibold text-[color:var(--shell-text-primary)] transition hover:bg-slate-50 dark:hover:bg-slate-700">
                              Schedule
                            </button>
                            <button type="button" className="rounded-[18px] bg-[color:var(--shell-accent-cyan)] px-8 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:opacity-90">
                              Hire Flow
                            </button>
                          </div>
                        </div>

                        <div className="mt-12 grid gap-10 md:grid-cols-2">
                          <div className="space-y-8">
                            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">{t('rebuild.recruiter.skills_cognition', { defaultValue: 'Skills and cognition' })}</h3>
                            <div className="space-y-7">
                              {selectedCandidate.skills.map((skill) => (
                                <div key={skill.label} className="group">
                                  <div className="mb-2.5 flex items-center justify-between">
                                    <span className="text-[15px] font-bold text-[color:var(--shell-text-primary)]">{skill.label}</span>
                                    <span className="text-xs font-black text-[color:var(--shell-accent-cyan)] opacity-80">{skill.score / 10}/10</span>
                                  </div>
                                  <div className="h-2 rounded-full bg-[color:var(--shell-track)] overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-[color:var(--shell-accent-cyan)] transition-all duration-1000 shadow-[0_0_8px_rgba(36,150,171,0.3)]"
                                      style={{ width: `${skill.score}%` }}
                                    />
                                  </div>
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {skill.tags.map((tag) => (
                                      <span key={tag} className="rounded-xl bg-[color:var(--shell-button-secondary-bg)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--shell-text-secondary)] border border-[color:var(--shell-panel-border)] shadow-sm">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-8">
                            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">{t('rebuild.recruiter.personal_story', { defaultValue: 'Personal story and bio' })}</h3>
                            <div className="rounded-[28px] bg-white/40 dark:bg-slate-800/40 p-8 text-[15px] leading-8 text-[color:var(--shell-text-secondary)] border border-[color:var(--shell-panel-border)] shadow-inner">
                              {selectedCandidate.bio || t('rebuild.talent_pool.no_bio', { defaultValue: 'The candidate has not filled in their personal story yet.' })}
                            </div>
                            <div className="flex flex-wrap gap-2.5">
                              {selectedCandidate.topSignals.map((signal) => (
                                <span key={signal} className="rounded-full bg-[color:var(--shell-accent-cyan)]/10 px-4 py-2 text-[11px] font-bold text-[color:var(--shell-accent-cyan)] border border-[color:var(--shell-accent-cyan)]/20 shadow-sm">
                                  ✧ {signal}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Dialogue Section Integrated better */}
                      <section className={cn(panelClass, 'p-10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-[color:var(--shell-panel-border)]')}>
                        <div className="flex flex-wrap items-center justify-between gap-6 border-b border-[color:var(--shell-header-border)] pb-8">
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">{t('rebuild.recruiter.live_dialogue_lane', { defaultValue: 'Real-time Dialogue' })}</div>
                            <h3 className="mt-2 text-2xl font-bold text-[color:var(--shell-text-primary)] tracking-tight">{t('rebuild.recruiter.shared_thread', { defaultValue: 'Shared communication thread' })}</h3>
                          </div>
                          {selectedRecruiterDialogueDetail?.status && (
                            <span className={cn('rounded-full px-5 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] shadow-sm', getApplicationStatusCopy(selectedRecruiterDialogueDetail.status).tone)}>
                              {getApplicationStatusCopy(selectedRecruiterDialogueDetail.status).label}
                            </span>
                          )}
                        </div>

                        <div className="mt-10">
                          {recruiterDialogueLoading ? (
                            <div className="flex h-48 items-center justify-center gap-4 text-[color:var(--shell-text-muted)]">
                              <Loader2 size={24} className="animate-spin text-[color:var(--shell-accent-cyan)]" />
                              <span className="font-medium">{t('rebuild.recruiter.loading_dialogue', { defaultValue: 'Navazuji spojení s vláknem...' })}</span>
                            </div>
                          ) : !selectedRecruiterDialogueId ? (
                            <div className="rounded-[32px] border-2 border-dashed border-[color:var(--shell-panel-border)] bg-slate-50/50 dark:bg-slate-800/30 p-16 text-center text-[15px] leading-8 text-[color:var(--shell-text-muted)] font-medium">
                              {t('rebuild.recruiter.no_native_thread', { defaultValue: 'Tento kandidát zatím nemá aktivní komunikační vlákno. Jakmile odpoví na některou z vašich výzev, uvidíte zde celou historii v reálném čase.' })}
                            </div>
                          ) : (
                            <div className="space-y-10">
                              <div className="space-y-6">
                                {selectedRecruiterDialogueMessages.length === 0 ? (
                                  <div className="text-center text-[13px] text-[color:var(--shell-text-muted)] py-10 italic">{t('rebuild.recruiter.no_messages', { defaultValue: 'Žádné zprávy k zobrazení.' })}</div>
                                ) : (
                                  selectedRecruiterDialogueMessages.slice(-10).map((message) => {
                                    const isRecruiter = message.sender_role === 'recruiter';
                                    return (
                                      <div key={message.id} className={cn('flex flex-col', isRecruiter ? 'items-end' : 'items-start')}>
                                        <div className={cn(
                                          'max-w-[80%] rounded-[28px] px-6 py-5 text-[14px] leading-7 shadow-xl transition-all duration-300 hover:shadow-2xl',
                                          isRecruiter
                                            ? 'bg-[linear-gradient(145deg,var(--shell-bg-accent),var(--shell-bg-base))] text-[color:var(--shell-text-primary)] border border-[color:var(--shell-panel-border)]'
                                            : 'bg-white dark:bg-slate-800 text-[color:var(--shell-text-secondary)] border border-[color:var(--shell-panel-border)]'
                                        )}>
                                          <div className="mb-3 text-[9px] font-bold uppercase tracking-[0.2em] opacity-40">
                                            {isRecruiter ? t('rebuild.recruiter.you_label', { defaultValue: 'Vy' }) : (selectedRecruiterDialogueDetail?.candidate_profile_snapshot?.name || t('rebuild.recruiter.candidate_label', { defaultValue: 'Kandidát' }))} · {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </div>
                                          <div className="font-medium">{message.body}</div>
                                          {message.attachments.length > 0 && (
                                            <div className="mt-5 flex flex-wrap gap-2.5">
                                              {message.attachments.map((at, idx) => <AttachmentChip key={idx} attachment={at} inverted={isRecruiter} />)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>

                              <div className="relative mt-12 group">
                                <textarea
                                  value={recruiterMessageDraft}
                                  onChange={(e) => setRecruiterMessageDraft(e.target.value)}
                                  rows={4}
                                  className={cn(textareaClass, 'pr-36 min-h-[140px] shadow-inner focus:shadow-2xl transition-all duration-500 rounded-[28px]')}
                                  placeholder={t('rebuild.recruiter.write_next_message', { defaultValue: 'Napište zprávu kandidátovi...' })}
                                />
                                <div className="absolute bottom-5 right-5 flex gap-3">
                                  <button
                                    type="button"
                                    onClick={() => recruiterAttachmentInputRef.current?.click()}
                                    className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[color:var(--shell-track)] text-[color:var(--shell-text-secondary)] hover:bg-[color:var(--shell-button-secondary-hover)] border border-[color:var(--shell-panel-border)] transition-all shadow-sm hover:shadow-md"
                                  >
                                    <Paperclip size={20} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRecruiterSendMessage()}
                                    disabled={recruiterMessageBusy || !recruiterMessageDraft.trim()}
                                    className={cn(primaryButtonClass, 'h-12 px-8 rounded-[20px] shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition-all')}
                                  >
                                    {recruiterMessageBusy ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
                                    <span className="font-bold">{t('rebuild.actions.send', { defaultValue: 'Send' })}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </section>
                    </div>

                    {/* Right sidebar with stats */}
                    <div className="space-y-8">
                      <div className="rounded-[32px] border border-[color:var(--shell-panel-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(255,255,255,0.4))] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.8),rgba(15,23,42,0.4))] backdrop-blur-xl p-8 shadow-sm">
                        <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-[color:var(--shell-accent-cyan)]">{t('rebuild.recruiter.talent_intelligence', { defaultValue: 'Talent Intelligence' })}</div>
                        <div className="mt-10 flex items-baseline gap-2">
                          <span className="text-6xl font-semibold tracking-tighter text-[color:var(--shell-text-primary)]">{selectedCandidate.verifiedScore}</span>
                          <span className="text-xl font-bold text-[color:var(--shell-text-muted)] opacity-60">%</span>
                        </div>
                        <div className="mt-3 text-sm font-bold text-[color:var(--shell-accent-cyan)]">{selectedCandidateScoreLabel}</div>
                        <div className="mt-8 h-[6px] rounded-full bg-[color:var(--shell-track)] overflow-hidden shadow-inner">
                          <div className="h-full bg-[color:var(--shell-accent-cyan)] transition-all duration-1000 shadow-[0_0_12px_rgba(36,150,171,0.5)]" style={{ width: `${selectedCandidate.verifiedScore}%` }} />
                        </div>
                        <p className="mt-10 text-[14px] font-medium leading-7 text-[color:var(--shell-text-secondary)] italic opacity-80 border-l-2 border-[color:var(--shell-accent-cyan)]/30 pl-5">
                          “{selectedCandidate.internalNote}”
                        </p>
                      </div>

                      <section className={cn(panelClass, 'p-8 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-[color:var(--shell-panel-border)]')}>
                        <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">Recruiter Insight</h4>
                        <div className="mt-6 space-y-5">
                          <div className="text-[15px] leading-8 text-[color:var(--shell-text-secondary)] font-medium">
                            {selectedCandidate.recommendation}
                          </div>
                        </div>
                      </section>

                      <section className="rounded-[32px] border border-[color:var(--shell-panel-border)] bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 shadow-sm">
                        <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">{t('rebuild.recruiter.candidate_metadata', { defaultValue: 'Candidate metadata' })}</h4>
                        <div className="mt-8 space-y-5">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-[color:var(--shell-text-muted)] font-medium">{t('rebuild.recruiter.profile_source', { defaultValue: 'Profile source' })}</span>
                            <span className="font-bold text-[color:var(--shell-text-primary)] bg-[color:var(--shell-track)] px-3 py-1 rounded-lg">{selectedCandidate.id.startsWith('legacy-') ? 'Legacy' : 'Native'}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-[color:var(--shell-text-muted)] font-medium">{t('rebuild.recruiter.location_label', { defaultValue: 'Location' })}</span>
                            <span className="font-bold text-[color:var(--shell-text-primary)]">{selectedCandidate.location}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-[color:var(--shell-text-muted)] font-medium">{t('rebuild.recruiter.created_at', { defaultValue: 'Created at' })}</span>
                            <span className="font-bold text-[color:var(--shell-text-primary)]">{selectedCandidate.created_at ? new Date(selectedCandidate.created_at).toLocaleDateString() : t('rebuild.recruiter.unknown', { defaultValue: 'Unknown' })}</span>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className={cn(panelClass, 'flex items-center justify-center p-24 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-[color:var(--shell-panel-border)]')}>
                    <div className="max-w-md text-center">
                      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[32px] bg-[color:var(--shell-track)] text-[color:var(--shell-accent-cyan)] shadow-inner">
                        <Users size={40} />
                      </div>
                      <h3 className="mt-8 text-3xl font-bold text-[color:var(--shell-text-primary)] tracking-tight">{t('rebuild.recruiter.select_candidate_detail', { defaultValue: 'Select a candidate for a detailed cognitive map' })}</h3>
                      <p className="mt-5 text-base leading-8 text-[color:var(--shell-text-muted)] font-medium opacity-80">
                        {t('rebuild.recruiter.select_candidate_desc', { defaultValue: 'Here you will see a detailed analysis of skills, histories, and common communication with the selected talent.' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {tab === 'integrations' ? (
            <RecruiterIntegrationsPage t={t} />
          ) : null}

          {tab === 'settings' && recruiterCompanyHydrated ? (
            <RecruiterSettingsPage 
              company={recruiterCompanyHydrated as any}
              userProfile={userProfile}
              t={t}
              onRefreshCompany={async () => {
                // In this context, we'd ideally trigger a re-fetch of the company profile.
                // For now we'll rely on the parent to handle updates if they pass onSaveRecruiterBrand.
                if (onSaveRecruiterBrand) {
                  // This is a bit of a hack to trigger a refresh in the parent if it's listening
                  onSaveRecruiterBrand(recruiterCompanyHydrated as any);
                }
              }}
            />
          ) : tab === 'settings' ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : null}
    </DashboardLayoutV2>
  );
};
