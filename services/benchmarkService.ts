import { BACKEND_URL } from '../constants';
import { Candidate, CandidateBenchmarkMetrics, SalaryBenchmarkResolved } from '../types';
import { authenticatedFetch } from './csrfService';

const toJsonOrThrow = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(detail || `Benchmark request failed: ${response.status}`);
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
                continue;
            }
            return await toJsonOrThrow<CandidateBenchmarkMetrics>(response);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError || new Error('Candidate benchmark endpoint unavailable');
};

export const fetchCompanyCandidates = async (
    companyId: string,
    limit: number = 500
): Promise<Candidate[]> => {
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
                continue;
            }
            const payload = await toJsonOrThrow<{ candidates: Candidate[] }>(response);
            return Array.isArray(payload.candidates) ? payload.candidates : [];
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }
    }

    throw lastError || new Error('Company candidates endpoint unavailable');
};
