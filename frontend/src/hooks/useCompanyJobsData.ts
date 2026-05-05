import { useEffect, useState } from 'react';
import type { Job } from '../types';
import { fetchJobsWithFiltersV2 } from '../services/jobServiceV2';

const loadCompanyJobsData = async (companyId?: string): Promise<{
  jobs: Job[];
  jobStats: Record<string, { views: number; applicants: number }>;
}> => {
  if (!companyId) {
    return { jobs: [], jobStats: {} };
  }

  const response = await fetchJobsWithFiltersV2();
  const jobs = response.jobs
    .filter((job) => String(job.companyId || '') === String(companyId))
    .map((role) => ({
      id: role.id,
      title: role.title,
      company_id: role.companyId,
      company: role.companyName,
      location: role.location,
      salary_min: role.salaryFrom,
      salary_max: role.salaryTo,
      currency: role.currency,
      description: role.description || role.summary,
      required_skills: role.skills,
      tags: role.skills,
    })) as unknown as Job[];

  const jobStats = Object.fromEntries(
    jobs.map((job) => [String(job.id), { views: 0, applicants: 0 }]),
  ) as Record<string, { views: number; applicants: number }>;

  return { jobs, jobStats };
};

export const useCompanyJobsData = (companyId?: string) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobStats, setJobStats] = useState<Record<string, { views: number; applicants: number }>>({});
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  const refreshJobs = async () => {
    if (!companyId) {
      setJobs([]);
      setJobStats({});
      setSelectedJobId('');
      return;
    }

    try {
      const data = await loadCompanyJobsData(companyId);
      setJobs(data.jobs);
      setJobStats(data.jobStats);
      setSelectedJobId((prev) => {
        if (prev && data.jobs.some((job) => String(job.id) === String(prev))) {
          return prev;
        }
        return data.jobs[0]?.id || '';
      });
    } catch (error) {
      console.error('Failed to load V2 company jobs data', error);
      setJobs([]);
      setJobStats({});
      setSelectedJobId('');
    }
  };

  useEffect(() => {
    void refreshJobs();
  }, [companyId]);

  return {
    jobs,
    setJobs,
    jobStats,
    setJobStats,
    selectedJobId,
    setSelectedJobId,
    refreshJobs,
  };
};
