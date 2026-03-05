import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Briefcase, CheckCircle2, Clock3, Sparkles, UserRound } from 'lucide-react';

import ApplicationMessageCenter from '../components/ApplicationMessageCenter';
import { trackAnalyticsEvent } from '../services/supabaseService';
import { type DialogueMessage } from '../types';
import { type DialogueMessageCreatePayload } from '../services/jobApplicationService';

interface DemoCompanyHandshakePageProps {
  onRegister?: () => void;
  onBackToCompanyLanding?: () => void;
}

type DemoCompanyStep = 'role_canvas' | 'incoming_candidate' | 'company_reply' | 'completed';

const createDemoThreadId = (): string => `THR-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const createMessageId = (): string => `dm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const createDeadlineAt = (hours: number): string => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

const getElapsedBucket = (durationMs: number): string => {
  if (durationMs < 60_000) return 'under_1m';
  if (durationMs < 120_000) return '1_2m';
  if (durationMs < 300_000) return '2_5m';
  return 'over_5m';
};

interface DemoCandidateProfile {
  name: string;
  title: string;
  yearsExperience: number;
  experiences: string[];
  cvFilename: string;
  auditFilename: string;
  jcfpmFilename: string;
  pilotPlanFilename: string;
  jcfpmSummary: string;
  jcfpmTraits: Array<{ label: string; score: number }>;
  jcfpmRisk: string;
}

const pickRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const pickMany = <T,>(items: T[], count: number): T[] => {
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(1, Math.min(count, items.length)));
};

const toFileSlug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const createDemoCandidateProfile = (isCsLike: boolean): DemoCandidateProfile => {
  const firstNames = isCsLike
    ? ['Jakub', 'Tereza', 'Ondrej', 'Veronika', 'Adam', 'Ema', 'Patrik', 'Nikola', 'David', 'Lucie']
    : ['Alex', 'Mia', 'Liam', 'Nora', 'Ethan', 'Sofia', 'Ryan', 'Emma', 'Noah', 'Ella'];
  const lastNames = isCsLike
    ? ['Kolar', 'Novotny', 'Svoboda', 'Dvorak', 'Kratochvil', 'Urban', 'Prochazka', 'Barta', 'Sedlak', 'Marek']
    : ['Carter', 'Hayes', 'Miller', 'Novak', 'Brooks', 'Ward', 'Parker', 'Hunter', 'Reed', 'Stone'];
  const titles = isCsLike
    ? [
        'Směnový supervizor recepce',
        'Koordinátor front office provozu',
        'Provozní lead hospitality týmu',
        'Supervisor služeb hostům',
      ]
    : [
        'Front Office Shift Supervisor',
        'Hospitality Operations Coordinator',
        'Guest Services Team Lead',
        'Shift Operations Supervisor',
      ];
  const experiencePool = isCsLike
    ? [
        '3 roky vedl ranní a odpolední směnu na recepci 120+ pokojového hotelu.',
        'Zavedl jednotný handoff checklist a snížil počet eskalací o 28 %.',
        'Koordinoval spolupráci recepce a housekeepingu při špičkách obsazenosti.',
        'Nastavil denní report pro incidenty, SLA a prioritu úkolů mezi směnami.',
        'Školil nové směnové kolegy na krizovou komunikaci s hosty.',
      ]
    : [
        'Led morning and evening front-desk shifts in a 120+ room hotel.',
        'Rolled out one handoff checklist and reduced escalations by 28%.',
        'Coordinated front desk and housekeeping during peak occupancy windows.',
        'Built daily incident + SLA reporting across shift transitions.',
        'Onboarded new shift agents for guest-facing de-escalation routines.',
      ];
  const riskPool = isCsLike
    ? [
        'Silná orientace na detail může zpomalit rozhodnutí v akutních situacích.',
        'Při vysokém tlaku má tendenci řešit operativu osobně místo delegování.',
        'Potřebuje jasně hlídat prioritu mezi kvalitou procesu a rychlostí reakce.',
      ]
    : [
        'Strong detail focus may slow decisions in urgent moments.',
        'Under pressure, can over-own operations instead of delegating early.',
        'Needs explicit priority framing between process quality and response speed.',
      ];
  const traitLabels = isCsLike
    ? ['Procesní disciplína', 'Koordinace směn', 'Komunikace pod tlakem']
    : ['Process discipline', 'Shift coordination', 'Communication under pressure'];

  const name = `${pickRandom(firstNames)} ${pickRandom(lastNames)}`;
  const yearsExperience = Math.floor(Math.random() * 6) + 3;
  const selectedExperiences = pickMany(experiencePool, 3);
  const traitScores = traitLabels.map((label) => ({
    label,
    score: Math.floor(Math.random() * 22) + 72,
  }));
  const avgScore = Math.round(traitScores.reduce((sum, item) => sum + item.score, 0) / traitScores.length);
  const jcfpmSummary = isCsLike
    ? `Profil ukazuje stabilní výkon v provozu (${avgScore}/100) a vhodnost pro řízení handoffu mezi směnami.`
    : `Profile shows stable operations performance (${avgScore}/100) and fit for shift-handoff ownership.`;
  const slug = toFileSlug(name);

  return {
    name,
    title: pickRandom(titles),
    yearsExperience,
    experiences: selectedExperiences,
    cvFilename: `CV_${slug}_ShiftOps.pdf`,
    auditFilename: isCsLike ? `Provozni_audit_${slug}.pdf` : `Operations_audit_${slug}.pdf`,
    jcfpmFilename: `JCFPM_${slug}_summary.pdf`,
    pilotPlanFilename: isCsLike ? `Pilot_plan_14_dni_${slug}.pdf` : `14_day_pilot_plan_${slug}.pdf`,
    jcfpmSummary,
    jcfpmTraits: traitScores,
    jcfpmRisk: pickRandom(riskPool),
  };
};

const DemoCompanyHandshakePage: React.FC<DemoCompanyHandshakePageProps> = ({
  onRegister,
  onBackToCompanyLanding,
}) => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const isCsLike = locale === 'cs' || locale === 'sk';
  const [candidateProfile, setCandidateProfile] = useState<DemoCandidateProfile>(() => createDemoCandidateProfile(isCsLike));

  useEffect(() => {
    setCandidateProfile(createDemoCandidateProfile(isCsLike));
  }, [isCsLike]);

  const copy = useMemo(
    () =>
      isCsLike
        ? {
            badge: 'Demo workflow pro firmu',
            title: 'Vyzkoušejte firemní handshake stejně jako v ostré aplikaci.',
            subtitle:
              'Uvidíte celý průchod: Role Canvas, příchod kandidáta, první odpověď firmy, navazující reakce kandidáta a jasný stav bez ghostingu.',
            stepRole: '1 Role Canvas',
            stepCandidate: '2 Kandidát přichází',
            stepCompany: '3 První odpověď firmy',
            stepDone: '4 Dokončeno',
            roleLabel: 'Demo inzerát',
            roleTitle: 'Směnový koordinátor provozu (recepce + housekeeping)',
            roleCompany: 'Hotel Aurora Prague',
            roleLocation: 'Praha 1 · onsite',
            roleSalary: '38 000 - 48 000 Kč / měsíc',
            roleSummary:
              'Hledáme člověka, který stabilizuje předávání směn mezi recepcí a housekeepingem a zavede jasný provozní rytmus.',
            roleTruthTitle: 'Role truth',
            roleTruthItems: [
              'Nejtěžší je handoff mezi ranní a odpolední směnou.',
              'Bez důsledné práce s checklisty se kvalita rychle rozpadne.',
              'Po 6 týdnech potřebujeme měřitelně nižší počet eskalací hostů.',
            ],
            roleContinue: 'Pokračovat na reakce kandidáta',
            incomingBadge: 'Příchozí kandidát',
            incomingTitle: 'Kandidát reagoval na výzvu a otevřel soukromé vlákno.',
            candidateSignalOne:
              'Nejdřív bych auditoval handoff mezi směnami, vytáhl opakující se chyby a sjednotil checklist pro recepci i housekeeping.',
            candidateSignalTwo:
              'V prvním týdnu bych vedl krátké 15min standupy před každou směnou a zavedl sdílený logbook s jasnou odpovědností.',
            candidatePacket: 'Sdílené podklady kandidáta',
            candidateNameLabel: 'Kandidát',
            candidateExperienceLabel: 'Relevantní zkušenosti',
            candidateCvPreviewTitle: 'Náhled CV',
            candidateJcfpmPreviewTitle: 'Náhled JCFPM',
            candidateTraitsLabel: 'JCFPM signály',
            candidateRiskLabel: 'Rizikové místo',
            yearUnit: 'let praxe',
            incomingContinue: 'Otevřít thread firmy',
            companyReplyBadge: 'Firemní režim',
            companyReplyTitle: 'První odpověď firmy a navázání kandidáta',
            statusLabel: 'Stav',
            statusCompanyTurn: 'Čeká na vaši první odpověď firmou.',
            statusCandidateTurn: 'První odpověď odeslána. Teď je na tahu kandidát.',
            statusReady: 'Kandidát navázal. Vlákno je připravené na další krok.',
            progressTitle: 'Průchod dialogem',
            progressOne: 'Kandidát otevře thread',
            progressTwo: 'Firma odešle první odpověď',
            progressThree: 'Kandidát naváže a odemkne pokračování',
            progressDone: 'Hotovo',
            progressPending: 'Čeká',
            threadLabel: 'ID vlákna',
            threadHint: 'Stejný komponent threadu jako v production flow.',
            threadLoading: 'Přichází první zpráva kandidáta…',
            prefilledNotice: 'Odpověď firmy je předvyplněná. Stačí kliknout na Odeslat.',
            waitingCandidateNotice: 'Systém čeká na reakci kandidáta…',
            candidateReturnedNotice: 'Kandidát odpověděl. Můžete pokračovat na další krok.',
            threadHeading: 'Dialogové vlákno',
            threadSubtitle: 'Reálný asynchronní thread používaný i ve firemním dashboardu.',
            threadEmpty: 'Zatím bez zpráv.',
            composerPlaceholder:
              'Napište první odpověď firmy… (v ostrém flow lze přiložit dokument, obrázek nebo návrh smlouvy)',
            sendButton: 'Odeslat',
            prefilledCompanyReply:
              'Děkujeme za konkrétní postup. Přesně handoff mezi směnami je náš hlavní problém. Chceme pokračovat v dialogu.',
            candidateFollowup:
              'Děkuji. Připravil jsem krátký pilotní plán na 14 dní. Pokud dává smysl, pošlu ho jako další podklad.',
            nextStepButton: 'Dokončit demo',
            completedTitle: 'Demo firemního workflow je hotové.',
            completedBody:
              'Firma i kandidát reagovali, thread má jasný stav a další krok je odemčený bez nejistoty.',
            completedPrimary: 'Založit firemní účet',
            completedSecondary: 'Zpět na landing pro firmy',
            completedRestart: 'Spustit demo znovu',
          }
        : {
            badge: 'Company workflow demo',
            title: 'Try the company-side handshake flow with real UI components.',
            subtitle:
              'You get the full path: Role Canvas, candidate arrival, first company reply, candidate follow-up, and a clear no-ghosting status.',
            stepRole: '1 Role Canvas',
            stepCandidate: '2 Candidate arrives',
            stepCompany: '3 First company reply',
            stepDone: '4 Completed',
            roleLabel: 'Demo listing',
            roleTitle: 'Shift Operations Coordinator (front desk + housekeeping)',
            roleCompany: 'Hotel Aurora Prague',
            roleLocation: 'Prague 1 · onsite',
            roleSalary: 'EUR 1,550 - 1,950 / month',
            roleSummary:
              'We are hiring someone to stabilize shift handoffs between front desk and housekeeping and set a clear operating rhythm.',
            roleTruthTitle: 'Role truth',
            roleTruthItems: [
              'The hard part is handoff quality between morning and afternoon shifts.',
              'Without strict checklist ownership, quality drops quickly.',
              'Within six weeks we need measurable reduction in guest escalations.',
            ],
            roleContinue: 'Continue to candidate signal',
            incomingBadge: 'Incoming candidate',
            incomingTitle: 'A candidate replied and opened a private thread.',
            candidateSignalOne:
              'I would audit shift handoffs first, extract recurring failure points, and align one checklist for front desk and housekeeping.',
            candidateSignalTwo:
              'In week one I would run 15-minute pre-shift standups and launch a shared logbook with clear ownership.',
            candidatePacket: 'Shared candidate materials',
            candidateNameLabel: 'Candidate',
            candidateExperienceLabel: 'Relevant experience',
            candidateCvPreviewTitle: 'CV preview',
            candidateJcfpmPreviewTitle: 'JCFPM preview',
            candidateTraitsLabel: 'JCFPM signals',
            candidateRiskLabel: 'Risk area',
            yearUnit: 'years experience',
            incomingContinue: 'Open company thread',
            companyReplyBadge: 'Company mode',
            companyReplyTitle: 'First company reply and candidate follow-up',
            statusLabel: 'Status',
            statusCompanyTurn: 'Waiting for your first company reply.',
            statusCandidateTurn: 'First reply sent. Candidate turn is active.',
            statusReady: 'Candidate replied. Thread is ready for the next step.',
            progressTitle: 'Dialogue progress',
            progressOne: 'Candidate opens the thread',
            progressTwo: 'Company sends first reply',
            progressThree: 'Candidate follows up and unlocks continuation',
            progressDone: 'Done',
            progressPending: 'Pending',
            threadLabel: 'Thread ID',
            threadHint: 'Same thread component as in production flow.',
            threadLoading: 'First candidate message is coming in…',
            prefilledNotice: 'The company reply is prefilled. Just click Send.',
            waitingCandidateNotice: 'Waiting for candidate follow-up…',
            candidateReturnedNotice: 'Candidate replied. You can move to the next step.',
            threadHeading: 'Dialogue thread',
            threadSubtitle: 'Real async thread component used in the company dashboard.',
            threadEmpty: 'No messages yet.',
            composerPlaceholder:
              'Write the first company reply… (in production you can attach a document, image, or contract draft)',
            sendButton: 'Send',
            prefilledCompanyReply:
              'Thanks for the structured approach. Shift handoff is exactly our core issue. We want to continue.',
            candidateFollowup:
              'Thank you. I prepared a short 14-day pilot plan. If useful, I can share it as the next supporting document.',
            nextStepButton: 'Complete demo',
            completedTitle: 'Company-side demo workflow completed.',
            completedBody:
              'Both sides replied, the thread has a clear state, and the next step unlocked without uncertainty.',
            completedPrimary: 'Create company account',
            completedSecondary: 'Back to company landing',
            completedRestart: 'Run demo again',
          },
    [isCsLike],
  );

  const [step, setStep] = useState<DemoCompanyStep>('role_canvas');
  const [threadOpened, setThreadOpened] = useState(false);
  const [companyReplySent, setCompanyReplySent] = useState(false);
  const [candidateFollowupArrived, setCandidateFollowupArrived] = useState(false);
  const [threadMessages, setThreadMessages] = useState<DialogueMessage[]>([]);
  const [threadStatus, setThreadStatus] = useState<'pending' | 'reviewed' | 'shortlisted'>('pending');
  const [threadCurrentTurn, setThreadCurrentTurn] = useState<'candidate' | 'company'>('company');
  const [threadDeadlineAt, setThreadDeadlineAt] = useState<string | null>(createDeadlineAt(24));
  const threadIdRef = useRef<string>(createDemoThreadId());
  const startedAtRef = useRef<number>(Date.now());
  const completedTrackedRef = useRef<boolean>(false);
  const firstCandidateTimerRef = useRef<number | null>(null);
  const candidateFollowupTimerRef = useRef<number | null>(null);

  const clearActiveTimers = useCallback(() => {
    if (firstCandidateTimerRef.current) {
      window.clearTimeout(firstCandidateTimerRef.current);
      firstCandidateTimerRef.current = null;
    }
    if (candidateFollowupTimerRef.current) {
      window.clearTimeout(candidateFollowupTimerRef.current);
      candidateFollowupTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearActiveTimers(), [clearActiveTimers]);

  const safeTrack = useCallback(
    (eventType: string, metadata: Record<string, unknown> = {}) => {
      void trackAnalyticsEvent({
        event_type: eventType,
        feature: 'demo_company_handshake',
        metadata: {
          locale,
          ...metadata,
        },
      }).catch(() => undefined);
    },
    [locale],
  );

  useEffect(() => {
    safeTrack('demo_company_handshake_opened', {
      path: typeof window !== 'undefined' ? window.location.pathname : '/demo-company-handshake',
    });
  }, [safeTrack]);

  useEffect(() => {
    if (step !== 'completed' || completedTrackedRef.current) return;
    completedTrackedRef.current = true;
    safeTrack('demo_company_handshake_completed', {
      elapsed_bucket: getElapsedBucket(Date.now() - startedAtRef.current),
    });
  }, [safeTrack, step]);

  const createMessage = useCallback(
    (
      senderRole: 'candidate' | 'recruiter',
      body: string,
      attachments: DialogueMessage['attachments'] = [],
    ): DialogueMessage => {
      const createdAt = new Date().toISOString();
      return {
        id: createMessageId(),
        application_id: threadIdRef.current,
        company_id: null,
        candidate_id: null,
        sender_user_id: null,
        sender_role: senderRole,
        body,
        attachments,
        created_at: createdAt,
        read_by_candidate_at: senderRole === 'recruiter' ? createdAt : null,
        read_by_company_at: senderRole === 'candidate' ? createdAt : null,
      };
    },
    [],
  );

  useEffect(() => {
    if (step !== 'company_reply') return;

    clearActiveTimers();
    setThreadOpened(false);
    setCompanyReplySent(false);
    setCandidateFollowupArrived(false);
    setThreadMessages([]);
    setThreadStatus('pending');
    setThreadCurrentTurn('company');
    setThreadDeadlineAt(createDeadlineAt(24));

    firstCandidateTimerRef.current = window.setTimeout(() => {
      const baseMessage = createMessage('candidate', copy.candidateSignalOne, [
        { name: candidateProfile.cvFilename, url: '', kind: 'document' },
        { name: candidateProfile.auditFilename, url: '', kind: 'document' },
        { name: candidateProfile.jcfpmFilename, url: '', kind: 'document' },
      ]);
      setThreadMessages([baseMessage]);
      setThreadOpened(true);
    }, 650);

    return () => clearActiveTimers();
  }, [candidateProfile, clearActiveTimers, copy.candidateSignalOne, createMessage, step]);

  const fetchDemoMessages = useCallback(async () => threadMessages, [threadMessages]);

  const sendDemoMessage = useCallback(
    async (_dialogueId: string, payload: DialogueMessageCreatePayload) => {
      const body = String(payload.body || '').trim();
      const outgoingAttachments = Array.isArray(payload.attachments) ? payload.attachments : [];
      if (!body && outgoingAttachments.length === 0) return null;

      const companyMessage = createMessage('recruiter', body, outgoingAttachments);
      setThreadMessages((current) => [...current, companyMessage]);
      setCompanyReplySent(true);
      setThreadStatus('reviewed');
      setThreadCurrentTurn('candidate');
      setThreadDeadlineAt(createDeadlineAt(24));
      safeTrack('demo_company_handshake_first_reply_sent', {
        message_length: body.length,
        thread_id: threadIdRef.current,
      });

      if (candidateFollowupTimerRef.current) {
        window.clearTimeout(candidateFollowupTimerRef.current);
        candidateFollowupTimerRef.current = null;
      }

      candidateFollowupTimerRef.current = window.setTimeout(() => {
        setThreadMessages((current) => [
          ...current,
          createMessage('candidate', copy.candidateFollowup, [
            {
              name: candidateProfile.pilotPlanFilename,
              url: '',
              kind: 'document',
            },
          ]),
        ]);
        setCandidateFollowupArrived(true);
        setThreadStatus('shortlisted');
        setThreadCurrentTurn('company');
        setThreadDeadlineAt(createDeadlineAt(48));
      }, 1100);

      return companyMessage;
    },
    [candidateProfile.pilotPlanFilename, copy.candidateFollowup, createMessage, safeTrack],
  );

  const handleRestart = () => {
    safeTrack('demo_company_handshake_cta_clicked', { cta_type: 'restart_demo' });
    clearActiveTimers();
    startedAtRef.current = Date.now();
    completedTrackedRef.current = false;
    threadIdRef.current = createDemoThreadId();
    setCandidateProfile(createDemoCandidateProfile(isCsLike));
    setStep('role_canvas');
    setThreadOpened(false);
    setCompanyReplySent(false);
    setCandidateFollowupArrived(false);
    setThreadMessages([]);
    setThreadStatus('pending');
    setThreadCurrentTurn('company');
    setThreadDeadlineAt(createDeadlineAt(24));
  };

  const openRegister = () => {
    safeTrack('demo_company_handshake_cta_clicked', { cta_type: 'register' });
    onRegister?.();
  };

  const backToLanding = () => {
    safeTrack('demo_company_handshake_cta_clicked', { cta_type: 'back_to_company_landing' });
    onBackToCompanyLanding?.();
  };

  const stepIndex = useMemo(() => {
    const order: DemoCompanyStep[] = ['role_canvas', 'incoming_candidate', 'company_reply', 'completed'];
    return order.indexOf(step) + 1;
  }, [step]);

  const statusText = candidateFollowupArrived
    ? copy.statusReady
    : companyReplySent
      ? copy.statusCandidateTurn
      : copy.statusCompanyTurn;

  const progress = [
    { key: 'p1', label: copy.progressOne, done: threadOpened },
    { key: 'p2', label: copy.progressTwo, done: companyReplySent },
    { key: 'p3', label: copy.progressThree, done: candidateFollowupArrived },
  ];

  return (
    <div className="col-span-1 lg:col-span-12 h-full overflow-y-auto custom-scrollbar px-1">
      <section className="mx-auto w-full max-w-6xl rounded-[1.4rem] border border-slate-200/80 dark:border-slate-800 bg-white/86 dark:bg-slate-900/70 p-5 lg:p-7 shadow-[0_22px_50px_-40px_rgba(15,23,42,0.38)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/70 dark:border-cyan-800 bg-cyan-50/80 dark:bg-cyan-900/25 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-700 dark:text-cyan-300">
            <Sparkles size={12} />
            {copy.badge}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 dark:border-slate-700 bg-white/70 dark:bg-slate-950/40 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            <Clock3 size={12} />
            2-3 min
          </div>
        </div>

        <h1 className="mt-4 text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {copy.title}
        </h1>
        <p className="mt-2 text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
          {copy.subtitle}
        </p>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            ['role_canvas', copy.stepRole],
            ['incoming_candidate', copy.stepCandidate],
            ['company_reply', copy.stepCompany],
            ['completed', copy.stepDone],
          ].map(([key, label], index) => {
            const reached = index < stepIndex;
            return (
              <div
                key={key}
                className={`rounded-lg border px-2.5 py-2 text-xs font-semibold ${
                  reached
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/30 text-slate-500 dark:text-slate-400'
                }`}
              >
                {label}
              </div>
            );
          })}
        </div>
      </section>

      {step === 'role_canvas' && (
        <section className="mx-auto mt-4 w-full max-w-6xl rounded-[1.2rem] border border-slate-200/80 dark:border-slate-800 bg-white/88 dark:bg-slate-900/66 p-5 lg:p-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/80 dark:bg-cyan-950/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
              <Briefcase size={12} />
              {copy.roleLabel}
            </div>
            <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">{copy.roleTitle}</h3>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{copy.roleCompany}</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-950/35 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                {copy.roleLocation}
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/85 dark:bg-slate-950/35 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
                {copy.roleSalary}
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{copy.roleSummary}</p>
            <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/80 dark:bg-amber-950/20 px-3 py-2.5">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">
                {copy.roleTruthTitle}
              </div>
              <ul className="mt-1.5 space-y-1.5 text-sm text-amber-950 dark:text-amber-100">
                {copy.roleTruthItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('incoming_candidate')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-400 transition-colors"
          >
            {copy.roleContinue}
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      {step === 'incoming_candidate' && (
        <section className="mx-auto mt-4 w-full max-w-6xl rounded-[1.2rem] border border-slate-200/80 dark:border-slate-800 bg-white/88 dark:bg-slate-900/66 p-5 lg:p-6">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            <UserRound size={14} />
            {copy.incomingBadge}
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{copy.incomingTitle}</h2>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/35 p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {copy.candidateSignalOne}
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/35 p-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {copy.candidateSignalTwo}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-cyan-200 dark:border-cyan-900/40 bg-cyan-50/70 dark:bg-cyan-950/20 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">{copy.candidatePacket}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[candidateProfile.cvFilename, candidateProfile.auditFilename, candidateProfile.jcfpmFilename].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-cyan-200/80 dark:border-cyan-900/50 bg-white/90 dark:bg-slate-900/55 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  {item}
                </span>
              ))}
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-cyan-200/70 dark:border-cyan-900/40 bg-white/80 dark:bg-slate-900/45 p-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
                  {copy.candidateCvPreviewTitle}
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {copy.candidateNameLabel}: {candidateProfile.name}
                </div>
                <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  {candidateProfile.title} · {candidateProfile.yearsExperience} {copy.yearUnit}
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  {copy.candidateExperienceLabel}
                </div>
                <ul className="mt-1.5 space-y-1 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  {candidateProfile.experiences.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-cyan-200/70 dark:border-cyan-900/40 bg-white/80 dark:bg-slate-900/45 p-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
                  {copy.candidateJcfpmPreviewTitle}
                </div>
                <div className="mt-1 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  {candidateProfile.jcfpmSummary}
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  {copy.candidateTraitsLabel}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {candidateProfile.jcfpmTraits.map((trait) => (
                    <span
                      key={trait.label}
                      className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100/90 dark:bg-slate-800/60 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200"
                    >
                      {trait.label}: {trait.score}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  {copy.candidateRiskLabel}
                </div>
                <div className="mt-1 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  {candidateProfile.jcfpmRisk}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('company_reply')}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-400 transition-colors"
          >
            {copy.incomingContinue}
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      {step === 'company_reply' && (
        <section className="mx-auto mt-4 w-full max-w-6xl rounded-[1.2rem] border border-slate-200/80 dark:border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.08),_transparent_36%),linear-gradient(180deg,_rgba(255,255,255,0.9),_rgba(248,250,252,0.84))] dark:bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.12),_transparent_36%),linear-gradient(180deg,_rgba(15,23,42,0.82),_rgba(2,6,23,0.74))] p-5 lg:p-6">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {copy.companyReplyBadge}
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{copy.companyReplyTitle}</h2>

          <div className="mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-3">
            <aside className="space-y-3">
              <div className="rounded-[1rem] border border-sky-200/80 dark:border-sky-900/40 bg-sky-50/75 dark:bg-sky-950/20 px-4 py-3.5">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
                  {copy.statusLabel}
                </div>
                <div className="mt-1.5 text-sm md:text-base font-semibold text-slate-900 dark:text-slate-100">
                  {statusText}
                </div>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  {threadCurrentTurn === 'candidate' ? '24 h' : '48 h'}
                </div>
              </div>

              <div className="rounded-[1rem] border border-slate-200/80 dark:border-slate-700 bg-white/85 dark:bg-slate-950/30 px-4 py-3.5">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {copy.progressTitle}
                </div>
                <div className="mt-2 space-y-2">
                  {progress.map((item) => (
                    <div key={item.key} className="flex items-start gap-2">
                      <CheckCircle2
                        size={15}
                        className={item.done ? 'mt-0.5 text-emerald-600 dark:text-emerald-300' : 'mt-0.5 text-slate-400 dark:text-slate-500'}
                      />
                      <div>
                        <div className={`text-sm ${item.done ? 'text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}`}>
                          {item.label}
                        </div>
                        <div className={`text-[11px] ${item.done ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
                          {item.done ? copy.progressDone : copy.progressPending}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1rem] border border-amber-200/70 bg-[linear-gradient(160deg,_rgba(255,251,235,0.95),_rgba(255,255,255,0.86))] px-3.5 py-3.5 shadow-[0_18px_34px_-30px_rgba(120,53,15,0.35)] dark:border-amber-900/40 dark:bg-[linear-gradient(160deg,_rgba(69,26,3,0.35),_rgba(15,23,42,0.72))]">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">{copy.threadLabel}</div>
                <div className="mt-1 font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {threadIdRef.current}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {copy.threadHint}
                </div>
              </div>
            </aside>

            <div className="space-y-3">
              {!threadOpened && (
                <div className="rounded-[0.95rem] border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
                  <span className="inline-block h-2 w-2 rounded-full bg-sky-500 animate-pulse mr-2" />
                  {copy.threadLoading}
                </div>
              )}
              {threadOpened && !companyReplySent && (
                <div className="rounded-[0.95rem] border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-800 dark:border-cyan-900/40 dark:bg-cyan-950/20 dark:text-cyan-300">
                  {copy.prefilledNotice}
                </div>
              )}
              {companyReplySent && !candidateFollowupArrived && (
                <div className="rounded-[0.95rem] border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
                  {copy.waitingCandidateNotice}
                </div>
              )}
              {candidateFollowupArrived && (
                <div className="rounded-[0.95rem] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                  {copy.candidateReturnedNotice}
                </div>
              )}

              <ApplicationMessageCenter
                dialogueId={threadIdRef.current}
                applicationId={threadIdRef.current}
                viewerRole="recruiter"
                visualVariant="immersive"
                dialogueStatus={threadStatus}
                dialogueDeadlineAt={threadDeadlineAt}
                dialogueTimeoutHours={48}
                dialogueCurrentTurn={threadCurrentTurn}
                dialogueClosedReason={null}
                dialogueIsOverdue={false}
                heading={copy.threadHeading}
                subtitle={copy.threadSubtitle}
                emptyText={copy.threadEmpty}
                initialDraft={copy.prefilledCompanyReply}
                composerPlaceholder={copy.composerPlaceholder}
                sendButtonLabel={copy.sendButton}
                allowAttachments={false}
                showAttachmentPlaceholderWhenDisabled
                fetchMessages={fetchDemoMessages}
                sendMessage={sendDemoMessage}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep('completed')}
            disabled={!candidateFollowupArrived}
            className={`mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              candidateFollowupArrived
                ? 'bg-orange-500 text-white hover:bg-orange-400'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 cursor-not-allowed'
            }`}
          >
            {copy.nextStepButton}
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      {step === 'completed' && (
        <section className="mx-auto mt-4 mb-2 w-full max-w-6xl rounded-[1.2rem] border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-emerald-950/20 p-5 lg:p-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/35 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={20} />
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">{copy.completedTitle}</h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{copy.completedBody}</p>

          <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={openRegister}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 dark:bg-white px-4 py-2.5 text-sm font-bold text-white dark:text-slate-950"
            >
              {copy.completedPrimary}
            </button>
            <button
              type="button"
              onClick={backToLanding}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-950/35 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              {copy.completedSecondary}
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300"
            >
              {copy.completedRestart}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default DemoCompanyHandshakePage;
