import React from 'react';
import type { CompanyProfile } from '../../../../types';
import CompanySettings from '../../../../components/CompanySettings';

interface SettingsTabProps {
  companyProfile?: CompanyProfile | null;
  onProfileUpdate?: (profile: CompanyProfile) => void;
  onDeleteAccount?: () => Promise<boolean>;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  companyProfile,
  onProfileUpdate,
  onDeleteAccount,
}) => {
  if (!companyProfile) return null;

  return (
    <CompanySettings
      profile={companyProfile}
      onSave={(profile) => onProfileUpdate?.(profile)}
      onDeleteAccount={onDeleteAccount}
    />
  );
};
