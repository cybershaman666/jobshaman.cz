import React from 'react';
import { ArrowRight, Compass, Plus } from 'lucide-react';

import { cn } from '../../../../components/ui/primitives';
import type { ChallengeWorkspaceView } from '../../../../components/challenges/challengeWorkspaceTypes';

interface MarketplaceHeroProps {
  locale: string;
  activeView: ChallengeWorkspaceView;
  hasNativeChallenges: boolean;
  onExploreFeed: () => void;
  onOpenMap: () => void;
  onCreateChallenge: () => void;
}

const MarketplaceHero: React.FC<MarketplaceHeroProps> = ({
  locale,
  activeView,
  hasNativeChallenges,
  onExploreFeed,
  onOpenMap,
  onCreateChallenge,
}) => {
  const language = locale.split('-')[0].toLowerCase();
  const isCsLike = language === 'cs' || language === 'sk';

  const copy = isCsLike
    ? {
      title: 'Méně CVčka. Víc reálného prvního kroku.',
      body: 'JobShaman není další nekonečný seznam pozic. Otevřeš konkrétní pracovní situaci a místo „mám zájem“ ukážeš, jak bys začal.',
      subline: 'Firmy tak vidí tvoje uvažování dřív než přílohy.',
      viewFeed: 'Prozkoumat feed',
      viewMap: 'Otevřít mapu',
      createChallenge: 'Zadat mini výzvu',
      modeFeed: 'Feed',
      modeMap: 'Mapa',
      nativeLive: 'Nativní výzvy jedou',
      nativeSoon: 'Importy jsou připravené',
    }
    : {
      title: 'Less resume theater. More real first moves.',
      body: 'JobShaman is not another endless list of roles. You open a real work situation and, instead of clicking “I’m interested,” you show how you would begin.',
      subline: 'Teams see your thinking before they see your attachments.',
      viewFeed: 'Explore feed',
      viewMap: 'Open map',
      createChallenge: 'Create mini challenge',
      modeFeed: 'Feed',
      modeMap: 'Map',
      nativeLive: 'Native challenges are live',
      nativeSoon: 'Imports are ready',
    };

  return (
    <section className="app-hero-cosmic overflow-hidden rounded-[calc(var(--radius-2xl)+12px)] shadow-[0_35px_100px_-50px_rgba(8,15,30,0.95)]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_26%,rgba(255,255,255,0.16),transparent_24%),radial-gradient(circle_at_76%_18%,rgba(255,255,255,0.10),transparent_28%),radial-gradient(circle_at_82%_72%,rgba(34,211,238,0.16),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_38%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <div className="absolute -left-12 top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-10 top-12 h-48 w-48 rounded-full bg-cyan-400/12 blur-3xl" />
      </div>

      <div className="relative p-4 lg:p-6">
        <div className="app-frost-panel rounded-[30px] border border-white/20 bg-white/78 p-5 text-slate-950 dark:bg-slate-950/55 dark:text-white lg:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
            <span className="rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1 text-[var(--accent)]">
              JobShaman
            </span>
            <span className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              {activeView === 'map' ? copy.modeMap : copy.modeFeed}
            </span>
            <span
              className={cn(
                'rounded-full border px-3 py-1',
                hasNativeChallenges
                  ? 'border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                  : 'border-slate-200/80 bg-white/70 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
              )}
            >
              {hasNativeChallenges ? copy.nativeLive : copy.nativeSoon}
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-3">
              <h1 className="max-w-4xl text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white sm:text-[3rem] sm:leading-[1.02]">
              {copy.title}
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-700 dark:text-slate-200 sm:text-base">
                {copy.body}
              </p>
              <p className="max-w-2xl text-sm font-medium leading-6 text-[var(--accent)] dark:text-emerald-300">
                {copy.subline}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:justify-end">
              <button type="button" onClick={onExploreFeed} className="app-button-primary !rounded-2xl !px-5 !py-3">
                {copy.viewFeed}
                <ArrowRight size={16} />
              </button>
              <button type="button" onClick={onOpenMap} className="app-button-secondary !rounded-2xl !px-5 !py-3">
                <Compass size={16} />
                {copy.viewMap}
              </button>
              <button type="button" onClick={onCreateChallenge} className="app-button-secondary !rounded-2xl !px-5 !py-3">
                <Plus size={16} />
                {copy.createChallenge}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketplaceHero;
