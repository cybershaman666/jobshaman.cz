import React from 'react';
import { cn } from '../cn';
import { NavItem, SidebarV2 } from './SidebarV2';
import { TopBarV2 } from './TopBarV2';
import { UserProfile } from '../../types';
import { useRebuildTheme } from './rebuildTheme';

export const DashboardLayoutV2: React.FC<{
  userRole: 'candidate' | 'recruiter';
  navItems: NavItem[];
  activeItemId: string;
  onNavigate: (id: string, path?: string) => void;
  userProfile: UserProfile;
  onSignOut?: () => void;
  onOpenAuth?: (intent: 'candidate' | 'recruiter') => void;
  onCompanySwitch?: () => void;
  title?: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  actionRegion?: React.ReactNode;
  onPrimaryActionClick?: () => void;
  contentClassName?: string;
  children: React.ReactNode;
  currentLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
}> = ({
  userRole,
  navItems,
  activeItemId,
  onNavigate,
  userProfile,
  onSignOut,
  onOpenAuth,
  onCompanySwitch,
  title,
  subtitle,
  searchValue,
  onSearchChange,
  actionRegion,
  onPrimaryActionClick,
  contentClassName,
  children,
  currentLanguage = 'cs',
  onLanguageChange = () => {},
  t
}) => {
  const { resolvedMode } = useRebuildTheme();
  const candidateLight = resolvedMode === 'light';

  return (
    <div className={cn(
      'flex min-h-screen w-full overflow-hidden font-sans transition-colors duration-300',
      'bg-[color:var(--bg)]'
    )}>
      <SidebarV2
        userRole={userRole}
        navItems={navItems}
        activeItemId={activeItemId}
        onNavigate={onNavigate}
        userProfile={userProfile}
        onSignOut={onSignOut}
        onOpenAuth={onOpenAuth}
        t={t}
      />

      <div className="flex flex-1 flex-col overflow-hidden lg:pl-[248px]">
        <TopBarV2
          userRole={userRole}
          title={title}
          subtitle={subtitle}
          userProfile={userProfile}
          searchValue={searchValue || ''}
          onSearchChange={onSearchChange || (() => {})}
          actionRegion={actionRegion}
          onActionClick={onPrimaryActionClick}
          onSignOut={onSignOut}
          onCompanySwitch={onCompanySwitch}
          currentLanguage={currentLanguage}
          onLanguageChange={onLanguageChange}
          t={t}
        />
        <main className={cn(
          'relative flex-1 overflow-y-auto px-2 pb-3 sm:px-3 lg:px-4',
          userRole === 'candidate' && 'pt-1',
        )}>
          {/* Background is now clean and unified */}
          <div className={cn(
            'mx-auto w-full',
            userRole === 'candidate' ? 'max-w-[1500px]' : 'max-w-[1320px]',
            contentClassName,
          )}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
