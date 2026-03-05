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
    <div className={`company-surface-elevated rounded-[1rem] border border-slate-200/80 bg-[linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.96))] p-3.5 shadow-[0_18px_34px_-32px_rgba(15,23,42,0.42)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.92))] ${className}`.trim()}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2.5 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
        {value}
      </div>
      {hint ? (
        <div className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
          {hint}
        </div>
      ) : null}
    </div>
  );
};

export default MetricCard;
