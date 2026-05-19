import ApiService from './apiService';

export type JcfpmAnswer =
  | number
  | string
  | string[]
  | { choice_id?: string; order?: string[]; pairs?: Array<{ source: string; target: string }>; selectedSource?: string; time_ms?: number };
type JcfpmScoreSummary = {
  dimension?: string;
  section?: string;
  raw_score: number;
  percentile: number;
  item_count: number;
};

const DIMENSION_PROMPTS: Record<string, string[]> = {
  d1_cognitive: [
    'Než se rozhodnu, potřebuji si nejdřív srovnat fakta a souvislosti.',
    'Když řeším důležité zadání, nejdřív si poskládám informace do jasného obrazu.',
    'Všímám si, které informace jsou podstatné a které jen vytvářejí šum.',
    'Umím přepnout mezi detailem a celkovým obrazem podle situace.',
    'Když něco nedává smysl, hledám příčinu místo rychlého závěru.',
    'Před finálním rozhodnutím si rád/a ověřím hlavní předpoklady.',
  ],
  d2_social: [
    'V týmu umím vytvořit důvěru a jasnou domluvu.',
    'Když vznikne napětí, snažím se pojmenovat věc klidně a konkrétně.',
    'Dovedu vést rozhovor tak, aby se lidé dobrali dalšího kroku.',
    'Umím odhadnout, kdy má smysl mluvit a kdy spíš poslouchat.',
    'Ve spolupráci si hlídám férovost, odpovědnost a jasná očekávání.',
    'Dokážu pomoci skupině vrátit pozornost k cíli.',
  ],
  d3_motivational: [
    'Nejvíc mě pohání práce, která má viditelný smysl.',
    'Když chápu dopad práce, vydržím u ní déle a s větší energií.',
    'Potřebuji vědět, proč je úkol důležitý, ne jen co mám udělat.',
    'Růst odpovědnosti mě motivuje víc než čistě formální status.',
    'Dobře funguji, když mám možnost něco zlepšit, ne jen udržovat.',
    'Ocenění je pro mě silnější, když souvisí s reálným přínosem.',
  ],
  d4_energy: [
    'Dlouhodobě zvládám tlak bez ztráty kvality rozhodování.',
    'Umím zabrat ve sprintu a pak si vědomě obnovit energii.',
    'Různorodé úkoly mě spíš aktivují než vyčerpávají.',
    'Dokážu si pohlídat tempo, když se toho děje hodně najednou.',
    'V naléhavých situacích zůstávám použitelný/á pro tým.',
    'Vím, kdy potřebuji hlubokou práci a kdy rychlé přepínání.',
  ],
  d5_values: [
    'Při rozhodování si hlídám soulad s vlastními hodnotami.',
    'Práce mi musí dávat smysl i z hlediska dlouhodobého dopadu.',
    'Když prostředí porušuje důvěru, rychle ztrácím motivaci.',
    'Umím pojmenovat, co je pro mě v práci nepřekročitelné.',
    'Důležitá rozhodnutí posuzuji i podle jejich dopadu na lidi.',
    'Preferuji prostředí, kde výkon nejde proti integritě.',
  ],
  d6_ai_readiness: [
    'AI nástroje beru jako přirozenou součást práce.',
    'Rád/a zkouším nové nástroje, pokud reálně zlepšují výsledek.',
    'Umím přemýšlet, kde technologie pomůže a kde je lepší lidský úsudek.',
    'Když se mění pracovní nástroje, beru to jako příležitost učit se.',
    'Dokážu popsat úkol tak, aby mi digitální nástroj vrátil použitelný výstup.',
    'Nové technologie mě spíš zajímají, než aby mě paralyzovaly.',
  ],
  d7_cognitive_reflection: [
    'Umím zpochybnit vlastní první interpretaci.',
    'Před důležitým krokem se ptám, jaký mám důkaz.',
    'Když mě napadne rychlé řešení, ověřím si alespoň hlavní riziko.',
    'Dovedu přiznat, že moje první intuice mohla být chybná.',
    'U složitějších rozhodnutí hledám i alternativní vysvětlení.',
    'Logické zkratky se snažím zachytit dřív, než ovlivní výsledek.',
  ],
  d8_digital_eq: [
    'V digitální komunikaci rozpoznám kontext i emocionální tón.',
    'V textu si všímám náznaků napětí, nejistoty nebo nedorozumění.',
    'Umím napsat zprávu tak, aby byla jasná a zároveň nezbytečně tvrdá.',
    'V online spolupráci aktivně pomáhám držet důvěru.',
    'Dokážu rozlišit, kdy stačí zpráva a kdy je lepší hovor.',
    'V asynchronní komunikaci myslím na to, jak ji druhá strana přečte.',
  ],
  d9_systems_thinking: [
    'Vidím vazby mezi lidmi, procesy a výsledky.',
    'Když se mění jedna část systému, přemýšlím o vedlejších dopadech.',
    'Zajímá mě, proč se problém opakuje, ne jen jak ho rychle odstranit.',
    'Umím popsat tok práce od vstupu až po dopad na zákazníka nebo tým.',
    'Všímám si zpětných vazeb, které mohou rozhodnutí časem změnit.',
    'Komplexní situace si umím převést do mapy vztahů.',
  ],
  d10_ambiguity_interpretation: [
    'Nejasné zadání mě spíš aktivuje než paralyzuje.',
    'V nejistotě hledám první směr, který se dá ověřit.',
    'Když není dost informací, umím si říct o minimální další signál.',
    'V nejasné situaci vidím nejen rizika, ale i možné příležitosti.',
    'Umím pracovat s tím, že první verze řešení nebude definitivní.',
    'Když se podmínky mění, dovedu upravit plán bez zbytečné paniky.',
  ],
  d11_problem_decomposition: [
    'Velký problém si umím rozložit na testovatelné části.',
    'Dokážu z chaosu vytvořit první praktický postup.',
    'Před akcí si umím určit, co je blokátor a co může počkat.',
    'Složité zadání převádím do jasných kroků a priorit.',
    'Umím navrhnout menší experiment místo obřího neověřeného plánu.',
    'Když je práce nepřehledná, hledám jednoduchou strukturu dalšího kroku.',
  ],
  d12_moral_compass: [
    'Při tlaku na výkon neztrácím etický kompas.',
    'Když je rychlá cesta nefér, hledám čistší variantu řešení.',
    'Umím otevřít nepříjemné téma, pokud chrání důvěru nebo bezpečí.',
    'V rozhodnutí zohledňuji i dopady, které nejsou hned vidět.',
    'Nechci vyhrávat způsobem, který dlouhodobě ničí vztahy.',
    'Když tým obchází pravidla, snažím se navrhnout korekci.',
  ],
  i1_love: [
    'Při některých pracovních aktivitách ztrácím pojem o čase.',
    'Dokážu poznat, u jakých úkolů mi energie přirozeně roste.',
    'Baví mě činnosti, kde se mohu ponořit do problému nebo tvorby.',
    'Když mě práce zajímá, vydržím u ní i bez okamžité odměny.',
    'Umím popsat, jaký typ práce mě opravdu vtahuje.',
    'Chci mít v práci prostor pro činnosti, které mě vnitřně nabíjejí.',
  ],
  i2_good_at: [
    'Lidé mě v určité oblasti často žádají o radu nebo pomoc.',
    'Umím rozpoznat schopnosti, které používám přirozeně a opakovaně.',
    'Vím, v čem mívám proti ostatním rychlejší orientaci.',
    'Dovedu pojmenovat konkrétní výsledky, které díky mým silám vznikají.',
    'Když něco dělám dobře, snažím se pochopit, která schopnost za tím stojí.',
    'Umím své silné stránky převést do praktické nabídky pro tým.',
  ],
  i3_world_needs: [
    'Dává mi smysl řešit problémy, které zlepšují život konkrétním lidem.',
    'Práce je pro mě silnější, když chápu, komu pomáhá.',
    'Zajímá mě dopad práce za hranicí samotného úkolu.',
    'Dokážu vydržet u práce déle, když chápu její širší užitek.',
    'Chci používat své schopnosti na problémy, které nejsou jen formální.',
    'Dobře se mi pracuje, když vidím spojení mezi úsilím a reálnou potřebou.',
  ],
  i4_paid_for: [
    'Umím pojmenovat hodnotu, kterou moje práce přináší firmě nebo zákazníkovi.',
    'Chci rozvíjet schopnosti, za které je trh ochotný férově platit.',
    'Ideální práce pro mě spojuje smysl, sílu a ekonomickou udržitelnost.',
    'Dokážu přemýšlet o své práci jako o hodnotě, ne jen o čase.',
    'Zajímá mě, které moje schopnosti mají skutečnou poptávku.',
    'Chci, aby moje pracovní směřování dávalo smysl i finančně.',
  ],
};

const fallbackItems = () => Object.entries(DIMENSION_PROMPTS).flatMap(([dimension, prompts], dimIndex) =>
  prompts.map((prompt, promptIndex) => ({
    id: `local-${dimension}-${promptIndex + 1}`,
    pool_key: `local-${dimension}-${promptIndex + 1}`,
    variant_index: 1,
    dimension,
    prompt,
    prompt_i18n: {
      cs: prompt,
      en: prompt,
    },
    section: String(dimension).startsWith('i') ? 'ikigai' : 'psychometric',
    item_type: 'likert',
    payload: {},
    payload_i18n: { cs: {}, en: {} },
    scale_min: 1,
    scale_max: 7,
    reverse_scoring: false,
    form_key: 'jcfpm-v3-ikigai-local',
    sort_order: (dimIndex + 1) * 100 + promptIndex + 1,
    status: 'active',
    version: 'jcfpm-v3-ikigai',
    locale_used: 'cs',
    translation_status: 'local_fallback',
  })),
);

const EXPECTED_DIMENSIONS = [
  'd1_cognitive', 'd2_social', 'd3_motivational', 'd4_energy',
  'd5_values', 'd6_ai_readiness', 'd7_cognitive_reflection',
  'd8_digital_eq', 'd9_systems_thinking', 'd10_ambiguity_interpretation',
  'd11_problem_decomposition', 'd12_moral_compass',
  'i1_love', 'i2_good_at', 'i3_world_needs', 'i4_paid_for',
];

const hasIkigai = (items: any[]) => items.some((item) => String(item?.section || '').toLowerCase() === 'ikigai' || String(item?.dimension || '').startsWith('i'));

const hasAllDimensions = (items: any[]): boolean => {
  const dimsInItems = new Set(items.map((item) => String(item?.dimension || '')));
  return EXPECTED_DIMENSIONS.every((dim) => dimsInItems.has(dim));
};

const isUsableV3Pool = (items: any[], meta?: any) => {
  if (!Array.isArray(items)) return false;
  if (String(meta?.source || '').toLowerCase() === 'fallback') return false;
  if (items.length < 72) return false;
  if (!hasAllDimensions(items)) return false;
  return hasIkigai(items);
};

export const fetchJcfpmItems = async (locale = 'cs', form = 'jcfpm-v3-ikigai') => {
  try {
    const response = await ApiService.get<any>(`/candidate/jcfpm/items?locale=${encodeURIComponent(locale)}&form=${encodeURIComponent(form)}`);
    const items = Array.isArray(response?.data) ? response.data : Array.isArray(response?.items) ? response.items : [];
    if (isUsableV3Pool(items, response?.meta)) return items;
  } catch {
    // Public fallback keeps the assessment usable during backend downtime.
  }
  return fallbackItems();
};

export const computeArchetype = (dimensionScores: Array<{ dimension?: string; percentile?: number; raw_score?: number }>) => {
  const sorted = [...dimensionScores]
    .filter((score) => String(score.dimension || '').startsWith('d'))
    .sort((left, right) => Number(right.percentile || 0) - Number(left.percentile || 0));
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
  if (value && typeof value === 'object') {
    const answer = value as { choice_id?: unknown; order?: unknown; pairs?: unknown };
    if (typeof answer.choice_id === 'string') return answer.choice_id.trim().length > 0;
    if (Array.isArray(answer.order)) return answer.order.length > 0;
    if (Array.isArray(answer.pairs)) return answer.pairs.length > 0;
  }
  return value !== undefined && value !== null;
};

const orderingSimilarity = (correctOrder: string[], selectedOrder: string[]) => {
  if (!correctOrder.length) return 0;
  if (correctOrder.length === 1) return selectedOrder[0] === correctOrder[0] ? 1 : 0;
  const maxShift = correctOrder.length - 1;
  const indexMap = new Map<string, number>();
  selectedOrder.forEach((value, index) => indexMap.set(value, index));
  return correctOrder.reduce((sum, value, correctIndex) => {
    const selectedIndex = indexMap.get(value);
    if (typeof selectedIndex !== 'number') return sum;
    const distance = Math.abs(selectedIndex - correctIndex);
    return sum + Math.max(0, 1 - distance / maxShift);
  }, 0) / correctOrder.length;
};

const pairMatchRatio = (correctPairs: any[], selectedPairs: any[]) => {
  const correctSet = new Set(correctPairs.map((pair: any) => `${pair.source}->${pair.target}`));
  const selectedSet = new Set(selectedPairs.map((pair: any) => `${pair.source}->${pair.target}`));
  if (!correctSet.size) return 0;
  let truePositive = 0;
  correctSet.forEach((key) => {
    if (selectedSet.has(key)) truePositive += 1;
  });
  const falsePositive = Math.max(0, selectedSet.size - truePositive);
  return Math.max(0, truePositive - falsePositive * 0.35) / correctSet.size;
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

  if (type === 'ordering' || (Array.isArray(payload?.correct_order) && (answer as any)?.order)) {
    const selectedOrder = Array.isArray((answer as any)?.order)
      ? (answer as any).order.map(String)
      : Array.isArray(answer)
        ? answer.map(String)
        : [];
    const correctOrder = Array.isArray(payload?.correct_order) ? payload.correct_order.map(String) : [];
    if (correctOrder.length > 0) {
      return 1 + orderingSimilarity(correctOrder, selectedOrder) * 6;
    }
    return Math.min(7, Math.max(1, selectedOrder.length));
  }

  if (type === 'drag_drop' || (Array.isArray(payload?.correct_pairs) && (answer as any)?.pairs)) {
    const correctPairs = Array.isArray(payload?.correct_pairs) ? payload.correct_pairs : [];
    const selectedPairs = Array.isArray((answer as any)?.pairs) ? (answer as any).pairs : [];
    return correctPairs.length ? 1 + pairMatchRatio(correctPairs, selectedPairs) * 6 : Math.min(7, Math.max(1, selectedPairs.length));
  }

  if (Array.isArray(answer)) {
    return Math.min(7, Math.max(1, answer.length));
  }

  const selected = String((answer as any)?.choice_id ?? answer);
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

const computeResponseQuality = (items: any[], responses: Record<string, unknown>) => {
  const answeredCount = items.filter((item) => hasJcfpmAnswer(responses[item.id])).length;
  const coverage = Math.round((answeredCount / Math.max(1, items.length)) * 100);
  const likertItems = items.filter((item) => (item?.item_type || 'likert') === 'likert');
  const likertValues = likertItems
    .map((item) => Number(responses[item.id]))
    .filter((value) => Number.isFinite(value) && value >= 1 && value <= 7);
  const byDimension = new Map<string, number[]>();
  likertItems.forEach((item) => {
    const value = Number(responses[item.id]);
    if (!Number.isFinite(value)) return;
    const dimension = String(item.dimension || 'unknown');
    const values = byDimension.get(dimension) || [];
    values.push(value);
    byDimension.set(dimension, values);
  });

  const straightLineDimensions: string[] = [];
  byDimension.forEach((values, dimension) => {
    if (values.length >= 4 && new Set(values).size === 1) straightLineDimensions.push(dimension);
  });

  const extremeRatio = likertValues.length
    ? likertValues.filter((value) => value === 1 || value === 7).length / likertValues.length
    : 0;
  const midpointRatio = likertValues.length
    ? likertValues.filter((value) => value === 4).length / likertValues.length
    : 0;
  const flags: string[] = [];
  if (straightLineDimensions.length >= 2) flags.push('straight_lining');
  if (extremeRatio > 0.72) flags.push('extreme_response_style');
  if (midpointRatio > 0.72) flags.push('low_differentiation');
  if (coverage < 100) flags.push('incomplete');

  const penalty =
    straightLineDimensions.length * 8 +
    (extremeRatio > 0.72 ? 14 : 0) +
    (midpointRatio > 0.72 ? 10 : 0) +
    Math.max(0, 100 - coverage) * 0.4;
  const score = Math.max(35, Math.min(100, Math.round(100 - penalty)));
  return {
    score,
    coverage,
    flags,
    straight_line_dimensions: straightLineDimensions,
    extreme_response_ratio: Number(extremeRatio.toFixed(2)),
    midpoint_response_ratio: Number(midpointRatio.toFixed(2)),
  };
};

export const submitJcfpm = async (
  responses: Record<string, JcfpmAnswer>,
  itemIds: string[],
  variantSeed: string,
  locale = 'cs',
  itemsOverride?: any[],
) => {
  const cleanResponses = Object.fromEntries(
    Object.entries(responses).map(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value) && 'selectedSource' in value) {
        const { selectedSource: _selectedSource, ...rest } = value;
        return [key, rest];
      }
      return [key, value];
    }),
  ) as Record<string, JcfpmAnswer>;
  const allItems = itemsOverride?.length ? itemsOverride : await fetchJcfpmItems(locale);
  const idSet = new Set(itemIds);
  const items = allItems.filter((item: any) => idSet.has(String(item?.id)));
  const dimensionScores = summarizeScores(items, cleanResponses, 'dimension');
  const sectionScores = summarizeScores(items, cleanResponses, 'section');
  const responseQuality = computeResponseQuality(items, cleanResponses);
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
    responses: cleanResponses,
    item_ids: itemIds,
    variant_seed: variantSeed,
    dimension_scores: dimensionScores,
    section_scores: sectionScores,
    ikigai_profile: ikigaiProfile,
    subdimension_scores: [],
    traits: [],
    fit_scores: [],
    ai_report: null,
    methodology: {
      name: 'JobShaman Career Fit & Potential Matrix',
      schema: 'jcfpm-v3-ikigai',
      scoring_model: 'hybrid_likert_situational_partial_credit',
      sections: ['psychometric_work_style', 'cognitive_skill_prerequisites', 'ikigai_orientation'],
    },
    response_quality: responseQuality,
    percentile_summary: Object.fromEntries(dimensionScores.map((score: any) => [score.dimension, score.percentile])),
    confidence: Math.round((responseQuality.coverage * 0.65) + (responseQuality.score * 0.35)),
    archetype,
  };
  try {
    const response = await ApiService.post<any>('/candidate/jcfpm/snapshots', snapshot);
    return response?.data || snapshot;
  } catch {
    return snapshot;
  }
};
