import { IKIGAI_V1_DRAFT_KEY, clearIkigaiDraft, readIkigaiDraft, writeIkigaiDraft } from './ikigaiSessionState';

describe('ikigai session state', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    Object.defineProperty(global, 'window', {
      value: {
        sessionStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => {
            store.set(key, value);
          },
          removeItem: (key: string) => {
            store.delete(key);
          },
        },
      },
      configurable: true,
    });
  });

  afterEach(() => {
    // @ts-expect-error test cleanup
    delete global.window;
  });

  it('returns null by default', () => {
    expect(readIkigaiDraft()).toBeNull();
  });

  it('persists and clears draft', () => {
    writeIkigaiDraft({
      schema_version: 'ikigai-v1',
      updated_at: new Date().toISOString(),
      progress_step: 'love',
      raw_answers: {},
      psych_profile: {
        axis_scores: {
          extroversion_vs_introversion: 50,
          intuition_vs_sensing: 50,
          thinking_vs_feeling: 50,
          judging_vs_perceiving: 50,
        },
        archetype_code: 'INTJ',
        blended_archetype: null,
        consistency_index: 70,
        confidence_score: 70,
        answered_items: 12,
        total_items: 12,
        disclaimer: 'test',
      },
      scores: {
        love_score: 60,
        strength_score: 60,
        need_score: 60,
        reward_score: 60,
        ikigai_core_score: 60,
        tension_vectors: ['No major tension detected'],
      },
      recommended_paths: [],
    });

    expect(store.has(IKIGAI_V1_DRAFT_KEY)).toBe(true);
    expect(readIkigaiDraft()).not.toBeNull();

    clearIkigaiDraft();
    expect(readIkigaiDraft()).toBeNull();
  });
});
