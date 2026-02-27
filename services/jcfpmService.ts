import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';
import { supabase } from './supabaseService';
import { JcfpmItem, JcfpmSnapshotV1 } from '../types';

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
    low: 'Nízká otevřenost k AI změnám',
    mid_low: 'Opatrná adaptace',
    balanced: 'Vyvážená připravenost',
    high: 'Vysoká adaptabilita a AI readiness',
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
    const inferDimFromKey = () => {
      const rawKey = String(item.pool_key || item.id || '').replace(/_v\d+$/i, '').toLowerCase();
      if (rawKey.startsWith('d1.')) return 'd1_cognitive';
      if (rawKey.startsWith('d2.')) return 'd2_social';
      if (rawKey.startsWith('d3.')) return 'd3_motivational';
      if (rawKey.startsWith('d4.')) return 'd4_energy';
      if (rawKey.startsWith('d5.')) return 'd5_values';
      if (rawKey.startsWith('d6.')) return 'd6_ai_readiness';
      if (rawKey.startsWith('d7.')) return 'd7_cognitive_reflection';
      if (rawKey.startsWith('d8.')) return 'd8_digital_eq';
      if (rawKey.startsWith('d9.')) return 'd9_systems_thinking';
      if (rawKey.startsWith('d10.')) return 'd10_ambiguity_interpretation';
      if (rawKey.startsWith('d11.')) return 'd11_problem_decomposition';
      if (rawKey.startsWith('d12.')) return 'd12_moral_compass';
      return 'd1_cognitive';
    };
    const safeDim = (normalizedDim || inferDimFromKey()) as import('../types').JcfpmDimensionId;
    return {
      ...item,
      dimension: safeDim,
      item_type: normalizedType || undefined,
      payload: normalizeJson(payload) as any,
      assets: normalizeJson(assets) as any,
    };
  });

const fetchItemsFromSupabase = async (): Promise<JcfpmItem[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('jcfpm_items')
    .select('id, dimension, subdimension, prompt, reverse_scoring, sort_order, item_type, payload, assets, pool_key, variant_index')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return normalizeJcfpmItems((data || []) as JcfpmItem[]);
};

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

export const computeJcfpmScoresLocal = (items: JcfpmItem[], responses: Record<string, any>) => {
  const inferDimension = (item: JcfpmItem) => {
    const explicit = String(item.dimension || '').trim();
    if (explicit && DIMENSIONS.includes(explicit as any)) return explicit;
    const rawKey = String(item.pool_key || item.id || '').replace(/_v\d+$/i, '').toLowerCase();
    if (rawKey.startsWith('d1.')) return 'd1_cognitive';
    if (rawKey.startsWith('d2.')) return 'd2_social';
    if (rawKey.startsWith('d3.')) return 'd3_motivational';
    if (rawKey.startsWith('d4.')) return 'd4_energy';
    if (rawKey.startsWith('d5.')) return 'd5_values';
    if (rawKey.startsWith('d6.')) return 'd6_ai_readiness';
    if (rawKey.startsWith('d7.')) return 'd7_cognitive_reflection';
    if (rawKey.startsWith('d8.')) return 'd8_digital_eq';
    if (rawKey.startsWith('d9.')) return 'd9_systems_thinking';
    if (rawKey.startsWith('d10.')) return 'd10_ambiguity_interpretation';
    if (rawKey.startsWith('d11.')) return 'd11_problem_decomposition';
    if (rawKey.startsWith('d12.')) return 'd12_moral_compass';
    return 'd1_cognitive';
  };
  const resolveItemType = (item: JcfpmItem, payload: Record<string, any>) => {
    const explicit = String(item.item_type || '').toLowerCase();
    if (explicit && explicit !== 'likert') return explicit;
    if (Array.isArray(payload.correct_order)) return 'ordering';
    if (Array.isArray(payload.correct_pairs)) return 'drag_drop';
    if (Array.isArray(payload.options)) return payload.options.some((opt: any) => opt?.image_url) ? 'image_choice' : 'mcq';
    const rawId = String(item.pool_key || item.id || '').replace(/_v\d+$/i, '');
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
    let timeFactor = 1;
    const timeMs = response?.time_ms;
    if (typeof timeMs === 'number' && timeMs > 0) {
      if (timeMs <= 15000) timeFactor = 1;
      else if (timeMs <= 60000) timeFactor = 1 - ((timeMs - 15000) / 45000) * 0.3;
      else timeFactor = 0.5;
      timeFactor = Math.min(1, Math.max(0.5, timeFactor));
    }
    if (itemType === 'mcq' || itemType === 'scenario_choice' || itemType === 'image_choice') {
      const correct = payload.correct_id;
      const selected = response?.choice_id ?? response;
      return { score: (selected && correct && selected === correct ? 1 : 0) * timeFactor, max: 1 };
    }
    if (itemType === 'ordering') {
      const correct = Array.isArray(payload.correct_order) ? payload.correct_order : [];
      const order = Array.isArray(response?.order) ? response.order : [];
      const max = Math.max(1, correct.length);
      const score = correct.reduce((acc: number, value: string, idx: number) => acc + (order[idx] === value ? 1 : 0), 0);
      return { score: score * timeFactor, max };
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
      return { score: score * timeFactor, max: Math.max(1, correctSet.size) };
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
    return {
      dimension: dim,
      raw_score: rawScore,
      percentile: pct,
      percentile_band: band,
      label,
    };
  });
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

const passesHardGates = (userProfile: Record<string, number>, roleProfile: Record<string, number>, aiIntensity?: string) => {
  for (const dim of Object.keys(WEIGHTS)) {
    const u = Number(userProfile[dim] ?? 0);
    const r = Number(roleProfile[dim] ?? 0);
    if (u >= HIGH_GATE_THRESHOLD && r < ROLE_HIGH_MIN) return false;
    if (u <= LOW_GATE_THRESHOLD && r > ROLE_LOW_MAX) return false;
  }
  if (Number(userProfile.d6_ai_readiness ?? 0) >= HIGH_GATE_THRESHOLD) {
    if ((aiIntensity || '').toLowerCase() !== 'high') return false;
  }
  return true;
};

const rankRolesLocal = (userProfile: Record<string, number>, roles: any[]) => {
  const ranked = roles.map((role) => {
    const roleProfile = {
      d1_cognitive: Number(role.d1),
      d2_social: Number(role.d2),
      d3_motivational: Number(role.d3),
      d4_energy: Number(role.d4),
      d5_values: Number(role.d5),
      d6_ai_readiness: Number(role.d6),
    };
    if (!passesHardGates(userProfile, roleProfile, role.ai_intensity)) {
      return null;
    }
    return {
      role_id: role.id,
      title: role.title,
      fit_score: Number(fitScore(userProfile, roleProfile).toFixed(2)),
      salary_range: role.salary_range || null,
      growth_potential: role.growth_potential || null,
      ai_impact: role.ai_impact || null,
      remote_friendly: role.remote_friendly || null,
    };
  });
  return ranked
    .filter(Boolean)
    .sort((a: any, b: any) => (b.fit_score || 0) - (a.fit_score || 0))
    .slice(0, 10);
};

export const mapJcfpmToJhiPreferences = (
  snapshot: JcfpmSnapshotV1,
  current: import('../types').JHIPreferences
): import('../types').JHIPreferences => {
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

  return {
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
};

export const fetchJcfpmItems = async (): Promise<JcfpmItem[]> => {
  try {
    const controller = new AbortController();
    const abortId = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await withTimeout(
        authenticatedFetch(`${BACKEND_URL}/tests/jcfpm/items`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal
        }),
        8000,
        'JCFPM items timeout'
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const detail = error.detail || error.message || `HTTP ${response.status}`;
        throw new Error(detail);
      }
      const payload = await response.json();
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const normalized = normalizeJcfpmItems(items as JcfpmItem[]);
      const poolCount = new Set(
        normalized.map((item) => String(item.pool_key || item.id || '').trim().toUpperCase())
      ).size;
      if (poolCount >= 108) return normalized;
      throw new Error('JCFPM items not seeded');
    } finally {
      window.clearTimeout(abortId);
    }
  } catch {
    return await fetchItemsFromSupabase();
  }
};

export const fetchLatestJcfpm = async (): Promise<JcfpmSnapshotV1 | null> => {
  const response = await authenticatedFetch(`${BACKEND_URL}/tests/jcfpm/latest`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
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
    const controller = new AbortController();
    const response = await withTimeout(
      authenticatedFetch(`${BACKEND_URL}/tests/jcfpm/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responses,
          item_ids: itemIds,
          variant_seed: variantSeed,
        }),
        signal: controller.signal
      }),
      12000,
      'JCFPM submit timeout'
    );
    if (!response.ok) return null;
    const payload = await response.json();
    return (payload?.snapshot || null) as JcfpmSnapshotV1 | null;
  } catch {
    const items = await fetchItemsFromSupabase();
    if (items.length < 108) return null;
    const selectedItems = itemIds.length
      ? items.filter((item) => itemIds.includes(item.id))
      : items;
    if (selectedItems.length < 108) return null;
    const dimensionScores = computeJcfpmScoresLocal(selectedItems, responses);
    const percentileSummary = dimensionScores.reduce((acc, row: any) => {
      acc[row.dimension] = row.percentile;
      return acc;
    }, {} as Record<string, number>);
    const roles = await fetchRolesFromSupabase();
    const userProfile = dimensionScores.reduce((acc, row: any) => {
      acc[row.dimension] = row.raw_score;
      return acc;
    }, {} as Record<string, number>);
    const fitScores = rankRolesLocal(userProfile, roles);
    const snapshot: JcfpmSnapshotV1 = {
      schema_version: 'jcfpm-v1',
      completed_at: new Date().toISOString(),
      responses,
      item_ids: itemIds,
      variant_seed: variantSeed,
      dimension_scores: dimensionScores as any,
      fit_scores: fitScores as any,
      ai_report: null,
      percentile_summary: percentileSummary as any,
      confidence: 100,
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
