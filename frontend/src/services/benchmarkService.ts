import { BACKEND_URL } from '../constants';
import { Candidate, CandidateBenchmarkMetrics, SalaryBenchmarkResolved } from '../types';
import { authenticatedFetch } from './csrfService';
import { supabase } from './supabaseService';
let candidateBenchmarkApiUnavailable = false;
let companyCandidatesApiUnavailable = false;

const isMissingProfilesLocationPublic = (error: unknown): boolean => {
    const code = String((error as { code?: unknown })?.code || '').trim();
    const message = String((error as { message?: unknown })?.message || error || '').toLowerCase();
    return (code === '42703' || message.includes('column')) && message.includes('profiles.location_public');
};

const fetchCandidateProfileRows = async (
    limit: number
): Promise<{ data: any[] | null; error: unknown }> => {
    const withLocationSelect = `
        id,
        full_name,
        email,
        avatar_url,
        location_public,
        role,
        created_at,
        candidate_profiles (
            job_title,
            skills,
            work_history,
            values
        )
    `;

    const withoutLocationSelect = `
        id,
        full_name,
        email,
        avatar_url,
        role,
        created_at,
        candidate_profiles (
            job_title,
            skills,
            work_history,
            values
        )
    `;

    let response = await supabase
        .from('profiles')
        .select(withLocationSelect)
        .eq('role', 'candidate')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (response.error && isMissingProfilesLocationPublic(response.error)) {
        response = await supabase
            .from('profiles')
            .select(withoutLocationSelect)
            .eq('role', 'candidate')
            .order('created_at', { ascending: false })
            .limit(limit);
    }

    return { data: response.data, error: response.error };
};

const shouldDisableBackendPath = (status: number): boolean =>
    [404, 409, 500, 501, 502, 503].includes(status);

const toJsonOrThrow = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        const error = new Error(detail || `Benchmark request failed: ${response.status}`) as Error & { status?: number };
        error.status = response.status;
        throw error;
    }
    return response.json() as Promise<T>;
};

export const fetchSalaryBenchmark = async (
    jobId: string | number,
    windowDays: number = 90
): Promise<SalaryBenchmarkResolved> => {
    const params = new URLSearchParams({
        job_id: String(jobId),
        window_days: String(windowDays)
    });
    const response = await fetch(`${BACKEND_URL}/benchmarks/salary?${params.toString()}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    return toJsonOrThrow<SalaryBenchmarkResolved>(response);
};

export const fetchCandidateBenchmarkMetrics = async (
    companyId: string,
    jobId?: string,
    windowDays: number = 90
): Promise<CandidateBenchmarkMetrics> => {
    if (candidateBenchmarkApiUnavailable) {
        return createEmptyCandidateBenchmarkMetrics(companyId, jobId, windowDays, 'Candidate benchmark endpoint unavailable');
    }
    const params = new URLSearchParams({
        company_id: companyId,
        window_days: String(windowDays)
    });
    if (jobId) params.set('job_id', jobId);

    const candidateBenchmarkPaths = [
        '/company/benchmarks/candidate',
        '/benchmarks/company/candidate',
    ];

    let lastError: Error | null = null;
    for (const path of candidateBenchmarkPaths) {
        try {
            const response = await authenticatedFetch(
                `${BACKEND_URL}${path}?${params.toString()}`,
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            if (response.status === 404) {
                lastError = new Error(`Not Found: ${path}`);
                candidateBenchmarkApiUnavailable = true;
                break;
            }
            if (!response.ok && shouldDisableBackendPath(response.status)) {
                candidateBenchmarkApiUnavailable = true;
                lastError = new Error(`Candidate benchmark endpoint failed: ${response.status}`);
                break;
            }
            return await toJsonOrThrow<CandidateBenchmarkMetrics>(response);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            candidateBenchmarkApiUnavailable = true;
            break;
        }
    }

    return createEmptyCandidateBenchmarkMetrics(companyId, jobId, windowDays, lastError?.message || 'Candidate benchmark endpoint unavailable');
};

export const fetchCompanyCandidates = async (
    companyId: string,
    limit: number = 500
): Promise<Candidate[]> => {
    if (companyCandidatesApiUnavailable) {
        throw new Error('Company candidates endpoint unavailable');
    }
    const params = new URLSearchParams({
        company_id: companyId,
        limit: String(limit)
    });
    const candidatePaths = [
        '/company/candidates',
        '/benchmarks/company/candidates',
    ];

    let lastError: Error | null = null;
    for (const path of candidatePaths) {
        try {
            const response = await authenticatedFetch(
                `${BACKEND_URL}${path}?${params.toString()}`,
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                }
            );
            if (response.status === 404) {
                lastError = new Error(`Not Found: ${path}`);
                companyCandidatesApiUnavailable = true;
                break;
            }
            if (!response.ok && shouldDisableBackendPath(response.status)) {
                companyCandidatesApiUnavailable = true;
                lastError = new Error(`Company candidates endpoint failed: ${response.status}`);
                break;
            }
            const payload = await toJsonOrThrow<{ candidates: Candidate[] }>(response);
            return Array.isArray(payload.candidates) ? payload.candidates : [];
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            companyCandidatesApiUnavailable = true;
            break;
        }
    }

    throw lastError || new Error('Company candidates endpoint unavailable');
};

const createEmptyCandidateMetric = (
    metric: 'assessment_avg' | 'shortlist_rate' | 'hire_rate',
    windowDays: number,
    reason: string
) => ({
    metric,
    value: null,
    peer_value: null,
    delta_vs_peer: null,
    sample_size: 0,
    source_name: 'fallback',
    source_mode: 'internal_only' as const,
    data_window_days: windowDays,
    updated_at: new Date().toISOString(),
    confidence_score: 0,
    confidence_tier: 'low' as const,
    confidence_components: {
        sample_size_component: 0,
        variance_component: 0,
        recency_component: 0
    },
    insufficient_data: true,
    fallback_reason: reason,
    numerator: 0,
    denominator: 0,
    median: null,
    coverage: {
        assessed_candidates: 0,
        total_candidates: 0,
        coverage_ratio: null
    }
});

const createEmptyCandidateBenchmarkMetrics = (
    companyId: string,
    jobId: string | undefined,
    windowDays: number,
    reason: string
): CandidateBenchmarkMetrics => ({
    company_id: companyId,
    job_id: jobId ? Number(jobId) || null : null,
    peer_group: {
        hiring_volume_band: 'small',
        peer_company_count: 0
    },
    assessment: createEmptyCandidateMetric('assessment_avg', windowDays, reason),
    shortlist_rate: createEmptyCandidateMetric('shortlist_rate', windowDays, reason),
    hire_rate: createEmptyCandidateMetric('hire_rate', windowDays, reason),
    transparency: {
        source_name: 'fallback',
        source_mode: 'internal_only',
        data_window_days: windowDays,
        updated_at: new Date().toISOString(),
        note: 'Benchmark data is temporarily unavailable. Showing an insufficient-data state instead of failing the workspace.'
    }
});

export const fetchAllRegisteredCandidates = async (
    limit: number = 500
): Promise<Candidate[]> => {
    if (!supabase) {
        return [];
    }

    const { data, error } = await fetchCandidateProfileRows(limit);

    if (error) {
        throw error;
    }

    const parseDateSafe = (value: unknown): Date | null => {
        if (!value) return null;
        const dt = new Date(String(value));
        return Number.isNaN(dt.getTime()) ? null : dt;
    };

    const estimateExperienceYears = (workHistory: unknown): number => {
        if (!Array.isArray(workHistory) || workHistory.length === 0) return 0;
        let months = 0;
        const now = new Date();
        for (const entry of workHistory as any[]) {
            const fromRaw = entry?.from || entry?.start || entry?.start_date;
            const toRaw = entry?.to || entry?.end || entry?.end_date;
            const start = parseDateSafe(fromRaw);
            const end = parseDateSafe(toRaw) || now;
            if (start && end >= start) {
                const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
                months += Math.max(0, diffMonths);
            }
        }
        if (months <= 0) return Math.max(1, workHistory.length);
        return Math.max(1, Math.round(months / 12));
    };

    const normalizeSkills = (skills: unknown, workHistory: unknown, jobTitle: unknown): string[] => {
        if (Array.isArray(skills)) return skills.filter(Boolean).map((s) => String(s).trim()).filter(Boolean).slice(0, 12);
        if (typeof skills === 'string' && skills.trim()) {
            return skills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12);
        }
        const fromHistory = Array.isArray(workHistory)
            ? (workHistory as any[])
                .flatMap((w) => (Array.isArray(w?.skills) ? w.skills : []))
                .filter(Boolean)
                .map((s) => String(s).trim())
            : [];
        if (fromHistory.length > 0) return Array.from(new Set(fromHistory)).slice(0, 12);
        const title = String(jobTitle || '').trim();
        return title ? [title] : [];
    };

    const normalizeValues = (values: unknown): string[] =>
        Array.isArray(values)
            ? values.map((value) => String(value).trim()).filter(Boolean).slice(0, 12)
            : [];

    return (data || []).map((row: any) => {
        const candidateProfile = Array.isArray(row.candidate_profiles)
            ? row.candidate_profiles[0]
            : row.candidate_profiles;
        const workHistory = Array.isArray(candidateProfile?.work_history) ? candidateProfile.work_history : [];
        const normalizedSkills = normalizeSkills(candidateProfile?.skills, workHistory, candidateProfile?.job_title);
        const values = normalizeValues(candidateProfile?.values);
        const fullName = String(row.full_name || '').trim();
        const email = String(row.email || '').trim();
        const jobTitle = String(candidateProfile?.job_title || '').trim();
        const derivedName = fullName || email.split('@')[0] || 'Candidate';

        return {
            id: String(row.id),
            name: derivedName,
            full_name: fullName || derivedName,
            email: email || undefined,
            avatar_url: row.avatar_url || null,
            job_title: jobTitle || null,
            title: jobTitle || null,
            role: jobTitle || 'Candidate',
            experienceYears: estimateExperienceYears(workHistory),
            salaryExpectation: 0,
            skills: normalizedSkills,
            bio: `Registered candidate on JobShaman.`,
            flightRisk: 'Medium',
            values,
            created_at: row.created_at ? String(row.created_at) : null,
            location_public: row.location_public || null,
        } as Candidate & { location_public?: string | null };
    });
};
