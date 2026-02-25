import React from 'react';

interface Props {
  progress: number;
  consistency: number;
  confidence: number;
  axisBalance: {
    EI: number;
    SN: number;
    TF: number;
    JP: number;
  };
}

const axisInterpretation = (value: number, left: string, right: string): string => {
  if (value <= 44) return `spíše ${left.toLowerCase()}`;
  if (value >= 56) return `spíše ${right.toLowerCase()}`;
  return 'vyvážené';
};

const IkigaiMetricHUD: React.FC<Props> = ({ progress, consistency, confidence, axisBalance }) => {
  const axisRows = [
    {
      key: 'E/I',
      value: axisBalance.EI,
      left: 'Introverze',
      right: 'Extraverze',
      help: 'Kde čerpáš energii: spíš o samotě, nebo mezi lidmi.',
    },
    {
      key: 'N/S',
      value: axisBalance.SN,
      left: 'Smyslovost',
      right: 'Intuice',
      help: 'Jak přemýšlíš: konkrétní fakta vs. možnosti a vzorce.',
    },
    {
      key: 'T/F',
      value: axisBalance.TF,
      left: 'Cítění',
      right: 'Myšlení',
      help: 'Jak rozhoduješ: dopad na lidi vs. logická konzistence.',
    },
    {
      key: 'J/P',
      value: axisBalance.JP,
      left: 'Flexibilita',
      right: 'Struktura',
      help: 'Jak pracuješ: otevřené možnosti vs. plán a řád.',
    },
  ];

  return (
    <div className="ikigai-hud rounded-2xl border border-cyan-200/30 bg-slate-950/55 p-3 text-cyan-100" aria-live="polite">
      <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/90">Živé metriky</div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div className="ikigai-glass-chip text-center">
          <div className="text-[10px] text-cyan-200/80">Postup</div>
          <div className="text-sm font-semibold text-cyan-50">{progress}%</div>
        </div>
        <div className="ikigai-glass-chip text-center">
          <div className="text-[10px] text-cyan-200/80">Konzistence</div>
          <div className="text-sm font-semibold text-cyan-50">{consistency}%</div>
        </div>
        <div className="ikigai-glass-chip text-center">
          <div className="text-[10px] text-cyan-200/80">Jistota</div>
          <div className="text-sm font-semibold text-cyan-50">{confidence}%</div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-cyan-200/20 bg-slate-900/55 p-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-cyan-200/80">Co znamenají osy</div>
        <div className="mt-2 space-y-2 text-[11px]">
          {axisRows.map((row) => (
            <div key={row.key} className="ikigai-glass-chip">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-cyan-50">{row.key}: {row.value}</span>
                <span className="text-cyan-100/90">{axisInterpretation(row.value, row.left, row.right)}</span>
              </div>
              <div className="mt-1 text-[10px] text-slate-300">{row.left} ↔ {row.right}</div>
              <div className="mt-0.5 text-[10px] text-slate-400">{row.help}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IkigaiMetricHUD;
