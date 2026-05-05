import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

import { cn } from '../cn';
import { useRebuildTheme } from './rebuildTheme';

export const LANG_OPTIONS = [
  { code: 'cs', label: 'Čeština', flag: '🇨🇿' },
  { code: 'sk', label: 'Slovenčina', flag: '🇸🇰' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fi', label: 'Suomi', flag: '🇫🇮' },
  { code: 'sv', label: 'Svenska', flag: '🇸🇪' },
  { code: 'no', label: 'Norsk', flag: '🇳🇴' },
  { code: 'da', label: 'Dansk', flag: '🇩🇰' },
];

export const BrandMark: React.FC<{ subtitle?: string; compact?: boolean }> = ({ subtitle, compact = false }) => {
  const { resolvedMode } = useRebuildTheme();
  const logoSrc = resolvedMode === 'dark' ? '/logotextdark.png' : '/logotext-transparent.png';

  return (
    <div className="inline-flex items-center gap-3">
      <img
        src={logoSrc}
        alt="Jobshaman"
        className={cn(
          'block shrink-0 object-contain drop-shadow-[0_18px_28px_rgba(5,10,24,0.14)]',
          compact ? 'h-12 w-auto max-w-[10rem]' : 'h-[4.5rem] w-auto max-w-[15.75rem]',
        )}
        loading="eager"
      />
      <div className="text-left">
        <div className="sr-only">Jobshaman</div>
        {subtitle ? <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--shell-brand-subtitle)]">{subtitle}</div> : null}
      </div>
    </div>
  );
};

export const AppBackdrop: React.FC = () => (
  <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--shell-bg-accent),var(--shell-bg-base)_58%)]" />
    <div className="absolute inset-0 opacity-100" style={{ backgroundImage: 'var(--shell-backdrop-primary), var(--shell-backdrop-secondary), var(--shell-backdrop-tertiary)' }} />
    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_24%,transparent_76%,rgba(0,0,0,0.08))]" />
    <div className="absolute left-[8%] top-[8%] h-[18rem] w-[18rem] rounded-full bg-[color:color-mix(in_srgb,var(--shell-accent)_18%,transparent)] blur-[120px]" />
    <div className="absolute bottom-[6%] right-[10%] h-[16rem] w-[16rem] rounded-full bg-[color:color-mix(in_srgb,var(--shell-accent-cyan)_14%,transparent)] blur-[120px]" />
  </div>
);

export const ThemeToggle: React.FC<{ compact?: boolean; className?: string }> = ({ compact = false, className }) => {
  const { mode, resolvedMode, setMode } = useRebuildTheme();

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] p-1 shadow-[0_16px_36px_-28px_rgba(5,10,24,0.45)]',
        compact ? 'h-10 w-full' : 'h-11',
        className,
      )}
    >
      {([
        { id: 'system', label: 'Auto', icon: Monitor, title: `System (${resolvedMode})` },
        { id: 'dark', label: 'Dark', icon: Moon },
        { id: 'light', label: 'Light', icon: Sun },
      ] as const).map((item) => {
        const Icon = item.icon;
        const active = mode === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setMode(item.id)}
            title={'title' in item ? item.title : item.label}
            className={cn(
              'inline-flex min-w-0 items-center justify-center gap-2 rounded-full text-xs font-semibold transition duration-300',
              compact ? 'h-8 w-8 shrink-0 px-0' : 'h-9 min-w-9 px-3 sm:px-3.5',
              active
                ? 'border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-hover)] text-[color:var(--shell-text-primary)] shadow-[0_12px_24px_-22px_rgba(49,38,17,0.18)]'
                : 'text-[color:var(--shell-text-muted)] hover:bg-white/10 hover:text-[color:var(--shell-text-primary)]',
            )}
          >
            <Icon size={14} />
            <span className={compact ? 'sr-only' : 'hidden sm:inline'}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export const LanguageSwitcher: React.FC<{
  i18n: { language: string; changeLanguage: (lng: string) => Promise<unknown> };
}> = ({ i18n }) => {
  const [open, setOpen] = React.useState(false);
  const baseLang = i18n.language?.substring(0, 2).toLowerCase() || 'cs';
  const current = LANG_OPTIONS.find((option) => option.code === baseLang) || LANG_OPTIONS[0];

  return (
    <div className="relative z-[70]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 items-center gap-2 rounded-[18px] border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] px-3.5 text-sm font-medium text-[color:var(--shell-text-secondary)] transition hover:text-[color:var(--shell-text-primary)]"
      >
        <span>{current.flag}</span>
        <span className="hidden sm:inline">{current.label}</span>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-[80] mt-2 w-40 rounded-xl border border-[color:var(--shell-button-secondary-border)] bg-white dark:bg-[#0a0d12] py-1.5 shadow-[var(--shell-panel-shadow)]">
            {LANG_OPTIONS.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  void i18n.changeLanguage(option.code);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm transition',
                  baseLang === option.code
                    ? 'bg-[color:color-mix(in_srgb,var(--shell-accent-cyan)_16%,transparent)] font-semibold text-[color:var(--shell-accent-cyan)]'
                    : 'text-[color:var(--shell-text-secondary)] hover:bg-white/10',
                )}
              >
                <span>{option.flag}</span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};
