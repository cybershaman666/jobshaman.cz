import ApiService from './apiService';

export type JcfpmAnswer = number | string | string[];
type JcfpmScoreSummary = {
  dimension?: string;
  section?: string;
  raw_score: number;
  percentile: number;
  item_count: number;
};

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
  ['i1_love', 'Při této aktivitě ztrácím pojem o čase.'],
  ['i2_good_at', 'Lidé mě v této oblasti často žádají o radu nebo pomoc.'],
  ['i3_world_needs', 'Dává mi smysl řešit problémy, které zlepšují život konkrétním lidem.'],
  ['i4_paid_for', 'Umím pojmenovat hodnotu, kterou moje práce přináší firmě nebo zákazníkovi.'],
] as const;

const fallbackItems = () => DIMENSIONS.map(([dimension, prompt], index) => ({
  id: `v2-${dimension}`,
  dimension,
  prompt,
  prompt_i18n: {
    cs: prompt,
    en: prompt,
  },
  section: String(dimension).startsWith('i') ? 'ikigai' : 'legacy_lite',
  item_type: 'likert',
  payload: {},
  scale_min: 1,
  scale_max: 7,
  reverse_scoring: false,
  form_key: 'jcfpm-fallback',
  sort_order: index + 1,
}));

export const fetchJcfpmItems = async (locale = 'cs', form = 'jcfpm-v3-ikigai') => {
  try {
    const response = await ApiService.get<any>(`/candidate/jcfpm/items?locale=${encodeURIComponent(locale)}&form=${encodeURIComponent(form)}`);
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

export const hasJcfpmAnswer = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
};

export const scoreJcfpmAnswer = (item: any, answer: unknown) => {
  if (!hasJcfpmAnswer(answer)) return null;
  const min = Number(item?.scale_min || 1);
  const max = Number(item?.scale_max || 7);
  const type = item?.item_type || 'likert';
  const payload = item?.payload || {};

  if (type === 'likert') {
    const numeric = Number(answer);
    if (!Number.isFinite(numeric)) return null;
    const clamped = Math.max(min, Math.min(max, numeric));
    return item?.reverse_scoring ? min + max - clamped : clamped;
  }

  if (Array.isArray(answer)) {
    const correctOrder = Array.isArray(payload?.correct_order) ? payload.correct_order.map(String) : [];
    if (correctOrder.length > 0) {
      const matches = answer.map(String).filter((value, index) => value === correctOrder[index]).length;
      return 1 + (matches / correctOrder.length) * 6;
    }
    return Math.min(7, Math.max(1, answer.length));
  }

  const selected = String(answer);
  const options = Array.isArray(payload?.options) ? payload.options : [];
  const option = options.find((opt: any) => String(opt?.id ?? opt?.value) === selected);
  if (Number.isFinite(Number(option?.score))) return Number(option.score);

  const correct = payload?.correct_id ?? payload?.correctId ?? payload?.correct_answer;
  if (correct !== undefined && correct !== null) return selected === String(correct) ? 7 : 1;

  return 4;
};

const summarizeScores = (items: any[], responses: Record<string, unknown>, key: 'dimension' | 'section'): JcfpmScoreSummary[] => {
  const grouped = new Map<string, number[]>();
  items.forEach((item) => {
    const groupKey = item?.[key] || 'unknown';
    const score = scoreJcfpmAnswer(item, responses[item.id]);
    if (score === null) return;
    const values = grouped.get(groupKey) || [];
    values.push(score);
    grouped.set(groupKey, values);
  });

  return Array.from(grouped.entries()).map(([groupKey, values]) => {
    const raw = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    return {
      [key]: groupKey,
      raw_score: Number(raw.toFixed(2)),
      percentile: Math.max(0, Math.min(100, Math.round(((raw - 1) / 6) * 100))),
      item_count: values.length,
    } as JcfpmScoreSummary;
  });
};

export const submitJcfpm = async (
  responses: Record<string, JcfpmAnswer>,
  itemIds: string[],
  variantSeed: string,
  locale = 'cs',
  itemsOverride?: any[],
) => {
  const allItems = itemsOverride?.length ? itemsOverride : await fetchJcfpmItems(locale);
  const idSet = new Set(itemIds);
  const items = allItems.filter((item: any) => idSet.has(String(item?.id)));
  const dimensionScores = summarizeScores(items, responses, 'dimension');
  const sectionScores = summarizeScores(items, responses, 'section');
  const ikigaiProfile = Object.fromEntries(
    dimensionScores
      .filter((score: any) => String(score.dimension).startsWith('i'))
      .map((score: any) => [score.dimension, score.percentile]),
  );
  const archetype = computeArchetype(dimensionScores);
  const snapshot = {
    schema_version: 'jcfpm-v3-ikigai',
    form_key: items[0]?.form_key || 'jcfpm-v3-ikigai',
    locale,
    completed_at: new Date().toISOString(),
    responses,
    item_ids: itemIds,
    variant_seed: variantSeed,
    dimension_scores: dimensionScores,
    section_scores: sectionScores,
    ikigai_profile: ikigaiProfile,
    subdimension_scores: [],
    traits: [],
    fit_scores: [],
    ai_report: null,
    percentile_summary: Object.fromEntries(dimensionScores.map((score: any) => [score.dimension, score.percentile])),
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
