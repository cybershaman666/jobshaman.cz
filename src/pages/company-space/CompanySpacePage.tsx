import React from 'react';

import CareerOSPublicCompanySpace from '../../../components/careeros/CareerOSPublicCompanySpace';

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
    <CareerOSPublicCompanySpace
      companyId={companyId}
      onBack={onBack}
      onOpenChallenge={onOpenChallenge}
    />
  );
};

export default CompanySpacePage;
