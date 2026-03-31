import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  BookOpen,
  Briefcase,
  BrainCircuit,
  Plus,
  RefreshCw,
  Settings2,
  Sparkles,
  Users,
} from 'lucide-react';

import type { CompanyProfile, JobDraft } from '../../types';
import { getSubscriptionStatus } from '../../services/serverSideBillingService';
import AssessmentCreator from '../AssessmentCreator';
import AssessmentInvitationModal from '../AssessmentInvitationModal';
import AssessmentResultsList from '../AssessmentResultsList';
import ApplicationMessageCenter from '../ApplicationMessageCenter';
import CompanyMapScene, {
  type CompanyGalaxyMapBreadcrumb,
  type CompanyGalaxyMapLayer,
  type CompanyGalaxyMapNode,
} from './CompanyMapScene';
import CompanyBrandCorePanel from './map/CompanyBrandCorePanel';
import CompanyHumanDetailPanel from './map/CompanyHumanDetailPanel';
import CompanyOpenWaveLayer from './map/CompanyOpenWaveLayer';
import { companyMapIntlLocale, companyMapText, resolveCompanyMapLocale } from './companyMapLocale';
import {
  CompanyAssessmentOrbitPanel,
  CompanyCandidatesSignalPanel,
  CompanyLearningPanel,
  CompanyMapOverviewPanel,
  CompanyWaveClusterPanel,
} from './map/CompanyMapPanels';
import { useCompanyJobsData } from '../../hooks/useCompanyJobsData';
import { useCompanyActivityLog } from '../../hooks/useCompanyActivityLog';
import { useCompanyDialoguesData } from '../../hooks/useCompanyApplicationsData';
import { useCompanyAssessmentsData } from '../../hooks/useCompanyAssessmentsData';
import { useCompanyCandidatesData } from '../../hooks/useCompanyCandidatesData';
import { useCompanyDialogueAssessmentActions } from '../../hooks/useCompanyAssessmentActions';
import { useCompanyDialogueActions } from '../../hooks/useCompanyApplicationActions';
import { useCompanyJobActions } from '../../hooks/useCompanyJobActions';
import { useCompanyDashboardNavigation, type CompanyDashboardTab } from '../../hooks/useCompanyDashboardNavigation';
import { fetchCompanyDialogueMessages, sendCompanyDialogueMessage } from '../../services/jobApplicationService';

type CompanyMapLayer = 'dashboard' | 'challenges' | 'human_detail' | 'open_challenge';
type CompanyMapNodeId =
  | 'dashboard'
  | 'operations_pulse'
  | 'live_challenges'
  | 'dialogues'
  | 'candidates'
  | 'assessments'
  | 'settings_dna'
  | 'learning_resources'
  | 'open_challenge';

type CompanyMapNavigationState = {
  activeLayer: CompanyMapLayer;
  selectedNodeId: CompanyMapNodeId;
  selectedWaveId: string | null;
  panelDismissed: boolean;
  canvasZoom: number;
};

type AssessmentContext = {
  jobId?: string;
  jobTitle?: string;
  candidateEmail?: string;
  candidateId?: string;
  candidateName?: string;
  dialogueId?: string;
  applicationId?: string;
  assessmentId?: string;
  assessmentName?: string;
} | null;

interface Props {
  companyProfile?: CompanyProfile | null;
  userEmail?: string;
  onDeleteAccount?: () => Promise<boolean>;
  onProfileUpdate?: (profile: CompanyProfile) => void;
  onOpenCompanyPricing?: () => void;
}

const layerFromTab = (tab: CompanyDashboardTab): Pick<CompanyMapNavigationState, 'activeLayer' | 'selectedNodeId'> => {
  if (tab === 'jobs') return { activeLayer: 'challenges', selectedNodeId: 'live_challenges' };
  if (tab === 'applications') return { activeLayer: 'challenges', selectedNodeId: 'live_challenges' };
  if (tab === 'candidates') return { activeLayer: 'dashboard', selectedNodeId: 'candidates' };
  if (tab === 'assessments') return { activeLayer: 'dashboard', selectedNodeId: 'assessments' };
  if (tab === 'settings') return { activeLayer: 'dashboard', selectedNodeId: 'settings_dna' };
  if (tab === 'learning_resources') return { activeLayer: 'dashboard', selectedNodeId: 'learning_resources' };
  return { activeLayer: 'dashboard', selectedNodeId: 'dashboard' };
};

const tabFromNode = (nodeId: CompanyMapNodeId): CompanyDashboardTab => {
  if (nodeId === 'live_challenges' || nodeId === 'open_challenge') return 'jobs';
  if (nodeId === 'dialogues') return 'jobs';
  if (nodeId === 'candidates') return 'candidates';
  if (nodeId === 'assessments') return 'assessments';
  if (nodeId === 'settings_dna') return 'settings';
  if (nodeId === 'learning_resources') return 'learning_resources';
  return 'overview';
};

const formatDate = (value: string | null | undefined, language: string): string => {
  if (!value) return '';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '';
  const locale = resolveCompanyMapLocale(language);
  return dt.toLocaleString(companyMapIntlLocale(locale), {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const labelStatus = (status: string, language: string): string => {
  const locale = resolveCompanyMapLocale(language);
  const text = (variants: Parameters<typeof companyMapText>[1]) => companyMapText(locale, variants);
  const dictionary: Record<string, string> = {
    active: text({ cs: 'Aktivní', sk: 'Aktívne', en: 'Active', de: 'Aktiv', pl: 'Aktywne' }),
    paused: text({ cs: 'Pozastaveno', sk: 'Pozastavené', en: 'Paused', de: 'Pausiert', pl: 'Wstrzymane' }),
    closed: text({ cs: 'Uzavřeno', sk: 'Uzavreté', en: 'Closed', de: 'Geschlossen', pl: 'Zamknięte' }),
    archived: text({ cs: 'Archivováno', sk: 'Archivované', en: 'Archived', de: 'Archiviert', pl: 'Zarchiwizowane' }),
    pending: text({ cs: 'Čeká', sk: 'Čaká', en: 'Pending', de: 'Ausstehend', pl: 'Oczekuje' }),
    reviewed: text({ cs: 'Prohlédnuto', sk: 'Prezreté', en: 'Reviewed', de: 'Geprüft', pl: 'Przejrzane' }),
    shortlisted: text({ cs: 'Shortlist', sk: 'Shortlist', en: 'Shortlist', de: 'Shortlist', pl: 'Shortlista' }),
    rejected: text({ cs: 'Zamítnuto', sk: 'Zamietnuté', en: 'Rejected', de: 'Abgelehnt', pl: 'Odrzucone' }),
    hired: text({ cs: 'Přijato', sk: 'Prijaté', en: 'Hired', de: 'Eingestellt', pl: 'Zatrudniony' }),
    withdrawn: text({ cs: 'Staženo', sk: 'Stiahnuté', en: 'Withdrawn', de: 'Zurückgezogen', pl: 'Wycofane' }),
  };
  return dictionary[status] || status;
};

const benchmarkLabel = (metric: string, language: string): string => {
  const locale = resolveCompanyMapLocale(language);
  const text = (variants: Parameters<typeof companyMapText>[1]) => companyMapText(locale, variants);
  if (metric === 'assessment_avg') return text({ cs: 'Průměr assessmentů', sk: 'Priemer assessmentov', en: 'Assessment avg', de: 'Assessment-Durchschnitt', pl: 'Średnia assessmentów' });
  if (metric === 'shortlist_rate') return text({ cs: 'Shortlist rate', sk: 'Shortlist rate', en: 'Shortlist rate', de: 'Shortlist-Quote', pl: 'Wskaźnik shortlisty' });
  if (metric === 'hire_rate') return text({ cs: 'Hire rate', sk: 'Hire rate', en: 'Hire rate', de: 'Einstellungsquote', pl: 'Wskaźnik zatrudnienia' });
  return metric.replaceAll('_', ' ');
};

const CompanyMapWorkspace: React.FC<Props> = ({
  companyProfile: propProfile,
  userEmail,
  onDeleteAccount,
  onProfileUpdate,
  onOpenCompanyPricing,
}) => {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || 'cs';
  const locale = resolveCompanyMapLocale(language);
  const text = (variants: Parameters<typeof companyMapText>[1]) => companyMapText(locale, variants);
  const companyProfile = propProfile;
  const { activeTab, setActiveTab, editorSeedJobId, setEditorSeedJobId } = useCompanyDashboardNavigation();

  const [subscription, setSubscription] = useState<any>(null);
  const [navigation, setNavigation] = useState<CompanyMapNavigationState>(() => ({
    ...layerFromTab(activeTab),
    selectedWaveId: null,
    panelDismissed: false,
    canvasZoom: 1,
  }));
  const [assessmentContext, setAssessmentContext] = useState<AssessmentContext>(null);
  const [assessmentJobId, setAssessmentJobId] = useState<string | undefined>(undefined);
  const [showAssessmentCreator, setShowAssessmentCreator] = useState(false);
  const [createDraftSignal, setCreateDraftSignal] = useState(0);
  const [draftSeedPayload, setDraftSeedPayload] = useState<Partial<JobDraft> | null>(null);

  const { jobs, setJobs, jobStats, selectedJobId, setSelectedJobId, refreshJobs } = useCompanyJobsData(companyProfile?.id);
  const {
    companyActivityLog,
    assessmentInvitations,
    assessmentResultsAudit,
    refreshActivityLog,
    refreshOperationalEvents,
    appendActivityEvent,
  } = useCompanyActivityLog(companyProfile?.id);
  const {
    dialogues,
    dialoguesLoading,
    dialoguesUpdating,
    selectedDialogueId,
    selectedDialogueDetail,
    dialogueDetailLoading,
    refreshDialogues,
    openDialogueDetail,
    closeDialogueDetail,
    setDialogueUpdating,
    applyDialogueStatusLocally,
  } = useCompanyDialoguesData({ companyId: companyProfile?.id, activeTab, selectedJobId });
  const {
    assessmentLibrary,
    setAssessmentLibrary,
    assessmentLibraryLoading,
    assessmentLibraryBusyId,
    showInvitationModal,
    showInvitationsList,
    refreshAssessmentLibrary,
    duplicateAssessment,
    archiveAssessment,
    setShowInvitationModal,
    setShowInvitationsList,
  } = useCompanyAssessmentsData(companyProfile?.id, activeTab);
  const {
    candidates,
    candidateBenchmarks,
    isLoadingCandidateBenchmarks,
    refreshCandidates,
    refreshCandidateBenchmarks,
  } = useCompanyCandidatesData(companyProfile?.id, activeTab, selectedJobId, t);

  const assessmentActions = useCompanyDialogueAssessmentActions({
    jobs,
    selectedDialogueDetail,
    assessmentLibrary,
    duplicateAssessment,
    archiveAssessment,
    appendActivityEvent,
    setAssessmentJobId,
    setAssessmentContext,
    setActiveTab,
    setShowInvitationModal,
  });

  const { handleDialogueStatusChange } = useCompanyDialogueActions({
    dialogues,
    companyId: companyProfile?.id,
    activeTab,
    selectedJobId,
    refreshActivityLog,
    refreshDialogues,
    appendActivityEvent,
    setDialogueUpdating,
    applyDialogueStatusLocally,
  });

  const { handleEditorLifecycleChange, handleDeleteJob, handleCloseJob, handleReopenJob } = useCompanyJobActions({
    jobs,
    companyId: companyProfile?.id,
    t,
    setJobs,
    refreshJobs,
    refreshActivityLog,
    appendActivityEvent,
  });

  useEffect(() => {
    const loadSubscription = async () => {
      if (!companyProfile?.id) return;
      try {
        setSubscription(await getSubscriptionStatus(companyProfile.id));
      } catch (error) {
        console.error('Failed to load subscription', error);
      }
    };
    void loadSubscription();
  }, [companyProfile?.id]);

  useEffect(() => {
    setNavigation((current) => ({ ...current, ...layerFromTab(activeTab) }));
  }, [activeTab]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (activeTab === 'overview') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', activeTab === 'applications' ? 'jobs' : activeTab);
      }
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    } catch {
      // no-op
    }
  }, [activeTab]);

  useEffect(() => {
    if (!companyProfile?.id) return;
    if (navigation.activeLayer === 'challenges' || navigation.activeLayer === 'human_detail') {
      void refreshDialogues({
        jobId: selectedJobId || navigation.selectedWaveId || undefined,
        silent: true,
      });
    }
  }, [companyProfile?.id, navigation.activeLayer, navigation.selectedWaveId, refreshDialogues, selectedJobId]);

  useEffect(() => {
    if (!companyProfile?.id) return;
    if (navigation.selectedNodeId === 'assessments' || navigation.activeLayer === 'human_detail') {
      void refreshAssessmentLibrary();
    }
  }, [companyProfile?.id, navigation.activeLayer, navigation.selectedNodeId, refreshAssessmentLibrary]);

  useEffect(() => {
    if (!companyProfile?.id) return;
    if (navigation.selectedNodeId === 'candidates') {
      void refreshCandidates();
      void refreshCandidateBenchmarks();
    }
  }, [companyProfile?.id, navigation.selectedNodeId, refreshCandidateBenchmarks, refreshCandidates]);

  const effectiveCompanyProfile = !companyProfile
    ? null
    : !subscription
      ? companyProfile
      : {
          ...companyProfile,
          subscription: {
            ...companyProfile.subscription,
            tier: subscription.tier || companyProfile.subscription?.tier || 'free',
            expiresAt: subscription.expiresAt || companyProfile.subscription?.expiresAt,
            usage: {
              ...companyProfile.subscription?.usage,
              aiAssessmentsUsed: subscription.assessmentsUsed || 0,
              activeJobsCount:
                subscription.roleOpensUsed
                ?? subscription.jobPostingsUsed
                ?? companyProfile.subscription?.usage?.activeJobsCount
                ?? 0,
              activeDialogueSlotsUsed:
                subscription.dialogueSlotsUsed
                ?? companyProfile.subscription?.usage?.activeDialogueSlotsUsed
                ?? 0,
              roleOpensUsed:
                subscription.roleOpensUsed
                ?? subscription.jobPostingsUsed
                ?? companyProfile.subscription?.usage?.roleOpensUsed
                ?? 0,
            },
          } as any,
        };

  const visibleJobs = jobs.filter((job) => String((job as any).status || 'active') !== 'archived');
  const selectedJob =
    jobs.find((job) => String(job.id) === String(selectedJobId || navigation.selectedWaveId))
    || visibleJobs[0]
    || jobs[0]
    || null;
  const visibleDialogues = dialogues.filter((dialogue) => !selectedJob?.id || String(dialogue.job_id) === String(selectedJob.id));
  const metrics = {
    dialogues: visibleDialogues.length,
    activeDialogues: dialogues.filter((item) => ['pending', 'reviewed', 'shortlisted'].includes(String(item.status))).length,
    roles: visibleJobs.length,
    candidates: candidates.length,
    assessments: assessmentLibrary.length,
  };
  const benchmarkCards = candidateBenchmarks
    ? [candidateBenchmarks.assessment, candidateBenchmarks.shortlist_rate, candidateBenchmarks.hire_rate]
    : [];
  const humanDetailTitle = selectedDialogueDetail?.candidate_name || text({
    cs: 'Lidský detail',
    sk: 'Ľudský detail',
    en: 'Human Detail',
    de: 'Human Detail',
    pl: 'Human Detail',
  });
  const challengeStatusLabel = selectedJob ? labelStatus(String((selectedJob as any).status || 'active'), language) : '';

  if (!effectiveCompanyProfile) {
    return (
      <div className="mx-auto w-full max-w-[1680px] px-4 py-8 text-sm text-slate-600">
        {text({
          cs: 'Načítám firemní mapu...',
          sk: 'Načítavam firemnú mapu...',
          en: 'Loading company map...',
          de: 'Unternehmenskarte wird geladen...',
          pl: 'Ładuję mapę firmy...',
        })}
      </div>
    );
  }

  const navigate = (
    activeLayer: CompanyMapLayer,
    selectedNodeId: CompanyMapNodeId,
    options?: { waveId?: string | null; keepPanel?: boolean },
  ) => {
    if (activeLayer !== 'human_detail' && selectedDialogueId) {
      closeDialogueDetail();
    }
    setNavigation((current) => ({
      ...current,
      activeLayer,
      selectedNodeId,
      selectedWaveId: options?.waveId ?? current.selectedWaveId,
      panelDismissed: options?.keepPanel ? current.panelDismissed : false,
    }));
    setActiveTab(tabFromNode(selectedNodeId));
  };

  const openWave = (waveId: string) => {
    setSelectedJobId(waveId);
    navigate('challenges', 'live_challenges', { waveId });
  };

  const openDialogue = async (dialogueId: string, waveId?: string | null) => {
    if (waveId) setSelectedJobId(String(waveId));
    navigate('human_detail', 'dialogues', { waveId: waveId ? String(waveId) : navigation.selectedWaveId });
    await openDialogueDetail(dialogueId);
  };

  const openEditor = (seed?: Partial<JobDraft> | null, waveId?: string | null) => {
    if (waveId) {
      setSelectedJobId(String(waveId));
      setEditorSeedJobId(String(waveId));
    } else {
      setEditorSeedJobId(null);
    }
    setDraftSeedPayload(seed || null);
    setCreateDraftSignal((current) => current + 1);
    navigate('open_challenge', 'open_challenge', { waveId: waveId || navigation.selectedWaveId });
  };

  const openMiniChallengeEditor = () => {
    openEditor({
      title: text({
        cs: 'Mini výzva',
        sk: 'Mini výzva',
        en: 'Mini challenge',
        de: 'Mini-Challenge',
        pl: 'Mini wyzwanie',
      }),
      role_summary: text({
        cs: 'Krátká mini výzva pro rychlé ověření spolupráce.',
        sk: 'Krátka mini výzva na rýchle overenie spolupráce.',
        en: 'A short mini challenge to quickly validate collaboration.',
        de: 'Eine kurze Mini-Challenge, um Zusammenarbeit schnell ověřit.',
        pl: 'Krótke mini wyzwanie do szybkiego sprawdzenia współpracy.',
      }),
      application_instructions: text({
        cs: 'Popiš, jak bys k mini výzvě přistoupil/a, a přidej první konkrétní krok.',
        sk: 'Popíš, ako by si k mini výzve pristúpil/a, a pridaj prvý konkrétny krok.',
        en: 'Describe how you would approach the mini challenge and include the first concrete step.',
        de: 'Beschreiben Sie, wie Sie die Mini-Challenge angehen würden, und nennen Sie den ersten konkreten Schritt.',
        pl: 'Opisz, jak podszedłbyś/podeszłabyś do mini wyzwania, i dodaj pierwszy konkretny krok.',
      }),
      salary_timeframe: 'project_total',
      contract_type: '',
      editor_state: {
        selected_section: 'role_summary',
        micro_job: {
          challenge_format: 'micro_job',
          kind: 'one_off_task',
          time_estimate: '',
          collaboration_modes: [],
          long_term_potential: null,
        },
      },
    });
  };

  const dashboardNodes: CompanyGalaxyMapNode[] = [
    { id: 'operations_pulse', label: text({ cs: 'Operační puls', sk: 'Operačný pulz', en: 'Operations Pulse', de: 'Operations Pulse', pl: 'Puls operacyjny' }), secondaryLabel: text({ cs: 'Dashboard', sk: 'Dashboard', en: 'Dashboard', de: 'Dashboard', pl: 'Dashboard' }), narrative: text({ cs: 'Aktivita, fronta a poslední pohyb v hiringu.', sk: 'Aktivita, front a posledný pohyb v hiringu.', en: 'Activity, queue, and the latest hiring motion.', de: 'Aktivität, Queue und die letzte Bewegung im Hiring.', pl: 'Aktywność, kolejka i ostatni ruch w hiringu.' }), count: companyActivityLog.length, x: 18, y: 26, accent: 'muted', tone: 'blue', active: navigation.selectedNodeId === 'operations_pulse', icon: <BarChart3 size={28} />, onClick: () => navigate('dashboard', 'operations_pulse') },
    { id: 'live_challenges', label: text({ cs: 'Výzvy a dialogy', sk: 'Výzvy a dialógy', en: 'Challenges & Dialogues', de: 'Challenges & Dialoge', pl: 'Wyzwania i dialogi' }), secondaryLabel: text({ cs: 'Hlavní modul', sk: 'Hlavný modul', en: 'Primary module', de: 'Hauptmodul', pl: 'Główny moduł' }), narrative: text({ cs: 'Jedno místo pro výzvy, uchazeče v pipeline a další hiring kroky.', sk: 'Jedno miesto pre výzvy, uchádzačov v pipeline a ďalšie hiring kroky.', en: 'One place for challenges, pipeline dialogues, and next hiring steps.', de: 'Ein Ort für Challenges, Kandidaten in der Pipeline und nächste Hiring-Schritte.', pl: 'Jedno miejsce na wyzwania, kandydatów w pipeline i kolejne kroki hiringowe.' }), count: metrics.roles + metrics.activeDialogues, x: 82, y: 24, accent: 'accent', tone: 'emerald', active: navigation.activeLayer === 'challenges', icon: <Briefcase size={28} />, onClick: () => navigate('challenges', 'live_challenges', { waveId: selectedJob?.id || null }) },
    { id: 'candidates', label: text({ cs: 'Kandidáti', sk: 'Kandidáti', en: 'Candidates', de: 'Kandidaten', pl: 'Kandydaci' }), secondaryLabel: text({ cs: 'Signál', sk: 'Signál', en: 'Signal', de: 'Signal', pl: 'Sygnał' }), narrative: text({ cs: 'Talent pool, benchmarky a kandidátní signál kolem firmy.', sk: 'Talent pool, benchmarky a kandidátny signál okolo firmy.', en: 'Talent pool, benchmarks, and candidate signal around the company.', de: 'Talentpool, Benchmarks und Kandidatensignal rund um das Unternehmen.', pl: 'Pula talentów, benchmarki i sygnał kandydatów wokół firmy.' }), count: metrics.candidates, x: 18, y: 70, accent: 'muted', tone: 'orange', icon: <Users size={28} />, active: navigation.selectedNodeId === 'candidates', onClick: () => navigate('dashboard', 'candidates') },
    { id: 'assessments', label: text({ cs: 'Assessmenty', sk: 'Assessmenty', en: 'Assessments', de: 'Assessments', pl: 'Assessmenty' }), secondaryLabel: text({ cs: 'Nástroje', sk: 'Nástroje', en: 'Tools', de: 'Tools', pl: 'Narzędzia' }), narrative: text({ cs: 'Knihovna screeningu, pozvánky a audit hodnocení.', sk: 'Knižnica screeningu, pozvánky a audit hodnotenia.', en: 'Screening library, invitations, and assessment audit.', de: 'Screening-Bibliothek, Einladungen und Assessment-Audit.', pl: 'Biblioteka screeningu, zaproszenia i audyt assessmentów.' }), count: metrics.assessments, x: 50, y: 88, accent: 'muted', tone: 'blue', icon: <BrainCircuit size={28} />, active: navigation.selectedNodeId === 'assessments', onClick: () => navigate('dashboard', 'assessments') },
    { id: 'settings_dna', label: text({ cs: 'DNA a nastavení', sk: 'DNA a nastavenia', en: 'DNA & Settings', de: 'DNA & Einstellungen', pl: 'DNA i ustawienia' }), secondaryLabel: text({ cs: 'Jádro', sk: 'Jadro', en: 'Core', de: 'Kern', pl: 'Rdzeń' }), narrative: text({ cs: 'Brand, tým a identita středu firemní mapy.', sk: 'Brand, tím a identita stredu firemnej mapy.', en: 'Brand, team, and the identity of the company core.', de: 'Brand, Team und die Identität des Unternehmenskerns.', pl: 'Marka, zespół i tożsamość centrum mapy firmy.' }), count: effectiveCompanyProfile.values?.length || 0, x: 82, y: 70, accent: 'muted', tone: 'slate', icon: <Settings2 size={28} />, active: navigation.selectedNodeId === 'settings_dna', onClick: () => navigate('dashboard', 'settings_dna') },
  ];

  const challengesNodes: CompanyGalaxyMapNode[] = [
    { id: 'live_challenges', label: selectedJob?.title || text({ cs: 'Hiring modul', sk: 'Hiring modul', en: 'Hiring Module', de: 'Hiring-Modul', pl: 'Moduł hiringowy' }), secondaryLabel: text({ cs: 'Výzvy a dialogy', sk: 'Výzvy a dialógy', en: 'Challenges & Dialogues', de: 'Challenges & Dialoge', pl: 'Wyzwania i dialogi' }), narrative: text({ cs: 'Plná správa výzev i navázaných dialogů v jednom modulu.', sk: 'Plná správa výziev aj nadväzných dialógov v jednom module.', en: 'Full management of challenges and related dialogues in one module.', de: 'Vollständige Verwaltung von Challenges und verbundenen Dialogen in einem Modul.', pl: 'Pełne zarządzanie wyzwaniami i powiązanymi dialogami w jednym module.' }), count: metrics.roles + visibleDialogues.length, x: 50, y: 14, accent: 'core', tone: 'emerald', icon: <Briefcase size={28} />, active: true, onClick: () => navigate('challenges', 'live_challenges', { waveId: selectedJob?.id || null }) },
    { id: 'candidates', label: text({ cs: 'Kandidáti', sk: 'Kandidáti', en: 'Candidates', de: 'Kandidaten', pl: 'Kandydaci' }), secondaryLabel: text({ cs: 'Signál', sk: 'Signál', en: 'Signal', de: 'Signal', pl: 'Sygnał' }), narrative: text({ cs: 'Talent signál a benchmarky kolem zvolené výzvy.', sk: 'Talent signál a benchmarky okolo zvolenej výzvy.', en: 'Talent signal and benchmarks around the selected challenge.', de: 'Talentsignal und Benchmarks rund um die ausgewählte Challenge.', pl: 'Sygnał talentów i benchmarki wokół wybranego wyzwania.' }), count: candidates.length, x: 18, y: 34, accent: 'muted', tone: 'orange', icon: <Users size={28} />, active: navigation.selectedNodeId === 'candidates', onClick: () => navigate('dashboard', 'candidates') },
    { id: 'assessments', label: text({ cs: 'Assessmenty', sk: 'Assessmenty', en: 'Assessments', de: 'Assessments', pl: 'Assessmenty' }), secondaryLabel: text({ cs: 'Orbit', sk: 'Orbit', en: 'Orbit', de: 'Orbit', pl: 'Orbita' }), narrative: text({ cs: 'Screening navázaný na konkrétní výzvu.', sk: 'Screening naviazaný na konkrétnu výzvu.', en: 'Screening attached to the selected challenge.', de: 'Screening, das an die ausgewählte Challenge gebunden ist.', pl: 'Screening powiązany z wybranym wyzwaniem.' }), count: assessmentLibrary.length, x: 82, y: 34, accent: 'muted', tone: 'blue', icon: <BrainCircuit size={28} />, active: navigation.selectedNodeId === 'assessments', onClick: () => navigate('dashboard', 'assessments') },
    { id: 'open_challenge', label: text({ cs: 'Zadat výzvu', sk: 'Zadať výzvu', en: 'Open Challenge', de: 'Challenge öffnen', pl: 'Otwórz wyzwanie' }), secondaryLabel: text({ cs: 'Editor', sk: 'Editor', en: 'Editor', de: 'Editor', pl: 'Edytor' }), narrative: text({ cs: 'Vytvořit novou výzvu nebo upravit aktuální zadání.', sk: 'Vytvoriť novú výzvu alebo upraviť aktuálne zadanie.', en: 'Create a new challenge or edit the current brief.', de: 'Neue Challenge erstellen oder aktuelles Briefing bearbeiten.', pl: 'Utwórz nowe wyzwanie albo edytuj aktualny brief.' }), count: metrics.roles, x: 24, y: 78, accent: 'accent', tone: 'orange', icon: <Plus size={28} />, active: navigation.activeLayer === 'open_challenge', onClick: () => openEditor(undefined, selectedJob?.id || null) },
    { id: 'settings_dna', label: 'DNA', secondaryLabel: text({ cs: 'Kontext', sk: 'Kontext', en: 'Context', de: 'Kontext', pl: 'Kontekst' }), narrative: text({ cs: 'Firemní kontext a hiring signál pro výzvy v tomhle modulu.', sk: 'Firemný kontext a hiring signál pre výzvy v tomto module.', en: 'Company context and hiring signal for the challenges in this module.', de: 'Unternehmenskontext und Hiring-Signal für die Challenges in diesem Modul.', pl: 'Kontekst firmy i sygnał hiringowy dla wyzwań w tym module.' }), count: effectiveCompanyProfile.values?.length || 0, x: 78, y: 78, accent: 'muted', tone: 'slate', icon: <Settings2 size={28} />, onClick: () => navigate('dashboard', 'settings_dna') },
  ];

  const humanDetailNodes: CompanyGalaxyMapNode[] = [
    { id: 'dialogues', label: text({ cs: 'Lidský detail', sk: 'Ľudský detail', en: 'Human Detail', de: 'Human Detail', pl: 'Human Detail' }), secondaryLabel: text({ cs: 'Dossier', sk: 'Dossier', en: 'Dossier', de: 'Dossier', pl: 'Dossier' }), narrative: text({ cs: 'Jeden člověk, jedna role, jedno rozhodování.', sk: 'Jeden človek, jedna rola, jedno rozhodovanie.', en: 'One human, one role, one decision space.', de: 'Ein Mensch, eine Rolle, ein Entscheidungsraum.', pl: 'Jedna osoba, jedna rola, jedna przestrzeń decyzji.' }), count: selectedDialogueDetail ? 1 : visibleDialogues.length, x: 50, y: 14, accent: 'core', tone: 'emerald', imageUrl: selectedDialogueDetail?.candidate_profile_snapshot?.avatar_url || null, icon: <Users size={28} />, active: true, onClick: () => navigate('human_detail', 'dialogues', { waveId: selectedJob?.id || null }) },
    { id: 'live_challenges', label: text({ cs: 'Zpět na výzvy', sk: 'Späť na výzvy', en: 'Back to challenges', de: 'Zurück zu den Challenges', pl: 'Powrót do wyzwań' }), secondaryLabel: text({ cs: 'Flow', sk: 'Flow', en: 'Flow', de: 'Flow', pl: 'Flow' }), narrative: text({ cs: 'Vrátit se na hlavní přehled challenge workflow.', sk: 'Vrátiť sa na hlavný prehľad challenge workflow.', en: 'Return to the main challenge workflow overview.', de: 'Zurück zur Hauptübersicht des Challenge-Workflows.', pl: 'Wróć do głównego przeglądu workflow wyzwań.' }), count: metrics.roles, x: 20, y: 30, accent: 'muted', tone: 'emerald', icon: <Briefcase size={28} />, onClick: () => navigate('challenges', 'live_challenges', { waveId: selectedJob?.id || null }) },
    { id: 'assessments', label: text({ cs: 'Assessmenty', sk: 'Assessmenty', en: 'Assessments', de: 'Assessments', pl: 'Assessmenty' }), secondaryLabel: text({ cs: 'Další krok', sk: 'Ďalší krok', en: 'Next step', de: 'Nächster Schritt', pl: 'Następny krok' }), narrative: text({ cs: 'Spustit screening nebo poslat existující pozvánku.', sk: 'Spustiť screening alebo poslať existujúcu pozvánku.', en: 'Launch screening or send an existing assessment.', de: 'Screening starten oder bestehende Einladung senden.', pl: 'Uruchom screening albo wyślij istniejące zaproszenie.' }), count: assessmentLibrary.length, x: 80, y: 30, accent: 'accent', tone: 'blue', icon: <BrainCircuit size={28} />, onClick: () => navigate('dashboard', 'assessments') },
    { id: 'candidates', label: text({ cs: 'Kandidátní signál', sk: 'Kandidátny signál', en: 'Candidate signal', de: 'Kandidatensignal', pl: 'Sygnał kandydatów' }), secondaryLabel: text({ cs: 'Signál', sk: 'Signál', en: 'Signal', de: 'Signal', pl: 'Sygnał' }), narrative: text({ cs: 'Srovnání skillů, fitu a benchmarků.', sk: 'Porovnanie skillov, fitu a benchmarkov.', en: 'Compare skills, fit, and benchmark signal.', de: 'Vergleich von Skills, Fit und Benchmark-Signal.', pl: 'Porównanie skilli, fitu i benchmarków.' }), count: candidates.length, x: 20, y: 76, accent: 'muted', tone: 'orange', icon: <Users size={28} />, onClick: () => navigate('dashboard', 'candidates') },
    { id: 'dashboard', label: text({ cs: 'Zpět na dashboard', sk: 'Späť na dashboard', en: 'Back to dashboard', de: 'Zurück zum Dashboard', pl: 'Powrót do dashboardu' }), secondaryLabel: text({ cs: 'Jádro', sk: 'Jadro', en: 'Core', de: 'Kern', pl: 'Rdzeń' }), narrative: text({ cs: 'Vrátit se do hlavní firemní mapy.', sk: 'Vrátiť sa do hlavnej firemnej mapy.', en: 'Return to the main company map.', de: 'Zurück zur Hauptkarte des Unternehmens.', pl: 'Powrót do głównej mapy firmy.' }), count: metrics.roles, x: 80, y: 76, accent: 'muted', tone: 'blue', icon: <Sparkles size={28} />, onClick: () => navigate('dashboard', 'dashboard') },
  ];

  const openChallengeNodes: CompanyGalaxyMapNode[] = [
    { id: 'open_challenge', label: text({ cs: 'Zadat výzvu', sk: 'Zadať výzvu', en: 'Open Challenge', de: 'Challenge öffnen', pl: 'Otwórz wyzwanie' }), secondaryLabel: text({ cs: 'Editor', sk: 'Editor', en: 'Editor', de: 'Editor', pl: 'Edytor' }), narrative: text({ cs: 'Editor nové nebo existující hiring výzvy.', sk: 'Editor novej alebo existujúcej hiring výzvy.', en: 'Editor for a new or existing hiring challenge.', de: 'Editor für eine neue oder bestehende Hiring-Challenge.', pl: 'Edytor nowego albo istniejącego wyzwania hiringowego.' }), count: metrics.roles, x: 50, y: 14, accent: 'core', tone: 'orange', icon: <Plus size={28} />, active: true, onClick: () => navigate('open_challenge', 'open_challenge', { waveId: selectedJob?.id || null }) },
    { id: 'live_challenges', label: text({ cs: 'Přehled výzev', sk: 'Prehľad výziev', en: 'Challenge overview', de: 'Challenge-Übersicht', pl: 'Przegląd wyzwań' }), secondaryLabel: text({ cs: 'Flow', sk: 'Flow', en: 'Flow', de: 'Flow', pl: 'Flow' }), narrative: text({ cs: 'Vrátit se na plný přehled a správu otevřených výzev.', sk: 'Vrátiť sa na plný prehľad a správu otvorených výziev.', en: 'Return to the full overview and management of open challenges.', de: 'Zurück zur vollständigen Übersicht und Verwaltung offener Challenges.', pl: 'Wróć do pełnego przeglądu i zarządzania otwartymi wyzwaniami.' }), count: metrics.roles, x: 18, y: 34, accent: 'muted', tone: 'emerald', icon: <Briefcase size={28} />, onClick: () => navigate('challenges', 'live_challenges', { waveId: selectedJob?.id || null }) },
    { id: 'assessments', label: text({ cs: 'Assessmenty', sk: 'Assessmenty', en: 'Assessments', de: 'Assessments', pl: 'Assessmenty' }), secondaryLabel: text({ cs: 'Orbit', sk: 'Orbit', en: 'Orbit', de: 'Orbit', pl: 'Orbita' }), narrative: text({ cs: 'Napoj screening na novou nebo upravenou výzvu.', sk: 'Napoj screening na novú alebo upravenú výzvu.', en: 'Attach screening to the new or edited challenge.', de: 'Screening an neue oder bearbeitete Challenge anbinden.', pl: 'Podepnij screening pod nowe albo edytowane wyzwanie.' }), count: assessmentLibrary.length, x: 82, y: 34, accent: 'accent', tone: 'blue', icon: <BrainCircuit size={28} />, onClick: () => navigate('dashboard', 'assessments') },
    { id: 'settings_dna', label: 'DNA', secondaryLabel: text({ cs: 'Jádro', sk: 'Jadro', en: 'Core', de: 'Kern', pl: 'Rdzeń' }), narrative: text({ cs: 'Brand a firemní kontext pro tone nové role.', sk: 'Brand a firemný kontext pre tone novej role.', en: 'Brand and company context for the tone of the new role.', de: 'Brand und Unternehmenskontext für den Ton der neuen Rolle.', pl: 'Marka i kontekst firmy dla tonu nowej roli.' }), count: effectiveCompanyProfile.values?.length || 0, x: 24, y: 78, accent: 'muted', tone: 'slate', icon: <Settings2 size={28} />, onClick: () => navigate('dashboard', 'settings_dna') },
    { id: 'learning_resources', label: text({ cs: 'Learning', sk: 'Learning', en: 'Learning', de: 'Learning', pl: 'Learning' }), secondaryLabel: text({ cs: 'Průvodce', sk: 'Sprievodca', en: 'Guide', de: 'Guide', pl: 'Przewodnik' }), narrative: text({ cs: 'Praktické hinty pro silnější zadání role.', sk: 'Praktické hinty pre silnejšie zadanie role.', en: 'Practical hints for a stronger role brief.', de: 'Praktische Hinweise für ein stärkeres Rollen-Briefing.', pl: 'Praktyczne wskazówki do mocniejszego briefu roli.' }), count: 3, x: 78, y: 78, accent: 'muted', tone: 'orange', icon: <BookOpen size={28} />, onClick: () => navigate('dashboard', 'learning_resources') },
  ];

  const nodes =
    navigation.activeLayer === 'challenges'
      ? challengesNodes
      : navigation.activeLayer === 'human_detail'
        ? humanDetailNodes
        : navigation.activeLayer === 'open_challenge'
          ? openChallengeNodes
          : dashboardNodes;

  const layers: CompanyGalaxyMapLayer[] = [
    { id: 'dashboard', label: text({ cs: 'Dashboard', sk: 'Dashboard', en: 'Dashboard', de: 'Dashboard', pl: 'Dashboard' }), icon: Sparkles, active: navigation.activeLayer === 'dashboard', onClick: () => navigate('dashboard', 'dashboard') },
    { id: 'challenges', label: text({ cs: 'Výzvy', sk: 'Výzvy', en: 'Challenges', de: 'Challenges', pl: 'Wyzwania' }), icon: Briefcase, active: navigation.activeLayer === 'challenges', onClick: () => navigate('challenges', 'live_challenges', { waveId: selectedJob?.id || null }) },
    { id: 'human_detail', label: text({ cs: 'Lidský detail', sk: 'Ľudský detail', en: 'Human Detail', de: 'Human Detail', pl: 'Human Detail' }), icon: Users, active: navigation.activeLayer === 'human_detail', onClick: () => navigate('human_detail', 'dialogues', { waveId: selectedJob?.id || null }) },
    { id: 'open_challenge', label: text({ cs: 'Zadat výzvu', sk: 'Zadať výzvu', en: 'Open Challenge', de: 'Challenge öffnen', pl: 'Otwórz wyzwanie' }), icon: Plus, active: navigation.activeLayer === 'open_challenge', onClick: () => openEditor(undefined, selectedJob?.id || null) },
  ];

  const selectedNodeLabel = nodes.find((node) => node.id === navigation.selectedNodeId)?.label || text({ cs: 'Dashboard', sk: 'Dashboard', en: 'Dashboard', de: 'Dashboard', pl: 'Dashboard' });
  const breadcrumbs: CompanyGalaxyMapBreadcrumb[] = navigation.activeLayer === 'dashboard'
    ? navigation.selectedNodeId === 'dashboard'
      ? []
      : [
          {
            id: 'dashboard',
            label: text({ cs: 'Dashboard', sk: 'Dashboard', en: 'Dashboard', de: 'Dashboard', pl: 'Dashboard' }),
            onClick: () => navigate('dashboard', 'dashboard'),
          },
          {
            id: navigation.selectedNodeId,
            label: selectedNodeLabel,
            onClick: () => navigate('dashboard', navigation.selectedNodeId, { waveId: selectedJob?.id || null }),
          },
        ]
    : navigation.activeLayer === 'challenges'
      ? [
          {
            id: 'dashboard',
            label: text({ cs: 'Dashboard', sk: 'Dashboard', en: 'Dashboard', de: 'Dashboard', pl: 'Dashboard' }),
            onClick: () => navigate('dashboard', 'dashboard'),
          },
          {
            id: 'challenges',
            label: selectedJob?.title || text({ cs: 'Výzvy', sk: 'Výzvy', en: 'Challenges', de: 'Challenges', pl: 'Wyzwania' }),
            onClick: () => navigate('challenges', 'live_challenges', { waveId: selectedJob?.id || null }),
          },
        ]
      : navigation.activeLayer === 'human_detail'
        ? [
            {
              id: 'dashboard',
              label: text({ cs: 'Dashboard', sk: 'Dashboard', en: 'Dashboard', de: 'Dashboard', pl: 'Dashboard' }),
              onClick: () => navigate('dashboard', 'dashboard'),
            },
            {
              id: 'challenges',
              label: selectedJob?.title || text({ cs: 'Výzvy', sk: 'Výzvy', en: 'Challenges', de: 'Challenges', pl: 'Wyzwania' }),
              onClick: () => navigate('challenges', 'live_challenges', { waveId: selectedJob?.id || null }),
            },
            {
              id: 'human_detail',
              label: humanDetailTitle,
              onClick: () => navigate('human_detail', 'dialogues', { waveId: selectedJob?.id || null }),
            },
          ]
        : [
            {
              id: 'dashboard',
              label: text({ cs: 'Dashboard', sk: 'Dashboard', en: 'Dashboard', de: 'Dashboard', pl: 'Dashboard' }),
              onClick: () => navigate('dashboard', 'dashboard'),
            },
            {
              id: 'challenges',
              label: selectedJob?.title || text({ cs: 'Výzvy', sk: 'Výzvy', en: 'Challenges', de: 'Challenges', pl: 'Wyzwania' }),
              onClick: () => navigate('challenges', 'live_challenges', { waveId: selectedJob?.id || null }),
            },
            {
              id: 'open_challenge',
              label: text({ cs: 'Zadat výzvu', sk: 'Zadať výzvu', en: 'Open Challenge', de: 'Challenge öffnen', pl: 'Otwórz wyzwanie' }),
              onClick: () => navigate('open_challenge', 'open_challenge', { waveId: selectedJob?.id || null }),
            },
          ];

  const detailPanel = !navigation.panelDismissed ? (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{layers.find((layer) => layer.active)?.label}</div>
          <div className="mt-2 text-lg font-semibold text-[var(--text-strong)]">
            {navigation.activeLayer === 'dashboard'
              ? effectiveCompanyProfile.name
              : navigation.activeLayer === 'challenges'
                ? (selectedJob?.title || text({ cs: 'Výzvy', sk: 'Výzvy', en: 'Challenges', de: 'Challenges', pl: 'Wyzwania' }))
                : navigation.activeLayer === 'human_detail'
                  ? humanDetailTitle
                  : text({ cs: 'Zadat výzvu', sk: 'Zadať výzvu', en: 'Open Challenge', de: 'Challenge öffnen', pl: 'Otwórz wyzwanie' })}
          </div>
        </div>
        <button type="button" onClick={() => setNavigation((current) => ({ ...current, panelDismissed: true }))} className="rounded-full border border-white/70 bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-600">
          {text({ cs: 'Skrýt', sk: 'Skryť', en: 'Hide', de: 'Ausblenden', pl: 'Ukryj' })}
        </button>
      </div>

      <div className="grid gap-2">
        <div className="rounded-[18px] border border-white/70 bg-white/82 px-4 py-3 text-sm text-slate-700">{effectiveCompanyProfile.philosophy || effectiveCompanyProfile.tone}</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[18px] border border-white/70 bg-white/82 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{text({ cs: 'Dialogy', sk: 'Dialógy', en: 'Dialogues', de: 'Dialoge', pl: 'Dialogi' })}</div>
            <div className="mt-1 text-xl font-semibold text-slate-950">{metrics.activeDialogues}</div>
          </div>
          <div className="rounded-[18px] border border-white/70 bg-white/82 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{text({ cs: 'Pozvánky', sk: 'Pozvánky', en: 'Invitations', de: 'Einladungen', pl: 'Zaproszenia' })}</div>
            <div className="mt-1 text-xl font-semibold text-slate-950">{assessmentInvitations.length}</div>
          </div>
        </div>
        <div className="rounded-[18px] border border-white/70 bg-white/82 px-4 py-3 text-xs leading-6 text-slate-600">
          {text({
            cs: `Assessment audit: ${assessmentResultsAudit.length} událostí.`,
            sk: `Assessment audit: ${assessmentResultsAudit.length} udalostí.`,
            en: `Assessment audit: ${assessmentResultsAudit.length} events.`,
            de: `Assessment-Audit: ${assessmentResultsAudit.length} Ereignisse.`,
            pl: `Audyt assessmentów: ${assessmentResultsAudit.length} zdarzeń.`,
          })}
        </div>
      </div>
    </div>
  ) : null;

  const lowerContent = navigation.activeLayer === 'dashboard' && navigation.selectedNodeId === 'dashboard'
    ? null
    : navigation.activeLayer === 'human_detail' ? (
    dialogueDetailLoading ? (
      <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-sm text-slate-500">
        {text({ cs: 'Načítám lidský detail...', sk: 'Načítavam ľudský detail...', en: 'Loading human detail...', de: 'Human Detail wird geladen...', pl: 'Ładuję human detail...' })}
      </div>
    ) : (
      <div className="space-y-5">
        <CompanyHumanDetailPanel
          dossier={selectedDialogueDetail}
          dialogueOptions={visibleDialogues.map((dialogue) => ({
            id: dialogue.id,
            candidateName: dialogue.candidate_name || text({ cs: 'Kandidát', sk: 'Kandidát', en: 'Candidate', de: 'Kandidat', pl: 'Kandydat' }),
            jobTitle: dialogue.job_title,
            status: dialogue.status,
            avatarUrl: dialogue.candidate_avatar_url || dialogue.candidateAvatarUrl || null,
          }))}
          locale={language}
          formatDate={(value) => formatDate(value, language)}
          labelStatus={(status) => labelStatus(status, language)}
          onOpenDialogue={(dialogueId) => void openDialogue(dialogueId, selectedJob?.id || null)}
          onCreateAssessment={() => {
            assessmentActions.handleCreateAssessmentFromDialogue();
            setShowAssessmentCreator(true);
            navigate('dashboard', 'assessments', { waveId: selectedJob?.id || null });
          }}
          onInviteAssessment={() => {
            assessmentActions.handleInviteCandidateFromDialogue();
            navigate('dashboard', 'assessments', { waveId: selectedJob?.id || null });
          }}
        />

        {selectedDialogueDetail?.id ? (
          <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
            <div className="mb-4 text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {text({ cs: 'Komunikace s kandidátem', sk: 'Komunikácia s kandidátom', en: 'Candidate conversation', de: 'Gespräch mit dem Kandidaten', pl: 'Komunikacja z kandydatem' })}
            </div>
            <ApplicationMessageCenter
              dialogueId={selectedDialogueDetail.id}
              storageOwnerId={effectiveCompanyProfile.id || selectedDialogueDetail.candidate_id || undefined}
              heading={text({ cs: 'Vlákno dialogu', sk: 'Vlákno dialógu', en: 'Dialogue thread', de: 'Dialog-Thread', pl: 'Wątek dialogu' })}
              subtitle={text({ cs: 'Tady navazuješ další lidský krok v dialogu.', sk: 'Tu nadväzuješ ďalší ľudský krok v dialógu.', en: 'This is where you continue the next human step in the dialogue.', de: 'Hier setzen Sie den nächsten menschlichen Schritt im Dialog fort.', pl: 'Tutaj wykonujesz kolejny ludzki krok w dialogu.' })}
              composerPlaceholder={text({ cs: 'Napiš další zprávu kandidátovi...', sk: 'Napíš ďalšiu správu kandidátovi...', en: 'Write the next message to the candidate...', de: 'Schreiben Sie die nächste Nachricht an den Kandidaten...', pl: 'Napisz kolejną wiadomość do kandydata...' })}
              sendButtonLabel={text({ cs: 'Odeslat zprávu', sk: 'Odoslať správu', en: 'Send message', de: 'Nachricht senden', pl: 'Wyślij wiadomość' })}
              viewerRole="recruiter"
              dialogueStatus={selectedDialogueDetail.status}
              dialogueDeadlineAt={selectedDialogueDetail.dialogue_deadline_at || null}
              dialogueTimeoutHours={selectedDialogueDetail.dialogue_timeout_hours ?? null}
              dialogueCurrentTurn={selectedDialogueDetail.dialogue_current_turn || null}
              dialogueClosedReason={selectedDialogueDetail.dialogue_closed_reason || null}
              dialogueIsOverdue={Boolean(selectedDialogueDetail.dialogue_is_overdue)}
              fetchMessages={fetchCompanyDialogueMessages}
              sendMessage={sendCompanyDialogueMessage}
            />
          </div>
        ) : null}
      </div>
    )
  ) : navigation.activeLayer === 'open_challenge' ? (
    <CompanyOpenWaveLayer
      companyProfile={effectiveCompanyProfile}
      jobs={visibleJobs}
      userEmail={userEmail}
      seedJobId={editorSeedJobId}
      createDraftSignal={createDraftSignal}
      draftSeedPayload={draftSeedPayload}
      onDraftSeedConsumed={() => setDraftSeedPayload(null)}
      onSeedConsumed={() => setEditorSeedJobId(null)}
      onJobLifecycleChange={handleEditorLifecycleChange}
      locale={language}
    />
  ) : navigation.selectedNodeId === 'settings_dna' ? (
    <CompanyBrandCorePanel
      profile={effectiveCompanyProfile}
      locale={language}
      onProfileUpdate={onProfileUpdate}
      onDeleteAccount={onDeleteAccount}
      onOpenCompanyPricing={onOpenCompanyPricing}
    />
  ) : navigation.selectedNodeId === 'learning_resources' ? (
    <CompanyLearningPanel locale={language} />
  ) : navigation.selectedNodeId === 'assessments' ? (
    <CompanyAssessmentOrbitPanel
      locale={language}
      companyId={effectiveCompanyProfile.id || ''}
      invitationsCount={assessmentInvitations.length}
      auditCount={assessmentResultsAudit.length}
      assessments={assessmentLibrary}
      loading={assessmentLibraryLoading}
      busyId={assessmentLibraryBusyId}
      showInvitationsList={showInvitationsList}
      showCreator={showAssessmentCreator}
      creator={showAssessmentCreator ? (
        <AssessmentCreator
          companyProfile={effectiveCompanyProfile}
          jobs={visibleJobs}
          initialJobId={assessmentJobId || selectedJob?.id || undefined}
          onAssessmentSaved={(assessment) => {
            setAssessmentLibrary((prev) => [assessment, ...prev.filter((item) => item.id !== assessment.id)]);
            void refreshAssessmentLibrary();
          }}
        />
      ) : null}
      resultsList={effectiveCompanyProfile.id ? (
        <AssessmentResultsList
          companyId={effectiveCompanyProfile.id}
          jobTitleFilter={selectedJob?.title}
          candidateEmailFilter={selectedDialogueDetail?.candidate_profile_snapshot?.email || selectedDialogueDetail?.candidate_email || undefined}
          dialogueIdFilter={selectedDialogueDetail?.id}
        />
      ) : null}
      onToggleCreator={() => setShowAssessmentCreator((current) => !current)}
      onSendInvitation={() => setShowInvitationModal(true)}
      onDuplicateAssessment={(assessmentId) => assessmentActions.handleDuplicateAssessment(assessmentId)}
      onArchiveAssessment={(assessmentId) => assessmentActions.handleArchiveAssessment(assessmentId)}
    />
  ) : navigation.selectedNodeId === 'candidates' ? (
    <CompanyCandidatesSignalPanel
      locale={language}
      benchmarkCards={benchmarkCards}
      benchmarkLabel={(metric) => benchmarkLabel(metric, language)}
      isLoading={isLoadingCandidateBenchmarks}
      candidates={candidates}
      dialogues={visibleDialogues}
      onOpenHumanDetail={openDialogue}
      onOpenChallenges={() => navigate('challenges', 'live_challenges', { waveId: selectedJob?.id || null })}
    />
  ) : navigation.selectedNodeId === 'live_challenges' || navigation.activeLayer === 'challenges' ? (
    <CompanyWaveClusterPanel
      locale={language}
      jobs={visibleJobs}
      selectedJobId={selectedJob?.id || null}
      jobStats={jobStats}
      assessmentCount={assessmentLibrary.length}
      dialoguesLoading={dialoguesLoading}
      dialogues={visibleDialogues}
      dialoguesUpdating={dialoguesUpdating}
      selectedDialogueId={selectedDialogueId}
      labelStatus={(status) => labelStatus(status, language)}
      onCreateNewChallenge={() => openEditor({
        company_goal: effectiveCompanyProfile.philosophy,
        location_public: effectiveCompanyProfile.address || effectiveCompanyProfile.legal_address || '',
        contact_email: userEmail || '',
      })}
      onOpenWave={openWave}
      onCreateMiniChallenge={openMiniChallengeEditor}
      onOpenEditor={(waveId) => openEditor(undefined, waveId)}
      onCloseWave={(waveId) => handleCloseJob(waveId)}
      onReopenWave={(waveId) => handleReopenJob(waveId)}
      onArchiveWave={(waveId) => handleDeleteJob(waveId)}
      onCreateAssessment={(waveId) => assessmentActions.handleCreateAssessmentFromJob(waveId)}
      onOpenDialogue={openDialogue}
      onDialogueStatusChange={handleDialogueStatusChange}
    />
  ) : (
    <CompanyMapOverviewPanel
      locale={language}
      metrics={{ roles: metrics.roles, activeDialogues: metrics.activeDialogues, candidates: metrics.candidates, assessments: metrics.assessments }}
      jobs={visibleJobs}
      dialogues={visibleDialogues}
      activityLog={companyActivityLog}
      formatDate={(value) => formatDate(value, language)}
      labelStatus={(status) => labelStatus(status, language)}
      onOpenWave={openWave}
      onOpenDialogue={openDialogue}
      onOpenCandidates={() => navigate('dashboard', 'candidates')}
      onOpenAssessments={() => navigate('dashboard', 'assessments')}
    />
  );

  return (
    <>
      <CompanyMapScene
        locale={language}
        kicker={text({ cs: 'Firemní galaxy mapa', sk: 'Firemná galaxy mapa', en: 'Company galaxy map', de: 'Unternehmens-Galaxiekarte', pl: 'Galaktyczna mapa firmy' })}
        title={text({ cs: 'Dashboard -> Výzvy -> Human Detail -> Zadat výzvu', sk: 'Dashboard -> Výzvy -> Human Detail -> Zadať výzvu', en: 'Dashboard -> Challenges -> Human Detail -> Open Challenge', de: 'Dashboard -> Challenges -> Human Detail -> Challenge öffnen', pl: 'Dashboard -> Wyzwania -> Human Detail -> Otwórz wyzwanie' })}
        subtitle={text({ cs: 'Mapa je hlavní navigace. Po kliknutí na cluster se otevře plná další vrstva s obsahem modulu.', sk: 'Mapa je hlavná navigácia. Po kliknutí na cluster sa otvorí plná ďalšia vrstva s obsahom modulu.', en: 'The map is the main navigation. Clicking a cluster opens the full next layer with module content.', de: 'Die Karte ist die Hauptnavigation. Ein Klick auf einen Cluster öffnet die vollständige nächste Ebene mit Modulinhalt.', pl: 'Mapa jest główną nawigacją. Kliknięcie klastra otwiera pełną kolejną warstwę z zawartością modułu.' })}
        center={{
          name: navigation.activeLayer === 'dashboard' ? effectiveCompanyProfile.name : navigation.activeLayer === 'challenges' ? (selectedJob?.title || text({ cs: 'Výzvy', sk: 'Výzvy', en: 'Challenges', de: 'Challenges', pl: 'Wyzwania' })) : navigation.activeLayer === 'human_detail' ? (selectedDialogueDetail?.candidate_name || text({ cs: 'Lidský detail', sk: 'Ľudský detail', en: 'Human Detail', de: 'Human Detail', pl: 'Human Detail' })) : text({ cs: 'Zadat výzvu', sk: 'Zadať výzvu', en: 'Open Challenge', de: 'Challenge öffnen', pl: 'Otwórz wyzwanie' }),
          motto: navigation.activeLayer === 'dashboard' ? (effectiveCompanyProfile.philosophy || effectiveCompanyProfile.tone) : navigation.activeLayer === 'challenges' ? ((selectedJob as any)?.challenge || selectedJob?.description || effectiveCompanyProfile.philosophy || '') : navigation.activeLayer === 'human_detail' ? (selectedDialogueDetail?.job_title || effectiveCompanyProfile.philosophy || '') : text({ cs: 'Nová výzva se seeduje z firemního středu a drží stejný tone jako zbytek galaxie.', sk: 'Nová výzva sa seeduje z firemného stredu a drží rovnaký tone ako zvyšok galaxie.', en: 'A new challenge is seeded from the company core and keeps the same tone as the rest of the galaxy.', de: 'Eine neue Challenge wird aus dem Unternehmenskern gespeist und hält denselben Ton wie der Rest der Galaxie.', pl: 'Nowe wyzwanie seeduje się z firmowego rdzenia i trzyma ten sam tone jako reszta galaktyki.' }),
          tone: effectiveCompanyProfile.tone,
          logoUrl: navigation.activeLayer === 'dashboard' ? effectiveCompanyProfile.logo_url : undefined,
          statusLine: navigation.activeLayer === 'human_detail' ? labelStatus(selectedDialogueDetail?.status || 'pending', language) : `${metrics.roles} ${text({ cs: 'aktivních výzev', sk: 'aktívnych výziev', en: 'active challenges', de: 'aktive Challenges', pl: 'aktywnych wyzwań' })} / ${metrics.activeDialogues} ${text({ cs: 'dialogů', sk: 'dialógov', en: 'dialogues', de: 'Dialoge', pl: 'dialogów' })}${challengeStatusLabel ? ` / ${challengeStatusLabel}` : ''}`,
          values: effectiveCompanyProfile.values || [],
        }}
        layers={layers}
        nodes={nodes}
        workspaceBreadcrumbs={breadcrumbs}
        detailPanel={detailPanel}
        lowerContent={lowerContent}
        zoom={navigation.canvasZoom}
        onZoomIn={() => setNavigation((current) => ({ ...current, canvasZoom: Math.min(1.24, current.canvasZoom + 0.08) }))}
        onZoomOut={() => setNavigation((current) => ({ ...current, canvasZoom: Math.max(0.8, current.canvasZoom - 0.08) }))}
        onZoomReset={() => setNavigation((current) => ({ ...current, canvasZoom: 1 }))}
        topActions={(
          <>
            <button type="button" onClick={openMiniChallengeEditor} className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900">
              <Plus size={14} className="mr-2 inline-flex" />
              {text({ cs: 'Otevřít mini výzvu', sk: 'Otvoriť mini výzvu', en: 'Open mini challenge', de: 'Mini-Challenge öffnen', pl: 'Otwórz mini wyzwanie' })}
            </button>
            <button type="button" onClick={() => void Promise.all([refreshJobs(), refreshDialogues({ jobId: selectedJobId || undefined, silent: true }), refreshCandidates(), refreshCandidateBenchmarks(), refreshAssessmentLibrary(), refreshActivityLog(companyProfile?.id), companyProfile?.id ? refreshOperationalEvents(companyProfile.id) : Promise.resolve()])} className="rounded-full border border-slate-200 bg-white/88 px-4 py-2 text-xs font-semibold text-slate-700">
              <RefreshCw size={14} className="mr-2 inline-flex" />
              {text({ cs: 'Obnovit', sk: 'Obnoviť', en: 'Refresh', de: 'Aktualisieren', pl: 'Odśwież' })}
            </button>
          </>
        )}
      />

      {showInvitationModal && effectiveCompanyProfile.id ? (
        <AssessmentInvitationModal
          companyId={effectiveCompanyProfile.id}
          onClose={() => setShowInvitationModal(false)}
          onSent={() => {
            setShowInvitationsList(true);
            appendActivityEvent('assessment_invited', {
              application_id: assessmentContext?.dialogueId || assessmentContext?.applicationId || null,
              job_id: assessmentContext?.jobId || null,
              job_title: assessmentContext?.jobTitle || null,
              candidate_name: assessmentContext?.candidateName || null,
              candidate_email: assessmentContext?.candidateEmail || null,
              assessment_id: assessmentContext?.assessmentId || null,
              assessment_title: assessmentContext?.assessmentName || null,
            }, 'assessment', assessmentContext?.assessmentId || undefined);
            if (effectiveCompanyProfile.id) void refreshOperationalEvents(effectiveCompanyProfile.id);
          }}
          initialAssessmentId={assessmentContext?.assessmentId}
          initialCandidateEmail={assessmentContext?.candidateEmail}
          initialCandidateId={assessmentContext?.candidateId || null}
          initialDialogueId={assessmentContext?.dialogueId || null}
          initialApplicationId={assessmentContext?.applicationId || null}
          initialJobId={assessmentContext?.jobId || null}
          initialJobTitle={assessmentContext?.jobTitle}
          initialAssessmentName={assessmentContext?.assessmentName}
        />
      ) : null}
    </>
  );
};

export default CompanyMapWorkspace;
