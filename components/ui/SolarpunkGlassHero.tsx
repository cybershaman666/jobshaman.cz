import React from 'react';
import { cn } from './primitives';

export interface SolarpunkGlassHeroProps {
  /**
   * Main headline - typically philosophical statement
   * Example: "Work is how we shape the world."
   */
  headline: string;
  
  /**
   * Secondary subheading - action-oriented
   * Example: "Najdi problém, který stojí za řešení."
   */
  subheading: string;
  
  /**
   * Primary action button
   * Example: { label: "Hledat výzvy", onClick: () => {...} }
   */
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  
  /**
   * Secondary action button
   * Example: { label: "Prozkoumat role", onClick: () => {...} }
   */
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  
  /**
   * Search panel render - will be displayed in glass sub-panel
   * Typically contains search inputs for role/problem/city
   */
  searchPanel?: React.ReactNode;
  
  /**
   * Additional metrics or info section
   * Example: <div>5,234 výzev | 1,240 role | 340 firem</div>
   */
  metrics?: React.ReactNode;
  
  /**
   * CSS class for additional styling
   */
  className?: string;
  
  /**
   * Optional background content - will show behind glass
   * Could be illustration or gradient backdrop
   */
  backgroundContent?: React.ReactNode;
}

/**
 * SolarpunkGlassHero Component
 * 
 * Transparent glass panel overlay inspired by iOS/visionOS design.
 * Represents the "Park Práce" - entrance to the work park.
 * 
 * Philosophy:
 * - Optimistic, not corporate
 * - Human-centered, not algorithm-centered
 * - Clear action path, not overwhelming options
 * 
 * Used as homepage hero section in ChallengeMarketplace.
 */
export const SolarpunkGlassHero: React.FC<SolarpunkGlassHeroProps> = ({
  headline,
  subheading,
  primaryAction,
  secondaryAction,
  searchPanel,
  metrics,
  className,
  backgroundContent,
}) => {
  return (
    <div className={cn('app-hero-cosmic relative overflow-hidden rounded-[calc(var(--radius-hero)+8px)] shadow-[var(--shadow-overlay)]', className)}>
      {backgroundContent && (
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          {backgroundContent}
        </div>
      )}

      <div className="relative grid gap-6 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:p-8">
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="app-eyebrow">
              <span>JobShaman</span>
            </div>
            <h1 className="app-display max-w-4xl text-[2.4rem] font-semibold tracking-[-0.05em] text-[var(--text-strong)] sm:text-[3.4rem] sm:leading-[0.98]">
              {headline}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
              {subheading}
            </p>
          </div>

          {(primaryAction || secondaryAction) && (
            <div className="flex flex-wrap items-center gap-3">
              {primaryAction && (
                <button
                  onClick={primaryAction.onClick}
                  className="app-button-primary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold"
                  type="button"
                >
                  {primaryAction.icon && (
                    <span className="flex-shrink-0">{primaryAction.icon}</span>
                  )}
                  <span>{primaryAction.label}</span>
                </button>
              )}
              
              {secondaryAction && (
                <button
                  onClick={secondaryAction.onClick}
                  className="app-button-secondary inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold"
                  type="button"
                >
                  {secondaryAction.icon && (
                    <span className="flex-shrink-0">{secondaryAction.icon}</span>
                  )}
                  <span>{secondaryAction.label}</span>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4 lg:self-end">
          {searchPanel && (
            <div className="app-frost-panel rounded-[var(--radius-surface)] border p-4 shadow-[var(--shadow-card)]">
              {searchPanel}
            </div>
          )}

          {metrics && (
            <div className="app-organic-panel-soft rounded-[var(--radius-panel)] border border-[var(--border-cosmic)] bg-[var(--surface-frost)] px-4 py-3 text-sm text-[var(--text-muted)]">
              {metrics}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SolarpunkGlassHero;
