import { matchHeuristic } from './matchHeuristic';

describe('matchHeuristic', () => {
  it('returns 0 for empty inputs', () => {
    expect(matchHeuristic('', 'React developer').matchScore).toBe(0);
    expect(matchHeuristic('React developer', '').matchScore).toBe(0);
  });

  it('detects overlap and produces reasons', () => {
    const res = matchHeuristic(
      'Dělám React a TypeScript, řeším výkon a UX.',
      'Hledáme React developer se znalostí TypeScript a UX.'
    );
    expect(res.matchScore).toBeGreaterThan(30);
    expect(res.reasons.length).toBeGreaterThan(0);
  });
});

