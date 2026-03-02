import { Dispatch, SetStateAction } from 'react';
import { Assessment, ApplicationDossier, Job } from '../types';

interface AssessmentContext {
  jobId?: string;
  jobTitle?: string;
  candidateEmail?: string;
  candidateId?: string;
  candidateName?: string;
  applicationId?: string;
  assessmentId?: string;
  assessmentName?: string;
}

interface UseCompanyAssessmentActionsArgs {
  jobs: Job[];
  selectedApplicationDetail: ApplicationDossier | null;
  assessmentLibrary: Assessment[];
  duplicateAssessment: (assessmentId: string) => Promise<Assessment | null>;
  archiveAssessment: (assessmentId: string) => Promise<boolean>;
  appendActivityEvent: (
    eventType: string,
    payload: Record<string, any>,
    subjectType?: string,
    subjectId?: string
  ) => void | Promise<void>;
  setAssessmentJobId: Dispatch<SetStateAction<string | undefined>>;
  setAssessmentContext: Dispatch<SetStateAction<AssessmentContext | null>>;
  setActiveTab: Dispatch<SetStateAction<'overview' | 'jobs' | 'applications' | 'candidates' | 'settings' | 'assessments'>>;
  setShowInvitationModal: Dispatch<SetStateAction<boolean>>;
}

export const useCompanyAssessmentActions = ({
  jobs,
  selectedApplicationDetail,
  assessmentLibrary,
  duplicateAssessment,
  archiveAssessment,
  appendActivityEvent,
  setAssessmentJobId,
  setAssessmentContext,
  setActiveTab,
  setShowInvitationModal
}: UseCompanyAssessmentActionsArgs) => {
  const handleCreateAssessmentFromJob = (jobId: string) => {
    const linkedJob = jobs.find((job) => job.id === jobId);
    setAssessmentJobId(jobId);
    setAssessmentContext((prev) => ({
      ...prev,
      jobId,
      jobTitle: linkedJob?.title || prev?.jobTitle,
    }));
    setActiveTab('assessments');
  };

  const handleCreateAssessmentFromApplication = () => {
    if (!selectedApplicationDetail) return;
    setAssessmentJobId(String(selectedApplicationDetail.job_id));
    setAssessmentContext((prev) => ({
      ...prev,
      jobId: String(selectedApplicationDetail.job_id),
      jobTitle: selectedApplicationDetail.job_title || prev?.jobTitle,
      candidateEmail: selectedApplicationDetail.candidate_profile_snapshot?.email || selectedApplicationDetail.candidate_email || prev?.candidateEmail,
      candidateId: selectedApplicationDetail.candidate_id || prev?.candidateId,
      candidateName: selectedApplicationDetail.candidate_profile_snapshot?.name || selectedApplicationDetail.candidate_name || prev?.candidateName,
      applicationId: selectedApplicationDetail.id,
    }));
    setActiveTab('assessments');
  };

  const handleInviteCandidateFromApplication = () => {
    if (!selectedApplicationDetail) return;
    handleCreateAssessmentFromApplication();
    setShowInvitationModal(true);
  };

  const handleUseSavedAssessment = (assessment: Assessment) => {
    setAssessmentContext((prev) => ({
      ...(prev || {}),
      assessmentId: assessment.id,
      assessmentName: assessment.title,
      jobTitle: prev?.jobTitle || assessment.role,
    }));
  };

  const handleDuplicateAssessment = async (assessmentId: string) => {
    if (!assessmentId) return;
    const duplicated = await duplicateAssessment(assessmentId);
    if (duplicated) {
      handleUseSavedAssessment(duplicated);
      appendActivityEvent('assessment_duplicated', {
        assessment_id: duplicated.id,
        assessment_title: duplicated.title || null
      }, 'assessment', duplicated.id);
    }
  };

  const handleArchiveAssessment = async (assessmentId: string) => {
    if (!assessmentId) return;
    const ok = await archiveAssessment(assessmentId);
    if (ok) {
      const target = assessmentLibrary.find((item) => item.id === assessmentId);
      setAssessmentContext((prev) => (
        prev?.assessmentId === assessmentId
          ? { ...prev, assessmentId: undefined, assessmentName: undefined }
          : prev
      ));
      appendActivityEvent('assessment_archived', {
        assessment_id: assessmentId,
        assessment_title: target?.title || null
      }, 'assessment', assessmentId);
    }
  };

  return {
    handleCreateAssessmentFromJob,
    handleCreateAssessmentFromApplication,
    handleInviteCandidateFromApplication,
    handleUseSavedAssessment,
    handleDuplicateAssessment,
    handleArchiveAssessment
  };
};
