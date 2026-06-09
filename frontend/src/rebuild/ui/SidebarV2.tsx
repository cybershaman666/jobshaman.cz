import React from 'react';
import { cn } from '../cn';
import { BrandMark, ThemeToggle } from './RebuildChrome';
import { LogOut, HelpCircle, Sparkles, LogIn, ArrowUpRight, Gift, Zap } from 'lucide-react';
import { UserProfile } from '../../types';
import { useRebuildTheme } from './rebuildTheme';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: string | number; className?: string }>;
  path?: string;
  badge?: string;
}

export interface CandidateSidebarSummary {
  slotsRemaining: number;
  slotsLimit: number;
  karmaBalance: number;
  nextSlotCost: number;
  bonusSlotsAvailable: number;
  profileScore: number;
  redeemingSlot?: boolean;
  onOpenReferral?: () => void;
  onRedeemSlot?: () => void;
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
  candidateSidebar?: CandidateSidebarSummary;
}> = ({ userRole, navItems, activeItemId, onNavigate, userProfile, onSignOut, onOpenAuth, t, isOpen, onClose, candidateSidebar }) => {
  const { resolvedMode } = useRebuildTheme();
  const candidateLight = resolvedMode === 'light';
  const candidateSidebarSurface = candidateLight
    ? 'bg-[color:var(--dashboard-sidebar-bg)]'
    : 'bg-[color:var(--dashboard-sidebar-bg)]';

  return (
    <aside className={cn(
      'fixed inset-y-0 left-0 z-40 h-screen w-[232px] overflow-hidden transition-transform duration-300 ease-in-out lg:flex lg:translate-x-0',
      userRole === 'recruiter'
        ? 'bg-[color:var(--dashboard-page-bg)]'
        : candidateSidebarSurface,
      isOpen ? 'translate-x-0 flex' : '-translate-x-full hidden lg:flex',
    )}>
      <div className="flex h-full min-h-0 flex-col">
        <div className={cn(
          'flex items-center justify-between px-3.5 pb-4 pt-5',
        )}>
          <button type="button" onClick={() => onNavigate(navItems[0]?.id, navItems[0]?.path)} className="text-left outline-none">
            <BrandMark subtitle={userRole === 'recruiter' ? undefined : undefined} compact />
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

        <div className="flex-1 overflow-y-auto px-2 py-3.5">
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
                    'flex w-full items-center justify-between rounded-[16px] px-3.5 py-3 text-[15px] font-medium transition-all duration-200 outline-none',
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

        <div className="p-3.5">
          {userRole === 'recruiter' && (
            <>
              <button type="button" onClick={() => onNavigate('assistant', '/recruiter/assistant')} className="flex w-full items-center gap-3 rounded-[18px] bg-white/72 px-4 py-4 text-sm font-medium text-[color:var(--dashboard-text-body)] shadow-[0_14px_38px_-34px_rgba(15,23,42,0.24)] transition hover:bg-white">
                <img src="/shami.png" alt="Shami" className="h-9 w-9 object-contain rounded-lg shadow-sm" />
                <div className="flex flex-col items-start">
                  <span>{t('rebuild.nav.ai_guide', { defaultValue: 'Ask Shami' })}</span>
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
            <div className="space-y-2.5">
              <div className={cn(
                'rounded-[18px] border p-3.5',
                candidateLight ? 'border-slate-100 bg-white shadow-[0_16px_38px_-32px_rgba(15,23,42,0.3)]' : 'border-white/10 bg-white/[0.04]',
              )}>
                <div className={cn('text-[12px] font-black', candidateLight ? 'text-slate-900' : 'text-white')}>
                  {t('rebuild.sidebar.your_slots', { defaultValue: 'Tvé sloty' })}
                </div>
                <div className={cn('mt-2 flex items-end gap-1', candidateLight ? 'text-slate-950' : 'text-white')}>
                  <span className="text-[30px] font-black leading-none">{candidateSidebar?.slotsRemaining ?? 0}</span>
                  <span className="pb-1 text-[12px] font-bold text-slate-400">/ {candidateSidebar?.slotsLimit ?? 5}</span>
                </div>
                <div className="mt-3 flex gap-1.5">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <span
                      key={index}
                      className={cn(
                        'h-2.5 flex-1 rounded-full',
                        index < Math.min(5, candidateSidebar?.slotsRemaining ?? 0)
                          ? 'bg-[#0f95ac]'
                          : candidateLight ? 'bg-slate-200' : 'bg-white/12',
                      )}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={candidateSidebar?.onRedeemSlot}
                  disabled={!candidateSidebar?.onRedeemSlot || Boolean(candidateSidebar?.redeemingSlot) || (candidateSidebar?.karmaBalance ?? 0) < (candidateSidebar?.nextSlotCost ?? 250)}
                  className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#0f95ac] px-3 text-[12px] font-black text-white shadow-[0_12px_24px_-18px_rgba(15,149,172,0.7)] transition hover:bg-[#087f95] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                >
                  <Zap size={14} />
                  {candidateSidebar?.redeemingSlot
                    ? t('rebuild.sidebar.redeeming_slot', { defaultValue: 'Měním...' })
                    : t('rebuild.sidebar.get_next_slot', { defaultValue: 'Získat další slot' })}
                </button>
                <div className={cn('mt-2 text-[11px] font-semibold', candidateLight ? 'text-slate-500' : 'text-white/55')}>
                  {t('rebuild.sidebar.karma_progress', {
                    defaultValue: '{{balance}} / {{cost}} Karma',
                    balance: candidateSidebar?.karmaBalance ?? 0,
                    cost: candidateSidebar?.nextSlotCost ?? 250,
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={candidateSidebar?.onOpenReferral}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[18px] border px-3 py-2.5 text-left transition hover:-translate-y-0.5',
                  candidateLight ? 'border-slate-100 bg-white shadow-[0_14px_30px_-28px_rgba(15,23,42,0.28)] hover:border-[#12afcb]/30' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]',
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef8fb] text-[#0f95ac]">
                  <Gift size={18} />
                </span>
                <span className="min-w-0">
                  <span className={cn('block truncate text-[12px] font-black', candidateLight ? 'text-slate-950' : 'text-white')}>
                    {t('rebuild.sidebar.refer_company', { defaultValue: 'Doporuč nám firmu' })}
                  </span>
                  <span className={cn('mt-0.5 block truncate text-[10px] font-semibold', candidateLight ? 'text-slate-500' : 'text-white/55')}>
                    {t('rebuild.sidebar.referral_reward', { defaultValue: 'Získej 100 Karma po ověření' })}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('mentor', '/candidate/insights#mentor')}
                className={cn(
                  'group relative flex w-full items-center gap-2 overflow-hidden rounded-[20px] px-3 py-2.5 text-left transition duration-300',
                  candidateLight
                    ? 'border border-[#cceff4] bg-white shadow-[0_20px_48px_-32px_rgba(20,141,160,0.42)] ring-1 ring-[#12afcb]/10 hover:-translate-y-0.5 hover:border-[#12afcb]/45 hover:shadow-[0_28px_58px_-34px_rgba(20,141,160,0.58)]'
                    : 'border border-[#12afcb]/35 bg-white/[0.06] shadow-[0_18px_44px_-30px_rgba(18,175,203,0.45)] hover:-translate-y-0.5 hover:bg-white/[0.09]',
                )}
              >
                <div aria-hidden className={cn(
                  'pointer-events-none absolute inset-x-0 top-0 h-1',
                  candidateLight
                    ? 'bg-[#12afcb]'
                    : 'bg-[#37c7e2]',
                )} />
                <div className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[18px]">
                  <div className="absolute inset-0 rounded-[16px]" />
                  <div className={cn(
                    'absolute inset-0 rounded-[20px]',
                    candidateLight
                      ? 'bg-[#e9fbfd] shadow-[0_18px_30px_-22px_rgba(20,141,160,0.5)] ring-1 ring-[#12afcb]/18'
                      : 'bg-[#12afcb]/12 shadow-[0_18px_34px_-20px_rgba(4,10,22,0.62)] ring-1 ring-white/10',
                  )} />
                  <img src="/shami.png" alt="Shami" className="relative h-9 w-9 object-contain rounded-xl shadow-sm transition duration-300 group-hover:scale-105" />
                </div>
                <div className="relative min-w-0">
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]',
                      candidateLight ? 'bg-[#e8f8fb] text-[#087f95]' : 'bg-[#12afcb]/16 text-[#7ce8ff]',
                    )}>
                      <Sparkles size={10} /> Shami
                    </span>
                  </div>
                  <div className={cn('pr-7 text-[15px] font-bold leading-5', candidateLight ? 'text-[color:var(--shell-text-primary)]' : 'text-white')}>
                    {t('rebuild.nav.chat_with_shaman', { defaultValue: 'Chat with Shami' })}
                  </div>
                  <div className={cn('mt-1 max-h-10 overflow-hidden text-[11px] leading-4', candidateLight ? 'text-[color:var(--dashboard-text-muted)]' : 'text-white/62')}>
                    {t('rebuild.nav.shami_profile_hint', { defaultValue: 'Pomůže doplnit profil a vybrat další krok.' })}
                  </div>
                  <div className={cn(
                    'absolute right-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full transition-transform duration-300 group-hover:-translate-y-[55%] group-hover:translate-x-0.5',
                    candidateLight ? 'bg-[#12afcb] text-white shadow-[0_14px_24px_-18px_rgba(18,175,203,0.7)]' : 'bg-white/10 text-white/72',
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
