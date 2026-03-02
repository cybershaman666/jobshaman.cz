import { useEffect, useState } from 'react';

export type CompanyDashboardTab = 'overview' | 'jobs' | 'applications' | 'candidates' | 'settings' | 'assessments';

export const useCompanyDashboardNavigation = () => {
  const [activeTab, setActiveTab] = useState<CompanyDashboardTab>('overview');
  const [editorSeedJobId, setEditorSeedJobId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'assessments') {
        setActiveTab('assessments');
      }
    } catch {
      // no-op
    }
  }, []);

  return {
    activeTab,
    setActiveTab,
    editorSeedJobId,
    setEditorSeedJobId
  };
};
