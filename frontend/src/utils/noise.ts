import { NoiseMetrics } from '../types';

export const estimateNoise = (description: string): NoiseMetrics => {
  const patterns = [
    // Czech/Slovak clichés
    { word: 'dynamické prostredie', score: 10 },
    { word: 'dynamické prostředí', score: 10 },
    { word: 'tah na branku', score: 10 },
    { word: 'rockstar', score: 10 },
    { word: 'ninja', score: 10 },
    { word: 'rodinná atmosféra', score: 10 },
    { word: 'stres', score: 10 },
    { word: 'presčasy', score: 10 },
    { word: 'přesčasy', score: 10 },
    // High-risk signals (multi-language)
    { word: 'provizní', score: 18 },
    { word: 'provize', score: 18 },
    { word: 'prowizja', score: 18 },
    { word: 'commission', score: 18 },
    { word: 'provision', score: 18 },
    { word: 'kommission', score: 18 },
    { word: 'neomezené provize', score: 20 },
    { word: 'nezastropované provize', score: 20 },
    { word: 'bez stropu', score: 16 },
    { word: 'no cap', score: 16 },
    { word: 'uncapped', score: 16 },
    { word: 'unlimited commission', score: 20 },
    { word: 'unlimited commissions', score: 20 },
    { word: 'nieograniczona prowizja', score: 20 },
    { word: 'nieograniczone prowizje', score: 20 },
    { word: 'unbegrenzte provision', score: 20 },
    { word: 'unbegrenzte provisionen', score: 20 },
    { word: 'finanční nezávislost', score: 16 },
    { word: 'financial independence', score: 16 },
    { word: 'finanzielle unabhängigkeit', score: 16 },
    { word: 'niezależność finansowa', score: 16 },
    { word: 'akvizice', score: 14 },
    { word: 'akwizycja', score: 14 },
    { word: 'acquisition', score: 14 },
    { word: 'neukunden', score: 12 },
    { word: 'nových klientů', score: 12 },
    { word: 'nowych klientów', score: 12 },
    { word: 'new clients', score: 12 },
    { word: 'cold calling', score: 16 },
    { word: 'cold calls', score: 16 },
    { word: 'telefonát', score: 12 },
    { word: 'telefonáty', score: 12 },
    { word: 'telefonate', score: 12 },
    { word: 'call center', score: 14 },
    { word: 'callcenter', score: 14 },
    { word: 'ičo', score: 12 },
    { word: 'b2b', score: 12 }
  ];

  let score = 0;
  const found: string[] = [];

  const descLower = (description || '').toLowerCase();
  patterns.forEach(({ word, score: weight }) => {
    if (descLower.includes(word)) {
      score += weight;
      found.push(word);
    }
  });

  const level: NoiseMetrics['level'] = score > 50 ? 'high' : score > 20 ? 'medium' : 'low';

  return {
    score: Math.min(score, 100),
    level,
    keywords: found,
    flags: found,
    tone: level === 'high' ? 'Hype-heavy' : 'Professional'
  };
};

