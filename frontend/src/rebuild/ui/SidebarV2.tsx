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
  isOpen?: boolean;
  onClose?: () => void;
}> = ({ userRole, navItems, activeItemId, onNavigate, userProfile, onSignOut, onOpenAuth, t, isOpen, onClose }) => {
  const { resolvedMode } = useRebuildTheme();
  const candidateLight = resolvedMode === 'light';
  const candidateSidebarSurface = candidateLight
    ? 'bg-[color:var(--dashboard-sidebar-bg)]'
    : 'bg-[color:var(--dashboard-sidebar-bg)]';

  return (
    <aside className={cn(
      'fixed inset-y-0 left-0 z-40 h-screen w-[248px] overflow-hidden transition-transform duration-300 ease-in-out lg:flex lg:translate-x-0',
      userRole === 'recruiter'
        ? 'bg-[color:var(--dashboard-page-bg)]'
        : candidateSidebarSurface,
      isOpen ? 'translate-x-0 flex' : '-translate-x-full hidden lg:flex',
    )}>
      <div className="flex h-full min-h-0 flex-col">
        <div className={cn(
          'flex items-center justify-between px-4 pb-5 pt-6',
        )}>
          <button type="button" onClick={() => onNavigate(navItems[0]?.id, navItems[0]?.path)} className="ml-2 text-left outline-none">
            <BrandMark subtitle={userRole === 'recruiter' ? undefined : undefined} compact={false} />
          </button>
          
          {/* Close button for mobile */}
          <button 
            type="button" 
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-black/5 lg:hidden"
            aria-label="Close menu"
          >
            <span className={cn('text-xl', userRole === 'candidate' && !candidateLight ? 'text-white' : 'text-slate-600')}>×</span>
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
                        ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
                        : 'text-[color:var(--dashboard-text-muted)] hover:bg-white/70 hover:text-[color:var(--dashboard-text-strong)]',
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
                        ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)] shadow-sm ring-1 ring-[color:var(--accent)/20]'
                        : 'bg-[color:var(--dashboard-soft-bg)] text-[color:var(--dashboard-gold)] shadow-sm ring-1 ring-white/10'
                      : candidateLight
                        ? 'text-[color:var(--dashboard-text-body)] hover:bg-[color:var(--dashboard-soft-bg)] hover:text-[color:var(--dashboard-text-strong)]'
                        : 'text-white/72 hover:bg-white/[0.04] hover:text-white',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-[11px] transition',
                        isActive
                          ? candidateLight
                            ? 'bg-white/80 shadow-sm'
                            : 'bg-white/10'
                          : candidateLight
                            ? 'bg-white/55'
                            : 'bg-white/[0.03]',
                      )}
                    >
                      <Icon size={19} className={cn(isActive ? candidateLight ? 'text-[color:var(--accent)]' : 'text-[color:var(--dashboard-gold)]' : candidateLight ? 'text-[color:var(--dashboard-text-muted)]' : 'text-white/45')} />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge && (
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      isActive
                        ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
                        : candidateLight
                          ? 'bg-[color:var(--dashboard-soft-bg)] text-[color:var(--dashboard-text-body)]'
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

        <div className="p-4">
          {userRole === 'recruiter' && (
            <>
              <button type="button" onClick={() => onNavigate('cybershaman')} className="flex w-full items-center gap-3 rounded-[18px] bg-white/72 px-4 py-4 text-sm font-medium text-[color:var(--dashboard-text-body)] shadow-[0_14px_38px_-34px_rgba(15,23,42,0.24)] transition hover:bg-white">
                <Sparkles size={18} className="text-[color:var(--accent)]" />
                <div className="flex flex-col items-start">
                  <span>Cybershaman AI</span>
                  <span className="text-[10px] font-normal text-[color:var(--dashboard-text-muted)]">{t('rebuild.nav.ai_guide_subtitle', { defaultValue: 'Your AI recruitment guide' })}</span>
                </div>
              </button>
              <div className="mt-4 space-y-1 pt-4">
                <button type="button" className="flex w-full items-center gap-3 rounded-[14px] px-4 py-2.5 text-sm font-medium text-[color:var(--dashboard-text-body)] transition hover:bg-[color:var(--dashboard-soft-bg)]">
                  <HelpCircle size={18} className="text-[color:var(--dashboard-text-muted)]" />
                  {t('rebuild.nav.help', { defaultValue: 'Help' })}
                </button>
                {userProfile.isLoggedIn ? (
                  <button type="button" onClick={onSignOut} className="flex w-full items-center gap-3 rounded-[14px] px-4 py-2.5 text-sm font-medium text-[color:var(--dashboard-text-body)] transition hover:bg-[color:var(--dashboard-soft-bg)]">
                    <LogOut size={18} className="text-[color:var(--dashboard-text-muted)]" />
                    {t('rebuild.nav.sign_out', { defaultValue: 'Sign out' })}
                  </button>
                ) : (
                  <button type="button" onClick={() => onOpenAuth?.('recruiter')} className="flex w-full items-center gap-3 rounded-[14px] px-4 py-2.5 text-sm font-medium text-[color:var(--dashboard-text-body)] transition hover:bg-[color:var(--dashboard-soft-bg)]">
                    <LogIn size={18} className="text-[color:var(--dashboard-text-muted)]" />
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
                    ? 'border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-panel-bg)] shadow-soft hover:shadow-card'
                    : 'border border-white/10 bg-[color:var(--shell-button-secondary-bg)] hover:bg-[color:var(--shell-button-secondary-hover)]',
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
                    candidateLight ? 'bg-white/74 text-[color:var(--accent-gold)]' : 'bg-white/10 text-white/72',
                  )}>
                    <ArrowUpRight size={14} />
                  </div>
                </div>
              </button>

              <div className={cn(
                'flex items-center justify-center rounded-[22px] border p-2',
                candidateLight
                  ? 'border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)]'
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
