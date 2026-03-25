import React from 'react';
import { cn } from './primitives';

interface AppShellAtmosphereProps {
  className?: string;
}

const AppShellAtmosphere: React.FC<AppShellAtmosphereProps> = ({ className }) => (
  <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden="true">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.08),transparent_28%),radial-gradient(circle_at_82%_78%,rgba(59,130,246,0.08),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#f7fafc_52%,#f5f8fb_100%)] dark:bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.1),transparent_26%),radial-gradient(circle_at_82%_78%,rgba(59,130,246,0.08),transparent_28%),linear-gradient(180deg,#020617_0%,#020817_52%,#030712_100%)]" />

    <div className="absolute left-[14%] top-[8%] h-[520px] w-[520px] rounded-full bg-emerald-400/8 blur-[140px] dark:bg-emerald-300/8" />
    <div className="absolute bottom-[4%] right-[8%] h-[620px] w-[620px] rounded-full bg-cyan-400/10 blur-[165px] dark:bg-cyan-300/10" />
    <div className="absolute right-[24%] top-[34%] h-[420px] w-[420px] rounded-full bg-orange-300/10 blur-[120px] dark:bg-orange-300/8" />

    <div className="absolute inset-0 opacity-[0.55] dark:opacity-[0.42]">
      <svg className="h-full w-full" viewBox="0 0 1440 1024" preserveAspectRatio="xMidYMid slice" fill="none">
        <g strokeLinecap="round" strokeLinejoin="round">
          <path d="M82 180C210 210 252 296 346 318C446 342 504 232 622 236C758 240 800 392 936 404C1046 414 1128 326 1246 338C1318 346 1376 398 1416 452" stroke="#22d3ee" strokeWidth="1.55" strokeDasharray="3 12" opacity="0.75" />
          <path d="M34 742C130 704 222 612 318 624C430 638 476 804 596 810C716 816 776 650 900 642C1034 632 1100 760 1236 756C1320 754 1382 720 1420 684" stroke="#38bdf8" strokeWidth="1.45" strokeDasharray="4 14" opacity="0.72" />
          <path d="M224 78C286 128 292 222 358 270C442 330 578 314 656 378C736 444 748 594 838 648C948 714 1126 672 1214 752" stroke="#f59e0b" strokeWidth="1.2" strokeDasharray="2 10" opacity="0.42" />
          <path d="M1048 72C976 154 1012 292 936 370C860 448 716 438 640 516C568 590 572 738 492 806C422 866 302 888 234 950" stroke="#06b6d4" strokeWidth="1.25" strokeDasharray="3 11" opacity="0.62" />
          <path d="M128 496C240 458 308 364 420 374C544 386 602 560 736 572C868 584 942 448 1086 458C1210 466 1324 560 1416 612" stroke="#0f766e" strokeWidth="1.1" strokeDasharray="5 15" opacity="0.34" />
          <path d="M116 876C194 804 226 712 316 694C424 672 540 776 646 748C762 718 798 556 918 526C1040 494 1174 596 1288 574" stroke="#3b82f6" strokeWidth="1.1" strokeDasharray="4 13" opacity="0.36" />

          <path d="M356 318H508L566 236H684" stroke="#94a3b8" strokeWidth="0.95" opacity="0.26" />
          <path d="M900 642H1016L1084 756H1216" stroke="#94a3b8" strokeWidth="0.95" opacity="0.24" />
          <path d="M838 648V564L936 404H1082" stroke="#94a3b8" strokeWidth="0.95" opacity="0.22" />
          <path d="M318 624V548L358 270H468" stroke="#94a3b8" strokeWidth="0.95" opacity="0.22" />
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
          ].map(([cx, cy], index) => (
            <g key={`${cx}-${cy}-${index}`}>
              <circle cx={cx} cy={cy} r="15" fill="white" opacity="0.58" />
              <circle cx={cx} cy={cy} r="6" fill={index % 3 === 0 ? '#22d3ee' : index % 3 === 1 ? '#3b82f6' : '#f59e0b'} opacity="0.62" />
              <circle cx={cx} cy={cy} r="2.5" fill="white" opacity="0.9" />
            </g>
          ))}
        </g>
      </svg>
    </div>

    <div className="absolute inset-0 flex items-center justify-center opacity-20 dark:opacity-[0.16]">
      <svg className="h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" fill="none">
        <g transform="translate(500, 500)">
          <circle cx="0" cy="0" r="150" stroke="#22d3ee" strokeWidth="0.5" strokeDasharray="4 12" />
          <circle cx="0" cy="0" r="280" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="8 24" />
          <circle cx="0" cy="0" r="450" stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="12 36" />
        </g>
      </svg>
    </div>
  </div>
);

export default AppShellAtmosphere;
