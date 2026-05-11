import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Gauge, 
  Coins, 
  ShieldCheck, 
  WalletCards, 
  Sparkles, 
  Route, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { cn } from '../cn';
import { evaluateRole } from '../intelligence';
import type { Role, CandidatePreferenceProfile } from '../models';
import { ShellCard } from './CandidateShellSurface';

const formatMoney = (value: number, currency: string, language?: string) => 
  `${Math.round(value).toLocaleString(language === 'cs' ? 'cs-CZ' : 'en-GB')} ${currency}`;

const formatRoleCompensation = (role: Role, fallback: string, language?: string) => {
  if (role.salaryFrom <= 0 && role.salaryTo <= 0) return fallback;
  const locale = language === 'cs' ? 'cs-CZ' : 'en-GB';
  const from = role.salaryFrom > 0 ? role.salaryFrom.toLocaleString(locale) : role.salaryTo.toLocaleString(locale);
  const to = role.salaryTo > 0 && role.salaryTo !== role.salaryFrom ? ` - ${role.salaryTo.toLocaleString(locale)}` : '';
  return `${from}${to} ${role.currency}${role.salaryTimeframe ? ` / ${role.salaryTimeframe}` : ''}`;
};

export const JhiNetGraph: React.FC<{
  jhi: ReturnType<typeof evaluateRole>['jhi'];
}> = ({ jhi }) => {
  const { t } = useTranslation();
  const axes = [
    { key: 'financial', label: t('rebuild.jhi.finance', { defaultValue: 'Finance' }), value: jhi.financial },
    { key: 'timeCost', label: t('rebuild.jhi.time', { defaultValue: 'Time' }), value: jhi.timeCost },
    { key: 'mentalLoad', label: t('rebuild.jhi.mental', { defaultValue: 'Mental' }), value: jhi.mentalLoad },
    { key: 'growth', label: t('rebuild.jhi.growth', { defaultValue: 'Growth' }), value: jhi.growth },
    { key: 'values', label: t('rebuild.jhi.values', { defaultValue: 'Values' }), value: jhi.values },
  ] as const;
  const center = 92;
  const radius = 68;
  const points = axes.map((axis, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axes.length;
    const distance = radius * (Math.max(0, Math.min(100, axis.value)) / 100);
    return {
      ...axis,
      x: center + Math.cos(angle) * distance,
      y: center + Math.sin(angle) * distance,
      labelX: center + Math.cos(angle) * (radius + 20),
      labelY: center + Math.sin(angle) * (radius + 20),
      axisX: center + Math.cos(angle) * radius,
      axisY: center + Math.sin(angle) * radius,
    };
  });
  const polygon = points.map((point) => `${point.x},${point.y}`).join(' ');

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
      <div className="relative mx-auto h-[220px] w-[220px]">
        <svg viewBox="0 0 184 184" className="h-full w-full" aria-label="JHI net graph">
          {[0.25, 0.5, 0.75, 1].map((level) => {
            const ring = axes.map((_axis, index) => {
              const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axes.length;
              return `${center + Math.cos(angle) * radius * level},${center + Math.sin(angle) * radius * level}`;
            }).join(' ');
            return <polygon key={level} points={ring} fill="none" stroke="#dbe8ee" strokeWidth="1" />;
          })}
          {points.map((point) => (
            <line key={point.key} x1={center} y1={center} x2={point.axisX} y2={point.axisY} stroke="#dbe8ee" strokeWidth="1" />
          ))}
          <polygon points={polygon} fill="rgba(18,175,203,0.2)" stroke="#0f95ac" strokeWidth="3" strokeLinejoin="round" />
          {points.map((point) => (
            <circle key={point.key} cx={point.x} cy={point.y} r="4" fill="#0f95ac" stroke="white" strokeWidth="2" />
          ))}
          {points.map((point) => (
            <text key={point.key} x={point.labelX} y={point.labelY} textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 text-[9px] font-semibold">
              {point.label}
            </text>
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full border border-white bg-white/92 px-4 py-3 text-center shadow-sm">
            <div className="text-3xl font-semibold tracking-[-0.05em] text-slate-900">{Math.round(jhi.personalizedScore)}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">JHI</div>
          </div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {axes.map((axis) => (
          <div key={axis.key} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-600">{axis.label}</span>
              <span className="text-sm font-semibold text-slate-900">{Math.round(axis.value)}/100</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#0f95ac]" style={{ width: `${Math.max(0, Math.min(100, axis.value))}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const RoleRealityBoard: React.FC<{
  role: Role;
  preferences: CandidatePreferenceProfile;
  t: (key: string, opts: { defaultValue: string }) => string;
}> = ({ role, preferences, t }) => {
  const { i18n } = useTranslation();
  const evaluation = React.useMemo(() => evaluateRole(role, preferences, t), [role, preferences, t]);
  const compensation = formatRoleCompensation(role, t('rebuild.detail.compensation_unknown', { defaultValue: 'Neuvedeno' }));

  const financeRows = [
    { label: t('rebuild.detail.gross_salary', { defaultValue: 'Gross salary / base' }), value: evaluation.grossMonthlySalary > 0 ? formatMoney(evaluation.grossMonthlySalary, role.currency, i18n?.language) : compensation, icon: Coins },
    { label: t('rebuild.detail.taxes_deductions', { defaultValue: 'Taxes and deductions' }), value: formatMoney(evaluation.estimatedTaxAndInsurance, role.currency, i18n?.language), icon: ShieldCheck },
    { label: t('rebuild.detail.take_home', { defaultValue: 'Take-home pay' }), value: formatMoney(evaluation.takeHomeMonthly, role.currency, i18n?.language), icon: WalletCards },
    { label: t('rebuild.detail.benefits_value', { defaultValue: 'Benefits value' }), value: formatMoney(evaluation.benefitsValue, role.currency, i18n?.language), icon: Sparkles },
    { label: t('rebuild.detail.commute_cost', { defaultValue: 'Commute costs' }), value: `-${formatMoney(evaluation.commuteMonthlyCost, role.currency, i18n?.language)}`, icon: Route },
    { label: t('rebuild.detail.real_monthly_value', { defaultValue: 'Real monthly value' }), value: formatMoney(evaluation.totalRealMonthlyValue, role.currency, i18n?.language), icon: Gauge },
  ];

  const commuteRows = [
    { label: t('rebuild.detail.distance', { defaultValue: 'Distance' }), value: evaluation.commuteDistanceKm > 0 ? `${evaluation.commuteDistanceKm.toLocaleString(i18n?.language === 'cs' ? 'cs-CZ' : 'en-GB')} km` : t('rebuild.detail.commute_unknown', { defaultValue: 'No commute / unknown' }) },
    { label: t('rebuild.detail.one_way_time', { defaultValue: 'One-way time' }), value: `${evaluation.commuteMinutesOneWay} min` },
    { label: t('rebuild.detail.monthly_costs', { defaultValue: 'Monthly costs' }), value: formatMoney(evaluation.commuteMonthlyCost, role.currency, i18n?.language) },
    { label: t('rebuild.detail.saved_commute', { defaultValue: 'Saved commute' }), value: formatMoney(evaluation.avoidedCommuteCost, role.currency, i18n?.language) },
    { label: t('rebuild.detail.transport_mode', { defaultValue: 'Transport mode' }), value: preferences.transportMode },
    { label: t('rebuild.detail.your_tolerance', { defaultValue: 'Your tolerance' }), value: preferences.commuteFilterEnabled ? `${preferences.commuteToleranceMinutes} min` : t('rebuild.detail.tolerance_off', { defaultValue: 'Off' }) },
  ];

  return (
    <ShellCard className="p-6 md:p-7">
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
        <div>
          <SectionEyebrow><Gauge size={12} />{t('rebuild.detail.reality_title', { defaultValue: 'Reality check' })}</SectionEyebrow>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900 md:text-3xl">{t('rebuild.detail.reality_heading', { defaultValue: 'Real work, money, commute and energy in one view.' })}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{evaluation.summary}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#12AFCB]/8 px-3 py-1.5 text-xs font-medium text-[#0f95ac]">{evaluation.borderFitLabel}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{role.workModel}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{role.location}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">{evaluation.isContractorMode ? t('rebuild.tax.contractor', { defaultValue: 'Contractor' }) : t('rebuild.tax.employee', { defaultValue: 'Employee' })}</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <JhiNetGraph jhi={evaluation.jhi} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><WalletCards size={16} className="text-[#0f95ac]" />{t('rebuild.detail.financial_reality', { defaultValue: 'Financial reality' })}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {financeRows.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    <Icon size={13} className="text-[#0f95ac]" />
                    {metric.label}
                  </div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-slate-900">{metric.value}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-7 text-slate-600">
            {t('rebuild.detail.effective_rate', { defaultValue: 'Effective rate' })}: <strong className="text-slate-900">{evaluation.taxEffectiveRate}%</strong>. {t('rebuild.detail.jhi_impact', { defaultValue: 'Impact of benefits and commute on JHI finance' })}: <strong className={evaluation.financialScoreAdjustment >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{evaluation.financialScoreAdjustment >= 0 ? '+' : ''}{evaluation.financialScoreAdjustment} {t('rebuild.detail.points', { defaultValue: 'points' })}</strong>.
          </div>
          {evaluation.taxBreakdownDetails.length > 0 ? (
            <div className="mt-3 space-y-2">
              {evaluation.taxBreakdownDetails.slice(0, 4).map((detail) => (
                <div key={detail} className="flex items-start gap-2 text-xs leading-5 text-slate-500"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[#0f95ac]" />{detail}</div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Route size={16} className="text-[#0f95ac]" />{t('rebuild.detail.commute_reality', { defaultValue: 'Commute reality' })}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {commuteRows.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{metric.label}</div>
                <div className="mt-2 text-sm font-semibold leading-6 text-slate-900">{metric.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {evaluation.parkingWarning ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{evaluation.parkingWarning}</div>
            ) : null}
            {evaluation.isRelocation ? (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{t('rebuild.detail.relocation_warning', { defaultValue: 'This offer looks more like a relocation decision than a standard commute.' })}</div>
            ) : null}
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
