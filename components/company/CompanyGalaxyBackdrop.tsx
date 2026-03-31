import React from 'react';

import { cn } from '../ui/primitives';

interface CompanyGalaxyBackdropProps {
  className?: string;
  variant?: 'landing' | 'workspace';
}

const companyGalaxyPoints = [
  { id: 'north-west', x: 12, y: 24, size: 14, tone: 'cyan' },
  { id: 'west-inner', x: 24, y: 38, size: 10, tone: 'white' },
  { id: 'north-inner', x: 38, y: 20, size: 12, tone: 'cyan' },
  { id: 'core', x: 48, y: 56, size: 18, tone: 'core' },
  { id: 'north-east', x: 64, y: 26, size: 12, tone: 'cyan' },
  { id: 'east', x: 82, y: 40, size: 11, tone: 'gold' },
  { id: 'south-east', x: 74, y: 78, size: 13, tone: 'violet' },
  { id: 'south-west', x: 20, y: 80, size: 12, tone: 'cyan' },
  { id: 'far-east', x: 92, y: 64, size: 16, tone: 'white' },
];

const companyGalaxyLinks = [
  { id: 'l1', x1: 12, y1: 24, x2: 24, y2: 38 },
  { id: 'l2', x1: 24, y1: 38, x2: 48, y2: 56 },
  { id: 'l3', x1: 38, y1: 20, x2: 48, y2: 56 },
  { id: 'l4', x1: 48, y1: 56, x2: 64, y2: 26 },
  { id: 'l5', x1: 48, y1: 56, x2: 82, y2: 40 },
  { id: 'l6', x1: 48, y1: 56, x2: 74, y2: 78 },
  { id: 'l7', x1: 48, y1: 56, x2: 20, y2: 80 },
  { id: 'l8', x1: 74, y1: 78, x2: 92, y2: 64 },
];

const pointToneClass: Record<string, string> = {
  cyan: 'bg-cyan-200/75 shadow-[0_0_28px_rgba(103,232,249,0.75)]',
  white: 'bg-white/90 shadow-[0_0_24px_rgba(255,255,255,0.82)]',
  gold: 'bg-amber-200/80 shadow-[0_0_26px_rgba(253,230,138,0.7)]',
  violet: 'bg-violet-200/75 shadow-[0_0_26px_rgba(196,181,253,0.68)]',
  core: 'bg-cyan-100/95 shadow-[0_0_36px_rgba(125,211,252,0.9)]',
};

const CompanyGalaxyBackdrop: React.FC<CompanyGalaxyBackdropProps> = ({
  className,
  variant = 'workspace',
}) => {
  const isLanding = variant === 'landing';

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
      <div
        className={cn(
          'absolute inset-0',
          isLanding
            ? 'bg-[linear-gradient(180deg,rgba(250,252,255,0.98)_0%,rgba(242,247,251,0.97)_48%,rgba(236,243,249,0.99)_100%)]'
            : 'bg-[linear-gradient(180deg,rgba(248,251,255,0.96)_0%,rgba(241,246,252,0.97)_50%,rgba(235,242,248,0.99)_100%)]'
        )}
      />

      <div
        className={cn(
          'absolute inset-[-18%] opacity-100',
          isLanding
            ? 'bg-[radial-gradient(circle_at_18%_18%,rgba(186,230,253,0.38),transparent_21%),radial-gradient(circle_at_78%_14%,rgba(255,255,255,0.82),transparent_26%),radial-gradient(circle_at_82%_68%,rgba(191,219,254,0.26),transparent_20%),radial-gradient(circle_at_22%_78%,rgba(186,230,253,0.24),transparent_24%),radial-gradient(circle_at_52%_56%,rgba(236,254,255,0.9),transparent_32%)]'
            : 'bg-[radial-gradient(circle_at_16%_16%,rgba(186,230,253,0.2),transparent_20%),radial-gradient(circle_at_74%_16%,rgba(255,255,255,0.64),transparent_24%),radial-gradient(circle_at_78%_76%,rgba(191,219,254,0.2),transparent_18%),radial-gradient(circle_at_48%_52%,rgba(236,254,255,0.74),transparent_26%)]'
        )}
      />

      <div className="company-galaxy-mist company-galaxy-mist-a absolute -left-[8%] top-[4%] h-[34rem] w-[42rem] rounded-full bg-cyan-100/40 blur-[96px]" />
      <div className="company-galaxy-mist company-galaxy-mist-b absolute right-[-8%] top-[8%] h-[30rem] w-[38rem] rounded-full bg-white/90 blur-[108px]" />
      <div className="company-galaxy-mist company-galaxy-mist-c absolute bottom-[-16%] left-[18%] h-[24rem] w-[48rem] rounded-full bg-sky-100/35 blur-[100px]" />

      <div className="absolute left-1/2 top-[56%] h-[30rem] w-[52rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(226,248,255,0.96),rgba(194,236,246,0.34)_34%,rgba(255,255,255,0.08)_64%,transparent_76%)] blur-[8px]" />
      <div className="company-galaxy-core-pulse absolute left-1/2 top-[56%] h-[28rem] w-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/55 opacity-70" />
      <div className="company-galaxy-core-pulse company-galaxy-core-pulse-delayed absolute left-1/2 top-[56%] h-[22rem] w-[37rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/70 opacity-80" />
      <div className="company-galaxy-core-pulse company-galaxy-core-pulse-slow absolute left-1/2 top-[56%] h-[16rem] w-[27rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 opacity-90" />

      <div className="company-galaxy-ring company-galaxy-ring-a absolute left-1/2 top-[56%] h-[44rem] w-[70rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/28" />
      <div className="company-galaxy-ring company-galaxy-ring-b absolute left-1/2 top-[56%] h-[36rem] w-[58rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/30" />
      <div className="company-galaxy-ring company-galaxy-ring-c absolute left-1/2 top-[56%] h-[28rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/34" />

      <svg
        className="absolute inset-0 h-full w-full opacity-[0.3]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="company-galaxy-link" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(148,163,184,0.05)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="100%" stopColor="rgba(34,211,238,0.16)" />
          </linearGradient>
        </defs>
        {companyGalaxyLinks.map((link) => (
          <line
            key={link.id}
            x1={link.x1}
            y1={link.y1}
            x2={link.x2}
            y2={link.y2}
            stroke="url(#company-galaxy-link)"
            strokeWidth="0.16"
          />
        ))}
      </svg>

      {companyGalaxyPoints.map((point, index) => (
        <div
          key={point.id}
          className="company-galaxy-star absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${point.x}%`,
            top: `${point.y}%`,
            animationDelay: `${index * 0.9}s`,
          }}
        >
          <span
            className={cn(
              'block rounded-full',
              pointToneClass[point.tone],
            )}
            style={{
              width: `${point.size}px`,
              height: `${point.size}px`,
            }}
          />
        </div>
      ))}

      <div className="company-galaxy-dust absolute left-[9%] top-[14%] h-[3px] w-[3px] rounded-full bg-white/85 shadow-[0_0_22px_rgba(255,255,255,0.9)]" />
      <div className="company-galaxy-dust absolute left-[29%] top-[29%] h-[4px] w-[4px] rounded-full bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.88)]" />
      <div className="company-galaxy-dust absolute right-[18%] top-[18%] h-[4px] w-[4px] rounded-full bg-cyan-100/90 shadow-[0_0_24px_rgba(165,243,252,0.88)]" />
      <div className="company-galaxy-dust absolute right-[13%] top-[44%] h-[3px] w-[3px] rounded-full bg-white/80 shadow-[0_0_20px_rgba(255,255,255,0.8)]" />
      <div className="company-galaxy-dust absolute left-[18%] bottom-[20%] h-[5px] w-[5px] rounded-full bg-white/90 shadow-[0_0_28px_rgba(255,255,255,0.92)]" />
      <div className="company-galaxy-dust absolute right-[24%] bottom-[18%] h-[4px] w-[4px] rounded-full bg-cyan-100/90 shadow-[0_0_24px_rgba(165,243,252,0.84)]" />
    </div>
  );
};

export default CompanyGalaxyBackdrop;
