import { useEffect, useState } from 'react';
import { ApplicationDossier, CompanyApplicationRow } from '../types';
import {
  fetchCompanyApplicationDetail,
  fetchCompanyApplications
} from '../services/jobApplicationService';

interface UseCompanyApplicationsDataArgs {
  companyId?: string;
  activeTab: string;
  selectedJobId?: string;
}

export const useCompanyApplicationsData = ({
  companyId,
  activeTab,
  selectedJobId
}: UseCompanyApplicationsDataArgs) => {
  const [applications, setApplications] = useState<CompanyApplicationRow[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsUpdating, setApplicationsUpdating] = useState<Record<string, boolean>>({});
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [selectedApplicationDetail, setSelectedApplicationDetail] = useState<ApplicationDossier | null>(null);
  const [applicationDetailLoading, setApplicationDetailLoading] = useState(false);
  const [lastApplicationsSyncAt, setLastApplicationsSyncAt] = useState<string | null>(null);

  const refreshApplications = async (options?: {
    jobId?: string;
    silent?: boolean;
  }) => {
    if (!companyId) return;
    const jobId = options?.jobId ?? (activeTab === 'applications' ? (selectedJobId || undefined) : undefined);
    if (!options?.silent) {
      setApplicationsLoading(true);
    }
    try {
      const rows = await fetchCompanyApplications(companyId, jobId, 500);
      setApplications(rows);
      setLastApplicationsSyncAt(new Date().toISOString());
    } finally {
      if (!options?.silent) {
        setApplicationsLoading(false);
      }
    }
  };

  const openApplicationDetail = async (applicationId: string) => {
    if (!applicationId) return;
    setSelectedApplicationId(applicationId);
    setApplicationDetailLoading(true);
    try {
      const detail = await fetchCompanyApplicationDetail(applicationId);
      setSelectedApplicationDetail(detail);
    } finally {
      setApplicationDetailLoading(false);
    }
  };

  const closeApplicationDetail = () => {
    setSelectedApplicationId(null);
    setSelectedApplicationDetail(null);
  };

  const setApplicationUpdating = (applicationId: string, updating: boolean) => {
    setApplicationsUpdating((prev) => ({ ...prev, [applicationId]: updating }));
  };

  const applyApplicationStatusLocally = (
    applicationId: string,
    status: CompanyApplicationRow['status']
  ) => {
    setApplications((prev) => prev.map((app) => (
      app.id === applicationId ? { ...app, status } : app
    )));
    setSelectedApplicationDetail((prev) => (
      prev && prev.id === applicationId ? { ...prev, status } : prev
    ));
  };

  useEffect(() => {
    if (!companyId || (activeTab !== 'applications' && activeTab !== 'overview')) return;
    void refreshApplications({
      jobId: activeTab === 'applications' ? (selectedJobId || undefined) : undefined
    });
  }, [companyId, activeTab, selectedJobId]);

  useEffect(() => {
    if (!companyId || (activeTab !== 'applications' && activeTab !== 'overview')) return;

    const refreshVisibleApplications = () => {
      void refreshApplications({
        jobId: activeTab === 'applications' ? (selectedJobId || undefined) : undefined,
        silent: true
      });
    };

    const intervalId = window.setInterval(refreshVisibleApplications, 30000);
    const handleFocus = () => refreshVisibleApplications();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshVisibleApplications();
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
    applications,
    applicationsLoading,
    applicationsUpdating,
    selectedApplicationId,
    selectedApplicationDetail,
    applicationDetailLoading,
    lastApplicationsSyncAt,
    refreshApplications,
    openApplicationDetail,
    closeApplicationDetail,
    setApplicationUpdating,
    applyApplicationStatusLocally
  };
};
