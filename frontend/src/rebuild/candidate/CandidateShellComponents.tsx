import React from 'react';
import { cn } from '../cn';

export const InsightBadge: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.16)]">
    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
    <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-900">{value}</div>
  </div>
);

export const HeroStatCard: React.FC<{
  label: string;
  value: string;
  accent?: string;
}> = ({ label, value, accent = 'bg-white/90' }) => (
  <div className={cn('min-w-0 rounded-[26px] border border-white/70 px-5 py-5 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.18)] bg-white', accent)}>
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
    <div className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.05em] text-slate-900">{value}</div>
  </div>
);

export const DetailMetaPill: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
    <div className="mt-1 text-sm font-semibold leading-6 text-slate-900">{value}</div>
  </div>
);

export const DetailSection: React.FC<{ title: string; body: string }> = ({ title, body }) => {
  if (!body.trim()) return null;
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{body}</div>
    </div>
  );
};
