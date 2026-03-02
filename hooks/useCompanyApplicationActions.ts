import { CompanyApplicationRow } from '../types';
import { updateCompanyApplicationStatus } from '../services/jobApplicationService';

export const useCompanyApplicationActions = ({
  applications,
  companyId,
  activeTab,
  selectedJobId,
  refreshActivityLog,
  refreshApplications,
  appendActivityEvent,
  setApplicationUpdating,
  applyApplicationStatusLocally
}: {
  applications: CompanyApplicationRow[];
  companyId?: string;
  activeTab: string;
  selectedJobId: string;
  refreshActivityLog: (companyId?: string) => Promise<void>;
  refreshApplications: (options?: { jobId?: string; silent?: boolean }) => Promise<void>;
  appendActivityEvent: (
    eventType: string,
    payload: Record<string, any>,
    subjectType?: string,
    subjectId?: string
  ) => void | Promise<void>;
  setApplicationUpdating: (applicationId: string, updating: boolean) => void;
  applyApplicationStatusLocally: (applicationId: string, status: CompanyApplicationRow['status']) => void;
}) => {
  const handleApplicationStatusChange = async (
    applicationId: string,
    status: CompanyApplicationRow['status']
  ) => {
    if (!applicationId) return;
    setApplicationUpdating(applicationId, true);
    const result = await updateCompanyApplicationStatus(applicationId, status);
    if (result.ok) {
      const target = applications.find((app) => app.id === applicationId);
      applyApplicationStatusLocally(applicationId, status);
      if (result.via === 'fallback') {
        appendActivityEvent('application_status_changed', {
          application_id: applicationId,
          status,
          candidate_name: target?.candidate_name || null,
          job_title: target?.job_title || null
        }, 'application', applicationId);
      } else if (result.via === 'api' && companyId) {
        await Promise.all([
          refreshActivityLog(companyId),
          refreshApplications({
            jobId: activeTab === 'applications' ? (selectedJobId || undefined) : undefined,
            silent: true
          })
        ]);
      } else {
        await refreshApplications({
          jobId: activeTab === 'applications' ? (selectedJobId || undefined) : undefined,
          silent: true
        });
      }
    }
    setApplicationUpdating(applicationId, false);
  };

  return { handleApplicationStatusChange };
};
