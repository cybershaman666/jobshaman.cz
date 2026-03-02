import React from 'react';

interface WorkspacePanelProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = ''
}) => {
  const hasHeader = Boolean(title || subtitle || action);

  return (
    <div className={`company-surface rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.42)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/92 ${className}`.trim()}>
      {hasHeader && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h3 className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h3>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p>
            ) : null}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>
        {children}
      </div>
    </div>
  );
};

export default WorkspacePanel;
