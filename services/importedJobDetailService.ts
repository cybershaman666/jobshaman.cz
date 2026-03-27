import type { Job } from '../types';

export interface ImportedJobInsideStory {
  companyContext: string;
  roleSnapshot: string;
  firstStep: string;
  risk: string;
  toneSignal: string;
  benefits: string[];
}

const COMPANY_CONTEXT_PATTERNS = [
  /\b(jsme|we are|wir sind|jesteśmy)\b/i,
  /\b(pomáháme|zajišťujeme|poskytujeme|spravujeme|umožňujeme|vyvíjíme|podporujeme|deliver|provide|manage|support|enable|operate|run)\b/i,
  /\b(majitelům|podnájemníkům|nájemníkům|zákazníkům|klientům|owners|tenants|customers|clients)\b/i,
  /\b(o nás|about us|our mission|naše mise)\b/i,
];

const TASK_PATTERNS = [
  /\b(koordin|plánov|organiz|hlídat|zajist|spravovat|vést|report|komunik|řešit|dodavatel|rekonstruk|ticket|support|customer|project|manage|coordinate|lead|deliver|handle|resolve|process|operations?)\b/i,
];

const RISK_PATTERNS = [
  /\b(rizik|risk|probl[eé]m|issue|bottleneck|delay|zpožd|chaos|konflikt|nejist|escalat|complaint|error|failure|pressure|deadline|SLA|compliance|bezpečnost|safety)\b/i,
];

const normalizeText = (value?: string | null): string => (
  String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\r/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
);

const normalizeCompare = (value?: string | null): string => normalizeText(value).toLowerCase();

const clipText = (value: string, maxLength: number): string => {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
};

const splitSentences = (value?: string | null): string[] => (
  normalizeText(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
);

const isTooSimilar = (left: string, right: string): boolean => {
  const a = normalizeCompare(left);
  const b = normalizeCompare(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
};

const hasPattern = (value: string, patterns: RegExp[]): boolean => patterns.some((pattern) => pattern.test(value));

const pickFirstDistinctText = (
  candidates: Array<string | null | undefined>,
  used: string[] = [],
  options?: { minLength?: number; maxLength?: number }
): string => {
  const minLength = options?.minLength ?? 24;
  const maxLength = options?.maxLength ?? 220;
  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (!normalized || normalized.length < minLength) continue;
    if (used.some((existing) => isTooSimilar(normalized, existing))) continue;
    return clipText(normalized, maxLength);
  }
  return '';
};

const uniqueList = (items: Array<string | null | undefined>, limit = 6): string[] => {
  const output: string[] = [];
  for (const item of items) {
    const normalized = normalizeText(item);
    if (!normalized) continue;
    if (output.some((existing) => isTooSimilar(existing, normalized))) continue;
    output.push(normalized);
    if (output.length >= limit) break;
  }
  return output;
};

export const buildImportedJobInsideStory = (job: Job): ImportedJobInsideStory => {
  const description = normalizeText(job.description);
  const sentences = splitSentences(job.description);
  const companySentence = sentences.find((sentence) => hasPattern(sentence, COMPANY_CONTEXT_PATTERNS)) || '';
  const taskSentence = sentences.find((sentence) => hasPattern(sentence, TASK_PATTERNS) && !hasPattern(sentence, COMPANY_CONTEXT_PATTERNS))
    || sentences.find((sentence) => hasPattern(sentence, TASK_PATTERNS))
    || '';
  const riskSentence = sentences.find((sentence) => hasPattern(sentence, RISK_PATTERNS)) || '';
  const aiHiddenRisk = uniqueList(Array.isArray(job.aiAnalysis?.hiddenRisks) ? job.aiAnalysis.hiddenRisks : [], 1)[0] || '';

  const roleSnapshot = pickFirstDistinctText([
    job.aiAnalysis?.summary,
    hasPattern(String(job.challenge || ''), TASK_PATTERNS) ? job.challenge : '',
    taskSentence,
    job.companyPageSummary,
    description,
  ], [], { minLength: 28, maxLength: 200 });

  const companyContext = pickFirstDistinctText([
    job.companyProfile?.description,
    job.companyProfile?.philosophy,
    companySentence,
    hasPattern(String(job.companyPageSummary || ''), COMPANY_CONTEXT_PATTERNS) ? job.companyPageSummary : '',
    hasPattern(String(job.challenge || ''), COMPANY_CONTEXT_PATTERNS) ? job.challenge : '',
  ], [roleSnapshot], { minLength: 36, maxLength: 200 });

  const risk = pickFirstDistinctText([
    job.risk,
    aiHiddenRisk,
    riskSentence,
  ], [roleSnapshot, companyContext], { minLength: 24, maxLength: 200 });

  const firstStep = pickFirstDistinctText([
    job.firstStepPrompt,
  ], [roleSnapshot, companyContext, risk], { minLength: 20, maxLength: 220 });

  const toneSignal = pickFirstDistinctText([
    job.aiAnalysis?.culturalFit,
  ], [roleSnapshot, companyContext, risk], { minLength: 16, maxLength: 160 });

  return {
    companyContext,
    roleSnapshot,
    firstStep,
    risk,
    toneSignal,
    benefits: uniqueList(Array.isArray(job.benefits) ? job.benefits : [], 6),
  };
};
