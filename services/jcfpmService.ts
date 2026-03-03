import { BACKEND_URL } from '../constants';
import { supabase } from './supabaseService';
import { JcfpmItem, JcfpmSnapshotV1, JcfpmDimensionId, JcfpmJhiAdjustmentV1, EmployerVisibleJcfpmSummary, ApplicationJcfpmShareLevel } from '../types';

const DIMENSIONS = [
  'd1_cognitive',
  'd2_social',
  'd3_motivational',
  'd4_energy',
  'd5_values',
  'd6_ai_readiness',
  'd7_cognitive_reflection',
  'd8_digital_eq',
  'd9_systems_thinking',
  'd10_ambiguity_interpretation',
  'd11_problem_decomposition',
  'd12_moral_compass',
] as const;

const stripVariantSuffix = (value: string): string => value.trim().replace(/_v\d+$/i, '');

const inferDimensionFromIdentity = (value: unknown): JcfpmDimensionId | undefined => {
  const raw = stripVariantSuffix(String(value || '')).toLowerCase();
  if (raw.startsWith('d1.')) return 'd1_cognitive';
  if (raw.startsWith('d2.')) return 'd2_social';
  if (raw.startsWith('d3.')) return 'd3_motivational';
  if (raw.startsWith('d4.')) return 'd4_energy';
  if (raw.startsWith('d5.')) return 'd5_values';
  if (raw.startsWith('d6.')) return 'd6_ai_readiness';
  if (raw.startsWith('d7.')) return 'd7_cognitive_reflection';
  if (raw.startsWith('d8.')) return 'd8_digital_eq';
  if (raw.startsWith('d9.')) return 'd9_systems_thinking';
  if (raw.startsWith('d10.')) return 'd10_ambiguity_interpretation';
  if (raw.startsWith('d11.')) return 'd11_problem_decomposition';
  if (raw.startsWith('d12.')) return 'd12_moral_compass';
  return undefined;
};

const WEIGHTS: Record<string, number> = {
  d1_cognitive: 1.2,
  d2_social: 1.5,
  d3_motivational: 1.3,
  d4_energy: 0.8,
  d5_values: 1.0,
  d6_ai_readiness: 1.1,
};

const LABELS: Record<string, { low: string; mid_low: string; balanced: string; high: string }> = {
  d1_cognitive: {
    low: 'Silně intuitivní, improvizační',
    mid_low: 'Mírně intuitivní, flexibilní',
    balanced: 'Vyvážený, adaptabilní',
    high: 'Silně analytický, strukturovaný',
  },
  d2_social: {
    low: 'Silně samostatný, introvertní',
    mid_low: 'Spíše samostatný, selektivní',
    balanced: 'Vyvážený mezi solo a týmovou prací',
    high: 'Silně týmový, vztahově orientovaný',
  },
  d3_motivational: {
    low: 'Silně extrinsicky motivovaný',
    mid_low: 'Spíše výkonově orientovaný',
    balanced: 'Vyvážená motivace',
    high: 'Silně intrinsicky motivovaný',
  },
  d4_energy: {
    low: 'Preferuje pomalejší tempo a stabilitu',
    mid_low: 'Spíše stabilní tempo',
    balanced: 'Vyvážený energetický pattern',
    high: 'Rychlé tempo a vysoká intenzita',
  },
  d5_values: {
    low: 'Stabilita a tradice',
    mid_low: 'Spíše stabilita',
    balanced: 'Vyvážené hodnotové ukotvení',
    high: 'Impact a inovace',
  },
  d6_ai_readiness: {
    low: 'Nižší otevřenost k rychlým technologickým změnám',
    mid_low: 'Opatrná adaptace',
    balanced: 'Vyvážená technologická adaptabilita',
    high: 'Vysoká technologická adaptabilita',
  },
  d7_cognitive_reflection: {
    low: 'Silně intuitivní, rychlé odpovědi bez ověření',
    mid_low: 'Spíše intuitivní, občas přemýšlíš do hloubky',
    balanced: 'Vyvážený poměr intuice a logiky',
    high: 'Silná schopnost odhalit chybnou intuici',
  },
  d8_digital_eq: {
    low: 'Nízká citlivost na tón a emoce v textu',
    mid_low: 'Základní digitální empatie',
    balanced: 'Vyvážené čtení emocí v textu',
    high: 'Vysoká digitální empatie a důvěryhodnost',
  },
  d9_systems_thinking: {
    low: 'Spíše lineární uvažování',
    mid_low: 'Částečné vnímání vztahů v systému',
    balanced: 'Vyvážený systémový pohled',
    high: 'Silné mapování zpětných vazeb a sítí',
  },
  d10_ambiguity_interpretation: {
    low: 'Silná orientace na rizika',
    mid_low: 'Spíše opatrný výklad',
    balanced: 'Vyvážené vnímání rizik a příležitostí',
    high: 'Silná orientace na příležitosti',
  },
  d11_problem_decomposition: {
    low: 'Obtížný rozklad velkých úkolů',
    mid_low: 'Základní strukturování',
    balanced: 'Vyvážený rozklad a pořadí kroků',
    high: 'Silná schopnost rozložit a prioritizovat',
  },
  d12_moral_compass: {
    low: 'Pragmatická orientace na výkon',
    mid_low: 'Mírná etická stabilita',
    balanced: 'Vyvážený etický kompas',
    high: 'Silná integrita a etické rozhodování',
  },
};

export const ARCHETYPES: Record<string, { title: string; title_en: string; description: string; description_en: string; icon: string }> = {
  architect: {
    title: 'Vizionářský architekt',
    title_en: 'Visionary Architect',
    description: 'Vynikáš v systémovém myšlení a rozkladu komplexních problémů. Vidíš strukturu tam, kde ostatní vidí chaos.',
    description_en: 'You excel in systems thinking and decomposing complex problems. You see structure where others see chaos.',
    icon: 'Brain',
  },
  stabilizer: {
    title: 'Sociální stabilizátor',
    title_en: 'Social Stabilizer',
    description: 'Tvoje síla je v digitální empatii a etickém kompasu. Jsi lepidlem, které drží tým i v náročných časech.',
    description_en: 'Your strength lies in digital empathy and an ethical compass. You are the glue that holds the team together even in tough times.',
    icon: 'Heart',
  },
  catalyst: {
    title: 'Technologický katalyzátor',
    title_en: 'Tech Catalyst',
    description: 'Rychlá adaptace na AI a nejasné situace je tvoje superschopnost. Jsi průkopníkem nových cest.',
    description_en: 'Rapid adaptation to AI and ambiguous situations is your superpower. You are a pioneer of new paths.',
    icon: 'Zap',
  },
  navigator: {
    title: 'Logický navigátor',
    title_en: 'Logical Navigator',
    description: 'Kognitivní reflexe a analytický styl ti umožňují bezpečně procházet i těmi nejsložitějšími daty.',
    description_en: 'Cognitive reflection and analytical style allow you to safely navigate even the most complex data.',
    icon: 'Compass',
  },
  guardian: {
    title: 'Strážce integrity',
    title_en: 'Guardian of Integrity',
    description: 'Morální kompas a smysl pro hodnoty jsou tvým základem. Buduješ důvěru, která přetrvá.',
    description_en: 'A moral compass and sense of values are your foundation. You build trust that lasts.',
    icon: 'ShieldCheck',
  },
  shaman: {
    title: 'Job Shaman',
    title_en: 'Job Shaman',
    description: 'Vzácná kombinace vysoké adaptibility, sociální intelligence a systémového pohledu.',
    description_en: 'A rare combination of high adaptability, social intelligence, and a systems view.',
    icon: 'Rocket',
  },
  strategist: {
    title: 'Strategický hybatel',
    title_en: 'Strategic Mover',
    description: 'Kombinuješ analytickou sílu s orientací na výkon. Dokážeš proměnit data v akci.',
    description_en: 'You combine analytical power with performance orientation. You can turn data into action.',
    icon: 'Target',
  },
  harmonizer: {
    title: 'Digitální harmonizátor',
    title_en: 'Digital Harmonizer',
    description: 'Mistr digitální empatie a spolupráce. Vytváříš psychologické bezpečí v týmu.',
    description_en: 'Master of digital empathy and collaboration. You create psychological safety in the team.',
    icon: 'Users',
  },
  pragmatist: {
    title: 'Efektivní pragmatik',
    title_en: 'Efficient Pragmatist',
    description: 'Soustředíš se na výsledek a praktickou aplikaci. Neztrácíš čas zbytečnostmi.',
    description_en: 'You focus on results and practical application. You don\'t waste time on fluff.',
    icon: 'Activity',
  },
};

export const computeArchetype = (dimensionScores: any[]) => {
  const scores = dimensionScores.reduce((acc, row) => {
    acc[row.dimension] = row.percentile || (row.raw_score / (row.raw_score > 7 ? 100 : 7)) * 100;
    return acc;
  }, {} as Record<string, number>);

  const top3 = dimensionScores
    .slice()
    .sort((a: any, b: any) => (b.percentile || 0) - (a.percentile || 0))
    .slice(0, 3)
    .map(d => d.dimension);

  if (scores.d11_problem_decomposition > 75 && scores.d9_systems_thinking > 75) return ARCHETYPES.architect;
  if (scores.d8_digital_eq > 75 && scores.d2_social > 75) return ARCHETYPES.stabilizer;
  if (scores.d6_ai_readiness > 75 && scores.d10_ambiguity_interpretation > 75) return ARCHETYPES.catalyst;
  if (scores.d7_cognitive_reflection > 75 && scores.d1_cognitive > 75) return ARCHETYPES.navigator;
  if (scores.d12_moral_compass > 75 && scores.d5_values > 75) return ARCHETYPES.guardian;
  if (scores.d1_cognitive > 70 && scores.d3_motivational > 70) return ARCHETYPES.strategist;
  if (scores.d2_social > 70 && scores.d8_digital_eq > 70) return ARCHETYPES.harmonizer;
  if (scores.d4_energy > 70 && scores.d11_problem_decomposition > 70) return ARCHETYPES.pragmatist;

  const avg = (Object.values(scores) as any[]).reduce((a: number, b: number) => a + b, 0) / (Object.values(scores).length || 1);
  if (avg > 70) return ARCHETYPES.shaman;

  const top = top3[0];
  if (['d11_problem_decomposition', 'd9_systems_thinking'].includes(top)) return ARCHETYPES.architect;
  if (['d8_digital_eq', 'd2_social', 'd12_moral_compass'].includes(top)) return ARCHETYPES.stabilizer;
  if (['d6_ai_readiness', 'd10_ambiguity_interpretation'].includes(top)) return ARCHETYPES.catalyst;
  if (['d1_cognitive', 'd7_cognitive_reflection'].includes(top)) return ARCHETYPES.navigator;
  if (['d5_values', 'd12_moral_compass'].includes(top)) return ARCHETYPES.guardian;
  if (['d3_motivational', 'd4_energy'].includes(top)) return ARCHETYPES.pragmatist;

  return ARCHETYPES.navigator;
};

/**
 * Samples a balanced set of items from the pool.
 * Selects only one variant per pool_key (randomly picked).
 * Filters by section (basic: d1-d6, deep_dive: d7-d12, full: all).
 * Limits the number of items per dimension for a manageable test length.
 */
export const sampleJcfpmItems = (items: JcfpmItem[], itemsPerDim: number = 3, section?: string, excludeKeys: string[] = []): JcfpmItem[] => {
  if (!items || items.length === 0) return [];

  // 1. Group by pool_key to have all variants together
  const pools: Record<string, JcfpmItem[]> = {};
  items.forEach(item => {
    const key = item.pool_key || item.id;
    if (!pools[key]) pools[key] = [];
    pools[key].push(item);
  });

  // 2. Filter pools by section if provided
  let poolKeys = Object.keys(pools);
  if (section === 'deep_dive') {
    const deepDims = ['d7_cognitive_reflection', 'd8_digital_eq', 'd9_systems_thinking', 'd10_ambiguity_interpretation', 'd11_problem_decomposition', 'd12_moral_compass'];
    poolKeys = poolKeys.filter(k => deepDims.includes(pools[k][0].dimension));
  } else if (section === 'basic') {
    const basicDims = ['d1_cognitive', 'd2_social', 'd3_motivational', 'd4_energy', 'd5_values', 'd6_ai_readiness'];
    poolKeys = poolKeys.filter(k => basicDims.includes(pools[k][0].dimension));
  }

  // 3. Separate pools into available and excluded (prioritize available)
  const excludedSet = new Set(excludeKeys);

  // 4. Group pool keys by dimension to ensure balanced sampling
  const dimMap: Record<string, string[]> = {};
  poolKeys.forEach(k => {
    const dim = pools[k][0].dimension || 'unknown';
    if (!dimMap[dim]) dimMap[dim] = [];
    dimMap[dim].push(k);
  });

  const sampled: JcfpmItem[] = [];

  Object.keys(dimMap).forEach(dim => {
    const dimPools = dimMap[dim];
    const availableDimPools = dimPools.filter(k => !excludedSet.has(k));
    const excludedDimPools = dimPools.filter(k => excludedSet.has(k));

    // Shuffle both
    const shuffledAvailable = availableDimPools.sort(() => 0.5 - Math.random());
    const shuffledExcluded = excludedDimPools.sort(() => 0.5 - Math.random());

    // Take as many as possible from available, then from excluded if needed
    const selectedKeys = [
      ...shuffledAvailable.slice(0, itemsPerDim),
      ...shuffledExcluded.slice(0, Math.max(0, itemsPerDim - shuffledAvailable.length))
    ];

    selectedKeys.forEach(k => {
      const pool = pools[k];
      const variant = pool[Math.floor(Math.random() * pool.length)];
      sampled.push(variant);
    });
  });

  // 5. Sort by dimension index and sort_order for a logical flow
  return sampled.sort((a, b) => {
    const idxA = DIMENSIONS.indexOf(a.dimension as any);
    const idxB = DIMENSIONS.indexOf(b.dimension as any);
    if (idxA !== idxB) return idxA - idxB;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
};


const withTimeout = async <T>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

const normalizeJcfpmItems = (items: JcfpmItem[]): JcfpmItem[] =>
  items.map((item) => {
    const payload = item.payload;
    const assets = item.assets;
    const normalizeJson = (value: any) => {
      if (value == null) return null;
      let next = value;
      for (let i = 0; i < 2; i += 1) {
        if (typeof next !== 'string') break;
        try {
          next = JSON.parse(next);
        } catch {
          return null;
        }
      }
      return next;
    };
    const normalizedType = String(item.item_type || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-+/g, '_') as any;
    const rawDim = String(item.dimension || '').trim().toLowerCase();
    const normalizedDim = (DIMENSIONS as readonly string[]).includes(rawDim) ? rawDim : undefined;
    const inferredDim =
      inferDimensionFromIdentity(item.id) ||
      inferDimensionFromIdentity(item.pool_key) ||
      (normalizedDim as JcfpmDimensionId | undefined);
    const safeDim = (inferredDim || 'd1_cognitive') as JcfpmDimensionId;
    return {
      ...item,
      dimension: safeDim,
      item_type: normalizedType || undefined,
      payload: normalizeJson(payload) as any,
      assets: normalizeJson(assets) as any,
      prompt_i18n: normalizeJson((item as any).prompt_i18n) as any,
      subdimension_i18n: normalizeJson((item as any).subdimension_i18n) as any,
      payload_i18n: normalizeJson((item as any).payload_i18n) as any,
    };
  });

const fetchRolesFromSupabase = async (): Promise<any[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('job_role_profiles')
    .select('id, title, d1, d2, d3, d4, d5, d6, salary_range, growth_potential, ai_impact, ai_intensity, remote_friendly');
  if (error) throw error;
  return data || [];
};

const percentileBand = (score: number) => {
  const interp = (v: number, sMin: number, sMax: number, dMin: number, dMax: number) => {
    if (sMax <= sMin) return dMin;
    const ratio = Math.min(1, Math.max(0, (v - sMin) / (sMax - sMin)));
    return dMin + ratio * (dMax - dMin);
  };
  if (score < 2.5) return { pct: Math.round(interp(score, 1.0, 2.5, 0, 15)), band: '0–15' };
  if (score < 4.5) return { pct: Math.round(interp(score, 2.5, 4.5, 15, 50)), band: '15–50' };
  if (score < 5.5) return { pct: Math.round(interp(score, 4.5, 5.5, 50, 85)), band: '50–85' };
  return { pct: Math.round(interp(score, 5.5, 7.0, 85, 100)), band: '85–100' };
};

const computeProfileConfidenceLocal = (
  items: JcfpmItem[],
  responses: Record<string, unknown>,
  dimensionScores: Array<{ item_count?: number }>
) => {
  if (!items.length) return 0;
  const ids = new Set(items.map((item) => String(item.id)));
  let answered = 0;
  ids.forEach((id) => {
    if (Object.prototype.hasOwnProperty.call(responses, id)) answered += 1;
  });
  const coverageRatio = answered / Math.max(1, ids.size);
  const dimsWithEvidence = dimensionScores.filter((row) => Number(row.item_count || 0) > 0).length;
  const dimensionRatio = dimsWithEvidence / DIMENSIONS.length;
  const avgItemsPerDim = answered / Math.max(1, dimsWithEvidence);
  const densityRatio = Math.min(1, avgItemsPerDim / 4);
  const score = (coverageRatio * 0.5) + (dimensionRatio * 0.3) + (densityRatio * 0.2);
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
};

const computeTimeFactor = (timeMs: unknown) => {
  if (typeof timeMs !== 'number' || !Number.isFinite(timeMs) || timeMs <= 0) return 1;
  if (timeMs <= 20000) return 1;
  if (timeMs <= 90000) {
    const ratio = (timeMs - 20000) / 70000;
    return Math.max(0.85, Math.min(1, 1 - ratio * 0.15));
  }
  return 0.75;
};

const orderingSimilarity = (correctOrder: any[], order: any[]) => {
  if (!correctOrder.length) return 0;
  if (correctOrder.length === 1) return order[0] === correctOrder[0] ? 1 : 0;
  const maxShift = correctOrder.length - 1;
  const indexMap = new Map<any, number>();
  order.forEach((value, idx) => indexMap.set(value, idx));
  return correctOrder.reduce((acc: number, value: any, idx: number) => {
    const selectedIdx = indexMap.get(value);
    if (typeof selectedIdx !== 'number') return acc;
    const distance = Math.abs(selectedIdx - idx);
    return acc + Math.max(0, 1 - (distance / maxShift));
  }, 0);
};

const pairMatchScore = (correctPairs: any[], selectedPairs: any[]) => {
  const correctSet = new Set(correctPairs.map((pair: any) => `${pair.source}->${pair.target}`));
  const selectedSet = new Set(selectedPairs.map((pair: any) => `${pair.source}->${pair.target}`));
  if (!correctSet.size) return 0;
  let truePositive = 0;
  correctSet.forEach((key) => {
    if (selectedSet.has(key)) truePositive += 1;
  });
  const falsePositive = Math.max(0, selectedSet.size - truePositive);
  return Math.max(0, truePositive - (falsePositive * 0.35));
};

export const computeJcfpmScoresLocal = (items: JcfpmItem[], responses: Record<string, any>) => {
  const inferDimension = (item: JcfpmItem) => {
    const explicit = String(item.dimension || '').trim().toLowerCase();
    const inferred =
      inferDimensionFromIdentity(item.id) ||
      inferDimensionFromIdentity(item.pool_key) ||
      ((DIMENSIONS as readonly string[]).includes(explicit) ? (explicit as JcfpmDimensionId) : undefined);
    return inferred || 'd1_cognitive';
  };
  const resolveItemType = (item: JcfpmItem, payload: Record<string, any>) => {
    const explicit = String(item.item_type || '').toLowerCase();
    if (explicit && explicit !== 'likert') return explicit;
    if (Array.isArray(payload.correct_order)) return 'ordering';
    if (Array.isArray(payload.correct_pairs)) return 'drag_drop';
    if (Array.isArray(payload.options)) return payload.options.some((opt: any) => opt?.image_url) ? 'image_choice' : 'mcq';
    const rawId = stripVariantSuffix(String(item.id || item.pool_key || ''));
    if (/^D10\./i.test(rawId)) return 'image_choice';
    if (/^D8\./i.test(rawId) || /^D12\./i.test(rawId)) return 'scenario_choice';
    if (/^D7\./i.test(rawId)) return 'mcq';
    if (/^D9\.1$/i.test(rawId) || /^D9\.4$/i.test(rawId) || /^D11\.2$/i.test(rawId) || /^D11\.5$/i.test(rawId)) return 'drag_drop';
    if (/^D9\.3$/i.test(rawId) || /^D11\.1$/i.test(rawId) || /^D11\.3$/i.test(rawId) || /^D11\.6$/i.test(rawId)) return 'ordering';
    if (/^D9\.2$/i.test(rawId) || /^D9\.5$/i.test(rawId) || /^D9\.6$/i.test(rawId) || /^D11\.4$/i.test(rawId)) return 'mcq';
    return explicit || 'likert';
  };

  const byDim: Record<string, JcfpmItem[]> = {};
  items.forEach((item) => {
    const dim = inferDimension(item);
    byDim[dim] = byDim[dim] || [];
    byDim[dim].push(item);
  });
  const scoreInteractive = (item: JcfpmItem, response: any) => {
    let payload = (item.payload || {}) as Record<string, any>;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload) as Record<string, any>;
      } catch {
        payload = {};
      }
    }
    const itemType = resolveItemType(item, payload);
    if (itemType === 'likert') {
      const raw = Number(response);
      const scored = item.reverse_scoring ? 8 - raw : raw;
      return { score: scored, max: 7 };
    }
    const timeFactor = computeTimeFactor(response?.time_ms);
    if (itemType === 'mcq' || itemType === 'scenario_choice' || itemType === 'image_choice') {
      const correct = payload.correct_id;
      const selected = response?.choice_id ?? response;
      return { score: (selected && correct && selected === correct ? 1 : 0) * timeFactor, max: 1 };
    }
    if (itemType === 'ordering') {
      const correct = Array.isArray(payload.correct_order) ? payload.correct_order : [];
      const order = Array.isArray(response?.order) ? response.order : [];
      const max = Math.max(1, correct.length);
      return { score: orderingSimilarity(correct, order) * timeFactor, max };
    }
    if (itemType === 'drag_drop') {
      const correctPairs = Array.isArray(payload.correct_pairs) ? payload.correct_pairs : [];
      const selectedPairs = Array.isArray(response?.pairs) ? response.pairs : [];
      return { score: pairMatchScore(correctPairs, selectedPairs) * timeFactor, max: Math.max(1, correctPairs.length) };
    }
    return { score: 0, max: 1 };
  };

  const percentileBand100 = (score: number) => ({ pct: Math.round(Math.max(0, Math.min(100, score))), band: '0–100' });
  return DIMENSIONS.map((dim) => {
    const dimItems = byDim[dim] || [];
    const values = dimItems.map((item) => scoreInteractive(item, responses[item.id]));
    let rawScore = 0;
    let pct = 0;
    let band = '0–100';
    const labels = LABELS[dim];
    let label = labels?.balanced || 'Vyvážené';
    if (dim.startsWith('d7_') || dim.startsWith('d8_') || dim.startsWith('d9_') || dim.startsWith('d10_') || dim.startsWith('d11_') || dim.startsWith('d12_')) {
      const total = values.reduce((acc, v) => acc + v.score, 0);
      const maxTotal = Math.max(1, values.reduce((acc, v) => acc + v.max, 0));
      rawScore = Number(((total / maxTotal) * 100).toFixed(2));
      const bandResult = percentileBand100(rawScore);
      pct = bandResult.pct;
      band = bandResult.band;
      label = rawScore < 40 ? labels.low : rawScore < 60 ? labels.mid_low : rawScore < 80 ? labels.balanced : labels.high;
    } else {
      const rawAvg = values.reduce((acc, v) => acc + v.score, 0) / Math.max(1, values.length);
      rawScore = Number(rawAvg.toFixed(2));
      const bandResult = percentileBand(rawScore);
      pct = bandResult.pct;
      band = bandResult.band;
      label = rawScore < 2.5 ? labels.low : rawScore < 4.5 ? labels.mid_low : rawScore < 5.5 ? labels.balanced : labels.high;
    }
    const consistencyScore = (() => {
      if (values.length < 2) return 100;
      const scores = values.map(v => v.score / v.max);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / scores.length;
      return Math.round(Math.max(0, 100 - variance * 200));
    })();

    return {
      dimension: dim,
      raw_score: rawScore,
      percentile: pct,
      percentile_band: band,
      label,
      consistency: consistencyScore,
      item_count: dimItems.length,
    };
  });
};

const computeNormalizedScore = (total: number, maxTotal: number) => {
  if (maxTotal <= 0) return 0;
  return Math.max(0, Math.min(100, Number(((total / maxTotal) * 100).toFixed(2))));
};

export const computeJcfpmSubdimensionScoresLocal = (items: JcfpmItem[], responses: Record<string, any>) => {
  const buckets = new Map<string, { dimension: JcfpmDimensionId; total: number; maxTotal: number; count: number; maxScores: number[] }>();
  const inferDimension = (item: JcfpmItem) => {
    const explicit = String(item.dimension || '').trim().toLowerCase();
    const inferred =
      inferDimensionFromIdentity(item.id) ||
      inferDimensionFromIdentity(item.pool_key) ||
      ((DIMENSIONS as readonly string[]).includes(explicit) ? (explicit as JcfpmDimensionId) : undefined);
    return inferred || 'd1_cognitive';
  };
  const scoreInteractive = (item: JcfpmItem, response: any) => {
    let payload = (item.payload || {}) as Record<string, any>;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload) as Record<string, any>;
      } catch {
        payload = {};
      }
    }
    const itemType = (() => {
      const explicit = String(item.item_type || '').toLowerCase();
      if (explicit && explicit !== 'likert') return explicit;
      if (Array.isArray(payload.correct_order)) return 'ordering';
      if (Array.isArray(payload.correct_pairs)) return 'drag_drop';
      if (Array.isArray(payload.options)) return payload.options.some((opt: any) => opt?.image_url) ? 'image_choice' : 'mcq';
      return explicit || 'likert';
    })();
    if (itemType === 'likert') {
      const raw = Number(response);
      const scored = item.reverse_scoring ? 8 - raw : raw;
      return { score: scored, max: 7 };
    }
    const correct = payload.correct_id;
    if (itemType === 'mcq' || itemType === 'scenario_choice' || itemType === 'image_choice') {
      const selected = response?.choice_id ?? response;
      return { score: selected && correct && selected === correct ? 1 : 0, max: 1 };
    }
    if (itemType === 'ordering') {
      const correctOrder = Array.isArray(payload.correct_order) ? payload.correct_order : [];
      const order = Array.isArray(response?.order) ? response.order : [];
      const max = Math.max(1, correctOrder.length);
      const score = correctOrder.reduce((acc: number, value: string, idx: number) => acc + (order[idx] === value ? 1 : 0), 0);
      return { score, max };
    }
    if (itemType === 'drag_drop') {
      const correctPairs = Array.isArray(payload.correct_pairs) ? payload.correct_pairs : [];
      const selectedPairs = Array.isArray(response?.pairs) ? response.pairs : [];
      const correctSet = new Set(correctPairs.map((pair: any) => `${pair.source}->${pair.target}`));
      const selectedSet = new Set(selectedPairs.map((pair: any) => `${pair.source}->${pair.target}`));
      let score = 0;
      correctSet.forEach((key) => {
        if (selectedSet.has(key)) score += 1;
      });
      return { score, max: Math.max(1, correctSet.size) };
    }
    return { score: 0, max: 1 };
  };

  items.forEach((item) => {
    const subdimension = String(item.subdimension || '').trim();
    if (!subdimension) return;
    const response = responses[item.id];
    if (typeof response === 'undefined') return;
    const { score, max } = scoreInteractive(item, response);
    const key = `${inferDimension(item)}::${subdimension}`;
    const bucket = buckets.get(key) || {
      dimension: inferDimension(item),
      total: 0,
      maxTotal: 0,
      count: 0,
      maxScores: [],
    };
    bucket.total += score;
    bucket.maxTotal += max;
    bucket.count += 1;
    bucket.maxScores.push(max);
    buckets.set(key, bucket);
  });

  return Array.from(buckets.entries()).map(([key, bucket]) => {
    const [, subdimension] = key.split('::');
    const allLikert = bucket.maxScores.every((value) => value === 7);
    const rawScore = allLikert && bucket.count > 0 ? Number((bucket.total / bucket.count).toFixed(2)) : computeNormalizedScore(bucket.total, bucket.maxTotal);
    const normalized = computeNormalizedScore(bucket.total, bucket.maxTotal);
    return {
      dimension: bucket.dimension,
      subdimension,
      raw_score: rawScore,
      normalized,
    };
  });
};

const average = (values: number[]) => {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Number(value.toFixed(2))));

export const computeJcfpmTraitsLocal = (
  dimensionScores: Array<{ dimension: JcfpmDimensionId; percentile?: number; raw_score: number }>,
  subdimensionScores: Array<{ subdimension: string; normalized: number }>,
) => {
  const pct = (dim: JcfpmDimensionId) => {
    const row = dimensionScores.find((item) => item.dimension === dim);
    if (!row) return 50;
    const base = typeof row.percentile === 'number' ? row.percentile : (dim.startsWith('d7_') || dim.startsWith('d8_') || dim.startsWith('d9_') || dim.startsWith('d10_') || dim.startsWith('d11_') || dim.startsWith('d12_')) ? row.raw_score : (row.raw_score / 7) * 100;
    return Math.max(0, Math.min(100, base));
  };

  const matchSubdims = (keywords: string[]) => {
    const lowered = keywords.map((item) => item.toLowerCase());
    return subdimensionScores
      .filter((row) => lowered.some((key) => row.subdimension.toLowerCase().includes(key)))
      .map((row) => row.normalized);
  };

  const extraversionSignals = matchSubdims([
    'leadership', 'lead', 'extern', 'network', 'komunik', 'druž', 'asertiv', 'dominanc', 'aktiv', 'vzruš',
  ]);
  const agreeablenessSignals = matchSubdims([
    'empath', 'empati', 'etick', 'moral', 'fair', 'férov', 'důvěr', 'altru', 'tone', 'feedback', 'integrit',
  ]);
  const conscientiousnessSignals = matchSubdims([
    'strukt', 'detail', 'systemat', 'poř', 'organiz', 'focus', 'priorit', 'decompos', 'rozklad', 'planning', 'cílev', 'discipl',
  ]);
  const opennessSignals = matchSubdims([
    'experiment', 'innov', 'nov', 'změn', 'kreat', 'ambigu', 'intuic', 'big picture', 'open', 'ai', 'tolerance',
  ]);
  const neuroticismSignals = matchSubdims([
    'stres', 'anx', 'úzk', 'neklid', 'reakt', 'impuls', 'frustr', 'tlak', 'panic', 'nerv', 'hněv', 'anger',
  ]);

  const extraversion = clampScore(average(extraversionSignals.length ? extraversionSignals : [pct('d2_social'), pct('d4_energy')]));
  const agreeableness = clampScore(average(agreeablenessSignals.length ? agreeablenessSignals : [pct('d8_digital_eq'), pct('d12_moral_compass'), pct('d5_values')]));
  const conscientiousness = clampScore(average(conscientiousnessSignals.length ? conscientiousnessSignals : [pct('d1_cognitive'), pct('d11_problem_decomposition'), pct('d4_energy')]));
  const openness = clampScore(average(opennessSignals.length ? opennessSignals : [pct('d5_values'), pct('d6_ai_readiness'), pct('d10_ambiguity_interpretation')]));
  const neuroticismRaw = average(neuroticismSignals.length ? neuroticismSignals : [100 - pct('d4_energy'), 100 - pct('d6_ai_readiness')]);
  const neuroticism = clampScore(neuroticismRaw);

  const dominanceSignals = matchSubdims(['leadership', 'asertiv', 'dominanc', 'konfront', 'assert', 'lead']);
  const reactivitySignals = matchSubdims(['reakt', 'stres', 'impuls', 'frustr', 'tlak', 'hněv', 'anger', 'urgent']);
  const dominanceBase = dominanceSignals.length ? average(dominanceSignals) : average([extraversion, 100 - agreeableness]);
  const reactivityBase = reactivitySignals.length ? average(reactivitySignals) : average([neuroticism, 100 - pct('d10_ambiguity_interpretation')]);
  const dominance = clampScore(dominanceBase);
  const reactivity = clampScore(reactivityBase);
  const dominanceHigh = dominance >= 65;
  const reactivityHigh = reactivity >= 65;
  const temperamentLabel: 'cholerik' | 'sangvinik' | 'melancholik' | 'flegmatik' =
    dominanceHigh && reactivityHigh ? 'cholerik' :
      dominanceHigh && !reactivityHigh ? 'sangvinik' :
        !dominanceHigh && reactivityHigh ? 'melancholik' : 'flegmatik';

  const evidenceCount =
    extraversionSignals.length +
    agreeablenessSignals.length +
    conscientiousnessSignals.length +
    opennessSignals.length +
    neuroticismSignals.length +
    dominanceSignals.length +
    reactivitySignals.length;
  const signalSeparation = (Math.abs(dominance - 50) + Math.abs(reactivity - 50)) / 2;
  const evidenceRatio = Math.min(1, evidenceCount / 12);
  const confidence = clampScore((signalSeparation * 0.55) + (evidenceRatio * 45));

  const notes: string[] = [];
  if (evidenceCount < 4) {
    notes.push('Temperament je odhad s nižší jistotou kvůli omezenému množství signálů.');
  } else if (evidenceCount >= 8) {
    notes.push('Temperament vychází z více shodných signálů napříč dimenzemi a subdimenzemi.');
  }
  if (dominance >= 45 && dominance <= 55 && reactivity >= 45 && reactivity <= 55) {
    notes.push('Profil leží blízko středu, proto je temperament spíše jemný než vyhraněný.');
  }

  return {
    big_five: {
      openness,
      conscientiousness,
      extraversion,
      agreeableness,
      neuroticism,
      derived: true,
    },
    temperament: {
      label: temperamentLabel,
      dominance,
      reactivity,
      confidence,
      notes,
    },
  };
};

const fitScore = (user: Record<string, number>, role: Record<string, number>) => {
  const totalW = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const acc = Object.entries(WEIGHTS).reduce((sum, [dim, w]) => {
    const diff = (user[dim] ?? 0) - (role[dim] ?? 0);
    return sum + w * diff * diff;
  }, 0);
  const dist = Math.sqrt(acc) / Math.sqrt(totalW || 1);
  const maxDistance = 6.0;
  const score = 100 * (1 - Math.min(dist, maxDistance) / maxDistance);
  return Math.max(0, Math.min(100, score));
};

const HIGH_GATE_THRESHOLD = 5.5;
const LOW_GATE_THRESHOLD = 2.5;
const ROLE_HIGH_MIN = 4.6;
const ROLE_LOW_MAX = 3.8;
const AI_INTENSITY_BONUS: Record<string, number> = {
  low: 0,
  medium: 4,
  high: 6,
};

const passesHardGates = (userProfile: Record<string, number>, roleProfile: Record<string, number>, _aiIntensity?: string) => {
  for (const dim of Object.keys(WEIGHTS)) {
    const u = Number(userProfile[dim] ?? 0);
    const r = Number(roleProfile[dim] ?? 0);
    if (u >= HIGH_GATE_THRESHOLD && r < ROLE_HIGH_MIN) return false;
    if (u <= LOW_GATE_THRESHOLD && r > ROLE_LOW_MAX) return false;
  }
  return true;
};

const aiIntensityBonus = (userProfile: Record<string, number>, aiIntensity?: string) => {
  const level = String(aiIntensity || '').toLowerCase();
  const base = AI_INTENSITY_BONUS[level] || 0;
  const d6 = Number(userProfile.d6_ai_readiness ?? 0);
  if (d6 >= HIGH_GATE_THRESHOLD) {
    if (level === 'high') return base;
    if (level === 'medium') return base + 3;
    return 1;
  }
  if (d6 <= LOW_GATE_THRESHOLD) {
    if (level === 'high') return -8;
    if (level === 'medium') return -2.5;
    return 2;
  }
  if (level === 'high') return base - 1;
  return base;
};

const maxHighAiRoles = (userProfile: Record<string, number>, topN: number) => {
  const d6 = Number(userProfile.d6_ai_readiness ?? 0);
  if (d6 >= HIGH_GATE_THRESHOLD) return Math.max(2, Math.ceil(topN * 0.3));
  if (d6 <= LOW_GATE_THRESHOLD) return Math.max(1, Math.ceil(topN * 0.1));
  return Math.max(2, Math.ceil(topN * 0.2));
};

const rankRolesLocal = (userProfile: Record<string, number>, roles: any[]) => {
  const ranked = roles.map((role) => {
    const aiIntensity = String(role.ai_intensity || '').toLowerCase();
    const roleProfile = {
      d1_cognitive: Number(role.d1),
      d2_social: Number(role.d2),
      d3_motivational: Number(role.d3),
      d4_energy: Number(role.d4),
      d5_values: Number(role.d5),
      d6_ai_readiness: Number(role.d6),
    };
    if (!passesHardGates(userProfile, roleProfile, aiIntensity)) {
      return null;
    }
    return {
      role_id: role.id,
      title: role.title,
      fit_score: Number(Math.max(0, Math.min(100, fitScore(userProfile, roleProfile) + aiIntensityBonus(userProfile, aiIntensity))).toFixed(2)),
      salary_range: role.salary_range || null,
      growth_potential: role.growth_potential || null,
      ai_impact: role.ai_impact || null,
      remote_friendly: role.remote_friendly || null,
      ai_intensity: aiIntensity || null,
    };
  });
  const sorted = ranked
    .filter(Boolean)
    .sort((a: any, b: any) => (b.fit_score || 0) - (a.fit_score || 0));
  const limit = 10;
  const highAiLimit = maxHighAiRoles(userProfile, limit);
  let highAiCount = 0;
  const deferred: any[] = [];
  const selected: any[] = [];
  sorted.forEach((role: any) => {
    const isHighAi = role.ai_intensity === 'high';
    if (isHighAi && highAiCount >= highAiLimit) {
      deferred.push(role);
      return;
    }
    if (isHighAi) highAiCount += 1;
    selected.push(role);
  });
  return [...selected, ...deferred].slice(0, limit);
};

export const mapJcfpmToJhiPreferencesWithExplanation = (
  snapshot: JcfpmSnapshotV1,
  current: import('../types').JHIPreferences
): { preferences: import('../types').JHIPreferences; explanation: JcfpmJhiAdjustmentV1 } => {
  const pct = (dim: import('../types').JcfpmDimensionId) => {
    const value = snapshot.percentile_summary?.[dim];
    if (typeof value === 'number') return Math.max(0, Math.min(100, value));
    const row = (snapshot.dimension_scores || []).find((r) => r.dimension === dim);
    return typeof row?.percentile === 'number' ? Math.max(0, Math.min(100, row.percentile)) : 50;
  };

  const d2 = pct('d2_social');
  const d3 = pct('d3_motivational');
  const d4 = pct('d4_energy');
  const d5 = pct('d5_values');
  const d6 = pct('d6_ai_readiness');

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const tValues = d5 / 100;
  const tGrowth = ((d3 + d6) / 2) / 100;
  const tEnergy = d4 / 100;

  let financial = 0.25;
  let values = lerp(0.08, 0.22, tValues);
  let growth = lerp(0.12, 0.25, tGrowth);
  let timeCost = lerp(0.3, 0.15, tEnergy);
  let mentalLoad = 1 - (financial + values + growth + timeCost);
  mentalLoad = Math.max(0.12, Math.min(0.3, mentalLoad));

  const total = financial + values + growth + timeCost + mentalLoad;
  financial /= total;
  values /= total;
  growth /= total;
  timeCost /= total;
  mentalLoad /= total;

  const peopleIntensity = Math.round(d2);
  const careerGrowthPreference = Math.round((d3 + d6) / 2);
  const homeOfficePreference = Math.round(50 + (100 - d2) * 0.2 + (100 - d4) * 0.2);

  const nextPreferences = {
    ...current,
    pillarWeights: {
      ...current.pillarWeights,
      financial,
      timeCost,
      mentalLoad,
      growth,
      values,
    },
    workStyle: {
      ...current.workStyle,
      peopleIntensity,
      careerGrowthPreference,
      homeOfficePreference: Math.max(0, Math.min(100, homeOfficePreference)),
    },
  };

  const pctWeight = (value: number) => Math.round(value * 100);
  const explanation: JcfpmJhiAdjustmentV1 = {
    version: 'jcfpm-jhi-adjustment-v1',
    generated_at: new Date().toISOString(),
    inputs: {
      d2_social: d2,
      d3_motivational: d3,
      d4_energy: d4,
      d5_values: d5,
      d6_ai_readiness: d6,
    },
    changes: [
      {
        field: 'pillarWeights.values',
        from: pctWeight(current.pillarWeights.values),
        to: pctWeight(nextPreferences.pillarWeights.values),
        reason: 'Higher D5 (values) increases weight of value alignment in job scoring.',
        reason_i18n: {
          cs: 'Vyšší D5 (hodnoty) zvyšuje váhu hodnotového souladu při skórování pracovních nabídek.',
          en: 'Higher D5 (values) increases weight of value alignment in job scoring.',
        },
      },
      {
        field: 'pillarWeights.growth',
        from: pctWeight(current.pillarWeights.growth),
        to: pctWeight(nextPreferences.pillarWeights.growth),
        reason: 'Combined D3 (motivation) + D6 (technology adaptability) drives growth priority.',
        reason_i18n: {
          cs: 'Kombinace D3 (motivace) + D6 (technologická adaptabilita) posouvá prioritu na profesní růst.',
          en: 'Combined D3 (motivation) + D6 (technology adaptability) drives growth priority.',
        },
      },
      {
        field: 'pillarWeights.timeCost',
        from: pctWeight(current.pillarWeights.timeCost),
        to: pctWeight(nextPreferences.pillarWeights.timeCost),
        reason: 'Higher D4 (energy) lowers time-cost penalty; lower D4 raises it.',
        reason_i18n: {
          cs: 'Vyšší D4 (energie) snižuje penalizaci za časovou náročnost, nižší D4 ji naopak zvyšuje.',
          en: 'Higher D4 (energy) lowers time-cost penalty; lower D4 raises it.',
        },
      },
      {
        field: 'workStyle.peopleIntensity',
        from: Math.round(current.workStyle.peopleIntensity),
        to: Math.round(nextPreferences.workStyle.peopleIntensity),
        reason: 'Mapped directly from D2 (social orientation).',
        reason_i18n: {
          cs: 'Mapováno přímo z D2 (sociální orientace).',
          en: 'Mapped directly from D2 (social orientation).',
        },
      },
      {
        field: 'workStyle.careerGrowthPreference',
        from: Math.round(current.workStyle.careerGrowthPreference),
        to: Math.round(nextPreferences.workStyle.careerGrowthPreference),
        reason: 'Derived from average of D3 (motivation) and D6 (technology adaptability).',
        reason_i18n: {
          cs: 'Odvozeno z průměru D3 (motivace) a D6 (technologická adaptabilita).',
          en: 'Derived from average of D3 (motivation) and D6 (technology adaptability).',
        },
      },
      {
        field: 'workStyle.homeOfficePreference',
        from: Math.round(current.workStyle.homeOfficePreference),
        to: Math.round(nextPreferences.workStyle.homeOfficePreference),
        reason: 'Higher when D2 and D4 are lower (preference for calmer, solo/remote setup).',
        reason_i18n: {
          cs: 'Je vyšší, když jsou D2 a D4 nižší (preference klidnějšího, samostatného/remote režimu).',
          en: 'Higher when D2 and D4 are lower (preference for calmer, solo/remote setup).',
        },
      },
    ],
  };

  return { preferences: nextPreferences, explanation };
};

export const mapJcfpmToJhiPreferences = (
  snapshot: JcfpmSnapshotV1,
  current: import('../types').JHIPreferences
): import('../types').JHIPreferences => {
  return mapJcfpmToJhiPreferencesWithExplanation(snapshot, current).preferences;
};

export const buildEmployerVisibleJcfpmPayload = (
  snapshot: JcfpmSnapshotV1 | null | undefined,
  shareLevel: ApplicationJcfpmShareLevel,
  adjustment?: JcfpmJhiAdjustmentV1 | null
): EmployerVisibleJcfpmSummary | null => {
  if (!snapshot || shareLevel === 'do_not_share') return null;

  const sortedDimensions = [...(snapshot.dimension_scores || [])]
    .sort((a, b) => (b.percentile || 0) - (a.percentile || 0));
  const pctByDim = new Map(
    (snapshot.dimension_scores || []).map((row) => [row.dimension, Math.round(row.percentile || 0)])
  );
  const comparisonSignals = [
    { key: 'analytical', label: 'Analytical structure', score: pctByDim.get('d1_cognitive') || 0 },
    { key: 'collaboration', label: 'Collaboration', score: pctByDim.get('d2_social') || 0 },
    { key: 'drive', label: 'Drive', score: pctByDim.get('d3_motivational') || 0 },
    { key: 'execution', label: 'Execution stamina', score: pctByDim.get('d4_energy') || 0 },
    { key: 'adaptability', label: 'Adaptability', score: pctByDim.get('d6_ai_readiness') || 0 },
    { key: 'judgement', label: 'Judgement', score: pctByDim.get('d12_moral_compass') || 0 },
  ];

  const base: EmployerVisibleJcfpmSummary = {
    schema_version: 'jcfpm-share-v1',
    share_level: 'summary',
    completed_at: snapshot.completed_at,
    confidence: snapshot.confidence,
    archetype: snapshot.archetype || null,
    top_dimensions: sortedDimensions.slice(0, 3).map((row) => ({
      dimension: row.dimension,
      percentile: row.percentile,
      label: row.label,
    })),
    strengths: (snapshot.ai_report?.strengths || []).slice(0, 5),
    environment_fit_summary: (snapshot.ai_report?.ideal_environment || []).slice(0, 4),
    jhi_adjustment_summary: (adjustment?.changes || []).slice(0, 6).map((change) => ({
      field: change.field,
      from: change.from,
      to: change.to,
      reason: change.reason_i18n?.en || change.reason,
    })),
    comparison_signals: comparisonSignals,
  };

  return base;
};

let globalJcfpmItemsCache: JcfpmItem[] | null = null;
let globalJcfpmItemsFetchPromise: Promise<JcfpmItem[]> | null = null;

const fetchItemsFromSupabase = async (): Promise<JcfpmItem[]> => {
  if (globalJcfpmItemsCache) {
    return globalJcfpmItemsCache;
  }
  if (globalJcfpmItemsFetchPromise) {
    return globalJcfpmItemsFetchPromise;
  }

  globalJcfpmItemsFetchPromise = (async () => {
    try {
      if (!supabase) throw new Error('Supabase client not initialized');
      let allRows: any[] = [];
      let offset = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('jcfpm_items')
          .select('id, dimension, subdimension, prompt, prompt_i18n, subdimension_i18n, reverse_scoring, sort_order, item_type, payload, payload_i18n, assets, pool_key, variant_index')
          .order('sort_order', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (error) {
          throw new Error(`Supabase query failed: ${error.message}`);
        }

        const page = Array.isArray(data) ? data : [];
        allRows = allRows.concat(page);
        if (page.length < pageSize) {
          break;
        }
        offset += pageSize;
      }

      const normalized = normalizeJcfpmItems(allRows as JcfpmItem[]);
      globalJcfpmItemsCache = normalized;
      return normalized;
    } catch (err) {
      globalJcfpmItemsFetchPromise = null;
      throw err;
    }
  })();

  return globalJcfpmItemsFetchPromise;
};

export const fetchJcfpmItems = async (): Promise<JcfpmItem[]> => {
  const ensureSeeded = (items: JcfpmItem[]): JcfpmItem[] => {
    const normalized = normalizeJcfpmItems(items as JcfpmItem[]);
    const poolCount = new Set(
      normalized.map((item) => {
        const idBase = stripVariantSuffix(String(item.id || ''));
        const poolBase = stripVariantSuffix(String(item.pool_key || ''));
        return (idBase || poolBase).toUpperCase();
      }).filter(Boolean)
    ).size;
    if (poolCount >= 108) return normalized;
    throw new Error(`JCFPM items not seeded sufficiently (found ${poolCount} keys, expected at least 108)`);
  };

  const fetchFromBackendPublic = async () => {
    const controller = new AbortController();
    const abortId = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await withTimeout(fetch(`${BACKEND_URL}/tests/jcfpm/items`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      }), 20000, 'JCFPM items timeout');
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const detail = error.detail || error.message || `HTTP ${response.status}`;
        throw new Error(detail);
      }
      const payload = await response.json();
      const items = Array.isArray(payload?.items) ? payload.items : [];
      return ensureSeeded(items as JcfpmItem[]);
    } finally {
      window.clearTimeout(abortId);
    }
  };

  try {
    const supabaseItems = await fetchItemsFromSupabase();
    return ensureSeeded(supabaseItems);
  } catch (supabaseErr: any) {
    console.warn('Failed to fetch from Supabase, falling back to backend:', supabaseErr);
    try {
      return await fetchFromBackendPublic();
    } catch (firstErr: any) {
      const msg = String(firstErr?.message || '').toLowerCase();
      const retryable = msg.includes('timeout') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('abort');

      if (retryable) {
        await new Promise((resolve) => window.setTimeout(resolve, 1200));
        return await fetchFromBackendPublic(); // Second try, throw naturally if it fails
      }

      // Direct throw if it wasn't a network error (e.g. 500 or ensureSeeded failed)
      throw firstErr;
    }
  }
};

const buildBackendAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (!supabase) return headers;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // Non-fatal: endpoints that allow anonymous access will still work.
  }
  return headers;
};

export const fetchLatestJcfpm = async (): Promise<JcfpmSnapshotV1 | null> => {
  const response = await withTimeout(fetch(`${BACKEND_URL}/tests/jcfpm/latest`, {
    method: 'GET',
    headers: await buildBackendAuthHeaders(),
  }), 12000, 'JCFPM latest timeout');
  if (!response.ok) return null;
  const payload = await response.json();
  return (payload?.snapshot || null) as JcfpmSnapshotV1 | null;
};

export const submitJcfpm = async (
  responses: Record<string, any>,
  itemIds: string[] = [],
  variantSeed?: string
): Promise<JcfpmSnapshotV1 | null> => {
  try {
    const response = await withTimeout(
      fetch(`${BACKEND_URL}/tests/jcfpm/submit`, {
        method: 'POST',
        headers: await buildBackendAuthHeaders(),
        body: JSON.stringify({
          responses,
          item_ids: itemIds,
          variant_seed: variantSeed,
        }),
      }),
      30000,
      'JCFPM submit timeout'
    );
    if (!response.ok) {
      throw new Error(`JCFPM submit failed (${response.status})`);
    }
    const payload = await response.json();
    return (payload?.snapshot || null) as JcfpmSnapshotV1 | null;
  } catch {
    // If backend submit likely completed but client timed out, try reading latest snapshot first.
    try {
      const latest = await fetchLatestJcfpm();
      if (latest) {
        const latestIds = Array.isArray(latest.item_ids) ? latest.item_ids : Object.keys(latest.responses || {});
        const sameVariant = variantSeed && latest.variant_seed ? latest.variant_seed === variantSeed : false;
        const sameItems =
          itemIds.length > 0 &&
          latestIds.length === itemIds.length &&
          itemIds.every((id) => latestIds.includes(id));
        if (sameVariant || sameItems) {
          return latest;
        }
      }
    } catch {
      // Continue to local fallback.
    }

    const items = await fetchJcfpmItems();
    if (items.length < 72) return null;
    const selectedItems = itemIds.length
      ? items.filter((item: JcfpmItem) => itemIds.includes(String(item.id)))
      : items;
    if (!selectedItems.length) return null;
    const inferDimension = (item: JcfpmItem): JcfpmDimensionId => {
      const explicit = String(item.dimension || '').trim().toLowerCase();
      const inferred =
        inferDimensionFromIdentity(item.id) ||
        inferDimensionFromIdentity(item.pool_key) ||
        ((DIMENSIONS as readonly string[]).includes(explicit) ? (explicit as JcfpmDimensionId) : undefined);
      return inferred || 'd1_cognitive';
    };
    const testedDimensions = new Set<JcfpmDimensionId>(selectedItems.map((item: JcfpmItem) => inferDimension(item)));
    const dimensionScores = computeJcfpmScoresLocal(selectedItems, responses)
      .filter((row: any) => testedDimensions.has(row.dimension as JcfpmDimensionId));
    const subdimensionScores = computeJcfpmSubdimensionScoresLocal(selectedItems, responses);
    const traits = computeJcfpmTraitsLocal(dimensionScores as any, subdimensionScores as any);
    const percentileSummary = dimensionScores.reduce((acc, row: any) => {
      acc[row.dimension] = row.percentile;
      return acc;
    }, {} as Record<string, number>);
    const roles = await fetchRolesFromSupabase();
    const userProfile = dimensionScores.reduce((acc, row: any) => {
      acc[row.dimension] = row.raw_score;
      return acc;
    }, {} as Record<string, number>);
    const coreDimensions: JcfpmDimensionId[] = [
      'd1_cognitive',
      'd2_social',
      'd3_motivational',
      'd4_energy',
      'd5_values',
      'd6_ai_readiness',
    ];
    const hasCoreProfile = coreDimensions.every((dim) => typeof userProfile[dim] === 'number');
    const fitScores = hasCoreProfile ? rankRolesLocal(userProfile, roles) : [];
    const archetype = computeArchetype(dimensionScores);
    const snapshot: JcfpmSnapshotV1 = {
      schema_version: 'jcfpm-v1',
      completed_at: new Date().toISOString(),
      responses,
      item_ids: itemIds,
      variant_seed: variantSeed,
      dimension_scores: dimensionScores as any,
      subdimension_scores: subdimensionScores as any,
      traits: traits as any,
      fit_scores: fitScores as any,
      ai_report: null,
      percentile_summary: percentileSummary as any,
      confidence: computeProfileConfidenceLocal(selectedItems, responses, dimensionScores as any),
      archetype: archetype as any, // Adding archetype to snapshot
    };

    if (supabase) {
      try {
        const { data: session } = await supabase.auth.getSession();
        const userId = session?.session?.user?.id;
        if (userId) {
          await supabase.from('jcfpm_results').insert({
            user_id: userId,
            raw_responses: responses,
            dimension_scores: dimensionScores,
            fit_scores: fitScores,
            ai_report: null,
            version: 'jcfpm-v1',
          });
        }
      } catch {
        // Best-effort only.
      }
    }

    return snapshot;
  }
};
