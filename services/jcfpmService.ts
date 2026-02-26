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

const fetchItemsFromSupabase = async (): Promise<JcfpmItem[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('jcfpm_items')
    .select('id, dimension, subdimension, prompt, reverse_scoring, sort_order')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []) as JcfpmItem[];
};

const fetchRolesFromSupabase = async (): Promise<any[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('job_role_profiles')
    .select('id, title, d1, d2, d3, d4, d5, d6, salary_range, growth_potential, ai_impact, remote_friendly');
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

const scoreDimensionsLocal = (items: JcfpmItem[], responses: Record<string, number>) => {
  const byDim: Record<string, JcfpmItem[]> = {};
  items.forEach((item) => {
    byDim[item.dimension] = byDim[item.dimension] || [];
    byDim[item.dimension].push(item);
  });
  return DIMENSIONS.map((dim) => {
    const dimItems = byDim[dim] || [];
    const values = dimItems.map((item) => {
      const raw = Number(responses[item.id]);
      const scored = item.reverse_scoring ? 8 - raw : raw;
      return scored;
    });
    const rawScore = Number((values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)).toFixed(2));
    const { pct, band } = percentileBand(rawScore);
    const labels = LABELS[dim];
    const label = rawScore < 2.5 ? labels.low : rawScore < 4.5 ? labels.mid_low : rawScore < 5.5 ? labels.balanced : labels.high;
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
  return ranked.sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0)).slice(0, 10);
};

export const fetchJcfpmItems = async (): Promise<JcfpmItem[]> => {
  try {
    const controller = new AbortController();
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
    if (items.length >= 72) return items;
    throw new Error('JCFPM items not seeded');
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

export const submitJcfpm = async (responses: Record<string, number>): Promise<JcfpmSnapshotV1 | null> => {
  try {
    const controller = new AbortController();
    const response = await withTimeout(
      authenticatedFetch(`${BACKEND_URL}/tests/jcfpm/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
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
    if (items.length < 72) return null;
    const dimensionScores = scoreDimensionsLocal(items, responses);
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
