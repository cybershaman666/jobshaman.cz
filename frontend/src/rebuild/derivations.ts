import { evaluateRole } from './intelligence';
import type {
  CalendarEvent,
  CandidateInsight,
  CandidateJourneySession,
  CandidatePreferenceProfile,
  HandshakeBlueprint,
  Role,
} from './models';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const to24Hour = (slot: string) => {
  const match = slot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return slot;
  let hours = Number(match[1]);
  const minutes = match[2];
  const meridiem = match[3].toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${minutes}`;
};

const getSessionTextVolume = (session: CandidateJourneySession) =>
  Object.values(session.answers).reduce((sum, value) => {
    if (Array.isArray(value)) return sum + value.join(' ').length;
    return sum + String(value || '').length;
  }, 0);

const getSessionScore = (session: CandidateJourneySession) =>
  session.candidateScore || clamp(72 + Math.round(getSessionTextVolume(session) / 36), 74, 96);

const getSessionCandidateName = (session: CandidateJourneySession) =>
  session.candidateName || String(session.answers.preferred_alias || session.answers.legal_name || 'Candidate');

const buildDerivedInsight = (
  session: CandidateJourneySession,
  role: Role,
  blueprint: HandshakeBlueprint,
  preferences: CandidatePreferenceProfile,
  t: any,
): CandidateInsight => {
  const evaluation = evaluateRole(role, preferences, t);
  const score = getSessionScore(session);
  const packetSignals = session.submissionSnapshot?.keySkills || [];
  const topSignals = (
    packetSignals.length > 0
      ? packetSignals
      : (blueprint.benchmarkLabels.length > 0 ? blueprint.benchmarkLabels : ['Signal clarity', 'Judgment', 'Execution'])
  ).slice(0, 3);

  return {
    id: `journey-${session.roleId}`,
    candidateName: getSessionCandidateName(session),
    headline: session.submissionSnapshot?.candidateJobTitle || role.title,
    location: session.candidateLocation || preferences.address,
    matchPercent: clamp(Math.round((score + evaluation.jhi.personalizedScore) / 2), 76, 98),
    verifiedScore: score,
    topSignals,
    recommendation: session.scheduledSlot
      ? t('rebuild.derivations.rec_interview', { defaultValue: 'Interview already requested for {{slot}}. Use the live review to validate the strongest signal areas.', slot: session.scheduledSlot })
      : t('rebuild.derivations.rec_handshake', { defaultValue: 'Candidate completed the handshake for {{title}}. Review and decide whether to invite them into the next live step.', title: role.title }),
    internalNote:
      session.reviewerSummary
      || session.submissionSnapshot?.activeCvSummary
      || (score >= 90
        ? t('rebuild.derivations.note_strong', { defaultValue: 'Strong submission with clear signal, thoughtful tradeoffs and fast next-step readiness.' })
        : t('rebuild.derivations.note_promising', { defaultValue: 'Promising candidate with enough structured evidence to justify a live follow-up.' })),
    skills: topSignals.map((label, index) => ({
      label,
      score: clamp(score - index * 5 + (index === 0 ? 2 : 0), 74, 98),
      tags: role.skills.slice(index, index + 2),
    })),
  };
};

export const deriveTalentPool = (
  journeySessions: Record<string, CandidateJourneySession>,
  roles: Role[],
  preferences: CandidatePreferenceProfile,
  getBlueprintForRole: (role: Role) => HandshakeBlueprint,
  t: any,
): CandidateInsight[] => {
  const derived = Object.values(journeySessions)
    .filter((session) => session.submittedAt)
    .map((session) => {
      const role = roles.find((item) => item.id === session.roleId);
      if (!role) return null;
      return buildDerivedInsight(session, role, getBlueprintForRole(role), preferences, t);
    })
    .filter((candidate): candidate is CandidateInsight => Boolean(candidate))
    .sort((a, b) => b.matchPercent - a.matchPercent);
  return derived;
};

export const deriveRecruiterCalendar = (
  journeySessions: Record<string, CandidateJourneySession>,
  roles: Role[],
): CalendarEvent[] => {
  const derived = Object.values(journeySessions)
    .filter((session) => session.submittedAt)
    .flatMap((session, index) => {
      const role = roles.find((item) => item.id === session.roleId);
      if (!role) return [];
      const candidateName = getSessionCandidateName(session);
      const reviewEvent: CalendarEvent = {
        id: `review-${session.roleId}`,
        title: `${candidateName} review`,
        stage: 'assessment',
        day: 10 + index,
        time: '10:00',
        note: role.title,
      };
      if (!session.scheduledSlot) return [reviewEvent];
      return [
        reviewEvent,
        {
          id: `interview-${session.roleId}`,
          title: `${candidateName} interview`,
          stage: 'panel' as const,
          day: 14 + index,
          time: to24Hour(session.scheduledSlot),
          note: role.title,
        },
      ];
    });

  return derived;
};

export const deriveDashboardMetrics = (
  roles: Role[],
  blueprintLibrary: HandshakeBlueprint[],
  candidateInsights: CandidateInsight[],
  calendarEvents: CalendarEvent[],
  journeySessions: Record<string, CandidateJourneySession>,
) => ({
  curatedRoles: roles.filter((role) => role.source === 'curated').length,
  importedRoles: roles.filter((role) => role.source === 'imported').length,
  blueprints: blueprintLibrary.length,
  candidates: candidateInsights.length,
  interviewsBooked: calendarEvents.filter((event) => event.stage === 'panel').length,
  submittedJourneys: Object.values(journeySessions).filter((session) => session.submittedAt).length,
});

export const deriveRolePipelineStats = (
  roles: Role[],
  journeySessions: Record<string, CandidateJourneySession>,
) =>
  Object.fromEntries(
    roles.map((role) => [
      role.id,
      {
        hasSubmission: Boolean(journeySessions[role.id]?.submittedAt),
        hasSchedule: Boolean(journeySessions[role.id]?.scheduledSlot),
      },
    ]),
  ) as Record<string, { hasSubmission: boolean; hasSchedule: boolean }>;
