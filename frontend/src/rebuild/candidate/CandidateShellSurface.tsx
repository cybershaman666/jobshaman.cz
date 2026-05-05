import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../cn';
import {
  pillEyebrowClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../ui/shellStyles';

export type CandidateShellVariant = 'dashboard' | 'profile' | 'role' | 'journey';

const SURFACE_TONES: Record<CandidateShellVariant, string> = {
  dashboard: 'from-amber-50/50 dark:from-slate-900/50 via-white dark:via-slate-950 to-cyan-50/30 dark:to-slate-900/30',
  profile: 'from-amber-50/40 dark:from-slate-900/40 via-white dark:via-slate-950 to-emerald-50/30 dark:to-slate-900/30',
  role: 'from-slate-50 dark:from-slate-900 via-white dark:via-slate-950 to-slate-50 dark:to-slate-900',
  journey: 'from-emerald-50/40 dark:from-slate-900/40 via-white dark:via-slate-950 to-amber-50/30 dark:to-slate-900/30',
};

const CALL_OUT_POSITIONS = [
  'left-[4%] top-[12%]',
  'right-[4%] top-[11%]',
  'left-[3%] top-[49%]',
  'right-[3%] top-[51%]',
] as const;

export const CandidateShellSurface: React.FC<{
  variant?: CandidateShellVariant;
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({
  variant = 'dashboard',
  eyebrow,
  title,
  subtitle,
  actions,
  children,
  className,
}) => (
  <section className={cn('relative overflow-hidden', className)}>
    {variant !== 'role' ? (
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] overflow-hidden">
        <div className={cn('absolute inset-x-0 top-0 h-full bg-gradient-to-b', SURFACE_TONES[variant])} />
        {variant === 'dashboard' ? (
          <>
            <div className="absolute left-[10%] top-8 h-32 w-32 rounded-full bg-[#f1d29a]/20 blur-[86px]" />
            <div className="absolute right-[13%] top-10 h-36 w-36 rounded-full bg-[#9edbe3]/16 blur-[98px]" />
            <div className="absolute inset-x-[8%] top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(229,215,194,0.52),transparent)]" />
          </>
        ) : (
          <>
            <div className="absolute left-[8%] top-8 h-28 w-28 rounded-full bg-[#f2cb87]/20 blur-[80px]" />
            <div className="absolute right-[12%] top-10 h-32 w-32 rounded-full bg-[#72d6e3]/14 blur-[92px]" />
            <svg
              className="absolute right-[18%] top-6 h-24 w-24 text-[#d7c2a6]/80"
              viewBox="0 0 120 120"
              fill="none"
              aria-hidden
            >
              <circle cx="94" cy="20" r="14" stroke="currentColor" strokeWidth="1.4" strokeDasharray="4 7" />
              <path d="M92 32L72 62L36 92" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="72" cy="62" r="3" fill="#d58a22" />
              <circle cx="36" cy="92" r="3" fill="#d0b088" />
            </svg>
          </>
        )}
      </div>
    ) : null}

    {(eyebrow || title || subtitle || actions) ? (
      <div className="relative mb-8 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? <div>{eyebrow}</div> : null}
            {title ? <div className="mt-3 text-[1.85rem] font-semibold tracking-[-0.05em] text-[color:var(--dashboard-text-strong)]">{title}</div> : null}
            {subtitle ? <div className="mt-2 max-w-3xl text-sm leading-7 text-[color:var(--dashboard-text-body)]">{subtitle}</div> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    ) : null}

    <div className="relative z-10">{children}</div>
  </section>
);

export const SectionEyebrow: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div className={cn(pillEyebrowClass, className)}>{children}</div>
);

export const ShellCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  tone?: 'default' | 'soft' | 'accent' | 'contrast';
}> = ({ children, className, tone = 'default' }) => (
  <section
    className={cn(
      tone === 'default' && 'rounded-[24px] border border-[color:color-mix(in_srgb,var(--dashboard-card-border)_42%,transparent)] bg-[color:color-mix(in_srgb,var(--dashboard-card-bg)_94%,transparent)] shadow-[0_18px_44px_-40px_rgba(72,55,24,0.1)]',
      tone === 'soft' && 'rounded-[24px] border border-[color:color-mix(in_srgb,var(--dashboard-soft-border)_44%,transparent)] bg-[color:color-mix(in_srgb,var(--dashboard-soft-bg)_94%,transparent)] shadow-[0_14px_30px_-30px_rgba(72,55,24,0.08)]',
      tone === 'accent' && 'rounded-[24px] border border-[color:color-mix(in_srgb,#ead8bc_48%,transparent)] bg-[color:color-mix(in_srgb,var(--dashboard-card-bg)_94%,transparent)] shadow-[0_18px_44px_-36px_rgba(185,131,46,0.1)]',
      tone === 'contrast' && 'rounded-[24px] border border-white/10 bg-[#12161f] shadow-[0_26px_70px_-52px_rgba(0,0,0,0.8)] text-white',
      'self-start',
      className,
    )}
  >
    {children}
  </section>
);

export const CompactActionButton: React.FC<{
  children: React.ReactNode;
  tone?: 'primary' | 'secondary';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}> = ({ children, tone = 'secondary', className, ...props }) => (
  <button
    {...props}
    className={cn(
      tone === 'primary'
        ? primaryButtonClass
        : secondaryButtonClass,
      'rounded-[14px] px-4 py-2.5 text-sm',
      className,
    )}
  >
    {children}
  </button>
);

export const MetricPill: React.FC<{
  label: string;
  value: string;
  icon?: React.ReactNode;
  className?: string;
}> = ({ label, value, icon, className }) => (
  <div className={cn('rounded-[22px] border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-soft-bg)] px-4 py-3', className)}>
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--dashboard-text-muted)]">
      {icon}
      <span>{label}</span>
    </div>
    <div className="mt-2 text-[1.05rem] font-semibold text-[color:var(--dashboard-text-strong)]">{value}</div>
  </div>
);

export const SignalBar: React.FC<{
  label: string;
  primaryValue: number;
  secondaryValue?: number;
  primaryColor?: string;
  secondaryColor?: string;
  trailing?: React.ReactNode;
  variant?: 'default' | 'sleek';
}> = ({
  label,
  primaryValue,
  secondaryValue,
  primaryColor = '#2496ab',
  secondaryColor = '#d8754a',
  trailing,
}) => {
  const { t } = useTranslation();
  return (
  <div className="group">
    <div className="flex items-center justify-between gap-3">
      <div className="text-[11px] font-bold text-[color:var(--dashboard-text-strong)] truncate">{label}</div>
      {trailing ? <div className="text-right shrink-0">{trailing}</div> : null}
    </div>
    <div className="mt-1.5 space-y-1.5">
      <div className="relative">
        <div className="h-[4px] rounded-full bg-[color:var(--dashboard-track)]">
          <div 
            className="relative h-[4px] rounded-full transition-all duration-1000" 
            style={{ width: `${Math.max(0, Math.min(primaryValue, 100))}%`, backgroundColor: primaryColor }}
          >
            <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-inherit shadow-sm" />
          </div>
        </div>
      </div>
      {secondaryValue != null ? (
        <div className="relative">
          <div className="h-[4px] rounded-full bg-[color:var(--dashboard-track)]">
            <div 
              className="relative h-[4px] rounded-full transition-all duration-1000" 
              style={{ width: `${Math.max(0, Math.min(secondaryValue, 100))}%`, backgroundColor: secondaryColor }}
            >
              <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-inherit shadow-sm" />
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between text-[8px] font-medium leading-none text-[color:var(--dashboard-text-muted)] opacity-80">
            <span>{t('rebuild.surface.self_assessment', { defaultValue: 'Self-assessment' })}</span>
            <span>{t('rebuild.surface.reality', { defaultValue: 'Reality' })}</span>
          </div>
        </div>
      ) : null}
    </div>
  </div>
  );
};

export const ProgressNodeRow: React.FC<{
  items: Array<{
    id: string;
    title: string;
    caption: string;
    icon: React.ReactNode;
    active?: boolean;
  }>;
  className?: string;
}> = ({ items, className }) => (
  <div className={cn('flex items-center gap-2', className)}>
    {items.map((item, index) => (
      <React.Fragment key={item.id}>
        <div className="flex min-w-0 flex-[0_1_10rem] flex-col items-center text-center">
          <div
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full border bg-white dark:bg-slate-800 shadow-[0_16px_34px_-28px_rgba(37,23,8,0.24)]',
              item.active
                ? 'border-[#d58a22] text-[#a86719] dark:border-amber-500 dark:text-amber-400'
                : 'border-[color:var(--dashboard-soft-border)] text-[color:var(--dashboard-teal)]',
            )}
          >
            {item.icon}
          </div>
          <div className="mt-4 text-[0.95rem] font-semibold leading-5 text-[color:var(--dashboard-text-strong)]">{item.title}</div>
          <div className={cn('mt-1 text-xs', item.active ? 'text-[#a86719]' : 'text-[color:var(--dashboard-text-muted)]')}>{item.caption}</div>
        </div>
        {index < items.length - 1 ? (
          <div className="relative h-px flex-1 overflow-hidden rounded-full bg-[color:var(--dashboard-soft-border)]">
            <div className="absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(90deg,#72d6e3,#d58a22)] opacity-55" />
          </div>
        ) : null}
      </React.Fragment>
    ))}
  </div>
);

export const ArchetypeHeroScene: React.FC<{
  title: string;
  subtitle?: string;
  metrics: Array<{ label: string; value: number; tone: 'gold' | 'teal' | 'muted' }>;
  className?: string;
}> = ({ title: _title, subtitle: _subtitle, metrics, className }) => {
  return (
    <div className={cn('relative min-h-[16rem] overflow-hidden rounded-[24px]', className)}>
      <div className="absolute inset-0 flex items-center justify-center">
        <img 
          src="/logo-transparent.png" 
          alt="Shaman" 
          className="dark:hidden h-[120%] w-auto max-w-none object-cover opacity-90 mix-blend-screen"
        />
        <img 
          src="/logodark.png" 
          alt="Shaman" 
          className="hidden dark:block h-[120%] w-auto max-w-none object-cover opacity-90 mix-blend-screen"
        />
      </div>

      {metrics.slice(0, 4).map((metric, index) => (
        <div
          key={`${metric.label}-${index}`}
          className={cn(
            'absolute hidden max-w-[7.5rem] rounded-[14px] bg-white border border-slate-200 px-2 py-1.5 dark:bg-slate-800 dark:border-white/10 lg:block',
            CALL_OUT_POSITIONS[index],
          )}
        >
          <div className="line-clamp-2 text-[10px] font-semibold leading-[13px] text-[color:var(--dashboard-text-strong)]">{metric.label}</div>
          <div
            className={cn(
              'mt-0.5 text-[1.05rem] font-semibold',
              metric.tone === 'gold'
                ? 'text-[#d58a22]'
                : metric.tone === 'teal'
                  ? 'text-[#2496ab]'
                  : 'text-[color:var(--dashboard-text-muted)]',
            )}
          >
            {metric.value.toFixed(1)}
          </div>
        </div>
      ))}
    </div>
  );
};
