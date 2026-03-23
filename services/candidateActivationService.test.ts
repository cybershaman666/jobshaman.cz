import { deriveActivationState, getNextActivationStep, markFirstQualityAction } from './candidateActivationService';
import { UserProfile } from '../types';

const BASE_PROFILE: UserProfile = {
  isLoggedIn: false,
  name: '',
  address: '',
  transportMode: 'public',
  preferences: {
    workLifeBalance: 50,
    financialGoals: 50,
    commuteTolerance: 45,
    priorities: [],
    profile_visibility: 'recruiter',
  },
};

const buildProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  ...BASE_PROFILE,
  isLoggedIn: true,
  role: 'candidate',
  preferences: {
    ...BASE_PROFILE.preferences,
  },
  ...overrides,
});

describe('candidateActivationService', () => {
  it('starts with onboarding as the first activation milestone', () => {
    const profile = buildProfile();
    const state = deriveActivationState(profile);
    expect(getNextActivationStep(state)).toBe('onboarding');
  });

  it('derives location and cv milestones', () => {
    const profile = buildProfile({
      address: 'Praha',
      cvText: 'a'.repeat(220),
      preferences: {
        ...BASE_PROFILE.preferences,
        candidate_onboarding_v2: {
          started_at: '2026-03-20T10:00:00.000Z',
          completed_at: '2026-03-20T10:05:00.000Z',
          last_step: 'decision',
        },
      },
    });
    const state = deriveActivationState(profile);
    expect(state.location_verified).toBe(true);
    expect(state.cv_ready).toBe(true);
  });

  it('requires 3 skills and preferences for next steps', () => {
    const profile = buildProfile({
      skills: ['SQL', 'Python'],
      preferences: {
        ...BASE_PROFILE.preferences,
        desired_role: 'Data Analyst',
        candidate_onboarding_v2: {
          started_at: '2026-03-20T10:00:00.000Z',
          completed_at: '2026-03-20T10:05:00.000Z',
          last_step: 'decision',
        },
      },
    });
    const state = deriveActivationState(profile);
    expect(state.skills_confirmed_count).toBe(2);
    expect(state.preferences_ready).toBe(false);
    expect(getNextActivationStep(state)).toBe('location');
  });

  it('marks first quality action only once', () => {
    const profile = buildProfile({
      address: 'Brno',
      cvText: 'a'.repeat(220),
      skills: ['SQL', 'Python', 'Excel'],
      preferences: {
        ...BASE_PROFILE.preferences,
        desired_role: 'Data Analyst',
        desired_salary_min: 55000,
        candidate_onboarding_v2: {
          started_at: '2026-03-20T10:00:00.000Z',
          completed_at: '2026-03-20T10:05:00.000Z',
          last_step: 'decision',
        },
      },
    });

    const first = markFirstQualityAction(profile, '2026-02-25T10:00:00.000Z');
    const second = markFirstQualityAction(first, '2026-02-26T10:00:00.000Z');
    expect(first.preferences.activation_v1?.first_quality_action_at).toBe('2026-02-25T10:00:00.000Z');
    expect(second.preferences.activation_v1?.first_quality_action_at).toBe('2026-02-25T10:00:00.000Z');
    expect(second.preferences.activation_v1?.completion_percent).toBe(100);
  });
});
