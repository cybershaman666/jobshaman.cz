import React from 'react';
import { ChevronUp, Sparkles } from 'lucide-react';

import { cn } from '../ui/primitives';
import { galaxyShellPanelClass } from './GalaxyShellPrimitives';

const clampZoom = (value: number): number => Math.max(0.72, Math.min(1.6, Number(value.toFixed(2))));

const stepZoom = (
  setZoom: React.Dispatch<React.SetStateAction<number>>,
  direction: 'in' | 'out',
): void => {
  const delta = direction === 'in' ? 0.08 : -0.08;
  setZoom((current) => clampZoom(current + delta));
};

export interface GalaxyLayerSidebarItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onClick?: () => void;
}

export const GalaxyLayerSidebar: React.FC<{
  title: string;
  subtitle?: string;
  collapsed: boolean;
  setCollapsed: (value: React.SetStateAction<boolean>) => void;
  items: GalaxyLayerSidebarItem[];
  className?: string;
}> = ({
  title,
  subtitle,
  collapsed,
  setCollapsed,
  items,
  className,
}) => (
  <aside
    className={cn(
      galaxyShellPanelClass,
      'max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[26px] p-4',
      collapsed ? 'w-24' : 'w-72',
      className,
    )}
  >
    <div className="mb-2 flex items-center justify-between px-2 py-2">
      {!collapsed ? (
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          {subtitle ? (
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className={cn(
          'text-slate-400 transition-transform hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300',
          collapsed ? 'rotate-90' : '-rotate-90',
        )}
      >
        <ChevronUp className="h-5 w-5" />
      </button>
    </div>

    <div className="space-y-2">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={cn(
              'flex items-center gap-3 rounded-xl py-3 font-medium transition-all',
              collapsed ? 'justify-center px-0' : 'px-4',
              item.active
                ? 'border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                : 'border border-transparent text-slate-500 hover:bg-white/60 dark:text-slate-400 dark:hover:bg-slate-900/50',
            )}
          >
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                item.active
                  ? 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-300'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
              )}
            >
              {Icon ? <Icon className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </div>
            {!collapsed ? (
              <div className="min-w-0 flex-1 text-left text-sm font-semibold leading-5 text-slate-800 whitespace-normal break-words dark:text-slate-100">
                {item.label}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  </aside>
);

export const GalaxyCanvasControls: React.FC<{
  zoom: number;
  setZoom?: React.Dispatch<React.SetStateAction<number>>;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  className?: string;
}> = ({
  zoom,
  setZoom,
  onZoomIn,
  onZoomOut,
  onReset,
  className,
}) => {
  const handleZoomOut = () => {
    if (onZoomOut) {
      onZoomOut();
      return;
    }
    if (setZoom) {
      stepZoom(setZoom, 'out');
    }
  };

  const handleZoomIn = () => {
    if (onZoomIn) {
      onZoomIn();
      return;
    }
    if (setZoom) {
      stepZoom(setZoom, 'in');
    }
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
      return;
    }
    if (setZoom) {
      setZoom(1);
    }
  };

  return (
    <div
      className={cn(
        'rounded-[20px] border border-slate-200/90 bg-white/94 p-2.5 shadow-[0_20px_48px_-30px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/86 dark:shadow-[0_20px_48px_-30px_rgba(2,6,23,0.72)]',
        className,
      )}
    >
      <div className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Zoom</div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleZoomOut}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          -
        </button>
        <div className="min-w-[56px] text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
          {Math.round(zoom * 100)}%
        </div>
        <button
          type="button"
          onClick={handleZoomIn}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-base font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={handleReset}
        className="mt-1.5 w-full rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        Reset
      </button>
    </div>
  );
};
