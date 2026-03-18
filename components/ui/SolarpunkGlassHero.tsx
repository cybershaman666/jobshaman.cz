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
    <div className={cn('solarpunk-glass-hero solarpunk-hero-bg', className)}>
      {/* Optional background content (illustration, subtle patterns) */}
      {backgroundContent && (
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          {backgroundContent}
        </div>
      )}
      
      {/* Glass panel content */}
      <div className="solarpunk-glass-hero-content">
        {/* Headline section */}
        <div>
          <h1 className="solarpunk-glass-hero-headline">
            {headline}
          </h1>
          
          <p className="solarpunk-glass-hero-subline">
            {subheading}
          </p>
          
          {/* Action buttons */}
          {(primaryAction || secondaryAction) && (
            <div className="solarpunk-glass-hero-actions">
              {primaryAction && (
                <button
                  onClick={primaryAction.onClick}
                  className="solarpunk-glass-hero-btn solarpunk-glass-hero-btn-primary"
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
                  className="solarpunk-glass-hero-btn solarpunk-glass-hero-btn-secondary"
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
        
        {/* Search panel & metrics in lower section */}
        <div className="space-y-4">
          {searchPanel && (
            <div className="solarpunk-glass-search-panel">
              {searchPanel}
            </div>
          )}
          
          {metrics && (
            <div className="text-sm text-[var(--text-muted)]">
              {metrics}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SolarpunkGlassHero;
