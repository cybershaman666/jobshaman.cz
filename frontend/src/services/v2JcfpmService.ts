import ApiService from './apiService';

const DIMENSIONS = [
  ['d1_cognitive', 'Dokážu rychle najít podstatu složitého problému.'],
  ['d2_social', 'V týmu umím vytvořit důvěru a jasnou domluvu.'],
  ['d3_motivational', 'Nejvíc mě pohání práce, která má viditelný smysl.'],
  ['d4_energy', 'Dlouhodobě zvládám tlak bez ztráty kvality rozhodování.'],
  ['d5_values', 'Při rozhodování si hlídám soulad s vlastními hodnotami.'],
  ['d6_ai_readiness', 'AI nástroje beru jako přirozenou součást práce.'],
  ['d7_cognitive_reflection', 'Umím zpochybnit vlastní první interpretaci.'],
  ['d8_digital_eq', 'V digitální komunikaci rozpoznám kontext i emocionální tón.'],
  ['d9_systems_thinking', 'Vidím vazby mezi lidmi, procesy a výsledky.'],
  ['d10_ambiguity_interpretation', 'Nejasné zadání mě spíš aktivuje než paralyzuje.'],
  ['d11_problem_decomposition', 'Velký problém si umím rozložit na testovatelné části.'],
  ['d12_moral_compass', 'Při tlaku na výkon neztrácím etický kompas.'],
] as const;

const fallbackItems = () => DIMENSIONS.map(([dimension, prompt], index) => ({
  id: `v2-${dimension}`,
  dimension,
  prompt,
  prompt_i18n: {
    cs: prompt,
    en: prompt,
  },
  sort_order: index + 1,
}));

export const fetchJcfpmItems = async () => {
  try {
    const response = await ApiService.get<any>('/candidate/jcfpm/items');
    if (Array.isArray(response?.data) && response.data.length > 0) return response.data;
  } catch {
    // Public fallback keeps the assessment usable during backend downtime.
  }
  return fallbackItems();
};

export const computeArchetype = (dimensionScores: Array<{ dimension?: string; percentile?: number; raw_score?: number }>) => {
  const sorted = [...dimensionScores].sort((left, right) => Number(right.percentile || 0) - Number(left.percentile || 0));
  const primary = sorted[0]?.dimension || 'd9_systems_thinking';
  if (primary === 'd2_social') {
    return {
      title: 'Koordinátor důvěry',
      description: 'Tvoje síla je číst lidi, držet bezpečný rámec spolupráce a měnit chaos v domluvu.',
    };
  }
  if (primary === 'd6_ai_readiness' || primary === 'd8_digital_eq') {
    return {
      title: 'Digitální průvodce',
      description: 'Rychle propojuješ technologii s lidským kontextem a umíš z nástrojů vytěžit praktickou hodnotu.',
    };
  }
  return {
    title: 'Systémový architekt',
    description: 'Vidíš strukturu za povrchem a umíš převést složitost do kroků, které dávají smysl.',
  };
};

export const submitJcfpm = async (
  responses: Record<string, unknown>,
  itemIds: string[],
  variantSeed: string,
) => {
  const items = await fetchJcfpmItems();
  const dimensionScores = items.map((item) => {
    const value = Number(responses[item.id] || 0);
    return {
      dimension: item.dimension,
      raw_score: value,
      percentile: Math.max(0, Math.min(100, Math.round(value * 20))),
      label: item.dimension,
      item_count: value > 0 ? 1 : 0,
    };
  });
  const archetype = computeArchetype(dimensionScores);
  const snapshot = {
    schema_version: 'jcfpm-v1',
    completed_at: new Date().toISOString(),
    responses,
    item_ids: itemIds,
    variant_seed: variantSeed,
    dimension_scores: dimensionScores,
    subdimension_scores: [],
    traits: [],
    fit_scores: [],
    ai_report: null,
    percentile_summary: Object.fromEntries(dimensionScores.map((score) => [score.dimension, score.percentile])),
    confidence: Math.round((Object.keys(responses).length / Math.max(1, items.length)) * 100),
    archetype,
  };
  try {
    const response = await ApiService.post<any>('/candidate/jcfpm/snapshots', snapshot);
    return response?.data || snapshot;
  } catch {
    return snapshot;
  }
};
