import React from 'react';

import PublicCompanyProfilePage from '../../../components/challenges/PublicCompanyProfilePage';

export interface CompanySpacePageProps {
  companyId: string;
  onBack: () => void;
  onOpenChallenge: (jobId: string) => void;
}

const CompanySpacePage: React.FC<CompanySpacePageProps> = ({
  companyId,
  onBack,
  onOpenChallenge,
}) => {
  return (
    <PublicCompanyProfilePage
      companyId={companyId}
      onBack={onBack}
      onOpenChallenge={onOpenChallenge}
    />
  );
};

export default CompanySpacePage;
