import React from 'react';
import { LayoutGrid, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '../ui/primitives';
import type { ChallengeWorkspaceView } from './challengeWorkspaceTypes';

interface ChallengeWorkspaceToolbarProps {
  feedLabel: string;
  resetLabel: string;
  workspaceView: ChallengeWorkspaceView;
  mobileMenuLabel?: string;
  onOpenMobileMenu?: () => void;
  onWorkspaceViewChange: (view: ChallengeWorkspaceView) => void;
  onReset: () => void;
}

const ChallengeWorkspaceToolbar: React.FC<ChallengeWorkspaceToolbarProps> = ({
  feedLabel,
  resetLabel,
  workspaceView,
  mobileMenuLabel,
  onOpenMobileMenu,
  onWorkspaceViewChange,
  onReset,
}) => {
  const { t } = useTranslation();
  const copy = {
    filters: t('workspace.toolbar.filters'),
  };

  return (
    <div className="mb-4 shrink-0 rounded-[18px] border border-[var(--border)] bg-[rgba(255,255,255,0.96)] px-3 py-2.5 shadow-[0_14px_32px_-26px_rgba(15,23,42,0.16)] backdrop-blur-md dark:border-white/6 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1 rounded-[14px] border border-[var(--border)] bg-[var(--surface-muted)] p-1 dark:bg-white/5">
            <button
              type="button"
              onClick={() => onWorkspaceViewChange('feed')}
              className={cn(
                'inline-flex items-center gap-2 rounded-[16px] px-4 py-2 text-sm font-semibold transition',
                workspaceView === 'feed'
                  ? 'bg-[rgba(var(--accent-rgb),0.12)] text-[var(--accent)] shadow-[0_10px_30px_-20px_rgba(var(--accent-rgb),0.9)]'
                  : 'text-[var(--text-muted)] hover:bg-white hover:text-[var(--text-strong)]'
              )}
              title={feedLabel}
            >
              <LayoutGrid size={16} />
              {feedLabel}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onOpenMobileMenu ? (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="inline-flex items-center gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-white hover:text-[var(--text-strong)] dark:bg-white/5 dark:hover:bg-white/10 lg:hidden"
              title={mobileMenuLabel || copy.filters}
            >
              <SlidersHorizontal size={16} />
              {mobileMenuLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-white hover:text-[var(--text-strong)] dark:bg-white/5 dark:hover:bg-white/10"
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
