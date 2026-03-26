import React from 'react';

import { cn } from '../../../components/ui/primitives';

interface AppViewportShellProps {
  isImmersive: boolean;
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
  usePageScrollLayout,
  header,
  banner,
  scene,
  footer,
  floatingAction,
  overlays,
}) => {
  const hasHeader = Boolean(header);

  return (
    <div
      className={cn(
        'flex min-h-screen flex-col overflow-x-clip font-sans text-[var(--text)] transition-colors duration-[var(--motion-enter)]',
        isImmersive ? 'app-mr-shell app-immersive-shell' : 'app-mr-shell app-shell-bg app-shell-bg-clean'
      )}
    >
      {header}
      {banner}

      <div className="flex flex-1 relative overflow-hidden">
        <main
          id="app-viewport"
          className={cn(
            'flex w-full flex-col',
            hasHeader ? 'min-h-[calc(100vh-var(--app-header-height))]' : 'min-h-screen',
            usePageScrollLayout
              ? 'h-auto'
              : hasHeader
                ? 'h-[calc(100vh-var(--app-header-height))] overflow-hidden'
                : 'h-screen overflow-hidden'
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
