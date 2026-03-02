import { Dispatch, SetStateAction } from 'react';
import { Job } from '../types';
import { supabase } from '../services/supabaseService';
import { updateCompanyJobLifecycle } from '../services/companyJobDraftService';

type TranslateFn = (key: string, options?: any) => string;

export const useCompanyJobActions = ({
  jobs,
  companyId,
  t,
  setJobs,
  refreshJobs,
  refreshActivityLog,
  appendActivityEvent
}: {
  jobs: Job[];
  companyId?: string;
  t: TranslateFn;
  setJobs: Dispatch<SetStateAction<Job[]>>;
  refreshJobs: () => Promise<void>;
  refreshActivityLog: (companyId?: string) => Promise<void>;
  appendActivityEvent: (
    eventType: string,
    payload: Record<string, any>,
    subjectType?: string,
    subjectId?: string
  ) => void | Promise<void>;
}) => {
  const handleEditorLifecycleChange = (
    jobId: string | number,
    status: 'active' | 'paused' | 'closed' | 'archived',
    options?: { skipAudit?: boolean; refreshJobs?: boolean }
  ) => {
    const target = jobs.find((job) => String(job.id) === String(jobId));
    const previousStatus = String((target as any)?.status || 'active');
    setJobs((prev) => prev.map((job) => (
      String(job.id) === String(jobId)
        ? { ...(job as any), status }
        : job
    )));
    if (options?.refreshJobs) {
      void refreshJobs();
    }
    if (options?.skipAudit && companyId) {
      void refreshActivityLog(companyId);
    }
    if (!options?.skipAudit && status !== previousStatus) {
      const eventType = status === 'closed'
        ? 'job_closed'
        : status === 'paused'
          ? 'job_paused'
          : status === 'archived'
            ? 'job_archived'
            : 'job_reopened';
      appendActivityEvent(eventType, {
        job_id: String(jobId),
        job_title: target?.title || null,
        previous_status: previousStatus,
        next_status: status
      }, 'job', String(jobId));
    }
  };

  const updateJobLifecycleWithFallback = async (
    jobId: string,
    status: 'active' | 'paused' | 'closed' | 'archived'
  ): Promise<{ ok: boolean; via: 'api' | 'fallback' | 'failed' }> => {
    const result = await updateCompanyJobLifecycle(jobId, status);
    if (result.ok) return { ok: true, via: 'api' };
    if (!supabase) return { ok: false, via: 'failed' };
    const { error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', jobId);
    return error
      ? { ok: false, via: 'failed' }
      : { ok: true, via: 'fallback' };
  };

  const handleDeleteJob = async (jobId: string) => {
    if (confirm(t('company.dashboard.actions.confirm_delete'))) {
      try {
        const result = await updateJobLifecycleWithFallback(jobId, 'archived');
        if (!result.ok) {
          alert(t('common.error_occurred'));
          return;
        }
        handleEditorLifecycleChange(jobId, 'archived', { skipAudit: result.via === 'api' });
      } catch (error) {
        console.error('Failed to archive job:', error);
        alert(t('common.error_occurred'));
      }
    }
  };

  const handleCloseJob = async (jobId: string) => {
    if (confirm(t('company.dashboard.actions.confirm_close'))) {
      try {
        const result = await updateJobLifecycleWithFallback(jobId, 'closed');
        if (!result.ok) {
          alert(t('common.error_occurred'));
          return;
        }
        handleEditorLifecycleChange(jobId, 'closed', { skipAudit: result.via === 'api' });
      } catch (error) {
        console.error('Failed to close job:', error);
        alert(t('common.error_occurred'));
      }
    }
  };

  const handleReopenJob = async (jobId: string) => {
    const result = await updateJobLifecycleWithFallback(jobId, 'active');
    if (!result.ok) {
      alert(t('common.error_occurred'));
      return;
    }
    handleEditorLifecycleChange(jobId, 'active', { skipAudit: result.via === 'api' });
  };

  return {
    handleEditorLifecycleChange,
    handleDeleteJob,
    handleCloseJob,
    handleReopenJob
  };
};
