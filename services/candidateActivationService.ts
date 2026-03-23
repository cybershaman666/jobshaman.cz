import { CandidateActivationStateV1, UserProfile } from '../types';

type ActivationStep = CandidateActivationStateV1['last_prompted_step'];

// Compatibility note: the persisted state still uses `cv_ready`,
// but product-wise this now means "supporting context is ready".
const MIN_SUPPORTING_TEXT_LENGTH = 180;
const DEFAULT_COMPLETION_STATE: CandidateActivationStateV1 = {
  onboarding_started_at: undefined,
  onboarding_completed_at: undefined,
  profile_nudge_completed_at: undefined,
  location_verified: false,
  cv_ready: false,
  skills_confirmed_count: 0,
  preferences_ready: false,
  completion_percent: 0,
  last_prompted_step: 'onboarding',
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const getCurrentActivationState = (profile: UserProfile): CandidateActivationStateV1 => {
  const existing = profile.preferences?.activation_v1;
  return existing ? { ...DEFAULT_COMPLETION_STATE, ...existing } : { ...DEFAULT_COMPLETION_STATE };
};

const resolveSupportingContextReady = (profile: UserProfile): boolean => {
  if ((profile.cvUrl || '').trim().length > 0) return true;
  return (profile.cvText || '').trim().length >= MIN_SUPPORTING_TEXT_LENGTH;
};

const resolveSkillsCount = (profile: UserProfile): number =>
  Array.isArray(profile.skills) ? profile.skills.map((x) => String(x || '').trim()).filter(Boolean).length : 0;

const resolvePreferencesReady = (profile: UserProfile): boolean => {
  const preferredRole = (profile.preferences?.desired_role || profile.jobTitle || '').trim();
  const salaryMin = profile.preferences?.desired_salary_min;
  const salaryMax = profile.preferences?.desired_salary_max;
  const hasSalary = Number.isFinite(Number(salaryMin)) || Number.isFinite(Number(salaryMax));
  return preferredRole.length > 0 && hasSalary;
};

export const getNextActivationStep = (state: CandidateActivationStateV1): ActivationStep => {
  if (!state.onboarding_completed_at) return 'onboarding';
  if (!state.location_verified) return 'location';
  if (state.skills_confirmed_count < 3) return 'skills';
  if (!state.preferences_ready) return 'preferences';
  if (!state.cv_ready) return 'cv';
  if (!state.first_quality_action_at) return 'quality_action';
  return 'done';
};

export const deriveActivationState = (profile: UserProfile): CandidateActivationStateV1 => {
  const existing = getCurrentActivationState(profile);
  const onboardingProgress = profile.preferences?.candidate_onboarding_v2;
  const locationVerified = Boolean(profile.coordinates || (profile.address || '').trim());
  const supportingContextReady = resolveSupportingContextReady(profile);
  const skillsConfirmedCount = resolveSkillsCount(profile);
  const preferencesReady = resolvePreferencesReady(profile);
  const completed = [
    Boolean(onboardingProgress?.completed_at),
    locationVerified,
    supportingContextReady,
    skillsConfirmedCount >= 3,
    preferencesReady,
    Boolean(existing.first_quality_action_at),
  ].filter(Boolean).length;

  return {
    onboarding_started_at: onboardingProgress?.started_at,
    onboarding_completed_at: onboardingProgress?.completed_at,
    profile_nudge_completed_at: onboardingProgress?.profile_nudge_completed_at,
    location_verified: locationVerified,
    cv_ready: supportingContextReady,
    skills_confirmed_count: skillsConfirmedCount,
    preferences_ready: preferencesReady,
    first_quality_action_at: existing.first_quality_action_at,
    completion_percent: clamp(Math.round((completed / 6) * 100), 0, 100),
    last_prompted_step: getNextActivationStep({
      ...existing,
      onboarding_started_at: onboardingProgress?.started_at,
      onboarding_completed_at: onboardingProgress?.completed_at,
      profile_nudge_completed_at: onboardingProgress?.profile_nudge_completed_at,
      location_verified: locationVerified,
      cv_ready: supportingContextReady,
      skills_confirmed_count: skillsConfirmedCount,
      preferences_ready: preferencesReady,
    }),
  };
};

export const withActivationState = (profile: UserProfile): UserProfile => {
  const derived = deriveActivationState(profile);
  return {
    ...profile,
    preferences: {
      ...profile.preferences,
      activation_v1: derived,
    },
  };
};

export const markFirstQualityAction = (
  profile: UserProfile,
  actionAt = new Date().toISOString()
): UserProfile => {
  const current = getCurrentActivationState(profile);
  if (current.first_quality_action_at) {
    return withActivationState(profile);
  }
  return withActivationState({
    ...profile,
    preferences: {
      ...profile.preferences,
      activation_v1: {
        ...current,
        first_quality_action_at: actionAt,
      },
    },
  });
};

export const isActivationComplete = (state: CandidateActivationStateV1): boolean =>
  state.completion_percent >= 100;
