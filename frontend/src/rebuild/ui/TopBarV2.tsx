import React from 'react';
import { cn } from '../cn';
import { Bell, Plus, Search, UserCircle2, ChevronDown, LogOut, Building2, Globe } from 'lucide-react';
import { UserProfile } from '../../types';
import { useRebuildTheme } from './rebuildTheme';
import { NotificationDropdown } from './NotificationDropdown';
import { notificationService, Notification } from '../../services/notificationService';

export const TopBarV2: React.FC<{
  userRole: 'candidate' | 'recruiter';
  title?: string;
  subtitle?: string;
  userProfile: UserProfile;
  searchValue: string;
  onSearchChange: (val: string) => void;
  actionRegion?: React.ReactNode;
  onActionClick?: () => void;
  onProfileClick?: () => void;
  onSignOut?: () => void;
  onCompanySwitch?: () => void;
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
}> = ({
  userRole,
  title,
  subtitle,
  userProfile,
  searchValue,
  onSearchChange,
  actionRegion,
  onActionClick,
  onProfileClick,
  onSignOut,
  onCompanySwitch,
  currentLanguage,
  onLanguageChange,
  t,
}) => {
  const { resolvedMode } = useRebuildTheme();
  const candidateLight = resolvedMode === 'light';
  
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isLangOpen, setIsLangOpen] = React.useState(false);

  const languages = [
    { code: 'cs', label: 'CZ', flag: '🇨🇿' },
    { code: 'en', label: 'EN', flag: '🇬🇧' },
    { code: 'de', label: 'DE', flag: '🇩🇪' },
    { code: 'pl', label: 'PL', flag: '🇵🇱' },
    { code: 'sk', label: 'SK', flag: '🇸🇰' },
    { code: 'fi', label: 'FI', flag: '🇫🇮' },
    { code: 'sv', label: 'SV', flag: '🇸🇪' },
    { code: 'no', label: 'NO', flag: '🇳🇴' },
    { code: 'da', label: 'DA', flag: '🇩🇰' },
  ];

  React.useEffect(() => {
    if (userProfile.isLoggedIn && userProfile.id) {
      const checkNotifications = async () => {
        try {
          const data = await notificationService.listNotifications(userProfile.id);
          setUnreadCount(data.filter(n => !n.isRead).length);
        } catch (err) {
          console.warn('Failed to fetch notifications', err);
        }
      };
      checkNotifications();
      const interval = setInterval(checkNotifications, 60000); // Poll every minute
      return () => clearInterval(interval);
    }
  }, [userProfile.id, userProfile.isLoggedIn]);

  return (
    <header className={cn(
      'z-30 w-full shrink-0 transition-all duration-300',
      userRole === 'recruiter' 
        ? 'border-b border-[#e8e3d9] bg-[#fbfaf7]' 
        : candidateLight
          ? 'bg-white border-b border-slate-100'
          : 'bg-[#0a0d12] border-b border-white/5',
    )}>
      <div className={cn(
        "flex items-center justify-between px-4 sm:px-6",
        userRole === 'candidate' ? "h-16" : "h-14"
      )}>
        {/* Left side: Navigation or Context */}
        <div className="flex flex-1 items-center gap-4">
          {userRole === 'recruiter' ? (
             <div className="relative w-full max-w-md">
               <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
               <input
                 type="text"
                 placeholder={t('rebuild.search.placeholder', { defaultValue: 'Search candidates, roles...' })}
                 className="h-9 w-full rounded-full border border-slate-100 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-blue-200 focus:ring-4 focus:ring-blue-50/50"
                 value={searchValue}
                 onChange={(e) => onSearchChange(e.target.value)}
               />
             </div>
          ) : (
            <div className="flex flex-col">
              {title && <h1 className={cn('text-[18px] font-black leading-tight', candidateLight ? 'text-slate-800' : 'text-white')}>{title}</h1>}
              {subtitle && <p className={cn('text-[12px] font-medium opacity-60', candidateLight ? 'text-slate-500' : 'text-white/60')}>{subtitle}</p>}
            </div>
          )}
        </div>

        {/* Right side: Actions */}
        <div className="flex items-center gap-3">
          {userRole === 'recruiter' ? (
            <>
              {actionRegion}
              <button 
                onClick={onActionClick}
                className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-bold !text-white shadow-[0_12px_28px_-12px_rgba(37,99,235,0.4)] transition hover:bg-blue-700"
              >
                <Plus size={16} />
                {t('rebuild.recruiter.new_problem', { defaultValue: 'New problem' })}
              </button>
              <div className="relative">
                <button 
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-400 shadow-sm transition hover:bg-slate-50"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <NotificationDropdown 
                  userId={userProfile.id} 
                  isOpen={isNotifOpen} 
                  onClose={() => setIsNotifOpen(false)} 
                />
              </div>
              <button onClick={onProfileClick} className="flex items-center gap-3 rounded-full border border-slate-100 bg-white p-1 shadow-sm transition hover:bg-slate-50">
                {userProfile.photo ? (
                  <img src={userProfile.photo} className="h-8 w-8 rounded-full object-cover" alt="" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <UserCircle2 size={18} />
                  </div>
                )}
                <ChevronDown size={14} className="mr-2 text-slate-400" />
              </button>
              {userProfile.isLoggedIn && onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  title={t('rebuild.nav.sign_out', { defaultValue: 'Sign out' })}
                  aria-label={t('rebuild.nav.sign_out', { defaultValue: 'Sign out' })}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <LogOut size={17} />
                </button>
              ) : null}
            </>
          ) : (() => {
            const baseLang = currentLanguage?.substring(0, 2).toLowerCase() || 'cs';
            const currentLangOption = languages.find(l => l.code === baseLang) || languages[0];
            return (
            <>
              <div className="relative">
                <button
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className={cn(
                    'flex h-9 items-center gap-2 rounded-full px-3 text-[13px] font-bold transition shadow-sm',
                    candidateLight
                      ? 'border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] text-[color:var(--shell-text-muted)] hover:bg-[color:var(--shell-button-secondary-hover)]'
                      : 'border border-white/10 bg-white/5 text-white/72 hover:bg-white/10',
                  )}
                >
                  <span className="text-[15px]">{currentLangOption.flag}</span>
                  {currentLangOption.code.toUpperCase()}
                </button>
                {isLangOpen && (
                  <div className={cn(
                    "absolute right-0 mt-2 w-32 overflow-hidden rounded-2xl border shadow-2xl animate-in fade-in zoom-in-95 duration-200 z-50",
                    candidateLight ? "bg-white border-slate-200" : "bg-[#0d1117] border-slate-800"
                  )}>
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          onLanguageChange(lang.code);
                          setIsLangOpen(false);
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold transition',
                          baseLang === lang.code 
                            ? 'text-[#12afcb] bg-[#12afcb]/5' 
                            : candidateLight ? 'text-slate-600 hover:bg-slate-50' : 'text-white/60 hover:bg-white/5'
                        )}
                      >
                        <span className="text-[16px]">{lang.flag}</span>
                        {lang.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {actionRegion}
              {userProfile.isLoggedIn && onCompanySwitch ? (
                <button
                  type="button"
                  onClick={onCompanySwitch}
                  className={cn(
                    'hidden items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition shadow-sm sm:flex',
                    candidateLight
                      ? 'border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] text-[color:var(--shell-text-primary)] hover:bg-[color:var(--shell-button-secondary-hover)]'
                      : 'border border-white/10 bg-white/5 text-white/82 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Building2 size={16} />
                  {t('rebuild.nav.company', { defaultValue: 'Company' })}
                </button>
              ) : null}
              <div className="relative">
                <button 
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full transition shadow-sm',
                    candidateLight
                      ? 'border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] text-[color:var(--shell-text-muted)] hover:bg-[color:var(--shell-button-secondary-hover)]'
                      : 'border border-white/10 bg-white/5 text-white/72 hover:bg-white/10',
                  )}
                >
                  <Bell size={16} />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-[#0a0d12]">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <NotificationDropdown 
                  userId={userProfile.id} 
                  isOpen={isNotifOpen} 
                  onClose={() => setIsNotifOpen(false)} 
                />
              </div>
              {userProfile.isLoggedIn && onCompanySwitch ? (
                <button
                  type="button"
                  onClick={onCompanySwitch}
                  title={t('rebuild.nav.company_profile', { defaultValue: 'Company profile' })}
                  aria-label={t('rebuild.nav.company_profile', { defaultValue: 'Company profile' })}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full transition shadow-sm sm:hidden',
                    candidateLight
                      ? 'border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] text-[color:var(--shell-text-muted)] hover:bg-[color:var(--shell-button-secondary-hover)] hover:text-[color:var(--shell-text-primary)]'
                      : 'border border-white/10 bg-white/5 text-white/72 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Building2 size={16} />
                </button>
              ) : null}
              <button onClick={onProfileClick} className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full transition shadow-sm p-0.5',
                candidateLight
                  ? 'border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)]'
                  : 'border border-white/10 bg-white/5',
              )}>
                {userProfile.photo ? (
                  <img src={userProfile.photo} className="h-full w-full rounded-full object-cover" alt="" />
                ) : (
                  <UserCircle2 size={18} className={candidateLight ? 'text-slate-400' : 'text-white/40'} />
                )}
              </button>
              {userProfile.isLoggedIn && onSignOut ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  title={t('rebuild.nav.sign_out', { defaultValue: 'Sign out' })}
                  aria-label={t('rebuild.nav.sign_out', { defaultValue: 'Sign out' })}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full transition shadow-sm',
                    candidateLight
                      ? 'border border-[color:var(--shell-button-secondary-border)] bg-[color:var(--shell-button-secondary-bg)] text-[color:var(--shell-text-muted)] hover:bg-[color:var(--shell-button-secondary-hover)] hover:text-[color:var(--shell-text-primary)]'
                      : 'border border-white/10 bg-white/5 text-white/72 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <LogOut size={16} />
                </button>
              ) : null}
            </>
          ); })()}
        </div>
      </div>
    </header>
  );
};
