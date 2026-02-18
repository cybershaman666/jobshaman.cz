const normalizeText = (value: string): string => {
    if (!value) return '';
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
};

const ICO_PATTERNS = [
    /\bico\b/,
    /\bosvc\b/,
    /\bszco\b/,
    /\bb2b\b/,
    /\bfreiberuf\b/,
    /\bgewerbe\b/,
    /\bselbst\b/,
    /\bselbstandig\b/,
    /\bzivnostensk/,
    /\bzivnost/,
    /\bfreelanc/,
    /\bcontractor\b/,
    /\bkontraktor\b/,
    /\bself[- ]employed\b/,
    /\bdzialalnosc\b/,
    /\bgospodarcza\b/,
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

const FULL_TIME_PATTERNS = [
    /\bhpp\b/,
    /\bplny\s+uvazek\b/,
    /\bplny\s+pracovn/i,
    /\bpracovni\s+pomer\b/,
    /\bpracovny\s+pomer\b/,
    /\bfull[- ]?time\b/,
    /\bfulltime\b/,
    /\bvollzeit\b/,
    /\bumowa\s+o\s+prace\b/,
    /\bpelny\s+etat\b/
];

const PART_TIME_PATTERNS = [
    /\bpart[- ]?time\b/,
    /\bteilzeit\b/,
    /\bzkracen/i,
    /\bskracen/i,
    /\bcastecn/i,
    /\bskrat/i,
    /\bpolovicn/i,
    /\bniepelny\s+etat\b/,
    /\bczesc\s+etatu\b/
];

const BRIGADA_PATTERNS = [
    /\bbrigad/i,
    /\bdpp\b/,
    /\bdpc\b/,
    /\bdohod/i,
    /\bminijob\b/,
    /\baushilfe\b/,
    /\bumowa\s+zlecenie\b/,
    /\bumowa\s+o\s+dzielo\b/,
    /\btemporary\b/,
    /\btemp\b/,
    /\bseasonal\b/,
    /\bcasual\b/
];

const matchesPatterns = (
    patterns: RegExp[],
    values: Array<string | undefined | null>
): boolean => {
    for (const value of values) {
        const normalized = normalizeText(value ? String(value) : '');
        if (!normalized) continue;
        for (const pattern of patterns) {
            if (pattern.test(normalized)) return true;
        }
    }
    return false;
};

export const matchesFullTimeKeywords = (...values: Array<string | undefined | null>): boolean =>
    matchesPatterns(FULL_TIME_PATTERNS, values);

export const matchesPartTimeKeywords = (...values: Array<string | undefined | null>): boolean =>
    matchesPatterns(PART_TIME_PATTERNS, values);

export const matchesBrigadaKeywords = (...values: Array<string | undefined | null>): boolean =>
    matchesPatterns(BRIGADA_PATTERNS, values);
