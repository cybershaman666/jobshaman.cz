import { BACKEND_URL } from '../constants';
import { CandidateBenchmarkMetrics, SalaryBenchmarkResolved } from '../types';
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

    const response = await authenticatedFetch(
        `${BACKEND_URL}/company/benchmarks/candidate?${params.toString()}`,
        {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        }
    );
    return toJsonOrThrow<CandidateBenchmarkMetrics>(response);
};
