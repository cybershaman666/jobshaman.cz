import React from 'react';

import { cn } from '../../../components/ui/primitives';

interface AppViewportShellProps {
  isImmersive: boolean;
  theme: 'light' | 'dark';
  usePageScrollLayout: boolean;
  header?: React.ReactNode;
  banner?: React.ReactNode;
  scene: React.ReactNode;
  footer?: React.ReactNode;
  floatingAction?: React.ReactNode;
  overlays?: React.ReactNode;
}

const AppViewportShell: React.FC<AppViewportShellProps> = ({
  isImmersive,
  theme,
  usePageScrollLayout,
  header,
  banner,
  scene,
  footer,
  floatingAction,
  overlays,
}) => {
  return (
    <div className={`flex min-h-screen flex-col ${isImmersive ? (theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900') : 'app-shell-bg app-aurora-shell text-[var(--text)] dark:text-[var(--text)]'} font-sans transition-colors duration-300`}>
      {header}
      {banner}

      <div className="flex flex-1 relative overflow-hidden">
        <main
          id="app-viewport"
          className={cn(
            'flex w-full flex-col min-h-[calc(100vh-var(--app-header-height))]',
            usePageScrollLayout ? 'h-auto' : 'h-[calc(100vh-var(--app-header-height))] overflow-hidden'
          )}
        >
          <div className="flex-1 flex flex-col relative overflow-y-auto">
            {scene}
            {footer}
          </div>
        </main>
      </div>

      {floatingAction}
      {overlays}
    </div>
  );
};

export default AppViewportShell;
