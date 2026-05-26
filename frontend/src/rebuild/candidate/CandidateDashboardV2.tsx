import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Award,
  Briefcase,
  ChevronRight,
  CircleUserRound,
  Clock3,
  GraduationCap,
  Info,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Network,
  ShieldAlert,
  Target,
  ArrowRight,
  Users,
  Zap,
  Brain,
  Loader2,
  Send,
  Sparkles,
  CalendarDays,
} from 'lucide-react';

import type { CVDocument, DialogueSummary, UserProfile } from '../../types';
import type { CandidatePreferenceProfile, Role } from '../models';
import { cn } from '../cn';
import { buildCandidateDashboardViewModel, clamp } from '../dashboard/viewModels';
import { evaluateRole } from '../intelligence';
import { DashboardLayoutV2 } from '../ui/DashboardLayoutV2';
import { useRebuildTheme } from '../ui/rebuildTheme';
import { primaryButtonClass, secondaryButtonClass } from '../ui/shellStyles';
import { CandidateShellSurface, CompactActionButton, MetricPill, ShellCard } from './CandidateShellSurface';
import { CandidateProfileV2 } from './CandidateProfileV2';
import { sendMentorChatMessage, type MentorChatMessage, type ShamiJobRecommendation } from '../../services/v2MentorService';
import { getCandidateGreetingName } from './greeting';
import { ChatMentor } from '../../components/ChatMentor';
import { CandidateChatSidebar } from '../../components/CandidateChatSidebar';

type TFunction = (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;

type HeroMetric = ReturnType<typeof buildCandidateDashboardViewModel>['heroMetrics'][number];

const sectionTitleClass = 'text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--dashboard-text-muted)]';

const heroMetricLayout = [
  { className: 'left-4 top-6 xl:left-8 xl:top-10', side: 'left' as const },
  { className: 'right-4 top-6 xl:right-8 xl:top-10', side: 'right' as const },
  { className: 'left-0 top-[10rem] xl:left-3 xl:top-[11.5rem]', side: 'left' as const },
  { className: 'right-0 top-[10rem] xl:right-3 xl:top-[11.5rem]', side: 'right' as const },
  { className: 'left-6 bottom-12 xl:left-10 xl:bottom-16', side: 'left' as const },
  { className: 'right-6 bottom-12 xl:right-10 xl:bottom-16', side: 'right' as const },
] as const;

const orbitToneClass = {
  gold: {
    line: 'bg-[linear-gradient(90deg,rgba(var(--accent-gold-rgb),0.45),rgba(var(--accent-gold-rgb),0.08))]',
    border: 'border-[color:var(--accent-gold)]/40',
    icon: 'text-[color:var(--accent-gold)]',
    value: 'text-[color:var(--accent-gold)]',
  },
  teal: {
    line: 'bg-[linear-gradient(90deg,rgba(var(--accent-rgb),0.45),rgba(var(--accent-rgb),0.08))]',
    border: 'border-[color:var(--accent)]/40',
    icon: 'text-[color:var(--accent)]',
    value: 'text-[color:var(--accent)]',
  },
  muted: {
    line: 'bg-[linear-gradient(90deg,rgba(142,157,170,0.38),rgba(142,157,170,0.08))]',
    border: 'border-[color:var(--dashboard-soft-border)]',
    icon: 'text-[color:var(--dashboard-text-muted)]',
    value: 'text-[color:var(--accent-gold)]',
  },
} as const;

const companyTileClass = [
  'bg-[linear-gradient(180deg,#eef3ff,#dfe7ff)] text-[#214b98]',
  'bg-[linear-gradient(180deg,#f0ecff,#ddd7ff)] text-[#5a37c8]',
  'bg-[linear-gradient(180deg,#daf6f4,#b8ece7)] text-[#0f6a6a]',
] as const;

const getRolePath = (role: Role | null | undefined) => {
  if (!role) return '/';
  return role.source === 'curated' ? `/candidate/role/${role.id}` : `/candidate/imported/${role.id}`;
};

const getHeroMetricIcon = (metricId: string, label: string) => {
  const key = `${metricId} ${label}`.toLowerCase();
  if (key.includes('system') || key.includes('myslen')) return <Brain size={14} />;
  if (key.includes('adapt') || key.includes('tech') || key.includes('ai')) return <Zap size={14} />;
  if (key.includes('social')) return <Users size={14} />;
  if (key.includes('stress') || key.includes('odolnost') || key.includes('energy')) return <ShieldAlert size={14} />;
  if (key.includes('strateg') || key.includes('problem')) return <Target size={14} />;
  if (key.includes('flex') || key.includes('ambigu') || key.includes('network')) return <Network size={14} />;
  return <Award size={14} />;
};

const formatArchetypeCopy = (copy: string, t: TFunction) => {
  const parts = String(copy)
    .split(/[.!?]\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return [
      t('rebuild.dashboard.default_copy_1', { defaultValue: 'You see connections where others are not looking yet.' }),
      t('rebuild.dashboard.default_copy_2', { defaultValue: 'You build systems that make sense.' }),
    ];
  }

  return parts.map((part) => (/[.!?]$/.test(part) ? part : `${part}.`));
};

const getCompactArchetypeTitle = (title: string, t: any) => {
  const parts = String(title)
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return t('rebuild.dashboard.archetype', { defaultValue: 'Archetyp' });
  if (parts[0].length <= 24) return parts[0];
  return parts[0].split(/\s+/).slice(0, 2).join(' ');
};

const formatShamiFitScore = (score?: number) => {
  if (typeof score !== 'number' || Number.isNaN(score)) return '';
  return `${Math.round(score)}% fit`;
};

const getShamiIntentLabel = (intent?: string) => {
  const labels: Record<string, string> = {
    safe_match: 'Přesná shoda',
    stretch_match: 'Stretch role',
    growth_path: 'Růstová výzva',
    income_now: 'Rychlý příjem',
    exploration: 'K prozkoumání',
    fallback: 'Další možnost',
  };
  return labels[intent || ''] || '';
};

const ShamiJobRecommendationCard: React.FC<{ recommendation: ShamiJobRecommendation }> = ({ recommendation }) => {
  const fitScore = formatShamiFitScore(recommendation.fit_score);
  const intent = getShamiIntentLabel(recommendation.intent);
  const meta = [
    recommendation.company,
    recommendation.location,
    recommendation.work_model,
    recommendation.salary,
  ].filter(Boolean);
  const why = recommendation.why || recommendation.reasons?.[0] || '';
  const watchOut = recommendation.watch_out || recommendation.caveats?.[0] || '';

  return (
    <div className="mt-3 rounded-lg border border-[#c7e9f0] bg-[#f7fcfd] p-4 text-left shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-black leading-5 text-slate-950">{recommendation.title}</div>
          {meta.length ? <div className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">{meta.join(' · ')}</div> : null}
        </div>
        {fitScore || intent ? (
          <div className="shrink-0 rounded-full border border-[#b8e4ec] bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#0f95ac]">
            {[fitScore, intent].filter(Boolean).join(' · ')}
          </div>
        ) : null}
      </div>
      {why ? <p className="mt-3 text-[12px] font-semibold leading-5 text-slate-700">{why}</p> : null}
      {watchOut ? <p className="mt-2 text-[11px] leading-5 text-slate-500">Ověřit: {watchOut}</p> : null}
      {recommendation.url ? (
        <a
          href={recommendation.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-black text-[#0f95ac] hover:text-[#0b7181]"
        >
          Otevřít nabídku
          <ArrowRight size={13} />
        </a>
      ) : null}
    </div>
  );
};

const AnimatedEnsoRing: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none mix-blend-screen opacity-80">
    <svg viewBox="0 0 100 100" className="w-[125%] h-[125%] max-w-[600px] animate-[spin_40s_linear_infinite]" style={{ filter: 'drop-shadow(0 0 12px rgba(var(--accent-gold-rgb), 0.4))' }}>
      {/* Outer organic ring */}
      <path
        d="M 50,5
           C 75,5 95,25 95,50
           C 95,75 75,95 50,95
           C 25,95 5,75 5,50
           C 5,28 20,10 40,6"
        fill="none"
        stroke="url(#enso-grad)"
        strokeWidth="1.2"
        strokeLinecap="round"
        className="animate-[pulse_4s_ease-in-out_infinite]"
      />
      {/* Inner complementary ring rotating opposite */}
      <path
        d="M 50,12
           C 29,12 12,29 12,50
           C 12,71 29,88 50,88
           C 71,88 88,71 88,50
           C 88,32 75,15 58,13"
        fill="none"
        stroke="url(#enso-grad-2)"
        strokeWidth="0.8"
        strokeLinecap="round"
        style={{ transformOrigin: '50px 50px', animation: 'spin 25s linear infinite reverse' }}
      />

      {/* Inner dots representing focused energy */}
      <circle cx="40" cy="6" r="1.5" fill="rgba(var(--accent-gold-rgb), 1)" className="animate-pulse" />
      <circle cx="58" cy="13" r="1" fill="rgba(var(--accent-rgb), 1)" className="animate-pulse" />

      <defs>
        <linearGradient id="enso-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(var(--accent-gold-rgb), 1)" />
          <stop offset="60%" stopColor="rgba(var(--accent-rgb), 0.4)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <linearGradient id="enso-grad-2" x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="rgba(var(--accent-rgb), 0.8)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  </div>
);

const NetworkBrain: React.FC<{ complexity: number }> = ({ complexity }) => {
  const nodes = React.useMemo(() => {
    const baseNodes = [
      { x: 50, y: 80 }, { x: 40, y: 75 }, { x: 30, y: 65 }, { x: 20, y: 50 }, { x: 25, y: 35 }, { x: 35, y: 25 }, { x: 45, y: 20 },
      { x: 55, y: 20 }, { x: 65, y: 25 }, { x: 75, y: 35 }, { x: 80, y: 50 }, { x: 70, y: 65 }, { x: 60, y: 75 },
      { x: 50, y: 65 }, { x: 40, y: 55 }, { x: 30, y: 45 }, { x: 40, y: 35 }, { x: 50, y: 35 }, { x: 60, y: 35 }, { x: 70, y: 45 }, { x: 60, y: 55 },
      { x: 50, y: 50 }, { x: 45, y: 45 }, { x: 55, y: 45 }, { x: 45, y: 60 }, { x: 55, y: 60 },
      { x: 35, y: 55 }, { x: 65, y: 55 }, { x: 25, y: 45 }, { x: 75, y: 45 }, { x: 35, y: 35 }, { x: 65, y: 35 },
      { x: 45, y: 30 }, { x: 55, y: 30 }, { x: 40, y: 65 }, { x: 60, y: 65 }, { x: 30, y: 55 }, { x: 70, y: 55 },
    ];
    return baseNodes.map((n, i) => ({
      id: i,
      x: n.x + (Math.random() * 4 - 2),
      y: n.y + (Math.random() * 4 - 2),
      delay: Math.random() * 2
    }));
  }, []);

  const activeCount = Math.max(8, Math.floor((complexity / 100) * nodes.length));
  const activeNodes = nodes.slice(0, activeCount);

  const lines = React.useMemo(() => {
    const l = [];
    for (let i = 0; i < activeNodes.length; i++) {
      for (let j = i + 1; j < activeNodes.length; j++) {
        const n1 = activeNodes[i];
        const n2 = activeNodes[j];
        const dist = Math.sqrt(Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2));
        if (dist < 22) {
          l.push({ n1, n2, opacity: 1 - dist / 22 });
        }
      }
    }
    return l;
  }, [activeNodes]);

  return (
    <div className="relative h-[110px] w-[110px]">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_8px_rgba(var(--accent-green-rgb),0.4)]">
        {lines.map((line, i) => (
          <line
            key={`l-${i}`}
            x1={line.n1.x}
            y1={line.n1.y}
            x2={line.n2.x}
            y2={line.n2.y}
            stroke="rgba(var(--accent-green-rgb), 1)"
            strokeWidth="0.8"
            strokeOpacity={line.opacity * 0.5}
            className="animate-pulse"
            style={{ animationDuration: `${2 + (i % 3)}s`, animationDelay: `${(i % 5) * 0.2}s` }}
          />
        ))}
        {activeNodes.map((n) => (
          <circle
            key={`n-${n.id}`}
            cx={n.x}
            cy={n.y}
            r="1.5"
            fill="rgba(var(--accent-green-rgb), 1)"
            className="animate-pulse"
            style={{ animationDuration: '3s', animationDelay: `${n.delay}s` }}
          />
        ))}
      </svg>
    </div>
  );
};

const ResonanceRing: React.FC<{ score: number }> = ({ score }) => {
  const tealArc = clamp(score, 0, 100);
  const goldArc = clamp(100 - tealArc, 0, 100);
  const circumference = 263.9;

  return (
    <div className="relative flex h-[92px] w-[92px] items-center justify-center">
      <svg className="absolute inset-0 h-full w-full -rotate-90 drop-shadow-[0_0_12px_rgba(var(--accent-rgb),0.3)]" viewBox="0 0 96 96" aria-hidden>
        <circle cx="48" cy="48" r="42" stroke="var(--dashboard-soft-border)" strokeWidth="2.5" fill="none" />
        <circle
          cx="48"
          cy="48"
          r="42"
          stroke="var(--accent)"
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * tealArc) / 100}
          strokeLinecap="round"
          fill="none"
        />
        <circle
          cx="48"
          cy="48"
          r="42"
          stroke="var(--accent-gold)"
          strokeWidth="3.5"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * goldArc) / 100}
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
          transform="rotate(124 48 48)"
        />
      </svg>
      <span className="text-[24px] font-light tracking-tight text-[color:var(--text-strong)]">{score}<span className="text-[14px] text-[color:var(--text-muted)]">%</span></span>
    </div>
  );
};

const HeroMetricBadge: React.FC<{
  metric: HeroMetric;
  className: string;
  side: 'left' | 'right';
  index: number;
}> = ({ metric, className, side, index }) => {
  const tone = orbitToneClass[metric.tone];
  const delay = (index * 0.4).toFixed(1);
  const duration = (4 + (index % 3) * 0.5).toFixed(1);

  return (
    <div
      className={cn(
        'absolute hidden items-center gap-2 xl:flex',
        side === 'right' ? 'flex-row-reverse text-right' : 'flex-row text-left',
        className,
      )}
      style={{ animation: `float-orbit ${duration}s ease-in-out ${delay}s infinite` }}
    >
      <div className={cn('flex shrink-0 items-center justify-center', tone.icon, 'drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]')}>
        {React.cloneElement(getHeroMetricIcon(metric.id, metric.label) as React.ReactElement, { size: 16 })}
      </div>
      <div className="min-w-0">
        <div className="max-w-[8rem] text-[12px] font-medium text-[color:var(--text-strong)] leading-[1.25] line-clamp-2">{metric.label}</div>
        <div className={cn('mt-0 text-[15px] font-bold leading-none drop-shadow-[0_0_8px_rgba(255,255,255,0.15)] tracking-tight', tone.value)}>{metric.value.toFixed(1)}</div>
      </div>
    </div>
  );
};

const BlindSpotRow: React.FC<{
  label: string;
  self: number;
  reality: number;
  delta: number;
}> = ({ label, self, reality, delta }) => {
  const { t } = useTranslation();
  return (
    <div className="group border border-transparent py-1.5 transition hover:bg-[color:var(--dashboard-soft-bg)] hover:rounded-[14px] hover:px-3 -mx-3 px-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 text-[13px] font-medium text-[color:var(--text-strong)] truncate">{label}</div>
        <div className="shrink-0 text-[12px] font-bold text-[color:var(--danger)]">
          {delta > 0 ? '+' : ''}{delta}%
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-3">
          <div className="w-[72px] text-[9.5px] font-medium text-[color:var(--text-faint)]">{t('rebuild.dashboard.self_eval_label', { defaultValue: 'Self-assessment' })}</div>
          <div className="relative h-[2px] flex-1 rounded-full bg-[color:var(--dashboard-soft-border)]">
            <div
              className="absolute bottom-0 left-0 top-0 rounded-full bg-[color:var(--accent-sky)] shadow-[0_0_8px_rgba(var(--accent-sky-rgb),0.4)] transition-all duration-1000 ease-out"
              style={{ width: `${self}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-[72px] text-[9.5px] font-medium text-[color:var(--text-faint)]">{t('rebuild.dashboard.reality_label', { defaultValue: 'Reality' })}</div>
          <div className="relative h-[2px] flex-1 rounded-full bg-[color:var(--dashboard-soft-border)]">
            <div
              className="absolute bottom-0 left-0 top-0 rounded-full bg-[color:var(--accent)] shadow-[0_0_8px_rgba(var(--accent-rgb),0.4)] transition-all duration-1000 ease-out"
              style={{ width: `${Math.max(2, Math.min(98, reality))}%` }}
            >
              <div className="absolute right-0 top-1/2 h-[5px] w-[5px] -translate-y-1/2 translate-x-1/2 rounded-full bg-[color:var(--accent)] shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const HandshakeScore: React.FC<{ score: number }> = ({ score }) => {
  const value = clamp(score, 0, 100);
  const circumference = 113.1;
  return (
    <div className="relative flex h-12 w-12 items-center justify-center">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r="18" stroke="#ebeff2" strokeWidth="2.1" fill="none" />
        <circle
          cx="20"
          cy="20"
          r="18"
          stroke="#d58a22"
          strokeWidth="2.1"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * value) / 100}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span className="text-[12px] font-black text-[#263041]">{value}%</span>
    </div>
  );
};

const TabButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}> = ({ label, icon, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-medium transition-all border',
      active
        ? 'border-[color:var(--accent-gold)] bg-[color:var(--accent-gold)] text-black shadow-[0_0_12px_rgba(var(--accent-gold-rgb),0.2)]'
        : 'border-[color:var(--dashboard-soft-border)] text-[color:var(--dashboard-text-muted)] hover:border-[color:var(--dashboard-text-faint)] hover:text-[color:var(--dashboard-text-strong)]',
    )}
  >
    {React.cloneElement(icon as React.ReactElement, { size: 12 })}
    {label}
  </button>
);

const SurfaceButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ children, onClick, className }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'rounded-full border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-soft-bg)] px-5 py-2.5 text-[12px] font-medium text-[color:var(--dashboard-text-strong)] transition hover:border-[color:var(--accent-gold)] hover:text-[color:var(--accent-gold)]',
      className,
    )}
  >
    {children}
  </button>
);

const MissingDataPrompt: React.FC<{
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  tone?: 'gold' | 'green' | 'teal';
}> = ({ title, description, actionLabel, onAction, tone = 'gold' }) => {
  const accentClass = tone === 'gold' ? 'text-[color:var(--accent-gold)]' : tone === 'green' ? 'text-[color:var(--accent-green)]' : 'text-[color:var(--accent)]';
  const borderClass = tone === 'gold' ? 'border-[color:var(--accent-gold)]/30' : tone === 'green' ? 'border-[color:var(--accent-green)]/30' : 'border-[color:var(--accent)]/30';
  const bgClass = tone === 'gold' ? 'bg-[color:var(--accent-gold)]/5' : tone === 'green' ? 'bg-[color:var(--accent-green)]/5' : 'bg-[color:var(--accent)]/5';

  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center h-full rounded-[24px] border border-dashed', borderClass, bgClass)}>
      <Sparkles className={cn('mb-4 h-10 w-10', accentClass)} />
      <h3 className={cn('text-lg font-bold mb-2', accentClass)}>{title}</h3>
      <p className="text-sm text-[color:var(--dashboard-text-muted)] max-w-[32ch] mb-6 leading-relaxed">
        {description}
      </p>
      <button
        type="button"
        onClick={onAction}
        className={cn(
          'rounded-full px-6 py-2.5 text-[13px] font-semibold transition shadow-lg',
          tone === 'gold' ? 'bg-[color:var(--accent-gold)] text-black' : tone === 'green' ? 'bg-[color:var(--accent-green)] text-white' : 'bg-[color:var(--accent)] text-white'
        )}
      >
        {actionLabel}
      </button>
    </div>
  );
};

const OnboardingAlert: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  const { t } = useTranslation();
  return (
    <div className="mb-6 overflow-hidden rounded-[24px] border border-amber-200 bg-amber-50/80 backdrop-blur-md shadow-sm transition hover:shadow-md">
      <div className="flex flex-col items-center gap-4 p-5 md:flex-row md:justify-between md:p-6">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="text-lg font-bold text-amber-900">{t('rebuild.dashboard.onboarding_pending_title', { defaultValue: 'Průvodce Shamim není dokončen' })}</div>
            <p className="mt-1 text-sm leading-6 text-amber-800/80">
              {t('rebuild.dashboard.onboarding_pending_desc', { defaultValue: 'Projděte rituálem probuzení, abychom mohli přesněji namířit váš pracovní kompas.' })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-amber-600 px-6 text-sm font-bold text-white shadow-lg shadow-amber-600/20 transition hover:bg-amber-700 hover:scale-[1.02] active:scale-[0.98]"
        >
          {t('rebuild.dashboard.start_ritual', { defaultValue: 'Spustit rituál' })}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export const CandidateDashboardV2: React.FC<{
  roles: Role[];
  preferences: CandidatePreferenceProfile;
  userProfile: UserProfile;
  setUserProfile: (updates: Partial<UserProfile>) => void;
  activeCvDocument?: CVDocument | null;
  cvDocuments?: CVDocument[];
  cvLoading?: boolean;
  cvBusy?: boolean;
  candidateApplications: DialogueSummary[];
  applicationsLoading?: boolean;
  candidateCapacity?: unknown;
  selectedApplicationId?: string | null;
  savedRoleIds?: string[];
  isSavingProfile?: boolean;
  onSaveProfile?: (updates?: Partial<UserProfile>) => void | Promise<void>;
  onOpenAuth?: (intent: 'candidate' | 'recruiter') => void;
  onSelectApplication?: (id: string) => void;
  onToggleSavedRole?: (roleId: string) => void;
  onUploadCv?: (file: File) => Promise<void>;
  onSelectCv?: (cvId: string) => Promise<void>;
  onDeleteCv?: (cvId: string) => Promise<void>;
  onUploadPhoto?: (file: File) => Promise<void>;
  onSignOut?: () => void;
  onCompanySwitch?: () => void;
  currentLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  navigate: (path: string) => void;
  t: TFunction;
}> = ({
  roles,
  preferences,
  userProfile,
  setUserProfile,
  activeCvDocument = null,
  cvDocuments = [],
  cvLoading = false,
  cvBusy = false,
  candidateApplications,
  isSavingProfile,
  onSaveProfile,
  onOpenAuth,
  onUploadCv,
  onSelectCv,
  onDeleteCv,
  onUploadPhoto,
  onSignOut,
  onCompanySwitch,
  currentLanguage,
  onLanguageChange,
  navigate,
  t,
}) => {
    const { resolvedMode } = useRebuildTheme();
    const [currentChatId, setCurrentChatId] = React.useState<string | null>(null);
    const [mentorPrompt, setMentorPrompt] = React.useState('');

    const resolveSectionFromLocation = React.useCallback(() => {
      if (typeof window === 'undefined') return '';
      if (window.location.pathname === '/candidate/profile') return 'profile';
      if (window.location.pathname === '/candidate/learning') return 'learning';
      return window.location.hash.replace('#', '').trim();
    }, []);
    const [hashSection, setHashSection] = React.useState(() => {
      return resolveSectionFromLocation();
    });

    React.useEffect(() => {
      if (typeof window === 'undefined') return undefined;
      const updateHashSection = () => setHashSection(resolveSectionFromLocation());
      updateHashSection();
      window.addEventListener('hashchange', updateHashSection);
      window.addEventListener('popstate', updateHashSection);
      return () => {
        window.removeEventListener('hashchange', updateHashSection);
        window.removeEventListener('popstate', updateHashSection);
      };
    }, [resolveSectionFromLocation]);

    const vm = React.useMemo(
      () => buildCandidateDashboardViewModel(roles, preferences, userProfile, candidateApplications, resolvedMode, t),
      [candidateApplications, preferences, resolvedMode, roles, userProfile, t],
    );

    const evaluatedRoles = React.useMemo(
      () => roles
        .map((role) => ({
          role,
          score: clamp(Math.round(evaluateRole(role, preferences, t).jhi.personalizedScore), 58, 99),
        }))
        .sort((left, right) => right.score - left.score),
      [preferences, roles, t],
    );

    const featuredRole = evaluatedRoles[0]?.role || null;
    const featuredRoleTags = React.useMemo(
      () => featuredRole?.skills?.filter(Boolean).slice(0, 3) || [],
      [featuredRole],
    );

    const handshakeRows = React.useMemo(() => {
      if (candidateApplications.length > 0) {
        return candidateApplications.slice(0, 3).map((application, index) => {
          const matchedRole = evaluatedRoles.find((item) => String(item.role.id) === String(application.job_id)) || evaluatedRoles[index];
          return {
            id: application.id,
            company: application.company_name || matchedRole?.role.companyName || t('rebuild.dashboard.selected_company', { defaultValue: 'Vybraná firma' }),
            role: application.job_snapshot?.title || matchedRole?.role.title || t('rebuild.dashboard.active_handshake', { defaultValue: 'Aktivní jednání' }),
            score: matchedRole?.score || clamp(vm.resonanceScore - (index * 6), 58, 96),
          };
        });
      }

      return evaluatedRoles.slice(0, 3).map((item, index) => ({
        id: item.role.id,
        company: item.role.companyName || t('rebuild.dashboard.company_n', { defaultValue: 'Firma {{n}}', n: index + 1 }),
        role: item.role.title,
        score: item.score || clamp(vm.resonanceScore - (index * 7), 58, 96),
      }));
    }, [candidateApplications, evaluatedRoles, t, vm.resonanceScore]);

    const openHandshakeOrRole = React.useCallback((id: string) => {
      const application = candidateApplications.find((item) => String(item.id) === String(id));
      if (application?.job_id) {
        navigate(`/candidate/journey/${application.job_id}`);
        return;
      }
      const role = roles.find((item) => String(item.id) === String(id));
      if (role) {
        navigate(getRolePath(role));
        return;
      }
      navigate('/candidate/applications');
    }, [candidateApplications, navigate, roles]);

    const [activeArchetypeTab, setActiveArchetypeTab] = React.useState('skills');

    const handleMentorPromptSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!mentorPrompt.trim()) return;
      // Save prompt in sessionStorage so ChatMentor can pick it up
      sessionStorage.setItem('shami_mentor_initial_prompt', mentorPrompt);
      setMentorPrompt('');
      window.location.hash = '#mentor';
    };

    const navItems = [
      { id: 'home', label: t('rebuild.nav.home', { defaultValue: 'Dashboard' }), icon: LayoutDashboard, path: '/candidate/insights' },
      { id: 'profile', label: t('rebuild.nav.profile', { defaultValue: 'Profil' }), icon: CircleUserRound, path: '/candidate/profile' },
      { id: 'jcfpm', label: t('rebuild.nav.self_knowledge', { defaultValue: 'Sebepoznání' }), icon: Brain, path: '/candidate/jcfpm' },
      { id: 'work', label: t('rebuild.nav.work', { defaultValue: 'Tržiště práce' }), icon: Briefcase, path: '/candidate/marketplace' },
      { id: 'applications', label: t('rebuild.nav.applications', { defaultValue: 'Moje žádosti' }), icon: MessageSquare, path: '/candidate/applications' },
      { id: 'learning', label: t('rebuild.nav.learning', { defaultValue: 'Rozvoj' }), icon: GraduationCap, path: '/candidate/learning' },
    ];

    const activeItemId = hashSection === 'profile'
      ? 'profile'
      : hashSection === 'learning'
        ? 'learning'
        : hashSection === 'mentor'
          ? 'home'
          : hashSection === 'messages'
            ? 'applications'
            : 'home';
    const isProfileView = hashSection === 'profile';
    const isMentorView = hashSection === 'mentor';
    const firstName = userProfile.isLoggedIn ? getCandidateGreetingName({ profileName: userProfile.name, language: currentLanguage }) : '';

    if (!userProfile.isLoggedIn) {
      return (
        <DashboardLayoutV2
          userRole="candidate"
          navItems={navItems}
          activeItemId={activeItemId}
          onNavigate={(_id, path) => { if (path) navigate(path); }}
          userProfile={userProfile}
          onCompanySwitch={onCompanySwitch}
          currentLanguage={currentLanguage}
          onLanguageChange={onLanguageChange}
          title="Jobshaman"
          subtitle={t('rebuild.dashboard.logged_out_subtitle', { defaultValue: 'Přihlaste se a otevřete svůj osobní pracovní kompas.' })}
          t={t}
        >
          <CandidateShellSurface variant="dashboard" className="max-w-full px-2 pb-2 pt-1">
            <ShellCard className="overflow-hidden p-0 shamanic-glass-card relative">
              <div className="shamanic-noise-overlay absolute inset-0 rounded-[24px]" />
              <div className="grid gap-6 p-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center relative z-10">
                <div>
                  <div className={sectionTitleClass}>{t('rebuild.dashboard.private_compass', { defaultValue: 'Osobní pracovní kompas' })}</div>
                  <h1 className="mt-4 max-w-2xl text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.055em] text-[color:var(--text-strong)]">
                    {t('rebuild.dashboard.auth_required_title', { defaultValue: 'Vaše data se zobrazí po přihlášení.' })}
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
                    {t('rebuild.dashboard.auth_required_desc', { defaultValue: 'Profil, archetyp, JHI a doporučení jsou soukromé. V odhlášeném režimu je nezobrazujeme.' })}
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button type="button" onClick={() => onOpenAuth?.('candidate')} className={primaryButtonClass}>
                      {t('rebuild.nav.sign_in', { defaultValue: 'Přihlásit se' })}
                    </button>
                    <button type="button" onClick={onCompanySwitch || (() => onOpenAuth?.('recruiter'))} className={secondaryButtonClass}>
                      {t('rebuild.dashboard.company_profile', { defaultValue: 'Firemní profil' })}
                    </button>
                    <button type="button" onClick={() => navigate('/candidate/marketplace')} className={secondaryButtonClass}>
                      {t('rebuild.dashboard.browse_jobs', { defaultValue: 'Procházet nabídky' })}
                    </button>
                  </div>
                </div>
                <div className="rounded-[26px] border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-soft-bg)] p-5">
                  <div className="text-[1.05rem] font-semibold text-[color:var(--text-strong)]">{t('rebuild.dashboard.auth_info_title', { defaultValue: 'Co se po přihlášení odemkne' })}</div>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--text-muted)]">
                    <div className="rounded-[18px] bg-[color:var(--dashboard-card-bg)] border border-[color:var(--dashboard-soft-border)] px-4 py-3">{t('rebuild.dashboard.auth_info_profile', { defaultValue: 'Profil a dokumenty životopisu' })}</div>
                    <div className="rounded-[18px] bg-[color:var(--dashboard-card-bg)] border border-[color:var(--dashboard-soft-border)] px-4 py-3">{t('rebuild.dashboard.auth_info_jhi', { defaultValue: 'Sebepoznání, JHI index a mapa růstu' })}</div>
                    <div className="rounded-[18px] bg-[color:var(--dashboard-card-bg)] border border-[color:var(--dashboard-soft-border)] px-4 py-3">{t('rebuild.dashboard.auth_info_apps', { defaultValue: 'Jednání s firmami, doporučení a uložené role' })}</div>
                  </div>
                </div>
              </div>
            </ShellCard>
          </CandidateShellSurface>
        </DashboardLayoutV2>
      );
    }

    // Prepare tab descriptive texts
    const archetypeCopy = formatArchetypeCopy(vm.archetypeDescription, t);
    const tabCopy: Record<string, string> = {
      skills: archetypeCopy.join(' '),
      motivation: vm.mentorAdvice || t('rebuild.dashboard.motivation_default', { defaultValue: 'Vaše motivace směřuje k seberealizaci a objevování nových obzorů.' }),
      environment: t('rebuild.dashboard.top_signals', { defaultValue: 'Nejsilnější kariérní signály: {{signals}}.', signals: vm.heroMetrics.slice(0, 3).map((metric) => metric.label).join(', ') }),
      values: vm.challengeTags.length ? t('rebuild.dashboard.value_fit', { defaultValue: 'Témata hodnotově nejbližší: {{tags}}.', tags: vm.challengeTags.join(', ') }) : vm.archetypeDescription,
      risks: vm.blindSpots.length ? t('rebuild.dashboard.risks_warning', { defaultValue: 'Pozor na tyto slepé skvrny: {{risks}}.', risks: vm.blindSpots.slice(0, 2).map((spot) => spot.label).join(', ') }) : t('rebuild.dashboard.risks_refining', { defaultValue: 'Slepé skvrny upřesníme po vyplnění rituálu sebepoznání.' }),
    };

    return (
      <DashboardLayoutV2
        userRole="candidate"
        navItems={navItems}
        activeItemId={activeItemId}
        onNavigate={(_id, path) => { if (path) navigate(path); }}
        userProfile={userProfile}
        onSignOut={onSignOut}
        onCompanySwitch={onCompanySwitch}
        currentLanguage={currentLanguage}
        onLanguageChange={onLanguageChange}
        title={isProfileView ? t('rebuild.dashboard.my_profile', { defaultValue: 'Můj profil' }) : firstName ? t('rebuild.dashboard.greeting', { defaultValue: 'Ahoj, {{name}}', name: firstName }) : t('rebuild.dashboard.default_title', { defaultValue: 'Tvůj pracovní kompas' })}
        subtitle={isProfileView ? t('rebuild.dashboard.profile_subtitle', { defaultValue: 'Vaše dovednosti, zkušenosti a potenciál na jednom místě.' }) : t('rebuild.dashboard.default_subtitle', { defaultValue: '„Každý má v sobě potenciál. Naším posláním je ho probudit.“ — Shami' })}
        t={t}
      >
        {isProfileView ? (
          <CandidateProfileV2
            userProfile={userProfile}
            setUserProfile={setUserProfile}
            preferences={preferences}
            activeCvDocument={activeCvDocument}
            cvDocuments={cvDocuments}
            cvLoading={cvLoading}
            cvBusy={cvBusy}
            isSavingProfile={isSavingProfile}
            onSaveProfile={onSaveProfile}
            onUploadCv={onUploadCv}
            onSelectCv={onSelectCv}
            onDeleteCv={onDeleteCv}
            onUploadPhoto={onUploadPhoto}
            navigate={navigate}
          />
        ) : isMentorView ? (
          <div className="flex w-full h-[75vh] gap-5">
            <div className="flex-1 min-w-0 rounded-3xl border border-cyan-100 bg-white shadow-xl overflow-hidden p-2 md:p-4 transition-all duration-200">
              <ChatMentor
                intro={t('rebuild.dashboard.mentor_intro', { defaultValue: 'Jsem tady. Ne jako chatbot na líbivé věty, ale jako pracovní zrcadlo. Začni otázkou, nebo mi rovnou řekni, kde se ti kariéra zasekla, {{name}}.', name: getCandidateGreetingName({ profileName: userProfile.name, language: currentLanguage }) || t('rebuild.dashboard.you', { defaultValue: 'ty' }) })}
                sendMessageFn={async (message, messages) => {
                  const reply = await sendMentorChatMessage(message, messages);
                  return {
                    reply: [reply.reply, reply.next_step ? `${t('rebuild.dashboard.next_step', { defaultValue: 'Další krok' })}: ${reply.next_step}` : ''].filter(Boolean).join('\n\n')
                  };
                }}
                storageKey={`shami_candidate_chat_${userProfile?.id || 'anonymous'}`}
              />
            </div>
            <div className="hidden xl:block w-[360px] max-w-xs flex-shrink-0">
              <CandidateChatSidebar
                userId={userProfile?.id}
                selectedChatId={currentChatId}
                onSelectChat={setCurrentChatId}
              />
            </div>
          </div>
        ) : (
          <CandidateShellSurface variant="dashboard" className="max-w-full px-2 pb-6 pt-1">
            {!vm.isOnboardingComplete && (
              <OnboardingAlert onStart={() => navigate('/ritual')} />
            )}

            {/* Premium 3-Column Responsive Shamanic Grid Layout */}
            <div className="grid gap-6 lg:grid-cols-12 items-start">
              
              {/* COLUMN 1: OSOBNÍ KOMPAS & ARCHETYP (lg:col-span-5) */}
              <div className="lg:col-span-5 space-y-6">
                <div className="shamanic-glass-card rounded-[32px] overflow-hidden p-6 relative flex flex-col min-h-[520px]">
                  <div className="shamanic-noise-overlay absolute inset-0 rounded-[32px]" />
                  <div className="relative z-10 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={sectionTitleClass}>{t('rebuild.dashboard.archetype_label', { defaultValue: 'Tvůj archetyp' })}</span>
                        <div className="rounded-full bg-[color:var(--accent-gold)]/10 px-3 py-1 text-[11px] font-bold text-[color:var(--accent-gold)]">
                          JHI {vm.resonanceScore}%
                        </div>
                      </div>

                      {vm.isJcfpmComplete ? (
                        <>
                          <h2 className="mt-5 text-[28px] font-extrabold leading-none tracking-tight text-[color:var(--accent-gold)] drop-shadow-[0_0_12px_rgba(var(--accent-gold-rgb),0.25)]">
                            {vm.archetypeTitle}
                          </h2>
                          <div className="mt-6 relative h-[210px] w-full flex items-center justify-center overflow-hidden">
                            <AnimatedEnsoRing />
                            <div className="relative z-10 flex flex-col items-center">
                              <span className="text-[44px] font-black tracking-tighter text-[color:var(--text-strong)] leading-none">{vm.resonanceScore}%</span>
                              <span className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--text-muted)] mt-1">{t('rebuild.dashboard.resonance', { defaultValue: 'Rezonance' })}</span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="mt-12 flex flex-col items-center justify-center text-center p-4">
                          <Brain size={48} className="text-[color:var(--accent-gold)] animate-pulse" />
                          <h3 className="mt-4 text-lg font-bold text-[color:var(--accent-gold)]">{t('rebuild.dashboard.unlock_identity', { defaultValue: 'Odemkni svou identitu' })}</h3>
                          <p className="mt-2 text-xs text-[color:var(--text-muted)] max-w-[24ch] leading-relaxed">
                            Projděte testem JCFPM k zobrazení vašeho kariérního archetypu a indexu souladu.
                          </p>
                          <button
                            type="button"
                            onClick={() => navigate('/candidate/jcfpm')}
                            className="mt-6 rounded-full bg-[color:var(--accent-gold)] text-black px-6 py-2.5 text-xs font-bold transition hover:scale-105"
                          >
                            Spustit test
                          </button>
                        </div>
                      )}
                    </div>

                    {vm.isJcfpmComplete && (
                      <div className="mt-4">
                        <div className="rounded-2xl bg-[color:var(--dashboard-soft-bg)] border border-[color:var(--dashboard-soft-border)] p-4 text-[13px] text-[color:var(--text-strong)] leading-relaxed">
                          <p className="font-semibold text-[color:var(--accent-gold)] mb-1">
                            {activeArchetypeTab === 'skills' ? 'Kariérní esence' :
                             activeArchetypeTab === 'motivation' ? 'Šamanovo doporučení' :
                             activeArchetypeTab === 'environment' ? 'Ideální prostředí' :
                             activeArchetypeTab === 'values' ? 'Hodnotové ladění' : 'Oblasti růstu'}
                          </p>
                          <p className="text-[color:var(--text-muted)] text-[12px]">{tabCopy[activeArchetypeTab]}</p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
                          {['skills', 'motivation', 'environment', 'values', 'risks'].map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setActiveArchetypeTab(tab)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border",
                                activeArchetypeTab === tab
                                  ? "bg-[color:var(--accent-gold)] text-black border-[color:var(--accent-gold)]"
                                  : "bg-transparent text-[color:var(--text-muted)] border-[color:var(--dashboard-soft-border)] hover:text-[color:var(--text-strong)]"
                              )}
                            >
                              {tab === 'skills' ? 'Esence' :
                               tab === 'motivation' ? 'Rada' :
                               tab === 'environment' ? 'Prostředí' :
                               tab === 'values' ? 'Hodnoty' : 'Rizika'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick stats pills */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-card-bg)] p-4 shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[color:var(--text-muted)]">Fokus týdne</span>
                    <p className="mt-2 text-[14px] font-bold text-[color:var(--text-strong)] truncate">{vm.recommendedGrowthTitle}</p>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-card-bg)] p-4 shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[color:var(--text-muted)]">Příležitost</span>
                    <p className="mt-2 text-[14px] font-bold text-[color:var(--accent-cyan)] truncate">{vm.challengeTags[0] || 'Prozkoumat trh'}</p>
                  </div>
                </div>
              </div>

              {/* COLUMN 2: PRŮVODCE SHAMI & MENTOR (lg:col-span-4) */}
              <div className="lg:col-span-4 space-y-6">
                <div className="shamanic-glass-card rounded-[32px] overflow-hidden p-6 relative flex flex-col min-h-[520px]">
                  <div className="shamanic-noise-overlay absolute inset-0 rounded-[32px]" />
                  <div className="relative z-10 flex-1 flex flex-col justify-between">
                    
                    {/* Shami Avatar & Sparkle Greeting */}
                    <div className="flex flex-col items-center text-center">
                      <div className="relative">
                        <div className="absolute inset-0 bg-[color:var(--accent)]/10 rounded-full blur-xl scale-125 animate-pulse" />
                        <img
                          src={vm.isJcfpmComplete ? "/shami-happy.png" : "/shami.png"}
                          alt="Průvodce Shami"
                          className="w-24 h-24 object-contain relative z-10 shami-avatar-anim"
                        />
                      </div>
                      <h3 className="mt-4 text-[18px] font-extrabold text-[color:var(--text-strong)] flex items-center gap-1.5 justify-center">
                        <Sparkles size={16} className="text-[color:var(--accent-gold)]" />
                        Průvodce Shami
                      </h3>
                    </div>

                    {/* Speech Bubble */}
                    <div className="mt-6 flex-1 flex flex-col justify-center">
                      <div className="shami-speech-bubble relative rounded-2xl bg-[color:var(--dashboard-soft-bg)] border border-[color:var(--dashboard-soft-border)] p-4 text-[13px] text-[color:var(--text-muted)] leading-relaxed shadow-inner">
                        <div className="absolute top-[-8px] left-[50%] -translate-x-1/2 w-4 h-4 bg-[color:var(--dashboard-soft-bg)] border-t border-l border-[color:var(--dashboard-soft-border)] rotate-45" />
                        <p className="italic text-center font-medium">
                          „{vm.mentorAdvice || "Naslouchej svému vnitřnímu hlasu. Tvá profesní cesta se začíná jasně rýsovat. Zeptej se mě na cokoliv, co tě zajímá."}“
                        </p>
                      </div>
                    </div>

                    {/* Quick interactive search input */}
                    <form onSubmit={handleMentorPromptSubmit} className="mt-6 relative">
                      <input
                        type="text"
                        placeholder="Zeptej se Shamiho na svou kariéru..."
                        value={mentorPrompt}
                        onChange={(e) => setMentorPrompt(e.target.value)}
                        className="w-full h-11 rounded-full bg-[color:var(--dashboard-card-bg)] border border-[color:var(--dashboard-soft-border)] px-4 pr-11 text-xs text-[color:var(--text-strong)] focus:outline-none focus:border-[color:var(--accent)] focus:ring-1 focus:ring-[color:var(--accent)] transition"
                      />
                      <button
                        type="submit"
                        className="absolute right-1.5 top-1.5 h-8 w-8 rounded-full bg-[color:var(--accent)] text-white flex items-center justify-center hover:scale-105 active:scale-95 transition"
                      >
                        <Send size={12} />
                      </button>
                    </form>

                    {/* Fast links */}
                    <div className="mt-4 flex justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => navigate('/candidate/insights#mentor')}
                        className="text-[11px] font-bold text-[color:var(--accent-cyan)] hover:underline flex items-center gap-1"
                      >
                        <MessageSquare size={12} />
                        Otevřít chatovací zrcadlo
                      </button>
                    </div>

                  </div>
                </div>

                {/* Shami's recommended job if available */}
                {vm.isJcfpmComplete && roles.length > 0 && (
                  <div className="rounded-2xl border border-[#c7e9f0] bg-[#f7fcfd] p-4 text-left shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#0f95ac]">Doporučená výzva pro vás</span>
                    <h4 className="mt-1 text-[13px] font-black text-slate-950 truncate">{featuredRole?.title}</h4>
                    <p className="mt-1 text-[11px] text-slate-500 leading-snug truncate">{featuredRole?.companyName} · {featuredRole?.location}</p>
                    <button
                      type="button"
                      onClick={() => navigate(getRolePath(featuredRole))}
                      className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-black text-[#0f95ac] hover:text-[#0b7181]"
                    >
                      Otevřít detail role
                      <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* COLUMN 3: DRÁHA RŮSTU & JEDNÁNÍ (lg:col-span-3) */}
              <div className="lg:col-span-3 space-y-6">
                
                {/* Growth milestones */}
                <div className="rounded-3xl border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-card-bg)] p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className={sectionTitleClass}>Cesta rozvoje</span>
                    <span className="text-xs font-bold text-[color:var(--accent-green)]">{vm.growthProgress}%</span>
                  </div>

                  <div className="relative h-1 bg-[color:var(--dashboard-soft-border)] rounded-full overflow-hidden mb-6">
                    <div
                      className="absolute top-0 bottom-0 left-0 bg-[color:var(--accent-green)] shadow-[0_0_8px_rgba(var(--accent-green-rgb),0.5)] transition-all duration-1000"
                      style={{ width: `${vm.growthProgress}%` }}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-[color:var(--accent-green)]/10 text-[color:var(--accent-green)] flex items-center justify-center text-xs font-bold shrink-0">1</div>
                      <div>
                        <p className="text-[12px] font-bold text-[color:var(--text-strong)]">Aktuální úroveň</p>
                        <p className="text-[11px] text-[color:var(--text-muted)]">Analýza silných stránek</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-[color:var(--accent-gold)]/10 text-[color:var(--accent-gold)] flex items-center justify-center text-xs font-bold shrink-0">2</div>
                      <div>
                        <p className="text-[12px] font-bold text-[color:var(--text-strong)]">Další milník</p>
                        <p className="text-[11px] text-[color:var(--text-muted)] truncate max-w-[120px]">{getCompactArchetypeTitle(vm.growthMapNodes[1]?.title || 'Lídr', t)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Handshakes applications */}
                <div className="rounded-3xl border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-card-bg)] p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className={sectionTitleClass}>Aktivní jednání</span>
                    <button type="button" onClick={() => navigate('/candidate/applications')} className="text-[10px] font-bold text-[color:var(--text-muted)] hover:text-[color:var(--text-strong)]">
                      Vše
                    </button>
                  </div>

                  <div className="space-y-3">
                    {handshakeRows.length > 0 ? (
                      handshakeRows.slice(0, 2).map((row, index) => (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => openHandshakeOrRole(row.id)}
                          className="w-full text-left p-3 rounded-2xl border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-soft-bg)] hover:bg-[color:var(--dashboard-card-bg)] transition flex items-center gap-3"
                        >
                          <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0", companyTileClass[index % companyTileClass.length])}>
                            {row.company.slice(0,1).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-bold text-[color:var(--text-strong)] truncate">{row.company}</p>
                            <p className="text-[11px] text-[color:var(--text-muted)] truncate">{row.role}</p>
                          </div>
                          <div className="text-[11px] font-black text-[color:var(--accent-gold)]">{row.score}%</div>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-[color:var(--text-muted)] text-center py-4">Žádné rozpracované nabídky.</p>
                    )}
                  </div>
                </div>

                {/* Quick compass action buttons */}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/candidate/marketplace')}
                    className="w-full h-11 rounded-2xl border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-soft-bg)] hover:bg-[color:var(--dashboard-soft-border)] text-xs font-bold text-[color:var(--text-strong)] transition"
                  >
                    Prozkoumat trh práce
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/candidate/profile')}
                    className="w-full h-11 rounded-2xl border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-soft-bg)] hover:bg-[color:var(--dashboard-soft-border)] text-xs font-bold text-[color:var(--text-strong)] transition"
                  >
                    Upravit můj profil
                  </button>
                </div>

              </div>

            </div>
          </CandidateShellSurface>
        )}
      </DashboardLayoutV2>
    );
  };


