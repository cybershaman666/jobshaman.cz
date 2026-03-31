import React from 'react';
import type { CompanyProfile } from '../types';
import CompanyMapWorkspace from './company/CompanyMapWorkspace';

interface CompanyDashboardProps {
  companyProfile?: CompanyProfile | null;
  userEmail?: string;
  onDeleteAccount?: () => Promise<boolean>;
  onProfileUpdate?: (profile: CompanyProfile) => void;
  onOpenCompanyPricing?: () => void;
}

const CompanyDashboard: React.FC<CompanyDashboardProps> = ({
  companyProfile,
  userEmail,
  onDeleteAccount,
  onProfileUpdate,
  onOpenCompanyPricing,
}) => (
  <CompanyMapWorkspace
    companyProfile={companyProfile}
    userEmail={userEmail}
    onDeleteAccount={onDeleteAccount}
    onProfileUpdate={onProfileUpdate}
    onOpenCompanyPricing={onOpenCompanyPricing}
  />
);

export default CompanyDashboard;
