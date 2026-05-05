import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  MapPin,
  Clock3,
  Zap,
  Target,
  TrendingUp,
  Sparkles,
  Info,
  CheckCircle2,
  Handshake,
  UserCircle2
} from 'lucide-react';
import { cn } from '../cn';
import { Role } from '../models';
import { ShellCard } from './CandidateShellSurface';

// --- Sub-components ---

const formatRoleSalary = (role: Role, t: any) => {
  if (!role.salaryFrom && !role.salaryTo) return t('rebuild.marketplace.salary_not_specified');
  const from = role.salaryFrom > 0 ? role.salaryFrom.toLocaleString('cs-CZ') : role.salaryTo.toLocaleString('cs-CZ');
  const to = role.salaryTo > 0 && role.salaryTo !== role.salaryFrom ? ` – ${role.salaryTo.toLocaleString('cs-CZ')}` : '';
  return `${from}${to} ${role.currency}`;
};

export const QuickActionButtons: React.FC<{
  activeAction?: string;
  onAction?: (actionId: string) => void;
}> = ({ activeAction, onAction }) => {
  const { t } = useTranslation();
  const actions = [
    { id: 'immediate', label: t('rebuild.marketplace.action_immediate', { defaultValue: 'Chci práci hned' }), sub: t('rebuild.marketplace.action_immediate_sub', { defaultValue: 'Zobrazit nabídky' }), icon: <Target className="text-blue-500" /> },
    { id: 'unsure', label: t('rebuild.marketplace.action_unsure', { defaultValue: 'Nevím, co chci dělat' }), sub: t('rebuild.marketplace.action_unsure_sub', { defaultValue: 'Pomůže mi Cybershaman' }), icon: <Sparkles className="text-teal-500" /> },
    { id: 'pivot', label: t('rebuild.marketplace.action_pivot', { defaultValue: 'Změnit obor' }), sub: t('rebuild.marketplace.action_pivot_sub', { defaultValue: 'Ukaž možnosti' }), icon: <TrendingUp className="text-indigo-500" /> },
    { id: 'improve', label: t('rebuild.marketplace.action_improve', { defaultValue: 'Zlepšit se' }), sub: t('rebuild.marketplace.action_improve_sub', { defaultValue: 'Kurzy a rozvoj' }), icon: <Zap className="text-amber-500" /> },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={() => onAction?.(action.id)}
          aria-pressed={activeAction === action.id}
          className={cn(
            'flex items-center gap-4 rounded-[22px] border p-4 text-left shadow-[0_12px_24px_-18px_rgba(0,0,0,0.08)] transition hover:border-slate-200 hover:bg-white dark:hover:bg-slate-800 dark:hover:border-slate-700 hover:shadow-[0_20px_40px_-24px_rgba(0,0,0,0.12)]',
            activeAction === action.id ? 'border-[#f0cf8b] bg-[#fff6e4] dark:border-amber-500 dark:bg-amber-950/30' : 'border-slate-100 bg-white/60 dark:border-slate-800 dark:bg-slate-900/60',
          )}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800">
            {action.icon}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-bold text-slate-800 dark:text-slate-200">{action.label}</div>
            <div className="truncate text-[11px] font-medium text-slate-400 dark:text-slate-500">{action.sub}</div>
          </div>
        </button>
      ))}
    </div>
  );
};

export const FeaturedRoleCard: React.FC<{
  role: Role;
  distanceKm?: number | null;
  onOpen: () => void;
}> = ({ role, distanceKm, onOpen }) => {
  const { t } = useTranslation();
  const distanceLabel = Number.isFinite(distanceKm)
    ? `${Math.max(1, Math.round(distanceKm || 0))} ${t('rebuild.marketplace.km_from_you')}`
    : null;

  return (
    <ShellCard className="group relative overflow-hidden border-[#f0e8d8] dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 shadow-[0_24px_50px_-36px_rgba(72,55,24,0.12)] backdrop-blur-sm">
      <div className="flex flex-col lg:flex-row">
        <div className="flex flex-1 flex-col p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#f0e8d8] dark:border-slate-700 bg-[#fffbf2] dark:bg-slate-800 p-2 shadow-sm">
              {role.companyLogo ? (
                <img src={role.companyLogo} alt="" className="h-full w-full object-contain" />
              ) : (
                <div className="h-full w-full bg-slate-100 rounded-lg" />
              )}
            </div>
            <div>
              <h3 className="text-[22px] font-bold leading-tight text-slate-900 dark:text-slate-100 group-hover:text-[#af6b15] dark:group-hover:text-amber-400 transition-colors">{role.title}</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{role.companyName}</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <MapPin size={12} className="text-slate-400" />
              {distanceLabel ? `${distanceLabel} · ${role.location || t('rebuild.marketplace.location_not_specified')}` : role.location || t('rebuild.marketplace.location_not_specified')}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              <Clock3 size={12} className="text-slate-400" />
              {role.workModel || '3 směny'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {t('rebuild.marketplace.start_immediately')}
            </span>
          </div>

          <div className="mt-auto pt-8 flex items-end justify-between gap-4">
            <div>
              <div className="text-[20px] font-black text-slate-900 dark:text-slate-100">
                {formatRoleSalary(role, t)}
              </div>
              <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{t('rebuild.marketplace.per_month')}</div>
            </div>
            <button
              onClick={onOpen}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#f6d999] dark:bg-amber-600 px-6 py-3.5 text-[14px] font-bold text-[#4a3515] dark:text-amber-50 shadow-[0_12px_24px_-12px_rgba(246,217,153,0.6)] transition hover:bg-[#f3d58c] dark:hover:bg-amber-500 hover:shadow-[0_16px_32px_-12px_rgba(246,217,153,0.8)]"
            >
              {t('rebuild.marketplace.view')}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div className="relative h-64 lg:h-auto lg:w-[40%] overflow-hidden">
          <img
            src={role.heroImage || "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=1000&auto=format&fit=crop"}
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-white/10" />
        </div>
      </div>
    </ShellCard>
  );
};

export const DiscoveryRoleCard: React.FC<{
  role: Role;
  distanceKm?: number | null;
  onOpen: () => void;
}> = ({ role, distanceKm, onOpen }) => {
  const { t } = useTranslation();
  const matchScore = typeof role.matchScore === 'number' ? role.matchScore : null;
  const fit = role.recommendationFit;
  const hasHeaderImage = Boolean(role.heroImage);
  const topFit = fit
    ? [
      { label: t('rebuild.marketplace.fit_skill', { defaultValue: 'Schopnost' }), score: fit.components.skillMatch.score },
      { label: t('rebuild.marketplace.fit_growth', { defaultValue: 'Růst' }), score: fit.components.growthPotential.score },
      { label: t('rebuild.marketplace.fit_context', { defaultValue: 'Kontext' }), score: fit.components.valuesAlignment.score },
    ]
    : [];
  const primaryEvidence = fit?.reasons?.[0] || fit?.components.skillMatch.evidence?.[0] || '';
  const primaryRisk = fit?.caveats?.[0] || fit?.components.riskPenalty.caveats?.[0] || '';
  const distanceLabel = Number.isFinite(distanceKm)
    ? `${Math.max(1, Math.round(distanceKm || 0))} ${t('rebuild.marketplace.km_from_you', { defaultValue: 'km' })}`
    : null;

  return (
    <button
      onClick={onOpen}
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[28px] border border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 text-left shadow-[0_16px_32px_-24px_rgba(0,0,0,0.08)] transition hover:border-slate-200 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.12)]"
    >
      {hasHeaderImage ? (
        <div className="relative h-20 w-full overflow-hidden">
          <img
            src={role.heroImage}
            alt=""
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-slate-900/5 to-transparent" />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef6f8] dark:bg-cyan-950 p-2 transition group-hover:bg-[#e2f0f3] dark:group-hover:bg-cyan-900">
            {role.companyLogo ? (
              <img src={role.companyLogo} alt="" className="h-full w-full object-contain" />
            ) : (
              <UserCircle2 size={24} className="text-teal-600/40" />
            )}
          </div>
          <div className="relative flex h-12 w-12 items-center justify-center">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="3" fill="none" className="text-slate-100 dark:text-slate-800" />
              {matchScore !== null ? (
                <circle
                  cx="16" cy="16" r="14"
                  stroke="#12afcb"
                  strokeWidth="3"
                  fill="none"
                  strokeDasharray="88"
                  strokeDashoffset={88 - (88 * matchScore) / 100}
                  strokeLinecap="round"
                />
              ) : null}
            </svg>
            <span className="text-[10px] font-black text-slate-800 dark:text-slate-200">{matchScore !== null ? `${matchScore}%` : t('rebuild.marketplace.new')}</span>
          </div>
        </div>

        <div className="mt-5">
          <h4 className="text-[16px] font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 transition-colors line-clamp-1">{role.title}</h4>
          <p className="text-[12px] font-medium text-slate-400">{role.companyName}</p>
        </div>

        <div className="mt-5 flex flex-col gap-1.5">
          <div className="text-[15px] font-black text-slate-900 dark:text-slate-100">{formatRoleSalary(role, t)}</div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span className="flex min-w-0 items-center gap-1"><MapPin size={10} className="shrink-0" /> <span className="truncate">{distanceLabel ? `${distanceLabel} · ${role.location || t('rebuild.marketplace.role', { defaultValue: 'Role' })}` : role.location || t('rebuild.marketplace.role', { defaultValue: 'Role' })}</span></span>
            <span className="flex items-center gap-1"><Clock3 size={10} /> {role.workModel || t('rebuild.marketplace.default_shifts', { defaultValue: '2 směny' })}</span>
          </div>
        </div>

        {fit ? (
          <div className="mt-5 space-y-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-800/70 p-3">
            <div className="grid grid-cols-3 gap-2">
              {topFit.map((item) => (
                <div key={item.label} className="min-w-0">
                  <div className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">{item.label}</div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-[#12afcb]" style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {primaryEvidence ? (
              <div className="line-clamp-2 flex gap-1.5 text-[11px] font-medium leading-5 text-slate-600">
                <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-teal-600" />
                <span>{primaryEvidence}</span>
              </div>
            ) : null}
            {primaryRisk ? (
              <div className="line-clamp-2 flex gap-1.5 text-[11px] font-medium leading-5 text-amber-700">
                <Info size={12} className="mt-0.5 shrink-0" />
                <span>{primaryRisk}</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-center rounded-xl bg-[#eef6f8] dark:bg-cyan-950/50 py-2 text-[12px] font-bold text-teal-700 dark:text-teal-400 transition group-hover:bg-[#12afcb] group-hover:text-white">
          {t('rebuild.marketplace.view')}
          <ArrowRight size={14} className="ml-1" />
        </div>
      </div>
    </button>
  );
};

export const MiniSandboxCard: React.FC<{
  title: string;
  sub: string;
  onOpen: () => void;
}> = ({ title, sub, onOpen }) => (
  <button
    onClick={onOpen}
    className="group flex flex-1 flex-col items-center gap-3 rounded-[24px] border border-slate-100 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-4 text-center transition hover:border-slate-200 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg"
  >
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#fdf8f0] dark:bg-amber-950/30">
      <Handshake className="text-amber-600/60" size={20} />
    </div>
    <div className="min-w-0">
      <div className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-200">{title}</div>
      <div className="mt-0.5 truncate text-[11px] font-medium text-slate-400">{sub}</div>
    </div>
    <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 group-hover:bg-[#fff5e6] dark:group-hover:bg-amber-900/40 group-hover:text-amber-700 dark:group-hover:text-amber-400">
      Vyzkoušet
    </div>
  </button>
);

export const CandidateKompas: React.FC<{
  score: number;
  metrics: Array<{ label: string; value: number }>;
}> = ({ score: _score, metrics }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col">
      <div className="relative mx-auto flex h-64 w-64 items-center justify-center">
        {/* Radar Chart Background */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          {[0.2, 0.4, 0.6, 0.8, 1].map((r) => (
            <circle key={r} cx="50" cy="50" r={r * 40} fill="none" stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="0.5" />
          ))}
          {metrics.map((_, i) => {
            const angle = (i * 2 * Math.PI) / metrics.length - Math.PI / 2;
            return (
              <line
                key={i}
                x1="50" y1="50"
                x2={50 + Math.cos(angle) * 40}
                y2={50 + Math.sin(angle) * 40}
                stroke="currentColor" className="text-slate-100 dark:text-slate-800" strokeWidth="0.5"
              />
            );
          })}
          {/* Radar Path */}
          <path
            d={metrics.map((m, i) => {
              const angle = (i * 2 * Math.PI) / metrics.length - Math.PI / 2;
              const r = (m.value / 100) * 40;
              const x = 50 + Math.cos(angle) * r;
              const y = 50 + Math.sin(angle) * r;
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ') + ' Z'}
            fill="rgba(246, 217, 153, 0.15)"
            stroke="#f6d999"
            strokeWidth="1.5"
          />
        </svg>

        {/* Labels */}
        {metrics.map((m, i) => {
          const angle = (i * 2 * Math.PI) / metrics.length - Math.PI / 2;
          const x = 50 + Math.cos(angle) * 52;
          const y = 50 + Math.sin(angle) * 52;
          return (
            <div
              key={m.label}
              className="absolute flex flex-col items-center"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                width: '60px'
              }}
            >
              <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase text-center leading-tight">{m.label}</div>
              <div className="text-[11px] font-black text-slate-800 dark:text-slate-200">{m.value}%</div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-[24px] border border-[#fdf0d5] dark:border-amber-900/30 bg-[#fffbf2] dark:bg-amber-950/20 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-amber-500 shadow-sm">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="text-[14px] font-bold text-slate-900 dark:text-slate-100">{t('rebuild.marketplace.kompas_match_title', { defaultValue: 'Sedí ti to dobře' })}</div>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-600 dark:text-slate-400">
              {t('rebuild.marketplace.kompas_match_copy', { defaultValue: 'Tyto nabídky odpovídají tomu, co umíš a co tě může bavit.' })}
            </p>
          </div>
        </div>
        <button className="mt-4 flex items-center gap-1.5 text-[12px] font-bold text-[#af6b15] hover:underline">
          {t('rebuild.marketplace.kompas_more_profile', { defaultValue: 'Více o tvém profilu' })}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
