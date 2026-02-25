import { IKIGAI_PSYCH_ITEMS, resolveIkigaiArchetype, scoreIkigaiPsychometrics } from './ikigaiPsychometrics';

describe('ikigai psychometrics', () => {
  it('scores complete answers and calculates confidence', () => {
    const answers = Object.fromEntries(IKIGAI_PSYCH_ITEMS.map((item) => [item.id, 5]));
    const profile = scoreIkigaiPsychometrics(answers);

    expect(profile.answered_items).toBe(IKIGAI_PSYCH_ITEMS.length);
    expect(profile.total_items).toBe(IKIGAI_PSYCH_ITEMS.length);
    expect(profile.confidence_score).toBeGreaterThanOrEqual(70);
    expect(profile.disclaimer.toLowerCase()).toContain('profil');
  });

  it('handles blended archetype around margins', () => {
    const resolved = resolveIkigaiArchetype({
      extroversion_vs_introversion: 50,
      intuition_vs_sensing: 50,
      thinking_vs_feeling: 50,
      judging_vs_perceiving: 50,
    });

    expect(resolved.code.length).toBe(4);
    expect(resolved.blended).toContain('Blended');
  });
});
