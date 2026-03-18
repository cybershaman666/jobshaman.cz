import React from 'react';
import { motion } from 'framer-motion';

type ClassValue = string | false | null | undefined;

export const cn = (...values: ClassValue[]): string => values.filter(Boolean).join(' ');

export const SurfaceCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'muted' | 'accent';
  variant?: 'default' | 'frost' | 'spotlight';
}> = ({ children, className, tone = 'default', variant = 'default' }) => (
  <div
    className={cn(
      'app-surface app-organic-panel rounded-[var(--radius-xl)] border p-4 shadow-[var(--shadow-card)] sm:p-5',
      tone === 'muted' && 'bg-[var(--surface-muted)]',
      tone === 'accent' && 'bg-[rgba(var(--accent-rgb),0.06)] border-[rgba(var(--accent-rgb),0.18)]',
      variant === 'frost' && 'app-frost-panel',
      variant === 'spotlight' && 'app-spotlight-panel',
      className
    )}
  >
    {children}
  </div>
);

export const Toolbar: React.FC<{
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
  variant?: 'default' | 'frost';
}> = ({ children, className, sticky = false, variant = 'default' }) => (
  <div
    className={cn(
      'app-surface app-organic-panel-soft rounded-[var(--radius-lg)] border p-3 shadow-[var(--shadow-soft)]',
      variant === 'frost' && 'app-frost-panel',
      sticky && 'lg:sticky lg:top-[calc(var(--app-toolbar-offset)+6px)] z-20',
      className
    )}
  >
    {children}
  </div>
);

export const PageHeader: React.FC<{
  eyebrow?: string;
  title: string;
  body?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'immersive';
}> = ({ eyebrow, title, body, actions, children, className, variant = 'default' }) => (
  <div className={cn('app-page-header app-organic-panel gap-4 rounded-[var(--radius-2xl)] border p-4 sm:p-6 md:p-8', variant === 'immersive' && 'app-hero-panel', className)}>
    <div className="space-y-3">
      {eyebrow ? <div className="app-eyebrow">{eyebrow}</div> : null}
      <div className="space-y-3">
        <h1 className="max-w-4xl text-[1.9rem] font-semibold tracking-[-0.045em] text-[var(--text-strong)] sm:text-3xl md:text-[2.7rem]">
          {title}
        </h1>
        {body ? <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)] md:text-base">{body}</p> : null}
      </div>
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    {children ? <div className="border-t border-[var(--border-subtle)] pt-4">{children}</div> : null}
  </div>
);

export const FilterChip: React.FC<{
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  type?: 'button' | 'submit';
}> = ({ active = false, onClick, children, className, type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    className={cn('app-filter-chip', active && 'app-filter-chip-active', className)}
  >
    {children}
  </button>
);

export const MetricTile: React.FC<{
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  tone?: 'default' | 'accent' | 'success' | 'warning';
  className?: string;
}> = ({ label, value, helper, tone = 'default', className }) => (
  <div
    className={cn(
      'app-organic-panel-soft min-w-0 rounded-[var(--radius-lg)] border px-4 py-4',
      tone === 'default' && 'bg-[var(--surface-muted)] border-[var(--border)]',
      tone === 'accent' && 'bg-[rgba(var(--accent-rgb),0.06)] border-[rgba(var(--accent-rgb),0.18)]',
      tone === 'success' && 'border-[rgba(var(--accent-rgb),0.22)] bg-[rgba(var(--accent-rgb),0.06)]',
      tone === 'warning' && 'border-orange-200 bg-orange-50 dark:border-orange-800/40 dark:bg-orange-900/10',
      className
    )}
  >
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{label}</div>
    <div className="mt-2 break-words text-base font-semibold tracking-[-0.03em] text-[var(--text-strong)] sm:text-lg">{value}</div>
    {helper ? (
      <div className="mt-1.5 text-xs leading-5 text-[var(--text-faint)]">{helper}</div>
    ) : null}
  </div>
);

export const Badge: React.FC<{
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'accent' | 'subtle' | 'teal';
  icon?: React.ReactNode;
  className?: string;
}> = ({ children, variant = 'default', icon, className }) => {
  const variants = {
    default: 'bg-[var(--surface-muted)] text-[var(--text)] border-[var(--border)]',
    outline: 'bg-transparent text-[var(--text)] border-[var(--border)]',
    accent: 'bg-[var(--accent)] text-white border-transparent',
    subtle: 'bg-[rgba(var(--accent-rgb),0.08)] text-[var(--accent)] border-[rgba(var(--accent-rgb),0.18)]',
    teal: 'bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-900/50',
  };

  return (
    <div className={cn(
      'app-organic-pill inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold border transition-colors',
      variants[variant],
      className
    )}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </div>
  );
};

export const EmptyState: React.FC<{
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, body, action, className }) => (
  <SurfaceCard className={cn('text-center', className)} tone="muted">
    <div className="mx-auto max-w-xl space-y-3 py-8">
      <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{title}</h3>
      <p className="text-sm leading-7 text-[var(--text-muted)]">{body}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  </SurfaceCard>
);

// ─────────────────────────────────────────────────────────────
// SOLARPUNK PRIMITIVES - Minimalist human-centered design
// ─────────────────────────────────────────────────────────────

/**
 * SolarpunkPath: Thin curved line symbolizing career journey
 * Used in: hero sections, progress flows, connection points
 */
export const SolarpunkPath: React.FC<{
  orientation?: 'vertical' | 'horizontal' | 'arc';
  className?: string;
}> = ({ orientation = 'arc', className }) => {
  const paths = {
    vertical: 'M0,0 Q2,50 0,100',
    horizontal: 'M0,0 Q50,2 100,0',
    arc: 'M0,0 Q30,30 60,0',
  };

  return (
    <svg
      className={cn('overflow-visible', className)}
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ minWidth: '100%', minHeight: '100%' }}
    >
      <path
        d={paths[orientation]}
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        strokeLinecap="round"
        opacity={0.4}
      />
    </svg>
  );
};

/**
 * EnergyNode: Pulsing dot representing activity, connection, energy
 * Used in: handshake indicators, active dialogues, notification badges
 */
export const EnergyNode: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  pulse?: boolean;
  className?: string;
}> = ({ size = 'md', active = true, pulse = true, className }) => {
  const sizeMap = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  };

  return (
    <motion.div
      className={cn(sizeMap[size], 'rounded-full bg-[var(--accent)] flex-shrink-0', className)}
      animate={pulse ? { scale: [1, 1.2, 1], opacity: [1, 0.8, 1] } : undefined}
      transition={pulse ? { duration: 2, repeat: Infinity } : undefined}
      initial={{ opacity: active ? 1 : 0.4 }}
    />
  );
};

/**
 * EnergyNodeRing: Multiple pulsing nodes arranged in a circle
 * Symbolizes: collaborative energy, multiple active participants
 */
export const EnergyNodeRing: React.FC<{
  count: number;
  delay?: number;
  maxVisible?: number;
  className?: string;
}> = ({ count, delay = 0.1, maxVisible = 3, className }) => {
  const visibleCount = Math.min(count, maxVisible);
  const angle = (360 / visibleCount) * (Math.PI / 180);

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {Array.from({ length: visibleCount }).map((_, i) => {
        const rad = angle * i;
        const x = Math.cos(rad) * 12;
        const y = Math.sin(rad) * 12;
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{ transform: `translate(${x}px, ${y}px)` }}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: delay * i,
            }}
          >
            <EnergyNode size="sm" pulse={false} />
          </motion.div>
        );
      })}
      {count > maxVisible ? (
        <span className="text-[10px] font-semibold text-[var(--text-faint)]">+{count - maxVisible}</span>
      ) : null}
    </div>
  );
};

/**
 * GrowthSignal: Visual indicator of achievement progression
 * Symbol progression: sprout → leaf → tree as achievements increase
 */
export const GrowthSignal: React.FC<{
  level: number; // 0-20+ solved problems
  variant?: 'emoji' | 'dot';
  className?: string;
}> = ({ level, variant = 'emoji', className }) => {
  const getGrowthEmoji = (lvl: number) => {
    if (lvl === 0) return '○'; // Empty circle
    if (lvl < 3) return '🌱'; // Sprout
    if (lvl < 8) return '🌿'; // Leaf
    if (lvl < 16) return '🍀'; // Clover
    return '🌳'; // Tree
  };

  const getDotColor = (lvl: number) => {
    if (lvl === 0) return 'bg-[var(--border-subtle)]';
    if (lvl < 3) return 'bg-[rgba(var(--accent-green-rgb),0.4)]';
    if (lvl < 8) return 'bg-[rgba(var(--accent-green-rgb),0.6)]';
    if (lvl < 16) return 'bg-[rgba(var(--accent-green-rgb),0.8)]';
    return 'bg-[var(--accent-green)]';
  };

  if (variant === 'emoji') {
    return <span className={cn('text-lg', className)}>{getGrowthEmoji(level)}</span>;
  }

  return (
    <div className={cn('w-2 h-2 rounded-full transition-colors duration-300', getDotColor(level), className)} />
  );
};

/**
 * SolarpunkProgressFlow: Multi-step progress with path visualization
 * Shows: problem → path → dialogue as a connected journey
 */
export const SolarpunkProgressFlow: React.FC<{
  steps: Array<{ label: string; completed: boolean }>;
  currentStep?: number;
  className?: string;
}> = ({ steps, currentStep = 0, className }) => {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      {steps.map((step, idx) => (
        <React.Fragment key={idx}>
          <motion.div
            className="flex flex-col items-center"
            animate={{ scale: idx === currentStep ? 1.1 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
                step.completed
                  ? 'bg-[var(--accent-green)] text-white'
                  : idx === currentStep
                    ? 'bg-[rgba(var(--accent-green-rgb),0.2)] border border-[var(--accent-green)]'
                    : 'bg-[var(--surface-muted)] border border-[var(--border-subtle)]'
              )}
            >
              <span className="text-xs font-semibold">{idx + 1}</span>
            </div>
            <div className="text-xs font-medium text-[var(--text-muted)] mt-2">{step.label}</div>
          </motion.div>

          {idx < steps.length - 1 && (
            <div className="flex-1 h-0.5 mx-3 relative">
              <div className={cn('h-full transition-all duration-500', step.completed ? 'bg-[var(--accent-green)]' : 'bg-[var(--border-subtle)]')} />
              {idx === currentStep && (
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--accent-green)]"
                  animate={{ x: [0, 8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  style={{ left: 0 }}
                />
              )}
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// Re-export new glass hero components
export { SolarpunkGlassHero } from './SolarpunkGlassHero';
export { CareerPathLine } from './CareerPathLine';
