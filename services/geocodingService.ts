
import { supabase } from './supabaseClient';

// Static fallback cache for major cities (fastest entry point)
const EU_CITIES_CACHE: Record<string, { lat: number, lon: number }> = {
    'praha': { lat: 50.0755, lon: 14.4378 },
    'prague': { lat: 50.0755, lon: 14.4378 },
    'brno': { lat: 49.1951, lon: 16.6068 },
    'ostrava': { lat: 49.8209, lon: 18.2625 },
    'plzen': { lat: 49.7384, lon: 13.3736 },
    'liberec': { lat: 50.7663, lon: 15.0543 },
    'olomouc': { lat: 49.5938, lon: 17.2509 },
    'ceske budejovice': { lat: 48.9745, lon: 14.4743 },
    'hradec kralove': { lat: 50.2104, lon: 15.8252 },
    'ustinad labem': { lat: 50.6611, lon: 14.0520 },
    'pardubice': { lat: 50.0343, lon: 15.7812 },
    'zlin': { lat: 49.2242, lon: 17.6627 },
    'havirov': { lat: 49.7798, lon: 18.4369 },
    'kladno': { lat: 50.1473, lon: 14.1029 },
    'most': { lat: 50.5030, lon: 13.6362 },
    'opava': { lat: 49.9387, lon: 17.9026 },
    'frydek mistek': { lat: 49.6819, lon: 18.3673 },
    'karvina': { lat: 49.8540, lon: 18.5417 },
    'jihlava': { lat: 49.3961, lon: 15.5912 },
    'teplice': { lat: 50.6611, lon: 13.8245 },
    'decin': { lat: 50.7822, lon: 14.2148 },
    'karlovy vary': { lat: 50.2319, lon: 12.8720 },
    'chomutov': { lat: 50.4605, lon: 13.4178 },
    'jablonec nad nisou': { lat: 50.7243, lon: 15.1710 },
    'mlada boleslav': { lat: 50.4124, lon: 14.9056 },
    'prostejov': { lat: 49.4719, lon: 17.1128 },
    'popice': { lat: 48.9284, lon: 16.6664 },
    'hustopece': { lat: 48.9408, lon: 16.7378 },
    'mikulov': { lat: 48.8056, lon: 16.6378 },
    'breclav': { lat: 48.7590, lon: 16.8820 },
    'znojmo': { lat: 48.5567, lon: 16.0499 },
    'trebic': { lat: 49.2162, lon: 15.8717 },
    'telc': { lat: 49.1918, lon: 15.4539 },
    'dolni vltavice': { lat: 48.8978, lon: 14.2458 },
};

const CITY_COUNTRY_SUFFIXES = new Set([
    'cz', 'cr', 'czech', 'cesko', 'ceska', 'republika',
    'sk', 'slovensko', 'slovakia',
    'de', 'germany', 'deutschland',
    'at', 'austria', 'osterreich',
    'pl', 'poland', 'polsko',
]);

const isCityOnlyAddress = (address: string): boolean => {
    if (!address) return false;
    const raw = address.trim().toLowerCase();
    if (!raw) return false;
    if (/[0-9]/.test(raw)) return false;
    if (raw.includes('-')) return false;
    if (raw.includes(',')) return false;

    const normalized = normalizeAddress(raw);
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length <= 1) return true;
    if (tokens.length === 2 && CITY_COUNTRY_SUFFIXES.has(tokens[1])) return true;
    return false;
};

/**
 * Synchronous lookup for major cities in the static cache.
 * Useful for filtering and sorting where async geocoding is impractical.
 */
export const getStaticCoordinates = (address: string): { lat: number, lon: number } | null => {
    if (!address) return null;
    if (!isCityOnlyAddress(address)) return null;
    const normalized = normalizeAddress(address);
    if (EU_CITIES_CACHE[normalized]) return EU_CITIES_CACHE[normalized];

    const staticKeys = Object.keys(EU_CITIES_CACHE).sort((a, b) => b.length - a.length);
    for (const key of staticKeys) {
        if (normalized.includes(key)) {
            return EU_CITIES_CACHE[key];
        }
    }
    return null;
};

/**
 * Normalizes an address string for consistent cache key generation.
 * Removes diacritics, special characters, and converts to lowercase.
 */
export const normalizeAddress = (address: string): string => {
    return address
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
        .replace(/[^a-z0-9\s]/g, '') // Remove special chars
        .trim();
};

// Simple rate limiter to respect Nominatim policy (1 request/second)
class RateLimiter {
    private last: Record<string, number> = {};

    async wait(key: string, minInterval: number) {
        const now = Date.now();
        const lastCall = this.last[key] || 0;
        const elapsed = now - lastCall;

        if (elapsed < minInterval) {
            await new Promise(resolve => setTimeout(resolve, minInterval - elapsed));
        }

        this.last[key] = Date.now();
    }
}

const rateLimiter = new RateLimiter();

/**
 * Geocodes an address string with multi-tier caching.
 * @param address The address or city name to geocode.
 * @returns Coordinates object or null if not found.
 */
export const geocodeWithCaching = async (address: string): Promise<{ lat: number, lon: number } | null> => {
    if (!address) return null;

    const normalized = normalizeAddress(address);
    const cityOnly = isCityOnlyAddress(address);

    // 1. Check local static cache (instant)
    if (cityOnly && EU_CITIES_CACHE[normalized]) {
        return EU_CITIES_CACHE[normalized];
    }

    // Check if partial match exists in static cache (e.g. "Praha 4" -> "Praha")
    if (cityOnly) {
        const staticKeys = Object.keys(EU_CITIES_CACHE).sort((a, b) => b.length - a.length);
        for (const key of staticKeys) {
            if (normalized.includes(key)) {
                return EU_CITIES_CACHE[key];
            }
        }
    }

    // 2. Check database cache (fast, persisted)
    if (supabase) {
        try {
            const { data: cached, error } = await supabase
                .from('geocode_cache')
                .select('*')
                .eq('address_normalized', normalized)
                .gte('cached_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // 90 days freshness
                .maybeSingle();

            if (cached && !error) {
                return { lat: cached.lat, lon: cached.lon };
            }
        } catch (e) {
            console.warn("Supabase geocode cache fetch failed:", e);
        }
    }

    // 3. Call geocoding API (rate-limited)
    const apiResult = await callGeocodingAPI(address);

    if (apiResult) {
        // Cache the result in database if Supabase is available
        if (supabase) {
            try {
                await supabase.from('geocode_cache').upsert({
                    address_normalized: normalized,
                    address_original: address,
                    lat: apiResult.lat,
                    lon: apiResult.lon,
                    country: apiResult.country,
                    cached_at: new Date().toISOString()
                });
            } catch (e) {
                console.warn("Failed to update Supabase geocode cache:", e);
            }
        }

        return { lat: apiResult.lat, lon: apiResult.lon };
    }

    return null;
};

/**
 * Direct call to Nominatim OpenStreetMap API with rate limiting.
 */
const callGeocodingAPI = async (address: string): Promise<{ lat: number, lon: number, country: string } | null> => {
    // Rate limiting check (1 req/second for Nominatim)
    await rateLimiter.wait('nominatim', 1000);

    try {
        const query = encodeURIComponent(address);
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `format=json&q=${query}&` +
            `countrycodes=cz,pl,de,at,sk&` + // EU countries only focus
            `limit=1&` +
            `addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'JobShaman/1.0 (+https://jobshaman.cz)',
                    'Accept-Language': 'cs,en'
                }
            }
        );

        if (!response.ok) {
            console.warn(`Nominatim HTTP ${response.status} for ${address}`);
            return null;
        }

        const data = await response.json();

        if (data && data.length > 0) {
            const result = data[0];
            return {
                lat: parseFloat(result.lat),
                lon: parseFloat(result.lon),
                country: result.address?.country_code?.toUpperCase() || 'UNKNOWN'
            };
        }
    } catch (e) {
        console.error("Nominatim geocoding failed:", e);
    }

    return null;
};
