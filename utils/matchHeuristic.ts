const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export type MatchHeuristicResult = {
  matchScore: number;
  reasons: string[];
};

const stripAccents = (value: string): string => {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
};

const STOP_WORDS = new Set(
  [
    // CS
    'jsem', 'jsme', 'bude', 'budeš', 'budete', 'být', 'byt', 'mám', 'mas', 'má', 'ma', 'mit', 'mít',
    'pro', 'na', 'do', 'od', 'a', 'i', 'že', 'se', 'si', 's', 'z', 'ze', 'k', 'ke', 'v', 've',
    'co', 'jak', 'kdy', 'kde', 'tady', 'tam', 'ten', 'tento', 'tahle', 'tato', 'to', 'tak', 'pak',
    'práce', 'praci', 'pozice', 'role', 'nabídka', 'nabidka', 'firma', 'společnost', 'spolecnost',
    // EN
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'you', 'your', 'are', 'will', 'have', 'has',
    'our', 'we', 'they', 'them', 'their', 'job', 'role', 'position', 'company', 'candidate'
  ].map((w) => stripAccents(w.toLowerCase()))
);

const tokenize = (text: string): string[] => {
  const normalized = stripAccents(String(text || '').toLowerCase());
  const tokens = normalized
    .split(/[^a-z0-9+#.]+/i)
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length >= 3)
    .filter((t) => !STOP_WORDS.has(t));
  return Array.from(new Set(tokens));
};

export const matchHeuristic = (userText: string, jobText: string): MatchHeuristicResult => {
  const u = tokenize(userText);
  const j = tokenize(jobText);
  if (u.length === 0 || j.length === 0) {
    return { matchScore: 0, reasons: [] };
  }

  const uSet = new Set(u);
  const jSet = new Set(j);
  const overlap: string[] = [];
  for (const tok of uSet) {
    if (jSet.has(tok)) overlap.push(tok);
  }

  const denom = Math.max(6, Math.min(u.length, j.length));
  const score = clamp(Math.round((overlap.length / denom) * 100));

  const reasons: string[] = [];
  if (overlap.length > 0) {
    reasons.push(`Shoda v: ${overlap.slice(0, 4).join(', ')}`);
  }

  const missingFromUser = j.filter((tok) => !uSet.has(tok));
  if (missingFromUser.length > 0) {
    reasons.push(`Možná chybí: ${missingFromUser.slice(0, 4).join(', ')}`);
  }

  return { matchScore: score, reasons: reasons.slice(0, 2) };
};

