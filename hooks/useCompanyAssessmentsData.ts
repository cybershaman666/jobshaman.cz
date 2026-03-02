import { useEffect, useState } from 'react';
import { Assessment } from '../types';
import {
  duplicateCompanyAssessment,
  listCompanyAssessmentLibrary,
  updateCompanyAssessmentStatus
} from '../services/assessmentLibraryService';

export const useCompanyAssessmentsData = (
  companyId?: string,
  activeTab?: string
) => {
  const [assessmentLibrary, setAssessmentLibrary] = useState<Assessment[]>([]);
  const [assessmentLibraryLoading, setAssessmentLibraryLoading] = useState(false);
  const [assessmentLibraryBusyId, setAssessmentLibraryBusyId] = useState<string | null>(null);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [showInvitationsList, setShowInvitationsList] = useState(false);
  const [lastAssessmentLibrarySyncAt, setLastAssessmentLibrarySyncAt] = useState<string | null>(null);

  const refreshAssessmentLibrary = async () => {
    if (!companyId) return;
    setAssessmentLibraryLoading(true);
    try {
      const rows = await listCompanyAssessmentLibrary();
      setAssessmentLibrary(rows.filter((item) => item.status !== 'archived'));
      setLastAssessmentLibrarySyncAt(new Date().toISOString());
    } finally {
      setAssessmentLibraryLoading(false);
    }
  };

  const duplicateAssessment = async (assessmentId: string) => {
    if (!assessmentId) return null;
    setAssessmentLibraryBusyId(assessmentId);
    try {
      const duplicated = await duplicateCompanyAssessment(assessmentId);
      if (duplicated) {
        setAssessmentLibrary((prev) => [duplicated, ...prev]);
        setLastAssessmentLibrarySyncAt(new Date().toISOString());
      }
      return duplicated;
    } finally {
      setAssessmentLibraryBusyId(null);
    }
  };

  const archiveAssessment = async (assessmentId: string) => {
    if (!assessmentId) return false;
    setAssessmentLibraryBusyId(assessmentId);
    try {
      const ok = await updateCompanyAssessmentStatus(assessmentId, 'archived');
      if (ok) {
        setAssessmentLibrary((prev) => prev.filter((item) => item.id !== assessmentId));
        setLastAssessmentLibrarySyncAt(new Date().toISOString());
      }
      return ok;
    } finally {
      setAssessmentLibraryBusyId(null);
    }
  };

  useEffect(() => {
    if (!companyId || (activeTab !== 'assessments' && activeTab !== 'overview')) return;
    void refreshAssessmentLibrary();
  }, [companyId, activeTab]);

  return {
    assessmentLibrary,
    setAssessmentLibrary,
    assessmentLibraryLoading,
    assessmentLibraryBusyId,
    showInvitationModal,
    showInvitationsList,
    lastAssessmentLibrarySyncAt,
    refreshAssessmentLibrary,
    duplicateAssessment,
    archiveAssessment,
    setShowInvitationModal,
    setShowInvitationsList
  };
};
