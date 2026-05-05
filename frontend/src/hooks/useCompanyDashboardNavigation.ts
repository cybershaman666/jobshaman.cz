import { useEffect, useState } from 'react';

export type CompanyDashboardTab = 'overview' | 'jobs' | 'applications' | 'candidates' | 'settings' | 'assessments' | 'learning_resources' | 'calendar';

export const useCompanyDashboardNavigation = () => {
  const [activeTab, setActiveTab] = useState<CompanyDashboardTab>('overview');
  const [editorSeedJobId, setEditorSeedJobId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tab = String(params.get('tab') || '').trim();
      if (tab === 'dialogues' || tab === 'applications') {
        setActiveTab('applications');
      } else if (tab === 'jobs' || tab === 'open_wave' || tab === 'open_challenge') {
        setActiveTab('jobs');
      } else if (tab === 'candidates') {
        setActiveTab('candidates');
      } else if (tab === 'settings' || tab === 'dna') {
        setActiveTab('settings');
      } else if (tab === 'assessments') {
        setActiveTab('assessments');
      } else if (tab === 'calendar') {
        setActiveTab('calendar');
      } else if (tab === 'learning_resources' || tab === 'learning') {
        setActiveTab('learning_resources');
      } else if (tab === 'overview' || tab === 'problem_map') {
        setActiveTab('overview');
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
