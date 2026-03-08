import { supabase, isSupabaseConfigured, isSupabaseNetworkCooldownActive, noteSupabaseNetworkFailure } from './supabaseService';
import { Job, JHI, JHIPreferences, JobHiringStage, TaxProfile } from '../types';
import { contextualRelevanceScorer, ContextualRelevanceScorer } from './contextualRelevanceService';
import { calculateJHI } from '../utils/jhiCalculator';
import { matchesIcoKeywords, matchesFullTimeKeywords, matchesPartTimeKeywords, matchesBrigadaKeywords } from '../utils/contractType';
import { detectCurrency, detectCurrencyFromLocation, estimateNetSalaryByCountry } from './financialService';
import { geocodeWithCaching } from './geocodingService';
import { isRemoteJob } from './commuteService';
import i18n from '../src/i18n';
import { BACKEND_URL, SEARCH_BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';
import { recordRuntimeSignal } from './runtimeSignals';
import { estimateNoise } from '../utils/noise';
import { deriveChallengeFields } from './challengeContentService';

const EMPTY_JHI: JHI = {
    score: 0,
    baseScore: 0,
    personalizedScore: 0,
    financial: 0,
    timeCost: 0,
    mentalLoad: 0,
    growth: 0,
    values: 0,
    explanations: []
};

// Loose interface to accept whatever Supabase returns
interface ScrapedJob {
    id: number | string;
    company_id?: string | number | null;
    title?: string;
    company?: string;
    location?: string;
    description?: string;
    role_summary?: string | null;
    first_reply_prompt?: string | null;
    company_truth_hard?: string | null;
    company_truth_fail?: string | null;
    benefits?: string[] | string | null;
    contract_type?: string;
    salary_from?: number | string;
    salary_to?: number | string;
    currency?: string;
    salary_currency?: string;
    salary_timeframe?: string;
    work_type?: string;
    work_model?: string;
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
    open_dialogues_count?: number | string;
    dialogue_capacity_limit?: number | string;
    reaction_window_hours?: number | string;
    reaction_window_days?: number | string;
}

// ... (skipping constants)

// --- HELPERS ---

const safeParseInt = (value: any): number | undefined => {
    if (value === undefined || value === null) return undefined;
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? undefined : parsed;
};

const hasShortSalaryTimeframe = (salaryTimeframe: unknown, contextText: string): boolean => {
    const timeframe = String(salaryTimeframe || '').toLowerCase();
    if (timeframe === 'hour' || timeframe === 'day' || timeframe === 'week') return true;

    const context = (contextText || '').toLowerCase();
    return (
        /(^|[^\w])(kč|kc|czk)\s*\/\s*h([^\w]|$)/i.test(context) ||
        /(^|[^\w])\/\s*(h|hod|hod\.|hodin|hour|day|den|week|tyd)([^\w]|$)/i.test(context) ||
        /\b(hodinov[aá]|hourly|denn[ií]|daily|t[ýy]denn[ií]|weekly)\b/i.test(context)
    );
};

const normalizeSalaryAmount = (
    value: number | undefined,
    salaryTimeframe: unknown,
    contextText: string,
    currency?: unknown
): number | undefined => {
    if (!value) return value;
    if (value >= 1000) return value;
    if (hasShortSalaryTimeframe(salaryTimeframe, contextText)) return value;
    const context = (contextText || '').toLowerCase();
    const cur = String(currency || '').toLowerCase();
    const hasThousandMarker = /\b(k|tis|tis[ií]c|thousand)\b/i.test(context);

    // Conservative guard: values like 150-300 CZK are often hourly ranges.
    if (!hasThousandMarker && (cur.includes('kč') || cur.includes('czk')) && value >= 80 && value <= 500) {
        return value;
    }
    return value * 1000;
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
    if (Number.isNaN(date.getTime())) return '';

    const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat(i18n.language || 'en', { numeric: 'auto' });

    if (diffInSeconds < 60) return rtf.format(0, 'second');
    if (diffInSeconds < 3600) return rtf.format(-Math.floor(diffInSeconds / 60), 'minute');
    if (diffInSeconds < 86400) return rtf.format(-Math.floor(diffInSeconds / 3600), 'hour');
    if (diffInSeconds < 604800) return rtf.format(-Math.floor(diffInSeconds / 86400), 'day');
    return rtf.format(-Math.floor(diffInSeconds / 604800), 'week');
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

const HIRING_STAGE_PATTERN = /^\s*<!--\s*jobshaman:hiring_stage=([a-z_]+)\s*-->\s*/i;

const normalizeJobHiringStage = (raw: unknown): JobHiringStage | undefined => {
    if (typeof raw !== 'string') return undefined;
    const normalized = raw.trim().toLowerCase();
    if (
        normalized === 'collecting_cvs' ||
        normalized === 'reviewing_first_10' ||
        normalized === 'shortlisting' ||
        normalized === 'final_interviews' ||
        normalized === 'offer_stage'
    ) {
        return normalized as JobHiringStage;
    }
    return undefined;
};

const extractHiringStageMetadata = (desc?: string): { description: string; hiringStage?: JobHiringStage } => {
    const source = desc || '';
    const match = HIRING_STAGE_PATTERN.exec(source);
    if (!match) {
        return { description: source };
    }
    const hiringStage = normalizeJobHiringStage(match[1]);
    return {
        description: source.slice(match[0].length).trimStart(),
        hiringStage
    };
};

const BENEFIT_PATTERNS = [
    { regex: /flexibiln[íi]|pružn[áa] prac|flexible|flexibel|gleitzeit|elastyczn/i, label: 'Flexibilní pracovní doba' },
    { regex: /dovolen[áa] [5-9]|5 t[ýy]dn[ůu]|25 dn[ůu]|weeks of vacation|urlaub|urlop/i, label: '5 týdnů dovolené' },
    { regex: /home office|práce z domova|remote|homeoffice|arbeit von zu hause|praca zdalna/i, label: 'Home Office' },
    { regex: /\bstravenk|\bstrav|e-stravenk|meal voucher|essens|mittagessen|kantine|bony żywieniowe|karta lunchowa/i, label: 'Stravenky' },
    { regex: /multisport|sportpaket|karta multisport|pakiet sportowy/i, label: 'Multisport karta' },
    { regex: /sick days|zdravotn[íi] volno|krankentage|dni chorobowe/i, label: 'Sick days' },
    { regex: /notebook|počítač|laptop|arbeitslaptop/i, label: 'Notebook' },
    { regex: /telefon|mobil|diensthandy|firmenhandy|telefon służbowy/i, label: 'Mobilní telefon' },
    { regex: /vzděláv|školen[íi]|training|education|weiterbildung|szkolen|kursy/i, label: 'Vzdělávací kurzy' },
    { regex: /služebn[íi] auto|firemn[íi] auto|company car|firmenwagen|dienstwagen|car allowance|samoch[oó]d służbowy|auto pro osobn[íi]/i, label: 'Služební auto' },
    { regex: /parking|parkov[aá]n[íi]|parkovac[íi] m[ií]sto|mhd|doprav|public transport|fahrkarte|fahrkost|commuter|jízdn[ée]|benz[ií]n/i, label: 'Doprava a parkování' },
    { regex: /private medical|medical care|healthcare|zdravotn[íi] p[eé]če|zdravotn[íi] pojišt|health insurance|krankenversicherung|opieka medyczna|ubezpieczenie zdrowotne/i, label: 'Zdravotní péče' },
    { regex: /penzijn[íi]|důchodov[ée] spořen[íi]|retirement|pension plan|401k|renten|altersvorsorge|emerytal/i, label: 'Penzijní spoření' },
    { regex: /childcare|dětsk[áe] skupin|školk|jesle|kindergarten|kinderbetreuung|przedszkol|opieka nad d[ěe]tmi/i, label: 'Podpora péče o děti' },
    { regex: /relocation|přestěhov|ubytov[aá]n[íi]|housing allowance|accommodation|relokačn[íi]|wohnung|zakwaterowanie/i, label: 'Relokace a bydlení' },
    { regex: /stock option|stock options|equity|esop|akcie|share option|mitarbeiteraktien|aktienoptionen|opcje na akcje/i, label: 'Zaměstnanecké akcie' }
];

// Job transformation helper
const transformJob = (scrapedJob: any, includeJhi: boolean = true): Job => {
    const salaryContext = `${scrapedJob.title || ''} ${scrapedJob.description || ''}`;
    const salaryFrom = normalizeSalaryAmount(
        safeParseInt(scrapedJob.salary_from),
        scrapedJob.salary_timeframe,
        salaryContext,
        scrapedJob.salary_currency || scrapedJob.currency
    );
    const salaryTo = normalizeSalaryAmount(
        safeParseInt(scrapedJob.salary_to),
        scrapedJob.salary_timeframe,
        salaryContext,
        scrapedJob.salary_currency || scrapedJob.currency
    );
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

    const extractedDescription = extractHiringStageMetadata(scrapedJob.description);
    const hiringStage = normalizeJobHiringStage((scrapedJob as any)?.hiring_stage) || extractedDescription.hiringStage;
    const fullDesc = extractedDescription.description || 'Popis pozice není k dispozici.';
    const challengeFields = deriveChallengeFields({
        title: scrapedJob.title,
        description: fullDesc,
        source: scrapedJob.source,
        role_summary: scrapedJob.role_summary,
        first_reply_prompt: scrapedJob.first_reply_prompt,
        company_truth_hard: scrapedJob.company_truth_hard,
        company_truth_fail: scrapedJob.company_truth_fail
    });
    const openDialoguesCount = safeParseInt(scrapedJob.open_dialogues_count);
    const dialogueCapacityLimit = safeParseInt(scrapedJob.dialogue_capacity_limit);
    const reactionWindowHours = safeParseInt(scrapedJob.reaction_window_hours);
    const reactionWindowDays = safeParseInt(scrapedJob.reaction_window_days);

    const jhi = includeJhi
        ? calculateJHI({
            salary_from: salaryFrom ?? undefined,
            salary_to: salaryTo ?? undefined,
            type: scrapedJob.work_type as any,
            benefits: benefits,
            description: fullDesc,
            location: locationString
        })
        : EMPTY_JHI;

    return {
        id: String(scrapedJob.id),
        company_id: scrapedJob.company_id ? String(scrapedJob.company_id) : undefined,
        title: scrapedJob.title || (scrapedJob.company ? `${scrapedJob.company} - Pozice` : 'Pozice bez názvu'),
        company: scrapedJob.company || 'Neznámá společnost',
        location: locationString,
        type: jobType,
        work_model: scrapedJob.work_model,
        salaryRange,
        description: fullDesc,
        hiring_stage: hiringStage,
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
        challenge: challengeFields.challenge,
        risk: challengeFields.risk,
        firstStepPrompt: challengeFields.firstStepPrompt,
        listingKind: challengeFields.listingKind,
        companyPageSummary: challengeFields.companyPageSummary,
        salary_from: salaryFrom || undefined,
        salary_to: salaryTo || undefined,
        salary_timeframe: scrapedJob.salary_timeframe,
        country_code: scrapedJob.country_code,
        language_code: scrapedJob.language_code,
        // Map cached AI analysis if present
        aiAnalysis: scrapedJob.ai_analysis,
        ...(openDialoguesCount !== undefined ? { open_dialogues_count: openDialoguesCount } : {}),
        ...(dialogueCapacityLimit !== undefined ? { dialogue_capacity_limit: dialogueCapacityLimit } : {}),
        ...(reactionWindowHours !== undefined ? { reaction_window_hours: reactionWindowHours } : {}),
        ...(reactionWindowDays !== undefined ? { reaction_window_days: reactionWindowDays } : {})
    };
};

// --- API ---

const isTransientSupabaseError = (err: unknown): boolean => {
    const msg = String((err as any)?.message || err || '').toLowerCase();
    const code = String((err as any)?.code || '').toLowerCase();
    const status = Number((err as any)?.status || (err as any)?.statusCode || 0);
    return (
        msg.includes('networkerror') ||
        msg.includes('failed to fetch') ||
        msg.includes('fetch resource') ||
        msg.includes('statement timeout') ||
        msg.includes('cors') ||
        code === '57014' ||
        status >= 500
    );
};

export const getJobCount = async (): Promise<number> => {
    if (!isSupabaseConfigured() || !supabase) {
        console.warn("Supabase not configured.");
        return 0;
    }
    if (isSupabaseNetworkCooldownActive()) return 0;

    try {
        let count: number | null = null;
        let error: any = null;
        const selectCount = async (buildQuery: (mode: 'exact' | 'planned') => any) => {
            const exact = await buildQuery('exact');
            if (!exact.error) return exact;
            const planned = await buildQuery('planned');
            return planned;
        };

        // Preferred definition for landing stat: truly active job offers.
        // Some environments have `status`, some only `is_active`; handle both.
        const primary = await selectCount((mode) =>
            supabase
                .from('jobs')
                .select('id', { count: mode, head: true })
                .eq('is_active', true)
                .eq('status', 'active')
        );
        count = primary.count;
        error = primary.error;

        if (error && String(error.message || '').toLowerCase().includes("column jobs.status does not exist")) {
            const fallback = await selectCount((mode) =>
                supabase
                    .from('jobs')
                    .select('id', { count: mode, head: true })
                    .eq('is_active', true)
            );
            count = fallback.count;
            error = fallback.error;
        }

        if (error) {
            noteSupabaseNetworkFailure('getJobCount', error);
            if (isTransientSupabaseError(error) || isSupabaseNetworkCooldownActive()) return 0;
            console.warn("Job count query failed, returning 0 fallback:", error);
            return 0;
        }

        return count || 0;
    } catch (e) {
        noteSupabaseNetworkFailure('getJobCount.catch', e);
        if (isTransientSupabaseError(e) || isSupabaseNetworkCooldownActive()) return 0;
        console.error("Error in getJobCount:", e);
        return 0;
    }
};

export const getTodayAnalyzedCount = async (): Promise<number> => {
    if (!isSupabaseConfigured() || !supabase) {
        console.warn("Supabase not configured.");
        return 0;
    }
    if (isSupabaseNetworkCooldownActive()) return 0;

    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const selectCount = async (buildQuery: (mode: 'exact' | 'planned') => any) => {
            const exact = await buildQuery('exact');
            if (!exact.error) return exact;
            const planned = await buildQuery('planned');
            return planned;
        };

        // "Reviewed on JHI today" = jobs updated today that already passed legality/JHI screening.
        // Prefer updated_at; if status column is unavailable, fallback gracefully.
        let count: number | null = null;
        let error: any = null;

        const withStatus = await selectCount((mode) =>
            supabase
                .from('jobs')
                .select('id', { count: mode, head: true })
                .eq('is_active', true)
                .eq('status', 'active')
                .in('legality_status', ['legal', 'review', 'illegal'])
                .gte('updated_at', startOfDay.toISOString())
        );
        count = withStatus.count;
        error = withStatus.error;

        if (error && String(error.message || '').toLowerCase().includes("column jobs.status does not exist")) {
            const withoutStatus = await selectCount((mode) =>
                supabase
                    .from('jobs')
                    .select('id', { count: mode, head: true })
                    .eq('is_active', true)
                    .in('legality_status', ['legal', 'review', 'illegal'])
                    .gte('updated_at', startOfDay.toISOString())
            );
            count = withoutStatus.count;
            error = withoutStatus.error;
        }

        if (error) {
            noteSupabaseNetworkFailure('getTodayAnalyzedCount', error);
            if (isTransientSupabaseError(error) || isSupabaseNetworkCooldownActive()) return 0;
            console.warn("Today's analyzed count query failed, returning 0 fallback:", error);
            return 0;
        }

        // Some pipelines only fill created_at meaningfully for daily batches.
        // If updated_at is not maintained and result is zero, use created_at fallback.
        if (!count || count <= 0) {
            const createdFallback = await selectCount((mode) =>
                supabase
                    .from('jobs')
                    .select('id', { count: mode, head: true })
                    .eq('is_active', true)
                    .in('legality_status', ['legal', 'review', 'illegal'])
                    .gte('created_at', startOfDay.toISOString())
            );
            if (!createdFallback.error && Number.isFinite(createdFallback.count)) {
                return createdFallback.count || 0;
            }
        }

        return count || 0;
    } catch (e) {
        noteSupabaseNetworkFailure('getTodayAnalyzedCount.catch', e);
        if (isTransientSupabaseError(e) || isSupabaseNetworkCooldownActive()) return 0;
        console.error("Error in getTodayAnalyzedCount:", e);
        return 0;
    }
};

export const fetchJobsPaginated = async (
    page: number = 0,
    pageSize: number = 50,
    userLat?: number,
    userLng?: number,
    radiusKm: number = 50,
    countryCode?: string,
    includeJhi: boolean = true
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
                return fetchJobsPaginatedFallback(page, pageSize, userLat, userLng, radiusKm, countryCode, undefined, includeJhi);
            }

            if (!data || data.length === 0) {
                console.log('🔍 No jobs found within radius');
                return { jobs: [], hasMore: false, totalCount: 0 };
            }

            // Process results with distance information
            const processedJobs = data.map((row: any) => {
                const job = transformJob({
                    id: row.id,
                    company_id: row.company_id,
                    title: row.title,
                    company: row.company,
                    location: row.location,
                    description: row.description,
                    role_summary: row.role_summary,
                    first_reply_prompt: row.first_reply_prompt,
                    company_truth_hard: row.company_truth_hard,
                    company_truth_fail: row.company_truth_fail,
                    benefits: row.benefits,
                    contract_type: row.contract_type,
                    salary_from: row.salary_from,
                    salary_to: row.salary_to,
                    salary_timeframe: row.salary_timeframe,
                    work_type: row.work_type,
                    scraped_at: row.scraped_at,
                    source: row.source,
                    education_level: row.education_level,
                    url: row.url,
                    lat: row.lat,
                    lng: row.lng,
                    country_code: row.country_code
                }, includeJhi);

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
        return fetchJobsPaginatedFallback(page, pageSize, undefined, undefined, undefined, countryCode, undefined, includeJhi);

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
    countryCode?: string,
    languageCodes?: string[],
    includeJhi: boolean = true
): Promise<{ jobs: Job[], hasMore: boolean, totalCount: number }> => {
    try {
        // Get total count first
        const totalCount = await getJobCount();

        const from = page * pageSize;
        const to = from + pageSize - 1;

        const listSelect = includeJhi
            ? '*'
            : 'id,title,company,location,description,benefits,contract_type,salary_from,salary_to,salary_timeframe,work_type,work_model,scraped_at,source,education_level,url,lat,lng,country_code,language_code,legality_status,verification_notes';
        let query = supabase
            .from('jobs')
            .select(listSelect)
            .eq('legality_status', 'legal');

        // Apply country code filter if provided
        if (countryCode) {
            query = query.eq('country_code', countryCode);
        }
        if (languageCodes && languageCodes.length > 0) {
            query = query.in('language_code', languageCodes);
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
            const transformed = transformJob(job, includeJhi);
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
            .ilike('title', `%${searchTerm}%`);

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

        const processedJobs = mapJobs(data, undefined, undefined, true);
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
    excludeCountryCodes?: string[];
    // Languages
    filterLanguageCodes?: string[];
    searchTerm?: string;
    sortMode?: 'default' | 'newest' | 'jhi_desc' | 'recommended' | 'distance' | 'salary_desc';
    jhiPreferences?: JHIPreferences;
    userTaxProfile?: TaxProfile;
    abortSignal?: AbortSignal;
    includeJhi?: boolean;
}

const isSearchV2Enabled = (): boolean => {
    const flag = String(import.meta.env.VITE_SEARCH_V2_ENABLED ?? 'true').toLowerCase();
    return flag !== '0' && flag !== 'false' && flag !== 'off';
};

const BACKEND_HYBRID_MAX_PAGE_SIZE = 200;
const SUPABASE_RPC_MAX_PAGE_SIZE = 200;
const STRICT_FALLBACK_MULTIPLIER = 4;
const STRICT_FALLBACK_MAX_WINDOW = 400;
let lastHybridFallbackWarnAt = 0;

const normalizeBackendBaseUrl = (value?: string): string | null => {
    if (!value) return null;
    try {
        const raw = String(value).trim();
        if (!raw) return null;
        const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
        const url = new URL(withProtocol);
        return `${url.origin}${url.pathname.replace(/\/$/, '')}`;
    } catch {
        return null;
    }
};

const resolveHybridBackendBases = (): string[] => {
    const searchBase = normalizeBackendBaseUrl(SEARCH_BACKEND_URL);
    const coreBase = normalizeBackendBaseUrl(BACKEND_URL);

    const bases = [searchBase, coreBase].filter((base): base is string => !!base);
    return Array.from(new Set(bases));
};

const hasDedicatedSearchRuntime = (): boolean => {
    const searchBase = normalizeBackendBaseUrl(SEARCH_BACKEND_URL);
    const coreBase = normalizeBackendBaseUrl(BACKEND_URL);
    return !!searchBase && !!coreBase && searchBase !== coreBase;
};

const isNetworkFetchError = (err: unknown): boolean => {
    const msg = String((err as any)?.message || err || '').toLowerCase();
    return msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('cors');
};

const isAbortFetchError = (err: unknown): boolean => {
    if ((err as any)?.name === 'AbortError') {
        return true;
    }
    const msg = String((err as any)?.message || err || '').toLowerCase();
    return msg.includes('operation was aborted') || msg.includes('aborted');
};

const createAbortError = (): Error => {
    const error = new Error('The operation was aborted.');
    (error as any).name = 'AbortError';
    return error;
};

const normalizeTokenText = (input: string): string =>
    input
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase();

const appendContractType = (values: string[], value: string): string[] => {
    const key = normalizeTokenText(value);
    const seen = new Set(values.map((item) => normalizeTokenText(item)));
    if (seen.has(key)) return values;
    return [...values, value];
};

const normalizeSearchForContracts = (input: string): string =>
    normalizeTokenText(input).replace(/[^a-z0-9]+/g, ' ').trim();

const normalizeBenefitText = (input: string): string =>
    normalizeTokenText(input).replace(/[^a-z0-9]+/g, ' ').trim();

const BENEFIT_TAG_PATTERNS: Record<string, RegExp[]> = {
    home_office: [
        /\bhome office\b/,
        /\bhomeoffice\b/,
        /\bwork from home\b/,
        /\bremote\b/,
        /\btelework\b/,
        /\bprace z domova\b/,
        /\bpraca z domu\b/,
        /\bz domova\b/,
        /\bna dalku\b/,
        /\bzdaln/
    ],
    dog_friendly: [
        /\bdog friendly\b/,
        /\bdogfriendly\b/,
        /\bpet friendly\b/,
        /\bpets allowed\b/,
        /\bdog\b/,
        /\bdogs\b/,
        /\bpet\b/,
        /\bpets\b/,
        /\bpsi\b/,
        /\bpes\b/,
        /\bpsu\b/,
        /\bpsa\b/,
        /\bpejsek\b/,
        /\bhund\b/,
        /\bhaustier\b/,
        /\bzwierzeta\b/
    ],
    child_friendly: [
        /\bchild friendly\b/,
        /\bchildren friendly\b/,
        /\bkids friendly\b/,
        /\bkids\b/,
        /\bchildren\b/,
        /\bchild\b/,
        /\bfamily friendly\b/,
        /\bdetsk/,
        /\bdetem\b/,
        /\bdeti\b/,
        /\bdziec/,
        /\bdzieci\b/,
        /\brodin/,
        /\bkinder\b/,
        /\bkindergarten\b/,
        /\bprzedszkol/,
        /\bskolk/
    ],
    flex_time: [
        /\bflexibil/,
        /\bflexible\b/,
        /\bflexitime\b/,
        /\bflexi time\b/,
        /\bpruzn/,
        /\bgleitzeit\b/,
        /\belastyczn/,
        /\bruchomy czas\b/,
        /\bflex\b/
    ],
    education: [
        /\bvzdel/,
        /\bskolen/,
        /\btraining\b/,
        /\bkurs\b/,
        /\bcourse\b/,
        /\bcertifik/,
        /\bweiterbildung\b/,
        /\bszkolen/,
        /\bstudium\b/
    ],
    multisport: [
        /\bmultisport\b/,
        /\bsport card\b/,
        /\bkarta multisport\b/,
        /\bpakiet sport/,
        /\bsportpaket\b/,
        /\bkarta sport\b/
    ],
    meal_allowance: [
        /\bstraven/,
        /\bstrav/,
        /\bmeal\b/,
        /\blunch\b/,
        /\bobed\b/,
        /\bobedy\b/,
        /\bkantin/,
        /\bessens/,
        /\bposilk/,
        /\bkarta lunch\b/,
        /\blunch card\b/
    ],
    transport_support: [
        /\bparking\b/,
        /\bparkov/,
        /\bparkplace\b/,
        /\bpublic transport\b/,
        /\btransport\b/,
        /\btransit\b/,
        /\bfahrkarte\b/,
        /\bfahrkost/,
        /\bcommuter\b/,
        /\bjizdne\b/,
        /\bbenzin\b/,
        /\bpalivo\b/
    ],
    vacation_5w: [
        /\b5 tydn/,
        /\b5 tydnu\b/,
        /\b5 tydny\b/,
        /\b25 dn\b/,
        /\b25 dni\b/,
        /\b25 days\b/,
        /\b5 weeks\b/,
        /\b5 week\b/,
        /\b5 woch\b/,
        /\b5 wochen\b/,
        /\b5 tygodni\b/,
        /\b25 tage\b/
    ],
    health_care: [
        /\bprivate medical\b/,
        /\bmedical care\b/,
        /\bhealthcare\b/,
        /\bhealth care\b/,
        /\bzdravotn/,
        /\bhealth insurance\b/,
        /\bkrankenversicherung\b/,
        /\bopieka medyczna\b/,
        /\bubezpieczenie zdrowotne\b/
    ],
    pension: [
        /\bpenzij/,
        /\bduchodov/,
        /\bretirement\b/,
        /\bpension\b/,
        /\b401k\b/,
        /\brenten/,
        /\baltersvorsorge\b/,
        /\bemerytal/
    ],
    childcare_support: [
        /\bchildcare\b/,
        /\bdaycare\b/,
        /\bdetsk/,
        /\bskolk/,
        /\bjesle\b/,
        /\bkindergarten\b/,
        /\bkinderbetreuung\b/,
        /\bprzedszkol/,
        /\bopieka nad d/
    ],
    relocation_support: [
        /\brelocation\b/,
        /\brelokac/,
        /\bprestehov/,
        /\bubytov/,
        /\bhousing allowance\b/,
        /\baccommodation\b/,
        /\bwohnung\b/,
        /\bzakwaterowanie\b/
    ],
    employee_shares: [
        /\bakcie\b/,
        /\bstock option\b/,
        /\bstock options\b/,
        /\bstock\b/,
        /\bequity\b/,
        /\bshare option\b/,
        /\bshare options\b/,
        /\besop\b/,
        /\bmitarbeiteraktien\b/,
        /\baktienoptionen\b/,
        /\bopcje na akcje\b/
    ],
    car_personal: [
        /\bsluzebni auto\b/,
        /\bfiremni auto\b/,
        /\bcompany car\b/,
        /\bfirmenwagen\b/,
        /\bdienstwagen\b/,
        /\bauto sluzbowe\b/,
        /\bsamochod sluzbowy\b/,
        /\bauto pro osobni\b/,
        /\bauto do uzytku\b/,
        /\bcar allowance\b/,
        /\bpersonal use\b/
    ]
};

const deriveBenefitTagsFromText = (text: string): string[] => {
    const normalized = normalizeBenefitText(text || '');
    if (!normalized) return [];
    const tags: string[] = [];
    Object.entries(BENEFIT_TAG_PATTERNS).forEach(([tag, patterns]) => {
        if (patterns.some((pattern) => pattern.test(normalized))) {
            tags.push(tag);
        }
    });
    return tags;
};

const splitBenefitFilters = (filters: string[]): { tags: string[]; tokens: string[] } => {
    const tagSet = new Set<string>();
    const tokenFilters: string[] = [];
    for (const raw of filters) {
        const text = String(raw || '').trim();
        if (!text) continue;
        const tags = deriveBenefitTagsFromText(text);
        if (tags.length > 0) {
            tags.forEach((tag) => tagSet.add(tag));
            continue;
        }
        const token = normalizeBenefitText(text);
        if (token) tokenFilters.push(token);
    }
    return { tags: Array.from(tagSet), tokens: tokenFilters };
};

const stripContractKeywords = (input: string): string => {
    if (!input) return '';
    let cleaned = normalizeSearchForContracts(input);
    if (!cleaned) return '';
    const patterns = [
        /\b(ico|osvc|szco|zivnost|zivnostensk|b2b|freelanc\w*|contractor|self employed|selfemployed|dzialalnosc|gospodarcza)\b/g,
        /\b(hpp|plny\s+uvazek|plny\s+pracovn\w*|pracovni\s+pomer|pracovny\s+pomer|pracovn\w*\s+smlouv\w*|pracovn\w*\s+zmluv\w*|full\s*time|fulltime|vollzeit|umowa\s+o\s+prace|pelny\s+etat|festanstell\w*|arbeitsvertrag|employment\s+contract|contract\s+of\s+employment)\b/g,
        /\b(part\s*time|parttime|teilzeit|zkracen\w*|skracen\w*|castecn\w*|skrat\w*|polovicn\w*|kratk\w*\s+uvazek|niepelny\s+etat|czesc\s+etatu)\b/g,
        /\b(brigad\w*|dpp|dpc|dohod\w*|minijob|aushilfe|umowa\s+zlecenie|umowa\s+o\s+dzielo|temporary|temp|seasonal|casual)\b/g
    ];
    for (const pattern of patterns) {
        cleaned = cleaned.replace(pattern, ' ');
    }
    return cleaned.replace(/\s+/g, ' ').trim();
};

const deriveContractSearchOverrides = (
    rawSearchTerm?: string,
    rawContractTypes?: string[]
): {
    searchTerm: string;
    contractTypes: string[];
    hasContractIntent: boolean;
} => {
    const searchText = (rawSearchTerm || '').trim();
    const contractTypes = Array.isArray(rawContractTypes) ? rawContractTypes : [];
    const normalizedContractTypes = contractTypes.map((ct) => normalizeTokenText(String(ct)));

    const detected: string[] = [];
    if (searchText && matchesIcoKeywords(searchText)) detected.push('IČO');
    if (searchText && matchesFullTimeKeywords(searchText)) detected.push('HPP');
    if (searchText && matchesPartTimeKeywords(searchText)) detected.push('Part-time');
    if (searchText && matchesBrigadaKeywords(searchText)) detected.push('Brigáda');

    let mergedContractTypes = contractTypes;
    for (const label of detected) {
        mergedContractTypes = appendContractType(mergedContractTypes, label);
    }

    const hasContractIntent = detected.length > 0 || normalizedContractTypes.includes('ico') || normalizedContractTypes.includes('hpp') || normalizedContractTypes.includes('part-time') || normalizedContractTypes.includes('brigada');

    let cleanedSearch = searchText;
    if (hasContractIntent && searchText) {
        const stripped = stripContractKeywords(searchText);
        if (stripped.length < 2) {
            cleanedSearch = '';
        } else {
            cleanedSearch = stripped;
        }
    }

    return {
        searchTerm: cleanedSearch,
        contractTypes: mergedContractTypes,
        hasContractIntent
    };
};

const escapeRegex = (input: string): string =>
    input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const containsWholeToken = (haystack: string, token: string): boolean => {
    if (!token) return false;
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(token)}([^\\p{L}\\p{N}]|$)`, 'u');
    return pattern.test(haystack);
};

const warnHybridFallbackThrottled = (error: unknown): void => {
    if (isAbortFetchError(error)) {
        return;
    }
    const now = Date.now();
    if (now - lastHybridFallbackWarnAt < 15_000) return;
    lastHybridFallbackWarnAt = now;
    recordRuntimeSignal('search_hybrid_unavailable', {
        error: String((error as any)?.message || error || ''),
    }, {
        dedupeKey: 'hybrid_unavailable',
        throttleMs: 15_000
    });
    console.warn('Hybrid search unavailable, falling back to RPC filters:', error);
};

const parseTimestampMs = (value?: string): number => {
    if (!value) return 0;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : 0;
};

const getDatePostedCutoffMs = (filterDatePosted: string): number | null => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    switch ((filterDatePosted || 'all').toLowerCase()) {
        case '24h':
            return now - dayMs;
        case '3d':
            return now - 3 * dayMs;
        case '7d':
            return now - 7 * dayMs;
        case '14d':
            return now - 14 * dayMs;
        default:
            return null;
    }
};

const sortJobsForMode = (
    jobs: Job[],
    sortMode: 'default' | 'newest' | 'jhi_desc' | 'recommended' | 'distance' | 'salary_desc'
): Job[] => {
    if (!jobs.length || sortMode === 'default' || sortMode === 'recommended') {
        return jobs;
    }

    const sorted = [...jobs];
    if (sortMode === 'newest') {
        return sorted.sort((a, b) => parseTimestampMs(b.scrapedAt) - parseTimestampMs(a.scrapedAt));
    }
    if (sortMode === 'jhi_desc') {
        return sorted.sort((a, b) => (b.jhi?.score || 0) - (a.jhi?.score || 0));
    }
    if (sortMode === 'distance') {
        return sorted.sort((a, b) => {
            const da = (a as any)?.distance_km ?? (a as any)?.distanceKm ?? Number.POSITIVE_INFINITY;
            const db = (b as any)?.distance_km ?? (b as any)?.distanceKm ?? Number.POSITIVE_INFINITY;
            return da - db;
        });
    }
    if (sortMode === 'salary_desc') {
        const toMonthly = (job: Job) => {
            let salary = 0;
            if ((job as any).salary_from && (job as any).salary_to) {
                salary = (Number((job as any).salary_from) + Number((job as any).salary_to)) / 2;
            } else {
                salary = Number((job as any).salary_from || (job as any).salary_to || 0);
            }
            if (!salary) return 0;
            const tf = String((job as any).salary_timeframe || '').toLowerCase();
            if (tf === 'hour' || tf === 'hourly') return Math.round(salary * 22 * 8);
            if (tf === 'day' || tf === 'daily') return Math.round(salary * 22);
            if (tf === 'week' || tf === 'weekly') return Math.round(salary * 4.345);
            if (tf === 'year' || tf === 'yearly' || tf === 'annual') return Math.round(salary / 12);
            return salary;
        };
        return sorted.sort((a, b) => toMonthly(b) - toMonthly(a));
    }
    return jobs;
};

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
        filterContractTypes: rawFilterContractTypes,
        filterBenefits,
        filterMinSalary,
        filterDatePosted = 'all',
        filterExperienceLevels,
        page = 0,
        pageSize = 50,
        countryCodes,
        excludeCountryCodes,
        filterLanguageCodes,
        searchTerm: rawSearchTerm,
        sortMode = 'default',
        jhiPreferences,
        userTaxProfile,
        abortSignal,
        includeJhi = true
    } = options;
    const effectiveSortMode = sortMode === 'recommended' ? 'newest' : sortMode;

    const HYBRID_SEARCH_TIMEOUT_MS = 4500;
    const createTimeoutError = (label: string) => {
        const err = new Error(`${label} timed out`);
        (err as any).code = 'timeout';
        (err as any).timeout = true;
        return err;
    };
    const raceWithTimeout = async <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const timeoutPromise = new Promise<T>((_, reject) => {
            timeoutId = setTimeout(() => reject(createTimeoutError(label)), timeoutMs);
        });
        try {
            return await Promise.race([promise, timeoutPromise]);
        } finally {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
        }
    };

    const {
        searchTerm,
        contractTypes: filterContractTypes
    } = deriveContractSearchOverrides(rawSearchTerm, rawFilterContractTypes);

    const normalizedSearchTerm = (searchTerm || '').trim();
    const safeSearchTerm = normalizedSearchTerm.length < 2 ? '' : normalizedSearchTerm;
    const safeBackendPageSize = Math.max(1, Math.min(BACKEND_HYBRID_MAX_PAGE_SIZE, pageSize || 50));
    const safeRpcPageSize = Math.max(1, Math.min(SUPABASE_RPC_MAX_PAGE_SIZE, pageSize || 50));
    const compactSearchLength = safeSearchTerm.replace(/\s+/g, '').length;
    const dedicatedSearchRuntime = hasDedicatedSearchRuntime();

    let finalUserLat = userLat;
    let finalUserLng = userLng;
    const hasCoords = typeof finalUserLat === 'number' && typeof finalUserLng === 'number';
    const safeRadiusKm = (radiusKm && Number.isFinite(radiusKm) && radiusKm >= 1 && hasCoords) ? radiusKm : null;
    if (radiusKm && safeRadiusKm === null && !hasCoords) {
        console.warn('⚠️ Commute filter requested without coordinates; skipping radius filter.');
    }

    const hasFilteringIntent =
        !!filterCity ||
        safeRadiusKm !== null ||
        !!(filterContractTypes && filterContractTypes.length > 0) ||
        !!(filterBenefits && filterBenefits.length > 0) ||
        !!(filterExperienceLevels && filterExperienceLevels.length > 0) ||
        !!(filterLanguageCodes && filterLanguageCodes.length > 0) ||
        !!(countryCodes && countryCodes.length > 0) ||
        !!(excludeCountryCodes && excludeCountryCodes.length > 0) ||
        !!(filterMinSalary && filterMinSalary > 0) ||
        filterDatePosted !== 'all' ||
        effectiveSortMode !== 'default';
    const hasSemanticIntent =
        compactSearchLength >= 2;
    const shouldUseHybridSearch = !!BACKEND_URL && (
        hasSemanticIntent ||
        // Dedicated search runtime can handle heavy filter combinations well.
        // Without dedicated runtime, prefer Supabase RPC for filter-only queries
        // to avoid slow backend wake-up / timeout penalties.
        (dedicatedSearchRuntime && hasFilteringIntent && isSearchV2Enabled())
    );
    const normalizedCountryCodes = (countryCodes || []).map((c) => normalizeTokenText(String(c))).filter(Boolean);
    const normalizedExcludedCountryCodes = (excludeCountryCodes || []).map((c) => normalizeTokenText(String(c))).filter(Boolean);
    const normalizedLanguageCodes = (filterLanguageCodes || []).map((c) => normalizeTokenText(String(c))).filter(Boolean);
    const normalizedContractFilters = (filterContractTypes || []).map((c) => normalizeTokenText(String(c))).filter(Boolean);
    const normalizedBenefitFilters = (filterBenefits || []).map((b) => normalizeTokenText(String(b))).filter(Boolean);
    const benefitFilterParts = splitBenefitFilters(filterBenefits || []);
    const normalizedExperienceFilters = (filterExperienceLevels || []).map((lvl) => normalizeTokenText(String(lvl))).filter(Boolean);
    const normalizedFilterCity = normalizeTokenText(filterCity || '').trim();
    const normalizedSearchTokens = normalizeTokenText(safeSearchTerm)
        .split(/\s+/)
        .filter(Boolean);
    const datePostedCutoffMs = getDatePostedCutoffMs(filterDatePosted);
    const hasStrictFilterConstraints =
        safeRadiusKm !== null ||
        !!normalizedFilterCity ||
        normalizedContractFilters.length > 0 ||
        normalizedBenefitFilters.length > 0 ||
        normalizedExperienceFilters.length > 0 ||
        normalizedExcludedCountryCodes.length > 0 ||
        (filterMinSalary || 0) > 0 ||
        datePostedCutoffMs !== null ||
        effectiveSortMode !== 'default';

    const throwIfAborted = (): void => {
        if (abortSignal?.aborted) {
            throw createAbortError();
        }
    };

    const resolveJobDistanceKm = (job: Job): number | null => {
        const explicitDistance = Number((job as any).distance_km ?? (job as any).distanceKm ?? job.distanceKm);
        if (Number.isFinite(explicitDistance) && explicitDistance >= 0) {
            return explicitDistance;
        }
        if (
            typeof finalUserLat === 'number' &&
            typeof finalUserLng === 'number' &&
            typeof job.lat === 'number' &&
            typeof job.lng === 'number'
        ) {
            return calculateDistanceKm(finalUserLat, finalUserLng, job.lat, job.lng);
        }
        return null;
    };

    const matchesContractFilters = (job: Job): boolean => {
        if (normalizedContractFilters.length === 0) return true;
        const searchableContractText = normalizeTokenText(job.type || '');
        const isIco = matchesIcoKeywords(job.type || '');
        const isBrigada = matchesBrigadaKeywords(job.type || '');
        const isPartTime = matchesPartTimeKeywords(job.type || '');
        const isHpp = matchesFullTimeKeywords(job.type || '');

        return normalizedContractFilters.some((type) => {
            if (type === 'ico') return isIco;
            if (type === 'hpp' || type === 'full-time' || type === 'full time' || type === 'fulltime') return isHpp;
            if (type === 'brigada' || type === 'brigáda') return isBrigada;
            if (type === 'part-time' || type === 'parttime' || type === 'part time' || type === 'zkraceny' || type === 'zkracen') return isPartTime;
            return searchableContractText.includes(type);
        });
    };

    const matchesExperienceFilters = (job: Job): boolean => {
        if (normalizedExperienceFilters.length === 0) return true;
        const expText = normalizeTokenText([
            job.title || '',
            job.description || '',
            ...(job.tags || [])
        ].join(' '));
        const aliases: Record<string, string[]> = {
            junior: ['junior', 'entry', 'trainee', 'absolvent'],
            medior: ['medior', 'middle', 'mid-level', 'mid level', 'mid'],
            senior: ['senior', 'expert', 'specialist'],
            lead: ['lead', 'principal', 'manager', 'head']
        };

        return normalizedExperienceFilters.some((level) => {
            const candidates = aliases[level] || [level];
            return candidates.some((candidate) => expText.includes(candidate));
        });
    };

    const applyStrictClientFilters = (jobs: Job[]): Job[] => {
        return jobs.filter((job) => {
            const jobCountry = normalizeTokenText(job.country_code || '');
            if (normalizedCountryCodes.length > 0 && !normalizedCountryCodes.includes(jobCountry)) {
                return false;
            }
            if (normalizedExcludedCountryCodes.length > 0 && normalizedExcludedCountryCodes.includes(jobCountry)) {
                return false;
            }

            const jobLanguage = normalizeTokenText(job.language_code || '');
            if (normalizedLanguageCodes.length > 0 && !normalizedLanguageCodes.includes(jobLanguage)) {
                return false;
            }

            if (normalizedFilterCity) {
                const cityHaystack = normalizeTokenText([
                    job.location || '',
                    ...(job.tags || [])
                ].join(' '));
                if (!cityHaystack.includes(normalizedFilterCity)) {
                    return false;
                }
            }

            if (safeRadiusKm !== null) {
                if (typeof finalUserLat !== 'number' || typeof finalUserLng !== 'number') {
                    return false;
                }
                const distanceKm = resolveJobDistanceKm(job);
                if (distanceKm === null || distanceKm > safeRadiusKm) {
                    return false;
                }
                (job as any).distance_km = distanceKm;
                (job as any).distanceKm = distanceKm;
            }

            if ((filterMinSalary || 0) > 0) {
                const salaryFrom = Number(job.salary_from || 0);
                const salaryTo = Number(job.salary_to || 0);
                const salaryMax = Math.max(salaryFrom, salaryTo);
                if (!salaryMax || salaryMax < Number(filterMinSalary)) {
                    return false;
                }
            }

            if (datePostedCutoffMs !== null) {
                const jobScrapedMs = parseTimestampMs(job.scrapedAt);
                if (!jobScrapedMs || jobScrapedMs < datePostedCutoffMs) {
                    return false;
                }
            }

            if (!matchesContractFilters(job)) {
                return false;
            }

            if (benefitFilterParts.tags.length > 0 || benefitFilterParts.tokens.length > 0) {
                const benefitsTextRaw = [
                    ...(job.benefits || []),
                    ...(job.tags || []),
                    job.title || '',
                    job.description || ''
                ].join(' ');
                const benefitText = normalizeBenefitText(benefitsTextRaw);
                const jobBenefitTags = deriveBenefitTagsFromText(benefitsTextRaw);

                if (benefitFilterParts.tags.length > 0) {
                    const hasAllTaggedBenefits = benefitFilterParts.tags.every((tag) => jobBenefitTags.includes(tag));
                    if (!hasAllTaggedBenefits) {
                        return false;
                    }
                }
                if (benefitFilterParts.tokens.length > 0) {
                    const hasAllTokens = benefitFilterParts.tokens.every((token) => benefitText.includes(token));
                    if (!hasAllTokens) {
                        return false;
                    }
                }
            }

            if (!matchesExperienceFilters(job)) {
                return false;
            }

            if (normalizedSearchTokens.length > 0) {
                const searchText = normalizeTokenText([
                    job.title || '',
                    job.company || '',
                    job.location || '',
                    job.description || '',
                    ...(job.tags || []),
                    ...(job.benefits || [])
                ].join(' '));
                const matchesAllTokens = normalizedSearchTokens.every((token) => searchText.includes(token));
                if (!matchesAllTokens) {
                    return false;
                }
            }

            return true;
        });
    };

    const estimateGrossMonthlyForConstraints = (job: Job): number => {
        let salary = 0;
        if (job.salary_from && job.salary_to) {
            salary = Math.round((Number(job.salary_from) + Number(job.salary_to)) / 2);
        } else {
            salary = Number(job.salary_from || job.salary_to || 0);
        }
        if (!salary) return 0;

        const tf = String(job.salary_timeframe || '').toLowerCase();
        if (tf === 'hour' || tf === 'hourly') return Math.round(salary * 22 * 8);
        if (tf === 'day' || tf === 'daily') return Math.round(salary * 22);
        if (tf === 'week' || tf === 'weekly') return Math.round(salary * 4.345);
        if (tf === 'year' || tf === 'yearly' || tf === 'annual') return Math.round(salary / 12);
        return salary;
    };

    const evaluateHardConstraintViolations = (job: Job): { violations: string[]; distance: number } => {
        const constraints = jhiPreferences?.hardConstraints;
        if (!constraints) return { violations: [], distance: 0 };

        const violations: string[] = [];
        let distance = 0;

        const type = String(job.type || '').toLowerCase();
        const workModel = String(job.work_model || '').toLowerCase();
        const desc = String(job.description || '').toLowerCase();
        const remoteRole = isRemoteJob(job);

        if (constraints.mustRemote && !remoteRole && !(type.includes('remote') || workModel.includes('remote'))) {
            violations.push('remote_required');
            distance += 100;
        }

        if (constraints.excludeShift && /směn|smen|shift|schicht/.test(desc)) {
            violations.push('shift_excluded');
            distance += 60;
        }

        if (constraints.growthRequired && Number(job.jhi?.growth || 0) < 55) {
            violations.push('growth_required');
            distance += 45;
        }

        if (!remoteRole && constraints.maxCommuteMinutes && constraints.maxCommuteMinutes > 0) {
            const distanceKm = resolveJobDistanceKm(job);
            if (distanceKm !== null) {
                const commuteMinutes = Math.round(distanceKm * 2.5 * 2);
                if (commuteMinutes > constraints.maxCommuteMinutes) {
                    const overBy = commuteMinutes - constraints.maxCommuteMinutes;
                    violations.push(`commute_over:${overBy}`);
                    distance += Math.min(80, overBy);
                }
            }
        }

        if (constraints.minNetMonthly && constraints.minNetMonthly > 0) {
            const grossMonthly = estimateGrossMonthlyForConstraints(job);
            if (grossMonthly > 0) {
                const currency = (job.salaryRange && job.salaryRange !== 'Mzda neuvedena' && job.salaryRange !== 'Salary not specified')
                    ? detectCurrency(job.salaryRange)
                    : detectCurrencyFromLocation(job.location || '');
                const taxResult = estimateNetSalaryByCountry(
                    grossMonthly,
                    userTaxProfile?.employmentType === 'contractor',
                    job.country_code,
                    job.location || '',
                    currency,
                    userTaxProfile
                );
                if (taxResult.net < constraints.minNetMonthly) {
                    const deficit = Math.round(constraints.minNetMonthly - taxResult.net);
                    violations.push(`net_below:${deficit}`);
                    distance += Math.min(120, Math.round(deficit / 1000) * 8);
                }
            } else {
                violations.push('net_unknown');
                distance += 50;
            }
        }

        return { violations, distance };
    };

    const applyHardConstraintsWithNearFallback = (
        jobs: Job[],
        hasMore: boolean,
        totalCount: number
    ): { jobs: Job[]; hasMore: boolean; totalCount: number } => {
        const constraints = jhiPreferences?.hardConstraints;
        const hasActiveConstraints = !!constraints && (
            !!constraints.mustRemote ||
            !!constraints.excludeShift ||
            !!constraints.growthRequired ||
            (constraints.maxCommuteMinutes ?? 0) > 0 ||
            (constraints.minNetMonthly ?? 0) > 0
        );
        if (!hasActiveConstraints) {
            return { jobs, hasMore, totalCount };
        }

        const evaluated = jobs.map((job, index) => {
            const { violations, distance } = evaluateHardConstraintViolations(job);
            return { job, violations, distance, index };
        });

        const strictMatches = evaluated.filter((item) => item.violations.length === 0).map((item) => ({
            ...item.job,
            constraint_mode: 'strict' as const,
            constraint_compromises: undefined
        }));
        if (strictMatches.length > 0) {
            return {
                jobs: strictMatches,
                hasMore,
                totalCount: strictMatches.length
            };
        }

        const nearMatches = [...evaluated]
            .sort((a, b) => (a.distance - b.distance) || (a.index - b.index))
            .map((item) => ({
                ...item.job,
                constraint_mode: 'near' as const,
                constraint_compromises: item.violations.slice(0, 3)
            }));

        return {
            jobs: nearMatches,
            hasMore: false,
            totalCount: nearMatches.length
        };
    };

    const finalizeResults = (result: { jobs: Job[]; hasMore: boolean; totalCount: number }) =>
        applyHardConstraintsWithNearFallback(result.jobs, result.hasMore, result.totalCount);

    const fetchViaStrictClientFallback = async (
        reason: string
    ): Promise<{ jobs: Job[], hasMore: boolean, totalCount: number }> => {
        throwIfAborted();
        const fallbackWindow = Math.min(
            STRICT_FALLBACK_MAX_WINDOW,
            Math.max(safeRpcPageSize * STRICT_FALLBACK_MULTIPLIER, (page + 1) * safeRpcPageSize * 2)
        );
        const strictSelect = includeJhi
            ? '*'
            : 'id,title,company,location,description,benefits,contract_type,salary_from,salary_to,salary_timeframe,work_type,work_model,scraped_at,source,education_level,url,lat,lng,country_code,language_code,legality_status,verification_notes';
        let fallbackQuery = supabase
            .from('jobs')
            .select(strictSelect)
            .eq('legality_status', 'legal')
            .order('scraped_at', { ascending: false })
            .range(0, fallbackWindow - 1);

        if (countryCodes && countryCodes.length > 0) {
            fallbackQuery = fallbackQuery.in('country_code', countryCodes);
        }
        if (filterLanguageCodes && filterLanguageCodes.length > 0) {
            fallbackQuery = fallbackQuery.in('language_code', filterLanguageCodes);
        }
        if (filterCity && filterCity.trim()) {
            fallbackQuery = fallbackQuery.ilike('location', `%${filterCity.trim()}%`);
        }
        if (datePostedCutoffMs !== null) {
            fallbackQuery = fallbackQuery.gte('scraped_at', new Date(datePostedCutoffMs).toISOString());
        }

        const { data, error } = await fallbackQuery;
        throwIfAborted();
        if (error) {
            noteSupabaseNetworkFailure('fetchJobsWithFilters.strictFallback', error);
            throw error;
        }

        const baseJobs = filterJobsByQuality(mapJobs(data || [], finalUserLat, finalUserLng, includeJhi));
        const strictJobs = sortJobsForMode(applyStrictClientFilters(baseJobs), effectiveSortMode);
        const start = page * safeRpcPageSize;
        const end = start + safeRpcPageSize;
        const pagedJobs = strictJobs.slice(start, end);
        const sourceExhausted = (data || []).length < fallbackWindow;
        const hasMoreFromSlice = strictJobs.length > end;
        const hasMore = hasMoreFromSlice || (!sourceExhausted && pagedJobs.length === safeRpcPageSize);
        const totalCountEstimate = hasMore ? Math.max(strictJobs.length, end + 1) : strictJobs.length;

        recordRuntimeSignal('search_strict_fallback', {
            reason,
            page,
            page_size: safeRpcPageSize,
            result_count: pagedJobs.length,
            has_search_term: !!safeSearchTerm,
            has_radius_filter: safeRadiusKm !== null,
            has_city_filter: !!normalizedFilterCity,
            has_contract_filter: normalizedContractFilters.length > 0,
            has_language_filter: normalizedLanguageCodes.length > 0,
            has_country_filter: normalizedCountryCodes.length > 0
        }, {
            dedupeKey: reason,
            throttleMs: 20_000
        });
        console.warn(`⚠️ Using strict client fallback for filters (${reason}).`);
        return finalizeResults({
            jobs: pagedJobs,
            hasMore,
            totalCount: totalCountEstimate
        });
    };

    const fetchViaTextFallback = async (): Promise<{ jobs: Job[], hasMore: boolean, totalCount: number } | null> => {
        throwIfAborted();
        if (!safeSearchTerm || !safeSearchTerm.trim()) return null;
        if (hasStrictFilterConstraints) return null;
        const sanitizedTerm = safeSearchTerm.replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim();
        if (!sanitizedTerm) return null;

        const from = page * pageSize;
        const to = from + pageSize - 1;
        const textSelect = includeJhi
            ? '*'
            : 'id,title,company,location,description,benefits,contract_type,salary_from,salary_to,salary_timeframe,work_type,work_model,scraped_at,source,education_level,url,lat,lng,country_code,language_code,legality_status,verification_notes';
        let query = supabase
            .from('jobs')
            .select(textSelect, { count: 'exact' })
            .eq('legality_status', 'legal')
            .or(`title.ilike.%${sanitizedTerm}%,company.ilike.%${sanitizedTerm}%,location.ilike.%${sanitizedTerm}%,description.ilike.%${sanitizedTerm}%`)
            .order('scraped_at', { ascending: false })
            .range(from, to);

        if (countryCodes && countryCodes.length > 0) {
            query = query.in('country_code', countryCodes);
        }
        if (filterLanguageCodes && filterLanguageCodes.length > 0) {
            query = query.in('language_code', filterLanguageCodes);
        }

        const { data, error, count } = await query;
        throwIfAborted();
        if (error) {
            console.warn('Text fallback query failed:', error);
            return null;
        }

        const processedJobs = mapJobs(data || [], undefined, undefined, includeJhi);
        let fallbackJobs = filterJobsByQuality(processedJobs);
        const normalizedFallbackTerm = normalizeTokenText(sanitizedTerm);
        const isShortSingleTokenQuery = compactSearchLength <= 2 && !normalizedFallbackTerm.includes(' ');
        if (isShortSingleTokenQuery) {
            fallbackJobs = fallbackJobs.filter((job) => {
                const searchable = normalizeTokenText([
                    job.title || '',
                    job.company || '',
                    job.location || '',
                    job.description || ''
                ].join(' '));
                return containsWholeToken(searchable, normalizedFallbackTerm);
            });
        }
        fallbackJobs = sortJobsForMode(applyStrictClientFilters(fallbackJobs), effectiveSortMode);

        const totalCountForResponse = fallbackJobs.length;
        return finalizeResults({
            jobs: fallbackJobs,
            hasMore: fallbackJobs.length === pageSize && !isShortSingleTokenQuery && !!count && count > (page + 1) * pageSize,
            totalCount: totalCountForResponse
        });
    };

    const fetchViaBackendHybrid = async (): Promise<{ jobs: Job[], hasMore: boolean, totalCount: number }> => {
        throwIfAborted();
        const backendBases = resolveHybridBackendBases();
        if (!backendBases.length) {
            return { jobs: [], hasMore: false, totalCount: 0 };
        }

        const requestPayloadBase = {
            search_term: safeSearchTerm,
            page,
            page_size: safeBackendPageSize,
            user_lat: finalUserLat ?? null,
            user_lng: finalUserLng ?? null,
            radius_km: safeRadiusKm,
            filter_city: filterCity || null,
            filter_contract_types: filterContractTypes && filterContractTypes.length > 0 ? filterContractTypes : null,
            filter_benefits: filterBenefits && filterBenefits.length > 0 ? filterBenefits : null,
            filter_min_salary: filterMinSalary && filterMinSalary > 0 ? filterMinSalary : null,
            filter_date_posted: filterDatePosted,
            filter_experience_levels: filterExperienceLevels && filterExperienceLevels.length > 0 ? filterExperienceLevels : null,
            filter_country_codes: countryCodes && countryCodes.length > 0 ? countryCodes : null,
            exclude_country_codes: excludeCountryCodes && excludeCountryCodes.length > 0 ? excludeCountryCodes : null,
            filter_language_codes: filterLanguageCodes && filterLanguageCodes.length > 0 ? filterLanguageCodes : null,
        };

        const mapHybridRowsToJobs = (rows: any[], hybridPayload: any) => {
            return rows.map((row: any) => {
                const job = transformJob({
                    id: row.id,
                    company_id: row.company_id,
                    title: row.title,
                    company: row.company,
                    location: row.location,
                    description: row.description,
                    role_summary: row.role_summary,
                    first_reply_prompt: row.first_reply_prompt,
                    company_truth_hard: row.company_truth_hard,
                    company_truth_fail: row.company_truth_fail,
                    benefits: row.benefits,
                    contract_type: row.contract_type,
                    salary_from: row.salary_from,
                    salary_to: row.salary_to,
                    salary_timeframe: row.salary_timeframe,
                    work_type: row.work_type,
                    work_model: row.work_model,
                    scraped_at: row.scraped_at,
                    source: row.source,
                    education_level: row.education_level,
                    url: row.url,
                    lat: row.lat,
                    lng: row.lng,
                    country_code: row.country_code,
                    language_code: row.language_code,
                    legality_status: row.legality_status,
                    verification_notes: row.verification_notes,
                    open_dialogues_count: row.open_dialogues_count,
                    dialogue_capacity_limit: row.dialogue_capacity_limit,
                    reaction_window_hours: row.reaction_window_hours,
                    reaction_window_days: row.reaction_window_days
                }, includeJhi);

                (job as any).distance_km = row.distance_km;
                (job as any).hybrid_score = row.hybrid_score;
                (job as any).fts_score = row.fts_score;
                (job as any).trigram_score = row.trigram_score;
                (job as any).profile_fit_score = row.profile_fit_score;
                (job as any).recency_score = row.recency_score;
                (job as any).behavior_prior_score = row.behavior_prior_score;
                (job as any).searchScore = row.hybrid_score;
                (job as any).rankPosition = row.rank_position;
                (job as any).requestId = hybridPayload.request_id;
                return job;
            });
        };

        const mapFallbackRowsToJobs = (rows: any[]) => {
            return rows.map((row: any) => {
                const job = transformJob({
                    id: row.id,
                    company_id: row.company_id,
                    title: row.title,
                    company: row.company,
                    location: row.location,
                    description: row.description,
                    role_summary: row.role_summary,
                    first_reply_prompt: row.first_reply_prompt,
                    company_truth_hard: row.company_truth_hard,
                    company_truth_fail: row.company_truth_fail,
                    benefits: row.benefits,
                    contract_type: row.contract_type,
                    salary_from: row.salary_from,
                    salary_to: row.salary_to,
                    salary_timeframe: row.salary_timeframe,
                    work_type: row.work_type,
                    work_model: row.work_model,
                    scraped_at: row.scraped_at,
                    source: row.source,
                    education_level: row.education_level,
                    url: row.url,
                    lat: row.lat,
                    lng: row.lng,
                    country_code: row.country_code,
                    language_code: row.language_code,
                    legality_status: row.legality_status,
                    verification_notes: row.verification_notes,
                    open_dialogues_count: row.open_dialogues_count,
                    dialogue_capacity_limit: row.dialogue_capacity_limit,
                    reaction_window_hours: row.reaction_window_hours,
                    reaction_window_days: row.reaction_window_days
                }, includeJhi);
                (job as any).distance_km = row.distance_km;
                return job;
            });
        };

        const v2Enabled = isSearchV2Enabled();
        const endpoint = v2Enabled ? '/jobs/hybrid-search-v2' : '/jobs/hybrid-search';
        let lastError: unknown = null;

        for (const baseUrl of backendBases) {
            throwIfAborted();
            try {
                const hybridResponse = await authenticatedFetch(`${baseUrl}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: abortSignal,
                    body: JSON.stringify({
                        ...requestPayloadBase,
                        sort_mode: effectiveSortMode,
                        debug: false
                    })
                });
                throwIfAborted();

                if (!hybridResponse.ok && v2Enabled) {
                    const fallbackResponse = await authenticatedFetch(`${baseUrl}/jobs/hybrid-search`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        signal: abortSignal,
                        body: JSON.stringify(requestPayloadBase)
                    });
                    throwIfAborted();

                    if (!fallbackResponse.ok) {
                        let detail = '';
                        try { detail = await fallbackResponse.text(); } catch { }
                        console.warn('Hybrid v1 fallback response detail:', detail);
                        const err = new Error(`Hybrid fallback failed: ${fallbackResponse.status}`);
                        (err as any).status = fallbackResponse.status;
                        throw err;
                    }

                    const fallbackPayload = await fallbackResponse.json();
                    const fallbackRows = fallbackPayload.jobs || [];
                    const fallbackJobs = mapFallbackRowsToJobs(fallbackRows);
                    return finalizeResults({
                        jobs: fallbackJobs,
                        hasMore: !!fallbackPayload.has_more,
                        totalCount: Number(fallbackPayload.total_count || fallbackJobs.length)
                    });
                }

                if (!hybridResponse.ok) {
                    let detail = '';
                    try { detail = await hybridResponse.text(); } catch { }
                    console.warn('Hybrid response detail:', detail);
                    const err = new Error(`Hybrid request failed: ${hybridResponse.status}`);
                    (err as any).status = hybridResponse.status;
                    throw err;
                }

                const hybridPayload = await hybridResponse.json();
                throwIfAborted();
                const backendMetaFallback = String(hybridPayload?.meta?.fallback || '').trim();
                if (backendMetaFallback) {
                    recordRuntimeSignal('search_backend_meta_fallback', {
                        fallback: backendMetaFallback,
                        sort_mode: hybridPayload?.meta?.sort_mode || effectiveSortMode
                    }, {
                        dedupeKey: backendMetaFallback,
                        throttleMs: 60_000
                    });
                }

                const hybridRows = hybridPayload.jobs || [];
                const processedJobs = mapHybridRowsToJobs(hybridRows, hybridPayload);
                return finalizeResults({
                    jobs: processedJobs,
                    hasMore: !!hybridPayload.has_more,
                    totalCount: Number(hybridPayload.total_count || processedJobs.length)
                });
            } catch (err) {
                if (isAbortFetchError(err)) {
                    throw err;
                }
                lastError = err;
                const status = Number((err as any)?.status || 0);
                if (isNetworkFetchError(err)) {
                    continue;
                }
                if (status >= 500) {
                    continue;
                }
                throw err;
            }
        }

        throw lastError || new Error('Hybrid search failed on all configured backends');
    };

    try {
        throwIfAborted();

        // If city filter is provided but no coordinates, try to geocode
        if (filterCity && filterCity.trim() && (!userLat || !userLng)) {
            console.log(`🏙️  City filter provided without coordinates, geocoding "${filterCity}"...`);
            const coords = await geocodeWithCaching(filterCity);
            throwIfAborted();
            if (coords) {
                finalUserLat = coords.lat;
                finalUserLng = coords.lon;
                console.log(`✅ Using geocoded coordinates: ${finalUserLat}, ${finalUserLng}`);
            }
        }

        console.log(`🔍 Fetching filtered jobs with options:`, {
            radius: safeRadiusKm,
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
            excludeCountries: excludeCountryCodes || [],
            searchTerm: safeSearchTerm || 'none',
            effectiveSortMode
        });

        // Hybrid semantic search (backend) for text queries.
        if (shouldUseHybridSearch) {
            try {
                const hybridPromise = fetchViaBackendHybrid();
                try {
                    return await raceWithTimeout(hybridPromise, HYBRID_SEARCH_TIMEOUT_MS, 'Hybrid search');
                } finally {
                    hybridPromise.catch(() => { });
                }
            } catch (hybridErr) {
                if (isAbortFetchError(hybridErr)) {
                    throw hybridErr;
                }
                warnHybridFallbackThrottled(hybridErr);
            }
        }

        // When radius is disabled (undefined/null), also disable spatial filtering
        // by setting coordinates to null
        const usesSpatialFilter = safeRadiusKm !== undefined && safeRadiusKm !== null;
        const spatialLat = usesSpatialFilter ? finalUserLat : null;
        const spatialLng = usesSpatialFilter ? finalUserLng : null;
        const spatialRadius = usesSpatialFilter ? safeRadiusKm : null;

        const minSalaryFilter = filterMinSalary && filterMinSalary > 0 ? filterMinSalary : null;

        const { data, error } = await supabase.rpc('search_jobs_with_filters', {
            search_term: safeSearchTerm || null,
            user_lat: spatialLat,
            user_lng: spatialLng,
            radius_km: spatialRadius,
            filter_city: filterCity || null,
            filter_contract_types: filterContractTypes && filterContractTypes.length > 0 ? filterContractTypes : null,
            filter_benefits: filterBenefits && filterBenefits.length > 0 ? filterBenefits : null,
            filter_min_salary: minSalaryFilter,
            filter_date_posted: filterDatePosted,
            filter_experience_levels: filterExperienceLevels && filterExperienceLevels.length > 0 ? filterExperienceLevels : null,
            limit_count: safeRpcPageSize,
            offset_val: page * safeRpcPageSize,
            filter_country_codes: countryCodes && countryCodes.length > 0 ? countryCodes : null,
            exclude_country_codes: excludeCountryCodes && excludeCountryCodes.length > 0 ? excludeCountryCodes : null,
            filter_language_codes: filterLanguageCodes && filterLanguageCodes.length > 0 ? filterLanguageCodes : null
        });
        throwIfAborted();

        if (error) {
            throwIfAborted();
            noteSupabaseNetworkFailure('fetchJobsWithFilters.rpc', error);
            const msg = String((error as any)?.message || '').toLowerCase();
            const status = Number((error as any)?.status || (error as any)?.statusCode || 0);
            const isNetworkError = msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('cors');
            const isServerOverload = status >= 500 || (error as any)?.code === '57014' || msg.includes('statement timeout');
            if (isNetworkError && shouldUseHybridSearch) {
                try {
                    throwIfAborted();
                    console.warn('⚠️ Supabase RPC unreachable from browser; falling back to backend hybrid search.');
                    return await fetchViaBackendHybrid();
                } catch (fallbackErr) {
                    if (isAbortFetchError(fallbackErr)) {
                        throw fallbackErr;
                    }
                    console.warn('⚠️ Backend fallback failed:', fallbackErr);
                }
            }

            if (safeSearchTerm) {
                const textFallback = await fetchViaTextFallback();
                if (textFallback) return textFallback;
            }

            // Postgres timeout/5xx: degrade to simpler query path.
            if (isServerOverload) {
                recordRuntimeSignal('search_rpc_overload', {
                    status,
                    code: (error as any)?.code || null,
                    message: msg
                }, {
                    dedupeKey: 'rpc_overload',
                    throttleMs: 20_000
                });
                console.warn('⏱️ Filtered jobs query timed out or overloaded. Falling back to strict client filters.');
                try {
                    return await fetchViaStrictClientFallback('rpc_overload');
                } catch (strictFallbackErr) {
                    console.warn('⚠️ Strict fallback failed:', strictFallbackErr);
                }
            }

            console.error('❌ Error fetching filtered jobs:', error);
            return { jobs: [], hasMore: false, totalCount: 0 };
        }

        if (!data || data.length === 0) {
            throwIfAborted();
            if (safeSearchTerm) {
                const textFallback = await fetchViaTextFallback();
                if (textFallback) return textFallback;
            }
            console.log('🔍 No jobs found matching filter criteria');
            return { jobs: [], hasMore: false, totalCount: 0 };
        }

        // Process results
        const processedJobs = data.map((row: any) => {
            const job = transformJob({
                id: row.id,
                company_id: row.company_id,
                title: row.title,
                company: row.company,
                location: row.location,
                description: row.description,
                role_summary: row.role_summary,
                first_reply_prompt: row.first_reply_prompt,
                company_truth_hard: row.company_truth_hard,
                company_truth_fail: row.company_truth_fail,
                benefits: row.benefits,
                contract_type: row.contract_type,
                salary_from: row.salary_from,
                salary_to: row.salary_to,
                salary_timeframe: row.salary_timeframe,
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
            }, includeJhi);

            // Add distance and tags information
            (job as any).distance_km = row.distance_km;
            if (row.tags) {
                job.tags = [...job.tags, ...row.tags];
            }

            return job;
        });

        const totalCount = data[0]?.total_count || 0;
        const hasMore = (page + 1) * safeRpcPageSize < totalCount;

        console.log(`✅ Found ${processedJobs.length} filtered jobs (total: ${totalCount}, has more: ${hasMore})`);

        throwIfAborted();
        return finalizeResults({
            jobs: processedJobs,
            hasMore,
            totalCount
        });

    } catch (e: any) {
        if (isAbortFetchError(e)) {
            throw e;
        }
        noteSupabaseNetworkFailure('fetchJobsWithFilters.catch', e);
        const msg = String(e?.message || '').toLowerCase();
        const status = Number(e?.status || e?.statusCode || 0);
        const isNetworkError = msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('cors');
        if (isNetworkError && shouldUseHybridSearch) {
            try {
                throwIfAborted();
                console.warn('⚠️ Exception indicates browser network issue to Supabase; using backend fallback.');
                return await fetchViaBackendHybrid();
            } catch (fallbackErr) {
                if (isAbortFetchError(fallbackErr)) {
                    throw fallbackErr;
                }
                console.warn('⚠️ Backend fallback failed:', fallbackErr);
            }
        }

        if (safeSearchTerm) {
            const textFallback = await fetchViaTextFallback();
            if (textFallback) return textFallback;
        }

        if (e?.code === '57014' || status >= 500 || msg.includes('statement timeout')) {
            recordRuntimeSignal('search_rpc_overload', {
                status,
                code: e?.code || null,
                message: msg
            }, {
                dedupeKey: 'rpc_exception',
                throttleMs: 20_000
            });
            console.warn('⏱️ Filtered jobs query timed out/overloaded (exception). Falling back to strict client filters.');
            try {
                return await fetchViaStrictClientFallback('rpc_exception');
            } catch (strictFallbackErr) {
                console.warn('⚠️ Strict fallback failed:', strictFallbackErr);
            }
        }
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
            company_id: data.company_id,
            title: data.title,
            company: data.company,
            location: data.location,
            description: data.description,
            role_summary: data.role_summary,
            first_reply_prompt: data.first_reply_prompt,
            company_truth_hard: data.company_truth_hard,
            company_truth_fail: data.company_truth_fail,
            benefits: data.benefits,
            contract_type: data.contract_type,
            salary_from: data.salary_from,
            salary_to: data.salary_to,
            salary_currency: data.salary_currency,
            currency: data.currency,
            salary_timeframe: data.salary_timeframe,
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

export const fetchJobsByIds = async (jobIds: string[]): Promise<Job[]> => {
    if (!isSupabaseConfigured() || !supabase || !Array.isArray(jobIds) || jobIds.length === 0) {
        return [];
    }

    const normalizedIds = Array.from(new Set(jobIds.map((id) => String(id).trim()).filter(Boolean)));
    if (!normalizedIds.length) return [];

    // Strip 'db-' prefix if present for querying the database
    const dbIds = normalizedIds.map(id => id.startsWith('db-') ? id.substring(3) : id);

    try {
        const chunks: string[][] = [];
        for (let i = 0; i < dbIds.length; i += 100) {
            chunks.push(dbIds.slice(i, i + 100));
        }

        const fetched: Job[] = [];
        for (const chunk of chunks) {
            // Convert to numbers if the id column is integer (usually is in our schema)
            const numericChunk = chunk.map(id => parseInt(id)).filter(id => !isNaN(id));
            if (numericChunk.length === 0) continue;

            const { data, error } = await supabase
                .from('jobs')
                .select('*')
                .in('id', numericChunk);

            if (error) {
                console.warn('Failed to fetch saved jobs batch:', error);
                continue;
            }

            const mapped = mapJobs(data || [], undefined, undefined, true, true);
            fetched.push(...mapped);
        }

        const byId = new Map<string, Job>();
        fetched.forEach(job => {
            byId.set(job.id, job);
            if (job.id.startsWith('db-')) {
                byId.set(job.id.substring(3), job);
            }
        });

        return normalizedIds
            .map((id) => byId.get(id))
            .filter((job): job is Job => !!job);
    } catch (error) {
        console.warn('Failed to fetch jobs by IDs:', error);
        return [];
    }
};

export const fetchRecommendedJobs = async (limit: number = 50): Promise<Job[]> => {
    void limit;
    return [];
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
const mapJobs = (data: any[], userLat?: number, userLng?: number, includeJhi: boolean = true, skipQualityFilter: boolean = false): Job[] => {
    const mappedJobs = data.map((item: any): Job | null => {
        try {
            const scraped = item as ScrapedJob;

            // 1. Description Processing
            const fullDesc = formatDescription(scraped.description);
            const challengeFields = deriveChallengeFields({
                title: scraped.title,
                description: fullDesc,
                source: scraped.source,
                role_summary: scraped.role_summary,
                first_reply_prompt: scraped.first_reply_prompt,
                company_truth_hard: scraped.company_truth_hard,
                company_truth_fail: scraped.company_truth_fail
            });

            if (!skipQualityFilter && fullDesc.length < 20) {
                return null;
            }

            // 2. Salary Processing
            let salaryFrom = safeParseInt(scraped.salary_from);
            let salaryTo = safeParseInt(scraped.salary_to);
            const salaryContext = `${scraped.title || ''} ${fullDesc}`;

            // Fix for salaries stored as thousands (e.g., 38 should be 38,000)
            salaryFrom = normalizeSalaryAmount(
                salaryFrom,
                scraped.salary_timeframe,
                salaryContext,
                scraped.salary_currency || scraped.currency
            );
            salaryTo = normalizeSalaryAmount(
                salaryTo,
                scraped.salary_timeframe,
                salaryContext,
                scraped.salary_currency || scraped.currency
            );

            const currency = scraped.salary_currency || scraped.currency;
            const salaryRange = formatSalaryRange(salaryFrom, salaryTo, currency, scraped.location, scraped.country_code);

            // 3. Job Type Inference
            let jobType: 'Remote' | 'Hybrid' | 'On-site' = 'On-site';
            const wt = String(scraped.work_type || '').toLowerCase();
            const wm = String(scraped.work_model || '').toLowerCase();
            const descLower = fullDesc.toLowerCase();
            const titleLower = (scraped.title || '').toLowerCase();

            if (wm.includes('remote')) {
                jobType = 'Remote';
            } else if (wm.includes('hybrid')) {
                jobType = 'Hybrid';
            } else if (wm.includes('onsite') || wm.includes('on-site')) {
                jobType = 'On-site';
            } else if (wt.includes('remote') || wt.includes('home') || descLower.includes('remote') || descLower.includes('full-remote')) {
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
            if (jobType === 'Remote' && !locationTags.includes('Remote')) locationTags.push('Remote');

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
            if (matchesIcoKeywords(scraped.contract_type, scraped.title, fullDesc)) otherTags.push('IČO');
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
            const workMode = ContextualRelevanceScorer.inferWorkMode(
                String(scraped.work_type || ''),
                fullDesc,
                String(scraped.work_model || '')
            );
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
                company_id: scraped.company_id ? String(scraped.company_id) : undefined,
                title: scraped.title || (scraped.company ? `${scraped.company} - Pozice` : 'Pozice bez názvu'),
                company: scraped.company || 'Neznámá společnost',
                location: locationString,
                type: jobType,
                work_model: scraped.work_model,
                salaryRange: salaryRange,
                description: fullDesc,
                postedAt: getRelativeTime(scraped.scraped_at),
                scrapedAt: scraped.scraped_at,
                source: scraped.source || 'Scraper',
                url: scraped.url,
                lat: scraped.lat ? parseFloat(String(scraped.lat)) : undefined,
                lng: scraped.lng ? parseFloat(String(scraped.lng)) : undefined,
                ...(distanceKm !== undefined && { distanceKm }),
                jhi: includeJhi ? calculateJHI({
                    salary_from: salaryFrom ?? undefined,
                    salary_to: salaryTo ?? undefined,
                    type: jobType,
                    benefits: benefits,
                    description: fullDesc,
                    location: locationString,
                    distanceKm: distanceKm
                }) : EMPTY_JHI,
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
                challenge: challengeFields.challenge,
                risk: challengeFields.risk,
                firstStepPrompt: challengeFields.firstStepPrompt,
                listingKind: challengeFields.listingKind,
                companyPageSummary: challengeFields.companyPageSummary,
                salary_from: salaryFrom || undefined,
                salary_to: salaryTo || undefined,
                salary_timeframe: scraped.salary_timeframe,
                legality_status: scraped.legality_status,
                legality_reasons: scraped.verification_notes ? scraped.verification_notes.split(',').map((s: string) => s.trim()) : [],
                ...(safeParseInt((scraped as any).open_dialogues_count) !== undefined
                    ? { open_dialogues_count: safeParseInt((scraped as any).open_dialogues_count) }
                    : {}),
                ...(safeParseInt((scraped as any).dialogue_capacity_limit) !== undefined
                    ? { dialogue_capacity_limit: safeParseInt((scraped as any).dialogue_capacity_limit) }
                    : {}),
                ...(safeParseInt((scraped as any).reaction_window_hours) !== undefined
                    ? { reaction_window_hours: safeParseInt((scraped as any).reaction_window_hours) }
                    : {}),
                ...(safeParseInt((scraped as any).reaction_window_days) !== undefined
                    ? { reaction_window_days: safeParseInt((scraped as any).reaction_window_days) }
                    : {})
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

export const fetchJobsByCompany = async (companyId: string, limit: number = 20): Promise<Job[]> => {
    if (!isSupabaseConfigured() || !supabase || !companyId) {
        return [];
    }

    try {
        const exactLimit = Math.max(1, Math.min(50, Math.floor(limit || 20)));
        let data: any[] | null = null;

        const activeResult = await supabase
            .from('jobs')
            .select('*')
            .eq('company_id', companyId)
            .eq('status', 'active')
            .order('scraped_at', { ascending: false })
            .limit(exactLimit);

        if (!activeResult.error && Array.isArray(activeResult.data)) {
            data = activeResult.data;
        } else {
            const fallback = await supabase
                .from('jobs')
                .select('*')
                .eq('company_id', companyId)
                .order('scraped_at', { ascending: false })
                .limit(exactLimit);
            if (fallback.error || !Array.isArray(fallback.data)) {
                return [];
            }
            data = fallback.data;
        }

        return mapJobs(data || [], undefined, undefined, true, true);
    } catch (error) {
        console.warn('Failed to fetch company jobs:', error);
        return [];
    }
};

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
