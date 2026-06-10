import React from 'react';
import { cn } from '../cn';
import { BrandMark, ThemeToggle } from './RebuildChrome';
import { LogOut, HelpCircle, LogIn, Gift, Zap, Star } from 'lucide-react';
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

const KarmaBar: React.FC<{ balance: number; maxKarma: number; className?: string }> = ({ balance, maxKarma, className }) => {
  const pct = Math.min(100, Math.max(0, (balance / maxKarma) * 100));
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#12afcb] to-[#0f95ac] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">{balance}/{maxKarma}</span>
    </div>
  );
};

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
          'flex items-center justify-center px-3.5 pb-3 pt-5',
        )}>
          <button type="button" onClick={() => onNavigate(navItems[0]?.id, navItems[0]?.path)} className="text-center outline-none">
            <BrandMark subtitle={userRole === 'recruiter' ? undefined : undefined} compact={false} />
          </button>
          
          {/* Close button for mobile */}
          <button 
            type="button" 
            onClick={onClose}
            className="absolute right-3 top-5 flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-black/5 lg:hidden"
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
              {/* Slots card */}
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
                <div className="mt-3 flex gap-1.5" title={t('rebuild.sidebar.slots_used', { defaultValue: 'Použité sloty' })}>
                  {Array.from({ length: candidateSidebar?.slotsLimit ?? 5 }).map((_, index) => {
                    const slotsRemaining = candidateSidebar?.slotsRemaining ?? candidateSidebar?.slotsLimit ?? 5;
                    const isUsed = index >= slotsRemaining;
                    return (
                      <span
                        key={index}
                        className={cn(
                          'h-2.5 flex-1 rounded-full transition-colors duration-300',
                          isUsed
                            ? candidateLight ? 'bg-slate-200' : 'bg-white/12'
                            : 'bg-[#0f95ac]',
                        )}
                      />
                    );
                  })}
                </div>

                {/* Redeem slot button */}
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

                {/* Karma progress bar */}
                <div className="mt-2.5">
                  <div className="flex items-center gap-1 mb-1">
                    <Star size={11} className={cn('shrink-0', candidateLight ? 'text-amber-500' : 'text-amber-400')} />
                    <span className={cn('text-[10px] font-bold', candidateLight ? 'text-slate-500' : 'text-slate-400')}>
                      {t('rebuild.sidebar.karma_progress', {
                        defaultValue: '{{balance}} / {{cost}} Karma',
                        balance: candidateSidebar?.karmaBalance ?? 0,
                        cost: candidateSidebar?.nextSlotCost ?? 250,
                      })}
                    </span>
                  </div>
                  <KarmaBar balance={candidateSidebar?.karmaBalance ?? 0} maxKarma={candidateSidebar?.nextSlotCost ?? 250} />
                </div>
              </div>

              {/* Referral button */}
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

              {/* Theme toggle */}
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