const normalizeText = (value: string): string => {
    if (!value) return '';
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

const ICO_PATTERNS = [
    /\bico\b/,
    /\bosvc\b/,
    /\bszco\b/,
    /\bb2b\b/,
    /\bzivnostensk/,
    /\bzivnost/,
    /\bfreelanc/,
    /\bcontractor\b/,
    /\bkontraktor\b/,
    /\bself[- ]employed\b/,
    /\bfakturac/,
    /\bgig economy\b/
];

export const matchesIcoKeywords = (...values: Array<string | undefined | null>): boolean => {
    for (const value of values) {
        const normalized = normalizeText(value ? String(value) : '');
        if (!normalized) continue;
        for (const pattern of ICO_PATTERNS) {
            if (pattern.test(normalized)) return true;
        }
    }
    return false;
};
