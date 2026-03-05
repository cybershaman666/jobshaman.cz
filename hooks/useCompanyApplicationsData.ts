import { useEffect, useState } from 'react';
import { CompanyApplicationRow, DialogueDossier } from '../types';
import {
  fetchCompanyDialogueDetail,
  fetchCompanyDialogues
} from '../services/jobApplicationService';

interface UseCompanyApplicationsDataArgs {
  companyId?: string;
  activeTab: string;
  selectedJobId?: string;
}

export const useCompanyDialoguesData = ({
  companyId,
  activeTab,
  selectedJobId
}: UseCompanyApplicationsDataArgs) => {
  const [dialogues, setDialogues] = useState<CompanyApplicationRow[]>([]);
  const [dialoguesLoading, setDialoguesLoading] = useState(false);
  const [dialoguesUpdating, setDialoguesUpdating] = useState<Record<string, boolean>>({});
  const [selectedDialogueId, setSelectedDialogueId] = useState<string | null>(null);
  const [selectedDialogueDetail, setSelectedDialogueDetail] = useState<DialogueDossier | null>(null);
  const [dialogueDetailLoading, setDialogueDetailLoading] = useState(false);
  const [lastDialoguesSyncAt, setLastDialoguesSyncAt] = useState<string | null>(null);

  const refreshDialogues = async (options?: {
    jobId?: string;
    silent?: boolean;
  }) => {
    if (!companyId) return;
    const jobId = options?.jobId ?? (activeTab === 'applications' ? (selectedJobId || undefined) : undefined);
    if (!options?.silent) {
      setDialoguesLoading(true);
    }
    try {
      const rows = await fetchCompanyDialogues(companyId, jobId, 500);
      setDialogues(rows);
      setLastDialoguesSyncAt(new Date().toISOString());
    } finally {
      if (!options?.silent) {
        setDialoguesLoading(false);
      }
    }
  };

  const openDialogueDetail = async (dialogueId: string) => {
    if (!dialogueId) return;
    setSelectedDialogueId(dialogueId);
    setDialogueDetailLoading(true);
    try {
      const detail = await fetchCompanyDialogueDetail(dialogueId);
      setSelectedDialogueDetail(detail);
    } finally {
      setDialogueDetailLoading(false);
    }
  };

  const closeDialogueDetail = () => {
    setSelectedDialogueId(null);
    setSelectedDialogueDetail(null);
  };

  const setDialogueUpdating = (dialogueId: string, updating: boolean) => {
    setDialoguesUpdating((prev) => ({ ...prev, [dialogueId]: updating }));
  };

  const applyDialogueStatusLocally = (
    dialogueId: string,
    status: CompanyApplicationRow['status']
  ) => {
    setDialogues((prev) => prev.map((app) => (
      app.id === dialogueId ? { ...app, status } : app
    )));
    setSelectedDialogueDetail((prev) => (
      prev && prev.id === dialogueId ? { ...prev, status } : prev
    ));
  };

  useEffect(() => {
    if (!companyId || (activeTab !== 'applications' && activeTab !== 'overview')) return;
    void refreshDialogues({
      jobId: activeTab === 'applications' ? (selectedJobId || undefined) : undefined
    });
  }, [companyId, activeTab, selectedJobId]);

  useEffect(() => {
    if (!companyId || (activeTab !== 'applications' && activeTab !== 'overview')) return;

    const refreshVisibleDialogues = () => {
      void refreshDialogues({
        jobId: activeTab === 'applications' ? (selectedJobId || undefined) : undefined,
        silent: true
      });
    };

    const intervalId = window.setInterval(refreshVisibleDialogues, 30000);
    const handleFocus = () => refreshVisibleDialogues();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshVisibleDialogues();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [companyId, activeTab, selectedJobId]);

  return {
    dialogues,
    dialoguesLoading,
    dialoguesUpdating,
    selectedDialogueId,
    selectedDialogueDetail,
    dialogueDetailLoading,
    lastDialoguesSyncAt,
    refreshDialogues,
    openDialogueDetail,
    closeDialogueDetail,
    setDialogueUpdating,
    applyDialogueStatusLocally,
    applications: dialogues,
    applicationsLoading: dialoguesLoading,
    applicationsUpdating: dialoguesUpdating,
    selectedApplicationId: selectedDialogueId,
    selectedApplicationDetail: selectedDialogueDetail,
    applicationDetailLoading: dialogueDetailLoading,
    lastApplicationsSyncAt: lastDialoguesSyncAt,
    refreshApplications: refreshDialogues,
    openApplicationDetail: openDialogueDetail,
    closeApplicationDetail: closeDialogueDetail,
    setApplicationUpdating: setDialogueUpdating,
    applyApplicationStatusLocally: applyDialogueStatusLocally
  };
};

export const useCompanyApplicationsData = useCompanyDialoguesData;
