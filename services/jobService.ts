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
}

// --- CONFIG ---

// Patterns to detect benefits in description text if structured data is missing
const BENEFIT_PATTERNS = [
    { label: 'Stravenky', regex: /stravenk|příspěvek na stravování|jídeln|oběd/i },
    { label: 'MultiSport', regex: /multisport|sportovn/i },
    { label: '5 týdnů dovolené', regex: /5 týdnů|25 dnů|týden dovolené navíc/i },
    { label: 'Služební auto', regex: /služební (auto|vůz|vozidlo)|auto i pro soukromé/i },
    { label: 'Penzijní připojištění', regex: /penzijní|životní pojištění/i },
    { label: 'Sick Days', regex: /sick\s*days|zdravotní volno/i },
    { label: 'Flexibilní doba', regex: /flexibilní|pružná/i },
    { label: 'Home Office', regex: /home\s*office|práce z domova|remote/i },
    { label: 'Cafeteria', regex: /cafeteria|kafeterie|benefity na míru/i },
    { label: 'Občerstvení', regex: /občerstvení|káva|ovoce/i },
    { label: 'Hardware', regex: /macbook|notebook|telefon/i },
    { label: 'Vzdělávání', regex: /školení|kurzy|konference|vzdělávání/i }
];

// --- PARSING HELPERS ---

const getRelativeTime = (dateString?: string | null): string => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';

        const now = new Date();
        const diffTime = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));

        if (diffHours < 1) return 'Před chvílí';
        if (diffHours < 24) return `před ${diffHours} hod.`;
        if (diffDays === 1) return 'Včera';
        return `před ${diffDays} dny`;
    } catch (e) {
        return 'N/A';
    }
};

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
            .replace(/<\/li>/gi, '\n')
            .replace(/<li>/gi, '- ')
            .replace(/&nbsp;/g, ' ');
        // Strip remaining tags
        clean = clean.replace(/<[^>]*>/g, '');
    }

    // Normalize newlines
    clean = clean.replace(/\n\s*\n\s*\n/g, '\n\n');

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
    pageSize: number = 50
): Promise<{ jobs: Job[], hasMore: boolean, totalCount: number }> => {
    if (!isSupabaseConfigured() || !supabase) {
        console.warn("Supabase not configured.");
        return { jobs: [], hasMore: false, totalCount: 0 };
    }

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

        const jobs = mapJobs(data);
        const hasMore = (from + pageSize) < totalCount;

        return { jobs, hasMore, totalCount };

    } catch (e) {
        console.error("Error in fetchJobsPaginated:", e);
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

        return mapJobs(data);

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

const mapJobs = (data: any[]): Job[] => {
    const mappedJobs = data.map((item: any): Job | null => {
        try {
            const scraped = item as ScrapedJob;

            // 1. Description Processing
            const fullDesc = formatDescription(scraped.description);

            if (fullDesc.length < 20) { // More permissive length check
                console.log(`Skipping job ${scraped.id} due to short description: ${fullDesc.substring(0, 50)}...`);
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

            // 4. Tag Generation (Refined to prioritize Location)
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

            return {
                id: `db-${scraped.id}`,
                title: scraped.title || (scraped.company ? `${scraped.company} - Pozice` : 'Pozice bez názvu'),
                company: scraped.company || 'Neznámá společnost',
                location: locationString,
                type: jobType,
                salaryRange: salaryRange,
                description: fullDesc,
                postedAt: getRelativeTime(scraped.scraped_at),
                scrapedAt: scraped.scraped_at, // Safe mapping, even if undefined
                source: scraped.source || 'Scraper',
                url: scraped.url,
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