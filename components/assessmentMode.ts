export const resolveAssessmentMode = (cockpitEnabled: boolean): 'game' | 'classic' =>
  cockpitEnabled ? 'game' : 'classic';
