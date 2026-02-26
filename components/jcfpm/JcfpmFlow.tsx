import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Save, X, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { JcfpmItem, JcfpmSnapshotV1, JcfpmDimensionId } from '../../types';
import { fetchJcfpmItems, submitJcfpm } from '../../services/jcfpmService';
import { clearJcfpmDraft, readJcfpmDraft, writeJcfpmDraft } from '../../services/jcfpmSessionState';
import JcfpmReportPanel from './JcfpmReportPanel';

interface Props {
  initialSnapshot?: JcfpmSnapshotV1 | null;
  mode?: 'form' | 'report';
  onPersist: (snapshot: JcfpmSnapshotV1) => void | Promise<void>;
  onClose: () => void;
}

const DIMENSIONS: { id: JcfpmDimensionId; title: string; subtitle: string }[] = [
  {
    id: 'd1_cognitive',
    title: 'Kognitivní styl',
    subtitle: 'Jak přemýšlíš a jak řešíš problémy.'
  },
  {
    id: 'd2_social',
    title: 'Sociální orientace',
    subtitle: 'Jak funguješ v týmu, komunikaci a leadershipu.'
  },
  {
    id: 'd3_motivational',
    title: 'Motivační profil',
    subtitle: 'Co tě pohání a co považuješ za odměnu.'
  },
  {
    id: 'd4_energy',
    title: 'Energetický pattern',
    subtitle: 'Tempo, intenzita a styl práce.'
  },
  {
    id: 'd5_values',
    title: 'Hodnotová kotvení',
    subtitle: 'Co musí práce přinášet, aby dávala smysl.'
  },
  {
    id: 'd6_ai_readiness',
    title: 'Adaptační kapacita (AI Readiness)',
    subtitle: 'Jak dobře prosperuješ v měnícím se tech prostředí.'
  },
];

const LIKERT = [1, 2, 3, 4, 5, 6, 7];

const INTERLUDES: Record<JcfpmDimensionId, { title: string; body: string }> = {
  d1_cognitive: {
    title: 'Kognitivní styl',
    body: 'Jak přemýšlíš, filtruješ informace a rozhoduješ se. Půjdeme přímo po tvém vnitřním „procesoru“.',
  },
  d2_social: {
    title: 'Sociální orientace',
    body: 'Kde se cítíš nejlépe mezi lidmi? Zda ti víc sedí spolupráce, vedení, nebo klidná samostatnost.',
  },
  d3_motivational: {
    title: 'Motivační profil',
    body: 'Co tě dlouhodobě žene kupředu a co tě naopak vyčerpává. Teď zachytíme tvé motivátory.',
  },
  d4_energy: {
    title: 'Energetický pattern',
    body: 'Tvé tempo, rytmus a pracovní energie. Najdeme styl, ve kterém umíš podávat nejlepší výkon.',
  },
  d5_values: {
    title: 'Hodnotová kotvení',
    body: 'Kdy práce opravdu dává smysl. Tady mapujeme hodnoty, bez kterých to „nesedí“.',
  },
  d6_ai_readiness: {
    title: 'AI readiness',
    body: 'Jak se cítíš v proměnách a nových technologiích. Závěrečný pohled na adaptabilitu.',
  },
};

const JcfpmFlow: React.FC<Props> = ({ initialSnapshot, mode = 'form', onPersist, onClose }) => {
  const draft = readJcfpmDraft();
  const [items, setItems] = useState<JcfpmItem[]>([]);
  const [responses, setResponses] = useState<Record<string, number>>(() => draft?.responses || initialSnapshot?.responses || {});
  const [stepIndex, setStepIndex] = useState<number>(() => draft?.stepIndex ?? 0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'form' | 'report'>(mode);
  const [snapshot, setSnapshot] = useState<JcfpmSnapshotV1 | null>(initialSnapshot || null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [ambientEnabled, setAmbientEnabled] = useState(false);
  const [showInterlude, setShowInterlude] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoadingItems(true);
      setItemsError(null);
      try {
        const fetched = await fetchJcfpmItems();
        if (!mounted) return;
        const list = fetched || [];
        setItems(list);
        if (list.length < 72) {
          setItemsError('Test zatím není připraven – chybí seed 72 položek v databázi.');
        }
      } catch (err: any) {
        if (!mounted) return;
        const msg = String(err?.message || '');
        if (msg.toLowerCase().includes('premium')) {
          setItemsError('Test je dostupný pouze pro premium uživatele.');
        } else if (msg.includes('403')) {
          setItemsError('Nemáte přístup k premium testu.');
        } else if (msg.toLowerCase().includes('seed') || msg.toLowerCase().includes('items')) {
          setItemsError('Test zatím není připraven – chybí seed 72 položek v databázi.');
        } else {
          setItemsError('Nepodařilo se načíst otázky. Zkuste to prosím znovu.');
        }
      } finally {
        if (mounted) setIsLoadingItems(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (viewMode !== 'form') return;
    writeJcfpmDraft({
      stepIndex,
      responses,
      updatedAt: new Date().toISOString(),
    });
  }, [responses, stepIndex, viewMode]);

  const itemsByDimension = useMemo(() => {
    const map: Record<string, JcfpmItem[]> = {};
    items.forEach((item) => {
      const dim = item.dimension || 'd1_cognitive';
      if (!map[dim]) map[dim] = [];
      map[dim].push(item);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
    return map;
  }, [items]);

  const orderedItems = useMemo(() => {
    return [...items].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [items]);

  useEffect(() => {
    if (!orderedItems.length) return;
    setStepIndex((prev) => Math.max(0, Math.min(prev, orderedItems.length - 1)));
  }, [orderedItems.length]);

  const currentItem = orderedItems[stepIndex];
  const currentDim = DIMENSIONS.find((dim) => dim.id === currentItem?.dimension) || DIMENSIONS[0];
  const canAdvance = currentItem ? responses[currentItem.id] != null : false;

  const prevDimRef = React.useRef<string | null>(null);
  const prevStepRef = React.useRef<number>(stepIndex);
  useEffect(() => {
    const currentDimId = currentItem?.dimension || null;
    const prevDimId = prevDimRef.current;
    const prevStep = prevStepRef.current;
    const movingForward = stepIndex > prevStep;
    if (movingForward && prevDimId && currentDimId && prevDimId !== currentDimId) {
      setShowInterlude(true);
    }
    prevDimRef.current = currentDimId;
    prevStepRef.current = stepIndex;
  }, [currentItem?.dimension, stepIndex]);

  const progress = viewMode === 'report'
    ? 100
    : Math.round(((stepIndex + 1) / Math.max(1, orderedItems.length)) * 100);

  const totalAnswered = useMemo(() => Object.keys(responses).length, [responses]);
  const totalQuestions = orderedItems.length || 72;
  const answeredByDimension = useMemo(() => {
    const map: Record<string, number> = {};
    DIMENSIONS.forEach((dim) => {
      const dimItems = itemsByDimension[dim.id] || [];
      map[dim.id] = dimItems.filter((item) => responses[item.id] != null).length;
    });
    return map;
  }, [itemsByDimension, responses]);

  const handleAnswer = (itemId: string, value: number) => {
    setResponses((prev) => ({ ...prev, [itemId]: value }));
    if (soundEnabled) {
      try {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = 528;
          gain.gain.value = 0.03;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.08);
          osc.onended = () => ctx.close();
        }
      } catch {
        // ignore audio errors
      }
    }
  };

  const handleNext = async () => {
    if (!canAdvance) return;
    if (stepIndex < orderedItems.length - 1) {
      if (soundEnabled) {
        try {
          const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = 640;
            gain.gain.value = 0.025;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
            osc.onended = () => ctx.close();
          }
        } catch {
          // ignore audio errors
        }
      }
      setStepIndex((prev) => prev + 1);
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await submitJcfpm(responses);
      if (result) {
        clearJcfpmDraft();
        setSnapshot(result);
        setViewMode('report');
        await onPersist(result);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (viewMode === 'report') {
      setViewMode('form');
      return;
    }
    setStepIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className={`relative jcfpm-shell jcfpm-ambient ${ambientEnabled ? 'is-ambient-on' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-emerald-600/80">Career Fit & Potential</div>
          <p className="mt-1 text-xs text-slate-600">
            {viewMode === 'report'
              ? 'Report'
              : `Otázka ${stepIndex + 1} / ${totalQuestions} • ${totalAnswered} zodpovězeno`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAmbientEnabled((prev) => !prev)}
            className="jcfpm-icon-button"
            aria-label="Toggle ambient"
            title={ambientEnabled ? 'Ambient zapnut' : 'Ambient vypnut'}
          >
            {ambientEnabled ? <Sparkles className="h-4 w-4 text-emerald-700" /> : <Sparkles className="h-4 w-4 text-slate-400" />}
          </button>
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="jcfpm-icon-button"
            aria-label="Toggle sound"
            title={soundEnabled ? 'Zvuk zapnut' : 'Zvuk vypnut'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-700" /> : <VolumeX className="h-4 w-4 text-slate-500" />}
          </button>
          <button type="button" onClick={onClose} className="jcfpm-icon-button" aria-label="Close JCFPM">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-50">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-teal-300 to-sky-300 transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>

      {viewMode === 'report' && snapshot ? (
        <div className="mt-4">
          <JcfpmReportPanel snapshot={snapshot} />
        </div>
      ) : (
        <div className="mt-4 jcfpm-step" key={`jcfpm-step-${stepIndex}`}>
          {showInterlude && (
            <div className="jcfpm-interlude">
              <div className="jcfpm-interlude-card">
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-600">Nová dimenze</div>
                <div className="mt-2 jcfpm-heading text-lg font-semibold text-slate-900">{INTERLUDES[currentDim.id]?.title || currentDim.title}</div>
                <p className="mt-2 text-sm text-slate-600">{currentDim.subtitle}</p>
                <p className="mt-3 text-sm text-slate-600">
                  {INTERLUDES[currentDim.id]?.body}
                </p>
                <button
                  type="button"
                  onClick={() => setShowInterlude(false)}
                  className="mt-5 jcfpm-primary-button"
                >
                  Pokračovat
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <div className={`jcfpm-panel ${showInterlude ? 'is-blurred' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="jcfpm-heading text-base font-semibold text-slate-900">{currentDim.title}</div>
                <p className="mt-1 text-sm text-slate-600">{currentDim.subtitle}</p>
                <p className="mt-2 text-sm text-slate-700 jcfpm-story">
                  {currentDim.id === 'd1_cognitive' && 'Začneme tím, jak přemýšlíš, třídíš informace a rozhoduješ se.'}
                  {currentDim.id === 'd2_social' && 'Teď se podíváme na to, kde se ti nejlépe pracuje s lidmi.'}
                  {currentDim.id === 'd3_motivational' && 'Co tě skutečně pohání? Tady zachytíme tvé motivátory.'}
                  {currentDim.id === 'd4_energy' && 'V této části mapujeme tvé tempo, rytmus a pracovní energii.'}
                  {currentDim.id === 'd5_values' && 'Zachytíme, jaké hodnoty musí práce naplňovat, aby dávala smysl.'}
                  {currentDim.id === 'd6_ai_readiness' && 'Na závěr zjistíme, jak se cítíš v AI a tech změnách.'}
                </p>
              </div>
              <div className="jcfpm-dim-badge">
                {answeredByDimension[currentDim.id] || 0} / {(itemsByDimension[currentDim.id] || []).length}
              </div>
            </div>
            <div className="mt-3 jcfpm-legend">
              1 = Silně nesouhlasím • 4 = Neutrálně • 7 = Silně souhlasím
            </div>
            <div className="mt-4 jcfpm-timeline">
              {DIMENSIONS.map((dim) => (
                <div key={dim.id} className={`jcfpm-timeline-pill ${dim.id === currentDim.id ? 'is-active' : ''}`}>
                  <span className="font-semibold">{dim.title}</span>
                  <span className="text-[11px] text-slate-500">
                    {answeredByDimension[dim.id] || 0}/{(itemsByDimension[dim.id] || []).length}
                  </span>
                </div>
              ))}
            </div>
            {isLoadingItems ? (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-4 text-sm text-slate-500 shadow-sm">
                Načítám otázky…
              </div>
            ) : itemsError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                {itemsError}
              </div>
            ) : (
              <div className={`mt-4 grid gap-3 ${showInterlude ? 'pointer-events-none' : ''}`}>
                {currentItem ? (
                  <div className="jcfpm-question jcfpm-question-animated">
                    <div className="jcfpm-question-title">{currentItem.prompt}</div>
                    {currentItem.subdimension ? (
                    <div className="mt-1 text-[11px] text-slate-600">{currentItem.subdimension}</div>
                    ) : null}
                    <div className="mt-4 grid grid-cols-7 gap-2" role="radiogroup" aria-label={currentItem.prompt}>
                      {LIKERT.map((value) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleAnswer(currentItem.id, value)}
                          aria-pressed={responses[currentItem.id] === value}
                          className={`jcfpm-likert ${responses[currentItem.id] === value ? 'is-active' : ''}`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
                      <span>Spíše nesouhlasím</span>
                      <span>Spíše souhlasím</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          disabled={viewMode === 'form' && stepIndex === 0}
          className="jcfpm-secondary-button disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </button>

        {viewMode === 'form' ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance || isSubmitting || Boolean(itemsError) || isLoadingItems}
            className="jcfpm-primary-button disabled:opacity-60"
          >
            {stepIndex === orderedItems.length - 1 ? (
              <>
                <Save className="h-4 w-4" />
                {isSubmitting ? 'Ukládám...' : 'Dokončit test'}
              </>
            ) : (
              <>
                Další otázka
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="jcfpm-primary-button"
          >
            Zavřít
          </button>
        )}
      </div>
    </div>
  );
};

export default JcfpmFlow;
