import { useState, useEffect } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type ThemeResolved = 'light' | 'dark';

const getSystemTheme = (): ThemeResolved => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function useAppTheme() {
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
        if (typeof window === 'undefined') return 'system';
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
        return 'system';
    });

    const [theme, setTheme] = useState<ThemeResolved>(() => {
        if (typeof window === 'undefined') return 'light';
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark') return stored;
        return getSystemTheme();
    });

    // Sync theme to system preference when mode is 'system'
    useEffect(() => {
        if (themeMode !== 'system' || typeof window === 'undefined') return;
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => setTheme(getSystemTheme());
        media.addEventListener('change', handler);
        return () => media.removeEventListener('change', handler);
    }, [themeMode]);

    // Apply theme to DOM and persist
    useEffect(() => {
        const resolved = themeMode === 'system' ? getSystemTheme() : themeMode;
        setTheme(resolved);
        document.documentElement.classList.toggle('dark', resolved === 'dark');
        localStorage.setItem('theme', themeMode);
    }, [themeMode]);

    return { themeMode, setThemeMode, theme };
}
