import React from 'react';

interface CompanyMapStatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
}

export const CompanyMapStatCard: React.FC<CompanyMapStatCardProps> = ({
  label,
  value,
  hint,
  icon,
}) => (
  <div className="rounded-[22px] border border-slate-200/80 bg-white/82 px-4 py-4">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
      {icon}
      {label}
    </div>
    <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
    {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
  </div>
);

interface CompanyMapEmptyStateProps {
  message: string;
}

export const CompanyMapEmptyState: React.FC<CompanyMapEmptyStateProps> = ({ message }) => (
  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-sm text-slate-500">
    {message}
  </div>
);

interface CompanyMapTagProps {
  children: React.ReactNode;
}

export const CompanyMapTag: React.FC<CompanyMapTagProps> = ({ children }) => (
  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
    {children}
  </span>
);
