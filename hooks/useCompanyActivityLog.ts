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

const humanizeActivityEventType = (eventType: string): string => {
  const normalized = String(eventType || '').trim().toLowerCase();
  if (!normalized) return 'Activity logged';
  const overrides: Record<string, string> = {
    application_status_changed: 'Dialogue status changed',
    application_withdrawn: 'Dialogue withdrawn',
    application_message_from_candidate: 'Candidate replied',
    application_message_from_company: 'Company replied',
    assessment_invited: 'Assessment invitation sent',
    assessment_saved: 'Assessment saved',
    assessment_duplicated: 'Assessment duplicated',
    assessment_archived: 'Assessment archived',
    job_published: 'Role published',
    job_updated: 'Role updated',
    job_closed: 'Role closed',
    job_paused: 'Role paused',
    job_archived: 'Role archived',
    job_reopened: 'Role reopened'
  };
  if (overrides[normalized]) return overrides[normalized];
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) || 'Activity logged';
};

const normalizeOptimisticActivityPayload = (
  eventType: string,
  payload: Record<string, any>
): Record<string, any> => {
  const value = { ...(payload || {}) };
  const normalizedEventType = String(eventType || '').trim();

  if (normalizedEventType === 'assessment_invited') {
    value.action_label = value.action_label || 'Assessment invitation sent';
    return value;
  }
  if (normalizedEventType === 'assessment_saved') {
    value.action_label = value.action_label || 'Assessment saved';
    return value;
  }
  if (normalizedEventType === 'assessment_duplicated') {
    value.action_label = value.action_label || 'Assessment duplicated';
    return value;
  }
  if (normalizedEventType === 'assessment_archived') {
    value.action_label = value.action_label || 'Assessment archived';
    return value;
  }
  if (normalizedEventType === 'application_message_from_candidate' || normalizedEventType === 'application_message_from_company') {
    const direction = normalizedEventType.endsWith('_candidate') ? 'candidate' : 'company';
    value.direction = value.direction || direction;
    value.direction_label = value.direction_label || (direction === 'candidate' ? 'Candidate replied' : 'Company replied');
    value.action_label = value.action_label || value.direction_label;
    return value;
  }
  if (normalizedEventType.startsWith('job_')) {
    const nextStatus = String(value.next_status || value.role_status || '').trim().toLowerCase();
    const previousStatus = String(value.previous_status || '').trim().toLowerCase();
    const humanizeStatus = (status: string): string => {
      switch (status) {
        case 'active':
          return 'Active';
        case 'paused':
          return 'Paused';
        case 'closed':
          return 'Closed';
        case 'archived':
          return 'Archived';
        default:
          return status ? status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : '';
      }
    };
    if (previousStatus && !value.previous_status_label) {
      value.previous_status_label = humanizeStatus(previousStatus);
    }
    if (nextStatus && !value.next_status_label) {
      value.next_status_label = humanizeStatus(nextStatus);
    }
    if ((nextStatus || previousStatus) && !value.role_status_label) {
      value.role_status_label = humanizeStatus(nextStatus || previousStatus);
    }
  }

  value.action_label = value.action_label || humanizeActivityEventType(normalizedEventType);
  return value;
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
    const normalizedPayload = normalizeOptimisticActivityPayload(eventType, payload);
    const optimisticEvent: CompanyActivityLogEntry = {
      id: `local-${eventType}-${createdAt}`,
      company_id: companyId,
      event_type: eventType,
      subject_type: subjectType || null,
      subject_id: subjectId || null,
      payload: normalizedPayload,
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
        payload: normalizedPayload
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
          payload: normalizedPayload
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
          .select('*')
          .eq('company_id', targetCompanyId)
          .order('created_at', { ascending: false })
          .limit(25),
        supabase
          .from('assessment_results')
          .select('*')
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
