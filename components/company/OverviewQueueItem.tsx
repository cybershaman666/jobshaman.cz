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
          ? 'bg-cyan-500'
          : 'bg-slate-400';

  return (
    <button onClick={item.action} className="company-surface-subtle w-full rounded-[1rem] border border-slate-200/80 bg-white/85 p-4 text-left shadow-[0_16px_30px_-28px_rgba(15,23,42,0.42)] transition-colors hover:border-cyan-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-slate-900">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-2.5 w-2.5 rounded-full ${accentClass}`} />
        <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</span>
      </div>
      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.detail}</div>
    </button>
  );
};

export default OverviewQueueItem;
