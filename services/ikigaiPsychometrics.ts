import { IkigaiPsychProfileV1 } from '../types';

export type IkigaiPsychAxis = 'EI' | 'SN' | 'TF' | 'JP';

export interface IkigaiPsychItem {
  id: string;
  axis: IkigaiPsychAxis;
  prompt: string;
  left_label: string;
  right_label: string;
  reverse?: boolean;
}

export const IKIGAI_PSYCH_ITEMS: IkigaiPsychItem[] = [
  { id: 'ei_1', axis: 'EI', prompt: 'Energii získávám z aktivní interakce s lidmi.', left_label: 'Silně nesouhlasím', right_label: 'Silně souhlasím' },
  { id: 'ei_2', axis: 'EI', prompt: 'Po náročném dni preferuji tichou regeneraci o samotě.', left_label: 'Silně nesouhlasím', right_label: 'Silně souhlasím', reverse: true },
  { id: 'ei_3', axis: 'EI', prompt: 'Myslím lépe, když nápady rozebírám nahlas s ostatními.', left_label: 'Silně nesouhlasím', right_label: 'Silně souhlasím' },

  { id: 'sn_1', axis: 'SN', prompt: 'Více důvěřuji konkrétním detailům než abstraktním možnostem.', left_label: 'Silně nesouhlasím', right_label: 'Silně souhlasím', reverse: true },
  { id: 'sn_2', axis: 'SN', prompt: 'Budoucí možnosti mě motivují více než zaběhnutá rutina.', left_label: 'Silně nesouhlasím', right_label: 'Silně souhlasím' },
  { id: 'sn_3', axis: 'SN', prompt: 'Baví mě propojovat vzorce napříč různými oblastmi.', left_label: 'Silně nesouhlasím', right_label: 'Silně souhlasím' },

  { id: 'tf_1', axis: 'TF', prompt: 'Při těžkých rozhodnutích dávám přednost objektivní logice.', left_label: 'Silně nesouhlasím', right_label: 'Silně souhlasím' },
  { id: 'tf_2', axis: 'TF', prompt: 'Nejdříve zvažuji dopad na lidi a teprve potom volím řešení.', left_label: 'Silně nesouhlasím', right_label: 'Silně souhlasím', reverse: true },
  { id: 'tf_3', axis: 'TF', prompt: 'Jsem v pohodě s přímým zpochybněním slabého argumentu.', left_label: 'Silně nesouhlasím', right_label: 'Silně souhlasím' },

  { id: 'jp_1', axis: 'JP', prompt: 'Nejlépe pracuji s jasným plánem a kontrolními body.', left_label: 'Silně nesouhlasím', right_label: 'Silně souhlasím' },
  { id: 'jp_2', axis: 'JP', prompt: 'Preferuji flexibilní možnosti před pevně daným harmonogramem.', left_label: 'Silně nesouhlasím', right_label: 'Silně souhlasím', reverse: true },
  { id: 'jp_3', axis: 'JP', prompt: 'Rád(a) dokončuji úkoly před přepnutím na jiný kontext.', left_label: 'Silně nesouhlasím', right_label: 'Silně souhlasím' },
];

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const normalizeLikert = (value: number): number => {
  const safe = clamp(Math.round(value || 0), 1, 5);
  return ((safe - 1) / 4) * 100;
};

const scoreAxis = (items: IkigaiPsychItem[], answers: Record<string, number>): number => {
  const scored = items
    .map((item) => {
      const answer = answers[item.id];
      if (answer == null) return null;
      const normalized = normalizeLikert(answer);
      return item.reverse ? 100 - normalized : normalized;
    })
    .filter((value): value is number => typeof value === 'number');

  if (scored.length === 0) return 50;
  return Math.round(scored.reduce((sum, v) => sum + v, 0) / scored.length);
};

const axisConsistency = (items: IkigaiPsychItem[], answers: Record<string, number>): number => {
  const scored = items
    .map((item) => {
      const answer = answers[item.id];
      if (answer == null) return null;
      const normalized = normalizeLikert(answer);
      return item.reverse ? 100 - normalized : normalized;
    })
    .filter((value): value is number => typeof value === 'number');

  if (scored.length <= 1) return 65;
  const mean = scored.reduce((sum, v) => sum + v, 0) / scored.length;
  const avgDeviation = scored.reduce((sum, v) => sum + Math.abs(v - mean), 0) / scored.length;
  return Math.round(clamp(100 - avgDeviation * 1.6, 15, 100));
};

const axisLetter = (score: number, high: string, low: string, margin = 6): { primary: string; blended: boolean } => {
  if (Math.abs(score - 50) <= margin) {
    return { primary: score >= 50 ? high : low, blended: true };
  }
  return { primary: score >= 50 ? high : low, blended: false };
};

export const resolveIkigaiArchetype = (axisScores: IkigaiPsychProfileV1['axis_scores']): { code: string; blended: string | null } => {
  const ei = axisLetter(axisScores.extroversion_vs_introversion, 'E', 'I');
  const sn = axisLetter(axisScores.intuition_vs_sensing, 'N', 'S');
  const tf = axisLetter(axisScores.thinking_vs_feeling, 'T', 'F');
  const jp = axisLetter(axisScores.judging_vs_perceiving, 'J', 'P');

  const code = `${ei.primary}${sn.primary}${tf.primary}${jp.primary}`;
  const blendedAxes: string[] = [];
  if (ei.blended) blendedAxes.push('E/I');
  if (sn.blended) blendedAxes.push('N/S');
  if (tf.blended) blendedAxes.push('T/F');
  if (jp.blended) blendedAxes.push('J/P');

  return {
    code,
    blended: blendedAxes.length > 0 ? `Vyrovnaný profil na osách ${blendedAxes.join(', ')}` : null,
  };
};

export const scoreIkigaiPsychometrics = (answers: Record<string, number>): IkigaiPsychProfileV1 => {
  const byAxis = {
    EI: IKIGAI_PSYCH_ITEMS.filter((item) => item.axis === 'EI'),
    SN: IKIGAI_PSYCH_ITEMS.filter((item) => item.axis === 'SN'),
    TF: IKIGAI_PSYCH_ITEMS.filter((item) => item.axis === 'TF'),
    JP: IKIGAI_PSYCH_ITEMS.filter((item) => item.axis === 'JP'),
  };

  const axis_scores = {
    extroversion_vs_introversion: scoreAxis(byAxis.EI, answers),
    intuition_vs_sensing: scoreAxis(byAxis.SN, answers),
    thinking_vs_feeling: scoreAxis(byAxis.TF, answers),
    judging_vs_perceiving: scoreAxis(byAxis.JP, answers),
  };

  const consistencySamples = [
    axisConsistency(byAxis.EI, answers),
    axisConsistency(byAxis.SN, answers),
    axisConsistency(byAxis.TF, answers),
    axisConsistency(byAxis.JP, answers),
  ];
  const consistency_index = Math.round(
    consistencySamples.reduce((sum, v) => sum + v, 0) / consistencySamples.length
  );

  const answered_items = IKIGAI_PSYCH_ITEMS.filter((item) => answers[item.id] != null).length;
  const total_items = IKIGAI_PSYCH_ITEMS.length;
  const completionRatio = total_items === 0 ? 0 : answered_items / total_items;
  const confidence_score = Math.round(clamp(consistency_index * 0.65 + completionRatio * 100 * 0.35, 10, 100));

  const archetype = resolveIkigaiArchetype(axis_scores);

  return {
    axis_scores,
    archetype_code: archetype.code,
    blended_archetype: archetype.blended,
    consistency_index,
    confidence_score,
    answered_items,
    total_items,
    disclaimer: 'Orientační psychologický profil, nikoli klinická diagnostika.',
  };
};
