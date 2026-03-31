import React from 'react';

import { cn } from '../ui/primitives';

export const galaxyShellPanelClass =
  'border border-slate-200/70 bg-white/78 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/62 dark:shadow-[0_22px_58px_-36px_rgba(2,6,23,0.7)]';

export const GalaxyNeuralCircuitTexture: React.FC<{
  accent?: 'emerald' | 'blue';
  className?: string;
  masked?: boolean;
}> = ({ accent = 'emerald', className, masked = false }) => {
  const accentStroke = accent === 'blue' ? '#60a5fa' : '#10b981';

  return (
    <div
      className={cn('pointer-events-none absolute -inset-[12%] overflow-hidden', className)}
      style={masked ? {
        maskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 52%, rgba(0,0,0,0.42) 82%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(circle at center, rgba(0,0,0,1) 0%, rgba(0,0,0,0.94) 52%, rgba(0,0,0,0.42) 82%, transparent 100%)',
      } : undefined}
    >
      <svg className="h-full w-full opacity-[0.3]" viewBox="0 0 1440 1024" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <filter id={`careeros-neural-glow-${accent}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g fill="none" strokeLinecap="round" strokeLinejoin="round" filter={`url(#careeros-neural-glow-${accent})`}>
          <path d="M82 180C210 210 252 296 346 318C446 342 504 232 622 236C758 240 800 392 936 404C1046 414 1128 326 1246 338C1318 346 1376 398 1416 452" stroke={accentStroke} strokeWidth="1.55" strokeDasharray="3 12" />
          <path d="M34 742C130 704 222 612 318 624C430 638 476 804 596 810C716 816 776 650 900 642C1034 632 1100 760 1236 756C1320 754 1382 720 1420 684" stroke="#3b82f6" strokeWidth="1.45" strokeDasharray="4 14" />
          <path d="M224 78C286 128 292 222 358 270C442 330 578 314 656 378C736 444 748 594 838 648C948 714 1126 672 1214 752" stroke="#f59e0b" strokeWidth="1.25" strokeDasharray="2 10" opacity="0.74" />
          <path d="M1048 72C976 154 1012 292 936 370C860 448 716 438 640 516C568 590 572 738 492 806C422 866 302 888 234 950" stroke={accentStroke} strokeWidth="1.25" strokeDasharray="3 11" opacity="0.7" />
          <path d="M128 496C240 458 308 364 420 374C544 386 602 560 736 572C868 584 942 448 1086 458C1210 466 1324 560 1416 612" stroke="#0f766e" strokeWidth="1.1" strokeDasharray="5 15" opacity="0.52" />
          <path d="M116 876C194 804 226 712 316 694C424 672 540 776 646 748C762 718 798 556 918 526C1040 494 1174 596 1288 574" stroke="#38bdf8" strokeWidth="1.1" strokeDasharray="4 13" opacity="0.48" />

          <path d="M356 318H508L566 236H684" stroke="#94a3b8" strokeWidth="0.95" opacity="0.5" />
          <path d="M900 642H1016L1084 756H1216" stroke="#94a3b8" strokeWidth="0.95" opacity="0.5" />
          <path d="M838 648V564L936 404H1082" stroke="#94a3b8" strokeWidth="0.95" opacity="0.46" />
          <path d="M318 624V548L358 270H468" stroke="#94a3b8" strokeWidth="0.95" opacity="0.46" />
          <path d="M646 748V664L736 572H882" stroke="#94a3b8" strokeWidth="0.9" opacity="0.38" />
          <path d="M420 374V290L508 318H632" stroke="#94a3b8" strokeWidth="0.9" opacity="0.38" />
        </g>

        <g>
          {[
            [356, 318],
            [566, 236],
            [936, 404],
            [318, 624],
            [838, 648],
            [1216, 756],
            [234, 950],
            [1048, 72],
            [508, 318],
            [1016, 642],
            [736, 572],
            [646, 748],
            [420, 374],
            [1288, 574],
          ].map(([cx, cy], index) => (
            <g key={`${cx}-${cy}-${index}`}>
              <circle cx={cx} cy={cy} r="17" fill="white" opacity="0.72" />
              <circle cx={cx} cy={cy} r="7" fill={index % 3 === 0 ? accentStroke : index % 3 === 1 ? '#3b82f6' : '#f59e0b'} opacity="0.68" />
              <circle cx={cx} cy={cy} r="2.5" fill="white" opacity="0.95" />
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};

export const GalaxyStageBackground: React.FC<{ accent?: 'emerald' | 'blue' }> = ({ accent = 'emerald' }) => (
  <>
    <style>
      {`
        @keyframes careeros-dash-flow {
          from { stroke-dashoffset: 96; }
          to { stroke-dashoffset: 0; }
        }

        @keyframes careeros-node-float {
          0% {
            transform: translate3d(calc(var(--careeros-float-x, 0px) * -0.3), calc(var(--careeros-float-y, 0px) * -0.22), 0);
          }
          50% {
            transform: translate3d(var(--careeros-float-x, 0px), var(--careeros-float-y, 0px), 0);
          }
          100% {
            transform: translate3d(calc(var(--careeros-float-x, 0px) * -0.48), calc(var(--careeros-float-y, 0px) * -0.38), 0);
          }
        }

        @keyframes careeros-soft-breathe {
          0%, 100% {
            opacity: 0.42;
            transform: scale3d(0.985, 0.985, 1);
          }
          50% {
            opacity: 0.52;
            transform: scale3d(1.015, 1.015, 1);
          }
        }

        @keyframes careeros-ring-breathe {
          0%, 100% {
            opacity: 0.84;
            transform: scale3d(0.992, 0.992, 1);
          }
          50% {
            opacity: 0.96;
            transform: scale3d(1.012, 1.012, 1);
          }
        }

        @keyframes careeros-route-pulse {
          0%, 100% {
            opacity: 0.72;
            transform: scale3d(0.96, 0.96, 1);
          }
          50% {
            opacity: 1;
            transform: scale3d(1.04, 1.04, 1);
          }
        }
      `}
    </style>
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(16,185,129,0.08),transparent_28%),radial-gradient(circle_at_82%_78%,rgba(59,130,246,0.08),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#f7fafc_52%,#f5f8fb_100%)] dark:bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.08),transparent_26%),radial-gradient(circle_at_82%_78%,rgba(59,130,246,0.08),transparent_28%),linear-gradient(180deg,#020617_0%,#020817_52%,#030712_100%)]" />
    <GalaxyNeuralCircuitTexture accent={accent} masked className="opacity-[0.74]" />
    <div className="pointer-events-none absolute left-[14%] top-[8%] h-[520px] w-[520px] rounded-full bg-emerald-400/8 blur-[140px]" />
    <div className="pointer-events-none absolute bottom-[4%] right-[8%] h-[620px] w-[620px] rounded-full bg-blue-400/8 blur-[165px]" />
    <div className="pointer-events-none absolute right-[24%] top-[34%] h-[420px] w-[420px] rounded-full bg-orange-400/8 blur-[120px]" />

    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-20">
      <svg className="h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id={`careeros-soft-glow-${accent}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform="translate(500, 500)" filter={`url(#careeros-soft-glow-${accent})`}>
          <circle
            cx="0"
            cy="0"
            r="150"
            fill="none"
            stroke={accent === 'blue' ? '#60a5fa' : '#10b981'}
            strokeWidth="0.5"
            strokeDasharray="4 12"
            className="animate-[spin_60s_linear_infinite]"
          />
          <circle
            cx="0"
            cy="0"
            r="280"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="0.5"
            strokeDasharray="8 24"
            className="animate-[spin_90s_linear_infinite_reverse]"
          />
          <circle
            cx="0"
            cy="0"
            r="450"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="0.5"
            strokeDasharray="12 36"
            className="animate-[spin_120s_linear_infinite]"
          />
        </g>
      </svg>
    </div>
  </>
);

export type GalaxyClusterNodeTone = 'emerald' | 'orange' | 'blue' | 'slate';

const clusterToneClasses: Record<GalaxyClusterNodeTone, {
  ring: string;
  glow: string;
  eyebrow: string;
  badge: string;
  active: string;
}> = {
  emerald: {
    ring: 'border-emerald-400/55 shadow-[0_0_28px_rgba(16,185,129,0.24)]',
    glow: 'from-emerald-400/30 via-emerald-300/10 to-transparent',
    eyebrow: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-600 text-white dark:bg-emerald-300 dark:text-emerald-950',
    active: 'border-emerald-300 dark:border-emerald-500/50',
  },
  orange: {
    ring: 'border-orange-400/55 shadow-[0_0_28px_rgba(245,158,11,0.22)]',
    glow: 'from-orange-400/30 via-orange-300/10 to-transparent',
    eyebrow: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-500 text-white dark:bg-orange-300 dark:text-orange-950',
    active: 'border-orange-300 dark:border-orange-500/50',
  },
  blue: {
    ring: 'border-cyan-300/60 shadow-[0_0_28px_rgba(8,145,178,0.2)]',
    glow: 'from-cyan-400/30 via-sky-300/10 to-transparent',
    eyebrow: 'text-cyan-700 dark:text-cyan-300',
    badge: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
    active: 'border-cyan-200 dark:border-cyan-500/50',
  },
  slate: {
    ring: 'border-slate-200/85 shadow-[0_10px_28px_rgba(15,23,42,0.12)] dark:border-slate-700/80',
    glow: 'from-slate-300/25 via-slate-200/8 to-transparent dark:from-slate-600/18 dark:via-slate-500/6',
    eyebrow: 'text-cyan-700 dark:text-cyan-300',
    badge: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
    active: 'border-cyan-200 dark:border-cyan-500/50',
  },
};

export interface GalaxyClusterNodeProps {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  description?: string;
  count?: number;
  media: React.ReactNode;
  active?: boolean;
  elevated?: boolean;
  tone?: GalaxyClusterNodeTone;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  dataMapControl?: boolean;
  className?: string;
  titleStyle?: React.CSSProperties;
}

export const GalaxyClusterNode: React.FC<GalaxyClusterNodeProps> = ({
  title,
  eyebrow,
  subtitle,
  description,
  count,
  media,
  active = false,
  elevated = false,
  tone = 'blue',
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  disabled = false,
  dataMapControl = false,
  className,
  titleStyle,
}) => {
  const toneClasses = clusterToneClasses[tone];
  const emphasized = active || elevated;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      disabled={disabled}
      data-map-control={dataMapControl ? 'true' : undefined}
      className={cn(
        'group relative flex w-[214px] flex-col items-center gap-3 rounded-[28px] border border-transparent bg-transparent px-2 py-2 text-center transition-transform duration-200 ease-out hover:scale-[1.03] focus:outline-none disabled:cursor-default disabled:hover:scale-100',
        active ? 'scale-105' : '',
        className,
      )}
    >
      <div
        className={cn(
          'relative flex items-center justify-center rounded-full border bg-white/94 transition-transform duration-200 ease-out group-hover:scale-[1.05] dark:bg-slate-950/90',
          emphasized ? 'h-[94px] w-[94px]' : 'h-[84px] w-[84px]',
          toneClasses.ring,
        )}
      >
        <div className={cn('absolute inset-2 rounded-full bg-gradient-to-br blur-md', toneClasses.glow)} />
        <div
          className={cn(
            'relative z-10 flex items-center justify-center overflow-hidden rounded-full border border-white bg-white/96 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/92',
            emphasized ? 'h-[66px] w-[66px]' : 'h-[58px] w-[58px]',
          )}
        >
          {media}
        </div>
      </div>

      <div
        className={cn(
          'relative w-full rounded-[22px] border bg-white/90 px-4 py-3.5 text-center shadow-sm transition-[transform,colors,box-shadow] duration-200 ease-out dark:bg-slate-950/84',
          active
            ? `${toneClasses.active} shadow-[0_18px_42px_-30px_rgba(8,145,178,0.34)]`
            : 'border-slate-200/80 dark:border-slate-800',
        )}
        style={{
          transform: `translate3d(0, 0, 0) scale(${emphasized ? 1.015 : 1})`,
          willChange: 'transform',
        }}
      >
        {typeof count === 'number' ? (
          <div className="absolute right-3 top-3">
            <span
              className={cn(
                'inline-flex min-w-[2rem] items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-bold shadow-sm',
                toneClasses.badge,
              )}
            >
              {count}
            </span>
          </div>
        ) : null}

        {eyebrow ? (
          <div className={cn('pr-10 text-[10px] font-semibold uppercase tracking-[0.16em]', toneClasses.eyebrow)}>
            {eyebrow}
          </div>
        ) : null}

        <div
          className={cn(
            'text-[13px] font-bold leading-tight text-slate-800 dark:text-slate-100',
            eyebrow ? 'mt-1 min-h-[2.45rem]' : 'min-h-[2.45rem]',
          )}
          style={titleStyle}
          title={title}
        >
          {title}
        </div>

        {subtitle ? (
          <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {subtitle}
          </div>
        ) : null}

        {description ? (
          <div className="mt-2 text-[10px] leading-4 text-slate-600 dark:text-slate-300">
            {description}
          </div>
        ) : null}
      </div>
    </button>
  );
};
