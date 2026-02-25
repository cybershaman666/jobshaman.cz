import { IkigaiQuadrantScoresV1 } from '../types';

export interface IkigaiDomainResponse {
  energy: number;
  clarity: number;
  sustainability: number;
  notes?: string;
}

export interface IkigaiScoringInput {
  love: IkigaiDomainResponse;
  strength: IkigaiDomainResponse;
  need: IkigaiDomainResponse;
  reward: IkigaiDomainResponse;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const domainScore = (domain: IkigaiDomainResponse): number => {
  const notesBoost = domain.notes && domain.notes.trim().length > 40 ? 4 : domain.notes && domain.notes.trim().length > 15 ? 2 : 0;
  return Math.round(clamp(domain.energy * 0.4 + domain.clarity * 0.35 + domain.sustainability * 0.25 + notesBoost, 0, 100));
};

const pairGap = (a: number, b: number): number => Math.abs(a - b);

const resolveTensionVectors = (scores: Omit<IkigaiQuadrantScoresV1, 'ikigai_core_score' | 'tension_vectors'>): string[] => {
  const vectors: string[] = [];
  if (pairGap(scores.love_score, scores.reward_score) >= 22) {
    vectors.push('Napětí mezi nadšením a odměnou');
  }
  if (pairGap(scores.strength_score, scores.need_score) >= 22) {
    vectors.push('Napětí mezi silou a dopadem');
  }
  if (Math.min(scores.need_score, scores.reward_score) < 45) {
    vectors.push('Napětí mezi smyslem a trhem');
  }
  if (vectors.length === 0) {
    vectors.push('Bez výrazného vnitřního napětí');
  }
  return vectors;
};

export const scoreIkigaiQuadrants = (input: IkigaiScoringInput): IkigaiQuadrantScoresV1 => {
  const partial = {
    love_score: domainScore(input.love),
    strength_score: domainScore(input.strength),
    need_score: domainScore(input.need),
    reward_score: domainScore(input.reward),
  };

  const minScore = Math.min(partial.love_score, partial.strength_score, partial.need_score, partial.reward_score);
  const harmonicDenominator =
    (1 / Math.max(partial.love_score, 1)) +
    (1 / Math.max(partial.strength_score, 1)) +
    (1 / Math.max(partial.need_score, 1)) +
    (1 / Math.max(partial.reward_score, 1));
  const harmonic = Math.round(4 / harmonicDenominator);

  const ikigai_core_score = Math.round(clamp(harmonic * 0.7 + minScore * 0.3, 0, 100));
  const tension_vectors = resolveTensionVectors(partial);

  return {
    ...partial,
    ikigai_core_score,
    tension_vectors,
  };
};

export const buildIkigaiRecommendations = (scores: IkigaiQuadrantScoresV1): string[] => {
  const recs: string[] = [];
  if (scores.ikigai_core_score >= 75) {
    recs.push('Tvůj profil je dobře sladěný. Upřednostni role s širší odpovědností a mentoringovým přesahem.');
  }
  if (scores.love_score < 55) {
    recs.push('Zvyš podíl činností, které tě nabíjí, aby byla udržitelná dlouhodobá motivace.');
  }
  if (scores.strength_score < 55) {
    recs.push('Posil důkazy své odbornosti skrze jeden vlajkový projekt a viditelné výsledky.');
  }
  if (scores.need_score < 55) {
    recs.push('Zaměř se na týmy, kde je jasně vidět dopad tvé práce na uživatele, produkt nebo společnost.');
  }
  if (scores.reward_score < 55) {
    recs.push('Přepiš svou hodnotu do jazyka trhu: vzácnost, výsledky a byznysový dopad.');
  }
  if (recs.length === 0) {
    recs.push('Drž současný směr a IKIGAI mapu si zreviduj každých 6-8 týdnů.');
  }
  return recs.slice(0, 4);
};
