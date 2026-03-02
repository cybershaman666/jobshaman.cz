import React from 'react';
import type { CompanyDashboardTab } from '../../hooks/useCompanyDashboardNavigation';

interface CompanyDashboardContentProps {
  activeTab: CompanyDashboardTab;
  overview: () => React.ReactNode;
  jobs: () => React.ReactNode;
  applications: () => React.ReactNode;
  assessments: () => React.ReactNode;
  candidates: () => React.ReactNode;
  settings: () => React.ReactNode;
}

const CompanyDashboardContent: React.FC<CompanyDashboardContentProps> = ({
  activeTab,
  overview,
  jobs,
  applications,
  assessments,
  candidates,
  settings
}) => {
  switch (activeTab) {
    case 'overview':
      return <>{overview()}</>;
    case 'jobs':
      return <>{jobs()}</>;
    case 'applications':
      return <>{applications()}</>;
    case 'assessments':
      return <>{assessments()}</>;
    case 'candidates':
      return <>{candidates()}</>;
    case 'settings':
      return <>{settings()}</>;
    default:
      return null;
  }
};

export default CompanyDashboardContent;
