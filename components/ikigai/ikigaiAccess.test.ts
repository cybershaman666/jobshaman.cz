import { resolveIkigaiGuideVariant } from './ikigaiAccess';

describe('resolveIkigaiGuideVariant', () => {
  it('returns disabled when feature is off', () => {
    expect(resolveIkigaiGuideVariant(false, true)).toBe('disabled');
  });

  it('returns teaser for free tier when feature is on', () => {
    expect(resolveIkigaiGuideVariant(true, false)).toBe('teaser');
  });

  it('returns full for premium when feature is on', () => {
    expect(resolveIkigaiGuideVariant(true, true)).toBe('full');
  });
});
