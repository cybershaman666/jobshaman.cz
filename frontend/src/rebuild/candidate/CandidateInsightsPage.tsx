import React from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ApplicationMessageAttachment,
  CandidateDialogueCapacity,
  CVDocument,
  DialogueDetail,
  DialogueMessage,
  DialogueSummary,
  UserProfile,
} from '../../types';
import type { CandidatePreferenceProfile, Role } from '../models';
import { CandidateDashboardV2 } from './CandidateDashboardV2';

export const CandidateInsightsPage: React.FC<{
  roles: Role[];
  preferences: CandidatePreferenceProfile;
  setPreferences: React.Dispatch<React.SetStateAction<CandidatePreferenceProfile>>;
  userProfile: UserProfile;
  setUserProfile: (updates: Partial<UserProfile>) => void;
  activeCvDocument: CVDocument | null;
  cvDocuments: CVDocument[];
  cvLoading: boolean;
  cvBusy: boolean;
  cvReviewBusy: boolean;
  candidateApplications: DialogueSummary[];
  applicationsLoading: boolean;
  candidateCapacity: CandidateDialogueCapacity | null;
  selectedApplicationId: string;
  selectedApplicationDetail: DialogueDetail | null;
  selectedApplicationMessages: DialogueMessage[];
  applicationDetailLoading: boolean;
  applicationMessageBusy: boolean;
  applicationWithdrawBusy: boolean;
  savedRoleIds: string[];
  isSavingProfile: boolean;
  onSaveProfile: (updates?: Partial<UserProfile>) => void | Promise<void>;
  onOpenAuth: () => void;
  onUploadCv: (file: File) => Promise<void>;
  onSelectCv: (cvId: string) => Promise<void>;
  onDeleteCv: (cvId: string) => Promise<void>;
  onSaveCvReview: (input: { jobTitle: string; skills: string[]; summary: string }) => Promise<void>;
  onSelectApplication: (applicationId: string) => void;
  onUploadMessageAttachment: (file: File) => Promise<ApplicationMessageAttachment>;
  onSendApplicationMessage: (body: string, attachments: ApplicationMessageAttachment[]) => Promise<void>;
  onWithdrawApplication: () => Promise<void>;
  onToggleSavedRole: (roleId: string) => void;
  onUploadPhoto: (file: File) => Promise<void>;
  onSignOut?: () => void;
  onCompanySwitch?: () => void;
  currentLanguage?: string;
  onLanguageChange?: (lang: string) => void;
  navigate: (path: string) => void;
}> = ({
  roles,
  preferences,
  userProfile,
  setUserProfile,
  activeCvDocument,
  cvDocuments,
  cvLoading,
  cvBusy,
  candidateApplications,
  applicationsLoading,
  candidateCapacity,
  selectedApplicationId,
  savedRoleIds,
  isSavingProfile,
  onSaveProfile,
  onOpenAuth,
  onUploadCv,
  onSelectCv,
  onDeleteCv,
  onSelectApplication,
  onToggleSavedRole,
  onUploadPhoto,
  onSignOut,
  onCompanySwitch,
  currentLanguage,
  onLanguageChange,
  navigate,
}) => {
  const { t } = useTranslation();

  return (
    <CandidateDashboardV2
      roles={roles}
      preferences={preferences}
      userProfile={userProfile}
      setUserProfile={setUserProfile}
      activeCvDocument={activeCvDocument}
      cvDocuments={cvDocuments}
      cvLoading={cvLoading}
      cvBusy={cvBusy}
      candidateApplications={candidateApplications}
      applicationsLoading={applicationsLoading}
      candidateCapacity={candidateCapacity}
      selectedApplicationId={selectedApplicationId}
      savedRoleIds={savedRoleIds}
      isSavingProfile={isSavingProfile}
      onSaveProfile={onSaveProfile}
      onOpenAuth={onOpenAuth}
      onSelectApplication={onSelectApplication}
      onToggleSavedRole={onToggleSavedRole}
      onUploadCv={onUploadCv}
      onSelectCv={onSelectCv}
      onDeleteCv={onDeleteCv}
      onUploadPhoto={onUploadPhoto}
      onSignOut={onSignOut}
      onCompanySwitch={onCompanySwitch}
      currentLanguage={currentLanguage}
      onLanguageChange={onLanguageChange}
      navigate={navigate}
      t={t}
    />
  );
};
