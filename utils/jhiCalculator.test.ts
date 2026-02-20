import { calculateJHI } from './jhiCalculator';

describe('jhi personalization', () => {
  const baseJob = {
    title: 'Backend Developer',
    description: 'Hybrid role with mentoring and education budget.',
    type: 'Hybrid' as const,
    salary_from: 70000,
    salary_to: 85000,
    benefits: ['Home Office', 'Sick days', 'Vzdělávací kurzy'],
    location: 'Praha',
    distanceKm: 8,
  };

  it('keeps base and personalized score fields', () => {
    const jhi = calculateJHI(baseJob);
    expect(jhi.baseScore).toBeGreaterThanOrEqual(0);
    expect(jhi.personalizedScore).toBeGreaterThanOrEqual(0);
    expect(jhi.score).toBe(jhi.personalizedScore);
  });

  it('penalizes non-remote jobs when mustRemote is enabled', () => {
    const withoutConstraint = calculateJHI(baseJob);
    const withConstraint = calculateJHI(baseJob, 0, {
      hardConstraints: {
        mustRemote: true,
      },
    });

    expect(withConstraint.personalizedScore).toBeLessThanOrEqual(withoutConstraint.personalizedScore);
  });
});
