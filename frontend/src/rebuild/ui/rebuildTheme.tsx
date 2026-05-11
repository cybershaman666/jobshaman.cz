import React from 'react';

import { REBUILD_STORAGE_KEYS } from '../state';

export type RebuildThemeMode = 'system' | 'light' | 'dark';
export type RebuildResolvedThemeMode = 'light' | 'dark';

type RebuildThemeContextValue = {
  mode: RebuildThemeMode;
  resolvedMode: RebuildResolvedThemeMode;
  setMode: (mode: RebuildThemeMode) => void;
  toggleMode: () => void;
};

const RebuildThemeContext = React.createContext<RebuildThemeContextValue | null>(null);

const readStoredMode = (): RebuildThemeMode => {
  if (typeof window === 'undefined') return 'system';
  try {
    const raw = window.localStorage.getItem(REBUILD_STORAGE_KEYS.theme);
    return raw === 'system' || raw === 'light' || raw === 'dark' ? raw : 'system';
  } catch {
    return 'system';
  }
};

const getSystemMode = (): RebuildResolvedThemeMode => {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

const themeStyles: Record<RebuildResolvedThemeMode, React.CSSProperties> = {
  dark: {
    ['--shell-bg-base' as string]: '#0f172a',
    ['--shell-bg-accent' as string]: '#172033',
    ['--shell-bg-elevated' as string]: 'rgba(21, 28, 49, 0.86)',
    ['--shell-panel-bg' as string]: 'none',
    ['--shell-panel-solid' as string]: 'rgba(15, 23, 42, 0.84)',
    ['--shell-panel-border' as string]: 'rgba(181, 201, 255, 0.18)',
    ['--shell-panel-border-strong' as string]: 'rgba(107, 229, 255, 0.42)',
    ['--shell-panel-highlight' as string]: 'rgba(255,255,255,0.28)',
    ['--shell-panel-shadow' as string]: '0 18px 54px -46px rgba(2,6,23,0.86)',
    ['--shell-header-bg' as string]: 'rgba(15, 23, 42, 0.86)',
    ['--shell-header-border' as string]: 'rgba(176, 196, 255, 0.16)',
    ['--shell-text-primary' as string]: '#f6f8ff',
    ['--shell-text-secondary' as string]: 'rgba(225,232,255,0.82)',
    ['--shell-text-muted' as string]: 'rgba(188,198,228,0.74)',
    ['--shell-text-subtle' as string]: 'rgba(153,166,205,0.64)',
    ['--shell-accent' as string]: '#ff8f7a',
    ['--shell-accent-strong' as string]: '#ff7562',
    ['--shell-accent-soft' as string]: 'rgba(255, 143, 122, 0.14)',
    ['--shell-accent-cyan' as string]: '#7ce8ff',
    ['--shell-button-primary-bg' as string]: 'linear-gradient(180deg, #ff8a76, #f46f5e)',
    ['--shell-button-primary-hover' as string]: 'linear-gradient(180deg, #ff9684, #fb7d6d)',
    ['--shell-button-primary-text' as string]: '#fff9f8',
    ['--shell-button-secondary-bg' as string]: 'rgba(255,255,255,0.06)',
    ['--shell-button-secondary-hover' as string]: 'rgba(255,255,255,0.11)',
    ['--shell-button-secondary-border' as string]: 'rgba(185,198,239,0.18)',
    ['--shell-button-secondary-text' as string]: '#f4f6ff',
    ['--shell-chip-bg' as string]: 'rgba(255,255,255,0.08)',
    ['--shell-chip-border' as string]: 'rgba(180,196,247,0.16)',
    ['--shell-field-bg' as string]: 'rgba(255,255,255,0.06)',
    ['--shell-field-border' as string]: 'rgba(173,189,240,0.16)',
    ['--shell-field-focus' as string]: 'rgba(124,232,255,0.72)',
    ['--shell-track' as string]: 'rgba(255,255,255,0.1)',
    ['--shell-backdrop-primary' as string]: 'radial-gradient(circle at top left, rgba(255, 143, 122, 0.2), transparent 28%)',
    ['--shell-backdrop-secondary' as string]: 'radial-gradient(circle at top right, rgba(124, 232, 255, 0.14), transparent 34%)',
    ['--shell-backdrop-tertiary' as string]: 'radial-gradient(circle at bottom center, rgba(120, 135, 255, 0.12), transparent 28%)',
    ['--shell-brand-bg' as string]: 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))',
    ['--shell-brand-text' as string]: '#f6f8ff',
    ['--shell-brand-subtitle' as string]: 'rgba(187,198,230,0.76)',
    ['--dashboard-page-bg' as string]: '#0a0d12',
    ['--dashboard-page-border' as string]: 'rgba(255,255,255,0.04)',
    ['--dashboard-sidebar-bg' as string]: '#0a0d12',
    ['--dashboard-sidebar-border' as string]: 'rgba(255,255,255,0.08)',
    ['--dashboard-card-bg' as string]: 'rgba(15,23,42,0.72)',
    ['--dashboard-card-border' as string]: 'rgba(148,163,184,0.18)',
    ['--dashboard-card-shadow' as string]: '0 18px 48px -42px rgba(0,0,0,0.78)',
    ['--dashboard-soft-bg' as string]: 'rgba(255,255,255,0.04)',
    ['--dashboard-soft-border' as string]: 'rgba(255,255,255,0.1)',
    ['--dashboard-text-strong' as string]: '#f8fafc',
    ['--dashboard-text-body' as string]: 'rgba(226,232,240,0.72)',
    ['--dashboard-text-muted' as string]: 'rgba(148,163,184,0.72)',
    ['--dashboard-gold' as string]: '#f0c776',
    ['--dashboard-gold-strong' as string]: '#ffc170',
    ['--dashboard-teal' as string]: '#72d6e3',
    ['--dashboard-track' as string]: 'rgba(255,255,255,0.08)',
    ['--shell-surface-base' as string]: 'rgba(10, 13, 18, 0.5)',
    ['--shell-surface-gold' as string]: 'rgba(240, 199, 118, 0.12)',
    ['--shell-surface-cyan' as string]: 'rgba(114, 214, 227, 0.1)',
    ['--shell-surface-teal' as string]: 'rgba(36, 150, 171, 0.08)',
  },

  light: {
    ['--shell-bg-base' as string]: '#f6f8fb',
    ['--shell-bg-accent' as string]: '#eef4f7',
    ['--shell-bg-elevated' as string]: 'rgba(255, 255, 255, 0.92)',
    ['--shell-panel-bg' as string]: 'none',
    ['--shell-panel-solid' as string]: 'rgba(255,255,255,0.94)',
    ['--shell-panel-border' as string]: 'rgba(148, 163, 184, 0.22)',
    ['--shell-panel-border-strong' as string]: 'rgba(36, 150, 171, 0.42)',
    ['--shell-panel-highlight' as string]: 'rgba(255,255,255,0.72)',
    ['--shell-panel-shadow' as string]: '0 18px 44px -38px rgba(15,23,42,0.18)',
    ['--shell-header-bg' as string]: 'rgba(246,248,251,0.94)',
    ['--shell-header-border' as string]: 'rgba(148,163,184,0.18)',
    ['--shell-text-primary' as string]: '#1a2230',
    ['--shell-text-secondary' as string]: '#435062',
    ['--shell-text-muted' as string]: '#697383',
    ['--shell-text-subtle' as string]: '#8e9786',
    ['--shell-accent' as string]: '#0f95ac',
    ['--shell-accent-strong' as string]: '#08788a',
    ['--shell-accent-soft' as string]: 'rgba(15, 149, 172, 0.1)',
    ['--shell-accent-cyan' as string]: '#0f95ac',
    ['--shell-button-primary-bg' as string]: 'linear-gradient(180deg, #12afcb, #0f95ac)',
    ['--shell-button-primary-hover' as string]: 'linear-gradient(180deg, #20bdd8, #128da3)',
    ['--shell-button-primary-text' as string]: '#ffffff',
    ['--shell-button-secondary-bg' as string]: 'rgba(255,255,255,0.82)',
    ['--shell-button-secondary-hover' as string]: 'rgba(255,255,255,0.9)',
    ['--shell-button-secondary-border' as string]: 'rgba(148,163,184,0.28)',
    ['--shell-button-secondary-text' as string]: '#2a3340',
    ['--shell-chip-bg' as string]: 'rgba(255,255,255,0.84)',
    ['--shell-chip-border' as string]: 'rgba(148,163,184,0.28)',
    ['--shell-field-bg' as string]: 'rgba(255,255,255,0.9)',
    ['--shell-field-border' as string]: 'rgba(148,163,184,0.32)',
    ['--shell-field-focus' as string]: 'rgba(55,199,226,0.66)',
    ['--shell-track' as string]: 'rgba(68,91,138,0.12)',
    ['--shell-backdrop-primary' as string]: 'radial-gradient(circle at top left, rgba(255, 127, 105, 0.12), transparent 28%)',
    ['--shell-backdrop-secondary' as string]: 'radial-gradient(circle at top right, rgba(55, 199, 226, 0.11), transparent 34%)',
    ['--shell-backdrop-tertiary' as string]: 'radial-gradient(circle at bottom center, rgba(126, 147, 255, 0.08), transparent 26%)',
    ['--shell-brand-bg' as string]: 'linear-gradient(180deg, rgba(38,47,80,0.96), rgba(25,33,59,0.92))',
    ['--shell-brand-text' as string]: '#24304f',
    ['--shell-brand-subtitle' as string]: 'rgba(95,109,146,0.88)',
    ['--dashboard-page-bg' as string]: '#f6f8fb',
    ['--dashboard-page-border' as string]: '#e2e8f0',
    ['--dashboard-sidebar-bg' as string]: '#ffffff',
    ['--dashboard-sidebar-border' as string]: 'rgba(148,163,184,0.22)',
    ['--dashboard-card-bg' as string]: 'rgba(255,255,255,0.92)',
    ['--dashboard-card-border' as string]: 'rgba(148,163,184,0.22)',
    ['--dashboard-card-shadow' as string]: '0 14px 34px -30px rgba(15,23,42,0.18)',
    ['--dashboard-soft-bg' as string]: '#f8fafc',
    ['--dashboard-soft-border' as string]: '#e2e8f0',
    ['--dashboard-text-strong' as string]: '#111827',
    ['--dashboard-text-body' as string]: '#4b5563',
    ['--dashboard-text-muted' as string]: '#6b7280',
    ['--dashboard-gold' as string]: '#b7791f',
    ['--dashboard-gold-strong' as string]: '#975a16',
    ['--dashboard-teal' as string]: '#2496ab',
    ['--dashboard-track' as string]: '#ece7dd',
    ['--shell-surface-base' as string]: '#ffffff',
    ['--shell-surface-gold' as string]: 'rgba(253, 246, 230, 0.8)',
    ['--shell-surface-cyan' as string]: 'rgba(240, 252, 253, 0.8)',
    ['--shell-surface-teal' as string]: 'rgba(235, 250, 251, 0.7)',
  },

};

export const RebuildThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = React.useState<RebuildThemeMode>(readStoredMode);
  const [systemMode, setSystemMode] = React.useState<RebuildResolvedThemeMode>(getSystemMode);
  const resolvedMode = mode === 'system' ? systemMode : mode;

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const updateSystemMode = () => setSystemMode(media.matches ? 'light' : 'dark');
    updateSystemMode();
    media.addEventListener?.('change', updateSystemMode);
    return () => media.removeEventListener?.('change', updateSystemMode);
  }, []);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(REBUILD_STORAGE_KEYS.theme, mode);
    } catch {
      // ignore storage failures
    }
  }, [mode]);

  const value = React.useMemo<RebuildThemeContextValue>(() => ({
    mode,
    resolvedMode,
    setMode,
    toggleMode: () => setMode((current) => {
      const currentResolved = current === 'system' ? resolvedMode : current;
      return currentResolved === 'dark' ? 'light' : 'dark';
    }),
  }), [mode, resolvedMode]);

  return (
    <RebuildThemeContext.Provider value={value}>
      <div className={`rebuild-theme rebuild-theme-${resolvedMode} ${resolvedMode === 'dark' ? 'dark' : ''}`} data-theme-mode={mode} data-theme-resolved={resolvedMode} style={themeStyles[resolvedMode]}>
        {children}
      </div>
    </RebuildThemeContext.Provider>
  );
};

export const useRebuildTheme = (): RebuildThemeContextValue => {
  const context = React.useContext(RebuildThemeContext);
  if (!context) {
    throw new Error('useRebuildTheme must be used inside RebuildThemeProvider');
  }
  return context;
};
