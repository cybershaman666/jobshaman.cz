import React from 'react';
import {
  AlertCircle,
  Archive,
  BookOpen,
  Building2,
  Check,
  CreditCard,
  Download,
  LayoutDashboard,
  Loader2,
  MapPin,
  Paperclip,
  Pause,
  Play,
  PlugZap,
  Plus,
  RefreshCw,
  Rocket,
  Settings,
  Settings2,
  Sparkles,
  Trash2,
  Users,
  Zap,
  SlidersHorizontal,
  ArrowUpDown,
  MessageSquare,
  UserMinus,
  CheckCircle,
  Clock,
  ChevronDown,
  Calendar,
  Dna,
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
  updateCompanyApplicationStatus,
} from '../../services/v2DialogueService';
import type { AssessmentTask } from '../../services/v2ChallengeService';

import { cn } from '../cn';
import { deriveDashboardMetrics } from '../derivations';
import type { CalendarEvent, CandidateInsight, Company, HandshakeBlueprint, Role } from '../models';
import type { RecruiterTab } from '../routing';
import { RecruiterAssistantPage } from './RecruiterAssistantPage';
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

interface CognitiveRadarChartProps {
  skills: Array<{ label: string; score: number }>;
  size?: number;
}

const CognitiveRadarChart: React.FC<CognitiveRadarChartProps> = ({ skills, size = 320 }) => {
  if (!skills || skills.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
        Nedostatek kognitivních dat pro zobrazení mapy
      </div>
    );
  }

  // Ensure we have at least 3 skills to make a radar shape, fallback to padded dummy if needed
  const chartSkills = skills.length >= 3 ? skills : [
    ...skills,
    ...Array.from({ length: 3 - skills.length }).map((_, i) => ({ label: `N/A ${i + 1}`, score: 0 }))
  ];

  const N = chartSkills.length;
  const center = size / 2;
  const radius = (size / 2) * 0.65; // leave 35% margin for text labels

  const getCoordinates = (value: number, index: number) => {
    const angle = (2 * Math.PI * index) / N - Math.PI / 2;
    const factor = Math.max(0, Math.min(100, value)) / 100;
    const x = center + radius * factor * Math.cos(angle);
    const y = center + radius * factor * Math.sin(angle);
    return { x, y, angle };
  };

  const gridLevels = [25, 50, 75, 100];
  const gridPaths = gridLevels.map((level) => {
    const points = Array.from({ length: N })
      .map((_, i) => {
        const { x, y } = getCoordinates(level, i);
        return `${x},${y}`;
      })
      .join(' ');
    return points;
  });

  const axisLines = Array.from({ length: N }).map((_, i) => {
    const { x, y } = getCoordinates(100, i);
    return { x1: center, y1: center, x2: x, y2: y };
  });

  const scorePoints = chartSkills
    .map((skill, i) => {
      const { x, y } = getCoordinates(skill.score, i);
      return `${x},${y}`;
    })
    .join(' ');

  const labelOffset = 22; // px offset for labels outside the radar
  const labels = chartSkills.map((skill, i) => {
    const { x, y, angle } = getCoordinates(100, i);
    const labelX = x + labelOffset * Math.cos(angle);
    const labelY = y + labelOffset * Math.sin(angle);

    // Text anchor alignment based on quadrant
    let textAnchor: "start" | "end" | "middle" | "inherit" = "middle";
    if (Math.cos(angle) > 0.1) textAnchor = "start";
    else if (Math.cos(angle) < -0.1) textAnchor = "end";

    // Vertical alignment offset adjustment
    let dy = '0.35em';
    if (Math.sin(angle) < -0.8) dy = '-0.2em';
    else if (Math.sin(angle) > 0.8) dy = '0.9em';

    return {
      text: skill.label,
      x: labelX,
      y: labelY,
      textAnchor,
      dy,
      score: skill.score
    };
  });

  return (
    <div className="flex justify-center items-center select-none p-2 bg-gradient-to-b from-white/10 to-transparent dark:from-slate-900/10 dark:to-transparent rounded-[32px] border border-slate-100/50 dark:border-slate-800/30 shadow-inner">
      <svg width={size} height={size} className="overflow-visible">
        {/* Glow Filters */}
        <defs>
          <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <radialGradient id="radarFillGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2496ab" stopOpacity="0.45" />
            <stop offset="70%" stopColor="#2496ab" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#2496ab" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Circular Grid Web Rings */}
        {gridPaths.map((pathPoints, idx) => (
          <polygon
            key={idx}
            points={pathPoints}
            fill="none"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth="1"
            strokeDasharray={idx === gridPaths.length - 1 ? 'none' : '4 4'}
          />
        ))}

        {/* Spoke Axis Lines */}
        {axisLines.map((axis, idx) => (
          <line
            key={idx}
            x1={axis.x1}
            y1={axis.y1}
            x2={axis.x2}
            y2={axis.y2}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth="1"
          />
        ))}

        {/* Filled Data Web Area */}
        <polygon
          points={scorePoints}
          fill="url(#radarFillGrad)"
          stroke="#2496ab"
          strokeWidth="3.5"
          filter="url(#radarGlow)"
          className="transition-all duration-1000 ease-out"
        />

        {/* Outer Data Points */}
        {chartSkills.map((skill, i) => {
          const { x, y } = getCoordinates(skill.score, i);
          return (
            <g key={i} className="group cursor-pointer">
              <circle
                cx={x}
                cy={y}
                r="6.5"
                fill="#2496ab"
                stroke="white"
                strokeWidth="2.5"
                className="shadow-md transition-all duration-300 hover:scale-150"
              />
              <circle
                cx={x}
                cy={y}
                r="14"
                fill="#2496ab"
                fillOpacity="0"
                className="hover:fill-opacity-15 transition-all duration-300"
              />
            </g>
          );
        })}

        {/* Skill Labels */}
        {labels.map((lbl, idx) => (
          <g key={idx}>
            <text
              x={lbl.x}
              y={lbl.y}
              textAnchor={lbl.textAnchor}
              dy={lbl.dy}
              className="text-[11px] font-bold fill-slate-700 dark:fill-slate-300 tracking-wide uppercase"
            >
              {lbl.text}
            </text>
            <text
              x={lbl.x}
              y={lbl.y}
              textAnchor={lbl.textAnchor}
              dy={lbl.dy === '-0.2em' ? '-1.5em' : '2.5em'}
              className="text-[10px] font-black fill-[#2496ab]/80"
            >
              {Math.round(lbl.score / 10)}/10
            </text>
          </g>
        ))}
      </svg>
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
  onRefreshCompany: () => Promise<void>;
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
  onUpdateRoleStatus?: (roleId: string, status: 'active' | 'paused' | 'closed' | 'archived' | 'published') => Promise<void>;
  onDeleteRole?: (roleId: string) => Promise<void>;
  onRefreshRoles?: () => Promise<void>;
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
  onRefreshCompany,
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
  onUpdateRoleStatus,
  onDeleteRole,
  onRefreshRoles,
  t,
  i18n: _i18n,
}) => {
  const [selectedCandidateId, setSelectedCandidateId] = React.useState(candidateInsights[0]?.id || '');
  const [candidateDetailTab, setCandidateDetailTab] = React.useState<'cognitive' | 'shami' | 'readout' | 'chat'>('cognitive');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'handshake' | 'open'>('all');
  const [archetypeFilter, setArchetypeFilter] = React.useState<string>('all');
  const [candidateSortBy, setCandidateSortBy] = React.useState<'match' | 'name' | 'newest'>('match');
  const [isSchedulingModalOpen, setIsSchedulingModalOpen] = React.useState(false);
  const [scheduledMeetingTime, setScheduledMeetingTime] = React.useState('');
  const [scheduledMeetingDate, setScheduledMeetingDate] = React.useState('');
  const [scheduledMeetingStage, setScheduledMeetingStage] = React.useState('initial');
  const [scheduledMeetingNote, setScheduledMeetingNote] = React.useState('');
  const [isHireFlowDropdownOpen, setIsHireFlowDropdownOpen] = React.useState(false);
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
  const [refreshingRoles, setRefreshingRoles] = React.useState(false);
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
    setChallengeNotice(t('rebuild.recruiter.ai_draft_ready', { defaultValue: 'AI připravila návrh role a assessmentu. Zkontrolujte jej a potvrďte uložením.' }));
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

  const handleRefreshRolesClick = async () => {
    if (!onRefreshRoles) return;
    setRefreshingRoles(true);
    setChallengeError('');
    setChallengeNotice('');
    try {
      await onRefreshRoles();
      setChallengeNotice(t('rebuild.recruiter.roles_refreshed', { defaultValue: 'Roles successfully refreshed.' }));
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : t('rebuild.recruiter.refresh_failed', { defaultValue: 'Failed to refresh roles.' }));
    } finally {
      setRefreshingRoles(false);
    }
  };

  const handleDownloadRole = (role: Role) => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(role, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${role.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-role.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setChallengeNotice(t('rebuild.recruiter.role_downloaded', { defaultValue: 'Role data downloaded successfully.' }));
    } catch (error) {
      setChallengeError(t('rebuild.recruiter.download_failed', { defaultValue: 'Failed to download role data.' }));
    }
  };

  const handleUpdateStatus = async (roleId: string, nextStatus: 'active' | 'paused' | 'closed' | 'archived' | 'published') => {
    if (!onUpdateRoleStatus) return;
    setChallengeBusyId(roleId);
    setChallengeError('');
    setChallengeNotice('');
    try {
      await onUpdateRoleStatus(roleId, nextStatus);
      setChallengeNotice(t('rebuild.recruiter.role_status_updated', { defaultValue: 'Role status updated successfully.' }));
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : t('rebuild.recruiter.status_update_failed', { defaultValue: 'Failed to update status.' }));
    } finally {
      setChallengeBusyId(null);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!onDeleteRole) return;
    setChallengeBusyId(roleId);
    setChallengeError('');
    setChallengeNotice('');
    try {
      await onDeleteRole(roleId);
      setChallengeNotice(t('rebuild.recruiter.role_deleted', { defaultValue: 'Role was permanently removed.' }));
    } catch (error) {
      setChallengeError(error instanceof Error ? error.message : t('rebuild.recruiter.role_delete_failed', { defaultValue: 'Failed to delete role.' }));
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
    const activeHandshakeCandidates = candidateInsights.filter((candidate) => candidate.source === 'handshake' || candidate.id.startsWith('application-'));
    const activeCandidateNames = new Set(activeHandshakeCandidates.map((candidate) => candidate.candidateName.trim().toLowerCase()).filter(Boolean));
    const roleTokens = new Set(
      visibleRoles
        .flatMap((role) => [role.title, role.challenge, role.summary, ...role.skills])
        .join(' ')
        .toLowerCase()
        .split(/[^a-z0-9á-ž]+/i)
        .filter((token) => token.length > 3),
    );
    const openTalentCandidates = allRegisteredCandidates
      .filter((candidate) => !activeCandidateNames.has(candidate.candidateName.trim().toLowerCase()))
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
    return [...activeHandshakeCandidates, ...openTalentCandidates];
  }, [allRegisteredCandidates, candidateInsights, tab, visibleRoles, t]);
  const visibleCandidateInsights = React.useMemo(() => {
    let result = [...talentPoolCandidates];

    // Status Filter
    if (statusFilter === 'handshake') {
      result = result.filter((c) => c.source === 'handshake' || c.id.startsWith('application-'));
    } else if (statusFilter === 'open') {
      result = result.filter((c) => c.source !== 'handshake' && !c.id.startsWith('application-'));
    }

    // Archetype Filter
    if (archetypeFilter !== 'all') {
      result = result.filter((c) => {
        const arch = (c as any).preferences?.candidate_onboarding_v2?.archetype || '';
        return arch.toUpperCase() === archetypeFilter.toUpperCase();
      });
    }

    // Search Filter
    if (normalizedRecruiterSearch) {
      result = result.filter((candidate) => {
        const haystack = [
          candidate.candidateName,
          candidate.headline,
          candidate.location,
          candidate.recommendation,
          candidate.internalNote,
          ...candidate.topSignals,
        ].join(' ').toLowerCase();
        return haystack.includes(normalizedRecruiterSearch);
      });
    }

    // Sort order
    if (candidateSortBy === 'name') {
      result.sort((a, b) => a.candidateName.localeCompare(b.candidateName));
    } else if (candidateSortBy === 'newest') {
      result.sort((a, b) => {
        const dateA = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
        const dateB = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
        return dateB - dateA;
      });
    } else {
      // Default: match score
      result.sort((a, b) => (b.verifiedScore || b.matchPercent || 0) - (a.verifiedScore || a.matchPercent || 0));
    }

    return result;
  }, [talentPoolCandidates, statusFilter, archetypeFilter, normalizedRecruiterSearch, candidateSortBy]);

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
  const selectedRecruiterReadout = React.useMemo(
    () => (selectedRecruiterDialogueDetail?.application_payload as any)?.readout || (selectedRecruiterDialogueDetail as any)?.signal_boost?.recruiter_readout || null,
    [selectedRecruiterDialogueDetail],
  );
  const selectedReadoutEvidence = React.useMemo(
    () => Array.isArray(selectedRecruiterReadout?.evidence_sections) ? selectedRecruiterReadout.evidence_sections : [],
    [selectedRecruiterReadout],
  );
  const selectedReadoutScorecards = React.useMemo(
    () => Array.isArray(selectedRecruiterReadout?.scorecards) ? selectedRecruiterReadout.scorecards : [],
    [selectedRecruiterReadout],
  );

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
  const handleRejectCandidate = async (candidateId: string) => {
    if (!window.confirm(t('rebuild.recruiter.reject_confirm', { defaultValue: 'Opravdu chcete tohoto kandidáta zamítnout?' }))) return;
    try {
      const dialogueId = candidateId.startsWith('application-') ? candidateId.replace('application-', '') : candidateId;
      const okResponse = await updateCompanyApplicationStatus(dialogueId, 'rejected');
      if (okResponse?.ok) {
        alert(t('rebuild.recruiter.rejected_success', { defaultValue: 'Kandidát byl úspěšně zamítnut.' }));
        if (onRefreshRoles) onRefreshRoles();
      } else {
        alert(t('rebuild.recruiter.error_status_update', { defaultValue: 'Chyba při aktualizaci stavu.' }));
      }
    } catch (err) {
      console.error(err);
      alert(t('rebuild.recruiter.error_status_update', { defaultValue: 'Chyba při aktualizaci stavu.' }));
    }
  };

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
          : tab === 'assistant'
            ? t('rebuild.recruiter.assistant_title', { defaultValue: 'Ask Shami' })
            : t('rebuild.recruiter.nav_company_profile', { defaultValue: 'Firemní profil' });
  const workspaceSubtitle = tab === 'roles'
    ? t('rebuild.recruiter.subtitle_roles', { defaultValue: 'Role assignments, evidence of ability, and skill-first selection management.' })
    : tab === 'talent-pool'
      ? t('rebuild.recruiter.subtitle_candidates', { defaultValue: 'Candidate profiles, recruiter readout, and shared threads in one decision space.' })
      : tab === 'integrations'
        ? t('rebuild.recruiter.subtitle_integrations', { defaultValue: 'API klíče, webhooky, ATS návody a audit doručení.' })
        : tab === 'billing'
          ? t('rebuild.recruiter.subtitle_billing', { defaultValue: 'Plan details, usage tracking, invoices, and payment management.' })
          : tab === 'assistant'
            ? t('rebuild.recruiter.assistant_subtitle', { defaultValue: 'Váš náborový a asistenční průvodce Shami' })
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
                    <div className="flex items-center gap-3">
                      {onRefreshRoles && (
                        <button
                          type="button"
                          disabled={refreshingRoles}
                          onClick={handleRefreshRolesClick}
                          className="h-14 px-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all flex items-center justify-center gap-2 font-semibold shadow-sm"
                        >
                          <RefreshCw size={18} className={cn(refreshingRoles && "animate-spin")} />
                          {t('rebuild.recruiter.refresh', { defaultValue: 'Refresh' })}
                        </button>
                      )}
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
                  </div>

                  {challengeError && (
                    <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-3">
                      <AlertCircle className="shrink-0" size={18} />
                      <div className="flex-1">{challengeError}</div>
                      <button onClick={() => setChallengeError('')} className="hover:opacity-75">✕</button>
                    </div>
                  )}
                  {challengeNotice && (
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-3">
                      <Check className="shrink-0" size={18} />
                      <div className="flex-1">{challengeNotice}</div>
                      <button onClick={() => setChallengeNotice('')} className="hover:opacity-75">✕</button>
                    </div>
                  )}

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

                        const renderStatusBadge = (status?: string) => {
                          const normalized = (status || 'draft').toLowerCase();
                          if (normalized === 'published' || normalized === 'active') {
                            return (
                              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                {t('rebuild.recruiter.status_live', { defaultValue: 'Live' })}
                              </span>
                            );
                          }
                          if (normalized === 'paused') {
                            return (
                              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                {t('rebuild.recruiter.status_paused', { defaultValue: 'Paused' })}
                              </span>
                            );
                          }
                          if (normalized === 'archived' || normalized === 'closed') {
                            return (
                              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-200 dark:border-slate-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                {t('rebuild.recruiter.status_archived', { defaultValue: 'Archived' })}
                              </span>
                            );
                          }
                          return (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/30">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                              {t('rebuild.recruiter.status_draft', { defaultValue: 'Draft' })}
                            </span>
                          );
                        };

                        return (
                          <div key={role.id} className="group relative rounded-[32px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm transition-all hover:shadow-xl hover:border-amber-200/50 dark:hover:border-amber-900/30 overflow-hidden">
                            {/* Handshake Progress Bar */}
                            <div className="absolute top-0 left-0 right-0 h-1 bg-slate-50 dark:bg-slate-800">
                              <div className={cn('h-full transition-all duration-1000', completeness === 100 ? 'bg-emerald-500' : 'bg-amber-400')} style={{ width: `${completeness}%` }} />
                            </div>

                            <div className="flex flex-col h-full">
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-500">{roleFamilyLabel[role.roleFamily]}</span>
                                    {renderStatusBadge(role.status)}
                                    {completeness === 100 ? (
                                      <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/30">
                                        <Check size={10} /> {t('rebuild.recruiter.ready_handshake', { defaultValue: 'Handshake Ready' })}
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30">{t('rebuild.recruiter.incomplete_handshake', { defaultValue: 'Draft' })}</span>
                                    )}
                                  </div>
                                  <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">{role.title}</h3>
                                </div>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleDownloadRole(role)}
                                    title={t('rebuild.recruiter.download_role', { defaultValue: 'Download Role JSON' })}
                                    className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"
                                  >
                                    <Download size={18} />
                                  </button>
                                  {onUpdateRoleStatus && (role.status === 'published' || role.status === 'active') && (
                                    <button
                                      onClick={() => handleUpdateStatus(role.id, 'paused')}
                                      title={t('rebuild.recruiter.pause_role', { defaultValue: 'Pause Role' })}
                                      className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-all"
                                    >
                                      <Pause size={18} />
                                    </button>
                                  )}
                                  {onUpdateRoleStatus && role.status === 'paused' && (
                                    <button
                                      onClick={() => handleUpdateStatus(role.id, 'published')}
                                      title={t('rebuild.recruiter.resume_role', { defaultValue: 'Resume Role' })}
                                      className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
                                    >
                                      <Play size={18} />
                                    </button>
                                  )}
                                  {onUpdateRoleStatus && role.status !== 'archived' && role.status !== 'closed' && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(t('rebuild.recruiter.archive_confirm', { defaultValue: 'Are you sure you want to archive this role?' }))) {
                                          handleUpdateStatus(role.id, 'archived');
                                        }
                                      }}
                                      title={t('rebuild.recruiter.archive_role', { defaultValue: 'Archive Role' })}
                                      className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-700 dark:hover:text-amber-400 transition-all"
                                    >
                                      <Archive size={18} />
                                    </button>
                                  )}
                                  {onDeleteRole && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm(t('rebuild.recruiter.delete_confirm', { defaultValue: 'Do you really want to permanently delete this role? This cannot be undone.' }))) {
                                          void handleDeleteRole(role.id);
                                        }
                                      }}
                                      title={t('rebuild.recruiter.delete_role', { defaultValue: 'Delete Role Permanently' })}
                                      className="p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => {
                                      setEditingRole(role);
                                      setIsRoleEditorOpen(true);
                                    }}
                                    title={t('rebuild.recruiter.edit_role', { defaultValue: 'Edit Role Settings' })}
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
                                  {role.status !== 'published' && role.status !== 'active' && role.status !== 'archived' && role.status !== 'closed' && role.status !== 'paused' ? (
                                    <button
                                      type="button"
                                      disabled={challengeBusyId === role.id}
                                      onClick={() => void handlePublishChallenge(role.id)}
                                      className={cn(primaryButtonClass, 'rounded-xl px-5 py-2.5 text-xs bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100')}
                                    >
                                      {challengeBusyId === role.id ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                                      {t('rebuild.recruiter.publish', { defaultValue: 'Publish' })}
                                    </button>
                                  ) : (
                                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 py-2.5">
                                      {role.status === 'archived' || role.status === 'closed'
                                        ? t('rebuild.recruiter.archived_closed', { defaultValue: 'Closed / Archived' })
                                        : role.status === 'paused'
                                          ? t('rebuild.recruiter.paused_marketplace', { defaultValue: 'Paused in Marketplace' })
                                          : t('rebuild.recruiter.active_marketplace', { defaultValue: 'Live in Marketplace' })
                                      }
                                    </span>
                                  )}
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
                                  <div className="flex min-w-0 items-center gap-2">
                                    <div className="truncate text-[15px] font-bold text-[color:var(--shell-text-primary)]">{candidate.candidateName}</div>
                                    {candidate.source === 'handshake' || candidate.id.startsWith('application-') ? (
                                      <span className="shrink-0 rounded-full bg-[color:var(--shell-accent-cyan)]/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[color:var(--shell-accent-cyan)]">
                                        Handshake
                                      </span>
                                    ) : null}
                                    {(() => {
                                      const arch = (candidate as any).preferences?.candidate_onboarding_v2?.archetype;
                                      if (!arch) return null;
                                      const archetypeStyles: Record<string, string> = {
                                        BUDOVATEL: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
                                        VIZIONAR: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
                                        PRUZKUMNIK: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20',
                                        STRAZCE: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
                                      };
                                      const archetypeLabels: Record<string, string> = { BUDOVATEL: 'Budovatel', VIZIONAR: 'Vizionář', PRUZKUMNIK: 'Průzkumník', STRAZCE: 'Strážce' };
                                      return (
                                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider border', archetypeStyles[arch] || 'text-slate-400 bg-slate-400/10 border-slate-400/20')}>
                                          {archetypeLabels[arch] || arch}
                                        </span>
                                      );
                                    })()}
                                  </div>
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
                <div>
                  {selectedCandidate && visibleCandidateInsights.some((candidate) => candidate.id === selectedCandidate.id) ? (
                    <div className="space-y-8 animate-fade-in">
                      {/* Premium Candidate Header Banner card */}
                      <div className="group/banner relative overflow-hidden rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl p-8 shadow-md">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none group-hover/banner:bg-cyan-500/20 transition-all duration-1000" />
                        
                        <div className="relative z-10 flex flex-wrap items-start justify-between gap-6">
                          <div className="flex flex-wrap items-center gap-5">
                            <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-gradient-to-br from-cyan-500 to-teal-500 text-white font-black text-2xl shadow-lg">
                              {selectedCandidate.candidateName.charAt(0)}
                            </div>
                            <div className="space-y-1">
                              <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                                {selectedCandidate.candidateName}
                              </h2>
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                <span>{selectedCandidate.headline}</span>
                                <span className="h-1 w-1 rounded-full bg-slate-355" />
                                <span className="flex items-center gap-1"><MapPin size={12} /> {selectedCandidate.location}</span>
                              </p>
                            </div>
                          </div>

                          {/* ACTION BUTTONS */}
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleRejectCandidate(selectedCandidate.id)}
                              className="rounded-[18px] border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/60 px-5 py-3 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-955/20 hover:text-rose-600 hover:border-rose-200 transition flex items-center gap-2 shadow-sm"
                            >
                              <UserMinus size={14} /> Zamítnout
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setScheduledMeetingDate('');
                                setScheduledMeetingTime('');
                                setScheduledMeetingStage('initial');
                                setScheduledMeetingNote('');
                                setIsSchedulingModalOpen(true);
                              }}
                              className="rounded-[18px] border border-slate-200 dark:border-slate-850 bg-white/60 dark:bg-slate-900/60 px-5 py-3 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-slate-350 transition flex items-center gap-2 shadow-sm"
                            >
                              <Calendar size={14} /> Naplánovat
                            </button>

                            {/* Dropdown Menu for Hire Flow */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setIsHireFlowDropdownOpen(!isHireFlowDropdownOpen)}
                                className="rounded-[18px] bg-[color:var(--shell-accent-cyan)] px-8 py-3 text-xs font-bold text-white shadow-[0_4px_16px_rgba(36,150,171,0.4)] transition hover:shadow-[0_8px_24px_rgba(36,150,171,0.6)] hover:-translate-y-0.5 flex items-center gap-2"
                              >
                                Hire Flow <ChevronDown size={14} />
                              </button>
                              {isHireFlowDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 p-2 shadow-2xl z-20">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setIsHireFlowDropdownOpen(false);
                                      if (!selectedRecruiterDialogueId) {
                                        alert("Tento kandidát nemá aktivní handshake. Zašlete mu nejprve pozvánku.");
                                        return;
                                      }
                                      try {
                                        const ok = await updateCompanyApplicationStatus(selectedRecruiterDialogueId, 'shortlisted');
                                        if (ok?.ok) {
                                          alert("Kandidát byl přesunut do užšího výběru (shortlisted)!");
                                          if (onRefreshRoles) onRefreshRoles();
                                        } else {
                                          alert("Nepodařilo se aktualizovat status kandidáta.");
                                        }
                                      } catch (err) {
                                        console.error(err);
                                        alert("Chyba při komunikaci se serverem.");
                                      }
                                    }}
                                    className="w-full rounded-xl text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition flex items-center gap-2"
                                  >
                                    <CheckCircle size={14} className="text-emerald-500" /> Posunout do shortlistu
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsHireFlowDropdownOpen(false);
                                      alert("Výzva k testování (assessment) byla odeslána kandidátovi!");
                                    }}
                                    className="w-full rounded-xl text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition flex items-center gap-2"
                                  >
                                    <Zap size={14} className="text-[color:var(--shell-accent-cyan)]" /> Pozvat k testu (Challenge)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsHireFlowDropdownOpen(false);
                                      alert("Návrh nabídky (offer) byl připraven a zaslán kandidátovi!");
                                    }}
                                    className="w-full rounded-xl text-left px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 transition flex items-center gap-2"
                                  >
                                    <Sparkles size={14} className="text-amber-500" /> Připravit nabídku (Offer)
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Redesigned Tab Navigation Menu */}
                      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1.5 p-1 bg-slate-100/50 dark:bg-slate-900/30 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setCandidateDetailTab('cognitive')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all',
                            candidateDetailTab === 'cognitive'
                              ? 'bg-white dark:bg-slate-800 text-slate-850 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          )}
                        >
                          <SlidersHorizontal size={14} /> Kognitivní mapa
                        </button>
                        <button
                          type="button"
                          onClick={() => setCandidateDetailTab('shami')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all',
                            candidateDetailTab === 'shami'
                              ? 'bg-white dark:bg-slate-800 text-slate-850 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          )}
                        >
                          <Dna size={14} /> Hodnocení Shamiho
                        </button>
                        <button
                          type="button"
                          onClick={() => setCandidateDetailTab('readout')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all',
                            candidateDetailTab === 'readout'
                              ? 'bg-white dark:bg-slate-800 text-slate-855 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          )}
                        >
                          <Clock size={14} /> Dotazník & Readouts
                        </button>
                        <button
                          type="button"
                          onClick={() => setCandidateDetailTab('chat')}
                          className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all',
                            candidateDetailTab === 'chat'
                              ? 'bg-white dark:bg-slate-800 text-slate-855 dark:text-white shadow-sm border border-slate-200/50 dark:border-slate-700/50'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          )}
                        >
                          <MessageSquare size={14} /> Konverzace
                        </button>
                      </div>

                      {/* TAB CONTENT AREAS */}
                      <div className="space-y-8 min-h-[400px]">
                        {/* 1. Kognitivní mapa Tab */}
                        {candidateDetailTab === 'cognitive' && (
                          <div className="grid gap-8 lg:grid-cols-2 animate-fade-in">
                            {/* Radar Chart */}
                            <div className="rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 flex flex-col justify-center items-center">
                              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)] mb-6 self-start">Visualizace kognitivních schopností</h3>
                              <CognitiveRadarChart skills={selectedCandidate.skills} />
                            </div>

                            {/* Skills progress and story */}
                            <div className="space-y-6">
                              <div className="rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 space-y-6">
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">Klíčové dovednosti</h3>
                                <div className="space-y-6">
                                  {selectedCandidate.skills.map((skill) => (
                                    <div key={skill.label} className="group">
                                      <div className="mb-2 flex items-center justify-between">
                                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{skill.label}</span>
                                        <span className="text-xs font-black text-[color:var(--shell-accent-cyan)]">{skill.score / 10}/10</span>
                                      </div>
                                      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                        <div
                                          className="h-full rounded-full bg-[color:var(--shell-accent-cyan)] transition-all duration-1000"
                                          style={{ width: `${skill.score}%` }}
                                        />
                                      </div>
                                      <div className="mt-3 flex flex-wrap gap-1.5">
                                        {skill.tags.map((tag) => (
                                          <span key={tag} className="rounded-lg bg-slate-50 dark:bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-850">
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">Osobní příběh a bio</h3>
                                <blockquote className="rounded-2xl bg-white/50 dark:bg-slate-950/40 p-6 text-sm leading-7 text-slate-600 dark:text-slate-400 border-l-4 border-[color:var(--shell-accent-cyan)] italic">
                                  {selectedCandidate.bio || t('rebuild.talent_pool.no_bio', { defaultValue: 'Kandidát zatím nevyplnil svůj osobní příběh.' })}
                                </blockquote>
                                <div className="flex flex-wrap gap-2 pt-2">
                                  {selectedCandidate.topSignals.map((signal) => (
                                    <span key={signal} className="rounded-full bg-[color:var(--shell-accent-cyan)]/10 px-3.5 py-1.5 text-[10px] font-bold text-[color:var(--shell-accent-cyan)] border border-[color:var(--shell-accent-cyan)]/25">
                                      ✧ {signal}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 2. Hodnocení Shamiho Tab */}
                        {candidateDetailTab === 'shami' && (
                          <div className="space-y-6 animate-fade-in">
                            {(() => {
                              const onboarding = (selectedCandidate as any).preferences?.candidate_onboarding_v2;
                              if (!onboarding?.archetype) {
                                return (
                                  <div className="rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-850 p-16 text-center text-sm text-slate-400 dark:text-slate-500 font-medium">
                                    Tento kandidát ještě nedokončil onboarding rituál. Kognitivní hodnocení Shamiho se objeví po dokončení rituálu.
                                  </div>
                                );
                              }
                              const archetype = onboarding.archetype as string;
                              const archetypeLabels: Record<string, string> = { BUDOVATEL: 'Budovatel', VIZIONAR: 'Vizionář', PRUZKUMNIK: 'Průzkumník', STRAZCE: 'Strážce' };
                              const archetypeDescriptions: Record<string, string> = {
                                BUDOVATEL: 'Řemeslník duše i hmoty. Budovatel staví věci, které přetrvají – od kódu po mosty. Důraz na preciznost a řemeslo.',
                                VIZIONAR: 'Vizionář vidí za horizont. Inspiruje ostatní a formuje budoucnost svým pohledem. Vize a odvaha jsou jeho kompas.',
                                PRUZKUMNIK: 'Průzkumník hledá nové cesty. Učí se, roste a překonává hranice poznání. Zvědavost je jeho motor.',
                                STRAZCE: 'Strážce chrání to, na čem záleží. Spolehlivost a zodpovědnost jsou jeho základ. Tým může spát klidně.',
                              };
                              const archetypeEmojis: Record<string, string> = { BUDOVATEL: '🔨', VIZIONAR: '🔮', PRUZKUMNIK: '🧭', STRAZCE: '🛡️' };
                              const archetypeColorSets: Record<string, { glow: string; text: string; bg: string; border: string; gradFrom: string; gradTo: string }> = {
                                BUDOVATEL: { glow: 'shadow-[0_8px_40px_-8px_rgba(245,158,11,0.15)]', text: 'text-amber-500 dark:text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20', gradFrom: 'from-amber-500/5', gradTo: 'to-orange-500/5' },
                                VIZIONAR: { glow: 'shadow-[0_8px_40px_-8px_rgba(139,92,246,0.15)]', text: 'text-purple-500 dark:text-purple-400', bg: 'bg-purple-500/5', border: 'border-purple-500/20', gradFrom: 'from-purple-500/5', gradTo: 'to-indigo-500/5' },
                                PRUZKUMNIK: { glow: 'shadow-[0_8px_40px_-8px_rgba(34,211,238,0.15)]', text: 'text-cyan-500 dark:text-cyan-400', bg: 'bg-cyan-500/5', border: 'border-cyan-500/20', gradFrom: 'from-cyan-500/5', gradTo: 'to-teal-500/5' },
                                STRAZCE: { glow: 'shadow-[0_8px_40px_-8px_rgba(16,185,129,0.15)]', text: 'text-emerald-500 dark:text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', gradFrom: 'from-emerald-500/5', gradTo: 'to-green-500/5' },
                              };
                              const colors = archetypeColorSets[archetype] || archetypeColorSets.BUDOVATEL;
                              const candidateValues = Array.isArray((selectedCandidate as any).values) && (selectedCandidate as any).values.length > 0
                                ? (selectedCandidate as any).values
                                : (Array.isArray(onboarding.values) ? onboarding.values : []);
                              const motivations = Array.isArray(onboarding.motivations) ? onboarding.motivations : [];
                              const inferredSkills = Array.isArray(onboarding.inferred_skills) ? onboarding.inferred_skills : [];

                              return (
                                <div className="space-y-8">
                                  {/* Shami's message verdict card */}
                                  <div className="rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 flex items-start gap-5 shadow-sm">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-2xl font-bold">
                                      🦌
                                    </div>
                                    <div className="space-y-2">
                                      <div className="text-[10px] font-black tracking-wider uppercase text-cyan-500">Agenturní verdikt cyber-sobíka Shamiho</div>
                                      <p className="text-sm leading-7 text-slate-700 dark:text-slate-300 font-medium italic">
                                        “{selectedCandidate.recommendation || selectedCandidate.internalNote}”
                                      </p>
                                    </div>
                                  </div>

                                  {/* Detailed Archetype card */}
                                  <div className={cn(
                                    'rounded-[32px] border p-8 relative overflow-hidden bg-gradient-to-br shadow-md',
                                    colors.border, colors.glow, colors.gradFrom, colors.gradTo
                                  )}>
                                    <div className="absolute top-6 right-8 text-7xl opacity-15 select-none">{archetypeEmojis[archetype] || '✧'}</div>
                                    <div className="space-y-4">
                                      <div className="flex items-center gap-3">
                                        <span className={cn('px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border', colors.text, colors.bg, colors.border)}>
                                          Archetyp: {archetypeLabels[archetype] || archetype}
                                        </span>
                                        {onboarding.completed_at && (
                                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                            Rituál dokončen {new Date(onboarding.completed_at).toLocaleDateString('cs-CZ')}
                                          </span>
                                        )}
                                      </div>
                                      <h4 className="text-2xl font-black text-slate-900 dark:text-white">
                                        {archetypeLabels[archetype] || archetype}
                                      </h4>
                                      <p className="max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-400 font-medium">
                                        {archetypeDescriptions[archetype] || 'Unikátní kognitivní profil s vlastním vzorcem řešení problémů.'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Values and Motivations */}
                                  <div className="grid gap-6 md:grid-cols-2">
                                    <div className="rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 space-y-4">
                                      <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">Osobní hodnoty</h4>
                                      <div className="flex flex-wrap gap-2">
                                        {candidateValues.length > 0 ? candidateValues.map((value: string) => (
                                          <span key={value} className="rounded-full bg-slate-50 dark:bg-slate-950/60 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-150 dark:border-slate-850">
                                            ✦ {value}
                                          </span>
                                        )) : (
                                          <span className="text-xs text-slate-400 italic">Nevyplněno</span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 space-y-4">
                                      <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">Motivátory k výkonu</h4>
                                      <div className="flex flex-wrap gap-2">
                                        {motivations.length > 0 ? motivations.map((motivation: string) => (
                                          <span key={motivation} className="rounded-full bg-cyan-500/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                                            ◈ {motivation}
                                          </span>
                                        )) : (
                                          <span className="text-xs text-slate-400 italic">Nevyplněno</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Inferred Skills */}
                                  {inferredSkills.length > 0 && (
                                    <div className="rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 space-y-4">
                                      <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">Odvozené (inferred) dovednosti</h4>
                                      <div className="flex flex-wrap gap-2">
                                        {inferredSkills.map((skill: string) => (
                                          <span key={skill} className="rounded-xl bg-white/60 dark:bg-slate-800/60 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800/60">
                                            {skill}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* 3. Dotazník & Readouts Tab */}
                        {candidateDetailTab === 'readout' && (
                          <div className="space-y-6 animate-fade-in">
                            {!selectedRecruiterDialogueId && !selectedRecruiterReadout ? (
                              <div className="rounded-[32px] border-2 border-dashed border-slate-200 dark:border-slate-850 p-16 text-center text-sm text-slate-400 dark:text-slate-500 font-medium">
                                Tento kandidát zatím nebyl zapojen do Handshake dialogu. Dotazník a scorecards se vygenerují po zahájení komunikace.
                              </div>
                            ) : (
                              <div className="rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 shadow-sm">
                                <div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-8 mb-8">
                                  <div className="space-y-1 flex-1">
                                    <div className="text-[10px] font-black tracking-wider uppercase text-cyan-500">Handshake readout</div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                                      {selectedCandidate.jobTitle || (selectedRecruiterDialogueDetail as any)?.job_title || t('rebuild.recruiter.candidate_submission', { defaultValue: 'Pozice a vyhodnocení' })}
                                    </h3>
                                    <p className="text-sm leading-6 text-slate-500 dark:text-slate-400 max-w-3xl">
                                      {selectedRecruiterReadout?.summary || selectedCandidate.recommendation}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2 shrink-0">
                                    {selectedCandidate.hasJcfpm ? <span className="rounded-full bg-emerald-100/80 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">JCFPM</span> : null}
                                    {selectedCandidate.hasCv ? <span className="rounded-full bg-blue-100/80 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:bg-blue-950/40 dark:text-blue-400">CV</span> : null}
                                    {selectedCandidate.answerCount ? <span className="rounded-full bg-amber-100/80 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">{selectedCandidate.answerCount} odpovědí</span> : null}
                                  </div>
                                </div>

                                {recruiterDialogueLoading ? (
                                  <div className="flex h-36 items-center justify-center gap-3 text-sm text-slate-500">
                                    <Loader2 size={18} className="animate-spin text-cyan-500" />
                                    Načítám detail handshake…
                                  </div>
                                ) : (
                                  <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
                                    {/* Scorecards */}
                                    <div className="space-y-6">
                                      <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">Scorecards a splnění požadavků</h4>
                                      <div className="space-y-4">
                                        {selectedReadoutScorecards.length > 0 ? selectedReadoutScorecards.map((card: any) => (
                                          <div key={card.key || card.label} className="rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 p-5 shadow-sm">
                                            <div className="flex items-center justify-between gap-3 text-sm font-bold">
                                              <span className="text-slate-800 dark:text-slate-200">{card.label || card.key}</span>
                                              <span className="text-cyan-600 dark:text-cyan-400 font-black">{Math.round(Number(card.score || 0))}%</span>
                                            </div>
                                            <div className="mt-3.5 h-2 rounded-full bg-slate-100 dark:bg-slate-850 overflow-hidden">
                                              <div className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 rounded-full" style={{ width: `${Math.max(0, Math.min(100, Number(card.score || 0)))}%` }} />
                                            </div>
                                          </div>
                                        )) : (
                                          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-855 p-6 text-sm text-slate-400 italic">
                                            Skóre a požadavky se zobrazí po dokončení screeningových úloh.
                                          </div>
                                        )}
                                        {selectedRecruiterReadout?.jcfpm_summary?.completed && (
                                          <div className="rounded-2xl border border-emerald-100/60 bg-emerald-500/5 p-5 text-sm text-emerald-800 dark:text-emerald-400">
                                            <div className="font-bold flex items-center gap-1.5"><CheckCircle size={14} /> JCFPM profil dokončen</div>
                                            <div className="mt-2 text-slate-600 dark:text-slate-400 leading-6">
                                              {selectedRecruiterReadout.jcfpm_summary?.archetype?.title || 'Podrobný kognitivní model je připojen v Shamiho analýze.'}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Q&A responses */}
                                    <div className="space-y-6">
                                      <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--shell-text-muted)]">Odpovědi kandidáta v rozhovoru</h4>
                                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                                        {selectedReadoutEvidence.length > 0 ? selectedReadoutEvidence.map((section: any) => (
                                          <div key={section.id} className="rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 p-5 shadow-sm space-y-3">
                                            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{section.title}</div>
                                            {section.prompt && <div className="text-xs leading-6 text-slate-500 dark:text-slate-400 italic font-medium">{section.prompt}</div>}
                                            <div className="whitespace-pre-wrap text-xs leading-6 text-slate-600 dark:text-slate-300 font-medium bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-100/50 dark:border-slate-850/50">
                                              {section.body || 'Kandidát na tuto otázku neodpověděl textem.'}
                                            </div>
                                          </div>
                                        )) : (
                                          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-850 p-8 text-center text-sm text-slate-400 italic">
                                            Žádné přímé odpovědi k zobrazení.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. Konverzace Tab */}
                        {candidateDetailTab === 'chat' && (
                          <div className="rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 shadow-sm animate-fade-in space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-6 border-b border-slate-200 dark:border-slate-800 pb-6 mb-2">
                              <div>
                                <div className="text-[10px] font-black tracking-wider uppercase text-cyan-500">Live chat kanál</div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mt-1">Sdílená konverzace s talentem</h3>
                              </div>
                              {selectedRecruiterDialogueDetail?.status && (
                                <span className={cn('rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm', getApplicationStatusCopy(selectedRecruiterDialogueDetail.status).tone)}>
                                  {getApplicationStatusCopy(selectedRecruiterDialogueDetail.status).label}
                                </span>
                              )}
                            </div>

                            {recruiterDialogueLoading ? (
                              <div className="flex h-48 items-center justify-center gap-3 text-sm text-slate-500">
                                <Loader2 size={20} className="animate-spin text-cyan-500" />
                                Navazuji spojení s chatovacím kanálem…
                              </div>
                            ) : !selectedRecruiterDialogueId ? (
                              <div className="rounded-[24px] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 p-12 text-center space-y-6">
                                <p className="text-sm leading-7 text-slate-500 dark:text-slate-400 max-w-lg mx-auto font-medium">
                                  Tento kandidát je v otevřeném poolu a zatím nemá aktivovaný oboustranný Handshake rozhovor. Zašlete mu pozvání do výběrového řízení a otevřete komunikační kanál!
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRecruiterMessageDraft(`Dobrý den, zaujal nás Váš kognitivní profil a rádi bychom s Vámi zahájil Handshake rozhovor. Ozvěte se nám prosím!`);
                                    alert("Pozvánka s úvodní zprávou byla zkopírována do editoru níže. Kliknutím na odeslat zahájíte Handshake!");
                                  }}
                                  className="rounded-[18px] bg-[color:var(--shell-accent-cyan)] px-8 py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(36,150,171,0.3)] transition hover:scale-[1.02]"
                                >
                                  Připravit pozvánku k rozhovoru
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-6">
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                                  {selectedRecruiterDialogueMessages.length === 0 ? (
                                    <div className="text-center text-xs text-slate-400 py-10 italic">
                                      Žádné zprávy v tomto vlákně.
                                    </div>
                                  ) : (
                                    selectedRecruiterDialogueMessages.map((message) => {
                                      const isRecruiter = message.sender_role === 'recruiter';
                                      return (
                                        <div key={message.id} className={cn('flex flex-col', isRecruiter ? 'items-end' : 'items-start')}>
                                          <div className={cn(
                                            'max-w-[80%] rounded-[24px] px-5 py-4 text-xs leading-6 shadow-sm border',
                                            isRecruiter
                                              ? 'bg-gradient-to-br from-cyan-500/10 to-teal-500/5 text-slate-800 dark:text-slate-200 border-cyan-500/20'
                                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-100 dark:border-slate-800'
                                          )}>
                                            <div className="mb-2 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                              {isRecruiter ? 'Vy' : (selectedRecruiterDialogueDetail?.candidate_profile_snapshot?.name || 'Kandidát')} · {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div className="font-semibold">{message.body}</div>
                                            {message.attachments && message.attachments.length > 0 && (
                                              <div className="mt-3 flex flex-wrap gap-2">
                                                {message.attachments.map((at, idx) => (
                                                  <AttachmentChip key={idx} attachment={at} inverted={isRecruiter} />
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>

                                <div className="relative group">
                                  <textarea
                                    value={recruiterMessageDraft}
                                    onChange={(e) => setRecruiterMessageDraft(e.target.value)}
                                    rows={3}
                                    className="w-full pr-36 min-h-[100px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 text-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--shell-accent-cyan)] text-slate-800 dark:text-slate-200 shadow-inner"
                                    placeholder="Napište zprávu kandidátovi..."
                                  />
                                  <div className="absolute bottom-4 right-4 flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => recruiterAttachmentInputRef.current?.click()}
                                      className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-slate-100 dark:bg-slate-850 text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750 transition"
                                    >
                                      <Paperclip size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRecruiterSendMessage()}
                                      disabled={recruiterMessageBusy || !recruiterMessageDraft.trim()}
                                      className={cn(primaryButtonClass, 'h-10 px-5 rounded-[14px] shadow-md shadow-cyan-500/20 hover:scale-[1.02] transition')}
                                    >
                                      {recruiterMessageBusy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                      <span className="font-bold">Odeslat</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[32px] border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-24 flex flex-col justify-center items-center text-center shadow-sm">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-500 shadow-inner">
                        <Users size={32} />
                      </div>
                      <h3 className="mt-8 text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Vyberte talent z poolu</h3>
                      <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-sm font-medium leading-relaxed">
                        Zvolte kandidáta ze seznamu vlevo pro načtení kognitivní mapy, verdiktu cyber-sobíka Shamiho, scorecard a live chat rozhovoru.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'integrations' ? (
            <RecruiterIntegrationsPage t={t} />
          ) : null}

          {tab === 'assistant' ? (
            <RecruiterAssistantPage t={t} navigate={navigate} />
          ) : null}

          {tab === 'settings' && recruiterCompany ? (
            <RecruiterSettingsPage 
              company={recruiterCompany}
              userProfile={userProfile}
              t={t}
              onRefreshCompany={onRefreshCompany}
            />
          ) : tab === 'settings' ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : null}
      </DashboardLayoutV2>
    );
};
