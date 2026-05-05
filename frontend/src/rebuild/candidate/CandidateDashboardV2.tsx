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
  Users,
  Zap,
  Brain,
  Loader2,
  Send,
  Sparkles,
} from 'lucide-react';

import type { CVDocument, DialogueSummary, UserProfile } from '../../types';
import type { CandidatePreferenceProfile, Role } from '../models';
import { cn } from '../cn';
import { buildCandidateDashboardViewModel, clamp } from '../dashboard/viewModels';
import { evaluateRole } from '../intelligence';
import { DashboardLayoutV2 } from '../ui/DashboardLayoutV2';
import { useRebuildTheme } from '../ui/rebuildTheme';
import { primaryButtonClass, secondaryButtonClass } from '../ui/shellStyles';
import { CandidateShellSurface, ShellCard } from './CandidateShellSurface';
import { CandidateProfileV2 } from './CandidateProfileV2';
import { sendMentorChatMessage, type MentorChatMessage } from '../../services/v2MentorService';

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

const ArchetypeHeroCard: React.FC<{
  vm: ReturnType<typeof buildCandidateDashboardViewModel>;
  onOpenDetail: () => void;
}> = ({ vm, onOpenDetail }) => {
  const { t } = useTranslation();
  const copy = formatArchetypeCopy(vm.archetypeDescription, t);
  const [activeTab, setActiveTab] = React.useState('skills');
  const tabCopy: Record<string, string> = {
    skills: copy.join(' '),
    motivation: vm.mentorAdvice,
    environment: t('rebuild.dashboard.top_signals', { defaultValue: 'Top signals: {{signals}}.', signals: vm.heroMetrics.slice(0, 3).map((metric) => metric.label).join(', ') }),
    values: vm.challengeTags.length ? t('rebuild.dashboard.value_fit', { defaultValue: 'Topics that currently fit you best value-wise: {{tags}}.', tags: vm.challengeTags.join(', ') }) : vm.archetypeDescription,
    risks: vm.blindSpots.length ? t('rebuild.dashboard.risks_warning', { defaultValue: 'Watch out for: {{risks}}.', risks: vm.blindSpots.slice(0, 2).map((spot) => spot.label).join(', ') }) : t('rebuild.dashboard.risks_refining', { defaultValue: 'Risks will be refined after completing JCFPM.' }),
  };

  return (
    <ShellCard tone="default" className="overflow-hidden xl:min-h-[514px]">
      <div className="grid h-full xl:grid-cols-[0.52fr_0.48fr]">
        <div className="flex min-w-0 flex-col px-5 py-5 xl:px-8 xl:py-7">
          <div className={sectionTitleClass}>{t('rebuild.dashboard.archetype_label', { defaultValue: 'Your archetype' })}</div>

          <div className="mt-5 flex items-start gap-3">
            <h2 className="max-w-[18ch] text-[26px] font-semibold leading-[1.15] tracking-tight text-[color:var(--accent-gold)] drop-shadow-[0_0_12px_rgba(var(--accent-gold-rgb),0.3)] xl:text-[28px]">
              {vm.archetypeTitle}
            </h2>
            <Info size={16} className="mt-1 shrink-0 text-[color:var(--dashboard-text-muted)]" />
          </div>

          <div className="mt-5 max-w-[29ch] space-y-1.5 text-[14px] leading-7 text-[color:var(--dashboard-text-faint)]">
            <p>{tabCopy[activeTab] || copy.join(' ')}</p>
          </div>

          <div className="mt-8">
            <SurfaceButton onClick={onOpenDetail}>{t('rebuild.dashboard.view_detail', { defaultValue: 'View detail' })}</SurfaceButton>
          </div>

          <div className="mt-8 pt-6">
            <div className={sectionTitleClass}>{t('rebuild.dashboard.resonance_label', { defaultValue: 'Resonance score' })}</div>
            <div className="mt-5 flex items-center gap-5">
              <ResonanceRing score={vm.resonanceScore} />
              <p className="max-w-[28ch] text-[13px] leading-6 text-[color:var(--dashboard-text-faint)]">
                {t('rebuild.dashboard.resonance_copy', { defaultValue: 'High alignment with an environment that allows you to grow and deliver real value.' })}
              </p>
            </div>
          </div>

          <div className="mt-auto pt-6">
            <div className="flex flex-wrap xl:flex-nowrap gap-2">
              <TabButton label={t('rebuild.dashboard.tab_skills', { defaultValue: 'Skills' })} icon={<Zap size={13} />} active={activeTab === 'skills'} onClick={() => setActiveTab('skills')} />
              <TabButton label={t('rebuild.dashboard.tab_motivation', { defaultValue: 'Motivation' })} icon={<Target size={13} />} active={activeTab === 'motivation'} onClick={() => setActiveTab('motivation')} />
              <TabButton label={t('rebuild.dashboard.tab_environment', { defaultValue: 'Environment' })} icon={<Network size={13} />} active={activeTab === 'environment'} onClick={() => setActiveTab('environment')} />
              <TabButton label={t('rebuild.dashboard.tab_values', { defaultValue: 'Values' })} icon={<Award size={13} />} active={activeTab === 'values'} onClick={() => setActiveTab('values')} />
              <TabButton label={t('rebuild.dashboard.tab_risks', { defaultValue: 'Risks' })} icon={<ShieldAlert size={13} />} active={activeTab === 'risks'} onClick={() => setActiveTab('risks')} />
            </div>
          </div>
        </div>

        <div className="relative min-h-[340px] overflow-hidden flex items-center justify-center px-4 py-4 xl:px-8 xl:py-6">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(var(--accent-gold-rgb),0.1),transparent_65%)]" />
            <AnimatedEnsoRing />
          </div>

          {vm.heroMetrics.slice(0, 6).map((metric, index) => {
            const layout = heroMetricLayout[index];
            if (!layout) return null;
            return <HeroMetricBadge key={metric.id} metric={metric} className={layout.className} side={layout.side} index={index} />;
          })}

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative h-[92%] w-full max-w-[380px]">
              <img
                src="/logo-transparent.png"
                alt="Shaman"
                className="absolute inset-x-0 bottom-0 h-full w-full object-contain object-center drop-shadow-[0_0_32px_rgba(var(--accent-rgb),0.2)]"
              />
            </div>
          </div>
        </div>
      </div>
    </ShellCard>
  );
};

const GrowthAnalysisCard: React.FC<{
  vm: ReturnType<typeof buildCandidateDashboardViewModel>;
  onOpenDetail: () => void;
}> = ({ vm, onOpenDetail }) => {
  const { t } = useTranslation();
    <ShellCard tone="default" className="flex flex-col overflow-hidden h-full">
      {/* Growth Section */}
      <div className="relative p-5 xl:p-6 border-b border-[color:var(--dashboard-soft-border)] bg-[linear-gradient(180deg,rgba(var(--accent-green-rgb),0.03),transparent)]">
        <div className="absolute top-4 right-4 xl:block hidden">
          <NetworkBrain complexity={vm.growthProgress} />
        </div>

        <div className="relative z-10">
          <div className={sectionTitleClass}>{t('rebuild.dashboard.growth_label', { defaultValue: 'Recommended growth' })}</div>
          <h3 className="mt-3 max-w-[18ch] text-[18px] font-semibold leading-[1.2] tracking-tight text-[color:var(--accent-green)] drop-shadow-[0_0_12px_rgba(var(--accent-green-rgb),0.2)] line-clamp-2">
            {vm.recommendedGrowthTitle}
          </h3>
          <p className="mt-2 max-w-[28ch] text-[13px] leading-snug text-[color:var(--text-faint)] line-clamp-2">
            {vm.recommendedGrowthCopy}
          </p>

          <div className="mt-5 flex items-center justify-between text-[12px] font-semibold max-w-[85%]">
            <span className="text-[color:var(--accent-green)]">{vm.growthProgress}%</span>
            <span className="text-[color:var(--text-faint)]">{t('rebuild.dashboard.focus_label', { defaultValue: 'Weekly focus' })}</span>
          </div>
          <div className="mt-2 relative h-[2px] w-[85%] overflow-visible rounded-full bg-[color:var(--dashboard-soft-border)]">
            <div
              className="absolute bottom-0 left-0 top-0 rounded-full bg-[linear-gradient(90deg,transparent,rgba(var(--accent-green-rgb),1))] shadow-[0_0_12px_rgba(var(--accent-green-rgb),0.6)] transition-all duration-1000 ease-out"
              style={{ width: `${vm.growthProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Blind Spots Section */}
      <div className="flex flex-1 flex-col p-5 xl:p-6">
        <div className="flex items-center gap-2">
          <div className={sectionTitleClass}>{t('rebuild.dashboard.blind_spots_label', { defaultValue: 'Blind spots' })}</div>
          <Info size={14} className="text-[color:var(--text-faint)]" />
        </div>

        <div className="mt-5 flex-1 space-y-1">
          {vm.blindSpots.slice(0, 3).map((spot) => (
            <BlindSpotRow
              key={spot.label}
              label={spot.label}
              self={spot.self}
              reality={spot.reality}
              delta={Math.round(spot.delta)}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-between gap-3">
          <SurfaceButton onClick={onOpenDetail} className="w-full flex items-center justify-center gap-2">
            <Award size={14} />
            {t('rebuild.dashboard.continue_training', { defaultValue: 'Continue training' })}
          </SurfaceButton>
        </div>
      </div>
    </ShellCard>
  );
};

const ChallengeCard: React.FC<{
  role: Role | null;
  tags: string[];
  portalAsset: string;
  onOpenRole: () => void;
  onOpenAll: () => void;
}> = ({ role, tags, portalAsset, onOpenRole, onOpenAll }) => {
  const { t } = useTranslation();
  return (
    <ShellCard className="overflow-hidden border-[#e9e1d6] bg-white shadow-[0_18px_42px_-34px_rgba(78,61,28,0.28)] xl:min-h-[252px]">
      <div className="flex h-full flex-col px-5 py-5 xl:px-6 xl:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className={sectionTitleClass}>{t('rebuild.dashboard.challenges_label', { defaultValue: 'Current challenges' })}</div>
          <button type="button" onClick={onOpenAll} className="rounded-full border border-[#ece4d8] px-3 py-1 text-[11px] font-medium text-[#707885] transition hover:bg-slate-50">
            {t('rebuild.dashboard.view_all', { defaultValue: 'View all' })}
          </button>
        </div>

        {role ? (
          <>
            <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_10.25rem]">
              <div className="min-w-0">
                <div className="inline-flex rounded-md border border-[#f1d9b0] bg-[#fff6e9] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#b26f16]">
                  {t('rebuild.dashboard.new_badge', { defaultValue: 'New' })}
                </div>
                <h3 className="mt-3 max-w-[17ch] text-[18px] font-semibold leading-[1.15] tracking-[-0.03em] text-[#111827] line-clamp-2">
                  {role.title}
                </h3>
                <p className="mt-3 max-w-[31ch] text-[14px] leading-6 text-[#5b6472] line-clamp-3">
                  {role.challenge || role.summary || role.description}
                </p>

                {tags.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full border border-[#e8e4dc] bg-white px-3 py-1 text-[12px] font-medium text-[#6a7380]">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-4 text-[13px] text-[#6a7380]">
                  <span className="inline-flex items-center gap-1.5">
                    <Briefcase size={12} className="text-[#c58c38]" />
                    Marketplace
                  </span>
                  {role.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={12} className="text-[#2496ab]" />
                      {role.location}
                    </span>
                  ) : null}
                  {role.workModel ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 size={12} className="text-slate-400" />
                      {role.workModel}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="hidden xl:block">
                <div className="relative h-full min-h-[154px] overflow-hidden rounded-[22px] border border-[#e8e0d4] bg-[#dce7f3]">
                  <img
                    src={role.heroImage || portalAsset}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(16,24,40,0.08)_100%)]" />
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end xl:mt-3">
              <button
                type="button"
                onClick={onOpenRole}
                className="inline-flex items-center justify-center rounded-[16px] bg-[#f6d999] px-5 py-3 text-[14px] font-medium text-[#4a3515] shadow-[0_20px_28px_-20px_rgba(74,53,21,0.42)] transition hover:bg-[#f3d58c]"
              >
                {t('rebuild.dashboard.accept_challenge', { defaultValue: 'Accept challenge' })}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 flex min-h-[170px] flex-1 items-center justify-center rounded-[22px] border border-dashed border-[#e3e8ec] bg-[#fbfcfd] px-6 text-center text-[13px] leading-6 text-[#6a7380]">
            {t('rebuild.dashboard.no_challenges', { defaultValue: 'Once marketplace challenges arrive from the database, the one with the highest current match will appear here.' })}
          </div>
        )}
      </div>
    </ShellCard>
  );
};

const HandshakeCard: React.FC<{
  rows: Array<{ id: string; company: string; role: string; score: number }>;
  onOpenHandshake: (id: string) => void;
  onOpenAll: () => void;
}> = ({ rows, onOpenHandshake, onOpenAll }) => {
  const { t } = useTranslation();
  return (
    <ShellCard className="overflow-hidden border-[#e9e1d6] bg-white shadow-[0_18px_42px_-34px_rgba(78,61,28,0.28)] xl:min-h-[252px]">
      <div className="flex h-full flex-col px-5 py-5 xl:px-6 xl:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className={sectionTitleClass}>{t('rebuild.dashboard.handshake_label', { defaultValue: 'Handshake' })}</div>
          <button type="button" onClick={onOpenAll} className="rounded-full border border-[#ece4d8] px-3 py-1 text-[11px] font-medium text-[#707885] transition hover:bg-slate-50">
            {t('rebuild.dashboard.view_all', { defaultValue: 'View all' })}
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {rows.length > 0 ? rows.slice(0, 3).map((row, index) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onOpenHandshake(row.id)}
              className="flex w-full items-center gap-3 rounded-[18px] border border-[#ebeff2] bg-white px-3 py-3 text-left transition hover:border-[#dde7ed] hover:bg-[#fbfcfd]"
            >
              <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[14px] font-black', companyTileClass[index % companyTileClass.length])}>
                {row.company.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-medium text-[#111827]">{row.company}</div>
                <div className="truncate text-[13px] text-[#6a7380]">{row.role}</div>
              </div>
              <HandshakeScore score={row.score} />
              <ChevronRight size={16} className="shrink-0 text-slate-300" />
            </button>
          )) : (
            <div className="rounded-[18px] border border-dashed border-[#e1e7eb] bg-[#fbfcfd] px-4 py-8 text-center text-[13px] leading-7 text-[#6a7380]">
              {t('rebuild.dashboard.no_handshakes', { defaultValue: 'As soon as the first matches or handshakes submitted appear, you will see them here in a clear timeline.' })}
            </div>
          )}
        </div>
      </div>
    </ShellCard>
  );
};

const GrowthMapCard: React.FC<{
  vm: ReturnType<typeof buildCandidateDashboardViewModel>;
  onOpenMap: () => void;
}> = ({ vm, onOpenMap }) => {
  const { t } = useTranslation();
  const currentNode = vm.growthMapNodes[0];
  const focusNode = vm.growthMapNodes[1];
  const futureNode = vm.growthMapNodes[2];
  const compactFocusTitle = getCompactArchetypeTitle(focusNode?.title || 'Archetyp', t);

  return (
    <ShellCard className="overflow-hidden border-[#e9e1d6] bg-white shadow-[0_18px_42px_-34px_rgba(78,61,28,0.28)] xl:min-h-[252px]">
      <div className="flex h-full flex-col px-5 py-5 xl:px-6 xl:py-6">
        <div className="flex items-center justify-between gap-3">
          <div className={sectionTitleClass}>{t('rebuild.dashboard.growth_map_label', { defaultValue: 'Your growth map' })}</div>
          <button
            type="button"
            onClick={onOpenMap}
            className="rounded-full border border-[#ece4d8] px-3 py-1 text-[11px] font-medium text-[#707885] transition hover:bg-slate-50"
          >
            {t('rebuild.dashboard.view_map', { defaultValue: 'View map' })}
          </button>
        </div>

        <div className="relative mt-auto">
          <div className="absolute left-[8%] right-[8%] top-[22px] h-px bg-[color:var(--dashboard-soft-border)] z-0 overflow-hidden">
            <div className="h-full w-full bg-[linear-gradient(90deg,transparent,rgba(var(--accent-rgb),0.3),transparent)] animate-pulse" />
          </div>
          <div className="grid grid-cols-[1fr_0.45fr_1fr_0.45fr_1fr] items-start gap-2 relative z-10">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#cfe3e8] bg-white text-[#2496ab]">
                <Users size={15} />
              </div>
              <div className="mt-4 text-[15px] font-medium text-[#243040]">{currentNode?.title || t('rebuild.dashboard.default_current_role', { defaultValue: 'Analyst' })}</div>
              <div className="mt-1 text-[12px] text-[#6a7380]">{currentNode?.caption || t('rebuild.dashboard.current_level', { defaultValue: 'Current level' })}</div>
            </div>

            <div className="flex flex-col items-center pt-1 text-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#edd5ac] bg-white text-[#d58a22]">
                <span className="block h-1.5 w-1.5 rounded-full bg-current" />
              </div>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#d58a22] bg-white text-[#b26f15] shadow-[0_18px_28px_-22px_rgba(181,111,21,0.5)]">
                <Users size={16} />
              </div>
              <div className="mt-4 max-w-[8ch] text-[15px] font-medium leading-5 text-[#243040]">{compactFocusTitle}</div>
              <div className="mt-1 text-[12px] font-medium text-[#b26f17]">{focusNode?.caption || t('rebuild.dashboard.next_milestone', { defaultValue: 'Next milestone' })}</div>
            </div>

            <div className="flex flex-col items-center pt-1 text-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#cfe3e8] bg-white text-[#2496ab]">
                <span className="block h-1.5 w-1.5 rounded-full bg-current" />
              </div>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#e8edf1] bg-white text-slate-300">
                <Zap size={15} />
              </div>
              <div className="mt-4 text-[15px] font-medium text-[#243040]">{futureNode?.title || t('rebuild.dashboard.default_future_role', { defaultValue: 'Innovation Leader' })}</div>
              <div className="mt-1 text-[12px] text-[#6a7380]">{futureNode?.caption || t('rebuild.dashboard.future_potential', { defaultValue: 'Future potential' })}</div>
            </div>
          </div>
        </div>
      </div>
    </ShellCard>
  );
};

const CandidateMentorChat: React.FC<{
  userProfile: UserProfile;
  vm: ReturnType<typeof buildCandidateDashboardViewModel>;
}> = ({ userProfile, vm }) => {
  const { t } = useTranslation();
  const firstName = userProfile.name?.split(' ')[0] || t('rebuild.dashboard.you', { defaultValue: 'you' });
  const [messages, setMessages] = React.useState<MentorChatMessage[]>(() => [
    {
      role: 'assistant',
      content: t('rebuild.dashboard.mentor_intro', { defaultValue: 'I\'m here. Not as a chatbot for pleasantries, but as a career mirror. Start with a question, or tell me directly where your career is stuck, {{name}}.', name: firstName }),
    },
  ]);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<string[]>([
    t('rebuild.dashboard.mentor_suggestion_1', { defaultValue: 'What does my data tell me about my next step?' }),
    t('rebuild.dashboard.mentor_suggestion_2', { defaultValue: 'What work should I stop chasing just for money?' }),
    t('rebuild.dashboard.mentor_suggestion_3', { defaultValue: 'What should I do in the next 24 hours?' }),
  ]);

  const submitMessage = React.useCallback(async (rawMessage: string) => {
    const message = rawMessage.trim();
    if (!message || busy) return;
    const nextMessages: MentorChatMessage[] = [...messages, { role: 'user', content: message }];
    setMessages(nextMessages);
    setDraft('');
    setError('');
    setBusy(true);
    try {
      const reply = await sendMentorChatMessage(message, nextMessages);
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: [reply.reply, reply.next_step ? `${t('rebuild.dashboard.next_step', { defaultValue: 'Next step' })}: ${reply.next_step}` : ''].filter(Boolean).join('\n\n'),
        },
      ]);
      if (reply.suggested_prompts?.length) setSuggestions(reply.suggested_prompts);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : t('rebuild.dashboard.mentor_error', { defaultValue: 'Cybershaman did not respond right now.' }));
    } finally {
      setBusy(false);
    }
  }, [busy, messages]);

  return (
    <CandidateShellSurface variant="dashboard" className="max-w-full px-2 pb-6 pt-1">
      <ShellCard className="overflow-hidden p-0">
        <div className="grid min-h-[calc(100vh-9rem)] gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="flex min-h-0 flex-col p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-[color:var(--dashboard-soft-border)] pb-5">
              <div>
                <div className={sectionTitleClass}>Cybershaman AI</div>
                <h2 className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.045em] text-[color:var(--dashboard-text-strong)]">{t('rebuild.dashboard.mentor_chat_title', { defaultValue: 'Career conversation without the fluff' })}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--dashboard-text-body)]">
                  {t('rebuild.dashboard.mentor_chat_desc', { defaultValue: 'Answers go through Mistral and follow the manual of shamanic honesty. If data is missing, it should say so out loud.' })}
                </p>
              </div>
              <div className="hidden rounded-2xl border border-[#efe4ce] bg-[#fff9ef] px-4 py-3 text-right sm:block">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9f762d]">{t('rebuild.dashboard.compass', { defaultValue: 'Compass' })}</div>
                <div className="mt-1 text-lg font-black text-[#4a3515]">{vm.resonanceScore}%</div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-5">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[min(42rem,92%)] whitespace-pre-line rounded-[22px] px-5 py-4 text-sm leading-7 shadow-sm',
                    message.role === 'user'
                      ? 'bg-[#103d46] text-white'
                      : 'border border-[color:var(--dashboard-soft-border)] bg-white/80 text-slate-700',
                  )}>
                    {message.content}
                  </div>
                </div>
              ))}
              {busy ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--dashboard-soft-border)] bg-white/80 px-4 py-2 text-sm font-semibold text-slate-500">
                    <Loader2 size={15} className="animate-spin text-[#12afcb]" />
                    {t('rebuild.dashboard.mistral_thinking', { defaultValue: 'Mistral is composing a reply' })}
                  </div>
                </div>
              ) : null}
              {error ? (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              ) : null}
            </div>

            <form
              className="border-t border-[color:var(--dashboard-soft-border)] pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitMessage(draft);
              }}
            >
              <div className="flex gap-3">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={2}
                  placeholder={t('rebuild.dashboard.mentor_placeholder', { defaultValue: 'Write what you want to unravel...' })}
                  className="min-h-[3.5rem] flex-1 resize-none rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#d4ad70] focus:ring-4 focus:ring-[#f7ead5]"
                />
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#b98331] text-white shadow-[0_18px_34px_-24px_rgba(159,118,45,0.88)] transition hover:bg-[#a57124] disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={t('rebuild.actions.send_message', { defaultValue: 'Send message' })}
                >
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </form>
          </section>

          <aside className="border-t border-[color:var(--dashboard-soft-border)] bg-[#fbfaf7]/80 p-5 lg:border-l lg:border-t-0">
            <div className="rounded-[24px] border border-[#efe4ce] bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                <Sparkles size={16} className="text-[#b98331]" />
                {t('rebuild.dashboard.quick_inputs', { defaultValue: 'Quick inputs' })}
              </div>
              <div className="mt-4 space-y-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void submitMessage(suggestion)}
                    disabled={busy}
                    className="w-full rounded-[16px] border border-slate-100 bg-slate-50 px-3 py-3 text-left text-xs font-bold leading-5 text-slate-600 transition hover:border-[#d4ad70] hover:bg-[#fff9ef] disabled:opacity-60"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-[24px] border border-slate-100 bg-white p-5 text-sm leading-6 text-slate-500">
              <div className="font-black text-slate-900">{t('rebuild.dashboard.tone_source', { defaultValue: 'Tone source' })}</div>
              <p className="mt-2">{t('rebuild.dashboard.tone_source_desc', { defaultValue: 'Backend loads `manual.md` and adds security boundaries so that direct speech doesn\'t slip into caricature.' })}</p>
            </div>
          </aside>
        </div>
      </ShellCard>
    </CandidateShellSurface>
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
  onSaveProfile?: () => void;
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
            company: application.company_name || matchedRole?.role.companyName || t('rebuild.dashboard.selected_company', { defaultValue: 'Selected company' }),
            role: application.job_snapshot?.title || matchedRole?.role.title || t('rebuild.dashboard.active_handshake', { defaultValue: 'Active handshake' }),
            score: matchedRole?.score || clamp(vm.resonanceScore - (index * 6), 58, 96),
          };
        });
      }

      return evaluatedRoles.slice(0, 3).map((item, index) => ({
        id: item.role.id,
        company: item.role.companyName || t('rebuild.dashboard.company_n', { defaultValue: 'Company {{n}}', n: index + 1 }),
        role: item.role.title,
        score: item.score || clamp(vm.resonanceScore - (index * 7), 58, 96),
      }));
    }, [candidateApplications, evaluatedRoles, vm.resonanceScore]);
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


    const portalAsset = resolvedMode === 'dark'
      ? 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1200&auto=format&fit=crop'
      : 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1200&auto=format&fit=crop';

    const navItems = [
      { id: 'home', label: t('rebuild.nav.home', { defaultValue: 'Home' }), icon: LayoutDashboard, path: '/candidate/insights' },
      { id: 'profile', label: t('rebuild.nav.profile', { defaultValue: 'Profile' }), icon: CircleUserRound, path: '/candidate/profile' },
      { id: 'jcfpm', label: t('rebuild.nav.self_knowledge', { defaultValue: 'Self-knowledge' }), icon: Brain, path: '/candidate/jcfpm' },
      { id: 'work', label: t('rebuild.nav.work', { defaultValue: 'Work' }), icon: Briefcase, path: '/candidate/marketplace' },
      { id: 'applications', label: t('rebuild.nav.applications', { defaultValue: 'Applications' }), icon: MessageSquare, path: '/candidate/applications' },
      { id: 'learning', label: t('rebuild.nav.learning', { defaultValue: 'Learning' }), icon: GraduationCap, path: '/candidate/learning' },
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
    const firstName = userProfile.isLoggedIn ? userProfile.name?.split(' ')[0] : '';

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
          subtitle={t('rebuild.dashboard.logged_out_subtitle', { defaultValue: 'Sign in and open your personal work compass.' })}
          t={t}
        >
          <CandidateShellSurface variant="dashboard" className="max-w-full px-2 pb-2 pt-1">
            <ShellCard className="overflow-hidden p-0">
              <div className="grid gap-6 p-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
                <div>
                  <div className={sectionTitleClass}>{t('rebuild.dashboard.private_compass', { defaultValue: 'Private work compass' })}</div>
                  <h1 className="mt-4 max-w-2xl text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.055em] text-[#111827]">
                    {t('rebuild.dashboard.auth_required_title', { defaultValue: 'Your data will appear after signing in.' })}
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[#5b6472]">
                    {t('rebuild.dashboard.auth_required_desc', { defaultValue: 'Profile, archetype, JHI, and recommendations are personal. In logged-out mode, we do not share or display them from local cache.' })}
                  </p>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <button type="button" onClick={() => onOpenAuth?.('candidate')} className={primaryButtonClass}>
                      {t('rebuild.nav.sign_in', { defaultValue: 'Sign in' })}
                    </button>
                    <button type="button" onClick={onCompanySwitch || (() => onOpenAuth?.('recruiter'))} className={secondaryButtonClass}>
                      {t('rebuild.dashboard.company_profile', { defaultValue: 'Company profile' })}
                    </button>
                    <button type="button" onClick={() => navigate('/candidate/marketplace')} className={secondaryButtonClass}>
                      {t('rebuild.dashboard.browse_jobs', { defaultValue: 'Browse jobs' })}
                    </button>
                  </div>
                </div>
                <div className="rounded-[26px] border border-[#ece4d8] bg-[linear-gradient(180deg,#fffaf0,#f7fbfb)] p-5">
                  <div className="text-[1.05rem] font-semibold text-[#111827]">{t('rebuild.dashboard.auth_info_title', { defaultValue: 'What loads after signing in' })}</div>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-[#5b6472]">
                    <div className="rounded-[18px] bg-white/76 px-4 py-3">{t('rebuild.dashboard.auth_info_profile', { defaultValue: 'Profile and CV documents' })}</div>
                    <div className="rounded-[18px] bg-white/76 px-4 py-3">{t('rebuild.dashboard.auth_info_jhi', { defaultValue: 'Self-knowledge, JHI, and growth map' })}</div>
                    <div className="rounded-[18px] bg-white/76 px-4 py-3">{t('rebuild.dashboard.auth_info_apps', { defaultValue: 'Applications, handshakes, and saved roles' })}</div>
                  </div>
                </div>
              </div>
            </ShellCard>
          </CandidateShellSurface>
        </DashboardLayoutV2>
      );
    }

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
        title={isProfileView ? t('rebuild.dashboard.my_profile', { defaultValue: 'My profile' }) : firstName ? t('rebuild.dashboard.greeting', { defaultValue: 'Hello, {{name}} 👋', name: firstName }) : t('rebuild.dashboard.default_title', { defaultValue: 'Your work compass' })}
        subtitle={isProfileView ? t('rebuild.dashboard.profile_subtitle', { defaultValue: 'Your skills, experience, and potential in one place.' }) : t('rebuild.dashboard.default_subtitle', { defaultValue: '„Everyone has potential. Our mission is to reveal it.“ — Cybershaman' })}
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
          <CandidateMentorChat userProfile={userProfile} vm={vm} />
        ) : (
          <CandidateShellSurface variant="dashboard" className="max-w-full px-2 pb-6 pt-1">
            <div className="flex flex-col gap-5 xl:gap-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,2.1fr)_minmax(360px,0.9fr)]">
                <ArchetypeHeroCard
                  vm={vm}
                  onOpenDetail={() => navigate('/candidate/jcfpm')}
                />

                <GrowthAnalysisCard
                  vm={vm}
                  onOpenDetail={() => navigate('/candidate/jcfpm')}
                />
              </div>

              <div className="grid gap-5 xl:grid-cols-3">
                <ChallengeCard
                  role={featuredRole}
                  tags={featuredRoleTags}
                  portalAsset={portalAsset}
                  onOpenRole={() => navigate(getRolePath(featuredRole))}
                  onOpenAll={() => navigate('/candidate/marketplace')}
                />
                <HandshakeCard
                  rows={handshakeRows}
                  onOpenHandshake={openHandshakeOrRole}
                  onOpenAll={() => navigate('/candidate/applications')}
                />
                <GrowthMapCard vm={vm} onOpenMap={() => navigate('/candidate/jcfpm')} />
              </div>
            </div>
          </CandidateShellSurface>
        )}
      </DashboardLayoutV2>
    );
  };
