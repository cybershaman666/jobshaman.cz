import React from 'react';

interface OverviewTodayActionItemProps {
  item: {
    id: string;
    title: string;
    detail: string;
    label: string;
    actionLabel: string;
    action: () => void;
  };
}

const OverviewTodayActionItem: React.FC<OverviewTodayActionItemProps> = ({ item }) => {
  return (
    <div className="company-surface-soft app-organic-panel-soft rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/70 dark:bg-slate-900/70">
      <div className="flex items-center justify-between gap-2">
        <span className="company-pill-surface app-organic-pill inline-flex items-center rounded-full bg-white/90 dark:bg-slate-800 px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          {item.label}
        </span>
        <button onClick={item.action} className="company-action-link text-[11px] font-semibold">
          {item.actionLabel}
        </button>
      </div>
      <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{item.title}</div>
      <div className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.detail}</div>
    </div>
  );
};

export default OverviewTodayActionItem;
