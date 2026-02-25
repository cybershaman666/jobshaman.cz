import { buildIkigaiRecommendations, scoreIkigaiQuadrants } from './ikigaiScoringService';

describe('ikigai scoring', () => {
  it('produces bounded core score and tensions', () => {
    const scores = scoreIkigaiQuadrants({
      love: { energy: 85, clarity: 75, sustainability: 80, notes: 'Strong mission signal.' },
      strength: { energy: 82, clarity: 88, sustainability: 78, notes: 'Delivered measurable outcomes.' },
      need: { energy: 70, clarity: 72, sustainability: 68, notes: 'Cross-functional impact.' },
      reward: { energy: 65, clarity: 66, sustainability: 62, notes: 'Market-aligned proposition.' },
    });

    expect(scores.ikigai_core_score).toBeGreaterThanOrEqual(0);
    expect(scores.ikigai_core_score).toBeLessThanOrEqual(100);
    expect(scores.tension_vectors.length).toBeGreaterThan(0);
  });

  it('adds recommendations for weak quadrants', () => {
    const recs = buildIkigaiRecommendations({
      love_score: 45,
      strength_score: 41,
      need_score: 40,
      reward_score: 44,
      ikigai_core_score: 39,
      tension_vectors: ['Meaning-vs-market tension'],
    });

    expect(recs.length).toBeGreaterThan(1);
  });
});
