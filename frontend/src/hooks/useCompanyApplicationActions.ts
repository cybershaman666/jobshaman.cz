import { CompanyApplicationRow } from '../types';
import { updateCompanyDialogueStatus } from '../services/jobApplicationService';

export const useCompanyDialogueActions = ({
  dialogues,
  companyId,
  activeTab,
  selectedJobId,
  refreshActivityLog,
  refreshDialogues,
  appendActivityEvent,
  setDialogueUpdating,
  applyDialogueStatusLocally
}: {
  dialogues: CompanyApplicationRow[];
  companyId?: string;
  activeTab: string;
  selectedJobId: string;
  refreshActivityLog: (companyId?: string) => Promise<void>;
  refreshDialogues: (options?: { jobId?: string; silent?: boolean }) => Promise<void>;
  appendActivityEvent: (
    eventType: string,
    payload: Record<string, any>,
    subjectType?: string,
    subjectId?: string
  ) => void | Promise<void>;
  setDialogueUpdating: (dialogueId: string, updating: boolean) => void;
  applyDialogueStatusLocally: (dialogueId: string, status: CompanyApplicationRow['status']) => void;
}) => {
  const handleDialogueStatusChange = async (
    dialogueId: string,
    status: CompanyApplicationRow['status']
  ) => {
    if (!dialogueId) return;
    setDialogueUpdating(dialogueId, true);
    const result = await updateCompanyDialogueStatus(dialogueId, status);
    if (result.ok) {
      const target = dialogues.find((app) => app.id === dialogueId);
      applyDialogueStatusLocally(dialogueId, status);
      if (result.via === 'fallback') {
        appendActivityEvent('application_status_changed', {
          application_id: dialogueId,
          dialogue_id: dialogueId,
          status,
          candidate_name: target?.candidate_name || null,
          job_title: target?.job_title || null
        }, 'application', dialogueId);
      } else if (result.via === 'api' && companyId) {
        await Promise.all([
          refreshActivityLog(companyId),
          refreshDialogues({
            jobId: activeTab === 'applications' ? (selectedJobId || undefined) : undefined,
            silent: true
          })
        ]);
      } else {
        await refreshDialogues({
          jobId: activeTab === 'applications' ? (selectedJobId || undefined) : undefined,
          silent: true
        });
      }
    }
    setDialogueUpdating(dialogueId, false);
  };

  return { handleDialogueStatusChange, handleApplicationStatusChange: handleDialogueStatusChange };
};

export const useCompanyApplicationActions = useCompanyDialogueActions;
