import { DEFAULT_USER_PROFILE } from '../constants';
import { deriveActivationState, getNextActivationStep, markFirstQualityAction } from './candidateActivationService';
import { UserProfile } from '../types';

const buildProfile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  ...DEFAULT_USER_PROFILE,
  isLoggedIn: true,
  role: 'candidate',
  preferences: {
    ...DEFAULT_USER_PROFILE.preferences,
  },
  ...overrides,
});

describe('candidateActivationService', () => {
  it('derives location and cv milestones', () => {
    const profile = buildProfile({
      address: 'Praha',
      cvText: 'a'.repeat(220),
    });
    const state = deriveActivationState(profile);
    expect(state.location_verified).toBe(true);
    expect(state.cv_ready).toBe(true);
  });

  it('requires 3 skills and preferences for next steps', () => {
    const profile = buildProfile({
      skills: ['SQL', 'Python'],
      preferences: {
        ...DEFAULT_USER_PROFILE.preferences,
        desired_role: 'Data Analyst',
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
        ...DEFAULT_USER_PROFILE.preferences,
        desired_role: 'Data Analyst',
        desired_salary_min: 55000,
      },
    });

    const first = markFirstQualityAction(profile, '2026-02-25T10:00:00.000Z');
    const second = markFirstQualityAction(first, '2026-02-26T10:00:00.000Z');
    expect(first.preferences.activation_v1?.first_quality_action_at).toBe('2026-02-25T10:00:00.000Z');
    expect(second.preferences.activation_v1?.first_quality_action_at).toBe('2026-02-25T10:00:00.000Z');
    expect(second.preferences.activation_v1?.completion_percent).toBe(100);
  });
});
