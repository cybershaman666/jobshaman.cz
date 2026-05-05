import { useEffect, useState } from 'react';
import type { CompanyApplicationRow, DialogueDossier } from '../types';

interface UseCompanyApplicationsDataArgs {
  companyId?: string;
  activeTab: string;
  selectedJobId?: string;
}

export const useCompanyDialoguesData = ({
  companyId,
  activeTab,
  selectedJobId,
}: UseCompanyApplicationsDataArgs) => {
  const [dialogues, setDialogues] = useState<CompanyApplicationRow[]>([]);
  const [dialoguesLoading, setDialoguesLoading] = useState(false);
  const [dialoguesUpdating, setDialoguesUpdating] = useState<Record<string, boolean>>({});
  const [selectedDialogueId, setSelectedDialogueId] = useState<string | null>(null);
  const [selectedDialogueDetail, setSelectedDialogueDetail] = useState<DialogueDossier | null>(null);
  const [dialogueDetailLoading, setDialogueDetailLoading] = useState(false);
  const [lastDialoguesSyncAt, setLastDialoguesSyncAt] = useState<string | null>(null);

  const refreshDialogues = async () => {
    if (!companyId || (activeTab !== 'applications' && activeTab !== 'overview' && activeTab !== 'problem_map')) {
      setDialogues([]);
      return;
    }

    setDialoguesLoading(true);
    try {
      void selectedJobId;
      setDialogues([]);
      setLastDialoguesSyncAt(new Date().toISOString());
    } finally {
      setDialoguesLoading(false);
    }
  };

  const openDialogueDetail = async (dialogueId: string) => {
    if (!dialogueId) return;
    setSelectedDialogueId(dialogueId);
    setDialogueDetailLoading(true);
    try {
      setSelectedDialogueDetail(null);
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
    status: CompanyApplicationRow['status'],
  ) => {
    setDialogues((prev) => prev.map((app) => (
      app.id === dialogueId ? { ...app, status } : app
    )));
    setSelectedDialogueDetail((prev) => (
      prev && prev.id === dialogueId ? { ...prev, status } : prev
    ));
  };

  useEffect(() => {
    void refreshDialogues();
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
    applyApplicationStatusLocally: applyDialogueStatusLocally,
  };
};

export const useCompanyApplicationsData = useCompanyDialoguesData;
