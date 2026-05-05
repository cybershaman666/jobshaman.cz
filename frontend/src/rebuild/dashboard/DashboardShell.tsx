import React from 'react';
import { Bell, ChevronDown, LogOut, Moon, Sun } from 'lucide-react';

import type { UserProfile } from '../../types';
import { cn } from '../cn';
import { useRebuildTheme } from '../ui/rebuildTheme';

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}

export const dashboardSurfaceClass =
  'min-h-screen bg-[image:var(--dashboard-page-bg)] text-[color:var(--dashboard-text-strong)]';

export const dashboardCardClass =
  'rounded-[24px] border border-[color:var(--dashboard-card-border)] bg-[color:var(--dashboard-card-bg)] shadow-[var(--dashboard-card-shadow)]';

export const dashboardSoftCardClass =
  'rounded-[18px] border border-[color:var(--dashboard-soft-border)] bg-[color:var(--dashboard-soft-bg)]';

export const DashboardSidebar: React.FC<{
  navItems: DashboardNavItem[];
  userProfile: UserProfile;
  onSignOut?: () => void;
  footerLabel?: string;
}> = ({ navItems, userProfile, onSignOut, footerLabel = 'Světlý režim' }) => {
  const { resolvedMode, setMode } = useRebuildTheme();
  const logoSrc = resolvedMode === 'dark' ? '/logotextdark.png' : '/logotext-transparent.png';

  return (
    <aside className="sticky top-0 hidden h-screen w-[276px] shrink-0 flex-col border-r border-[#eee8df] bg-white px-5 py-6 dark:border-white/10 dark:bg-[#10162a] lg:flex">
      <button type="button" className="flex items-center gap-3 text-left">
        <img src={logoSrc} alt="Jobshaman" className="h-12 w-auto max-w-[13rem] object-contain" />
      </button>
      <nav className="mt-10 space-y-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={cn(
              'flex h-12 w-full items-center gap-4 rounded-[15px] px-4 text-sm font-medium transition',
              item.active
                ? 'bg-[#f7dfaa] text-[#3d2b12] shadow-[0_16px_34px_-24px_rgba(196,131,40,0.7)] dark:bg-[#f0b85b]/20 dark:text-[#ffdca2]'
                : 'text-[#4f4f4f] hover:bg-[#f4efe7] dark:text-white/72 dark:hover:bg-white/8',
            )}
          >
            <span className="text-[#9b6021] dark:text-[#f2b76a]">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto border-t border-[#eee8df] pt-5 dark:border-white/10">
        <div className="mb-5 inline-flex rounded-full border border-[#eadfce] bg-white p-1 dark:border-white/10 dark:bg-white/8">
          <button
            type="button"
            onClick={() => setMode('light')}
            className={cn('flex h-8 w-8 items-center justify-center rounded-full', resolvedMode === 'light' ? 'bg-[#f7dfaa] text-[#c17919]' : 'text-[#aaa]')}
            aria-label="Light theme"
          >
            <Sun size={16} />
          </button>
          <button
            type="button"
            onClick={() => setMode('dark')}
            className={cn('flex h-8 w-8 items-center justify-center rounded-full', resolvedMode === 'dark' ? 'bg-[#24304f] text-white' : 'text-[#aaa]')}
            aria-label="Dark theme"
          >
            <Moon size={16} />
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {userProfile.photo ? (
              <img src={userProfile.photo} alt={userProfile.name || 'Profile'} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <img src="/logo-transparent.png" alt="" className="h-9 w-9 rounded-full object-cover" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-[#4c4a45] dark:text-white/82">{footerLabel}</div>
              <div className="truncate text-xs text-[#918a80] dark:text-white/45">{userProfile.name || userProfile.email || 'Jobshaman'}</div>
            </div>
          </div>
          {onSignOut ? (
            <button type="button" onClick={onSignOut} className="rounded-full p-2 text-[#918a80] transition hover:bg-[#f4efe7] hover:text-[#9b6021] dark:hover:bg-white/8">
              <LogOut size={16} />
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
};

export const DashboardTopBar: React.FC<{
  title: string;
  subtitle: string;
  userProfile: UserProfile;
  action?: React.ReactNode;
}> = ({ title, subtitle, userProfile, action }) => (
  <header className="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 className="text-[2rem] font-semibold tracking-[0.08em] text-[#151515] dark:text-white md:text-[2.45rem]">{title}</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-[#706f6c] dark:text-white/62">{subtitle}</p>
    </div>
    <div className="flex items-center gap-3">
      {action}
      <button type="button" className="hidden h-11 items-center gap-2 rounded-full border border-[#eadfce] bg-white px-5 text-sm font-medium text-[#27241f] shadow-sm dark:border-white/10 dark:bg-white/8 dark:text-white sm:flex">
        <Sun size={17} className="text-[#d58a22]" />
        Cybershaman
      </button>
      <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-[#eadfce] bg-white text-[#27241f] shadow-sm dark:border-white/10 dark:bg-white/8 dark:text-white">
        <Bell size={18} />
      </button>
      <button type="button" className="flex h-12 items-center gap-2 rounded-full border border-[#eadfce] bg-white pl-1.5 pr-3 shadow-sm dark:border-white/10 dark:bg-white/8">
        {userProfile.photo ? (
          <img src={userProfile.photo} alt={userProfile.name || 'Profile'} className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <img src="/logo-transparent.png" alt="" className="h-9 w-9 rounded-full object-cover" />
        )}
        <ChevronDown size={16} className="text-[#8b8173] dark:text-white/58" />
      </button>
    </div>
  </header>
);
