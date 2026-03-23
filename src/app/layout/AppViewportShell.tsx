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
  const [atmosphereSrc, setAtmosphereSrc] = React.useState<string | null>(null);
  const [atmosphereOpacity, setAtmosphereOpacity] = React.useState(0);
  const [atmosphereBlur, setAtmosphereBlur] = React.useState(96);
  const visibleAtmosphereBlur = Math.max(16, atmosphereBlur * 0.24);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const parseUrlValue = (value: string): string | null => {
      const normalized = String(value || '').trim();
      if (!normalized || normalized === 'none') return null;
      const match = normalized.match(/^url\((['"]?)(.*)\1\)$/);
      return match?.[2] || null;
    };

    const syncAtmosphere = () => {
      const styles = window.getComputedStyle(document.documentElement);
      const src = parseUrlValue(styles.getPropertyValue('--app-atmosphere-image'));
      const opacity = Number.parseFloat(styles.getPropertyValue('--app-atmosphere-opacity')) || 0;
      const blur = Number.parseFloat(styles.getPropertyValue('--app-atmosphere-blur')) || 96;
      setAtmosphereSrc(src);
      setAtmosphereOpacity(opacity);
      setAtmosphereBlur(blur);
    };

    syncAtmosphere();

    const observer = new MutationObserver(syncAtmosphere);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        'flex min-h-screen flex-col overflow-x-clip font-sans text-[var(--text)] transition-colors duration-[var(--motion-enter)]',
        isImmersive ? 'app-mr-shell app-immersive-shell' : 'app-mr-shell app-shell-bg app-shell-bg-clean'
      )}
    >
      {atmosphereSrc ? (
        <div aria-hidden className="app-shell-atmosphere-layer">
          <img
            src={atmosphereSrc}
            alt=""
            className="app-shell-atmosphere-image"
            style={{
              opacity: atmosphereOpacity,
              filter: `blur(${visibleAtmosphereBlur}px) saturate(1.08) contrast(1.08) brightness(1)`,
            }}
          />
        </div>
      ) : null}

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
