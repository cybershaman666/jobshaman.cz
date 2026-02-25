import { buildIkigaiSnapshot, canAdvanceIkigaiStep } from '../../services/ikigaiFlowService';

describe('IkigaiGuideFlow helpers', () => {
  const fullState = {
    love: { energy: 60, clarity: 62, sustainability: 64, notes: 'A' },
    strength: { energy: 66, clarity: 68, sustainability: 70, notes: 'B' },
    need: { energy: 58, clarity: 61, sustainability: 63, notes: 'C' },
    reward: { energy: 57, clarity: 59, sustainability: 60, notes: 'D' },
    psychAnswers: {
      ei_1: 4, ei_2: 2, ei_3: 4,
      sn_1: 2, sn_2: 4, sn_3: 4,
      tf_1: 4, tf_2: 2, tf_3: 4,
      jp_1: 4, jp_2: 2, jp_3: 4,
    },
  };

  it('blocks advance on psych step when answers are incomplete', () => {
    expect(canAdvanceIkigaiStep('psych', { ei_1: 3 })).toBe(false);
  });

  it('creates schema-versioned snapshot', () => {
    const snapshot = buildIkigaiSnapshot('synthesis', fullState);
    expect(snapshot.schema_version).toBe('ikigai-v1');
    expect(snapshot.scores.ikigai_core_score).toBeGreaterThanOrEqual(0);
    expect(snapshot.psych_profile.archetype_code.length).toBe(4);
  });
});
