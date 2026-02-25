import React from 'react';
import { Compass, Lock, Play, RotateCcw } from 'lucide-react';

interface Props {
  isPremium: boolean;
  hasDraft: boolean;
  hasSnapshot: boolean;
  lastUpdatedAt?: string;
  onStart: () => void;
  onUpgrade: () => void;
}

const IkigaiGuideEntryCard: React.FC<Props> = ({
  isPremium,
  hasDraft,
  hasSnapshot,
  lastUpdatedAt,
  onStart,
  onUpgrade,
}) => {
  const ctaLabel = hasDraft ? 'Pokračovat v misi' : hasSnapshot ? 'Spustit znovu' : 'Spustit IKIGAI průvodce';

  return (
    <div className="ikigai-entry-card rounded-3xl border border-cyan-200/35 bg-slate-950/60 p-6 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
            <Compass className="h-3.5 w-3.5" />
            IKIGAI Navigator 3D
          </div>
          <h3 className="mt-3 text-2xl font-semibold text-cyan-50">Biophilic průvodce kariérou</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-200/90">
            Řízený 6-8 minutový cockpit, který mapuje, co tě baví, v čem jsi silný, co je potřeba a kde máš nejvyšší hodnotu.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-100 md:grid-cols-3">
        <div className="ikigai-glass-chip">4 kvadranty + společný průnik</div>
        <div className="ikigai-glass-chip">12 položek mini osobnostního profilu</div>
        <div className="ikigai-glass-chip">Privátní výsledek viditelný jen tobě</div>
      </div>

      {hasSnapshot && lastUpdatedAt ? (
        <p className="mt-4 text-xs text-cyan-200/80">Naposledy uloženo: {new Date(lastUpdatedAt).toLocaleString()}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {isPremium ? (
          <button
            type="button"
            onClick={onStart}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/60 bg-cyan-400/20 px-5 py-2.5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/30"
          >
            {hasDraft ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {ctaLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-300/55 bg-amber-400/20 px-5 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-amber-400/30"
          >
            <Lock className="h-4 w-4" />
            Odemknout premium
          </button>
        )}
      </div>
      {isPremium ? (
        <p className="mt-3 text-xs text-cyan-100/80">Spustí se v immersive režimu přes téměř celou obrazovku.</p>
      ) : null}
    </div>
  );
};

export default IkigaiGuideEntryCard;
