import React from 'react';
import { Compass, Globe, Layout, LayoutGrid, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '../ui/primitives';
import type { ChallengeWorkspaceView } from './challengeWorkspaceTypes';

interface ChallengeWorkspaceToolbarProps {
  feedLabel: string;
  mapLabel: string;
  resetLabel: string;
  workspaceView: ChallengeWorkspaceView;
  careerMapMode: 'taxonomy' | 'hierarchy';
  allowMapView?: boolean;
  mobileMenuLabel?: string;
  onOpenMobileMenu?: () => void;
  onWorkspaceViewChange: (view: ChallengeWorkspaceView) => void;
  onCareerMapModeChange: (mode: 'taxonomy' | 'hierarchy') => void;
  onReset: () => void;
}

const ChallengeWorkspaceToolbar: React.FC<ChallengeWorkspaceToolbarProps> = ({
  feedLabel,
  mapLabel,
  resetLabel,
  workspaceView,
  careerMapMode,
  allowMapView = true,
  mobileMenuLabel,
  onOpenMobileMenu,
  onWorkspaceViewChange,
  onCareerMapModeChange,
  onReset,
}) => {
  const { t } = useTranslation();
  const copy = {
    aiBadge: t('workspace.toolbar.ai_badge'),
    taxonomy: t('workspace.toolbar.taxonomy'),
    hierarchy: t('workspace.toolbar.hierarchy'),
    helper: t('workspace.toolbar.helper'),
    filters: t('workspace.toolbar.filters'),
  };

  return (
    <div className="mb-3 shrink-0 rounded-[22px] border border-[rgba(15,23,42,0.05)] bg-[rgba(255,255,255,0.68)] px-2 py-2 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-white/6 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="app-organic-pill inline-flex items-center gap-2 bg-[rgba(var(--accent-rgb),0.12)] px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[var(--accent)] ring-1 ring-inset ring-[rgba(var(--accent-rgb),0.16)]">
            <Sparkles size={13} />
            {copy.aiBadge}
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-[18px] bg-white/72 p-1 dark:bg-white/5">
            <button
              type="button"
              onClick={() => onWorkspaceViewChange('feed')}
              className={cn(
                'inline-flex items-center gap-2 rounded-[16px] px-4 py-2 text-sm font-semibold transition',
                workspaceView === 'feed'
                  ? 'bg-[rgba(var(--accent-rgb),0.12)] text-[var(--accent)] shadow-[0_10px_30px_-20px_rgba(var(--accent-rgb),0.9)]'
                  : 'text-[var(--text-muted)] hover:bg-white/80 hover:text-[var(--text-strong)]'
              )}
              title={feedLabel}
            >
              <LayoutGrid size={16} />
              {feedLabel}
            </button>
            {allowMapView ? (
              <button
                type="button"
                onClick={() => onWorkspaceViewChange('map')}
                className={cn(
                  'inline-flex items-center gap-2 rounded-[16px] px-4 py-2 text-sm font-semibold transition',
                  workspaceView === 'map'
                    ? 'bg-[rgba(var(--accent-rgb),0.12)] text-[var(--accent)] shadow-[0_10px_30px_-20px_rgba(var(--accent-rgb),0.9)]'
                    : 'text-[var(--text-muted)] hover:bg-white/80 hover:text-[var(--text-strong)]'
                )}
                title={mapLabel}
              >
                <Compass size={16} />
                {mapLabel}
              </button>
            ) : null}
          </div>

          {allowMapView && workspaceView === 'map' ? (
          <div className="flex flex-wrap items-center gap-1 rounded-[18px] bg-white/72 p-1 dark:bg-white/5">
            <button
              type="button"
              onClick={() => onCareerMapModeChange('taxonomy')}
              className={cn(
                'inline-flex items-center gap-2 rounded-[16px] px-4 py-2 text-sm font-semibold transition',
                workspaceView === 'map' && careerMapMode === 'taxonomy'
                  ? 'bg-[rgba(var(--accent-rgb),0.12)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:bg-white/80 hover:text-[var(--text-strong)]',
                workspaceView !== 'map' && 'pointer-events-none opacity-50'
              )}
            >
              <Globe size={16} />
              {copy.taxonomy}
            </button>
            <button
              type="button"
              onClick={() => onCareerMapModeChange('hierarchy')}
              className={cn(
                'inline-flex items-center gap-2 rounded-[16px] px-4 py-2 text-sm font-semibold transition',
                workspaceView === 'map' && careerMapMode === 'hierarchy'
                  ? 'bg-[rgba(var(--accent-rgb),0.12)] text-[var(--accent)]'
                  : 'text-[var(--text-muted)] hover:bg-white/80 hover:text-[var(--text-strong)]',
                workspaceView !== 'map' && 'pointer-events-none opacity-50'
              )}
            >
              <Layout size={16} />
              {copy.hierarchy}
            </button>
          </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden rounded-[16px] bg-white/72 px-3 py-2 text-xs font-medium text-[var(--text-muted)] dark:bg-white/5 lg:block">
            {copy.helper}
          </div>
          {onOpenMobileMenu ? (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="inline-flex items-center gap-2 rounded-[16px] bg-white/72 px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-white hover:text-[var(--text-strong)] dark:bg-white/5 dark:hover:bg-white/10 lg:hidden"
              title={mobileMenuLabel || copy.filters}
            >
              <SlidersHorizontal size={16} />
              {mobileMenuLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-[16px] bg-white/72 px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-white hover:text-[var(--text-strong)] dark:bg-white/5 dark:hover:bg-white/10"
            title={resetLabel}
          >
            <RotateCcw size={16} />
            {resetLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChallengeWorkspaceToolbar;
