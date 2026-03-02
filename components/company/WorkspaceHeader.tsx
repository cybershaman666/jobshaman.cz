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
    <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex flex-col xl:flex-row gap-4 xl:items-center xl:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-700 dark:border-cyan-900/30 dark:bg-cyan-950/20 dark:text-cyan-300">
            {badgeIcon}
            {badgeLabel}
          </div>
          <h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
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
