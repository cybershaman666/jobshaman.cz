import React from 'react';

type ClassValue = string | false | null | undefined;

export const cn = (...values: ClassValue[]): string => values.filter(Boolean).join(' ');

export const SurfaceCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'muted' | 'accent';
}> = ({ children, className, tone = 'default' }) => (
  <div
    className={cn(
      'app-surface rounded-[var(--radius-xl)] border p-5 shadow-[var(--shadow-card)]',
      tone === 'muted' && 'bg-[var(--surface-muted)]',
      tone === 'accent' && 'bg-[linear-gradient(180deg,rgba(255,249,235,0.98),rgba(255,243,224,0.94))] border-amber-200/70 dark:bg-[linear-gradient(180deg,rgba(255,249,235,0.98),rgba(255,243,224,0.94))] dark:border-amber-200/70',
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
}> = ({ children, className, sticky = false }) => (
  <div
    className={cn(
      'app-surface rounded-[var(--radius-lg)] border p-3 shadow-[var(--shadow-soft)]',
      sticky && 'lg:sticky lg:top-[var(--app-header-offset)] z-20',
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
  className?: string;
}> = ({ eyebrow, title, body, actions, className }) => (
  <div className={cn('app-page-header gap-4 rounded-[var(--radius-2xl)] border p-6 md:p-8', className)}>
    <div className="space-y-3">
      {eyebrow ? <div className="app-eyebrow">{eyebrow}</div> : null}
      <div className="space-y-3">
        <h1 className="max-w-4xl text-3xl font-semibold tracking-[-0.045em] text-[var(--text-strong)] md:text-[2.7rem]">
          {title}
        </h1>
        {body ? <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)] md:text-base">{body}</p> : null}
      </div>
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
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
  tone?: 'default' | 'accent' | 'success' | 'warning';
  className?: string;
}> = ({ label, value, tone = 'default', className }) => (
  <div
    className={cn(
      'rounded-[var(--radius-lg)] border px-4 py-4',
      tone === 'default' && 'bg-[var(--surface-muted)] border-[var(--border-subtle)]',
      tone === 'accent' && 'bg-[rgba(255,248,233,0.96)] border-amber-200/80 dark:bg-[rgba(255,248,233,0.96)] dark:border-amber-200/80',
      tone === 'success' && 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/20',
      tone === 'warning' && 'border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-950/20',
      className
    )}
  >
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{label}</div>
    <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{value}</div>
  </div>
);

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
