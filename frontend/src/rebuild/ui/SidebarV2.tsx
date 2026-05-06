import React from 'react';
import { cn } from '../cn';
import { BrandMark, ThemeToggle } from './RebuildChrome';
import { LogOut, HelpCircle, Sparkles, LogIn, ArrowUpRight } from 'lucide-react';
import { UserProfile } from '../../types';
import { useRebuildTheme } from './rebuildTheme';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: string | number; className?: string }>;
  path?: string;
  badge?: string;
}

export const SidebarV2: React.FC<{
  userRole: 'candidate' | 'recruiter';
  navItems: NavItem[];
  activeItemId: string;
  onNavigate: (id: string, path?: string) => void;
  userProfile: UserProfile;
  onSignOut?: () => void;
  onOpenAuth?: (intent: 'candidate' | 'recruiter') => void;
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
}> = ({ userRole, navItems, activeItemId, onNavigate, userProfile, onSignOut, onOpenAuth, t }) => {
  const { resolvedMode } = useRebuildTheme();
  const candidateLight = resolvedMode === 'light';
  const candidateSidebarSurface = candidateLight
    ? 'bg-white border-r border-slate-100'
    : 'bg-[#0a0d12] border-r border-white/5';

  return (
    <aside className={cn(
      'fixed inset-y-0 left-0 z-40 hidden h-screen w-[248px] overflow-hidden lg:flex',
      userRole === 'recruiter'
        ? 'border-[#e8e3d9] bg-[#fbfaf7]'
        : candidateSidebarSurface,
    )}>
      <div className="flex h-full min-h-0 flex-col">
        <div className={cn(
          'flex items-center px-4 pb-5 pt-6',
          userRole === 'recruiter' ? 'border-b border-[#ece5da]' : '',
        )}>
          <button type="button" onClick={() => onNavigate(navItems[0]?.id, navItems[0]?.path)} className="ml-2 text-left outline-none">
            <BrandMark subtitle={userRole === 'recruiter' ? undefined : undefined} compact={false} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 py-4">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeItemId;

              if (userRole === 'recruiter') {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id, item.path)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-[16px] px-4 py-3 text-sm font-medium transition-all duration-200 outline-none',
                      isActive
                        ? 'border border-[#d9e6f7] bg-[#eef4ff] text-[#2563eb] shadow-[0_16px_34px_-28px_rgba(59,130,246,0.5)]'
                        : 'border border-transparent text-[#4b5563] hover:bg-[#f3f4f6] hover:text-[#111827]',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={18} className={cn(isActive ? 'text-[#2563eb]' : 'text-[#6b7280]')} />
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', isActive ? 'bg-[#dbeafe] text-[#1d4ed8]' : 'bg-[#eef2f7] text-[#6b7280]')}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id, item.path)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-[16px] px-4 py-3.5 text-[15px] font-medium transition-all duration-200 outline-none',
                    isActive
                      ? candidateLight
                        ? 'bg-[linear-gradient(135deg,rgba(255,247,225,0.98),rgba(246,223,180,0.92))] text-[#6d460f] shadow-[0_18px_32px_-24px_rgba(159,103,25,0.35)] ring-1 ring-[#edd39d]/90'
                        : 'bg-[linear-gradient(135deg,rgba(213,138,34,0.24),rgba(213,138,34,0.1))] text-[#fcedce] shadow-[0_18px_38px_-22px_rgba(213,138,34,0.38)] ring-1 ring-amber-200/10'
                      : candidateLight
                        ? 'text-[color:var(--dashboard-text-body)] hover:bg-[#f3eee5] hover:text-[color:var(--dashboard-text-strong)]'
                        : 'text-white/72 hover:bg-white/[0.04] hover:text-white',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-[11px] transition',
                        isActive
                          ? candidateLight
                            ? 'bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'
                            : 'bg-white/10'
                          : candidateLight
                            ? 'bg-white/55'
                            : 'bg-white/[0.03]',
                      )}
                    >
                      <Icon size={19} className={cn(isActive ? candidateLight ? 'text-[#6d460f]' : 'text-[#fcedce]' : candidateLight ? 'text-[color:var(--dashboard-text-muted)]' : 'text-white/45')} />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge && (
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      isActive
                        ? 'bg-[#f8dfac] text-[#6d460f]'
                        : candidateLight
                          ? 'bg-[#efe8de] text-[color:var(--dashboard-text-body)]'
                          : 'bg-white/10 text-white/68',
                    )}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[color:color-mix(in_srgb,var(--dashboard-sidebar-border)_80%,transparent)] p-4">
          {userRole === 'recruiter' && (
            <>
              <button type="button" onClick={() => onNavigate('cybershaman')} className="flex w-full items-center gap-3 rounded-[18px] border border-[#ece4d8] bg-white px-4 py-4 text-sm font-medium text-[#334155] shadow-[0_14px_34px_-28px_rgba(15,23,42,0.22)] transition hover:bg-[#faf8f4]">
                <Sparkles size={18} className="text-[#3b82f6]" />
                <div className="flex flex-col items-start">
                  <span>Cybershaman AI</span>
                  <span className="text-[10px] font-normal text-slate-500">{t('rebuild.nav.ai_guide_subtitle', { defaultValue: 'Your AI recruitment guide' })}</span>
                </div>
              </button>
              <div className="mt-4 space-y-1 border-t border-[#ece4d8] pt-4">
                <button type="button" className="flex w-full items-center gap-3 rounded-[14px] px-4 py-2.5 text-sm font-medium text-[#4b5563] transition hover:bg-[#f3f4f6]">
                  <HelpCircle size={18} className="text-[#9ca3af]" />
                  {t('rebuild.nav.help', { defaultValue: 'Help' })}
                </button>
                {userProfile.isLoggedIn ? (
                  <button type="button" onClick={onSignOut} className="flex w-full items-center gap-3 rounded-[14px] px-4 py-2.5 text-sm font-medium text-[#4b5563] transition hover:bg-[#f3f4f6]">
                    <LogOut size={18} className="text-[#9ca3af]" />
                    {t('rebuild.nav.sign_out', { defaultValue: 'Sign out' })}
                  </button>
                ) : (
                  <button type="button" onClick={() => onOpenAuth?.('recruiter')} className="flex w-full items-center gap-3 rounded-[14px] px-4 py-2.5 text-sm font-medium text-[#4b5563] transition hover:bg-[#f3f4f6]">
                    <LogIn size={18} className="text-[#9ca3af]" />
                    {t('rebuild.nav.sign_in', { defaultValue: 'Sign in' })}
                  </button>
                )}
              </div>
            </>
          )}
          {userRole === 'candidate' ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onNavigate('mentor', '/candidate/insights#mentor')}
                className={cn(
                  'group relative flex w-full items-center gap-3 overflow-hidden rounded-[22px] px-3.5 py-3.5 text-left transition',
                  candidateLight
                    ? 'border border-[color:color-mix(in_srgb,var(--shell-button-secondary-border)_82%,transparent)] bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(251,243,229,0.96)_55%,rgba(236,247,248,0.92))] shadow-[0_22px_40px_-34px_rgba(69,53,23,0.26)] hover:shadow-[0_30px_48px_-36px_rgba(69,53,23,0.3)]'
                    : 'border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.04)_52%,rgba(124,232,255,0.06))] hover:bg-[linear-gradient(160deg,rgba(255,255,255,0.1),rgba(255,255,255,0.05)_52%,rgba(124,232,255,0.08))]',
                )}
              >
                <div aria-hidden className={cn(
                  'pointer-events-none absolute inset-0',
                  candidateLight
                    ? 'bg-[radial-gradient(circle_at_18%_20%,rgba(229,193,124,0.32),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(55,199,226,0.16),transparent_22%)]'
                    : 'bg-[radial-gradient(circle_at_18%_20%,rgba(229,193,124,0.22),transparent_32%),radial-gradient(circle_at_88%_10%,rgba(124,232,255,0.14),transparent_22%)]',
                )} />
                <div className="relative flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-[18px]">
                  <div className="absolute inset-0 rounded-[18px]" />
                  <div className={cn(
                    'absolute inset-0 rounded-[18px]',
                    candidateLight
                      ? 'bg-[radial-gradient(circle_at_50%_35%,rgba(255,247,223,0.98),rgba(232,200,130,0.92)_60%,rgba(192,229,233,0.78))] shadow-[0_18px_30px_-20px_rgba(88,64,24,0.45)]'
                      : 'bg-[radial-gradient(circle_at_50%_35%,rgba(255,247,223,0.18),rgba(229,193,124,0.22)_58%,rgba(124,232,255,0.16))] shadow-[0_18px_34px_-20px_rgba(4,10,22,0.62)]',
                  )} />
                  <img src={candidateLight ? "/logo-transparent.png" : "/logodark.png"} alt="" className="relative h-9 w-9 object-contain opacity-95" />
                </div>
                <div className="relative min-w-0 flex-1">
                  <div className={cn('pr-8 text-[15px] font-semibold leading-5', candidateLight ? 'text-[color:var(--shell-text-primary)]' : 'text-white')}>
                    {t('rebuild.nav.chat_with_shaman', { defaultValue: 'Chat with Shaman' })}
                  </div>
                  <div className={cn(
                    'absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-transform duration-300 group-hover:-translate-y-[55%] group-hover:translate-x-0.5',
                    candidateLight ? 'bg-white/74 text-[#b88c46]' : 'bg-white/10 text-white/72',
                  )}>
                    <ArrowUpRight size={14} />
                  </div>
                </div>
              </button>

              <div className={cn(
                'flex items-center justify-center rounded-[22px] border p-2',
                candidateLight
                  ? 'border-[color:color-mix(in_srgb,var(--shell-button-secondary-border)_75%,transparent)] bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(249,245,238,0.92))]'
                  : 'border-white/10 bg-white/5',
              )}>
                <ThemeToggle compact className="w-auto" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
};
