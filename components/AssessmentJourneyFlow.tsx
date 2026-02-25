import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Assessment,
  AssessmentJourneyBehavioralConsistency,
  AssessmentJourneyCulturalOrientation,
  AssessmentJourneyDecisionPattern,
  AssessmentJourneyEnergyBalance,
  AssessmentJourneyFinalProfile,
  AssessmentJourneyPayloadV1,
  AssessmentMode,
  AssessmentSignalFrame,
} from '../types';
import { BACKEND_URL, FEATURE_ASSESSMENT_THREE } from '../constants';
import { supabase, trackAnalyticsEvent } from '../services/supabaseService';
import { readAssessmentDraft, writeAssessmentDraft } from '../services/assessmentSessionState';
import { fetchJourneyAnalyzeAnswer, fetchJourneyFinalize } from '../services/assessmentJourneyService';
import { buildLocalSignalFrame, fetchRealtimeSignals } from '../services/assessmentThreeService';
import { useSceneCapability } from '../hooks/useSceneCapability';
import SceneShell from './three/SceneShell';
import JourneyBackdropScene from './three/JourneyBackdropScene';
import JourneyPathMapScene from './three/JourneyPathMapScene';
import AssessmentCockpitLayout from './assessment-cockpit/AssessmentCockpitLayout';

interface Props {
  assessment: Assessment;
  invitationId: string;
  onComplete: (resultId: string) => void;
  mode?: 'taker' | 'preview';
  invitationToken?: string;
  submitViaBackend?: boolean;
  embedded?: boolean;
  assessmentMode?: AssessmentMode;
  modeSwitchCount?: number;
  modeSwitchTimestamps?: string[];
}

const EXPERIENCE_META = {
  experience_style: 'adventure_v1',
  pace_mode: 'gentle',
  role_personalization: 'strong',
} as const;

const hashId = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash));
};

type DemoDomain = 'backend' | 'cnc' | 'nurse' | 'sales' | 'support' | 'generic';

const inferDemoDomain = (
  question: Assessment['questions'][number],
  assessmentRole?: string
): DemoDomain => {
  const qid = (question.id || '').toLowerCase();
  if (qid.startsWith('be')) return 'backend';
  if (qid.startsWith('cnc')) return 'cnc';
  if (qid.startsWith('nur')) return 'nurse';
  if (qid.startsWith('sal')) return 'sales';
  if (qid.startsWith('cs')) return 'support';

  const haystack = `${assessmentRole || ''} ${question.text || ''}`.toLowerCase();
  if (/(backend|developer|software|api|data|engineer|devops|cloud|program)/.test(haystack)) return 'backend';
  if (/(cnc|stroj|výroba|operator|operátor|obrábění|tolerance|nástroj)/.test(haystack)) return 'cnc';
  if (/(nurse|sestr|zdravot|pacient|klin|triáž|urgent|léka)/.test(haystack)) return 'nurse';
  if (/(sales|obchod|pipeline|lead|crm|deal|prospecting|vyjedn)/.test(haystack)) return 'sales';
  if (/(support|ticket|incident|zákazník|eskal|sla|helpdesk)/.test(haystack)) return 'support';
  return 'generic';
};

const demoAnswersByDomain: Record<DemoDomain, string[]> = {
  backend: [
    'Nejdřív si vyjasním SLA a rizika, potom navrhnu API kontrakt s verzováním a fallbackem, aby změna nerozbila klienty.',
    'Postup rozdělím na rychlou stabilizaci a následnou optimalizaci: metriky, tracing, bottleneck, cílený fix a ověření dopadu.',
    'U citlivých dat držím minimální logování, maskování PII a audit trail, aby bylo řešení bezpečné i dohledatelné.',
  ],
  cnc: [
    'Začnu kontrolou výkresu, upnutí, nulových bodů a nástroje. První kus přeměřím a až pak pustím sérii.',
    'Při odchylce mimo toleranci zastavím výrobu, ověřím příčinu, upravím korekce a udělám nové kontrolní měření.',
    'Bezpečnost má prioritu: při nestabilitě stroje nebo riziku okamžitě stop, zajištění pracoviště a teprve pak restart dle postupu.',
  ],
  nurse: [
    'V urgentu triážuji podle klinické závažnosti a vitálních funkcí, nejdřív řeším život ohrožující stavy.',
    'Kritické informace předávám strukturovaně přes SBAR, aby tým měl jasný stav, riziko i další krok bez prodlevy.',
    'U medikace držím identifikaci pacienta, kontrolu 5P a okamžitou dokumentaci, aby byla péče bezpečná a dohledatelná.',
  ],
  sales: [
    'Nejdřív dělám discovery: problém, dopad, rozhodovatelé a timeline. Teprve potom volím nabídku a další krok.',
    'Při námitce na cenu vracím debatu k hodnotě a ROI, navrhnu varianty a jasně potvrdím next step v CRM.',
    'Když deal stagnuje, revaliduji kvalifikaci, zapojím decision makera a nastavím konkrétní plán obnovy s termíny.',
  ],
  support: [
    'Prioritu ticketu určím podle business dopadu, SLA rizika a rozsahu incidentu, ne jen podle tónu zprávy.',
    'Se zákazníkem komunikuji klidně a konkrétně: co víme, co děláme teď, kdy dáme další update a jaká je dočasná cesta.',
    'Před eskalací připravím reprodukci, logy, kroky a očekávané chování, aby L2/L3 mohli okamžitě pokračovat.',
  ],
  generic: [
    'Nejdřív si vyjasním cíl a priority, potom popíšu konkrétní postup krok za krokem a ověřím výsledek.',
    'V nejistotě volím bezpečný první krok, průběžně sbírám data a podle nich upravuji další rozhodnutí.',
    'Držím jasnou komunikaci: co je riziko, co je rozhodnutí teď a co bude následovat.',
  ],
};

const demoAnswerForQuestion = (
  question: Assessment['questions'][number],
  index: number,
  assessmentRole?: string
): string => {
  if (question.type === 'MultipleChoice' && question.options?.length) {
    if (question.correctAnswer && question.options.includes(question.correctAnswer)) {
      return question.correctAnswer;
    }
    return question.options[0];
  }
  const domain = inferDemoDomain(question, assessmentRole);
  const variants = demoAnswersByDomain[domain];
  return variants[index % variants.length];
};

const initialDecisionPattern: AssessmentJourneyDecisionPattern = {
  structured_vs_improv: 50,
  risk_tolerance: 50,
  sequential_vs_parallel: 50,
  stakeholder_orientation: 50,
  uncertainty_markers: [],
};

const initialConsistency: AssessmentJourneyBehavioralConsistency = {
  recurring_motifs: [],
  consistency_pairs: [],
  preference_scenario_tensions: [],
};

const initialEnergy: AssessmentJourneyEnergyBalance = {
  enthusiasm_markers: [],
  exhaustion_markers: [],
  must_vs_want_ratio: 1,
  locus_of_control: 'mixed',
  monthly_energy_hours_left: 80,
};

const initialCulture: AssessmentJourneyCulturalOrientation = {
  transparency: '',
  conflict_response: '',
  hierarchy_vs_autonomy: '',
  process_vs_outcome: '',
  stability_vs_dynamics: '',
};

const initialProfile: AssessmentJourneyFinalProfile = {
  transferable_strengths: [],
  risk_zones: [],
  amplify_environments: [],
  drain_environments: [],
};

type ResponseQualityCheckpoint = {
  checkpoint_index: number;
  answer_depth: number;
  specificity: number;
  decisiveness: number;
  consistency_hint: number;
  dominant_zone: 'focus' | 'collab' | 'speed' | 'quality';
  notes: string[];
  at: string;
};

type PersonalityAxis = 'EI' | 'SN' | 'TF' | 'JP';
type PersonalityPulseChoice = -1 | 1;
type PersonalityPulseItem = {
  id: string;
  axis: PersonalityAxis;
  prompt: string;
  leftLabel: string;
  rightLabel: string;
  leftTrait: string;
  rightTrait: string;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const defaultSignalFrame = (): AssessmentSignalFrame => buildLocalSignalFrame([], [], 48);
const ensureSignalFrame = (frame: Partial<AssessmentSignalFrame> | null | undefined): AssessmentSignalFrame => ({
  timestamp: frame?.timestamp || new Date().toISOString(),
  unlocked_skills: Array.isArray(frame?.unlocked_skills) ? frame.unlocked_skills : [],
  narrative_integrity: typeof frame?.narrative_integrity === 'number' ? frame.narrative_integrity : 48,
  confidence: typeof frame?.confidence === 'number' ? frame.confidence : 48,
  evidence: Array.isArray(frame?.evidence) ? frame.evidence : [],
});

const summarizeQualityCheckpoints = (qualityCheckpoints: ResponseQualityCheckpoint[]) => {
  if (qualityCheckpoints.length === 0) {
    return {
      signal_quality: 0,
      consistency_index: 0,
      response_depth_avg: 0,
      follow_up_flags: [] as string[],
    };
  }
  const avg = (values: number[]) => Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
  const signalQuality = avg(qualityCheckpoints.map((x) => Math.round((x.answer_depth + x.specificity + x.decisiveness) / 3)));
  const consistencyIndex = avg(qualityCheckpoints.map((x) => x.consistency_hint));
  const responseDepthAvg = avg(qualityCheckpoints.map((x) => x.answer_depth));
  const flags = Array.from(new Set(qualityCheckpoints.flatMap((x) => x.notes)));
  return {
    signal_quality: signalQuality,
    consistency_index: consistencyIndex,
    response_depth_avg: responseDepthAvg,
    follow_up_flags: flags,
  };
};

const personalityPulseItems: PersonalityPulseItem[] = [
  { id: 'ei_1', axis: 'EI', prompt: 'Po náročném dni dobíjím energii spíš…', leftLabel: 'V klidu o samotě', rightLabel: 'S lidmi / v akci', leftTrait: 'I', rightTrait: 'E' },
  { id: 'ei_2', axis: 'EI', prompt: 'Při důležitém rozhodnutí nejdřív…', leftLabel: 'Promyslím interně', rightLabel: 'Mluvím nahlas s týmem', leftTrait: 'I', rightTrait: 'E' },
  { id: 'sn_1', axis: 'SN', prompt: 'V zadání mě první zajímá…', leftLabel: 'Konkrétní fakta a detaily', rightLabel: 'Směr, možnosti a vize', leftTrait: 'S', rightTrait: 'N' },
  { id: 'sn_2', axis: 'SN', prompt: 'Při změně preferuji…', leftLabel: 'Ověřený postup', rightLabel: 'Experiment a nové cesty', leftTrait: 'S', rightTrait: 'N' },
  { id: 'tf_1', axis: 'TF', prompt: 'V konfliktu dávám prioritu…', leftLabel: 'Logice a konzistenci', rightLabel: 'Dopadu na lidi', leftTrait: 'T', rightTrait: 'F' },
  { id: 'tf_2', axis: 'TF', prompt: 'Při zpětné vazbě jsem spíš…', leftLabel: 'Přímočarý a věcný', rightLabel: 'Empatický a citlivý', leftTrait: 'T', rightTrait: 'F' },
  { id: 'jp_1', axis: 'JP', prompt: 'V práci mě uklidní víc…', leftLabel: 'Jasný plán a deadline', rightLabel: 'Flexibilita a prostor', leftTrait: 'J', rightTrait: 'P' },
  { id: 'jp_2', axis: 'JP', prompt: 'Tempo realizace volím…', leftLabel: 'Postupně a strukturovaně', rightLabel: 'Adaptivně podle situace', leftTrait: 'J', rightTrait: 'P' },
];

const AssessmentJourneyFlow: React.FC<Props> = ({
  assessment,
  invitationId,
  onComplete,
  mode = 'taker',
  invitationToken,
  submitViaBackend = false,
  embedded = false,
  assessmentMode = 'classic',
  modeSwitchCount = 0,
  modeSwitchTimestamps = [],
}) => {
  const { t, i18n } = useTranslation();
  const sceneCapability = useSceneCapability();
  const aiDisclaimer = t('assessment_journey.disclaimer', {
    defaultValue: 'AI pomáhá číst vzorce. Vaše rozhodnutí a tempo zůstává plně ve vašich rukou.',
  });
  const roleLabel = assessment.role || t('invitation_landing.default_role', { defaultValue: 'Kandidát' });
  const roleMood = useMemo(() => {
    const role = (roleLabel || '').toLowerCase();
    const healthcare = /(health|medical|nurse|doctor|clinic|hospital|zdravot|léka|sestr|pece|péče|social|sociální)/.test(role);
    const finance = /(finance|finan|bank|audit|account|controller|investment|risk|treasury|účet|dan|tax)/.test(role);
    const tech = /(engineer|developer|software|it|data|cloud|devops|backend|frontend|tech|program|ai|ml)/.test(role);

    if (healthcare) {
      return {
        sceneSkin: 'healing' as const,
        root: 'bg-[radial-gradient(circle_at_18%_16%,rgba(186,230,253,0.24),transparent_46%),radial-gradient(circle_at_75%_18%,rgba(125,211,252,0.16),transparent_44%),linear-gradient(180deg,#f8fafc,#f8fafc_52%,#f1f5f9)] dark:bg-[radial-gradient(circle_at_18%_16%,rgba(56,189,248,0.1),transparent_46%),radial-gradient(circle_at_75%_18%,rgba(103,232,249,0.07),transparent_44%),linear-gradient(180deg,#020617,#0b1220_52%,#020617)]',
        accent: 'text-slate-700 dark:text-slate-200',
        cta: 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900',
        active: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600',
        sceneToggle: 'rounded-full border border-slate-300/80 dark:border-slate-600/60 bg-white/80 dark:bg-slate-900/70 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-100',
        trail: '#7dd3fc',
        node: '#38bdf8',
        activeNode: '#0ea5e9',
      };
    }
    if (finance) {
      return {
        sceneSkin: 'finance' as const,
        root: 'bg-[radial-gradient(circle_at_18%_16%,rgba(221,214,254,0.2),transparent_46%),radial-gradient(circle_at_75%_18%,rgba(196,181,253,0.14),transparent_44%),linear-gradient(180deg,#f8fafc,#f8fafc_52%,#f1f5f9)] dark:bg-[radial-gradient(circle_at_18%_16%,rgba(139,92,246,0.1),transparent_46%),radial-gradient(circle_at_75%_18%,rgba(167,139,250,0.07),transparent_44%),linear-gradient(180deg,#020617,#111327_52%,#020617)]',
        accent: 'text-slate-700 dark:text-slate-200',
        cta: 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900',
        active: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600',
        sceneToggle: 'rounded-full border border-slate-300/80 dark:border-slate-600/60 bg-white/80 dark:bg-slate-900/70 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-100',
        trail: '#c4b5fd',
        node: '#a78bfa',
        activeNode: '#8b5cf6',
      };
    }
    if (tech) {
      return {
        sceneSkin: 'tech' as const,
        root: 'bg-[radial-gradient(circle_at_18%_16%,rgba(191,219,254,0.22),transparent_46%),radial-gradient(circle_at_75%_18%,rgba(147,197,253,0.14),transparent_44%),linear-gradient(180deg,#f8fafc,#f8fafc_52%,#f1f5f9)] dark:bg-[radial-gradient(circle_at_18%_16%,rgba(59,130,246,0.11),transparent_46%),radial-gradient(circle_at_75%_18%,rgba(125,211,252,0.06),transparent_44%),linear-gradient(180deg,#020617,#0b1528_52%,#020617)]',
        accent: 'text-slate-700 dark:text-slate-200',
        cta: 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900',
        active: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600',
        sceneToggle: 'rounded-full border border-slate-300/80 dark:border-slate-600/60 bg-white/80 dark:bg-slate-900/70 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-100',
        trail: '#93c5fd',
        node: '#60a5fa',
        activeNode: '#3b82f6',
      };
    }
    return {
      sceneSkin: 'garden' as const,
      root: 'bg-[radial-gradient(circle_at_20%_18%,rgba(167,243,208,0.16),transparent_48%),radial-gradient(circle_at_75%_16%,rgba(191,219,254,0.14),transparent_45%),linear-gradient(180deg,#f8fafc,#f8fafc_52%,#f1f5f9)] dark:bg-[radial-gradient(circle_at_20%_18%,rgba(16,185,129,0.08),transparent_48%),radial-gradient(circle_at_75%_16%,rgba(56,189,248,0.07),transparent_45%),linear-gradient(180deg,#020617,#0b1220_52%,#020617)]',
      accent: 'text-slate-700 dark:text-slate-200',
      cta: 'bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900',
      active: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600',
      sceneToggle: 'rounded-full border border-slate-300/80 dark:border-slate-600/60 bg-white/80 dark:bg-slate-900/70 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-100',
      trail: '#6ee7b7',
      node: '#34d399',
      activeNode: '#10b981',
    };
  }, [roleLabel]);

  const [startedAt] = useState<string>(() => new Date().toISOString());
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [psychometric, setPsychometric] = useState<Record<string, number>>({});
  const [microInsights, setMicroInsights] = useState<Array<{ phase: 1 | 2 | 3 | 4 | 5; text: string; insight_type: string; at: string }>>([]);
  const [phaseEvents, setPhaseEvents] = useState<Array<{ phase: 1 | 2 | 3 | 4 | 5; event: string; at: string }>>([]);
  const [decisionPattern, setDecisionPattern] = useState<AssessmentJourneyDecisionPattern>(initialDecisionPattern);
  const [behavioralConsistency, setBehavioralConsistency] = useState<AssessmentJourneyBehavioralConsistency>(initialConsistency);
  const [energyBalance, setEnergyBalance] = useState<AssessmentJourneyEnergyBalance>(initialEnergy);
  const [culturalOrientation, setCulturalOrientation] = useState<AssessmentJourneyCulturalOrientation>(initialCulture);
  const [finalProfile, setFinalProfile] = useState<AssessmentJourneyFinalProfile>(initialProfile);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [confidenceLevel] = useState(58);
  const [businessImpactLevel] = useState(62);
  const [stakeholderAlignmentLevel] = useState(54);
  const [phaseTwoStep, setPhaseTwoStep] = useState<'question' | 'task'>('question');
  const [streakCount, setStreakCount] = useState(0);
  const [microReward, setMicroReward] = useState<string>('');
  const [practicalOrder, setPracticalOrder] = useState<string[]>([
    'Stabilizovat situaci',
    'Zarovnat stakeholdery',
    'Definovat další iteraci',
  ]);
  const [placementZone, setPlacementZone] = useState<'focus' | 'collab' | 'speed' | 'quality'>('focus');
  const [qualityCheckpoints, setQualityCheckpoints] = useState<ResponseQualityCheckpoint[]>([]);
  const [strategyChoice, setStrategyChoice] = useState<string>('');
  const [signalChoices, setSignalChoices] = useState<string[]>([]);
  const [taskNote, setTaskNote] = useState<string>('');
  const [resourceSplit, setResourceSplit] = useState<{ stability: number; speed: number; quality: number }>({
    stability: 4,
    speed: 3,
    quality: 3,
  });
  const [firstMove, setFirstMove] = useState<string>('');
  const [secondMove, setSecondMove] = useState<string>('');
  const [personalityPulseAnswers, setPersonalityPulseAnswers] = useState<Record<string, PersonalityPulseChoice>>({});

  const questions = assessment.questions;
  const checkpointLabels = [
    t('assessment_journey.checkpoint_1', { defaultValue: 'Bezpečný start' }),
    t('assessment_journey.checkpoint_2', { defaultValue: 'Zrcadlení vzorců' }),
    t('assessment_journey.checkpoint_3', { defaultValue: 'Energetický kompas' }),
    t('assessment_journey.checkpoint_4', { defaultValue: 'Kulturní Northstar' }),
    t('assessment_journey.checkpoint_5', { defaultValue: 'Souhrnný profil' }),
  ];
  const cockpitThreeEnabled = FEATURE_ASSESSMENT_THREE;
  const [showCockpitScene, setShowCockpitScene] = useState(() => cockpitThreeEnabled);
  const [liveSignalFrame, setLiveSignalFrame] = useState<AssessmentSignalFrame>(() => defaultSignalFrame());

  const northstarAxisScores = useMemo(() => {
    const byAxis: Record<PersonalityAxis, number[]> = { EI: [], SN: [], TF: [], JP: [] };
    personalityPulseItems.forEach((item) => {
      const value = personalityPulseAnswers[item.id];
      if (typeof value === 'number') {
        byAxis[item.axis].push(value);
      }
    });
    const toRightPercent = (values: number[]) => {
      if (values.length === 0) return 50;
      const avg = values.reduce((sum, x) => sum + x, 0) / values.length;
      return clamp(Math.round((avg + 1) * 50), 0, 100);
    };
    return {
      EI: toRightPercent(byAxis.EI),
      SN: toRightPercent(byAxis.SN),
      TF: toRightPercent(byAxis.TF),
      JP: toRightPercent(byAxis.JP),
    };
  }, [personalityPulseAnswers]);

  const northstarCompleted = useMemo(
    () => personalityPulseItems.every((item) => typeof personalityPulseAnswers[item.id] === 'number'),
    [personalityPulseAnswers]
  );

  const basicPersonalityCode = useMemo(() => {
    const letter = (axis: PersonalityAxis, left: string, right: string) =>
      northstarAxisScores[axis] >= 50 ? right : left;
    return `${letter('EI', 'I', 'E')}${letter('SN', 'S', 'N')}${letter('TF', 'T', 'F')}${letter('JP', 'J', 'P')}`;
  }, [northstarAxisScores]);

  const theme = {
    root: `relative text-slate-900 dark:text-slate-100 ${roleMood.root}`,
    card: 'bg-white/18 dark:bg-slate-950/28 border-transparent shadow-none',
    phaseActive: roleMood.active,
    phaseIdle: 'bg-white/65 dark:bg-slate-950/65 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300',
    cta: roleMood.cta,
    accent: roleMood.accent,
    sceneFrame: 'fixed inset-0 z-0 overflow-hidden pointer-events-none',
    sceneToggle: roleMood.sceneToggle,
  };

  useEffect(() => {
    if (mode === 'preview') {
      const seeded: Record<string, string> = {};
      assessment.questions.forEach((q, idx) => {
        seeded[q.id] = demoAnswerForQuestion(q, idx, assessment.role);
      });
      setAnswers(seeded);
      setPersonalityPulseAnswers((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        const seededPulse: Record<string, PersonalityPulseChoice> = {};
        personalityPulseItems.forEach((item, idx) => {
          seededPulse[item.id] = (idx % 2 === 0 ? 1 : -1);
        });
        return seededPulse;
      });
      return;
    }

    const draft = readAssessmentDraft(invitationId, assessment.id);
    if (!draft) return;
    if (draft.technical && Object.keys(draft.technical).length > 0) {
      setAnswers(draft.technical);
    }
    if (draft.psychometric && Object.keys(draft.psychometric).length > 0) {
      setPsychometric(draft.psychometric);
    }
  }, [mode, invitationId, assessment.id, assessment.questions]);

  useEffect(() => {
    setPsychometric((prev) => ({
      ...prev,
      personality_e_percent: northstarAxisScores.EI,
      personality_n_percent: northstarAxisScores.SN,
      personality_f_percent: northstarAxisScores.TF,
      personality_p_percent: northstarAxisScores.JP,
      personality_profile_ready: northstarCompleted ? 1 : 0,
    }));
  }, [northstarAxisScores, northstarCompleted]);

  useEffect(() => {
    if (mode === 'preview') return;
    const draftQualitySummary = summarizeQualityCheckpoints(qualityCheckpoints);
    writeAssessmentDraft(invitationId, assessment.id, {
      technical: answers,
      psychometric,
      journey_trace: {
        phase_events: phaseEvents,
        micro_insights: microInsights,
        mode_switches: [],
        response_quality: {
          checkpoints: qualityCheckpoints,
          summary: draftQualitySummary,
        },
      },
    });
  }, [mode, invitationId, assessment.id, answers, psychometric, phaseEvents, microInsights, qualityCheckpoints]);

  useEffect(() => {
    void trackAnalyticsEvent({
      event_type: 'assessment_journey_started',
      feature: 'assessment_journey',
      metadata: {
        mode: assessmentMode,
        locale: i18n.language,
        invitation_id_hash: hashId(invitationId),
        ...EXPERIENCE_META,
        checkpoint_index: 1,
        checkpoint_type: 'question',
      },
    });
  }, [assessmentMode, i18n.language, invitationId]);

  const currentQuestion = questions[index];
  const currentAnswer = currentQuestion ? (answers[currentQuestion.id] || '') : '';
  const shouldShowTaskStep = index % 2 === 0;
  const practicalMissionCount = Math.ceil(questions.length / 2);
  const totalJourneySteps = questions.length + practicalMissionCount + 4;
  const currentJourneyStep = useMemo(() => {
    if (phase === 1) {
      const practicalBeforeCurrent = Math.ceil(index / 2);
      const base = index + 1 + practicalBeforeCurrent;
      return phaseTwoStep === 'task' && shouldShowTaskStep ? base + 1 : base;
    }
    if (phase === 2) return questions.length + practicalMissionCount + 1;
    if (phase === 3) return questions.length + practicalMissionCount + 2;
    if (phase === 4) return questions.length + practicalMissionCount + 3;
    return questions.length + practicalMissionCount + 4;
  }, [index, phase, phaseTwoStep, practicalMissionCount, questions.length, shouldShowTaskStep]);
  const taskVariant = index % 5;
  const taskTitle =
    taskVariant === 0
      ? t('assessment_journey.task_title_order', { defaultValue: 'Praktická mise: seřaďte kroky' })
      : taskVariant === 1
        ? t('assessment_journey.task_title_strategy', { defaultValue: 'Praktická mise: zvolte přístup' })
        : taskVariant === 2
          ? t('assessment_journey.task_title_signals', { defaultValue: 'Praktická mise: vyberte signály' })
          : taskVariant === 3
            ? t('assessment_journey.task_title_resources', { defaultValue: 'Praktická mise: rozdělte kapacitu' })
            : t('assessment_journey.task_title_sequence', { defaultValue: 'Praktická mise: zvolte první dva kroky' });
  const taskDescription =
    taskVariant === 0
      ? t('assessment_journey.task_desc_order', { defaultValue: 'Seřaďte kroky podle přirozené priority.' })
      : taskVariant === 1
        ? t('assessment_journey.task_desc_strategy', { defaultValue: 'Vyberte způsob, který byste zvolil/a v praxi.' })
        : taskVariant === 2
          ? t('assessment_journey.task_desc_signals', { defaultValue: 'Vyberte 1-2 signály, které byste sledoval/a nejdříve.' })
          : taskVariant === 3
            ? t('assessment_journey.task_desc_resources', { defaultValue: 'Rozdělte 10 bodů mezi stabilitu, rychlost a kvalitu.' })
            : t('assessment_journey.task_desc_sequence', { defaultValue: 'Vyberte první a druhý krok tak, jak byste postupoval/a.' });
  const taskReady =
    taskVariant === 0
      ? true
      : taskVariant === 1
        ? strategyChoice.length > 0
        : taskVariant === 2
          ? signalChoices.length > 0
          : taskVariant === 3
            ? resourceSplit.stability + resourceSplit.speed + resourceSplit.quality === 10
            : Boolean(firstMove && secondMove && firstMove !== secondMove);
  const energySnapshotLabel =
    energyBalance.monthly_energy_hours_left >= 90
      ? t('assessment_journey.energy_snapshot_high', { defaultValue: 'Vaše energie působí dlouhodobě stabilně.' })
      : energyBalance.monthly_energy_hours_left >= 60
        ? t('assessment_journey.energy_snapshot_mid', { defaultValue: 'Vaše energie je vyvážená, jen hlídejte pravidelný rytmus.' })
        : t('assessment_journey.energy_snapshot_low', { defaultValue: 'Stojí za to upravit tempo, aby energie zůstala udržitelná.' });

  const submittedAnswers = useMemo(
    () => questions.map((q) => String(answers[q.id] || '')).filter((x) => x.trim().length > 0),
    [questions, answers]
  );
  const qualitySummary = useMemo(() => summarizeQualityCheckpoints(qualityCheckpoints), [qualityCheckpoints]);
  const safeEvidence = liveSignalFrame?.evidence || [];
  const liveCultureMatch = useMemo(() => {
    const evidenceBoost = Math.min(16, safeEvidence.length * 3);
    return clamp(Math.round((stakeholderAlignmentLevel + qualitySummary.consistency_index) / 2 + evidenceBoost), 20, 99);
  }, [safeEvidence.length, qualitySummary.consistency_index, stakeholderAlignmentLevel]);

  useEffect(() => {
    if (assessmentMode !== 'game') return;
    const chunks = submittedAnswers.length > 0 ? submittedAnswers : Object.values(answers).filter((x) => x.trim().length > 0);
    const unlockedSkills = Array.from(new Set([
      ...qualityCheckpoints.map((cp) => cp.dominant_zone),
      ...microInsights.slice(-3).map((insight) => insight.insight_type),
    ]));
    const narrativeIntegrity = clamp(Math.round((qualitySummary.signal_quality + qualitySummary.consistency_index) / 2), 30, 96);

    let cancelled = false;
    const fallback = buildLocalSignalFrame(chunks, unlockedSkills, narrativeIntegrity);
    setLiveSignalFrame(ensureSignalFrame(fallback));

    if (chunks.length === 0) return;

    const timer = window.setTimeout(async () => {
      try {
        const remote = await fetchRealtimeSignals(chunks, unlockedSkills, narrativeIntegrity);
        if (!cancelled) {
          setLiveSignalFrame(ensureSignalFrame(remote?.merged_frame || remote?.frames?.[0]));
        }
      } catch {
        if (!cancelled) {
          setLiveSignalFrame(ensureSignalFrame(fallback));
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [assessmentMode, submittedAnswers, answers, qualityCheckpoints, microInsights, qualitySummary.signal_quality, qualitySummary.consistency_index]);

  const emitCheckpointStarted = (checkpointType: 'question' | 'task') => {
    void trackAnalyticsEvent({
      event_type: 'assessment_journey_checkpoint_started',
      feature: 'assessment_journey',
      metadata: {
        ...EXPERIENCE_META,
        checkpoint_index: index + 1,
        checkpoint_type: checkpointType,
        phase,
      },
    });
  };

  const emitCheckpointCompleted = (checkpointType: 'question' | 'task', streak: number) => {
    void trackAnalyticsEvent({
      event_type: 'assessment_journey_checkpoint_completed',
      feature: 'assessment_journey',
      metadata: {
        ...EXPERIENCE_META,
        checkpoint_index: index + 1,
        checkpoint_type: checkpointType,
        phase,
        streak_count: streak,
      },
    });
  };

  useEffect(() => {
    emitCheckpointStarted('question');
    // We intentionally emit only once for the initial checkpoint start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proceedTo = (nextPhase: 1 | 2 | 3 | 4 | 5, event: string) => {
    const at = new Date().toISOString();
    setPhase(nextPhase);
    setPhaseEvents((prev) => [...prev, { phase: nextPhase, event, at }]);
    void trackAnalyticsEvent({
      event_type: 'assessment_journey_phase_completed',
      feature: 'assessment_journey',
      metadata: { phase: nextPhase, event, ...EXPERIENCE_META },
    });
  };

  const handleAnalyzeAnswer = async (answerText: string, zoneOverride?: 'focus' | 'collab' | 'speed' | 'quality') => {
    const answersSoFar = submittedAnswers;
    const res = await fetchJourneyAnalyzeAnswer({
      phase,
      question_text: currentQuestion?.text || '',
      answer: answerText,
      answers_so_far: answersSoFar,
    });

    setDecisionPattern(res.decision_pattern);
    setBehavioralConsistency(res.behavioral_consistency);
    setEnergyBalance(res.energy_balance);
    setCulturalOrientation(res.cultural_orientation);

    const insight = {
      phase,
      text: res.micro_insight,
      insight_type: res.insight_type,
      at: new Date().toISOString(),
    } as const;
    setMicroInsights((prev) => [...prev, insight]);

    void trackAnalyticsEvent({
      event_type: 'assessment_journey_micro_insight_shown',
      feature: 'assessment_journey',
      metadata: { phase, insight_type: res.insight_type, ...EXPERIENCE_META },
    });

    const uncertaintyHits = (answerText.match(/\b(maybe|perhaps|asi|mozna|nevim|idk)\b/gi) || []).length;
    const sentenceCount = Math.max(1, answerText.split(/[.!?]+/).filter(Boolean).length);
    const wordCount = answerText.split(/\s+/).filter(Boolean).length;
    const linguisticDepth = Number((wordCount / sentenceCount).toFixed(2));

    void trackAnalyticsEvent({
      event_type: 'assessment_journey_answered',
      feature: 'assessment_journey',
      metadata: {
        phase,
        question_index: index,
        answer_length: answerText.trim().length,
        linguistic_depth: linguisticDepth,
        uncertainty_hits: uncertaintyHits,
        confidence_level: confidenceLevel,
        business_impact_level: businessImpactLevel,
        stakeholder_alignment_level: stakeholderAlignmentLevel,
        practical_order: practicalOrder,
        placement_zone: zoneOverride || placementZone,
        ...EXPERIENCE_META,
      },
    });
  };

  const showMicroReward = (streak: number, checkpointType: 'question' | 'task') => {
    const reward = t('assessment_journey.micro_reward_generic', {
      defaultValue: 'Skvělý krok. Vaše cesta získává jasnější směr.',
    });
    const withStreak = `${reward} ${t('assessment_journey.streak_badge', { count: streak, defaultValue: '{{count}} checkpointy za sebou' })}`;
    setMicroReward(withStreak);

    void trackAnalyticsEvent({
      event_type: 'assessment_journey_micro_reward_shown',
      feature: 'assessment_journey',
      metadata: {
        ...EXPERIENCE_META,
        checkpoint_index: index + 1,
        checkpoint_type: checkpointType,
        streak_count: streak,
      },
    });
  };

  const completeCurrentStep = async (zoneOverride?: 'focus' | 'collab' | 'speed' | 'quality') => {
    const nextZone = zoneOverride || placementZone;
    setPlacementZone(nextZone);
    const qualityCheckpoint = buildQualityCheckpoint(currentAnswer, nextZone);
    setQualityCheckpoints((prev) => [...prev, qualityCheckpoint]);

    if (mode === 'preview') {
      setMicroInsights((prev) => [
        ...prev,
        {
          phase,
          text: t('assessment_journey.demo_insight', {
            defaultValue: 'Demo insight: začíná se rýsovat váš rozhodovací styl.',
          }),
          insight_type: 'demo_preview',
          at: new Date().toISOString(),
        },
      ]);
    } else {
      try {
        await handleAnalyzeAnswer(currentAnswer, nextZone);
      } catch (e: any) {
        setError(e?.message || 'Analysis failed');
        return false;
      }
    }

    const nextStreak = streakCount + 1;
    setStreakCount(nextStreak);
    showMicroReward(nextStreak, phaseTwoStep === 'task' ? 'task' : 'question');

    if (phaseTwoStep === 'task') {
      emitCheckpointCompleted('task', nextStreak);
    }

    if (index + 1 < questions.length) {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      setPhaseTwoStep('question');
      setStrategyChoice('');
      setSignalChoices([]);
      setTaskNote('');
      setResourceSplit({ stability: 4, speed: 3, quality: 3 });
      setFirstMove('');
      setSecondMove('');
      emitCheckpointStarted('question');
      return true;
    }

    setPhaseTwoStep('question');
    proceedTo(2, 'questionnaire_completed');
    return true;
  };

  const handleNext = async () => {
    setError(null);
    if (!currentQuestion) return;

    if (phaseTwoStep === 'question') {
      if (!currentAnswer.trim()) return;
      emitCheckpointCompleted('question', streakCount);
      if (!shouldShowTaskStep) {
        let inferredZone: 'focus' | 'collab' | 'speed' | 'quality' = 'focus';
        if (/\b(tým|stakeholder|koleg|people|team)\b/i.test(currentAnswer)) inferredZone = 'collab';
        if (/\b(rychl|fast|quick|urgent|hned)\b/i.test(currentAnswer)) inferredZone = 'speed';
        if (/\b(kvalit|quality|precise|detail|standard)\b/i.test(currentAnswer)) inferredZone = 'quality';
        await completeCurrentStep(inferredZone);
        return;
      }
      setPhaseTwoStep('task');
      setStrategyChoice('');
      setSignalChoices([]);
      setTaskNote('');
      setResourceSplit({ stability: 4, speed: 3, quality: 3 });
      setFirstMove('');
      setSecondMove('');
      emitCheckpointStarted('task');
      return;
    }

    if (taskVariant === 1 && !strategyChoice) return;
    if (taskVariant === 2 && signalChoices.length === 0) return;
    if (taskVariant === 3 && resourceSplit.stability + resourceSplit.speed + resourceSplit.quality !== 10) return;
    if (taskVariant === 4 && (!firstMove || !secondMove || firstMove === secondMove)) return;
    let nextZone: 'focus' | 'collab' | 'speed' | 'quality' = placementZone;
    if (taskVariant === 1) {
      if (strategyChoice.includes('lidi')) nextZone = 'collab';
      else if (strategyChoice.includes('Rychle')) nextZone = 'speed';
      else if (strategyChoice.includes('plán')) nextZone = 'quality';
      else nextZone = 'focus';
    }
    if (taskVariant === 2) {
      if (signalChoices.some((x) => x.includes('komunikace') || x.includes('Důvěra'))) nextZone = 'collab';
      else if (signalChoices.some((x) => x.includes('Rychlá'))) nextZone = 'speed';
      else if (signalChoices.some((x) => x.includes('Kvalita'))) nextZone = 'quality';
      else nextZone = 'focus';
    }
    if (taskVariant === 3) {
      if (resourceSplit.speed >= resourceSplit.stability && resourceSplit.speed >= resourceSplit.quality) nextZone = 'speed';
      else if (resourceSplit.quality >= resourceSplit.stability && resourceSplit.quality >= resourceSplit.speed) nextZone = 'quality';
      else nextZone = 'focus';
    }
    if (taskVariant === 4) {
      if (firstMove.includes('Zapojit') || secondMove.includes('Zapojit')) nextZone = 'collab';
      else if (firstMove.includes('ověřit') || secondMove.includes('ověřit')) nextZone = 'speed';
      else nextZone = 'focus';
    }
    await completeCurrentStep(nextZone);
  };

  const handleFinalize = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const finalized = mode === 'preview'
        ? {
            decision_pattern: decisionPattern,
            behavioral_consistency: behavioralConsistency.recurring_motifs.length
              ? behavioralConsistency
              : {
                  recurring_motifs: ['Demo: V odpovědích se opakuje motiv prioritizace.'],
                  consistency_pairs: ['Demo: Preference je konzistentní napříč scénáři.'],
                  preference_scenario_tensions: [],
                },
            energy_balance: energyBalance,
            cultural_orientation: culturalOrientation.transparency
              ? culturalOrientation
              : {
                  transparency: 'Demo: Vysoká preference otevřené zpětné vazby.',
                  conflict_response: 'Demo: Spíše přímá konfrontace problému.',
                  hierarchy_vs_autonomy: 'Demo: Vyšší orientace na autonomii.',
                  process_vs_outcome: 'Demo: Důraz na procesní kvalitu i výsledek.',
                  stability_vs_dynamics: 'Demo: Směr k dynamickému prostředí a iteraci.',
                },
            final_profile: {
              transferable_strengths: ['Demo: Strukturované rozhodování v nejistotě'],
              risk_zones: ['Demo: Dlouhodobý tlak povinností může snižovat energii.'],
              amplify_environments: ['Demo: Otevřená zpětná vazba', 'Demo: Sdílená odpovědnost'],
              drain_environments: ['Demo: Nízká transparentnost rozhodování'],
            },
          }
        : await fetchJourneyFinalize({ answers: submittedAnswers });
      setDecisionPattern(finalized.decision_pattern);
      setBehavioralConsistency(finalized.behavioral_consistency);
      setEnergyBalance(finalized.energy_balance);
      setCulturalOrientation(finalized.cultural_orientation);
      setFinalProfile(finalized.final_profile);
      proceedTo(5, 'finalized');

      if (mode === 'preview') {
        setSubmitting(false);
        return;
      }

      const payload: AssessmentJourneyPayloadV1 = {
        journey_version: 'journey-v1',
        technical: answers,
        psychometric: {
          ...psychometric,
          confidence_level: confidenceLevel,
          business_impact_level: businessImpactLevel,
          stakeholder_alignment_level: stakeholderAlignmentLevel,
        },
        decision_pattern: finalized.decision_pattern,
        behavioral_consistency: finalized.behavioral_consistency,
        energy_balance: finalized.energy_balance,
        cultural_orientation: finalized.cultural_orientation,
        journey_trace: {
          phase_events: [...phaseEvents, { phase: 5, event: 'finalized', at: new Date().toISOString() }],
          micro_insights: microInsights,
          mode_switches: [],
          experience_meta: {
            experience_style: EXPERIENCE_META.experience_style,
            pace_mode: EXPERIENCE_META.pace_mode,
            personalization_mode: EXPERIENCE_META.role_personalization,
          },
          response_quality: {
            checkpoints: qualityCheckpoints,
            summary: qualitySummary,
          },
        },
        final_profile: finalized.final_profile,
        ai_disclaimer: {
          text: aiDisclaimer,
          shown_at_phase: [1, 2, 3, 4, 5],
        },
        assessment_mode_used: assessmentMode,
        mode_switch_count: modeSwitchCount,
        mode_switch_timestamps: modeSwitchTimestamps,
      };

      const totalTimeSec = Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));

      if (submitViaBackend) {
        if (!invitationToken) throw new Error('Missing invitation token');
        const response = await fetch(
          `${BACKEND_URL}/assessments/invitations/${invitationId}/submit?token=${encodeURIComponent(invitationToken)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              invitation_id: invitationId,
              assessment_id: assessment.id,
              role: assessment.role,
              difficulty: 'Journey',
              questions_total: questions.length,
              time_spent_seconds: totalTimeSec,
              answers: payload,
              feedback: JSON.stringify({
                journey_version: 'journey-v1',
                assessment_payload: payload,
                note: 'Structured self-discovery output.',
              }),
            }),
          }
        );

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.detail || `Submit failed (${response.status})`);
        }

        void trackAnalyticsEvent({
          event_type: 'assessment_journey_completed',
          feature: 'assessment_journey',
          metadata: {
            mode: assessmentMode,
            total_time_sec: totalTimeSec,
            apply_click_after_insight: false,
            signal_quality: qualitySummary.signal_quality,
            consistency_index: qualitySummary.consistency_index,
            ...EXPERIENCE_META,
          },
        });

        onComplete('backend-submitted');
        return;
      }

      const { data, error: insertError } = await supabase!
        .from('assessment_results')
        .insert([
          {
            assessment_id: assessment.id,
            company_id: 'unknown',
            role: assessment.role,
            difficulty: 'Journey',
            questions_total: questions.length,
            questions_correct: 0,
            score: 0,
            time_spent_seconds: totalTimeSec,
            answers: payload,
            feedback: JSON.stringify({ assessment_payload: payload }),
            completed_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      void trackAnalyticsEvent({
        event_type: 'assessment_journey_completed',
        feature: 'assessment_journey',
        metadata: {
          mode: assessmentMode,
          total_time_sec: totalTimeSec,
          apply_click_after_insight: false,
          signal_quality: qualitySummary.signal_quality,
          consistency_index: qualitySummary.consistency_index,
          ...EXPERIENCE_META,
        },
      });

      onComplete(data.id);
    } catch (e: any) {
      setError(e?.message || 'Finalization failed');
    } finally {
      setSubmitting(false);
    }
  };

  const seedCurrentDemo = () => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: demoAnswerForQuestion(currentQuestion, index, assessment.role),
    }));
  };

  const movePracticalItem = (itemIndex: number, direction: -1 | 1) => {
    setPracticalOrder((prev) => {
      const nextIndex = itemIndex + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[itemIndex];
      next[itemIndex] = next[nextIndex];
      next[nextIndex] = tmp;
      return next;
    });
  };

  const adjustResource = (key: 'stability' | 'speed' | 'quality', delta: -1 | 1) => {
    setResourceSplit((prev) => {
      const total = prev.stability + prev.speed + prev.quality;
      if (delta > 0 && total >= 10) return prev;
      const nextValue = prev[key] + delta;
      if (nextValue < 0 || nextValue > 10) return prev;
      return { ...prev, [key]: nextValue };
    });
  };

  const buildQualityCheckpoint = (
    answerText: string,
    zone: 'focus' | 'collab' | 'speed' | 'quality'
  ): ResponseQualityCheckpoint => {
    const words = answerText.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const sentenceCount = Math.max(1, answerText.split(/[.!?]+/).filter(Boolean).length);
    const hedgingHits = (answerText.match(/\b(maybe|perhaps|asi|mozna|nevim|idk|snad)\b/gi) || []).length;
    const specificityHits = (answerText.match(/\b(\d+|konkr[eé]tn|term[ií]n|rozpo[cč]et|metrik|miln[ií]k|deadline|owner)\b/gi) || []).length;

    const answerDepth = clamp(Math.round(wordCount * 1.5 + sentenceCount * 7), 25, 100);
    const specificity = clamp(Math.round(40 + specificityHits * 12 + Math.min(20, wordCount / 5)), 25, 100);
    const taskDecisivenessBase =
      taskVariant === 0 ? 72 :
      taskVariant === 1 ? (strategyChoice ? 82 : 50) :
      taskVariant === 2 ? (signalChoices.length >= 2 ? 84 : 74) :
      taskVariant === 3 ? (resourceSplit.stability + resourceSplit.speed + resourceSplit.quality === 10 ? 86 : 58) :
      (firstMove && secondMove && firstMove !== secondMove ? 88 : 56);
    const decisiveness = clamp(Math.round(taskDecisivenessBase - hedgingHits * 9), 20, 100);

    const prev = qualityCheckpoints[qualityCheckpoints.length - 1];
    const consistencyHint = prev ? (prev.dominant_zone === zone ? 84 : 66) : 75;

    const notes: string[] = [];
    if (answerDepth < 48) notes.push('short_answer');
    if (specificity < 55) notes.push('low_specificity');
    if (decisiveness < 55) notes.push('high_uncertainty');
    if (consistencyHint < 70) notes.push('style_shift');

    return {
      checkpoint_index: index + 1,
      answer_depth: answerDepth,
      specificity,
      decisiveness,
      consistency_hint: consistencyHint,
      dominant_zone: zone,
      notes,
      at: new Date().toISOString(),
    };
  };

  const renderNorthstarPulse = (variant: 'cockpit' | 'classic') => (
    <div className={`mt-4 rounded-xl border p-3 ${variant === 'cockpit' ? 'border-white/20 bg-black/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'}`}>
      <div className={`text-xs uppercase tracking-[0.12em] ${variant === 'cockpit' ? 'text-cyan-100/80' : 'text-slate-500 dark:text-slate-300'}`}>
        Basic Personality Pulse (8 quick choices)
      </div>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
        {personalityPulseItems.map((item) => {
          const current = personalityPulseAnswers[item.id];
          return (
            <div key={item.id} className={`rounded-lg border p-2 ${variant === 'cockpit' ? 'border-white/15 bg-black/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}`}>
              <div className={`text-xs mb-2 ${variant === 'cockpit' ? 'text-cyan-50/90' : 'text-slate-700 dark:text-slate-200'}`}>{item.prompt}</div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setPersonalityPulseAnswers((prev) => ({ ...prev, [item.id]: -1 }))}
                  className={`rounded-md border px-2 py-1 text-xs text-left transition-colors ${
                    current === -1
                      ? (variant === 'cockpit' ? 'border-cyan-300/60 bg-cyan-500/20 text-cyan-50' : 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100')
                      : (variant === 'cockpit' ? 'border-white/20 bg-black/25 text-cyan-100/90' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200')
                  }`}
                >
                  {item.leftLabel}
                </button>
                <button
                  onClick={() => setPersonalityPulseAnswers((prev) => ({ ...prev, [item.id]: 1 }))}
                  className={`rounded-md border px-2 py-1 text-xs text-left transition-colors ${
                    current === 1
                      ? (variant === 'cockpit' ? 'border-emerald-300/60 bg-emerald-500/20 text-emerald-50' : 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100')
                      : (variant === 'cockpit' ? 'border-white/20 bg-black/25 text-cyan-100/90' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200')
                  }`}
                >
                  {item.rightLabel}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className={`mt-3 text-xs ${variant === 'cockpit' ? 'text-cyan-100/85' : 'text-slate-600 dark:text-slate-300'}`}>
        Profil (basic): <span className="font-semibold">{basicPersonalityCode}</span> · E {northstarAxisScores.EI}% · N {northstarAxisScores.SN}% · F {northstarAxisScores.TF}% · P {northstarAxisScores.JP}%
      </div>
      {!northstarCompleted && (
        <div className={`mt-1 text-xs ${variant === 'cockpit' ? 'text-amber-200' : 'text-amber-700 dark:text-amber-300'}`}>
          Vyplňte prosím všech 8 voleb pro dokončení Northstar profilu.
        </div>
      )}
    </div>
  );

  if (submitting) {
    return <div className="min-h-[440px] flex items-center justify-center text-slate-700">{t('common.loading', { defaultValue: 'Loading...' })}</div>;
  }

  if (assessmentMode === 'game') {
    const progressLabel = t('assessment_journey.step_progress', {
      defaultValue: 'Krok {{current}} / {{total}}',
      current: currentJourneyStep,
      total: totalJourneySteps,
    });
    const liveEnergy = clamp(energyBalance.monthly_energy_hours_left, 0, 100);

    const leftPanel = (
      <>
        <div className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/75">
          {t('assessment_journey.map_title', { defaultValue: 'Mapa cesty' })}
        </div>
        <div className="mt-3 h-40 rounded-xl border border-white/20 overflow-hidden bg-black/25">
          <SceneShell
            capability={sceneCapability}
            className="h-full w-full"
            glide
            glideIntensity={0.08}
            performanceMode={sceneCapability.qualityTier}
            fallback={<div className="h-full w-full cockpit-scene-fallback" />}
          >
            <JourneyPathMapScene
              total={checkpointLabels.length}
              activeIndex={phase - 1}
              trailColor={roleMood.trail}
              nodeColor={roleMood.node}
              activeColor={roleMood.activeNode}
            />
          </SceneShell>
        </div>
        <div className="mt-3 space-y-2">
          {checkpointLabels.map((label, idx) => (
            <div
              key={label}
              className={`rounded-lg px-3 py-2 text-sm border transition-colors ${
                phase >= idx + 1
                  ? 'border-cyan-300/50 bg-cyan-400/12 text-cyan-50'
                  : 'border-white/20 bg-black/20 text-slate-200/80'
              }`}
            >
              {idx + 1}. {label}
            </div>
          ))}
        </div>
      </>
    );

    const centerPanel = (
      <>
        <div className="cockpit-panel cockpit-panel-enter px-4 py-3 text-sm text-cyan-50/90">
          {t('assessment_journey.authenticity_hint', { defaultValue: 'Autenticita je cennější než „dokonalá“ odpověď.' })}
        </div>

        {phase === 1 && currentQuestion && phaseTwoStep === 'question' && (
          <div className="mt-3 cockpit-panel cockpit-panel-enter px-4 md:px-5 py-4 md:py-5">
            <div className="text-sm text-cyan-100/90 mb-2">
              {t('assessment_journey.question_step_label', {
                defaultValue: 'Otázka {{index}} / {{total}}',
                index: index + 1,
                total: questions.length,
              })}
            </div>
            <h2 className="text-xl md:text-2xl font-medium text-white">{currentQuestion.text}</h2>
            <p className="mt-2 text-sm text-cyan-50/90">
              {t('assessment_journey.role_context_question', {
                defaultValue: 'Tento krok simuluje situace, které můžete řešit v roli {{role}}.',
                role: roleLabel,
              })}
            </p>

            {currentQuestion.type === 'MultipleChoice' && currentQuestion.options?.length ? (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                {currentQuestion.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: opt }))}
                    className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                      currentAnswer === opt
                        ? 'border-cyan-300/60 bg-cyan-400/20 text-white'
                        : 'border-white/20 bg-black/20 hover:border-cyan-300/50 text-cyan-50/90'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <textarea
                value={currentAnswer}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                className="w-full h-36 mt-4 rounded-xl border border-white/25 bg-black/30 p-3 text-white placeholder:text-slate-300/70"
                placeholder={t('assessment.taker.placeholder_text', { defaultValue: 'Type your answer...' })}
              />
            )}

            <div className="mt-5 flex items-center justify-between">
              {mode === 'preview' ? (
                <button
                  onClick={seedCurrentDemo}
                  className="px-3 py-1.5 rounded-lg border border-white/30 bg-white/10 text-cyan-50 text-sm"
                >
                  {t('assessment_journey.demo_seed_answer', { defaultValue: 'Vložit demo odpověď' })}
                </button>
              ) : <span />}
              <button
                onClick={handleNext}
                disabled={!currentAnswer.trim()}
                className="px-4 py-2 rounded-lg font-semibold disabled:opacity-40 bg-emerald-400/85 hover:bg-emerald-300 text-slate-950"
              >
                {shouldShowTaskStep
                  ? t('assessment_journey.cta_to_task', { defaultValue: 'Pokračovat na misi' })
                  : t('assessment_journey.cta_next_question', { defaultValue: 'Pokračovat na další otázku' })}
              </button>
            </div>
          </div>
        )}

        {phase === 1 && shouldShowTaskStep && currentQuestion && phaseTwoStep === 'task' && (
          <div className="mt-3 cockpit-panel cockpit-panel-enter px-4 md:px-5 py-4 md:py-5">
            <div className="text-sm text-cyan-100/90">
              {t('assessment_journey.task_step_label', {
                defaultValue: 'Praktická mise {{index}} / {{total}}',
                index: Math.floor(index / 2) + 1,
                total: practicalMissionCount,
              })}
            </div>
            <h3 className="mt-1 text-xl font-semibold text-white">{taskTitle}</h3>
            <p className="mt-2 text-sm text-cyan-50/90">{taskDescription}</p>

            {taskVariant === 0 && (
              <div className="mt-4 space-y-2">
                {practicalOrder.map((item, itemIndex) => (
                  <div key={item} className="flex items-center justify-between rounded-lg border border-white/20 bg-black/20 px-2 py-1.5 text-sm text-white">
                    <span>{item}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => movePracticalItem(itemIndex, -1)} className="w-7 h-7 rounded border border-white/30 bg-white/10">↑</button>
                      <button onClick={() => movePracticalItem(itemIndex, 1)} className="w-7 h-7 rounded border border-white/30 bg-white/10">↓</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {taskVariant === 1 && (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {['Nejdřív uklidnit situaci', 'Postavit jasný plán', 'Zapojit klíčové lidi', 'Rychle ověřit první krok'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setStrategyChoice(opt)}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      strategyChoice === opt ? 'border-cyan-300/60 bg-cyan-500/20 text-white' : 'border-white/20 bg-black/20 text-cyan-50/90'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
            {taskVariant === 2 && (
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {['Jasné priority', 'Klidná komunikace', 'Rychlá reakce', 'Kvalita výstupu', 'Důvěra v týmu'].map((opt) => {
                  const active = signalChoices.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => setSignalChoices((prev) => active ? prev.filter((x) => x !== opt) : [...prev, opt].slice(-2))}
                      className={`rounded-full border px-3 py-1.5 ${
                        active ? 'border-cyan-300/60 bg-cyan-500/20 text-white' : 'border-white/20 bg-black/20 text-cyan-50/90'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}
            {taskVariant === 3 && (
              <div className="mt-3 space-y-2">
                {[
                  ['stability', 'Stabilita'],
                  ['speed', 'Rychlost'],
                  ['quality', 'Kvalita'],
                ].map(([key, label]) => {
                  const value = resourceSplit[key as 'stability' | 'speed' | 'quality'];
                  return (
                    <div key={key} className="rounded-lg border border-white/20 bg-black/20 px-3 py-2">
                      <div className="flex items-center justify-between text-sm text-white">
                        <span>{label}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => adjustResource(key as 'stability' | 'speed' | 'quality', -1)} className="w-7 h-7 rounded border border-white/30 bg-white/10">-</button>
                          <span className="w-6 text-center font-semibold">{value}</span>
                          <button onClick={() => adjustResource(key as 'stability' | 'speed' | 'quality', 1)} className="w-7 h-7 rounded border border-white/30 bg-white/10">+</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {taskVariant === 4 && (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {['Vyjasnit očekávání', 'Zapojit stakeholdery', 'Rychle ověřit hypotézu', 'Sepsat krátký plán'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      if (!firstMove || firstMove === opt) {
                        setFirstMove(opt);
                        if (secondMove === opt) setSecondMove('');
                        return;
                      }
                      setSecondMove(opt);
                    }}
                    className={`rounded-lg border px-3 py-2 text-left ${
                      firstMove === opt || secondMove === opt
                        ? 'border-cyan-300/60 bg-cyan-500/20 text-white'
                        : 'border-white/20 bg-black/20 text-cyan-50/90'
                    }`}
                  >
                    <div className="font-medium">{opt}</div>
                    <div className="text-xs text-cyan-100/80">
                      {firstMove === opt ? t('assessment_journey.first_move', { defaultValue: '1. krok' }) : secondMove === opt ? t('assessment_journey.second_move', { defaultValue: '2. krok' }) : '\u00A0'}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleNext}
                disabled={!taskReady}
                className="px-4 py-2 rounded-lg font-semibold disabled:opacity-40 bg-emerald-400/85 hover:bg-emerald-300 text-slate-950"
              >
                {t('assessment_journey.cta_finish_checkpoint', { defaultValue: 'Dokončit checkpoint' })}
              </button>
            </div>
          </div>
        )}

        {phase === 2 && index >= questions.length - 1 && (
          <div className="mt-3 cockpit-panel cockpit-panel-enter p-4">
            <h3 className="text-lg font-semibold text-white">{t('assessment_journey.phase_2', { defaultValue: 'Zrcadlení vzorců' })}</h3>
            <div className="mt-3 space-y-2 text-sm text-cyan-50/90">
              {behavioralConsistency.recurring_motifs.slice(0, 3).map((x) => <div key={x}>• {x}</div>)}
              {behavioralConsistency.recurring_motifs.length === 0 && <div>• {t('assessment_journey.default_pattern_hint', { defaultValue: 'Začíná se rýsovat váš rozhodovací styl.' })}</div>}
            </div>
            <button onClick={() => proceedTo(3, 'mirroring_shown')} className="mt-4 px-4 py-2 rounded-lg font-semibold bg-emerald-400/85 hover:bg-emerald-300 text-slate-950">
              {t('assessment_journey.cta_to_phase3', { defaultValue: 'Pokračovat na energetický kompas' })}
            </button>
          </div>
        )}
        {phase === 3 && (
          <div className="mt-3 cockpit-panel cockpit-panel-enter p-4">
            <h3 className="text-lg font-semibold text-white">{t('assessment_journey.phase_3', { defaultValue: 'Energetický kompas' })}</h3>
            <p className="mt-2 text-sm text-cyan-50/90">{energySnapshotLabel}</p>
            <button onClick={() => proceedTo(4, 'resource_leak_shown')} className="mt-4 px-4 py-2 rounded-lg font-semibold bg-emerald-400/85 hover:bg-emerald-300 text-slate-950">
              {t('assessment_journey.cta_to_phase4', { defaultValue: 'Pokračovat na Cultural Northstar' })}
            </button>
          </div>
        )}
        {phase === 4 && (
          <div className="mt-3 cockpit-panel cockpit-panel-enter p-4">
            <h3 className="text-lg font-semibold text-white">{t('assessment_journey.phase_4', { defaultValue: 'Cultural Northstar' })}</h3>
            <p className="mt-2 text-sm text-cyan-50/90">{t('assessment_journey.northstar_explainer', { defaultValue: 'Northstar je váš preferovaný pracovní kontext: v jakém prostředí podáváte nejlepší výkon a kde naopak energie rychle klesá.' })}</p>
            <div className="mt-3 space-y-2 text-sm text-cyan-50/90">
              <div>{culturalOrientation.transparency}</div>
              <div>{culturalOrientation.conflict_response}</div>
              <div>{culturalOrientation.hierarchy_vs_autonomy}</div>
              <div>{culturalOrientation.process_vs_outcome}</div>
              <div>{culturalOrientation.stability_vs_dynamics}</div>
            </div>
            {renderNorthstarPulse('cockpit')}
            <button
              onClick={handleFinalize}
              disabled={!northstarCompleted}
              className="mt-4 px-4 py-2 rounded-lg font-semibold bg-emerald-400/85 hover:bg-emerald-300 text-slate-950 disabled:opacity-45"
            >
              {t('assessment_journey.cta_finalize', { defaultValue: 'Vytvořit souhrnný profil' })}
            </button>
          </div>
        )}
        {phase === 5 && (
          <div className="mt-3 cockpit-panel cockpit-panel-enter p-4 space-y-4">
            <h3 className="text-lg font-semibold text-white">{t('assessment_journey.phase_5', { defaultValue: 'Souhrnný profil' })}</h3>
            <div className="text-xs text-cyan-100/85">Basic personality profile: <span className="font-semibold">{basicPersonalityCode}</span></div>
            <div className="text-sm text-cyan-50/90">{finalProfile.transferable_strengths.join(' • ')}</div>
            <button
              onClick={() => {
                void trackAnalyticsEvent({
                  event_type: 'assessment_apply_clicked_after_journey',
                  feature: 'assessment_journey',
                  metadata: { mode: assessmentMode, ...EXPERIENCE_META },
                });
                onComplete('journey-completed');
              }}
              className="px-4 py-2 rounded-lg font-semibold bg-emerald-400/85 hover:bg-emerald-300 text-slate-950"
            >
              {t('assessment_journey.cta_complete', { defaultValue: 'Dokončit cestu' })}
            </button>
          </div>
        )}
      </>
    );

    const rightPanel = (
      <div className="space-y-3 text-sm text-cyan-50/90">
        <div className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/75">Live Resonance</div>
        {[
          ['Signal', qualitySummary.signal_quality],
          ['Confidence', liveSignalFrame.confidence],
          ['Energy', liveEnergy],
          ['Culture Match', liveCultureMatch],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/20 bg-black/20 p-3">
            <div className="flex items-center justify-between text-xs text-cyan-100/85">
              <span>{label}</span>
              <span>{value}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 cockpit-metric-sweep" style={{ width: `${clamp(Number(value), 0, 100)}%` }} />
            </div>
          </div>
        ))}
        {safeEvidence.length > 0 && (
          <div className="rounded-lg border border-white/20 bg-black/20 p-3 text-xs">
            <div className="text-cyan-100/80 mb-1">Evidence</div>
            <div>{safeEvidence.slice(0, 4).join(' • ')}</div>
          </div>
        )}
        {microInsights.length > 0 && (
          <div className="rounded-lg border border-emerald-300/35 bg-emerald-300/10 px-3 py-2 text-sm">
            {microInsights[microInsights.length - 1].text}
          </div>
        )}
        {microReward && (
          <div className="rounded-lg border border-cyan-200/30 bg-cyan-100/10 px-3 py-2 text-sm">
            {microReward}
          </div>
        )}
        <div className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-xs text-cyan-100/75">
          {aiDisclaimer}
        </div>
      </div>
    );

    return (
      <AssessmentCockpitLayout
        embedded={embedded}
        title={assessment.title}
        roleLabel={roleLabel}
        progressLabel={progressLabel}
        topRight={mode === 'preview' ? <span className="cockpit-pill">Recruiter Preview</span> : null}
        leftPanel={leftPanel}
        centerPanel={centerPanel}
        rightPanel={rightPanel}
        sceneCapability={sceneCapability}
        showScene={showCockpitScene}
        sceneEnabled={cockpitThreeEnabled}
        onToggleScene={() => setShowCockpitScene((v) => !v)}
        phase={phase}
        progress={currentJourneyStep / Math.max(1, totalJourneySteps)}
        streakCount={streakCount}
        confidence={liveSignalFrame.confidence}
        energy={liveEnergy}
        culture={liveCultureMatch}
      />
    );
  }

  return (
    <div className={`${embedded ? 'min-h-full h-full' : 'min-h-[100dvh]'} ${theme.root} overflow-x-hidden overflow-y-auto isolate`}>
      <div className="w-full min-h-[100dvh] px-0 py-0 relative isolate">

        <div className={theme.sceneFrame}>
          {showCockpitScene && cockpitThreeEnabled ? (
            <SceneShell
              capability={sceneCapability}
              glide
              glideIntensity={0.24}
              className="absolute inset-0"
              fallback={
                <div className="absolute inset-0 bg-transparent" />
              }
            >
              <JourneyBackdropScene mode="assessment" mood={roleMood.sceneSkin} progress={currentJourneyStep / Math.max(1, totalJourneySteps)} />
            </SceneShell>
          ) : (
            <div className="absolute inset-0 bg-transparent" />
          )}
        </div>
        {cockpitThreeEnabled && (
          <div className="absolute right-6 top-6 z-20">
            <button
              onClick={() => setShowCockpitScene((v) => !v)}
              className={theme.sceneToggle}
            >
              {showCockpitScene
                ? t('assessment_3d.preview_on', { defaultValue: '3D Preview: ON' })
                : t('assessment_3d.preview_off', { defaultValue: '3D Preview: OFF' })}
            </button>
          </div>
        )}

        <div className={`relative z-10 border-b-0 p-3 md:p-5 min-h-[100dvh] flex flex-col rounded-none ${theme.card}`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold">{assessment.title}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">{roleLabel}</p>
            </div>
            <div className="flex items-center gap-2 text-xs flex-wrap pr-20 md:pr-24">
              <span className="rounded-full border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-800 px-3 py-1 text-slate-700 dark:text-slate-200">
                {t('assessment_journey.step_progress', {
                  defaultValue: 'Krok {{current}} / {{total}}',
                  current: currentJourneyStep,
                  total: totalJourneySteps,
                })}
              </span>
              {mode === 'preview' && (
                <span className="rounded-full border border-slate-300 dark:border-slate-600 bg-white/90 dark:bg-slate-800 px-3 py-1 text-slate-700 dark:text-slate-200">
                  {t('assessment_journey.recruiter_preview_badge', { defaultValue: 'Recruiter Preview: simulace kandidátské cesty' })}
                </span>
              )}
            </div>
          </div>

          {error && <div className="mt-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-100">{error}</div>}

          <div className="mt-4 grid grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_300px] gap-4 flex-1 items-stretch min-h-0">
            <aside className="hidden xl:flex rounded-2xl border border-slate-200/75 dark:border-slate-700/80 bg-white/78 dark:bg-slate-950/78 p-3 h-full flex-col backdrop-blur-sm order-2 xl:order-1">
              <div className={`text-xs uppercase tracking-[0.14em] ${theme.accent}`}>
                {t('assessment_journey.map_title', { defaultValue: 'Mapa cesty' })}
              </div>
              <div className="mt-3 h-36 rounded-xl border border-slate-200/60 dark:border-slate-800/70 overflow-hidden bg-white/45 dark:bg-slate-950/45">
                <SceneShell
                  capability={sceneCapability}
                  className="h-full w-full"
                  glide
                  glideIntensity={0.1}
                  fallback={<div className="h-full w-full bg-[radial-gradient(circle_at_40%_40%,rgba(148,163,184,0.2),transparent_56%),linear-gradient(180deg,rgba(248,250,252,0.78),rgba(226,232,240,0.52))] dark:bg-[radial-gradient(circle_at_40%_40%,rgba(100,116,139,0.2),transparent_56%),linear-gradient(180deg,rgba(2,6,23,0.5),rgba(15,23,42,0.32))]" />}
                >
                  <JourneyPathMapScene
                    total={checkpointLabels.length}
                    activeIndex={phase - 1}
                    trailColor={roleMood.trail}
                    nodeColor={roleMood.node}
                    activeColor={roleMood.activeNode}
                  />
                </SceneShell>
              </div>
              <div className="mt-3 space-y-2">
                {checkpointLabels.map((label, idx) => (
                  <div key={label} className={`rounded-lg px-3 py-2 text-sm border transition-colors ${phase >= idx + 1 ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100' : 'border-slate-200 dark:border-slate-700 bg-white/88 dark:bg-slate-900 text-slate-500 dark:text-slate-300'}`}>
                    {idx + 1}. {label}
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-4 text-xs text-slate-500 dark:text-slate-300">
                {t('assessment_journey.streak_badge', { count: streakCount, defaultValue: '{{count}} checkpointy za sebou' })}
              </div>
            </aside>

            <main className="order-1 xl:order-2 w-full max-w-4xl mx-auto flex flex-col justify-center min-h-[62vh]">
              <div className="rounded-xl border border-slate-200/75 dark:border-slate-700/80 bg-white/82 dark:bg-slate-950/82 p-3 backdrop-blur-sm">
                <div className="text-xs text-slate-600 dark:text-slate-200">
                  {t('assessment_journey.pace_hint_badge', { defaultValue: 'Doporučené tempo: plynule, bez stresu' })}
                </div>
                <div className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                  {t('assessment_journey.authenticity_hint', { defaultValue: 'Autenticita je cennější než „dokonalá“ odpověď.' })}
                </div>
              </div>

              {phase === 1 && currentQuestion && phaseTwoStep === 'question' && (
                <div className="mt-4 rounded-2xl border border-slate-200/75 dark:border-slate-700/80 bg-white/84 dark:bg-slate-950/84 p-4 md:p-5 backdrop-blur-sm">
                  <div className="text-sm text-slate-700 dark:text-slate-200 mb-2">
                    {t('assessment_journey.question_step_label', {
                      defaultValue: 'Otázka {{index}} / {{total}}',
                      index: index + 1,
                      total: questions.length,
                    })}
                  </div>
                  <h2 className="text-xl font-medium text-slate-900 dark:text-slate-100">{currentQuestion.text}</h2>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {t('assessment_journey.role_context_question', {
                      defaultValue: 'Tento krok simuluje situace, které můžete řešit v roli {{role}}.',
                      role: roleLabel,
                    })}
                  </p>

                  {currentQuestion.type === 'MultipleChoice' && currentQuestion.options?.length ? (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {currentQuestion.options.map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: opt }))}
                          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                            currentAnswer === opt
                              ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                              : 'border-slate-200 dark:border-slate-700 bg-white/92 dark:bg-slate-900/86 hover:border-slate-400 dark:hover:border-slate-600 text-slate-700 dark:text-slate-100'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={currentAnswer}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                      className="w-full h-36 mt-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-3 text-slate-900 dark:text-slate-50"
                      placeholder={t('assessment.taker.placeholder_text', { defaultValue: 'Type your answer...' })}
                    />
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {mode === 'preview' && (
                      <button
                        onClick={seedCurrentDemo}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-100 text-slate-700 text-sm"
                      >
                        {t('assessment_journey.demo_seed_answer', { defaultValue: 'Vložit demo odpověď' })}
                      </button>
                    )}
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      onClick={handleNext}
                      disabled={!currentAnswer.trim()}
                      className={`px-4 py-2 rounded-lg font-semibold disabled:opacity-40 ${theme.cta}`}
                    >
                      {shouldShowTaskStep
                        ? t('assessment_journey.cta_to_task', { defaultValue: 'Pokračovat na misi' })
                        : t('assessment_journey.cta_next_question', { defaultValue: 'Pokračovat na další otázku' })}
                    </button>
                  </div>
                </div>
              )}

              {phase === 1 && shouldShowTaskStep && currentQuestion && phaseTwoStep === 'task' && (
                <div className="mt-4 rounded-2xl border border-slate-200/75 dark:border-slate-700/80 bg-white/84 dark:bg-slate-950/84 p-4 md:p-5 backdrop-blur-sm">
                  <div className="text-sm text-slate-700 dark:text-slate-200">
                    {t('assessment_journey.task_step_label', {
                      defaultValue: 'Praktická mise {{index}} / {{total}}',
                      index: Math.floor(index / 2) + 1,
                      total: practicalMissionCount,
                    })}
                  </div>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {taskTitle}
                  </h3>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {taskDescription}
                  </p>
                  {taskVariant === 0 && (
                    <>
                      <div className="mt-4 space-y-2">
                        {practicalOrder.map((item, itemIndex) => (
                          <div key={item} className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-sm">
                            <span>{item}</span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => movePracticalItem(itemIndex, -1)} className="w-7 h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100">↑</button>
                              <button onClick={() => movePracticalItem(itemIndex, 1)} className="w-7 h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100">↓</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {taskVariant === 1 && (
                    <>
                      <div className="mt-4 text-xs text-slate-500 dark:text-slate-300">{t('assessment_journey.task_variant_strategy', { defaultValue: 'Vyberte přístup, který je vám nejbližší:' })}</div>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {['Nejdřív uklidnit situaci', 'Postavit jasný plán', 'Zapojit klíčové lidi', 'Rychle ověřit první krok'].map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setStrategyChoice(opt)}
                            className={`rounded-lg border px-3 py-2 text-left ${strategyChoice === opt ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100'}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {taskVariant === 2 && (
                    <>
                      <div className="mt-4 text-xs text-slate-500 dark:text-slate-300">{t('assessment_journey.task_variant_signals', { defaultValue: 'Které 1-2 signály jsou teď nejdůležitější?' })}</div>
                      <div className="mt-2 flex flex-wrap gap-2 text-sm">
                        {['Jasné priority', 'Klidná komunikace', 'Rychlá reakce', 'Kvalita výstupu', 'Důvěra v týmu'].map((opt) => {
                          const active = signalChoices.includes(opt);
                          return (
                            <button
                              key={opt}
                              onClick={() => setSignalChoices((prev) => active ? prev.filter((x) => x !== opt) : [...prev, opt].slice(-2))}
                              className={`rounded-full border px-3 py-1.5 ${active ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100'}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {taskVariant === 3 && (
                    <>
                      <div className="mt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-300">
                        <span>{t('assessment_journey.task_variant_resources', { defaultValue: 'Rozdělte 10 bodů kapacity' })}</span>
                        <span className="rounded-full border border-slate-200 dark:border-slate-700 px-2 py-0.5">
                          {resourceSplit.stability + resourceSplit.speed + resourceSplit.quality}/10
                        </span>
                      </div>
                      <div className="mt-2 space-y-2">
                        {[
                          ['stability', 'Stabilita'],
                          ['speed', 'Rychlost'],
                          ['quality', 'Kvalita'],
                        ].map(([key, label]) => {
                          const value = resourceSplit[key as 'stability' | 'speed' | 'quality'];
                          return (
                            <div key={key} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2">
                              <div className="flex items-center justify-between text-sm">
                                <span>{label}</span>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => adjustResource(key as 'stability' | 'speed' | 'quality', -1)} className="w-7 h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">-</button>
                                  <span className="w-6 text-center font-semibold">{value}</span>
                                  <button onClick={() => adjustResource(key as 'stability' | 'speed' | 'quality', 1)} className="w-7 h-7 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">+</button>
                                </div>
                              </div>
                              <div className="mt-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-500" style={{ width: `${value * 10}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {taskVariant === 4 && (
                    <>
                      <div className="mt-4 text-xs text-slate-500 dark:text-slate-300">{t('assessment_journey.task_variant_sequence', { defaultValue: 'Vyberte první a druhý krok:' })}</div>
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {['Vyjasnit očekávání', 'Zapojit stakeholdery', 'Rychle ověřit hypotézu', 'Sepsat krátký plán'].map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              if (!firstMove || firstMove === opt) {
                                setFirstMove(opt);
                                if (secondMove === opt) setSecondMove('');
                                return;
                              }
                              setSecondMove(opt);
                            }}
                            className={`rounded-lg border px-3 py-2 text-left ${
                              firstMove === opt
                                ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800'
                                : secondMove === opt
                                  ? 'border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                            }`}
                          >
                            <div className="font-medium">{opt}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-300">
                              {firstMove === opt ? t('assessment_journey.first_move', { defaultValue: '1. krok' }) : secondMove === opt ? t('assessment_journey.second_move', { defaultValue: '2. krok' }) : '\u00A0'}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="mt-4">
                    <div className="text-xs text-slate-500 dark:text-slate-300 mb-1">{t('assessment_journey.task_note_label', { defaultValue: 'Krátká poznámka (volitelné)' })}</div>
                    <textarea
                      value={taskNote}
                      onChange={(e) => setTaskNote(e.target.value)}
                      className="w-full h-20 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm text-slate-800 dark:text-slate-100"
                      placeholder={t('assessment_journey.task_note_placeholder', { defaultValue: 'Co vás vedlo k tomuto kroku?' })}
                    />
                  </div>
                  {microInsights.length > 0 && (
                    <div className="mt-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-3 text-sm">
                      {microInsights[microInsights.length - 1].text}
                    </div>
                  )}
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleNext}
                      disabled={!taskReady}
                      className={`px-4 py-2 rounded-lg font-semibold disabled:opacity-40 ${theme.cta}`}
                    >
                      {t('assessment_journey.cta_finish_checkpoint', { defaultValue: 'Dokončit checkpoint' })}
                    </button>
                  </div>
                </div>
              )}

              {phase === 2 && index >= questions.length - 1 && (
                <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                  <h3 className="text-lg font-semibold">{t('assessment_journey.phase_2', { defaultValue: 'Zrcadlení vzorců' })}</h3>
                  <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                    {behavioralConsistency.recurring_motifs.slice(0, 3).map((x) => (
                      <div key={x}>• {x}</div>
                    ))}
                    {behavioralConsistency.recurring_motifs.length === 0 && <div>• {t('assessment_journey.default_pattern_hint', { defaultValue: 'Začíná se rýsovat váš rozhodovací styl.' })}</div>}
                  </div>
                  <button onClick={() => proceedTo(3, 'mirroring_shown')} className={`mt-4 px-4 py-2 rounded-lg font-semibold ${theme.cta}`}>
                    {t('assessment_journey.cta_to_phase3', { defaultValue: 'Pokračovat na energetický kompas' })}
                  </button>
                </div>
              )}

              {phase === 3 && (
                <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                  <h3 className="text-lg font-semibold">{t('assessment_journey.phase_3', { defaultValue: 'Energetický kompas' })}</h3>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{energySnapshotLabel}</p>
                  <button onClick={() => proceedTo(4, 'resource_leak_shown')} className={`mt-4 px-4 py-2 rounded-lg font-semibold ${theme.cta}`}>
                    {t('assessment_journey.cta_to_phase4', { defaultValue: 'Pokračovat na Cultural Northstar' })}
                  </button>
                </div>
              )}

              {phase === 4 && (
                <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
                  <h3 className="text-lg font-semibold">{t('assessment_journey.phase_4', { defaultValue: 'Cultural Northstar' })}</h3>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                    {t('assessment_journey.northstar_explainer', {
                      defaultValue:
                        'Northstar je váš preferovaný pracovní kontext: v jakém prostředí podáváte nejlepší výkon a kde naopak energie rychle klesá.',
                    })}
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                    <div>{culturalOrientation.transparency}</div>
                    <div>{culturalOrientation.conflict_response}</div>
                    <div>{culturalOrientation.hierarchy_vs_autonomy}</div>
                    <div>{culturalOrientation.process_vs_outcome}</div>
                    <div>{culturalOrientation.stability_vs_dynamics}</div>
                  </div>
                  {renderNorthstarPulse('classic')}
                  <button
                    onClick={handleFinalize}
                    disabled={!northstarCompleted}
                    className={`mt-4 px-4 py-2 rounded-lg font-semibold disabled:opacity-45 ${theme.cta}`}
                  >
                    {t('assessment_journey.cta_finalize', { defaultValue: 'Vytvořit souhrnný profil' })}
                  </button>
                </div>
              )}

              {phase === 5 && (
                <div className="mt-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
                  <h3 className="text-lg font-semibold">{t('assessment_journey.phase_5', { defaultValue: 'Souhrnný profil' })}</h3>
                  <div>
                    <h4 className={`font-semibold ${theme.accent}`}>Basic Personality Profile</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{basicPersonalityCode} (E {northstarAxisScores.EI}% / N {northstarAxisScores.SN}% / F {northstarAxisScores.TF}% / P {northstarAxisScores.JP}%)</p>
                  </div>
                  <div>
                    <h4 className={`font-semibold ${theme.accent}`}>Decision Pattern</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{t('assessment_journey.final_pattern_summary', { defaultValue: 'Máte čitelný rozhodovací styl, který je možné dobře převést do role.' })}</p>
                  </div>
                  <div>
                    <h4 className={`font-semibold ${theme.accent}`}>Energy Balance</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{energySnapshotLabel}</p>
                  </div>
                  <div>
                    <h4 className={`font-semibold ${theme.accent}`}>Cultural Orientation</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{culturalOrientation.transparency}</p>
                  </div>
                  <div>
                    <h4 className={`font-semibold ${theme.accent}`}>Transferable Strengths</h4>
                    <div className="text-sm text-slate-700 dark:text-slate-200">{finalProfile.transferable_strengths.join(' • ')}</div>
                  </div>
                  <div>
                    <h4 className={`font-semibold ${theme.accent}`}>Rizikové zóny</h4>
                    <div className="text-sm text-slate-700 dark:text-slate-200">{finalProfile.risk_zones.join(' • ')}</div>
                  </div>
                  <div>
                    <h4 className={`font-semibold ${theme.accent}`}>What environments amplify you</h4>
                    <div className="text-sm text-slate-700 dark:text-slate-200">{finalProfile.amplify_environments.join(' • ')}</div>
                  </div>
                  <div>
                    <h4 className={`font-semibold ${theme.accent}`}>What environments drain you</h4>
                    <div className="text-sm text-slate-700 dark:text-slate-200">{finalProfile.drain_environments.join(' • ')}</div>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        void trackAnalyticsEvent({
                          event_type: 'assessment_apply_clicked_after_journey',
                          feature: 'assessment_journey',
                          metadata: { mode: assessmentMode, ...EXPERIENCE_META },
                        });
                        onComplete('journey-completed');
                      }}
                      className={`px-4 py-2 rounded-lg font-semibold ${theme.cta}`}
                    >
                      {t('assessment_journey.cta_complete', { defaultValue: 'Dokončit cestu' })}
                    </button>
                  </div>
                </div>
              )}
            </main>

            <aside className="hidden xl:flex rounded-2xl border border-slate-200/75 dark:border-slate-700/80 bg-white/78 dark:bg-slate-950/78 p-4 h-full flex-col backdrop-blur-sm order-3">
              <div className={`text-xs uppercase tracking-[0.14em] ${theme.accent}`}>
                {t('assessment_journey.mission_brief_title', { defaultValue: 'Průvodce' })}
              </div>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                {t('assessment_journey.role_context_question', {
                  defaultValue: 'Tento krok simuluje situace, které můžete řešit v roli {{role}}.',
                  role: roleLabel,
                })}
              </p>
              {microInsights.length > 0 && (
                <div className="mt-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-3 text-sm">
                  {microInsights[microInsights.length - 1].text}
                </div>
              )}
              {microReward && (
                <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                  {microReward}
                </div>
              )}
              {mode === 'preview' && (
                <div className="mt-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-xs text-slate-700 dark:text-slate-200">
                  {t('assessment_journey.preview_note_title', { defaultValue: 'Recruiter Preview' })}
                  <div className="mt-1">{t('assessment_journey.preview_note_body', { defaultValue: 'Odpovědi jsou předvyplněné pro rychlé proklikání kandidátského flow.' })}</div>
                </div>
              )}
              {phase >= 4 && (
                <div className="mt-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-3 text-sm">
                  {t('assessment_journey.northstar_explainer_short', {
                    defaultValue: 'Northstar = jaké firemní prostředí vás přirozeně posiluje.',
                  })}
                </div>
              )}

              <div className="mt-4 text-xs text-slate-600 dark:text-slate-300">{aiDisclaimer}</div>
              <div className="mt-auto pt-4">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  {t('assessment_journey.focus_tip', { defaultValue: 'Tip: odpovídejte krátce a přirozeně. Nejde o perfektní formulaci.' })}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentJourneyFlow;
