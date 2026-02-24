import React from 'react';

export interface OfferImpactSnapshotRow {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: 'default' | 'positive' | 'negative' | 'emphasis';
}

interface OfferImpactSnapshotProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  leadingNote?: React.ReactNode;
  rows: OfferImpactSnapshotRow[];
  className?: string;
}

const toneClassMap: Record<NonNullable<OfferImpactSnapshotRow['tone']>, string> = {
  default: 'text-slate-300',
  positive: 'text-emerald-400',
  negative: 'text-rose-400',
  emphasis: 'text-white text-xl font-bold pt-3 mt-3 border-t border-slate-700'
};

const OfferImpactSnapshot: React.FC<OfferImpactSnapshotProps> = ({
  title,
  subtitle,
  leadingNote,
  rows,
  className = ''
}) => {
  return (
    <div className={`p-6 bg-slate-900/30 flex flex-col ${className}`.trim()}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {title}
            </h4>
          )}
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
      )}

      {leadingNote && <div className="text-xs text-purple-400 mb-2">{leadingNote}</div>}

      <div className="space-y-1 text-sm font-mono">
        {rows.map((row, index) => {
          const tone = row.tone || 'default';
          const toneClass = toneClassMap[tone];
          return (
            <div key={index} className={`flex justify-between ${toneClass}`}>
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OfferImpactSnapshot;
