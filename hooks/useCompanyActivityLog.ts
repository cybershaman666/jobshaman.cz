import { useState } from 'react';
import { supabase } from '../services/supabaseService';
import {
  CompanyActivityLogEntry,
  createCompanyActivityLogEvent,
  listCompanyActivityLog
} from '../services/companyActivityService';

type AssessmentInvitationAuditRow = {
  id: string;
  created_at?: string;
  candidate_email?: string | null;
  metadata?: Record<string, any> | null;
  status?: string | null;
  application_id?: string | null;
  job_id?: string | number | null;
};

type AssessmentResultAuditRow = {
  id: string;
  completed_at?: string;
  role?: string | null;
  application_id?: string | null;
  job_id?: string | number | null;
  assessment_id?: string | null;
  invitation_id?: string | null;
};

export const useCompanyActivityLog = (companyId?: string) => {
  const [companyActivityLog, setCompanyActivityLog] = useState<CompanyActivityLogEntry[]>([]);
  const [activityLogSupported, setActivityLogSupported] = useState(true);
  const [assessmentInvitations, setAssessmentInvitations] = useState<AssessmentInvitationAuditRow[]>([]);
  const [assessmentResultsAudit, setAssessmentResultsAudit] = useState<AssessmentResultAuditRow[]>([]);

  const refreshActivityLog = async (overrideCompanyId?: string) => {
    const targetCompanyId = overrideCompanyId || companyId;
    if (!targetCompanyId || !activityLogSupported) return;

    try {
      const rows = await listCompanyActivityLog(targetCompanyId, 50);
      setCompanyActivityLog(rows);
      setActivityLogSupported(true);
    } catch (error) {
      console.warn('Company activity API unavailable, trying direct DB fallback:', error);
      if (!supabase) {
        setActivityLogSupported(false);
        return;
      }

      try {
        const { data, error: dbError } = await supabase
          .from('company_activity_log')
          .select('*')
          .eq('company_id', targetCompanyId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (dbError) throw dbError;
        setCompanyActivityLog((data || []) as CompanyActivityLogEntry[]);
      } catch (fallbackError) {
        console.warn('Company activity log unavailable, continuing without persistence:', fallbackError);
        setActivityLogSupported(false);
      }
    }
  };

  const appendActivityEvent = async (
    eventType: string,
    payload: Record<string, any>,
    subjectType?: string,
    subjectId?: string
  ) => {
    const createdAt = new Date().toISOString();
    const optimisticEvent: CompanyActivityLogEntry = {
      id: `local-${eventType}-${createdAt}`,
      company_id: companyId,
      event_type: eventType,
      subject_type: subjectType || null,
      subject_id: subjectId || null,
      payload,
      created_at: createdAt
    };

    setCompanyActivityLog((prev) => [optimisticEvent, ...prev].slice(0, 50));

    if (!companyId || !activityLogSupported) {
      return;
    }

    try {
      const data = await createCompanyActivityLogEvent({
        company_id: companyId,
        event_type: eventType,
        subject_type: subjectType || null,
        subject_id: subjectId || null,
        payload
      });

      if (data) {
        setCompanyActivityLog((prev) => [
          data,
          ...prev.filter((item) => item.id !== optimisticEvent.id && item.id !== data.id)
        ].slice(0, 50));
      }
      return;
    } catch (error) {
      console.warn('Company activity API write unavailable, trying direct DB fallback:', error);
    }

    if (!supabase || !companyId || !activityLogSupported) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('company_activity_log')
        .insert({
          company_id: companyId,
          event_type: eventType,
          subject_type: subjectType || null,
          subject_id: subjectId || null,
          payload
        })
        .select('*')
        .single();

      if (error) throw error;

      if (data) {
        setCompanyActivityLog((prev) => [
          data as CompanyActivityLogEntry,
          ...prev.filter((item) => item.id !== optimisticEvent.id && item.id !== data.id)
        ].slice(0, 50));
      }
    } catch (error) {
      console.warn('Failed to persist company activity log event, keeping local fallback only:', error);
      setActivityLogSupported(false);
    }
  };

  const refreshOperationalEvents = async (overrideCompanyId?: string) => {
    const targetCompanyId = overrideCompanyId || companyId;
    if (!supabase) {
      setAssessmentInvitations([]);
      setAssessmentResultsAudit([]);
      return;
    }
    if (!targetCompanyId) return;

    try {
      await refreshActivityLog(targetCompanyId);
      const [{ data: invitationRows, error: invitationsError }, { data: resultRows, error: resultsError }] = await Promise.all([
        supabase
          .from('assessment_invitations')
          .select('id,created_at,candidate_email,metadata,status,application_id,job_id')
          .eq('company_id', targetCompanyId)
          .order('created_at', { ascending: false })
          .limit(25),
        supabase
          .from('assessment_results')
          .select('id,completed_at,role,application_id,job_id,assessment_id,invitation_id')
          .eq('company_id', targetCompanyId)
          .order('completed_at', { ascending: false })
          .limit(25)
      ]);

      if (!invitationsError) {
        setAssessmentInvitations((invitationRows || []) as AssessmentInvitationAuditRow[]);
      }
      if (!resultsError) {
        setAssessmentResultsAudit((resultRows || []) as AssessmentResultAuditRow[]);
      }
    } catch (error) {
      console.warn('Failed to load operational audit events:', error);
    }
  };

  return {
    companyActivityLog,
    activityLogSupported,
    assessmentInvitations,
    assessmentResultsAudit,
    refreshActivityLog,
    refreshOperationalEvents,
    appendActivityEvent
  };
};
