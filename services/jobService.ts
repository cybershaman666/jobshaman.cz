import { supabase, isSupabaseConfigured } from './supabaseService';
import { Job, NoiseMetrics } from '../types';
import { contextualRelevanceScorer, ContextualRelevanceScorer } from './contextualRelevanceService';
import { calculateJHI } from '../utils/jhiCalculator';
import { detectCurrencyFromLocation } from './financialService';
import i18n from '../src/i18n';

// Loose interface to accept whatever Supabase returns
interface ScrapedJob {
    id: number | string;
    title?: string;
    company?: string;
    location?: string;
    description?: string;
    benefits?: string[] | string | null;
    contract_type?: string;
    salary_from?: number | string;
    salary_to?: number | string;
    currency?: string;
    salary_currency?: string;
    work_type?: string;
    scraped_at?: string;
    source?: string;
    education_level?: string;
    url?: string;
    lat?: number | string | null;
    lng?: number | string | null;
    legality_status?: 'pending' | 'legal' | 'illegal' | 'review';
    verification_notes?: string;
    ai_analysis?: any;
    country_code?: string;
}

// ... (skipping constants)

// --- HELPERS ---

const safeParseInt = (value: any): number | undefined => {
    if (value === undefined || value === null) return undefined;
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? undefined : parsed;
};

const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return Math.round(d * 10) / 10;
};

const deg2rad = (deg: number): number => {
    return deg * (Math.PI / 180);
};

const estimateNoise = (description: string): NoiseMetrics => {
    const buzzwords = ['dynamické prostredie', 'tah na branku', 'rockstar', 'ninja', 'rodinná atmosféra', 'stres', 'presčasy'];
    let score = 0;
    const found: string[] = [];

    buzzwords.forEach(word => {
        if (description.toLowerCase().includes(word)) {
            score += 10;
            found.push(word);
        }
    });

    const level = score > 50 ? 'high' : score > 20 ? 'medium' : 'low';

    return {
        score: Math.min(score, 100),
        level,
        keywords: found,
        flags: found,
        tone: level === 'high' ? 'Hype-heavy' : 'Professional'
    };
};

const getNumberLocale = (): string => {
    const lang = (i18n.language || 'cs').split('-')[0];
    switch (lang) {
        case 'de':
            return 'de-DE';
        case 'pl':
            return 'pl-PL';
        case 'sk':
            return 'sk-SK';
        case 'en':
            return 'en-US';
        default:
            return 'cs-CZ';
    }
};

const resolveCurrency = (currency?: string, location?: string, countryCode?: string): string => {
    if (currency && currency !== 'Kč' && currency !== 'CZK') return currency;
    if (countryCode) {
        const cc = countryCode.toUpperCase();
        if (cc === 'PL') return 'PLN';
        if (cc === 'CH') return 'CHF';
        if (cc === 'CZ') return 'CZK';
        if (['DE', 'AT', 'SK', 'FR', 'IT', 'ES', 'NL', 'IE', 'BE', 'PT'].includes(cc)) return '€';
    }
    const inferred = detectCurrencyFromLocation(location || '');
    if (currency && (currency === 'Kč' || currency === 'CZK') && inferred && inferred !== 'CZK') {
        return inferred;
    }
    return currency || inferred || 'CZK';
};

const formatSalaryRange = (
    salaryFrom?: number,
    salaryTo?: number,
    currency?: string,
    location?: string,
    countryCode?: string
): string => {
    const locale = getNumberLocale();
    const resolvedCurrency = resolveCurrency(currency, location, countryCode);

    if (salaryFrom) {
        if (salaryTo) {
            return `${salaryFrom.toLocaleString(locale)} - ${salaryTo.toLocaleString(locale)} ${resolvedCurrency}`;
        }
        return `${salaryFrom.toLocaleString(locale)} ${resolvedCurrency}`;
    }

    return i18n.t('job.salary_not_specified');
};

const getRelativeTime = (dateString?: string): string => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'před chvílí';
    if (diffInSeconds < 3600) return `před ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `před ${Math.floor(diffInSeconds / 3600)} hod`;
    return `před ${Math.floor(diffInSeconds / 86400)} dny`;
};

const parseBenefits = (benefits: any): string[] => {
    if (!benefits) return [];
    if (Array.isArray(benefits)) return benefits.map(String);
    if (typeof benefits === 'string') {
        // Try parsing JSON if it looks like a stringified array
        if (benefits.trim().startsWith('[') && benefits.trim().endsWith(']')) {
            try {
                const parsed = JSON.parse(benefits);
                if (Array.isArray(parsed)) return parsed;
            } catch (e) {
                // Ignore parse error
            }
        }
        return benefits.split(',').map(b => b.trim()).filter(b => b.length > 0);
    }
    return [];
};

const formatDescription = (desc?: string): string => {
    if (!desc) return '';
    // Strip HTML tags if any
    return desc.replace(/<[^>]*>/g, '').trim();
};

const BENEFIT_PATTERNS = [
    { regex: /flexibiln[íi]|pružn[áa] prac|flexible|flexibel|gleitzeit|elastyczn/i, label: 'Flexibilní pracovní doba' },
    { regex: /dovolen[áa] [5-9]|5 t[ýy]dn[ůu]|25 dn[ůu]|weeks of vacation|urlaub|urlop/i, label: '5 týdnů dovolené' },
    { regex: /home office|práce z domova|remote|homeoffice|arbeit von zu hause|praca zdalna/i, label: 'Home Office' },
    { regex: /stravenk|e-stravenk|meal voucher|essens|mittagessen|kantine|bony żywieniowe|karta lunchowa/i, label: 'Stravenky' },
    { regex: /multisport|sportpaket|karta multisport|pakiet sportowy/i, label: 'Multisport karta' },
    { regex: /sick days|zdravotn[íi] volno|krankentage|dni chorobowe/i, label: 'Sick days' },
    { regex: /notebook|počítač|laptop|arbeitslaptop/i, label: 'Notebook' },
    { regex: /telefon|mobil|diensthandy|firmenhandy|telefon służbowy/i, label: 'Mobilní telefon' },
    { regex: /vzděláv|školen[íi]|training|education|weiterbildung|szkolen|kursy/i, label: 'Vzdělávací kurzy' }
];

// Job transformation helper
const transformJob = (scrapedJob: any): Job => {
    const salaryFrom = safeParseInt(scrapedJob.salary_from);
    const salaryTo = safeParseInt(scrapedJob.salary_to);
    const currency = scrapedJob.salary_currency || scrapedJob.currency;
    const salaryRange = formatSalaryRange(salaryFrom, salaryTo, currency, scrapedJob.location, scrapedJob.country_code);

    // Extract contract type and work type from raw fields
    const jobType = scrapedJob.contract_type || scrapedJob.type || 'Neuvedeno';

    // Parse benefits robustly
    const benefits = parseBenefits(scrapedJob.benefits);

    // Extract location with fallback
    const locationString = scrapedJob.location || 'Lokace neuvedena';

    // Generate tags based on benefits and keywords
    const uniqueTags = benefits.length > 0 ? [...benefits] : [];
    if (scrapedJob.work_type) uniqueTags.push(scrapedJob.work_type);
    if (scrapedJob.education_level) uniqueTags.push(scrapedJob.education_level);

    const fullDesc = scrapedJob.description || 'Popis pozice není k dispozici.';

    // Calculate JHI
    const jhi = calculateJHI({
        salary_from: salaryFrom ?? undefined,
        salary_to: salaryTo ?? undefined,
        type: scrapedJob.work_type as any,
        benefits: benefits,
        description: fullDesc,
        location: locationString
    });

    return {
        id: String(scrapedJob.id),
        title: scrapedJob.title || (scrapedJob.company ? `${scrapedJob.company} - Pozice` : 'Pozice bez názvu'),
        company: scrapedJob.company || 'Neznámá společnost',
        location: locationString,
        type: jobType,
        salaryRange,
        description: fullDesc,
        postedAt: getRelativeTime(scrapedJob.scraped_at),
        scrapedAt: scrapedJob.scraped_at,
        source: scrapedJob.source || 'Scraper',
        url: scrapedJob.url,
        lat: scrapedJob.lat ? parseFloat(String(scrapedJob.lat)) : undefined,
        lng: scrapedJob.lng ? parseFloat(String(scrapedJob.lng)) : undefined,
        jhi: jhi,
        noiseMetrics: estimateNoise(fullDesc),
        transparency: {
            turnoverRate: 15,
            avgTenure: 2.5,
            ghostingRate: 20,
            hiringSpeed: "Neznámé",
            redFlags: []
        },
        market: {
            marketAvgSalary: salaryFrom || 0,
            percentile: 50,
            inDemandSkills: []
        },
        tags: uniqueTags,
        benefits: benefits,
        required_skills: [], // Initialize empty array
        salary_from: salaryFrom || undefined,
        salary_to: salaryTo || undefined,
        country_code: scrapedJob.country_code,
        // Map cached AI analysis if present
        aiAnalysis: scrapedJob.ai_analysis
    };
};

// --- API ---

export const getJobCount = async (): Promise<number> => {
    if (!isSupabaseConfigured() || !supabase) {
        console.warn("Supabase not configured.");
        return 0;
    }

    try {
        const { count, error } = await supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true })
            .eq('legality_status', 'legal');

        if (error) {
            console.error("Error fetching job count:", error);
            return 0;
        }

        return count || 0;
    } catch (e) {
        console.error("Error in getJobCount:", e);
        return 0;
    }
};

export const fetchJobsPaginated = async (
    page: number = 0,
    pageSize: number = 50,
    userLat?: number,
    userLng?: number,
    radiusKm: number = 50,
    countryCode?: string
): Promise<{ jobs: Job[], hasMore: boolean, totalCount: number }> => {
    if (!isSupabaseConfigured() || !supabase) {
        console.warn("Supabase not configured.");
        return { jobs: [], hasMore: false, totalCount: 0 };
    }

    try {
        // If user coordinates provided AND both lat/lng are defined, use spatial query
        if (userLat !== undefined && userLng !== undefined && userLat !== null && userLng !== null) {
            console.log(`🗺️  Using spatial search for location: ${userLat}, ${userLng}, radius: ${radiusKm}km, country: ${countryCode || 'all'}`);

            const { data, error } = await supabase
                .rpc('search_jobs_minimal', {
                    user_lat: userLat,
                    user_lng: userLng,
                    radius_km: radiusKm,
                    limit_count: pageSize,
                    offset_val: page * pageSize,
                    filter_country_code: countryCode
                });

            if (error) {
                console.error('Spatial query error:', error);
                // Fallback to regular query if spatial function not ready
                return fetchJobsPaginatedFallback(page, pageSize, userLat, userLng, radiusKm, countryCode);
            }

            if (!data || data.length === 0) {
                console.log('🔍 No jobs found within radius');
                return { jobs: [], hasMore: false, totalCount: 0 };
            }

            // Process results with distance information
            const processedJobs = data.map((row: any) => {
                const job = transformJob({
                    id: row.id,
                    title: row.title,
                    company: row.company,
                    location: row.location,
                    description: row.description,
                    benefits: row.benefits,
                    contract_type: row.contract_type,
                    salary_from: row.salary_from,
                    salary_to: row.salary_to,
                    work_type: row.work_type,
                    scraped_at: row.scraped_at,
                    source: row.source,
                    education_level: row.education_level,
                    url: row.url,
                    lat: row.lat,
                    lng: row.lng,
                    country_code: row.country_code
                });

                // Add distance information
                (job as any).distance_km = row.distance_km;
                return job;
            });

            // Filter by country code if provided
            const countryFilteredJobs = countryCode
                ? processedJobs.filter((job: Job) => job.country_code === countryCode)
                : processedJobs;

            // Filter by quality standards and remove duplicates
            const filteredJobs = filterJobsByQuality(countryFilteredJobs);

            const totalCount = data[0]?.total_count || 0;
            const hasMore = data[0]?.has_more || false;

            console.log(`📍 Found ${filteredJobs.length} valid jobs within ${radiusKm}km (total: ${totalCount}, filtered: ${processedJobs.length - filteredJobs.length})`);

            return {
                jobs: filteredJobs,
                hasMore,
                totalCount
            };
        }

        // Fallback: Regular pagination without location filter
        return fetchJobsPaginatedFallback(page, pageSize, undefined, undefined, undefined, countryCode);

    } catch (e) {
        console.error("Error in fetchJobsPaginated:", e);
        return { jobs: [], hasMore: false, totalCount: 0 };
    }
};

// Fallback function for regular pagination
const fetchJobsPaginatedFallback = async (
    page: number = 0,
    pageSize: number = 50,
    userLat?: number,
    userLng?: number,
    _radiusKm?: number, // Not used in fallback
    countryCode?: string
): Promise<{ jobs: Job[], hasMore: boolean, totalCount: number }> => {
    try {
        // Get total count first
        const totalCount = await getJobCount();

        const from = page * pageSize;
        const to = from + pageSize - 1;

        let query = supabase
            .from('jobs')
            .select('*')
            .eq('legality_status', 'legal');

        // Apply country code filter if provided
        if (countryCode) {
            query = query.eq('country_code', countryCode);
        }

        const { data, error } = await query
            .range(from, to)
            .order('scraped_at', { ascending: false });

        if (error) {
            console.error(`Error fetching page ${page}:`, error);
            return { jobs: [], hasMore: false, totalCount };
        }

        if (!data || data.length === 0) {
            return { jobs: [], hasMore: false, totalCount };
        }

        console.log(`📋 Fallback: Fetched ${data.length} jobs (page ${page}, total: ${totalCount}, country: ${countryCode || 'all'})`);

        const processedJobs = data.map((job: any) => {
            const transformed = transformJob(job);
            // Calculate distance if coordinates provided
            if (userLat && userLng && job.lat && job.lng) {
                (transformed as any).distance_km = calculateDistanceKm(
                    userLat, userLng,
                    job.lat as number, job.lng as number
                );
            }
            return transformed;
        });

        // Filter by quality standards and remove duplicates
        const filteredJobs = filterJobsByQuality(processedJobs);

        return {
            jobs: filteredJobs,
            hasMore: (page + 1) * pageSize < totalCount,
            totalCount
        };

    } catch (e) {
        console.error("Error in fetchJobsPaginatedFallback:", e);
        return { jobs: [], hasMore: false, totalCount: 0 };
    }
};

export const searchJobs = async (
    searchTerm: string,
    page: number = 0,
    pageSize: number = 20,
    countryCode?: string
): Promise<{ jobs: Job[], hasMore: boolean }> => {
    if (!isSupabaseConfigured() || !supabase || !searchTerm.trim()) {
        return { jobs: [], hasMore: false };
    }

    try {
        console.log(`🔍 Searching for: "${searchTerm}" (page ${page}, country: ${countryCode || 'all'})`);
        const from = page * pageSize;
        const to = from + pageSize;

        let query = supabase
            .from('jobs')
            .select('*')
            .eq('legality_status', 'legal')
            .or(`title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`);

        // Apply country code filter if provided
        if (countryCode) {
            query = query.eq('country_code', countryCode);
        }

        const { data, error } = await query
            .order('scraped_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error("❌ Error searching jobs:", error);
            return { jobs: [], hasMore: false };
        }

        const hasMore = data.length > pageSize;
        const rawJobs = hasMore ? data.slice(0, pageSize) : data;

        const allJobs = mapJobs(rawJobs);
        const validJobs = filterJobsByQuality(allJobs);

        return { jobs: validJobs, hasMore };
    } catch (e) {
        console.error("Error in searchJobs:", e);
        return { jobs: [], hasMore: false };
    }
};

/**
 * Search jobs by location text in the database.
 * Used as fallback when geocoding fails or returns no results.
 * Searches the location column for partial/exact matches.
 */
export const searchJobsByLocation = async (
    locationText: string,
    page: number = 0,
    pageSize: number = 50,
    countryCode?: string
): Promise<{ jobs: Job[], hasMore: boolean, totalCount: number }> => {
    if (!isSupabaseConfigured() || !supabase || !locationText.trim()) {
        return { jobs: [], hasMore: false, totalCount: 0 };
    }

    try {
        console.log(`🏙️  Searching jobs by location text: "${locationText}" (country: ${countryCode || 'all'})`);

        const from = page * pageSize;
        const to = from + pageSize - 1;

        // First, get the total count of matching jobs
        let countQuery = supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true })
            .eq('legality_status', 'legal')
            .ilike('location', `%${locationText}%`);

        if (countryCode) {
            countQuery = countQuery.eq('country_code', countryCode);
        }

        const { count, error: countError } = await countQuery;

        if (countError) {
            console.error("Error getting location search count:", countError);
            return { jobs: [], hasMore: false, totalCount: 0 };
        }

        const totalCount = count || 0;

        // Then fetch the paginated results
        let dataQuery = supabase
            .from('jobs')
            .select('*')
            .eq('legality_status', 'legal')
            .ilike('location', `%${locationText}%`);

        if (countryCode) {
            dataQuery = dataQuery.eq('country_code', countryCode);
        }

        const { data, error } = await dataQuery
            .order('scraped_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error("Error searching jobs by location:", error);
            return { jobs: [], hasMore: false, totalCount };
        }

        if (!data || data.length === 0) {
            console.log(`🏙️  No jobs found with location matching "${locationText}"`);
            return { jobs: [], hasMore: false, totalCount };
        }

        const processedJobs = mapJobs(data);
        const filteredJobs = filterJobsByQuality(processedJobs);

        console.log(`🏙️  Found ${filteredJobs.length} jobs with location containing "${locationText}" (total: ${totalCount})`);

        return {
            jobs: filteredJobs,
            hasMore: (page + 1) * pageSize < totalCount,
            totalCount
        };

    } catch (e) {
        console.error("Error in searchJobsByLocation:", e);
        return { jobs: [], hasMore: false, totalCount: 0 };
    }
};

// --- COMPREHENSIVE FILTER FUNCTION ---

export interface JobFilterOptions {
    // Location & Distance
    userLat?: number;
    userLng?: number;
    radiusKm?: number;
    filterCity?: string;

    // Contract Type
    filterContractTypes?: string[]; // ['HPP', 'IČO', 'Part-time']

    // Benefits
    filterBenefits?: string[];

    // Salary
    filterMinSalary?: number;

    // Date Posted
    filterDatePosted?: string; // 'all', '24h', '3d', '7d', '14d'

    // Experience Level
    filterExperienceLevels?: string[]; // ['Junior', 'Medior', 'Senior', 'Lead']

    // Pagination
    page?: number;
    pageSize?: number;

    // Countries
    countryCodes?: string[];
    searchTerm?: string;
}

/**
 * Comprehensive job filtering function that supports all filter types
 * Uses database-level filtering via RPC for optimal performance
 * Automatically geocodes city names to enable distance filtering
 */
export const fetchJobsWithFilters = async (
    options: JobFilterOptions
): Promise<{ jobs: Job[], hasMore: boolean, totalCount: number }> => {
    if (!isSupabaseConfigured() || !supabase) {
        console.warn("Supabase not configured.");
        return { jobs: [], hasMore: false, totalCount: 0 };
    }

    const {
        userLat,
        userLng,
        radiusKm,
        filterCity,
        filterContractTypes,
        filterBenefits,
        filterMinSalary,
        filterDatePosted = 'all',
        filterExperienceLevels,
        page = 0,
        pageSize = 50,
        countryCodes,
        searchTerm
    } = options;

    try {
        let finalUserLat = userLat;
        let finalUserLng = userLng;

        // If city filter is provided but no coordinates, try to geocode
        if (filterCity && filterCity.trim() && (!userLat || !userLng)) {
            console.log(`🏙️  City filter provided without coordinates, geocoding "${filterCity}"...`);
            const { geocodeWithCaching } = await import('./geocodingService');
            const coords = await geocodeWithCaching(filterCity);
            if (coords) {
                finalUserLat = coords.lat;
                finalUserLng = coords.lon;
                console.log(`✅ Using geocoded coordinates: ${finalUserLat}, ${finalUserLng}`);
            }
        }

        console.log(`🔍 Fetching filtered jobs with options:`, {
            radius: radiusKm,
            city: filterCity,
            lat: finalUserLat,
            lng: finalUserLng,
            contract: filterContractTypes || [],
            benefits: filterBenefits || [],
            minSalary: filterMinSalary,
            date: filterDatePosted,
            experience: filterExperienceLevels || [],
            page,
            pageSize,
            countries: countryCodes || ['all'],
            searchTerm: searchTerm || 'none'
        });

        // When radius is disabled (undefined/null), also disable spatial filtering
        // by setting coordinates to null
        const usesSpatialFilter = radiusKm !== undefined && radiusKm !== null;
        const spatialLat = usesSpatialFilter ? finalUserLat : null;
        const spatialLng = usesSpatialFilter ? finalUserLng : null;
        const spatialRadius = usesSpatialFilter ? radiusKm : null;

        const { data, error } = await supabase.rpc('search_jobs_with_filters', {
            search_term: searchTerm || null,
            user_lat: spatialLat,
            user_lng: spatialLng,
            radius_km: spatialRadius,
            filter_city: filterCity || null,
            filter_contract_types: filterContractTypes && filterContractTypes.length > 0 ? filterContractTypes : null,
            filter_benefits: filterBenefits && filterBenefits.length > 0 ? filterBenefits : null,
            filter_min_salary: filterMinSalary ?? null,
            filter_date_posted: filterDatePosted,
            filter_experience_levels: filterExperienceLevels && filterExperienceLevels.length > 0 ? filterExperienceLevels : null,
            limit_count: pageSize,
            offset_val: page * pageSize,
            filter_country_codes: countryCodes && countryCodes.length > 0 ? countryCodes : null
        });

        if (error) {
            console.error('❌ Error fetching filtered jobs:', error);
            return { jobs: [], hasMore: false, totalCount: 0 };
        }

        if (!data || data.length === 0) {
            console.log('🔍 No jobs found matching filter criteria');
            return { jobs: [], hasMore: false, totalCount: 0 };
        }

        // Process results
        const processedJobs = data.map((row: any) => {
            const job = transformJob({
                id: row.id,
                title: row.title,
                company: row.company,
                location: row.location,
                description: row.description,
                benefits: row.benefits,
                contract_type: row.contract_type,
                salary_from: row.salary_from,
                salary_to: row.salary_to,
                work_type: row.work_type,
                scraped_at: row.scraped_at,
                source: row.source,
                education_level: row.education_level,
                url: row.url,
                lat: row.lat,
                lng: row.lng,
                country_code: row.country_code,
                legality_status: row.legality_status,
                verification_notes: row.verification_notes
            });

            // Add distance and tags information
            (job as any).distance_km = row.distance_km;
            if (row.tags) {
                job.tags = [...job.tags, ...row.tags];
            }

            return job;
        });

        const totalCount = data[0]?.total_count || 0;
        const hasMore = (page + 1) * pageSize < totalCount;

        console.log(`✅ Found ${processedJobs.length} filtered jobs (total: ${totalCount}, has more: ${hasMore})`);

        return {
            jobs: processedJobs,
            hasMore,
            totalCount
        };

    } catch (e) {
        console.error("Error in fetchJobsWithFilters:", e);
        return { jobs: [], hasMore: false, totalCount: 0 };
    }
};

/**
 * Fetch a single job by ID (for direct links like /jobs/:id)
 */
export const fetchJobById = async (jobId: string): Promise<Job | null> => {
    try {
        if (!supabase) {
            console.error('❌ Supabase not configured');
            return null;
        }

        console.log(`🔍 Fetching job by ID: ${jobId}`);

        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('id', jobId)
            .single();

        if (error) {
            console.error('❌ Error fetching job by ID:', error);
            return null;
        }

        if (!data) {
            console.log('🔍 No job found with ID:', jobId);
            return null;
        }

        const job = transformJob({
            id: data.id,
            title: data.title,
            company: data.company,
            location: data.location,
            description: data.description,
            benefits: data.benefits,
            contract_type: data.contract_type,
            salary_from: data.salary_from,
            salary_to: data.salary_to,
            currency: data.currency,
            work_type: data.work_type,
            scraped_at: data.scraped_at,
            source: data.source,
            education_level: data.education_level,
            url: data.url,
            lat: data.lat,
            lng: data.lng,
            country_code: data.country_code,
            legality_status: data.legality_status,
            verification_notes: data.verification_notes,
            ai_analysis: data.ai_analysis
        });

        console.log(`✅ Fetched job: ${job.title} at ${job.company}`);
        return job;

    } catch (e) {
        console.error("Error in fetchJobById:", e);
        return null;
    }
};


// Legacy function - kept for compatibility
export const fetchRealJobs = async (
    onProgress?: (jobs: Job[]) => void
): Promise<Job[]> => {
    if (!isSupabaseConfigured() || !supabase) {
        console.warn("Supabase not configured.");
        return [];
    }

    try {
        console.log("Fetching jobs from Supabase...");

        // 1. Get total count
        const { count, error: countError } = await supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error("Error fetching job count:", countError);
            return [];
        }

        const totalJobs = count || 0;
        console.log(`Found ${totalJobs} jobs in database.`);

        if (totalJobs === 0) return [];

        const MAX_JOBS = 25000;
        const PAGE_SIZE = 500; // Smaller chunks for smoother UI
        const totalToFetch = Math.min(totalJobs, MAX_JOBS);
        let allJobs: Job[] = [];

        // 2. Linear Fetch with Callbacks (to enable "silent" loading)
        for (let i = 0; i < totalToFetch; i += PAGE_SIZE) {
            const from = i;
            const to = Math.min(i + PAGE_SIZE - 1, totalToFetch - 1);

            const { data, error } = await supabase
                .from('jobs')
                .select('*')
                .eq('legality_status', 'legal')
                .range(from, to)
                .order('scraped_at', { ascending: false });

            if (error) {
                console.error(`Error fetching sequence ${i}:`, error);
                continue;
            }

            if (data && data.length > 0) {
                // Process mapping in "idle" time to prevent thread lock
                const chunk = mapJobs(data);

                // Sort chunk newest first
                chunk.sort((a, b) => {
                    const getTime = (dateStr?: string) => {
                        if (!dateStr) return 0;
                        const cleanStr = dateStr.replace(' ', 'T');
                        const d = new Date(cleanStr);
                        return isNaN(d.getTime()) ? 0 : d.getTime();
                    };
                    return getTime(b.scrapedAt) - getTime(a.scrapedAt);
                });

                allJobs = [...allJobs, ...chunk];

                if (onProgress) {
                    // Send update to UI
                    onProgress([...allJobs]);
                }

                // Yield to main thread
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        console.log(`Finished loading ${allJobs.length} jobs.`);
        return allJobs;

    } catch (e) {
        console.error("Critical error in fetchRealJobs:", e);
        return [];
    }
};

// Synchronous job mapper - simple and reliable like the original working version
const mapJobs = (data: any[], userLat?: number, userLng?: number): Job[] => {
    const mappedJobs = data.map((item: any): Job | null => {
        try {
            const scraped = item as ScrapedJob;

            // 1. Description Processing
            const fullDesc = formatDescription(scraped.description);

            if (fullDesc.length < 20) {
                return null;
            }

            // 2. Salary Processing
            let salaryFrom = safeParseInt(scraped.salary_from);
            let salaryTo = safeParseInt(scraped.salary_to);

            // Fix for salaries stored as thousands (e.g., 38 should be 38,000)
            if (salaryFrom && salaryFrom < 1000) {
                salaryFrom = salaryFrom * 1000;
            }
            if (salaryTo && salaryTo < 1000) {
                salaryTo = salaryTo * 1000;
            }

            const currency = scraped.salary_currency || scraped.currency;
            const salaryRange = formatSalaryRange(salaryFrom, salaryTo, currency, scraped.location, scraped.country_code);

            // 3. Job Type Inference
            let jobType: 'Remote' | 'Hybrid' | 'On-site' = 'On-site';
            const wt = String(scraped.work_type || '').toLowerCase();
            const descLower = fullDesc.toLowerCase();
            const titleLower = (scraped.title || '').toLowerCase();

            if (wt.includes('remote') || wt.includes('home') || descLower.includes('remote') || descLower.includes('full-remote')) {
                jobType = 'Remote';
            } else if (wt.includes('hybrid') || descLower.includes('hybrid')) {
                jobType = 'Hybrid';
            }

            // 4. Tag Generation
            const techTags: string[] = [];
            const otherTags: string[] = [];
            const locationTags: string[] = [];

            const rawLocation = scraped.location || (scraped as any).place || (scraped as any).region || 'Česká republika';
            const locationString = String(rawLocation).trim();
            const locLower = locationString.toLowerCase();

            if (locLower.includes('praha') || locLower.includes('prague')) locationTags.push('Praha');
            else if (locLower.includes('brno')) locationTags.push('Brno');
            else if (locLower.includes('ostrava')) locationTags.push('Ostrava');
            else if (locLower.includes('plzeň') || locLower.includes('plzen')) locationTags.push('Plzeň');
            else if (locLower.includes('olomouc')) locationTags.push('Olomouc');
            else if (locLower.includes('liberec')) locationTags.push('Liberec');

            if (locLower.includes('remote')) locationTags.push('Remote');

            if (titleLower.includes('react') || descLower.includes('react')) techTags.push('React');
            if (titleLower.includes('node') || descLower.includes('node.js')) techTags.push('Node.js');
            if (titleLower.includes('python') || descLower.includes('python')) techTags.push('Python');
            if (titleLower.includes('java ') || descLower.includes('java ')) techTags.push('Java');
            if (titleLower.includes('.net') || descLower.includes('.net')) techTags.push('.NET');
            if (titleLower.includes('php') || descLower.includes('php')) techTags.push('PHP');
            if (titleLower.includes('typescript') || descLower.includes('typescript')) techTags.push('TypeScript');
            if (titleLower.includes('javascript') || descLower.includes('javascript')) techTags.push('JavaScript');

            if (titleLower.includes('manager') || titleLower.includes('vedoucí')) otherTags.push('Management');
            if (titleLower.includes('řidič') || titleLower.includes('kurýr')) otherTags.push('Logistika');
            if (titleLower.includes('prodavač') || titleLower.includes('asistent')) otherTags.push('Prodej');

            const cType = String(scraped.contract_type || '').toLowerCase();
            if (cType.includes('hpp') || cType.includes('plný')) otherTags.push('HPP');
            if (cType.includes('ičo') || cType.includes('fakturace') || titleLower.includes('ičo')) otherTags.push('IČO');
            if (cType.includes('part') || cType.includes('zkrácený') || titleLower.includes('brigáda')) otherTags.push('Part-time');

            const uniqueTags = [...new Set([...locationTags, ...otherTags, ...techTags])].slice(0, 6);
            if (uniqueTags.length === 0) uniqueTags.push('Nové');

            // 5. Benefits Parsing & Auto-Detection
            let benefits = parseBenefits(scraped.benefits);
            if (benefits.length < 2) {
                const detectedBenefits = new Set(benefits);
                for (const pattern of BENEFIT_PATTERNS) {
                    if (pattern.regex.test(descLower)) {
                        detectedBenefits.add(pattern.label);
                    }
                }
                benefits = Array.from(detectedBenefits);
            }

            // 6. Contextual Relevance Scoring
            const workMode = ContextualRelevanceScorer.inferWorkMode(String(scraped.work_type || ''), fullDesc);
            const jobCategory = ContextualRelevanceScorer.inferJobType(String(scraped.title || ''), fullDesc);
            const contextualRelevance = contextualRelevanceScorer.calculateRelevanceScore(
                benefits,
                workMode,
                jobCategory
            );

            // Calculate distance if user coordinates are available
            let distanceKm: number | undefined = undefined;
            if (typeof userLat === 'number' && typeof userLng === 'number' &&
                scraped.lat !== undefined && scraped.lat !== null &&
                scraped.lng !== undefined && scraped.lng !== null) {
                const jobLat = parseFloat(String(scraped.lat));
                const jobLng = parseFloat(String(scraped.lng));
                if (!isNaN(jobLat) && !isNaN(jobLng)) {
                    distanceKm = calculateDistanceKm(userLat, userLng, jobLat, jobLng);
                }
            }

            return {
                id: `db-${scraped.id}`,
                title: scraped.title || (scraped.company ? `${scraped.company} - Pozice` : 'Pozice bez názvu'),
                company: scraped.company || 'Neznámá společnost',
                location: locationString,
                type: jobType,
                salaryRange: salaryRange,
                description: fullDesc,
                postedAt: getRelativeTime(scraped.scraped_at),
                scrapedAt: scraped.scraped_at,
                source: scraped.source || 'Scraper',
                url: scraped.url,
                lat: scraped.lat ? parseFloat(String(scraped.lat)) : undefined,
                lng: scraped.lng ? parseFloat(String(scraped.lng)) : undefined,
                ...(distanceKm !== undefined && { distanceKm }),
                jhi: calculateJHI({
                    salary_from: salaryFrom ?? undefined,
                    salary_to: salaryTo ?? undefined,
                    type: jobType,
                    benefits: benefits,
                    description: fullDesc,
                    location: locationString,
                    distanceKm: distanceKm
                }),
                noiseMetrics: estimateNoise(fullDesc),
                transparency: {
                    turnoverRate: 15,
                    avgTenure: 2.5,
                    ghostingRate: 20,
                    hiringSpeed: "Neznámé",
                    redFlags: []
                },
                market: {
                    marketAvgSalary: salaryFrom || 0,
                    percentile: 50,
                    inDemandSkills: []
                },
                tags: uniqueTags,
                benefits: benefits,
                contextualRelevance: contextualRelevance,
                required_skills: [],
                legality_status: scraped.legality_status,
                legality_reasons: scraped.verification_notes ? scraped.verification_notes.split(',').map((s: string) => s.trim()) : []
            };
        } catch (innerError) {
            console.error("Mapping error for job ID:", item.id, innerError);
            return null;
        }
    });

    const validJobs = mappedJobs.filter((j): j is Job => j !== null);
    const filteredOutCount = mappedJobs.length - validJobs.length;

    if (filteredOutCount > 0) {
        console.log(`Filtered out ${filteredOutCount} jobs during mapping. ${validJobs.length} valid jobs remain.`);
    }

    return validJobs;
}

/**
 * Validates if a job posting meets quality standards
 * Filters out:
 * - Jobs with "Neznámá pozice" (Unknown position)
 * - Jobs with "neznámá lokalita" (Unknown location)
 * - Jobs without proper description
 * - Jobs with description < 500 characters
 * - Duplicate jobs (by title + company + location)
 */
export const isValidJobPosting = (job: Job): boolean => {
    // Check title - filter out "Neznámá pozice" (Unknown position)
    if (!job.title ||
        job.title.toLowerCase().includes('neznámá pozice') ||
        job.title.toLowerCase().includes('unknown position') ||
        job.title.trim().length === 0) {
        return false;
    }

    // Check location - filter out "neznámá lokalita" (Unknown location)
    if (!job.location ||
        job.location.toLowerCase().includes('neznámá lokalita') ||
        job.location.toLowerCase().includes('unknown location') ||
        job.location.toLowerCase().includes('nepřesná lokalita') ||
        job.location.toLowerCase().includes('bez lokality') ||
        job.location.trim().length === 0) {
        return false;
    }

    // Check description exists and has minimum length (200 characters)
    if (!job.description ||
        typeof job.description !== 'string' ||
        job.description.trim().length < 200) {
        return false;
    }

    // Filter out if company is missing or generic
    if (!job.company || job.company.trim().length === 0) {
        return false;
    }

    return true;
};

/**
 * Filters jobs to remove low-quality postings and duplicates
 */
export const filterJobsByQuality = (jobs: Job[]): Job[] => {
    // First filter by quality standards
    const validJobs = jobs.filter(isValidJobPosting);

    // Then remove duplicates - keep first occurrence
    const seen = new Set<string>();
    const uniqueJobs = validJobs.filter(job => {
        const key = `${job.title?.toLowerCase().trim()}|${job.company?.toLowerCase().trim()}|${job.location?.toLowerCase().trim()}`;
        if (seen.has(key)) {
            console.log(`⚠️  Filtered duplicate job: ${job.title} at ${job.company}`);
            return false;
        }
        seen.add(key);
        return true;
    });

    const filtered = jobs.length - uniqueJobs.length;
    if (filtered > 0) {
        console.log(`🧹 Quality filter: Removed ${filtered} low-quality/duplicate jobs. ${uniqueJobs.length} valid jobs remain.`);
    }

    return uniqueJobs;
};

// Clear job cache
export const clearJobCache = () => {
    try {
        const keys = Object.keys(localStorage);
        const jobKeys = keys.filter(key => key.startsWith('job_cache_') || key.startsWith('cached_job_'));
        jobKeys.forEach(key => localStorage.removeItem(key));
        console.log(`Cleared ${jobKeys.length} items from job cache.`);
    } catch (e) {
        console.error('Error clearing job cache:', e);
    }
};
