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
    <div className={`bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 ${className}`.trim()}>
      <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      ) : null}
    </div>
  );
};

export default MetricCard;
