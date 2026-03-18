import React from 'react';
import { Compass, Layers3, LocateFixed } from 'lucide-react';

import { CareerMap } from '../CareerMap';
import PublicActivityPanel from '../PublicActivityPanel';
import { SurfaceCard } from '../ui/primitives';
import type { CareerMapGraphModel, Job } from '../../types';

interface ChallengeMapWorkspaceProps {
  jobs: Job[];
  selectedJobId: string | null;
  selectedCompanyName?: string | null;
  selectedJobTitle?: string | null;
  centerNode?: {
    title: string;
    subtitle?: string | null;
    avatarUrl?: string | null;
    helper?: string | null;
  } | null;
  graphData: CareerMapGraphModel | null;
  loading: boolean;
  error: string | null;
  mode: 'taxonomy' | 'hierarchy';
  onSelectJob: (jobId: string | null) => void;
  locale?: string;
}

const ChallengeMapWorkspace: React.FC<ChallengeMapWorkspaceProps> = ({
  jobs,
  selectedJobId,
  selectedCompanyName,
  selectedJobTitle,
  centerNode,
  graphData,
  loading,
  error,
  mode,
  onSelectJob,
  locale = 'en',
}) => {
  const language = String(locale || 'en').split('-')[0].toLowerCase();
  const copy = language === 'cs'
    ? {
      ecosystem: 'Mapový ekosystém',
      radar: 'Mapový radar',
        hierarchyBody: 'Projeď mapu od oborů přes firmy až ke konkrétním výzvám.',
        radarBody: 'Mrkni, jaké sousední světy se motají kolem téhle příležitosti.',
      roles: 'rolí',
    }
    : language === 'sk'
      ? {
        ecosystem: 'Mapový ekosystém',
        radar: 'Mapový radar',
        hierarchyBody: 'Približuj od oborov cez firmy až ku konkrétnym výzvam.',
        radarBody: 'Preskúmaj susedné rodiny rolí okolo aktuálnej príležitosti.',
        roles: 'rolí',
      }
      : language === 'de'
        ? {
          ecosystem: 'Karten-Ökosystem',
          radar: 'Karten-Radar',
          hierarchyBody: 'Zoomen Sie von Bereichen über Firmen bis zu konkreten Challenges.',
          radarBody: 'Erkunden Sie benachbarte Rollenfamilien rund um die aktuelle Chance.',
          roles: 'Rollen',
        }
        : language === 'pl'
          ? {
            ecosystem: 'Ekosystem mapy',
            radar: 'Radar mapy',
            hierarchyBody: 'Przybliżaj od obszarów przez firmy aż do konkretnych wyzwań.',
            radarBody: 'Odkrywaj sąsiednie rodziny ról wokół aktualnej okazji.',
            roles: 'ról',
          }
          : {
            ecosystem: 'Map ecosystem',
            radar: 'Map radar',
            hierarchyBody: 'Run through the map from domains to companies to specific challenges.',
            radarBody: 'See which neighboring role worlds orbit around this opportunity.',
            roles: 'roles',
          };

  return (
  <div className="relative min-h-[68vh] w-full space-y-4 lg:min-h-[calc(100dvh-var(--app-header-height)-120px)]">
    <SurfaceCard variant="frost" className="rounded-[28px] p-4 shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
            {mode === 'hierarchy' ? copy.ecosystem : copy.radar}
          </div>
          <div className="text-sm text-[var(--text-muted)]">
            {mode === 'hierarchy'
              ? copy.hierarchyBody
              : copy.radarBody}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-muted)] px-3 py-1.5 dark:bg-white/5">
            <Layers3 size={14} />
            {jobs.length} {copy.roles}
          </span>
          {selectedCompanyName ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-muted)] px-3 py-1.5 dark:bg-white/5">
              <LocateFixed size={14} />
              {selectedCompanyName}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-muted)] px-3 py-1.5 dark:bg-white/5">
            <Compass size={14} />
            {mode}
          </span>
        </div>
      </div>
    </SurfaceCard>

    <div className="app-frost-panel relative min-h-[60vh] w-full overflow-hidden rounded-[32px] border border-[var(--border-subtle)] lg:min-h-[calc(100dvh-var(--app-header-height)-220px)]">
      <div className="absolute inset-0">
        <CareerMap
          className="h-full w-full"
          jobs={jobs}
          selectedJobId={selectedJobId}
          graphData={graphData}
          loading={loading}
          error={error}
          mode={mode}
          centerNode={centerNode || (selectedCompanyName && selectedJobTitle ? { title: selectedCompanyName, subtitle: selectedJobTitle } : null)}
          locale={locale}
          onSelectJob={(id) => onSelectJob(id)}
        />

        <div className="pointer-events-none absolute right-4 top-4 z-20 hidden w-[min(360px,calc(100%-2rem))] xl:block">
          <PublicActivityPanel mode="discovery" compact className="shadow-[0_24px_70px_-52px_rgba(15,23,42,0.38)]" />
        </div>
      </div>
    </div>
  </div>
  );
};

export default ChallengeMapWorkspace;
