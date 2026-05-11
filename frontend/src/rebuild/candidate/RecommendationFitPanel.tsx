import React from 'react';
import { 
  Gauge, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { cn } from '../cn';
import type { Role } from '../models';
import { ShellCard } from './CandidateShellSurface';

export const RecommendationFitPanel: React.FC<{
  role: Role;
  t?: (key: string, opts: { defaultValue: string }) => string;
}> = ({ role, t }) => {
  const fit = role.recommendationFit;
  if (!fit) return null;

  const metrics = [
    { key: 'skill', label: t?.('rebuild.fit.skill', { defaultValue: 'Skill' }) || 'Skill', value: fit.components.skillMatch.score },
    { key: 'evidence', label: t?.('rebuild.fit.evidence', { defaultValue: 'Evidence' }) || 'Evidence', value: fit.components.evidenceQuality.score },
    { key: 'growth', label: t?.('rebuild.fit.growth', { defaultValue: 'Growth' }) || 'Growth', value: fit.components.growthPotential.score },
    { key: 'values', label: t?.('rebuild.fit.context', { defaultValue: 'Context' }) || 'Context', value: fit.components.valuesAlignment.score },
    { key: 'risk', label: t?.('rebuild.fit.risk', { defaultValue: 'Risk' }) || 'Risk', value: fit.components.riskPenalty.score, inverse: true },
  ];
  const evidence = [
    ...fit.reasons,
    ...fit.components.skillMatch.evidence,
    ...fit.components.growthPotential.evidence,
    ...fit.components.valuesAlignment.evidence,
  ].filter(Boolean).slice(0, 4);
  const caveats = [
    ...fit.caveats,
    ...fit.components.riskPenalty.caveats,
  ].filter(Boolean).slice(0, 4);

  return (
    <ShellCard className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionEyebrow><Gauge size={12} />{t?.('rebuild.fit.title', { defaultValue: 'Skill-first fit' })}</SectionEyebrow>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            {role.matchScore ? `${role.matchScore}/100` : t?.('rebuild.fit.audit_ready', { defaultValue: 'Auditable fit' })}
          </h2>
        </div>
        {fit.formula?.version ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-500">{fit.formula.version}</span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <div key={metric.key} className="rounded-[20px] border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{metric.label}</span>
              <span className={cn('text-sm font-bold', metric.inverse ? 'text-amber-700' : 'text-[#0f95ac]')}>{metric.value}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
              <div className={cn('h-full rounded-full', metric.inverse ? 'bg-amber-400' : 'bg-[#12AFCB]')} style={{ width: `${Math.max(0, Math.min(100, metric.value))}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-[22px] border border-[#12AFCB]/12 bg-[#12AFCB]/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><CheckCircle2 size={16} className="text-[#0f95ac]" />{t?.('rebuild.fit.evidence_title', { defaultValue: 'Why it makes sense' })}</div>
          <div className="mt-3 space-y-2">
            {(evidence.length ? evidence : [t?.('rebuild.fit.no_evidence', { defaultValue: 'Fit was calculated without significant positive evidence.' }) || 'Fit was calculated without significant positive evidence.']).map((item) => (
              <div key={item} className="text-sm leading-6 text-slate-600">{item}</div>
            ))}
          </div>
        </div>
        <div className="rounded-[22px] border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><AlertTriangle size={16} className="text-amber-700" />{t?.('rebuild.fit.risk_title', { defaultValue: 'What to verify' })}</div>
          <div className="mt-3 space-y-2">
            {(caveats.length ? caveats : [t?.('rebuild.fit.no_caveats', { defaultValue: 'No significant risk signals yet.' }) || 'No significant risk signals yet.']).map((item) => (
              <div key={item} className="text-sm leading-6 text-amber-900/80">{item}</div>
            ))}
          </div>
        </div>
      </div>
    </ShellCard>
  );
};

const SectionEyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--shell-text-tertiary)]">
    {children}
  </div>
);
