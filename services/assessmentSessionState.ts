import { AssessmentJourneyTrace, AssessmentMode } from '../types';

export interface AssessmentSharedDraft {
  technical: Record<string, string>;
  psychometric: Record<string, number>;
  journey_trace?: Partial<AssessmentJourneyTrace>;
}

const draftKey = (invitationId: string, assessmentId: string) =>
  `jobshaman_assessment_draft:${invitationId}:${assessmentId}`;

const modeKey = (invitationId: string, assessmentId: string) =>
  `jobshaman_assessment_mode:${invitationId}:${assessmentId}`;

export const readAssessmentDraft = (
  invitationId: string,
  assessmentId: string
): AssessmentSharedDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(draftKey(invitationId, assessmentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      technical: parsed?.technical || {},
      psychometric: parsed?.psychometric || {},
      journey_trace: parsed?.journey_trace || {
        phase_events: [],
        micro_insights: [],
        mode_switches: [],
      },
    };
  } catch {
    return null;
  }
};

export const writeAssessmentDraft = (
  invitationId: string,
  assessmentId: string,
  draft: AssessmentSharedDraft
): void => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(draftKey(invitationId, assessmentId), JSON.stringify(draft));
  } catch {
    // ignore
  }
};

export const readAssessmentModePreference = (
  invitationId: string,
  assessmentId: string
): AssessmentMode | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(modeKey(invitationId, assessmentId));
    return raw === 'classic' || raw === 'game' ? raw : null;
  } catch {
    return null;
  }
};

export const writeAssessmentModePreference = (
  invitationId: string,
  assessmentId: string,
  mode: AssessmentMode
): void => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(modeKey(invitationId, assessmentId), mode);
  } catch {
    // ignore
  }
};
