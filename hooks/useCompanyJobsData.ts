import { useEffect, useState } from 'react';
import { Job } from '../types';
import { fetchCompanyJobViews } from '../services/companyDashboardService';
import { fetchCompanyPublishedJobPayloads } from '../services/jobCatalogService';
import { mapJobs } from '../services/jobService';
import { supabase } from '../services/supabaseService';

const loadCompanyJobsData = async (companyId?: string): Promise<{
  jobs: Job[];
  jobStats: Record<string, { views: number; applicants: number }>;
}> => {
  if (!companyId) {
    return { jobs: [], jobStats: {} };
  }

  const rawJobs = await fetchCompanyPublishedJobPayloads();
  const jobs = mapJobs(rawJobs || [], undefined, undefined, true, true)
    .filter((job) => String(job.company_id || '') === String(companyId))
    .sort((left, right) => {
      const leftTime = new Date((left as any).updated_at || left.scrapedAt || 0).getTime();
      const rightTime = new Date((right as any).updated_at || right.scrapedAt || 0).getTime();
      return rightTime - leftTime;
    });
  const jobIds = jobs.map((job) => job.id);
  const stats: Record<string, { views: number; applicants: number }> = {};
  jobIds.forEach((id: string) => {
    stats[id] = { views: 0, applicants: 0 };
  });

  if (jobIds.length === 0) {
    return { jobs, jobStats: stats };
  }

  const { data: apps } = supabase
    ? await supabase
        .from('job_applications')
        .select('job_id')
        .in('job_id', jobIds)
    : { data: null };

  apps?.forEach((app: any) => {
    if (stats[app.job_id]) {
      stats[app.job_id].applicants++;
    }
  });

  const viewsResponse = await fetchCompanyJobViews(companyId, 90);

  viewsResponse?.job_views?.forEach((view: any) => {
    const jobId = String(view?.job_id || '');
    if (jobId && stats[jobId]) {
      stats[jobId].views = Number(view?.views || 0);
    }
  });

  return { jobs, jobStats: stats };
};

export const useCompanyJobsData = (companyId?: string) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobStats, setJobStats] = useState<Record<string, { views: number; applicants: number }>>({});
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  const refreshJobs = async () => {
    if (!companyId) return;
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
      console.error('Failed to load company jobs data', error);
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
    refreshJobs
  };
};
