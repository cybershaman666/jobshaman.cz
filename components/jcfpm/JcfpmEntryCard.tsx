import React from 'react';
import { Play, RotateCcw, Lock, FileText } from 'lucide-react';

interface Props {
  isPremium: boolean;
  hasSnapshot: boolean;
  hasDraft: boolean;
  lastUpdatedAt?: string;
  onStart: () => void;
  onView: () => void;
  onUpgrade: () => void;
}

const JcfpmEntryCard: React.FC<Props> = ({
  isPremium,
  hasSnapshot,
  hasDraft,
  lastUpdatedAt,
  onStart,
  onView,
  onUpgrade,
}) => {
  const ctaLabel = hasDraft ? 'Pokračovat' : hasSnapshot ? 'Vyplnit znovu' : 'Spustit test';

  return (
    <div className="rounded-3xl border border-emerald-200/40 bg-white/90 p-6 text-slate-800 shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            <FileText className="h-3.5 w-3.5" />
            Career Fit & Potential
          </div>
          <h3 className="mt-3 text-2xl font-semibold text-slate-900">JCFPM test (72 položek)</h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-700">
            Moderní psychometrický test s AI readiness dimenzí a přímým mapováním na role na trhu práce.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm text-slate-800 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">6 dimenzí × 12 položek</div>
        <div className="rounded-xl border border-sky-100 bg-sky-50/60 px-3 py-2">7bodová škála</div>
        <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2">Top role + AI report</div>
      </div>

      {hasSnapshot && lastUpdatedAt ? (
        <p className="mt-4 text-xs text-slate-600">Naposledy dokončeno: {new Date(lastUpdatedAt).toLocaleString()}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {isPremium ? (
          <>
            {hasSnapshot && (
              <button
                type="button"
                onClick={onView}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
              >
                <FileText className="h-4 w-4" />
                Zobrazit report
              </button>
            )}
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
            >
              {hasDraft ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {ctaLabel}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
          >
            <Lock className="h-4 w-4" />
            Odemknout premium
          </button>
        )}
      </div>
    </div>
  );
};

export default JcfpmEntryCard;
