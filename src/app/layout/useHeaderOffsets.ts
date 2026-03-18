import { useEffect } from 'react';

export const useHeaderOffsets = (): void => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const headerEl = document.querySelector('header');
    if (!headerEl || typeof ResizeObserver !== 'function') return;

    const root = document.documentElement;
    const setOffsets = () => {
      const rect = headerEl.getBoundingClientRect();
      const height = Math.max(56, Math.round(rect.height || 0));
      root.style.setProperty('--app-header-height', `${height}px`);
      root.style.setProperty('--app-header-offset', `${height}px`);
      root.style.setProperty('--app-toolbar-offset', `${height + 40}px`);
    };

    const observer = new ResizeObserver(() => setOffsets());
    observer.observe(headerEl);
    setOffsets();
    window.addEventListener('resize', setOffsets, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', setOffsets);
    };
  }, []);
};

export default useHeaderOffsets;
