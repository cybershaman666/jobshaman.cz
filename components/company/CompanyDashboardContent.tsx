import React from 'react';
import type { CompanyDashboardTab } from '../../hooks/useCompanyDashboardNavigation';

interface CompanyDashboardContentProps {
  activeTab: CompanyDashboardTab;
  overview: () => React.ReactNode;
  jobs: () => React.ReactNode;
  dialogues?: () => React.ReactNode;
  applications: () => React.ReactNode;
  assessments: () => React.ReactNode;
  candidates: () => React.ReactNode;
  learningResources: () => React.ReactNode;
  settings: () => React.ReactNode;
}

const CompanyDashboardContent: React.FC<CompanyDashboardContentProps> = ({
  activeTab,
  overview,
  jobs,
  dialogues,
  applications,
  assessments,
  candidates,
  learningResources,
  settings
}) => {
  switch (activeTab) {
    case 'overview':
      return <>{overview()}</>;
    case 'jobs':
      return <>{jobs()}</>;
    case 'applications':
      return <>{(dialogues || applications)()}</>;
    case 'assessments':
      return <>{assessments()}</>;
    case 'candidates':
      return <>{candidates()}</>;
    case 'learning_resources':
      return <>{learningResources()}</>;
    case 'settings':
      return <>{settings()}</>;
    default:
      return null;
  }
};

export default CompanyDashboardContent;
