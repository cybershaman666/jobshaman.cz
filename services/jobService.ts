import { supabase, isSupabaseConfigured } from './supabaseService';
import { Job, JHI, NoiseMetrics } from '../types';
import { contextualRelevanceScorer, ContextualRelevanceScorer } from './contextualRelevanceService';

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
    work_type?: string;
    scraped_at?: string;
    source?: string;
    education_level?: string;
    url?: string;
    lat?: number | string | null;
    lng?: number | string | null;
}

// --- CONFIG ---

// Patterns to detect benefits in description text if structured data is missing
const BENEFIT_PATTERNS = [
    { label: 'Stravenky', regex: /stravenk|příspěvek na stravování|jídeln|oběd|stravné/i },
    { label: 'MultiSport', regex: /multisport|sportovn|fitnes|posilovna/i },
    { label: '5 týdnů dovolené', regex: /5 týdnů|25 dnů|týden dovolené navíc|extra dovolená/i },
    { label: 'Služební auto', regex: /služební (auto|vůz|vozidlo)|auto i pro soukromé|firmovní vůz/i },
    { label: 'Penzijní připojištění', regex: /penzijní|životní pojištění|důchodové/i },
    { label: 'Sick Days', regex: /sick\s*days|zdravotní volno|nemocenské/i },
    { label: 'Flexibilní doba', regex: /flexibilní|pružná|volná pracovní doba/i },
    { label: 'Home Office', regex: /home\s*office|práce z domova|remote|práce odkudkoliv/i },
    { label: 'Cafeteria', regex: /cafeteria|kafeterie|benefity na míru|benefit system/i },
    { label: 'Občerstvení', regex: /občerstvení|káva|ovoce|snídaně|obědy zdarma/i },
    { label: 'Hardware', regex: /macbook|notebook|telefon|laptop|iphone|vybavení/i },
    { label: 'Vzdělávání', regex: /školení|kurzy|konference|vzdělávání|certifikace|rozvoj/i },

    // NEW patterns
    { label: '13. plat', regex: /13\.?\s*plat|třináctý plat|roční bonus/i },
    { label: '14. plat', regex: /14\.?\s*plat|čtrnáctý plat/i },
    { label: 'Bonusy', regex: /\bbonu|prémie|odměny|kvartální/i },
    { label: 'RSU/Akcie', regex: /\brsu\b|stock options|akcie|podíl na zisku/i },
    { label: 'Jazykové kurzy', regex: /jazykové?\s*kurzy?|anglick[ýá]\s*kurz|němčina/i },
    { label: 'Teambuilding', regex: /teambuilding|firemní akce|výlety|party/i },
    { label: 'Příspěvek na bydlení', regex: /příspěvek na bydlení|nájem|ubytování/i },
    { label: 'Relokační balíček', regex: /relokac|přestěhování|relocation|moving/i },
    { label: 'Rodičovská', regex: /rodičovská|mateřská|otcovská|péče o děti/i },
    { label: 'Pes v kanceláři', regex: /dog\-?friendly|pes (v|do)?\s*kanceláři/i },
    { label: '4denní týden', regex: /4\-?denní týden|kratší pracovní týden/i }
];

// --- PARSING HELPERS ---

const getRelativeTime = (dateString?: string | null): string => {
    if (!dateString) {
        console.warn('⚠️ getRelativeTime called with:', dateString);
        return 'N/A';
    }
    try {
        // Handle 'timestamp without time zone' format from Postgres: "2026-01-27 14:30:00"
        // Replace space with 'T' to make it ISO 8601 compatible
        let isoString = String(dateString).trim();
        if (isoString.includes(' ') && !isoString.includes('T')) {
            isoString = isoString.replace(' ', 'T');
        }
        const date = new Date(isoString);
        if (isNaN(date.getTime())) {
            console.warn('⚠️ getRelativeTime failed to parse:', dateString);
            return 'N/A';
        }

        const now = new Date();
        const diffTime = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));

        if (diffHours < 1) return 'Před chvílí';
        if (diffHours < 24) return `před ${diffHours} hod.`;
        if (diffDays === 1) return 'Včera';
        return `před ${diffDays} dny`;
    } catch (e) {
        console.warn('⚠️ getRelativeTime exception:', e, 'dateString:', dateString);
        return 'N/A';
    }
};

// --- SIMPLE IN-MEMORY CACHE FOR JOBS ---
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

class JobCache {
    private cache: Map<string, CacheEntry<any>> = new Map();
    private maxSize: number = 200;

    set<T>(key: string, data: T, ttl: number = 60000): void {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, { data, timestamp: Date.now(), ttl });
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        return entry.data as T;
    }

    clear(): void {
        this.cache.clear();
    }
}

const jobCache = new JobCache();

// Clear cache when user coordinates change to force fresh fetch
export const clearJobCache = () => {
    jobCache.clear();
    console.log('🧹 Job cache cleared - will fetch fresh results with new coordinates');
};

// --- SALARY NORMALIZATION HELPERS ---
// Note: Functions temporarily removed as they're not currently used
// const detectSalaryCurrency = ...
// const normalizeSalary = ...

const safeParseInt = (val: string | number | null | undefined): number | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const cleaned = val.replace(/\s/g, '').replace(/,/g, '').replace(/\u00A0/g, '');
        const parsed = parseInt(cleaned, 10);
        return isNaN(parsed) ? null : parsed;
    }
    return null;
};

// Robust parser for Python lists stored as strings: "['A', 'B']"
const parseBenefits = (raw: string[] | string | null | any): string[] => {
    if (!raw) return [];

    // 1. If it's already an array (Supabase JSON/Array column)
    if (Array.isArray(raw)) {
        return raw.map(String).filter(b => b && b.trim().length > 0 && b.toLowerCase() !== 'benefity nespecifikovány');
    }

    if (typeof raw === 'string') {
        let text = raw.trim();
        if (!text || text === '[]' || text === '{}') return [];

        // 2. Handle Python/JS style list: ['Item A', 'Item B'] or ["Item A", "Item B"]
        if (text.startsWith('[') && text.endsWith(']')) {
            try {
                // Try strictly compliant JSON first
                return JSON.parse(text);
            } catch (e) {
                // Regex to capture content inside quotes (single or double)
                // This ignores commas inside the quotes
                const matches = text.match(/(['"])(.*?)\1/g);
                if (matches) {
                    return matches.map(m => m.slice(1, -1).trim()) // Remove quotes
                        .filter(b => b.length > 0 && b.toLowerCase() !== 'benefity nespecifikovány');
                }
                // Fallback for simple comma separation if regex fails
                const content = text.slice(1, -1);
                return content.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
            }
        }

        // 3. Handle Postgres Array: {Item A,Item B}
        if (text.startsWith('{') && text.endsWith('}')) {
            const content = text.slice(1, -1);
            // Handle quoted CSV inside postgres array
            const matches = content.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (matches) {
                return matches.map(m => m.replace(/^"|"$/g, '').replace(/\\"/g, '"').trim());
            }
            return content.split(',').map(s => s.trim()).filter(Boolean);
        }

        // 4. Fallback
        if (text.includes('\n')) return text.split('\n').map(s => s.trim()).filter(Boolean);
        return [text];
    }
    return [];
};

const formatDescription = (desc: string | null | undefined): string => {
    if (!desc) return "Popis není k dispozici.";

    let clean = String(desc).trim();
    if (clean === "Popis nenalezen") return "Detailní popis pozice se nepodařilo stáhnout. Navštivte původní zdroj.";

    // Basic cleanup only - preserve content!
    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(clean);

    if (hasHtmlTags) {
        clean = clean
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            // Handle lists with proper line breaks
            .replace(/<ul>/gi, '\n')
            .replace(/<\/ul>/gi, '\n')
            .replace(/<ol>/gi, '\n')
            .replace(/<\/ol>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<li>/gi, '- ')
            .replace(/&nbsp;/g, ' ');
        // Strip remaining tags
        clean = clean.replace(/<[^>]*>/g, '');
    }

    // Normalize whitespace and newlines - clean up excessive blank lines
    clean = clean.replace(/\n\s*\n\s*\n/g, '\n\n')
                 .replace(/^ *\n+/, '')  // Remove leading newlines
                 .replace(/\n+ *$/, ''); // Remove trailing newlines

    return clean.trim();
};

// --- ESTIMATORS ---

const estimateJHI = (job: ScrapedJob, salaryFrom: number | null): JHI => {
    let financial = 50;
    let timeCost = 50;
    let mentalLoad = 50;
    let growth = 50;
    let values = 50;

    const desc = (job.description || "").toLowerCase();

    // Financial Score
    if (salaryFrom) {
        if (salaryFrom > 100000) financial = 95;
        else if (salaryFrom > 70000) financial = 80;
        else if (salaryFrom > 50000) financial = 65;
        else if (salaryFrom > 35000) financial = 50;
        else financial = 30;
    }

    // Keywords Analysis
    if (desc.includes('remote') || desc.includes('home office')) timeCost += 20;
    if (desc.includes('přesčas') || desc.includes('směny')) timeCost -= 20;
    if (desc.includes('stres') || desc.includes('dynamické')) mentalLoad -= 15;
    if (desc.includes('přátelský') || desc.includes('rodinná')) mentalLoad += 15;
    if (desc.includes('vzdělávání') || desc.includes('školení')) growth += 20;

    const clamp = (n: number) => Math.max(0, Math.min(100, n));

    return {
        score: Math.round((financial + timeCost + mentalLoad + growth + values) / 5),
        financial: clamp(financial),
        timeCost: clamp(timeCost),
        mentalLoad: clamp(mentalLoad),
        growth: clamp(growth),
        values: clamp(values)
    };
};

// Helper: Haversine distance calculation
const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const estimateNoise = (text: string): NoiseMetrics => {
    const flags = [];
    const lower = text.toLowerCase();

    if (lower.includes('rodina')) flags.push('Jsme rodina');
    if (lower.includes('odolnost vůči stresu')) flags.push('Odolnost vůči stresu');
    if (lower.includes('dynamické prostředí')) flags.push('Dynamické prostředí');
    if (lower.includes('ninja') || lower.includes('rockstar')) flags.push('Ninja/Rockstar');

    const score = Math.min(100, flags.length * 20 + 10);

    return {
        score,
        flags,
        tone: score > 60 ? 'Hype-heavy' : score > 30 ? 'Casual' : 'Professional'
    };
};

// Job transformation helper
const transformJob = (scrapedJob: any): Job => {
    const salaryFrom = safeParseInt(scrapedJob.salary_from);
    const salaryTo = safeParseInt(scrapedJob.salary_to);
    const salaryRange = salaryFrom && salaryTo ? `${salaryFrom.toLocaleString('cs-CZ')} - ${salaryTo.toLocaleString('cs-CZ')} Kč` :
                       salaryFrom ? `od ${salaryFrom.toLocaleString('cs-CZ')} Kč` : 
                       salaryTo ? `až ${salaryTo.toLocaleString('cs-CZ')} Kč` : 'Mzda neuvedena';
    
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
        jhi: estimateJHI(scrapedJob, salaryFrom),
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
        salary_to: salaryTo || undefined
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
            .select('*', { count: 'exact', head: true });

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
    radiusKm: number = 50
): Promise<{ jobs: Job[], hasMore: boolean, totalCount: number }> => {
    if (!isSupabaseConfigured() || !supabase) {
        console.warn("Supabase not configured.");
        return { jobs: [], hasMore: false, totalCount: 0 };
    }

    try {
        // If user coordinates provided, use spatial query
        if (userLat && userLng) {
            console.log(`🗺️  Using spatial search for location: ${userLat}, ${userLng}, radius: ${radiusKm}km`);
            
            const { data, error } = await supabase
                .rpc('search_jobs_minimal', {
                    user_lat: userLat,
                    user_lng: userLng,
                    radius_km: radiusKm,
                    limit_count: pageSize,
                    offset_count: page * pageSize
                });

            if (error) {
                console.error('Spatial query error:', error);
                // Fallback to regular query if spatial function not ready
                return fetchJobsPaginatedFallback(page, pageSize, userLat, userLng, radiusKm);
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
                    lng: row.lng
                });
                
                // Add distance information
                (job as any).distance_km = row.distance_km;
                return job;
            });

            // Filter by quality standards and remove duplicates
            const filteredJobs = filterJobsByQuality(processedJobs);

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
        return fetchJobsPaginatedFallback(page, pageSize);

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
    _radiusKm?: number // Not used in fallback
): Promise<{ jobs: Job[], hasMore: boolean, totalCount: number }> => {
    try {
        // Get total count first
        const totalCount = await getJobCount();
        
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .range(from, to)
            .order('scraped_at', { ascending: false });

        if (error) {
            console.error(`Error fetching page ${page}:`, error);
            return { jobs: [], hasMore: false, totalCount };
        }

        if (!data || data.length === 0) {
            return { jobs: [], hasMore: false, totalCount };
        }

        console.log(`📋 Fallback: Fetched ${data.length} jobs (page ${page}, total: ${totalCount})`);

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
    limit: number = 100
): Promise<Job[]> => {
    if (!isSupabaseConfigured() || !supabase || !searchTerm.trim()) {
        return [];
    }

    try {
        // Use text search for better performance
        const { data, error } = await supabase
            .from('jobs')
            .select('*')
            .or(`title.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`)
            .order('scraped_at', { ascending: false })
            .limit(limit);

        if (error) {
            console.error("Error searching jobs:", error);
            return [];
        }

        if (!data || data.length === 0) {
            return [];
        }

        const allJobs = mapJobs(data);
        const validJobs = filterJobsByQuality(allJobs);
        
        return validJobs;

    } catch (e) {
        console.error("Error in searchJobs:", e);
        return [];
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

            let salaryRange = undefined;
            if (salaryFrom) {
                salaryRange = `${salaryFrom.toLocaleString()} Kč`;
                if (salaryTo) {
                    salaryRange += ` - ${salaryTo.toLocaleString()} Kč`;
                }
            } else {
                salaryRange = "Mzda neuvedena";
            }

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
                jhi: estimateJHI(scraped, salaryFrom),
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
                required_skills: []
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

    // Check description exists and has minimum length (500 characters)
    if (!job.description || 
        typeof job.description !== 'string' ||
        job.description.trim().length < 500) {
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