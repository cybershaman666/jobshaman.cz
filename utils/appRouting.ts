export const SUPPORTED_APP_LOCALES = ['cs', 'en', 'de', 'pl', 'sk', 'at'] as const;

export const getPathPartsWithoutLocale = (pathname: string): string[] => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length > 0 && SUPPORTED_APP_LOCALES.includes(parts[0] as (typeof SUPPORTED_APP_LOCALES)[number])) {
        parts.shift();
    }
    return parts;
};

export const getNormalizedAppPath = (pathname: string): string => {
    return `/${getPathPartsWithoutLocale(pathname).join('/')}`;
};

export const getLocaleFromPathname = (pathname: string, fallback: string = 'cs'): string => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length > 0 && SUPPORTED_APP_LOCALES.includes(parts[0] as (typeof SUPPORTED_APP_LOCALES)[number])) {
        return parts[0];
    }
    return fallback;
};

export const isExternalStandalonePath = (normalizedPath: string): boolean => {
    return normalizedPath === '/podminky-uziti'
        || normalizedPath === '/ochrana-osobnich-udaju'
        || normalizedPath === '/enterprise'
        || normalizedPath.startsWith('/assessment')
        || normalizedPath === '/demo-handshake'
        || normalizedPath === '/demo-company-handshake'
        || normalizedPath === '/admin'
        || normalizedPath === '/digest';
};
