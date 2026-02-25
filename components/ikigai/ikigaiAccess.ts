export type IkigaiGuideVariant = 'disabled' | 'teaser' | 'full';

export const resolveIkigaiGuideVariant = (flagEnabled: boolean, isPremium: boolean): IkigaiGuideVariant => {
  if (!flagEnabled) return 'disabled';
  return isPremium ? 'full' : 'teaser';
};
