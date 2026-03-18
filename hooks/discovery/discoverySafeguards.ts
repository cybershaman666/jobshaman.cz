import { recordRuntimeSignal } from '../../services/runtimeSignals';
import type { Job, SearchDiagnosticsMeta } from '../../types';
import { expandCountryAliases, normalizeCountryCodes, sameCountryCodeSet } from '../useDiscoveryFilters';

export const getCountryCodeFromAddress = (address: string): string | null => {
    if (!address) return null;
    const loc = address.toLowerCase();
    if (loc.includes('canada') || loc.includes('toronto') || loc.includes('vancouver') || loc.includes('montreal')) return 'CA';
    if (loc.includes('united states') || loc.includes('usa') || loc.includes('new york') || loc.includes('california') || loc.includes('texas')) return 'US';
    if (loc.includes('united kingdom') || loc.includes('uk') || loc.includes('london') || loc.includes('manchester')) return 'GB';
    if (loc.includes('netherlands') || loc.includes('nederland') || loc.includes('amsterdam') || loc.includes('rotterdam')) return 'NL';
    if (loc.includes('france') || loc.includes('franc') || loc.includes('paris') || loc.includes('lyon')) return 'FR';
    if (loc.includes('spain') || loc.includes('espa') || loc.includes('madrid') || loc.includes('barcelona')) return 'ES';
    if (loc.includes('italy') || loc.includes('italia') || loc.includes('rome') || loc.includes('milan')) return 'IT';
    if (loc.includes('romania') || loc.includes('bucharest') || loc.includes('bucure')) return 'RO';
    if (loc.includes('hungary') || loc.includes('budapest')) return 'HU';
    if (loc.includes('slovak') || loc.includes('slovensk') || loc.includes('slovensko') || loc.includes('bratislava') || loc.includes('kosice')) return 'SK';
    if (loc.includes('polsk') || loc.includes('poland') || loc.includes('warszawa') || loc.includes('krakow') || loc.includes('wroclaw') || loc.includes('gda')) return 'PL';
    if (loc.includes('deutsch') || loc.includes('germany') || loc.includes('berlin') || loc.includes('münchen') || loc.includes('hamburg')) return 'DE';
    if (loc.includes('österreich') || loc.includes('austria') || loc.includes('wien') || loc.includes('vienna')) return 'AT';
    if (loc.includes('česk') || loc.includes('czech') || loc.includes('praha') || loc.includes('brno') || loc.includes('ostrava')) return 'CZ';
    return null;
};

const getCountryCodeFromJobSource = (job: Job): string | null => {
    const haystack = `${job.source || ''} ${job.url || ''}`.toLowerCase();
    if (!haystack.trim()) return null;
    if (haystack.includes('karriere.at')) return 'AT';
    if (haystack.includes('germantechjobs')) return 'DE';
    if (haystack.includes('stepstone.de')) return 'DE';
    if (haystack.includes('stepstone.at')) return 'AT';
    if (haystack.includes('pracuj.pl')) return 'PL';
    if (haystack.includes('profesia.sk')) return 'SK';
    if (haystack.includes('jobs.cz') || haystack.includes('prace.cz')) return 'CZ';
    return null;
};

export const getLogicalCountryCount = (codes: string[]): number => {
    const canonical = new Set(
        normalizeCountryCodes(codes).map((code) => (code === 'CS' ? 'CZ' : code))
    );
    return canonical.size;
};

export const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = (degrees: number) => degrees * (Math.PI / 180);
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
};

export const inferJobCountryCode = (job: Job): string | null => {
    const explicit = expandCountryAliases(job.country_code)[0];
    const fromLocation = getCountryCodeFromAddress(job.location || '');
    const fromSource = getCountryCodeFromJobSource(job);
    const contradictionSignal = fromLocation || fromSource;

    if (explicit && contradictionSignal && contradictionSignal !== explicit) {
        return contradictionSignal;
    }
    if (explicit) return explicit;
    if (fromLocation) return fromLocation;
    return fromSource;
};

export const inferJobLanguageCode = (job: Job): string | null => {
    const explicit = String(job.language_code || '').trim().toLowerCase();
    const scores = new Map<string, number>();
    const addScore = (code: string, score: number) => {
        if (!code || score <= 0) return;
        scores.set(code, (scores.get(code) || 0) + score);
    };

    if (explicit) {
        addScore(explicit, 1);
    }

    const haystack = `${job.source || ''} ${job.url || ''}`.toLowerCase();
    if (haystack.includes('jobs.cz') || haystack.includes('prace.cz')) addScore('cs', 4);
    if (haystack.includes('profesia.sk')) addScore('sk', 4);
    if (haystack.includes('pracuj.pl')) addScore('pl', 4);
    if (haystack.includes('karriere.at') || haystack.includes('stepstone.de') || haystack.includes('germantechjobs')) addScore('de', 4);

    const inferredCountry = inferJobCountryCode(job);
    if (inferredCountry === 'CZ') addScore('cs', 1);
    if (inferredCountry === 'SK') addScore('sk', 1);
    if (inferredCountry === 'PL') addScore('pl', 1);
    if (inferredCountry === 'DE' || inferredCountry === 'AT') addScore('de', 1);
    if (inferredCountry === 'US' || inferredCountry === 'GB') addScore('en', 1);

    const textHaystack = `${job.title || ''} ${job.description || ''} ${job.location || ''}`.toLowerCase();
    const scoreLanguage = (patterns: RegExp[]): number =>
        patterns.reduce((score, pattern) => score + (pattern.test(textHaystack) ? 1 : 0), 0);

    addScore('cs', scoreLanguage([
        /\b(práce|pozice|nástup|nabízíme|požadujeme|benefity|mzda|úvazek|praxe|kancelář|domova)\b/i,
        /[ěščřžýáíéúůťďň]/i,
        /\b(brno|praha|ostrava|plzeň|olomouc|pardubice|hradec králové|české budějovice)\b/i,
    ]));
    addScore('sk', scoreLanguage([
        /\b(práca|pozícia|nástup|ponúkame|požadujeme|benefity|mzda|úväzok|prax|kancelária|domu)\b/i,
        /\b(bratislava|košice|žilina|trnava|nitra|prešov|banská bystrica)\b/i,
    ]));
    addScore('pl', scoreLanguage([
        /\b(praca|stanowisko|oferujemy|wymagamy|benefity|wynagrodzenie|etat|biuro)\b/i,
        /[ąćęłńóśźż]/i,
        /\b(warszawa|kraków|wrocław|gdańsk|poznań|łódź)\b/i,
    ]));
    addScore('de', scoreLanguage([
        /\b(stelle|wir bieten|anforderungen|gehalt|vollzeit|teilzeit|büro|homeoffice)\b/i,
        /[äöüß]/i,
        /\b(wien|vienna|berlin|münchen|hamburg|graz|linz|salzburg)\b/i,
    ]));
    addScore('en', scoreLanguage([
        /\b(we offer|requirements|salary|benefits|full-time|part-time|remote|office)\b/i,
        /\b(london|new york|united states|united kingdom|usa|uk)\b/i,
    ]));

    const ranked = Array.from(scores.entries())
        .map(([code, score]) => ({ code, score }))
        .sort((left, right) => right.score - left.score);

    if (ranked[0]?.score && ranked[0].score >= 2) {
        if (ranked[1] && ranked[0].score === ranked[1].score) {
            return null;
        }
        return ranked[0].code;
    }

    return null;
};

export const getSourceMixCounts = (jobs: Job[]): NonNullable<SearchDiagnosticsMeta['source_mix']> => {
    return jobs.reduce<NonNullable<SearchDiagnosticsMeta['source_mix']>>((acc, job) => {
        const source = job.searchDiagnostics?.source || (job.listingKind === 'imported' ? 'cached_external' : 'native');
        acc[source] = (acc[source] || 0) + 1;
        return acc;
    }, {});
};

interface CreateDomesticCountrySafeguardArgs {
    countryCodes: string[];
    marketBaselineCountryCodes: string[];
    enableCommuteFilter: boolean;
    globalSearch: boolean;
    abroadOnly: boolean;
    filterLanguageCodes: string[];
}

export const createDomesticCountrySafeguard = ({
    countryCodes,
    marketBaselineCountryCodes,
    enableCommuteFilter,
    globalSearch,
    abroadOnly,
    filterLanguageCodes,
}: CreateDomesticCountrySafeguardArgs) => {
    return (list: Job[]) => {
        if (list.length === 0) {
            return list;
        }

        const normalizedCountryCodes = normalizeCountryCodes(countryCodes);
        const isDefaultCountrySelection = sameCountryCodeSet(
            normalizedCountryCodes,
            normalizeCountryCodes(marketBaselineCountryCodes)
        );

        const shouldAllowCrossBorderRadius =
            enableCommuteFilter &&
            !globalSearch &&
            !abroadOnly &&
            isDefaultCountrySelection;

        const allowedCountryCodes = (!globalSearch && !shouldAllowCrossBorderRadius && normalizedCountryCodes.length > 0)
            ? new Set(normalizedCountryCodes)
            : null;
        const allowedLanguageCodes = filterLanguageCodes.length > 0
            ? new Set(filterLanguageCodes.map((code) => String(code).trim().toLowerCase()))
            : null;
        const hasExplicitLanguageFilter = allowedLanguageCodes !== null;

        const safeguarded = list.filter((job) => {
            if (allowedCountryCodes) {
                const inferredCountry = inferJobCountryCode(job);
                if (!inferredCountry || !allowedCountryCodes.has(inferredCountry)) {
                    return false;
                }
            }

            if (allowedLanguageCodes) {
                const explicitLanguage = String(job.language_code || '').trim().toLowerCase();
                const resolvedLanguage = explicitLanguage || inferJobLanguageCode(job);
                if (!resolvedLanguage || !allowedLanguageCodes.has(resolvedLanguage)) {
                    return false;
                }
            }

            return true;
        });

        if (safeguarded.length === 0 && list.length > 0 && !hasExplicitLanguageFilter && !allowedCountryCodes) {
            recordRuntimeSignal('custom:domestic_safeguard_fail_open', {
                original_count: list.length,
                allowed_country_codes: allowedCountryCodes ? Array.from(allowedCountryCodes) : [],
                allowed_language_codes: allowedLanguageCodes ? Array.from(allowedLanguageCodes) : [],
            }, {
                dedupeKey: JSON.stringify({
                    originalCount: list.length,
                    countries: allowedCountryCodes ? Array.from(allowedCountryCodes) : [],
                    languages: allowedLanguageCodes ? Array.from(allowedLanguageCodes) : [],
                }),
                throttleMs: 30_000,
            });
            return list;
        }

        return safeguarded;
    };
};
