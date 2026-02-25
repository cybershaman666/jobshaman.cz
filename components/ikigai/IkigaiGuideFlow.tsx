import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Save, X } from 'lucide-react';
import { IkigaiSnapshotV1, ThreeSceneCapability } from '../../types';
import SceneShell from '../three/SceneShell';
import IkigaiBiomeScene from '../three/IkigaiBiomeScene';
import IkigaiMetricHUD from './IkigaiMetricHUD';
import IkigaiResultPanel from './IkigaiResultPanel';
import { IKIGAI_PSYCH_ITEMS } from '../../services/ikigaiPsychometrics';
import { clearIkigaiDraft, readIkigaiDraft, writeIkigaiDraft } from '../../services/ikigaiSessionState';
import {
  IkigaiFlowState,
  IkigaiStep,
  buildIkigaiSnapshot,
  canAdvanceIkigaiStep,
} from '../../services/ikigaiFlowService';

interface Props {
  initialSnapshot?: IkigaiSnapshotV1 | null;
  capability: ThreeSceneCapability;
  performanceMode?: 'low' | 'medium' | 'high';
  onPersist: (snapshot: IkigaiSnapshotV1) => void | Promise<void>;
  onClose: () => void;
}

const STEPS: IkigaiStep[] = ['love', 'strength', 'need', 'reward', 'psych', 'synthesis'];
const LOBE_TO_STEP: Record<'love' | 'strength' | 'need' | 'reward', IkigaiStep> = {
  love: 'love',
  strength: 'strength',
  need: 'need',
  reward: 'reward',
};

const DOMAIN_LEVELS = [20, 40, 60, 80, 100] as const;

const DOMAIN_LABELS: Record<number, string> = {
  20: 'Velmi nízké',
  40: 'Nižší',
  60: 'Vyvážené',
  80: 'Vysoké',
  100: 'Velmi vysoké',
};

const LIKERT_OPTIONS = [
  { value: 1, short: '1', label: 'Silně nesouhlasím' },
  { value: 2, short: '2', label: 'Spíše nesouhlasím' },
  { value: 3, short: '3', label: 'Neutrální' },
  { value: 4, short: '4', label: 'Spíše souhlasím' },
  { value: 5, short: '5', label: 'Silně souhlasím' },
] as const;

const emptyDomain = () => ({ energy: 60, clarity: 60, sustainability: 60, notes: '' });

const defaultFlowState = (): IkigaiFlowState => ({
  love: emptyDomain(),
  strength: emptyDomain(),
  need: emptyDomain(),
  reward: emptyDomain(),
  psychAnswers: {},
});

const toDomain = (raw: unknown) => {
  const source = (raw || {}) as Partial<IkigaiFlowState['love']>;
  const normalize = (value: unknown): number => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return 60;
    return Math.min(100, Math.max(0, Math.round(parsed)));
  };
  return {
    energy: normalize(source.energy),
    clarity: normalize(source.clarity),
    sustainability: normalize(source.sustainability),
    notes: typeof source.notes === 'string' ? source.notes : '',
  };
};

const flowFromSnapshot = (snapshot?: IkigaiSnapshotV1 | null): IkigaiFlowState => {
  if (!snapshot) return defaultFlowState();
  const raw = snapshot.raw_answers || {};
  return {
    love: toDomain(raw.love),
    strength: toDomain(raw.strength),
    need: toDomain(raw.need),
    reward: toDomain(raw.reward),
    psychAnswers: typeof raw.psych_answers === 'object' && raw.psych_answers
      ? Object.fromEntries(
        Object.entries(raw.psych_answers as Record<string, unknown>)
          .map(([key, value]) => [key, Number(value)])
          .filter(([, value]) => Number.isFinite(value))
      )
      : {},
  };
};

const stepTitle: Record<Exclude<IkigaiStep, 'synthesis'>, string> = {
  love: 'Co tě skutečně nabíjí',
  strength: 'V čem máš prokazatelnou sílu',
  need: 'Co je reálně potřebné',
  reward: 'Kde to má tržní hodnotu',
  psych: 'Psych profil: jasná škála 1-5',
};

const stepPrompt: Record<Exclude<IkigaiStep, 'synthesis'>, string> = {
  love: 'Vybírej podle toho, jak často se na podobnou práci těšíš už předem.',
  strength: 'Vybírej podle reálných výsledků, ne podle dojmu.',
  need: 'Vybírej podle dopadu na tým, zákazníka nebo byznys.',
  reward: 'Vybírej podle toho, za co je trh ochoten dobře zaplatit.',
  psych: 'U každé věty je škála stejná: 1 = nesouhlasím, 5 = souhlasím.',
};

const domainMainQuestion: Record<Exclude<IkigaiStep, 'psych' | 'synthesis'>, string> = {
  love: 'Když máš svobodnou volbu práce, jak moc tě tento typ činností přirozeně táhne?',
  strength: 'Když jsi pod tlakem, jak spolehlivě doručíš výsledek právě v této oblasti?',
  need: 'Jak důležitý je tento typ přínosu pro tým, zákazníka nebo byznys?',
  reward: 'Jak dobře se tato hodnota proměňuje v kariérní růst a odměnu na trhu?',
};

const domainQuestions: Record<
  Exclude<IkigaiStep, 'psych' | 'synthesis'>,
  Record<'energy' | 'clarity' | 'sustainability', { title: string; guide: string }>
> = {
  love: {
    energy: {
      title: 'Kolik energie ti to dlouhodobě dává?',
      guide: '20 = vyčerpává tě to, 60 = střídavě, 100 = dlouhodobě tě to nabíjí.',
    },
    clarity: {
      title: 'Jak jasně víš, co v této oblasti chceš dělat?',
      guide: '20 = tápu, 60 = mám směr, 100 = mám velmi konkrétní představu.',
    },
    sustainability: {
      title: 'Udržel(a) bys tohle tempo i za 2 roky?',
      guide: '20 = dlouhodobě ne, 60 = spíše ano, 100 = bez problémů dlouhodobě.',
    },
  },
  strength: {
    energy: {
      title: 'Jak jistě tuto schopnost používáš pod tlakem?',
      guide: '20 = často selhává, 60 = většinou funguje, 100 = funguje velmi spolehlivě.',
    },
    clarity: {
      title: 'Máš jasné důkazy výsledků (výstupy, metriky)?',
      guide: '20 = skoro žádné důkazy, 60 = pár důkazů, 100 = jasné a opakovatelné důkazy.',
    },
    sustainability: {
      title: 'Je tato síla stabilní napříč projekty?',
      guide: '20 = spíš náhodně, 60 = relativně stabilně, 100 = konzistentně napříč situacemi.',
    },
  },
  need: {
    energy: {
      title: 'Jak moc tě baví řešit tenhle typ problému?',
      guide: '20 = nebaví, 60 = neutrální až ok, 100 = výrazně tě to táhne.',
    },
    clarity: {
      title: 'Je jasné, komu tím konkrétně pomáháš?',
      guide: '20 = nejasný dopad, 60 = částečně jasný, 100 = velmi konkrétní dopad.',
    },
    sustainability: {
      title: 'Bude tato potřeba důležitá i dál?',
      guide: '20 = spíš dočasné, 60 = středně stabilní, 100 = dlouhodobě klíčové.',
    },
  },
  reward: {
    energy: {
      title: 'Máš chuť investovat do této hodnoty další čas?',
      guide: '20 = nechci, 60 = podle okolností, 100 = chci investovat dlouhodobě.',
    },
    clarity: {
      title: 'Umíš svou hodnotu popsat v byznysových výsledcích?',
      guide: '20 = neumím, 60 = částečně, 100 = umím jasně a konkrétně.',
    },
    sustainability: {
      title: 'Dokážeš na tom postavit dlouhodobý kariérní směr?',
      guide: '20 = spíš ne, 60 = možná, 100 = ano, je to stabilní základ.',
    },
  },
};

const IkigaiGuideFlow: React.FC<Props> = ({ initialSnapshot, capability, performanceMode, onPersist, onClose }) => {
  const draftSnapshot = useMemo(() => readIkigaiDraft(), []);
  const baseSnapshot = draftSnapshot || initialSnapshot || null;

  const [flowState, setFlowState] = useState<IkigaiFlowState>(() => flowFromSnapshot(baseSnapshot));
  const [stepIndex, setStepIndex] = useState<number>(() => {
    if (!baseSnapshot) return 0;
    return Math.max(0, STEPS.indexOf(baseSnapshot.progress_step));
  });
  const [isSaving, setIsSaving] = useState(false);
  const currentStep = STEPS[Math.max(0, Math.min(stepIndex, STEPS.length - 1))];

  const snapshot = useMemo(() => buildIkigaiSnapshot(currentStep, flowState), [currentStep, flowState]);
  const progress = Math.round((stepIndex / (STEPS.length - 1)) * 100);

  useEffect(() => {
    writeIkigaiDraft(snapshot);
  }, [snapshot]);

  const handleDomainChange = (
    domain: keyof Omit<IkigaiFlowState, 'psychAnswers'>,
    key: keyof IkigaiFlowState['love'],
    value: string | number
  ) => {
    setFlowState((prev) => ({
      ...prev,
      [domain]: {
        ...prev[domain],
        [key]: key === 'notes' ? String(value) : Math.min(100, Math.max(0, Number(value) || 0)),
      },
    }));
  };

  const handlePsychAnswer = (itemId: string, value: number) => {
    setFlowState((prev) => ({ ...prev, psychAnswers: { ...prev.psychAnswers, [itemId]: value } }));
  };

  const handleNext = () => {
    if (!canAdvanceIkigaiStep(currentStep, flowState.psychAnswers)) return;
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => setStepIndex((prev) => Math.max(prev - 1, 0));

  const handlePersist = async () => {
    setIsSaving(true);
    try {
      await onPersist(buildIkigaiSnapshot('synthesis', flowState));
      clearIkigaiDraft();
    } finally {
      setIsSaving(false);
    }
  };

  const axisBalance = {
    EI: snapshot.psych_profile.axis_scores.extroversion_vs_introversion,
    SN: snapshot.psych_profile.axis_scores.intuition_vs_sensing,
    TF: snapshot.psych_profile.axis_scores.thinking_vs_feeling,
    JP: snapshot.psych_profile.axis_scores.judging_vs_perceiving,
  };

  const domainStep: Exclude<IkigaiStep, 'psych' | 'synthesis'> | null =
    currentStep === 'synthesis' || currentStep === 'psych' ? null : currentStep;
  const domain = domainStep ? flowState[domainStep] : null;
  const safeDomainStep: Exclude<IkigaiStep, 'psych' | 'synthesis'> = domainStep || 'love';
  const activeLobe = domainStep;

  const focusLobeStep = (lobe: 'love' | 'strength' | 'need' | 'reward') => {
    const targetStep = LOBE_TO_STEP[lobe];
    const idx = STEPS.indexOf(targetStep);
    if (idx >= 0) setStepIndex(idx);
  };

  return (
    <div className="relative max-h-[calc(100vh-1rem)] overflow-y-auto rounded-3xl border border-cyan-200/30 p-4 text-white md:max-h-[calc(100vh-2rem)] md:p-6" style={{ background: 'var(--ikigai-bg-deep)' }}>
      <div className="ikigai-bg-orb" />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-cyan-200/80">IKIGAI průvodce</div>
            <p className="mt-1 text-xs text-cyan-100/90">Krok {stepIndex + 1} z {STEPS.length}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-600/70 bg-slate-900/60 p-2 text-slate-200" aria-label="Close IKIGAI navigator">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-900/70">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            {domain ? (
              <div className="ikigai-panel-enter max-h-[58vh] overflow-y-auto rounded-2xl border border-cyan-200/25 bg-slate-950/50 p-4">
                <div className="mb-2 text-sm font-semibold text-cyan-50">{stepTitle[safeDomainStep]}</div>
                <p className="mb-3 text-xs text-cyan-100/90">{stepPrompt[safeDomainStep]}</p>
                <div className="mb-3 rounded-xl border border-amber-200/30 bg-amber-300/10 p-3 text-xs text-amber-50">
                  <div className="font-semibold">Hlavní otázka tohoto kroku</div>
                  <div className="mt-1">{domainMainQuestion[safeDomainStep]}</div>
                </div>
                <div className="grid gap-4">
                  {(['energy', 'clarity', 'sustainability'] as const).map((field) => (
                    <div key={field} className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3">
                      <div className="text-sm font-semibold text-cyan-100 capitalize">{field}</div>
                      <p className="mt-1 text-xs text-slate-300">{domainQuestions[safeDomainStep][field].title}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{domainQuestions[safeDomainStep][field].guide}</p>

                      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5" role="radiogroup" aria-label={`${currentStep} ${field}`}>
                        {DOMAIN_LEVELS.map((level) => (
                          <button
                            key={level}
                            type="button"
                            onClick={() => handleDomainChange(safeDomainStep, field, level)}
                            aria-pressed={domain[field] === level}
                            className={`ikigai-choice-btn ${domain[field] === level ? 'ikigai-choice-btn--active' : ''}`}
                          >
                            <span className="text-xs font-bold">{level}</span>
                            <span className="mt-1 text-[11px]">{DOMAIN_LABELS[level]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <label className="mt-4 block text-sm">
                  <span className="mb-1 block text-cyan-100">Důkaz / konkrétní příklad</span>
                  <textarea
                    value={domain.notes}
                    onChange={(event) => handleDomainChange(safeDomainStep, 'notes', event.target.value)}
                    className="h-20 w-full rounded-xl border border-slate-600/80 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
                    placeholder="Napiš 1 konkrétní situaci, kde to bylo vidět v praxi"
                  />
                </label>
              </div>
            ) : null}

            {currentStep === 'psych' ? (
              <div className="ikigai-panel-enter max-h-[62vh] overflow-y-auto rounded-2xl border border-cyan-200/25 bg-slate-950/50 p-4">
                <div className="mb-2 text-sm font-semibold text-cyan-50">{stepTitle.psych}</div>
                <p className="mb-3 text-xs text-cyan-100/90">{stepPrompt.psych}</p>
                <div className="mb-3 rounded-xl border border-cyan-300/30 bg-cyan-400/10 p-3 text-xs text-cyan-50">
                  <div className="font-semibold">Jak číst škálu:</div>
                  <div className="mt-1">1 = Silně nesouhlasím, 3 = Neutrální, 5 = Silně souhlasím. Stejné pro všechny otázky.</div>
                </div>

                <div className="grid gap-3">
                  {IKIGAI_PSYCH_ITEMS.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-700/80 bg-slate-900/70 p-3">
                      <div className="text-sm text-slate-100">{item.prompt}</div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{item.left_label}</span>
                        <span>{item.right_label}</span>
                      </div>

                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-5" role="radiogroup" aria-label={item.prompt}>
                        {LIKERT_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            aria-pressed={flowState.psychAnswers[item.id] === option.value}
                            onClick={() => handlePsychAnswer(item.id, option.value)}
                            className={`ikigai-choice-btn ${flowState.psychAnswers[item.id] === option.value ? 'ikigai-choice-btn--active' : ''}`}
                          >
                            <span className="text-sm font-bold">{option.short}</span>
                            <span className="mt-1 text-[11px]">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {currentStep === 'synthesis' ? (
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-semibold text-cyan-50">Syntéza</div>
                  <p className="text-xs text-cyan-100/90">Zde vidíš průnik všech čtyř oblastí a výsledný IKIGAI profil.</p>
                </div>
                <IkigaiResultPanel snapshot={snapshot} />
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="relative">
              <SceneShell
                capability={capability}
                performanceMode={performanceMode || capability.qualityTier}
                glide
                glideIntensity={0.03}
                className="h-72 w-full overflow-hidden rounded-2xl border border-cyan-200/25"
                fallback={<div className="flex h-full items-center justify-center bg-slate-950/70 text-sm text-slate-300">3D fallback režim je aktivní.</div>}
              >
                <IkigaiBiomeScene
                  progress={progress}
                  coreScore={snapshot.scores.ikigai_core_score}
                  consistency={snapshot.psych_profile.consistency_index}
                  loveScore={snapshot.scores.love_score}
                  strengthScore={snapshot.scores.strength_score}
                  needScore={snapshot.scores.need_score}
                  rewardScore={snapshot.scores.reward_score}
                  activeLobe={activeLobe}
                  onSelectLobe={focusLobeStep}
                />
              </SceneShell>
              <div className="absolute inset-0 text-[11px] font-semibold text-slate-100/95">
                <button
                  type="button"
                  onClick={() => focusLobeStep('love')}
                  className={`absolute left-1/2 top-4 -translate-x-1/2 rounded-full px-2 py-0.5 transition ${activeLobe === 'love' ? 'bg-amber-600/75 text-amber-50' : 'bg-slate-900/45'}`}
                >
                  radost
                </button>
                <button
                  type="button"
                  onClick={() => focusLobeStep('strength')}
                  className={`absolute left-6 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 transition ${activeLobe === 'strength' ? 'bg-lime-600/75 text-lime-50' : 'bg-slate-900/45'}`}
                >
                  silné stránky
                </button>
                <button
                  type="button"
                  onClick={() => focusLobeStep('need')}
                  className={`absolute right-6 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 transition ${activeLobe === 'need' ? 'bg-rose-600/75 text-rose-50' : 'bg-slate-900/45'}`}
                >
                  potřeba
                </button>
                <button
                  type="button"
                  onClick={() => focusLobeStep('reward')}
                  className={`absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 transition ${activeLobe === 'reward' ? 'bg-teal-600/75 text-teal-50' : 'bg-slate-900/45'}`}
                >
                  odměna
                </button>
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-700/70 px-3 py-1 text-[12px] uppercase tracking-wide text-amber-50">ikigai</span>
                <span className="absolute left-[34%] top-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900/45 px-2 py-0.5">vášeň</span>
                <span className="absolute left-[66%] top-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900/45 px-2 py-0.5">mise</span>
                <span className="absolute left-[34%] top-[66%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900/45 px-2 py-0.5">profese</span>
                <span className="absolute left-[66%] top-[66%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900/45 px-2 py-0.5">povolání</span>
              </div>
              <div className="mt-2 text-center text-[11px] text-slate-300">
                Klikni na oblast v diagramu a přepneš se na odpovídající část průvodce.
              </div>
            </div>

            <IkigaiMetricHUD
              progress={progress}
              consistency={snapshot.psych_profile.consistency_index}
              confidence={snapshot.psych_profile.confidence_score}
              axisBalance={axisBalance}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={stepIndex === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600/70 bg-slate-900/70 px-4 py-2 text-sm text-slate-100 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </button>

          <div className="text-xs text-slate-300">Krok {stepIndex + 1} / {STEPS.length}</div>

          {currentStep === 'synthesis' ? (
            <button
              type="button"
              onClick={handlePersist}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/60 bg-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-50 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Ukládám...' : 'Uložit do profilu'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canAdvanceIkigaiStep(currentStep, flowState.psychAnswers)}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/60 bg-cyan-400/20 px-4 py-2 text-sm font-semibold text-cyan-50 disabled:opacity-60"
            >
              Další
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IkigaiGuideFlow;
