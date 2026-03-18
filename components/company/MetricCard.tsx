import React from 'react';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  hint,
  className = ''
}) => {
  return (
    <div className={`company-surface-soft app-organic-panel-soft rounded-[var(--radius-lg)] border p-4 shadow-[var(--shadow-soft)] ${className}`.trim()}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-faint)]">
        {label}
      </div>
      <div className="mt-2.5 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
        {value}
      </div>
      {hint ? (
        <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
          {hint}
        </div>
      ) : null}
    </div>
  );
};

export default MetricCard;
