import { PRODUCTION_LOCALE_CODES, isProductionLocale } from '../i18nLocales';

export const SUPPORTED_APP_LOCALES = PRODUCTION_LOCALE_CODES;

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

export const resolvePreferredLocale = (fallback: string = 'cs'): string => {
    if (typeof window === 'undefined') return fallback;

    const normalizeLocaleCandidate = (raw: string | null | undefined): string | null => {
        const value = String(raw || '').trim().toLowerCase();
        if (!value) return null;

        const [languagePart] = value.replace('_', '-').split('-');

        if (isProductionLocale(languagePart)) {
            return languagePart;
        }

        return null;
    };

    const navigatorCandidates = [
        ...(Array.isArray(window.navigator.languages) ? window.navigator.languages : []),
        window.navigator.language,
    ];

    for (const candidate of navigatorCandidates) {
        const normalized = normalizeLocaleCandidate(candidate);
        if (normalized && SUPPORTED_APP_LOCALES.includes(normalized as (typeof SUPPORTED_APP_LOCALES)[number])) {
            return normalized;
        }
    }

    try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (timezone === 'Europe/Prague') return 'cs';
    } catch {
        // Ignore timezone lookup failures and fall back to the provided locale.
    }

    return fallback;
};

export const isExternalStandalonePath = (normalizedPath: string): boolean => {
    return normalizedPath === '/podminky-uziti'
        || normalizedPath === '/terms'
        || normalizedPath === '/ochrana-osobnich-udaju'
        || normalizedPath === '/privacy-policy'
        || normalizedPath === '/admin'
        || normalizedPath === '/digest';
};
