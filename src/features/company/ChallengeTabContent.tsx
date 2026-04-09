import React from 'react';
import type { CompanyProfile } from '../../../types';
import { OverviewTab } from './tabs/OverviewTab';
import { ChallengesTab } from './tabs/ChallengesTab';
import { ApplicationsTab } from './tabs/ApplicationsTab';
import { CandidatesTab } from './tabs/CandidatesTab';
import { AssessmentsTab } from './tabs/AssessmentsTab';
import { CalendarTab } from './tabs/CalendarTab';
import { TeamTab } from './tabs/TeamTab';
import { SettingsTab } from './tabs/SettingsTab';

interface ChallengeTabContentProps {
  activeTab: string;
  companyId: string;
  companyProfile?: CompanyProfile | null;
  jobsData: any;
  activityLog: any;
  dialoguesData: any;
  assessmentsData: any;
  candidatesData: any;
  onProfileUpdate?: (profile: CompanyProfile) => void;
  onDeleteAccount?: () => Promise<boolean>;
}

export const ChallengeTabContent: React.FC<ChallengeTabContentProps> = ({
  activeTab,
  companyId,
  companyProfile,
  jobsData,
  activityLog,
  dialoguesData,
  assessmentsData,
  candidatesData,
  onProfileUpdate,
  onDeleteAccount,
}) => {
  switch (activeTab) {
    case 'overview':
      return (
        <OverviewTab
          companyId={companyId}
          jobsData={jobsData}
          activityLog={activityLog}
          dialoguesData={dialoguesData}
          assessmentsData={assessmentsData}
          candidatesData={candidatesData}
        />
      );
    case 'challenges':
      return <ChallengesTab jobsData={jobsData} />;
    case 'applications':
      return <ApplicationsTab dialoguesData={dialoguesData} />;
    case 'candidates':
      return <CandidatesTab candidatesData={candidatesData} />;
    case 'assessments':
      return <AssessmentsTab assessmentsData={assessmentsData} companyProfile={companyProfile} jobs={jobsData?.jobs || []} />;
    case 'calendar':
      return (
        <CalendarTab
          companyProfile={companyProfile}
          jobsData={jobsData}
          dialoguesData={dialoguesData}
        />
      );
    case 'team':
      return (
        <TeamTab
          companyProfile={companyProfile}
          onProfileUpdate={onProfileUpdate}
        />
      );
    case 'settings':
      return (
        <SettingsTab
          companyProfile={companyProfile}
          onProfileUpdate={onProfileUpdate}
          onDeleteAccount={onDeleteAccount}
        />
      );
    default:
      return null;
  }
};
