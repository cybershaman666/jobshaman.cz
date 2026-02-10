const normalizeText = (value: string): string => {
    if (!value) return '';
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

const ICO_KEYWORDS = [
    'ico',
    'osvc',
    'szco',
    'zivnost',
    'zivnostensk',
    'freelanc',
    'b2b',
    'contractor',
    'kontraktor',
    'self employed',
    'self-employed',
    'fakturac',
    'gig economy'
];

export const matchesIcoKeywords = (...values: Array<string | undefined | null>): boolean => {
    for (const value of values) {
        const normalized = normalizeText(value ? String(value) : '');
        if (!normalized) continue;
        for (const keyword of ICO_KEYWORDS) {
            if (normalized.includes(keyword)) return true;
        }
    }
    return false;
};
