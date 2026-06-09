import ApiService from './apiService';
import type { MarketplaceFilters, RoleFamily } from '../rebuild/models';

export type SearchDifficulty = 'all' | 'low' | 'medium' | 'high';
export type SearchWorkArrangement = 'all' | 'remote' | 'hybrid' | 'onsite';

export interface ParsedSearchFilters {
  targetRole: string;
  city: string;
  roleFamily: RoleFamily | 'all';
  workArrangement: SearchWorkArrangement;
  remoteOnly: boolean;
  minSalary: number;
  difficulty: SearchDifficulty;
  benefits: string[];
  freeText: string;
  /** Where the parse came from: the AI model, the heuristic fallback, or empty. */
  source: 'ai' | 'heuristic' | 'empty' | 'client-fallback';
}

const ROLE_FAMILIES: RoleFamily[] = [
  'engineering', 'design', 'product', 'operations', 'sales', 'care', 'frontline',
  'marketing', 'finance', 'people', 'education', 'health', 'construction', 'logistics', 'legal',
];

const ROLE_FAMILY_KEYWORDS: Record<RoleFamily, string[]> = {
  engineering: ['engineer', 'developer', 'vyvojar', 'programator', 'software', 'backend', 'frontend', 'devops', 'fullstack'],
  design: ['design', 'designer', 'ux', 'ui', 'grafik'],
  product: ['product', 'produkt', 'product owner', 'product manager'],
  operations: ['operations', 'provoz', 'operacni'],
  sales: ['sales', 'obchod', 'obchodnik', 'account'],
  care: ['care', 'pece', 'pecovatel', 'socialni'],
  frontline: ['frontline', 'prodavac', 'sklad', 'operator', 'vyroba'],
  marketing: ['marketing', 'seo', 'ppc', 'social media', 'brand'],
  finance: ['finance', 'financ', 'ucetni', 'controller', 'controlling'],
  people: ['hr', 'people', 'recruiter', 'nabor'],
  education: ['education', 'vzdelav', 'ucitel', 'lektor', 'teacher'],
  health: ['health', 'zdrav', 'sestra', 'lekar', 'nurse', 'doctor'],
  construction: ['construction', 'stavba', 'stavebni', 'remeslo', 'zednik'],
  logistics: ['logistics', 'logistika', 'ridic', 'doprava', 'driver', 'warehouse'],
  legal: ['legal', 'pravo', 'pravnik', 'lawyer', 'advokat'],
};

const REMOTE_KEYWORDS = ['remote', 'na dalku', 'z domova', 'home office', 'fully remote'];
const HYBRID_KEYWORDS = ['hybrid', 'hybridni'];
const ONSITE_KEYWORDS = ['onsite', 'on-site', 'na miste', 'v kancelari'];

const DIFFICULTY_KEYWORDS: Record<Exclude<SearchDifficulty, 'all'>, string[]> = {
  low: ['junior', 'nizka', 'entry', 'zacatecnik'],
  medium: ['medior', 'mid', 'stredni'],
  high: ['senior', 'lead', 'vysoka', 'expert', 'principal', 'head of'],
};

const BENEFIT_KEYWORDS: Record<string, string[]> = {
  'Home office': ['home office', 'z domova'],
  'Služební auto': ['sluzebni auto', 'company car'],
  'Stravenky': ['stravenky', 'meal voucher'],
  'Multisport': ['multisport'],
  'Vzdělávání': ['vzdelavani', 'kurzy', 'training'],
  'Flexibilní směny': ['flexibilni', 'flexible hours'],
  'Příspěvek na dopravu': ['prispevek na dopravu', 'transport allowance'],
  '13. plat': ['13 plat', 'thirteenth salary'],
  'Zkrácený úvazek': ['zkraceny uvazek', 'part time', 'part-time'],
};

const CITY_CANONICAL: Record<string, string> = {
  prague: 'Praha', praha: 'Praha', praze: 'Praha',
  brno: 'Brno', brne: 'Brno',
  ostrava: 'Ostrava', ostrave: 'Ostrava',
  plzen: 'Plzeň', plzni: 'Plzeň', pilsen: 'Plzeň',
  liberec: 'Liberec', olomouc: 'Olomouc',
  bratislava: 'Bratislava', wien: 'Wien', vienna: 'Wien',
  berlin: 'Berlin', warsaw: 'Warszawa', warszawa: 'Warszawa',
};

const stripAccents = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalize = (value: unknown): string => stripAccents(String(value || '').toLowerCase()).trim();

const emptyFilters = (): ParsedSearchFilters => ({
  targetRole: '',
  city: '',
  roleFamily: 'all',
  workArrangement: 'all',
  remoteOnly: false,
  minSalary: 0,
  difficulty: 'all',
  benefits: [],
  freeText: '',
  source: 'empty',
});

const extractSalary = (normalized: string): number => {
  const kMatch = normalized.match(/(\d{2,3})\s*k\b/);
  if (kMatch) return Number(kMatch[1]) * 1000;
  const numMatch = normalized.match(/(\d{1,3}(?:[ .,]\d{3})+|\d{4,6})/);
  if (numMatch) {
    const value = Number(numMatch[1].replace(/[ .,]/g, ''));
    if (value >= 1000 && value <= 10_000_000) return value;
  }
  return 0;
};

/** Lightweight client-side parser used only if the backend call fails. */
export const heuristicParse = (query: string): ParsedSearchFilters => {
  const filters = emptyFilters();
  const normalized = normalize(query);
  if (!normalized) return filters;

  if (REMOTE_KEYWORDS.some((kw) => normalized.includes(kw))) {
    filters.remoteOnly = true;
    filters.workArrangement = 'remote';
  } else if (HYBRID_KEYWORDS.some((kw) => normalized.includes(kw))) {
    filters.workArrangement = 'hybrid';
  } else if (ONSITE_KEYWORDS.some((kw) => normalized.includes(kw))) {
    filters.workArrangement = 'onsite';
  }

  for (const family of ROLE_FAMILIES) {
    if (ROLE_FAMILY_KEYWORDS[family].some((kw) => normalized.includes(kw))) {
      filters.roleFamily = family;
      break;
    }
  }

  (Object.keys(DIFFICULTY_KEYWORDS) as Array<Exclude<SearchDifficulty, 'all'>>).forEach((level) => {
    if (filters.difficulty === 'all' && DIFFICULTY_KEYWORDS[level].some((kw) => normalized.includes(kw))) {
      filters.difficulty = level;
    }
  });

  filters.benefits = Object.keys(BENEFIT_KEYWORDS).filter((label) =>
    BENEFIT_KEYWORDS[label].some((kw) => normalized.includes(kw)),
  );

  for (const city of Object.keys(CITY_CANONICAL)) {
    if (new RegExp(`\\b${city}\\b`).test(normalized)) {
      filters.city = CITY_CANONICAL[city];
      break;
    }
  }

  filters.minSalary = extractSalary(normalized);
  filters.freeText = query.trim();
  filters.source = 'client-fallback';
  return filters;
};

const sanitize = (raw: Partial<ParsedSearchFilters> | undefined): ParsedSearchFilters => {
  const base = emptyFilters();
  if (!raw || typeof raw !== 'object') return base;
  const roleFamily = normalize(raw.roleFamily);
  const work = normalize(raw.workArrangement).replace('on-site', 'onsite').replace('on site', 'onsite');
  const difficulty = normalize(raw.difficulty);
  return {
    targetRole: String(raw.targetRole || '').slice(0, 120),
    city: String(raw.city || '').slice(0, 120),
    roleFamily: (ROLE_FAMILIES as string[]).includes(roleFamily) ? (roleFamily as RoleFamily) : 'all',
    workArrangement: (['all', 'remote', 'hybrid', 'onsite'].includes(work) ? work : 'all') as SearchWorkArrangement,
    remoteOnly: Boolean(raw.remoteOnly) || work === 'remote',
    minSalary: Math.max(0, Math.round(Number(raw.minSalary) || 0)),
    difficulty: (['all', 'low', 'medium', 'high'].includes(difficulty) ? difficulty : 'all') as SearchDifficulty,
    benefits: Array.isArray(raw.benefits) ? raw.benefits.map((b) => String(b)).filter(Boolean).slice(0, 8) : [],
    freeText: String(raw.freeText || '').slice(0, 200),
    source: (raw.source as ParsedSearchFilters['source']) || 'ai',
  };
};

/**
 * Parse a natural-language query into structured marketplace filters.
 * Calls the backend AI endpoint and falls back to a local heuristic parser
 * if the request fails (offline / unauthenticated / AI not configured).
 */
export const parseNaturalLanguageQuery = async (
  query: string,
  locale = 'cs',
): Promise<ParsedSearchFilters> => {
  const trimmed = String(query || '').trim();
  if (!trimmed) return emptyFilters();

  try {
    const response = await ApiService.post<{ status: string; filters: ParsedSearchFilters }>(
      '/jobs/search/parse',
      { query: trimmed, locale },
    );
    if (response && response.filters) {
      return sanitize(response.filters);
    }
    return heuristicParse(trimmed);
  } catch (error) {
    console.warn('AI search parse failed, using client heuristic fallback', error);
    return heuristicParse(trimmed);
  }
};

/** Merge parsed filters into the existing marketplace filter state. */
export const applyParsedFilters = (
  parsed: ParsedSearchFilters,
  current: MarketplaceFilters,
): MarketplaceFilters => {
  const next: MarketplaceFilters = { ...current };
  if (parsed.city) next.city = parsed.city;
  if (parsed.targetRole) next.targetRole = parsed.targetRole;
  if (parsed.roleFamily && parsed.roleFamily !== 'all') next.roleFamily = parsed.roleFamily;
  if (parsed.minSalary > 0) next.minSalary = parsed.minSalary;
  if (parsed.remoteOnly) {
    next.remoteOnly = true;
    next.workArrangement = 'remote';
  } else if (parsed.workArrangement && parsed.workArrangement !== 'all') {
    next.workArrangement = parsed.workArrangement as MarketplaceFilters['workArrangement'];
  }
  if (parsed.benefits.length > 0) {
    next.benefits = Array.from(new Set([...(current.benefits || []), ...parsed.benefits]));
  }
  return next;
};
