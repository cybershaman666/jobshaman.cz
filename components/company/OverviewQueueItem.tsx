import React from 'react';

interface OverviewQueueItemProps {
  item: {
    id: string;
    title: string;
    detail: string;
    action: () => void;
    accent: string;
  };
}

const OverviewQueueItem: React.FC<OverviewQueueItemProps> = ({ item }) => {
  const accentClass = item.accent === 'amber'
    ? 'bg-amber-500'
    : item.accent === 'rose'
      ? 'bg-rose-500'
      : item.accent === 'emerald'
        ? 'bg-emerald-500'
        : item.accent === 'cyan'
          ? 'bg-[var(--accent)]'
          : 'bg-slate-400';

  return (
    <button onClick={item.action} className="company-surface-subtle w-full rounded-[var(--radius-md)] border p-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:border-[rgba(var(--accent-rgb),0.22)] hover:bg-[var(--surface-elevated)]">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${accentClass}`} />
        <span className="text-sm font-semibold text-[var(--text-strong)]">{item.title}</span>
      </div>
      <div className="mt-2 text-sm text-[var(--text-muted)]">{item.detail}</div>
    </button>
  );
};

export default OverviewQueueItem;
