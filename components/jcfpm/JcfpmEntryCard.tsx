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
    badge: 'Kariérní profil',
    title: 'Jaká práce vám sedí',
    description: 'Krátký test, který pomůže pojmenovat vaše silné stránky, pracovní preference a typ rolí, ve kterých se budete cítit dlouhodobě dobře.',
    statDimensions: '12 dimenzí',
    statAiReadiness: 'Skóre adaptace na změny',
    statAnchors: 'Kariérní kotvy',
    viewResults: 'Zobrazit výsledky',
    resume: 'Pokračovat v testu',
    start: 'Spustit test',
    reset: 'Reset',
    deepDive: 'Deep Dive',
    unlockPremium: 'ODEMKNOUT PREMIUM',
    unlockPremiumAnalysis: 'Odemknout plný rozbor',
    viewBasicResults: 'Zobrazit základní výsledky',
    updatedAt: 'Aktualizováno',
  },
  en: {
    badge: 'Career profile',
    title: 'What kind of work fits you',
    description: 'A short test that helps name your strengths, work preferences, and the types of roles where you are most likely to do well long term.',
    statDimensions: '12 dimensions',
    statAiReadiness: 'Change adaptability score',
    statAnchors: 'Career anchors',
    viewResults: 'View results',
    resume: 'Resume test',
    start: 'Start test',
    reset: 'Reset',
    deepDive: 'Deep Dive',
    unlockPremium: 'UNLOCK PREMIUM',
    unlockPremiumAnalysis: 'Unlock full report',
    viewBasicResults: 'View basic results',
    updatedAt: 'Updated',
  },
  de: {
    badge: 'Karriereprofil',
    title: 'Welche Arbeit zu Ihnen passt',
    description: 'Ein kurzer Test, der Ihre Stärken, Arbeitspräferenzen und die Rollen sichtbar macht, in denen Sie sich langfristig wohlfühlen können.',
    statDimensions: '12 Dimensionen',
    statAiReadiness: 'Anpassungsfähigkeit an Veränderungen',
    statAnchors: 'Karriereanker',
    viewResults: 'Ergebnisse anzeigen',
    resume: 'Test fortsetzen',
    start: 'Test starten',
    reset: 'Zurücksetzen',
    deepDive: 'Deep Dive',
    unlockPremium: 'PREMIUM FREISCHALTEN',
    unlockPremiumAnalysis: 'Vollen Bericht freischalten',
    viewBasicResults: 'Basis-Ergebnisse anzeigen',
    updatedAt: 'Aktualisiert',
  },
  at: {
    badge: 'Karriereprofil',
    title: 'Welche Arbeit zu Ihnen passt',
    description: 'Ein kurzer Test, der Ihre Stärken, Arbeitspräferenzen und die Rollen sichtbar macht, in denen Sie sich langfristig wohlfühlen können.',
    statDimensions: '12 Dimensionen',
    statAiReadiness: 'Anpassungsfähigkeit an Veränderungen',
    statAnchors: 'Karriereanker',
    viewResults: 'Ergebnisse anzeigen',
    resume: 'Test fortsetzen',
    start: 'Test starten',
    reset: 'Zurücksetzen',
    deepDive: 'Deep Dive',
    unlockPremium: 'PREMIUM FREISCHALTEN',
    unlockPremiumAnalysis: 'Vollen Bericht freischalten',
    viewBasicResults: 'Basis-Ergebnisse anzeigen',
    updatedAt: 'Aktualisiert',
  },
  pl: {
    badge: 'Profil kariery',
    title: 'Jaka praca pasuje do Ciebie',
    description: 'Krótki test, który pomaga nazwać Twoje mocne strony, preferencje w pracy i typy ról, w których możesz dobrze funkcjonować na dłuższą metę.',
    statDimensions: '12 wymiarów',
    statAiReadiness: 'Gotowość na zmiany',
    statAnchors: 'Kotwice kariery',
    viewResults: 'Zobacz wyniki',
    resume: 'Wznów test',
    start: 'Rozpocznij test',
    reset: 'Resetuj',
    deepDive: 'Deep Dive',
    unlockPremium: 'ODBLOKUJ PREMIUM',
    unlockPremiumAnalysis: 'Odblokuj pełną analizę',
    viewBasicResults: 'Zobacz podstawowy wynik',
    updatedAt: 'Zaktualizowano',
  },
  sk: {
    badge: 'Kariérny profil',
    title: 'Aká práca vám sedí',
    description: 'Krátky test, ktorý pomôže pomenovať vaše silné stránky, pracovné preferencie a typ rolí, v ktorých sa môžete cítiť dlhodobo dobre.',
    statDimensions: '12 dimenzií',
    statAiReadiness: 'Pripravenosť na zmeny',
    statAnchors: 'Kariérne kotvy',
    viewResults: 'Zobraziť výsledky',
    resume: 'Pokračovať v teste',
    start: 'Spustiť test',
    reset: 'Reset',
    deepDive: 'Deep Dive',
    unlockPremium: 'ODOMKNÚŤ PREMIUM',
    unlockPremiumAnalysis: 'Odomknúť plný rozbor',
    viewBasicResults: 'Zobraziť základný výsledok',
    updatedAt: 'Aktualizované',
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
    <div className="jcfpm-entry-card group relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-elevated)] transition-all duration-300 hover:border-[rgba(var(--accent-rgb),0.22)] hover:shadow-[var(--shadow-card)]">
      {/* 3D Background Teaser */}
      <div className="absolute inset-0 z-0 opacity-40 dark:opacity-20 transition-opacity group-hover:opacity-60 dark:group-hover:opacity-30">
        <SceneShell
          capability={sceneCapability}
          fallback={<div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,249,235,0.9),rgba(255,255,255,0.96))] dark:bg-[linear-gradient(180deg,rgba(29,21,7,0.22),rgba(10,18,32,0.94))]" />}
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
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
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
                <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                {copy.statDimensions}
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                {copy.statAiReadiness}
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                {copy.statAnchors}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-[240px]">
            {hasSnapshot ? (
              <>
                <button
                  type="button"
                  onClick={onView}
                  className="app-button-primary flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <FileText className="h-5 w-5" />
                  {isPremium ? copy.viewResults : copy.viewBasicResults}
                </button>

                <div className={`grid gap-2 mt-2 ${isPremium ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <button
                    type="button"
                    onClick={onRestart}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all hover:bg-white dark:hover:bg-slate-800"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {copy.reset}
                  </button>
                  {isPremium ? (
                    <button
                      type="button"
                      onClick={onStartDeep}
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-800/50 px-3 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-all hover:bg-white dark:hover:bg-slate-800"
                    >
                      {copy.deepDive}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onUpgrade}
                      className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-400 transition-all hover:bg-amber-500/20"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      {copy.unlockPremiumAnalysis}
                    </button>
                  )}
                </div>
              </>
            ) : hasDraft ? (
              <>
                <button
                  type="button"
                  onClick={onResume}
                  className="app-button-primary flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-bold hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Play className="h-5 w-5" />
                  {copy.resume}
                </button>
                {!isPremium && (
                  <button
                    type="button"
                    onClick={onUpgrade}
                    className="mt-2 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 px-6 py-4 text-sm font-black text-amber-700 dark:text-amber-400 transition-all hover:bg-amber-500/20 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Lock className="h-5 w-5" />
                    {copy.unlockPremium}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onStartCore}
                  className="app-button-primary flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Play className="h-5 w-5" />
                  {copy.start}
                </button>
                {!isPremium && (
                  <button
                    type="button"
                    onClick={onUpgrade}
                    className="mt-2 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 px-6 py-4 text-sm font-black text-amber-700 dark:text-amber-400 transition-all hover:bg-amber-500/20 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Lock className="h-5 w-5" />
                    {copy.unlockPremium}
                  </button>
                )}
              </>
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
