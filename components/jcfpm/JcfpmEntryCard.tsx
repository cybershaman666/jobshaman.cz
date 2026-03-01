import React, { useMemo } from 'react';
import { Play, RotateCcw, Lock, FileText, Sparkles, Trophy } from 'lucide-react';
import SceneShell from '../three/SceneShell';
import JcfpmElegantParticles from '../three/JcfpmElegantParticles';
import { ThreeSceneCapability } from '../../types';
import { useTranslation } from 'react-i18next';

interface Props {
  isPremium: boolean;
  hasSnapshot: boolean;
  hasDraft: boolean;
  lastUpdatedAt?: string;
  onStartCore: () => void;
  onStartDeep: () => void;
  onResume: () => void;
  onRestart: () => void;
  onView: () => void;
  onUpgrade: () => void;
  sceneCapability?: ThreeSceneCapability;
}

const ENTRY_COPY: Record<string, any> = {
  cs: {
    badge: 'Career Intelligence',
    title: 'Career Fit & Potential',
    description: 'Objevte své silné stránky a ideální kariérní směřování skrze 200+ psychometrických bodů. Získejte personalizovaný report a mapování na reálné role.',
    statDimensions: '12 dimenzí',
    statAiReadiness: 'Skóre adaptace na změny',
    statAnchors: 'Kariérní kotvy',
    viewResults: 'Zobrazit výsledky',
    resume: 'Pokračovat v testu',
    start: 'Spustit test',
    reset: 'Reset',
    deepDive: 'Deep Dive',
    unlockPremium: 'ODEMKNOUT PREMIUM',
    updatedAt: 'Aktualizováno',
  },
  en: {
    badge: 'Career Intelligence',
    title: 'Career Fit & Potential',
    description: 'Discover your strengths and ideal career direction through 200+ psychometric signals. Get a personalized report and mapping to real roles.',
    statDimensions: '12 dimensions',
    statAiReadiness: 'Change adaptability score',
    statAnchors: 'Career anchors',
    viewResults: 'View results',
    resume: 'Resume test',
    start: 'Start test',
    reset: 'Reset',
    deepDive: 'Deep Dive',
    unlockPremium: 'UNLOCK PREMIUM',
    updatedAt: 'Updated',
  },
  de: {
    badge: 'Career Intelligence',
    title: 'Career Fit & Potential',
    description: 'Entdecken Sie Ihre Stärken und die ideale Karriererichtung durch 200+ psychometrische Signale. Erhalten Sie einen personalisierten Bericht und eine Zuordnung zu realen Rollen.',
    statDimensions: '12 Dimensionen',
    statAiReadiness: 'Anpassungsfähigkeit an Veränderungen',
    statAnchors: 'Karriereanker',
    viewResults: 'Ergebnisse anzeigen',
    resume: 'Test fortsetzen',
    start: 'Test starten',
    reset: 'Zurücksetzen',
    deepDive: 'Deep Dive',
    unlockPremium: 'PREMIUM FREISCHALTEN',
    updatedAt: 'Aktualisiert',
  },
};

const JcfpmEntryCard: React.FC<Props> = ({
  isPremium,
  hasSnapshot,
  hasDraft,
  lastUpdatedAt,
  onStartCore,
  onStartDeep,
  onResume,
  onRestart,
  onView,
  onUpgrade,
  sceneCapability = { webgl: true, qualityTier: 'medium', reducedMotion: false }
}) => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'cs').split('-')[0];
  const copy = useMemo(() => ENTRY_COPY[locale] || ENTRY_COPY.cs, [locale]);

  return (
    <div className="jcfpm-entry-card group relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 hover:shadow-xl hover:border-cyan-300/50 dark:hover:border-cyan-700/50">
      {/* 3D Background Teaser */}
      <div className="absolute inset-0 z-0 opacity-40 dark:opacity-20 transition-opacity group-hover:opacity-60 dark:group-hover:opacity-30">
        <SceneShell
          capability={sceneCapability}
          fallback={<div className="absolute inset-0 bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-slate-950 dark:to-slate-900" />}
          className="h-full w-full"
          glide
          glideIntensity={0.15}
        >
          <JcfpmElegantParticles qualityTier={sceneCapability.qualityTier} interactive={false} />
        </SceneShell>
      </div>

      <div className="relative z-10 p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200/60 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
              <Sparkles className="h-3 w-3" />
              {copy.badge}
            </div>
            <h3 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {copy.title}
              {hasSnapshot && <Trophy className="ml-3 inline-block h-6 w-6 text-amber-500" />}
            </h3>
            <p className="mt-3 max-w-xl text-base text-slate-600 dark:text-slate-400 leading-relaxed">
              {copy.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <div className="h-2 w-2 rounded-full bg-cyan-500" />
                {copy.statDimensions}
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <div className="h-2 w-2 rounded-full bg-teal-500" />
                {copy.statAiReadiness}
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <div className="h-2 w-2 rounded-full bg-cyan-600" />
                {copy.statAnchors}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-[240px]">
            {isPremium ? (
              <>
                {hasSnapshot ? (
                  <button
                    type="button"
                    onClick={onView}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-cyan-600/20 transition-all hover:bg-cyan-700 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <FileText className="h-5 w-5" />
                    {copy.viewResults}
                  </button>
                ) : hasDraft ? (
                  <button
                    type="button"
                    onClick={onResume}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-teal-600/20 transition-all hover:bg-teal-700 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Play className="h-5 w-5" />
                    {copy.resume}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onStartCore}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-cyan-600/20 transition-all hover:bg-cyan-700 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Play className="h-5 w-5" />
                    {copy.start}
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={onRestart}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all hover:bg-white dark:hover:bg-slate-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {copy.reset}
                  </button>
                  <button
                    type="button"
                    onClick={onStartDeep}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all hover:bg-white dark:hover:bg-slate-800"
                  >
                    {copy.deepDive}
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={onUpgrade}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 px-6 py-5 text-sm font-black text-amber-700 dark:text-amber-400 transition-all hover:bg-amber-500/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Lock className="h-5 w-5" />
                {copy.unlockPremium}
              </button>
            )}
            {hasSnapshot && lastUpdatedAt && (
              <div className="mt-2 text-center text-[11px] text-slate-500 dark:text-slate-500 font-medium">
                {copy.updatedAt}: {new Date(lastUpdatedAt).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JcfpmEntryCard;
