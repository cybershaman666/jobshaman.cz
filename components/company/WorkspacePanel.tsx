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
    <div className={`company-surface rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-soft)] ${className}`.trim()}>
      {hasHeader && (
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div>
            {title ? (
              <h3 className="text-base font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{title}</h3>
            ) : null}
            {subtitle ? (
              <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{subtitle}</p>
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
