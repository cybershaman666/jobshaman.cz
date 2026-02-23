import { estimateNoise } from './noise';

describe('estimateNoise', () => {
  it('returns low score for clean text', () => {
    const res = estimateNoise('Hledáme vývojáře pro React a TypeScript. Férová mzda.');
    expect(res.score).toBeGreaterThanOrEqual(0);
    expect(res.level).toBe('low');
    expect(Array.isArray(res.flags)).toBe(true);
  });

  it('increases score and flags for red-flag phrases', () => {
    const clean = estimateNoise('Hledáme vývojáře pro React.');
    const noisy = estimateNoise('Hledáme rockstara do dynamického prostředí. Tah na branku. Přesčasy.');
    expect(noisy.score).toBeGreaterThan(clean.score);
    expect(noisy.level === 'medium' || noisy.level === 'high').toBe(true);
    expect(noisy.flags.length).toBeGreaterThan(0);
  });
});

