import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Briefcase, CreditCard, LogIn, Plus, Sparkles, Users } from 'lucide-react';

import type { Assessment, CompanyApplicationRow, DialogueDossier, Job } from '../types';
import AnalyticsService from '../services/analyticsService';
import CompanyMapScene, {
  type CompanyGalaxyMapBreadcrumb,
  type CompanyGalaxyMapLayer,
  type CompanyGalaxyMapNode,
} from './company/CompanyMapScene';
import CompanyHumanDetailPanel from './company/map/CompanyHumanDetailPanel';
import { CompanyWaveClusterPanel } from './company/map/CompanyMapPanels';
import {
  LandingDemoConversationPanel,
  LandingDemoOpenChallengePanel,
  LandingDemoPricingPanel,
  type LandingDemoBrief,
  type LandingDemoConversationMessage,
  type LandingDemoPricingPlan,
} from './company/landing/CompanyLandingDemoPanels';

interface CompanyLandingPageProps {
  onRegister?: () => void;
  onRequestDemo?: () => void;
  onLogin?: () => void;
}

type LandingMapLayer = 'challenge_map' | 'challenge_cluster' | 'human_detail' | 'open_challenge' | 'pricing';

type LandingNavigationState = {
  activeLayer: LandingMapLayer;
  selectedWaveId: string | null;
  selectedDialogueId: string | null;
  panelDismissed: boolean;
  canvasZoom: number;
};

type LandingMapNodeTemplate = Omit<CompanyGalaxyMapNode, 'x' | 'y' | 'active' | 'onClick'>;

type Copy = {
  title: string;
  subtitle: string;
  register: string;
  demo: string;
  login: string;
  whyShell: string;
  sameGalaxy: string;
  challengeMap: string;
  challengeCluster: string;
  humanDetail: string;
  openChallenge: string;
  pricing: string;
  defaultLayer: string;
  liveModule: string;
  dossier: string;
  readOnlyEditor: string;
  capacity: string;
  companyCore: string;
  planCapacity: string;
};

const baseJob = (id: string, company: string, title: string, location: string, challenge: string): Job => ({
  id,
  title,
  company,
  location,
  type: 'Hybrid',
  description: challenge,
  challenge,
  postedAt: '2026-03-20T08:00:00Z',
  source: 'demo',
  jhi: { score: 80, baseScore: 78, personalizedScore: 82, financial: 76, timeCost: 71, mentalLoad: 69, growth: 86, values: 84 },
  noiseMetrics: { score: 18, flags: [], level: 'low', keywords: ['clear-brief'], tone: 'Technical' },
  transparency: { turnoverRate: 12, avgTenure: 4.6, ghostingRate: 6, hiringSpeed: 'Fast (10 days)', redFlags: [] },
  market: { marketAvgSalary: 108000, percentile: 72, inDemandSkills: ['Python', 'Kubernetes', 'Operations design'], p25: 90000, p50: 108000, p75: 125000, confidenceTier: 'high' },
  tags: ['Demo'],
  benefits: ['Demo'],
  required_skills: ['Demo'],
  listingKind: 'challenge',
  status: 'active',
});

const CompanyLandingPage: React.FC<CompanyLandingPageProps> = ({ onRegister, onRequestDemo, onLogin }) => {
  const { i18n } = useTranslation();
  const language = String(i18n.resolvedLanguage || i18n.language || 'en').toLowerCase();
  const isCsLike = language.startsWith('cs') || language.startsWith('sk');
  const hasTrackedView = useRef(false);
  const [navigation, setNavigation] = useState<LandingNavigationState>({
    activeLayer: 'challenge_map',
    selectedWaveId: 'demo-platform-engineer',
    selectedDialogueId: 'dialogue-sara',
    panelDismissed: false,
    canvasZoom: 1,
  });

  const copy: Copy = useMemo(() => ({
    title: isCsLike ? 'Nábor, ve kterém firma konečně vidí, co se opravdu děje' : 'Hiring where your team finally sees what is really happening',
    subtitle: isCsLike
      ? 'JobShaman spojuje role, kandidáty, rozhodování i kapacitu do jedné přehledné mapy. Místo přepínání mezi nástroji získáte jasný hiring tah, méně ztracených kandidátů a rychlejší jistotu, koho posunout dál.'
      : 'JobShaman brings roles, candidates, decisions, and capacity into one clear map. Instead of jumping between tools, your team gets a confident hiring rhythm, fewer lost candidates, and faster clarity on who moves forward.',
    register: isCsLike ? 'Začít s JobShamanem' : 'Start with JobShaman',
    demo: isCsLike ? 'Chci ukázku pro náš tým' : 'Show it to my team',
    login: isCsLike ? 'Vstoupit do firemního účtu' : 'Enter company workspace',
    whyShell: isCsLike ? 'Proč firmy zbystří' : 'Why teams lean in',
    sameGalaxy: isCsLike ? 'Jedna mapa pro celý hiring. Méně chaosu, více jistoty a rychlejší rozhodnutí.' : 'One map for the whole hiring flow. Less chaos, more confidence, faster decisions.',
    challengeMap: 'Challenge Map',
    challengeCluster: 'Challenge Cluster',
    humanDetail: 'Human Detail',
    openChallenge: 'Open Challenge',
    pricing: 'Pricing',
    defaultLayer: isCsLike ? 'Vstupní vrstva' : 'Entry layer',
    liveModule: isCsLike ? 'Živý hiring tok' : 'Live hiring flow',
    dossier: 'Dossier',
    readOnlyEditor: isCsLike ? 'Ukázka zadání' : 'Challenge preview',
    capacity: isCsLike ? 'Kapacita týmu' : 'Team capacity',
    companyCore: isCsLike ? 'Srdce firmy' : 'Company core',
    planCapacity: isCsLike ? 'Růst a kapacita' : 'Growth and capacity',
  }), [isCsLike]);

  const company = useMemo(() => ({
    name: isCsLike ? 'Zde může být právě Vaše společnost!' : 'Your company could be here right now!',
    philosophy: isCsLike
      ? 'JobShaman pomáhá firmám získat kontrolu nad hiringem od prvního briefu po finální rozhodnutí. Všechno důležité vidíte v jednom toku, takže tým reaguje rychleji a kandidáti nezažívají ticho.'
      : 'JobShaman helps companies regain control of hiring from the first brief to the final decision. Everything important lives in one flow, so your team reacts faster and candidates never disappear into silence.',
    tone: isCsLike ? 'Jistota, tempo, důvěra' : 'Confidence, pace, trust',
    values: [
      isCsLike ? 'Jasně vidíte, kde hiring stojí' : 'See exactly where hiring slows down',
      isCsLike ? 'Kandidáti dostávají rychlejší odpověď' : 'Candidates get faster responses',
      isCsLike ? 'Tým rozhoduje nad stejným obrazem reality' : 'The whole team decides from the same source of truth',
    ],
  }), [isCsLike]);

  const trackEvent = (eventName: string, metadata?: Record<string, unknown>) => {
    AnalyticsService.trackEvent(eventName, {
      locale: i18n.language,
      ...metadata,
    });
  };

  useEffect(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackEvent('company_landing_view', { section: 'workspace_demo_map', shell_mode: 'workspace_demo' });
  }, []);

  const jobs = useMemo<Job[]>(() => ([
    baseJob(
      'demo-platform-engineer',
      company.name,
      isCsLike ? 'Lead pro stabilitu provozu a technické týmy' : 'Lead for operational stability and technical teams',
      isCsLike ? 'Brno / hybrid' : 'Brno / hybrid',
      isCsLike
        ? 'Firma hledá člověka, který uklidní kritická místa v provozu, nastaví odpovědnosti a vrátí týmům jistotu v tom, co řešit jako první.'
        : 'The company is looking for someone who can calm critical operational pressure points, clarify ownership, and give teams confidence about what to solve first.',
    ),
    baseJob(
      'demo-operations-lead',
      company.name,
      isCsLike ? 'Hiring Operations Lead pro růst bez chaosu' : 'Hiring Operations Lead for scalable growth',
      isCsLike ? 'Praha / onsite + 1 den remote' : 'Prague / onsite + 1 day remote',
      isCsLike
        ? 'Tým potřebuje lídra, který zkrátí čekání mezi kroky, dá recruiterům rytmus a pomůže škálovat hiring bez ztráty lidskosti.'
        : 'The team needs a leader who can cut waiting time between steps, give recruiters a rhythm, and scale hiring without losing the human touch.',
    ),
  ]), [company.name, isCsLike]);

  const dialogues = useMemo<CompanyApplicationRow[]>(() => ([
    {
      id: 'dialogue-sara',
      job_id: 'demo-platform-engineer',
      candidate_id: 'candidate-sara',
      status: 'shortlisted',
      submitted_at: '2026-03-24T09:20:00Z',
      updated_at: '2026-03-27T11:45:00Z',
      dialogue_deadline_at: '2026-04-02T16:00:00Z',
      dialogue_current_turn: 'company',
      dialogue_timeout_hours: 48,
      job_title: jobs[0]?.title,
      candidate_name: 'Sara Novak',
      candidate_email: 'sara.novak@example.com',
      candidate_avatar_url: 'https://i.pravatar.cc/160?img=32',
    },
    {
      id: 'dialogue-marek',
      job_id: 'demo-operations-lead',
      candidate_id: 'candidate-marek',
      status: 'reviewed',
      submitted_at: '2026-03-25T08:45:00Z',
      updated_at: '2026-03-28T12:05:00Z',
      dialogue_deadline_at: '2026-04-03T14:00:00Z',
      dialogue_current_turn: 'candidate',
      dialogue_timeout_hours: 72,
      job_title: jobs[1]?.title,
      candidate_name: 'Marek Svoboda',
      candidate_email: 'marek.svoboda@example.com',
      candidate_avatar_url: 'https://i.pravatar.cc/160?img=53',
    },
    {
      id: 'dialogue-elena',
      job_id: 'demo-platform-engineer',
      candidate_id: 'candidate-elena',
      status: 'pending',
      submitted_at: '2026-03-26T10:20:00Z',
      updated_at: '2026-03-29T08:30:00Z',
      dialogue_deadline_at: '2026-04-04T15:00:00Z',
      dialogue_current_turn: 'candidate',
      dialogue_timeout_hours: 48,
      job_title: jobs[0]?.title,
      candidate_name: 'Elena Richter',
      candidate_email: 'elena.richter@example.com',
      candidate_avatar_url: 'https://i.pravatar.cc/160?img=47',
    },
  ]), [jobs]);

  const assessments = useMemo<Assessment[]>(() => ([
    {
      id: 'assessment-platform',
      title: 'Platform signal sprint',
      role: jobs[0]?.title || 'Platform Engineer',
      description: isCsLike ? 'Krátký screening, který rychle ukáže klid v tlaku, způsob rozhodování a schopnost převzít odpovědnost.' : 'A short screening that quickly shows calm under pressure, decision quality, and ownership.',
      questions: [
        { id: 'q1', text: isCsLike ? 'Jak bys rozdělil/a ownership mezi platformu a product engineering?' : 'How would you split ownership between platform and product engineering?', type: 'Open', category: 'Situational' },
      ],
      createdAt: '2026-03-21T07:30:00Z',
    },
    {
      id: 'assessment-ops',
      title: 'Hiring cockpit calibration',
      role: jobs[1]?.title || 'Operations Lead',
      description: isCsLike ? 'Praktický screening na prioritizaci, tempo rozhodování a schopnost udržet hiring v pohybu.' : 'A practical screening for prioritization, decision rhythm, and keeping hiring moving.',
      questions: [
        { id: 'q1', text: isCsLike ? 'Co uděláš první týden, když hiring fronta stojí?' : 'What do you do in the first week when the hiring queue stalls?', type: 'Scenario', category: 'Practical' },
      ],
      createdAt: '2026-03-19T12:00:00Z',
    },
  ]), [isCsLike, jobs]);

  const pricingPlans = useMemo<LandingDemoPricingPlan[]>(() => ([
    {
      id: 'free',
      name: 'Free',
      price: isCsLike ? 'Zdarma' : 'Free',
      note: isCsLike ? 'Pro první ověření, že JobShaman dává vašemu týmu větší přehled a rychlejší reakční dobu.' : 'For validating that JobShaman gives your team more clarity and a faster response rhythm.',
      roleOpens: '1',
      dialogueSlots: '3',
      aiAssessments: '10 / month',
      recruiterSeats: '1',
      features: [isCsLike ? 'První živý náborový tok bez složitého zavádění' : 'Your first live hiring flow without heavy setup', isCsLike ? 'Rychlá viditelnost nad rolí, kandidátem i dalším krokem' : 'Fast visibility across role, candidate, and next step'],
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '249 EUR / month',
      note: isCsLike ? 'Pro menší tým, který chce přestat lovit informace po tabulkách a začít řídit hiring v jednom prostoru.' : 'For a smaller team that wants to stop hunting through spreadsheets and run hiring in one place.',
      roleOpens: '3',
      dialogueSlots: '12',
      aiAssessments: '80 / month',
      recruiterSeats: '2',
      features: [isCsLike ? 'Plynulý tok od role k člověku i rozhodnutí' : 'A smooth flow from role to person to decision', isCsLike ? 'Silnější signál dřív, než kandidát vychladne' : 'Stronger signal before the candidate cools off'],
    },
    {
      id: 'growth',
      name: 'Growth',
      price: '599 EUR / month',
      note: isCsLike ? 'Pro firmy, které chtějí opakovatelný hiring, vyšší tempo a jistotu, že se nic důležitého neztratí.' : 'For companies that want repeatable hiring, a stronger pace, and confidence that nothing important gets lost.',
      roleOpens: '10',
      dialogueSlots: '40',
      aiAssessments: '250 / month',
      recruiterSeats: '5',
      highlighted: true,
      features: [isCsLike ? 'Silný multi-role hiring bez přepínání kontextu' : 'Strong multi-role hiring without context switching', isCsLike ? 'Kapacita, tým i náborový výkon pod jedním pohledem' : 'Capacity, team, and hiring performance in one view'],
    },
    {
      id: 'professional',
      name: 'Professional',
      price: '899 EUR / month',
      note: isCsLike ? 'Pro větší organizace, které potřebují držet kvalitu i přehled napříč více rolemi a týmy současně.' : 'For larger organizations that need to preserve quality and clarity across many roles and teams at once.',
      roleOpens: '25',
      dialogueSlots: '100',
      aiAssessments: '600 / month',
      recruiterSeats: '12',
      features: [isCsLike ? 'Vyšší kapacita bez rozpadu do chaosu' : 'Higher capacity without falling back into chaos', isCsLike ? 'Připravené pro paralelní hiring napříč firmou' : 'Ready for parallel hiring across the company'],
    },
  ]), [isCsLike]);

  const brief = useMemo<LandingDemoBrief>(() => ({
    title: isCsLike ? 'Ukázka zadání, které přivede lepší odpovědi hned na začátku' : 'A challenge preview that brings stronger answers from day one',
    companyGoal: isCsLike ? 'Potřebujeme člověka, který uklidní kritická místa v provozu, sladí klíčové lidi a vrátí týmu důvěru, že hiring vede k reálnému zlepšení.' : 'We need someone who can calm critical operational pressure points, align the right people, and restore confidence that hiring leads to real improvement.',
    challenge: isCsLike ? 'Navrhněte první měsíc tak, aby firma rychle viděla přínos: co stabilizovat nejdřív, koho zapojit a kde získat první viditelný výsledek.' : 'Design the first month so the company sees value quickly: what to stabilize first, who to involve, and where to create the first visible win.',
    firstStep: isCsLike ? 'Kandidát ukáže, jak přemýšlí pod tlakem, co upřednostní a jak promění nejasné zadání v konkrétní další krok.' : 'The candidate shows how they think under pressure, what they prioritize, and how they turn ambiguity into a concrete next step.',
    collaborationMode: isCsLike ? 'Hybrid / klíčová role pro tým' : 'Hybrid / key team role',
    compensation: '90 000 - 125 000 CZK',
    timeToSignal: isCsLike ? '7 dní' : '7 days',
    successSignals: isCsLike ? ['Klid v prioritách', 'Jasný ownership', 'Srozumitelný plán', 'Rychlý první dopad'] : ['Calm prioritization', 'Clear ownership', 'A credible plan', 'Fast first impact'],
    operatingNotes: [
      isCsLike ? 'Dobré zadání zkracuje cestu k relevantním kandidátům a šetří čas celému týmu.' : 'A strong challenge brings better-fit candidates sooner and saves time across the team.',
      isCsLike ? 'Ve vlastním workspace si firma podobné zadání upraví přesně podle své role, týmu a hiring cíle.' : 'Inside your own workspace, the team can tailor this kind of challenge to the exact role, team, and hiring goal.',
    ],
  }), [isCsLike]);

  const conversationMessages = useMemo<LandingDemoConversationMessage[]>(() => ([
    { id: 'message-1', author: 'Sara Novak', role: 'candidate', timestamp: isCsLike ? 'Pondělí 09:12' : 'Monday 09:12', body: isCsLike ? 'První týden bych zklidnila největší rizika, srovnala priority a dala týmu rychlý plán, kterému uvěří.' : 'In the first week I would calm the biggest risks, align priorities, and give the team a fast plan they can believe in.' },
    { id: 'message-2', author: company.name, role: 'company', timestamp: isCsLike ? 'Pondělí 11:04' : 'Monday 11:04', body: isCsLike ? 'Jak byste poznala, že se tým skutečně posouvá a že kandidátům umíme dát rychlejší a jistější odpověď?' : 'How would you know the team is truly moving forward and that we can give candidates a faster, more confident response?' },
    { id: 'message-3', author: isCsLike ? 'Hiring signál' : 'Hiring signal', role: 'system', timestamp: isCsLike ? 'Úterý 08:00' : 'Tuesday 08:00', body: isCsLike ? 'Právě tady JobShaman drží kontext, další krok i odpovědnost na jednom místě, takže hiring nezůstane viset mezi lidmi.' : 'This is where JobShaman keeps context, next step, and ownership together, so hiring does not get stuck between people.' },
  ]), [company.name, isCsLike]);

  const dossiers = useMemo<Record<string, DialogueDossier>>(() => ({
    'dialogue-sara': {
      id: 'dialogue-sara',
      job_id: 'demo-platform-engineer',
      company_id: 'demo-company',
      candidate_id: 'candidate-sara',
      source: 'landing_demo',
      status: 'shortlisted',
      submitted_at: '2026-03-24T09:20:00Z',
      updated_at: '2026-03-27T11:45:00Z',
      dialogue_deadline_at: '2026-04-02T16:00:00Z',
      dialogue_current_turn: 'company',
      dialogue_timeout_hours: 48,
      dialogue_is_overdue: false,
      cover_letter: isCsLike ? 'Spojuji technické týmy a provoz tak, aby se z napětí rychle stal konkrétní postup.' : 'I connect technical teams and operations so pressure turns into a concrete plan quickly.',
      candidate_profile_snapshot: { name: 'Sara Novak', email: 'sara.novak@example.com', phone: '+420 777 111 222', jobTitle: 'Platform / SRE lead', avatar_url: 'https://i.pravatar.cc/160?img=32', linkedin: 'linkedin.com/in/saranovak', skills: ['Python', 'Kubernetes', 'Grafana', 'Incident response'], values: ['Ownership', isCsLike ? 'Klid pod tlakem' : 'Calm under pressure'] },
      job_title: jobs[0]?.title,
      candidate_name: 'Sara Novak',
      candidate_email: 'sara.novak@example.com',
      candidate_avatar_url: 'https://i.pravatar.cc/160?img=32',
      ai_summary: { summary: isCsLike ? 'Kandidátka působí jako člověk, který dokáže z chaosu rychle vytvořit důvěryhodný plán.' : 'The candidate comes across as someone who can turn chaos into a credible plan fast.' },
      fit_evidence: { layers: { skills: { score: 84, evidence: ['Platform leadership'] }, motivation: { score: 81, evidence: ['Ownership signal'] }, experience: { score: 78, evidence: ['Incident response'] }, values: { score: 86, evidence: ['Systems thinking'] }, logistics: { score: 73, evidence: ['Brno hybrid'] } } },
    },
    'dialogue-marek': {
      id: 'dialogue-marek',
      job_id: 'demo-operations-lead',
      source: 'landing_demo',
      status: 'reviewed',
      submitted_at: '2026-03-25T08:45:00Z',
      updated_at: '2026-03-28T12:05:00Z',
      dialogue_deadline_at: '2026-04-03T14:00:00Z',
      dialogue_current_turn: 'candidate',
      dialogue_timeout_hours: 72,
      job_title: jobs[1]?.title,
      candidate_name: 'Marek Svoboda',
      candidate_email: 'marek.svoboda@example.com',
      candidate_avatar_url: 'https://i.pravatar.cc/160?img=53',
      candidate_profile_snapshot: { name: 'Marek Svoboda', email: 'marek.svoboda@example.com', avatar_url: 'https://i.pravatar.cc/160?img=53', jobTitle: 'Operations lead', skills: ['Operations design', 'Recruiter enablement'], values: [isCsLike ? 'Tempo bez chaosu' : 'Speed without chaos'] },
    },
    'dialogue-elena': {
      id: 'dialogue-elena',
      job_id: 'demo-platform-engineer',
      source: 'landing_demo',
      status: 'pending',
      submitted_at: '2026-03-26T10:20:00Z',
      updated_at: '2026-03-29T08:30:00Z',
      dialogue_deadline_at: '2026-04-04T15:00:00Z',
      dialogue_current_turn: 'candidate',
      dialogue_timeout_hours: 48,
      job_title: jobs[0]?.title,
      candidate_name: 'Elena Richter',
      candidate_email: 'elena.richter@example.com',
      candidate_avatar_url: 'https://i.pravatar.cc/160?img=47',
      candidate_profile_snapshot: { name: 'Elena Richter', email: 'elena.richter@example.com', avatar_url: 'https://i.pravatar.cc/160?img=47', jobTitle: 'Industrial architect', skills: ['Architecture', 'Industrial IoT'], values: [isCsLike ? 'Systémové myšlení' : 'Systems thinking'] },
    },
  }), [isCsLike, jobs]);
  const selectedJob = jobs.find((job) => job.id === navigation.selectedWaveId) || jobs[0] || null;
  const selectedDialogue = dialogues.find((dialogue) => dialogue.id === navigation.selectedDialogueId)
    || dialogues.find((dialogue) => String(dialogue.job_id) === String(selectedJob?.id))
    || dialogues[0]
    || null;
  const selectedDossier = selectedDialogue ? dossiers[selectedDialogue.id] || null : null;
  const visibleDialogues = dialogues.filter((dialogue) => !selectedJob?.id || String(dialogue.job_id) === String(selectedJob.id));
  const metrics = { roles: jobs.length, activeDialogues: dialogues.filter((item) => ['pending', 'reviewed', 'shortlisted'].includes(String(item.status))).length, candidates: 14, assessments: assessments.length };

  const formatDate = (value: string | null | undefined) => {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const labelStatus = (status: string) => ({
    pending: isCsLike ? 'Čeká' : 'Pending',
    reviewed: isCsLike ? 'Prohlédnuto' : 'Reviewed',
    shortlisted: 'Shortlist',
    rejected: isCsLike ? 'Zamítnuto' : 'Rejected',
    active: isCsLike ? 'Aktivní' : 'Active',
    closed: isCsLike ? 'Uzavřeno' : 'Closed',
  }[status] || status);

  const callRegister = (section: string, metadata?: Record<string, unknown>) => {
    trackEvent('company_landing_cta_register_click', { section, ...metadata });
    onRegister?.();
  };

  const callDemo = (section: string, metadata?: Record<string, unknown>) => {
    trackEvent('company_landing_cta_demo_click', { section, ...metadata });
    onRequestDemo?.();
  };

  const callLogin = (section: string, metadata?: Record<string, unknown>) => {
    trackEvent('company_landing_cta_login_click', { section, ...metadata });
    onLogin?.();
  };

  const handleReadOnlyAction = (section: string, target: 'register' | 'demo' | 'login' = 'register', metadata?: Record<string, unknown>) => {
    if (target === 'demo') return callDemo(section, metadata);
    if (target === 'login') return callLogin(section, metadata);
    return callRegister(section, metadata);
  };

  const navigate = (activeLayer: LandingMapLayer, options?: { waveId?: string | null; dialogueId?: string | null; keepPanel?: boolean }) => {
    trackEvent('company_landing_demo_layer_open', {
      layer: activeLayer,
      wave_id: options?.waveId ?? navigation.selectedWaveId,
      dialogue_id: options?.dialogueId ?? navigation.selectedDialogueId,
    });
    setNavigation((current) => ({
      ...current,
      activeLayer,
      selectedWaveId: options?.waveId ?? current.selectedWaveId,
      selectedDialogueId: options?.dialogueId ?? current.selectedDialogueId,
      panelDismissed: options?.keepPanel ? current.panelDismissed : false,
    }));
  };

  const openWave = (waveId: string) => navigate('challenge_cluster', { waveId });
  const openHumanDetail = (dialogueId: string, waveId?: string | null) => navigate('human_detail', { dialogueId, waveId: waveId ? String(waveId) : navigation.selectedWaveId });
  const layers: CompanyGalaxyMapLayer[] = [
    { id: 'challenge_map', label: copy.challengeMap, icon: Sparkles, active: navigation.activeLayer === 'challenge_map', onClick: () => navigate('challenge_map') },
    { id: 'challenge_cluster', label: copy.challengeCluster, icon: Briefcase, active: navigation.activeLayer === 'challenge_cluster', onClick: () => navigate('challenge_cluster', { waveId: selectedJob?.id || null }) },
    { id: 'human_detail', label: copy.humanDetail, icon: Users, active: navigation.activeLayer === 'human_detail', onClick: () => navigate('human_detail', { waveId: selectedDialogue?.job_id ? String(selectedDialogue.job_id) : selectedJob?.id || null, dialogueId: selectedDialogue?.id || null }) },
    { id: 'open_challenge', label: copy.openChallenge, icon: Plus, active: navigation.activeLayer === 'open_challenge', onClick: () => navigate('open_challenge', { waveId: selectedJob?.id || null }) },
    { id: 'pricing', label: copy.pricing, icon: CreditCard, active: navigation.activeLayer === 'pricing', onClick: () => navigate('pricing') },
  ];

  const nodes: CompanyGalaxyMapNode[] = useMemo(() => {
    const positions: Record<LandingMapLayer, Record<LandingMapLayer, { x: number; y: number }>> = {
      challenge_map: { challenge_map: { x: 50, y: 14 }, challenge_cluster: { x: 82, y: 28 }, human_detail: { x: 78, y: 78 }, open_challenge: { x: 24, y: 78 }, pricing: { x: 18, y: 32 } },
      challenge_cluster: { challenge_map: { x: 18, y: 32 }, challenge_cluster: { x: 50, y: 14 }, human_detail: { x: 80, y: 32 }, open_challenge: { x: 24, y: 78 }, pricing: { x: 78, y: 78 } },
      human_detail: { challenge_map: { x: 18, y: 30 }, challenge_cluster: { x: 80, y: 28 }, human_detail: { x: 50, y: 14 }, open_challenge: { x: 22, y: 78 }, pricing: { x: 78, y: 78 } },
      open_challenge: { challenge_map: { x: 18, y: 30 }, challenge_cluster: { x: 78, y: 28 }, human_detail: { x: 82, y: 78 }, open_challenge: { x: 50, y: 14 }, pricing: { x: 24, y: 78 } },
      pricing: { challenge_map: { x: 18, y: 30 }, challenge_cluster: { x: 80, y: 28 }, human_detail: { x: 78, y: 78 }, open_challenge: { x: 24, y: 78 }, pricing: { x: 50, y: 14 } },
    };

    const shared: Record<LandingMapLayer, LandingMapNodeTemplate> = {
      challenge_map: { id: 'challenge_map', label: copy.challengeMap, secondaryLabel: copy.defaultLayer, narrative: isCsLike ? 'Přehled, ve kterém firma během chvíle uvidí role, kandidáty i bottlenecky bez přeskakování mezi nástroji.' : 'A map where the team can see roles, candidates, and bottlenecks in seconds without jumping between tools.', count: metrics.roles + metrics.activeDialogues, accent: navigation.activeLayer === 'challenge_map' ? 'core' : 'muted', tone: navigation.activeLayer === 'challenge_map' ? 'emerald' : 'blue', icon: <Sparkles size={28} /> },
      challenge_cluster: { id: 'challenge_cluster', label: copy.challengeCluster, secondaryLabel: selectedJob?.title || copy.liveModule, narrative: isCsLike ? 'Každá role má jasný další krok, odpovědnost i tempo, takže hiring neztrácí tah.' : 'Each role gets a clear next step, clear ownership, and steady pace so hiring keeps moving.', count: visibleDialogues.length + jobs.length, accent: navigation.activeLayer === 'challenge_cluster' ? 'core' : 'accent', tone: 'emerald', icon: <Briefcase size={28} /> },
      human_detail: { id: 'human_detail', label: copy.humanDetail, secondaryLabel: selectedDossier?.candidate_name || copy.dossier, narrative: isCsLike ? 'Kandidát už není jen karta v tabulce. Tým okamžitě vidí kontext, signál i další rozhodnutí.' : 'A candidate is no longer just a row in a spreadsheet. The team sees context, signal, and the next decision immediately.', count: selectedDossier ? 1 : visibleDialogues.length, accent: navigation.activeLayer === 'human_detail' ? 'core' : 'muted', tone: 'blue', imageUrl: selectedDossier?.candidate_profile_snapshot?.avatar_url || selectedDialogue?.candidate_avatar_url || null, icon: <Users size={28} /> },
      open_challenge: { id: 'open_challenge', label: copy.openChallenge, secondaryLabel: copy.readOnlyEditor, narrative: isCsLike ? 'Dobře položené zadání přitahuje lepší kandidáty a šetří čas ještě před prvním kolem.' : 'A well-framed challenge attracts better-fit candidates and saves time before the first interview.', count: jobs.length, accent: navigation.activeLayer === 'open_challenge' ? 'core' : 'accent', tone: 'orange', icon: <Plus size={28} /> },
      pricing: { id: 'pricing', label: copy.pricing, secondaryLabel: copy.capacity, narrative: isCsLike ? 'Firma hned vidí, jakou kapacitu potřebuje pro svůj hiring rytmus a růstové ambice.' : 'The team can instantly see what level of capacity fits its hiring pace and growth goals.', count: pricingPlans.length, accent: navigation.activeLayer === 'pricing' ? 'core' : 'muted', tone: 'orange', icon: <CreditCard size={28} /> },
    };

    return (Object.keys(shared) as LandingMapLayer[]).map((id) => ({
      ...shared[id],
      ...positions[navigation.activeLayer][id],
      active: navigation.activeLayer === id,
      onClick: () => navigate(
        id,
        id === 'human_detail'
          ? { waveId: selectedDialogue?.job_id ? String(selectedDialogue.job_id) : selectedJob?.id || null, dialogueId: selectedDialogue?.id || null }
          : id === 'challenge_cluster' || id === 'open_challenge'
            ? { waveId: selectedJob?.id || null }
            : undefined,
      ),
    }));
  }, [copy, isCsLike, jobs.length, metrics.activeDialogues, metrics.roles, navigation.activeLayer, pricingPlans.length, selectedDialogue, selectedDossier, selectedJob, visibleDialogues.length]);

  const breadcrumbs: CompanyGalaxyMapBreadcrumb[] = navigation.activeLayer === 'challenge_map'
    ? [
        {
          id: 'challenge_map',
          label: copy.challengeMap,
          onClick: () => navigate('challenge_map'),
        },
      ]
    : [
        { id: 'challenge_map', label: copy.challengeMap, onClick: () => navigate('challenge_map') },
        {
          id: navigation.activeLayer,
          label: layers.find((layer) => layer.id === navigation.activeLayer)?.label || navigation.activeLayer,
          onClick: () => navigate(
            navigation.activeLayer,
            navigation.activeLayer === 'human_detail'
              ? { dialogueId: selectedDialogue?.id || null, waveId: selectedDialogue?.job_id ? String(selectedDialogue.job_id) : selectedJob?.id || null }
              : navigation.activeLayer === 'challenge_cluster' || navigation.activeLayer === 'open_challenge'
                ? { waveId: selectedJob?.id || null }
                : undefined,
          ),
        },
      ];

  const detailPanel = !navigation.panelDismissed ? (
    <div className="space-y-4">
      {navigation.activeLayer === 'challenge_map' ? (
        <>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{copy.whyShell}</div>
            <div className="mt-2 text-lg font-semibold text-[var(--text-strong)]">{copy.sameGalaxy}</div>
            <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{company.philosophy}</p>
          </div>
          <div className="grid gap-2">
            {company.values.map((value) => (
              <div key={value} className="rounded-[18px] border border-white/70 bg-white/82 px-4 py-3 text-sm text-slate-700">{value}</div>
            ))}
          </div>
        </>
      ) : navigation.activeLayer === 'challenge_cluster' ? (
        <>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{copy.challengeCluster}</div>
          <div className="text-lg font-semibold text-[var(--text-strong)]">{selectedJob?.title}</div>
          <p className="text-sm leading-7 text-[var(--text-muted)]">{selectedJob?.challenge || selectedJob?.description}</p>
        </>
      ) : navigation.activeLayer === 'human_detail' ? (
        <>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{copy.humanDetail}</div>
          <div className="text-lg font-semibold text-[var(--text-strong)]">{selectedDossier?.candidate_name || selectedDialogue?.candidate_name}</div>
          <p className="text-sm leading-7 text-[var(--text-muted)]">{isCsLike ? 'Tady je vidět, jak rychle se může z prvního dojmu stát kvalitní rozhodnutí, když má tým kontext i další krok na očích.' : 'This is where you see how quickly a first impression can become a strong decision when the team has context and the next step in plain view.'}</p>
        </>
      ) : navigation.activeLayer === 'open_challenge' ? (
        <>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{copy.readOnlyEditor}</div>
          <div className="text-lg font-semibold text-[var(--text-strong)]">{isCsLike ? 'Lepší zadání přináší lepší reakce už od prvního dne.' : 'Better framing creates better responses from the very first day.'}</div>
          <p className="text-sm leading-7 text-[var(--text-muted)]">{brief.companyGoal}</p>
        </>
      ) : (
        <>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{copy.pricing}</div>
          <div className="text-lg font-semibold text-[var(--text-strong)]">{isCsLike ? 'Vyberete takovou kapacitu, která podpoří růst bez zbytečných prostojů.' : 'Choose a level of capacity that supports growth without unnecessary delays.'}</div>
          <div className="space-y-2">
            {pricingPlans.slice(0, 3).map((plan) => (
              <div key={plan.id} className="rounded-[18px] border border-white/70 bg-white/82 px-4 py-3">
                <div className="text-sm font-semibold text-slate-950">{plan.name}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--accent)]">{plan.price}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  ) : null;
  const lowerContent = navigation.activeLayer === 'challenge_map'
    ? null
    : navigation.activeLayer === 'challenge_cluster'
    ? (
        <CompanyWaveClusterPanel
          locale={language}
          jobs={jobs}
          selectedJobId={selectedJob?.id || null}
          jobStats={{ 'demo-platform-engineer': { views: 84, applicants: 12 }, 'demo-operations-lead': { views: 51, applicants: 8 } }}
          assessmentCount={assessments.length}
          dialoguesLoading={false}
          dialogues={visibleDialogues}
          dialoguesUpdating={{}}
          selectedDialogueId={selectedDialogue?.id || null}
          labelStatus={labelStatus}
          onCreateNewChallenge={() => handleReadOnlyAction('landing_demo_create_challenge', 'register')}
          onCreateMiniChallenge={() => handleReadOnlyAction('landing_demo_create_mini_challenge', 'register')}
          onOpenWave={openWave}
          onOpenEditor={(waveId) => navigate('open_challenge', { waveId })}
          onCloseWave={(waveId) => handleReadOnlyAction('landing_demo_close_wave', 'register', { waveId })}
          onReopenWave={(waveId) => handleReadOnlyAction('landing_demo_reopen_wave', 'register', { waveId })}
          onArchiveWave={(waveId) => handleReadOnlyAction('landing_demo_archive_wave', 'demo', { waveId })}
          onCreateAssessment={(waveId) => handleReadOnlyAction('landing_demo_create_assessment', 'demo', { waveId })}
          onOpenDialogue={openHumanDetail}
          onDialogueStatusChange={(dialogueId, status) => handleReadOnlyAction('landing_demo_dialogue_status', 'register', { dialogueId, status })}
        />
      )
      : navigation.activeLayer === 'human_detail'
        ? (
          <div className="space-y-5">
            <CompanyHumanDetailPanel
              dossier={selectedDossier}
              dialogueOptions={dialogues.map((dialogue) => ({ id: dialogue.id, candidateName: dialogue.candidate_name || 'Candidate', jobTitle: dialogue.job_title, status: dialogue.status, avatarUrl: dialogue.candidate_avatar_url || dialogue.candidateAvatarUrl || null }))}
              locale={language}
              formatDate={formatDate}
              labelStatus={labelStatus}
              onOpenDialogue={(dialogueId) => openHumanDetail(dialogueId, dialogues.find((item) => item.id === dialogueId)?.job_id ? String(dialogues.find((item) => item.id === dialogueId)?.job_id) : selectedJob?.id || null)}
              onCreateAssessment={() => handleReadOnlyAction('landing_demo_human_detail_create_assessment', 'register', { dialogueId: selectedDialogue?.id || null })}
              onInviteAssessment={() => handleReadOnlyAction('landing_demo_human_detail_invite_assessment', 'demo', { dialogueId: selectedDialogue?.id || null })}
            />
            <LandingDemoConversationPanel locale={language} messages={conversationMessages} onRegister={() => callRegister('landing_demo_conversation_register')} onRequestDemo={() => callDemo('landing_demo_conversation_demo')} onLogin={() => callLogin('landing_demo_conversation_login')} />
          </div>
        )
        : navigation.activeLayer === 'open_challenge'
          ? <LandingDemoOpenChallengePanel locale={language} brief={brief} onRegister={() => callRegister('landing_demo_open_challenge_register')} onRequestDemo={() => callDemo('landing_demo_open_challenge_demo')} />
          : <LandingDemoPricingPanel locale={language} plans={pricingPlans} onRegister={(planId) => callRegister('landing_demo_pricing_register', { planId })} onRequestDemo={() => callDemo('landing_demo_pricing_demo')} onLogin={() => callLogin('landing_demo_pricing_login')} />;

  return (
    <CompanyMapScene
      locale={language}
      kicker={isCsLike ? 'JobShaman pro firmy' : 'JobShaman for companies'}
      title={copy.title}
      subtitle={copy.subtitle}
      center={{
        name: navigation.activeLayer === 'challenge_map' ? company.name : navigation.activeLayer === 'challenge_cluster' ? (selectedJob?.title || company.name) : navigation.activeLayer === 'human_detail' ? (selectedDossier?.candidate_name || selectedDialogue?.candidate_name || company.name) : navigation.activeLayer === 'open_challenge' ? copy.openChallenge : copy.planCapacity,
        motto: navigation.activeLayer === 'challenge_map' ? company.philosophy : navigation.activeLayer === 'challenge_cluster' ? (selectedJob?.challenge || selectedJob?.description || company.philosophy) : navigation.activeLayer === 'human_detail' ? (selectedDossier?.ai_summary?.summary || company.philosophy) : navigation.activeLayer === 'open_challenge' ? brief.challenge : (isCsLike ? 'Kapacita má růst spolu s hiringem, ne ho brzdit.' : 'Capacity should grow with hiring, not hold it back.'),
        tone: company.tone,
        statusLine: navigation.activeLayer === 'human_detail' ? labelStatus(selectedDossier?.status || 'pending') : navigation.activeLayer === 'pricing' ? 'Free / Starter / Growth / Professional' : `${metrics.roles} ${isCsLike ? 'aktivní výzvy' : 'active challenges'} / ${metrics.activeDialogues} ${isCsLike ? 'živé konverzace' : 'live conversations'}`,
        values: company.values,
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
          <button type="button" onClick={() => callRegister('landing_workspace_header')} className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white">{copy.register}<ArrowRight size={16} /></button>
          <button type="button" onClick={() => callDemo('landing_workspace_demo')} className="inline-flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--surface-subtle)] px-5 py-2.5 text-sm font-semibold text-[var(--text-strong)]">{copy.demo}</button>
          <button type="button" onClick={() => callLogin('landing_workspace_login')} className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/84 px-4 py-2.5 text-sm font-semibold text-[var(--text-strong)]"><LogIn size={15} />{copy.login}</button>
        </>
      )}
    />
  );
};

export default CompanyLandingPage;
