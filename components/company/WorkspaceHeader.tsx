import React from 'react';

interface WorkspaceHeaderProps {
  badgeLabel: string;
  badgeIcon?: React.ReactNode;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}

const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  badgeLabel,
  badgeIcon,
  title,
  subtitle,
  actions
}) => {
  return (
    <div className="rounded-[1.05rem] border border-[var(--border)] bg-[radial-gradient(circle_at_top_left,_rgba(var(--accent-rgb),0.12),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.96))] p-4 shadow-[0_16px_30px_-34px_rgba(15,23,42,0.24)] dark:border-[var(--border)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(var(--accent-rgb),0.18),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.94))]">
      <div className="flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.2)] bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)] backdrop-blur dark:border-[rgba(var(--accent-rgb),0.24)] dark:bg-[rgba(var(--accent-rgb),0.16)]">
            {badgeIcon}
            {badgeLabel}
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {subtitle}
          </p>
        </div>
        {actions && (
          <div className="flex flex-col sm:flex-row gap-3 xl:items-center">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceHeader;
