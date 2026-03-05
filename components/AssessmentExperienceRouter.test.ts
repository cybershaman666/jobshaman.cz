import { resolveAssessmentMode } from './assessmentMode';

describe('resolveAssessmentMode', () => {
  it('returns game mode when cockpit is enabled', () => {
    expect(resolveAssessmentMode(true)).toBe('game');
  });

  it('returns classic mode when cockpit is disabled', () => {
    expect(resolveAssessmentMode(false)).toBe('classic');
  });
});
