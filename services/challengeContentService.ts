type ChallengeSource = {
  title?: string | null;
  description?: string | null;
  source?: string | null;
  role_summary?: string | null;
  first_reply_prompt?: string | null;
  company_truth_hard?: string | null;
  company_truth_fail?: string | null;
};

export type ChallengeFields = {
  challenge: string;
  risk: string;
  firstStepPrompt: string;
  listingKind: 'challenge' | 'imported';
  companyPageSummary: string;
};

const normalizeText = (value?: string | null): string => {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
};

export const extractMarkdownSection = (description: string, headings: string[]): string => {
  const source = normalizeText(description);
  if (!source || headings.length === 0) return '';
  const normalizedHeadings = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(
    `^#{2,3}\\s*(?:${normalizedHeadings.join('|')})\\s*$\\n([\\s\\S]*?)(?=\\n#{2,3}\\s+|$)`,
    'im'
  );
  const match = description.match(pattern);
  if (!match?.[1]) return '';
  return normalizeText(
    match[1]
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/\n{2,}/g, '\n')
  );
};

const firstSentence = (value?: string | null): string => {
  const normalized = normalizeText(value);
  if (!normalized) return '';
  return normalized.split(/(?<=[.!?])\s+/)[0]?.trim() || normalized;
};

const trimToLength = (value: string, maxLength: number): string => {
  const normalized = normalizeText(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
};

const PROMOTIONAL_SENTENCE_PATTERNS = [
  /\b(stabiln[íy]|respektovan[ýy]|tradic[ei]|od roku|since \d{4}|established|leading|renowned|well[- ]known|dlouholetou tradic[íi]|výrobce|manufacturer|family[- ]owned|long[- ]standing)\b/i,
  /\b(jsme|we are|wir sind|jesteśmy)\b.{0,80}\b(společnost|company|firma|manufacturer|employer)\b/i,
  /\b(sídlíme|se sídlem|based in|headquartered|part of|součást[íi]|skupin[ay]|group|globáln|worldwide|ve více než|more than \d+ countries|po celém světě|customers? po celém světě|zákazníky po celém světě)\b/i
];

const RISK_SENTENCE_PATTERNS = [
  /\b(rizik|risk|problem|issue|bottleneck|delay|chaos|conflict|ambigu|uncertain|gap|escalat|complaint|error|failure|deadline|pressure|stuck|manual|mistake|overload)\b/i,
  /\b(zpožd|chaos|konflikt|nejist|úzké místo|úzke miesto|problem|problém|chyba|chyby|stres|tlak|nestíh|odpovědnost|reklamac|poruch|směnn|smenn|turnover)\b/i,
  /\b(bez|without|unless|if not|pokud|ak sa|když se)\b/i
];

const TASK_SENTENCE_PATTERNS = [
  /\b(zajist|zajišť|zodpov|odpovíd|veden|vést|vedeš|koordin|komunik|správ|zpracov|kontrol|podpor|obslu|péč|plánov|organiz|report|evidence|faktur|účetn|výrob|prodej|servis|team|customer|support|coordinate|manage|lead|handle|process|ensure|deliver|maintain|account|invoice|quality|orders?)\b/i
];

const isPromotionalSentence = (sentence: string): boolean =>
  PROMOTIONAL_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence));

const looksLikeRiskSentence = (sentence: string): boolean =>
  RISK_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence));

const looksLikeTaskSentence = (sentence: string): boolean =>
  TASK_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence));

const isCzechOrSlovakLike = (value: string): boolean =>
  /[ěščřžýáíéúůťďňľĺôä]/i.test(value) || /\b(když|pokud|firma|tým|pozor|práce|role|zkušen|dochádz|docház)\b/i.test(value);

const deriveGenericChallenge = (title: string, description: string): string => {
  const normalized = normalizeText(description);
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  const meaningfulSentences = sentences.filter((sentence) => !isPromotionalSentence(sentence));
  const taskSentence = meaningfulSentences.find((sentence) => looksLikeTaskSentence(sentence));

  if (taskSentence) {
    return trimToLength(taskSentence, 180);
  }

  const fallbackSentence = meaningfulSentences.find((sentence) => sentence.length > 40);
  if (fallbackSentence) {
    return trimToLength(fallbackSentence, 180);
  }

  if (isCzechOrSlovakLike(normalized)) {
    return `V roli ${title || 'této pozice'} bude potřeba rychle pochopit provoz, převzít odpovědnost za klíčové úkoly a udržet v nich pořádek.`;
  }
  return `The ${title || 'role'} needs someone who can quickly understand the day-to-day work, take ownership, and bring structure to it.`;
};

const deriveGenericRisk = (description: string): string => {
  const normalized = normalizeText(description);
  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  const meaningfulSentences = sentences.filter((sentence) => !isPromotionalSentence(sentence));
  const explicitRiskSentence = meaningfulSentences.find((sentence) => looksLikeRiskSentence(sentence));

  if (explicitRiskSentence) {
    return trimToLength(explicitRiskSentence, 180);
  }

  if (meaningfulSentences[0] && !isPromotionalSentence(meaningfulSentences[0])) {
    return isCzechOrSlovakLike(normalized)
      ? 'Když se role nechytí včas, začne se problém vracet v podobě zpoždění, improvizace nebo zbytečné zátěže pro tým.'
      : 'If the role does not settle in quickly, the problem keeps coming back through delays, improvisation, and extra strain on the team.';
  }
  if (sentences[0]) {
    return 'If the issue stays unresolved, the team keeps paying for coordination gaps and delayed decisions.';
  }
  return 'If the issue stays unresolved, the team keeps paying for coordination gaps and delayed decisions.';
};

const deriveGenericPrompt = (title: string, description: string): string => {
  if (isCzechOrSlovakLike(description)) {
    return `Jak bys v prvních dnech zjistil(a), kde má role "${title || 'tato pozice'}" největší praktický dopad, a čím bys začal(a)?`;
  }
  return `How would you find out in the first few days where the "${title || 'role'}" position has the biggest real impact, and what would you start with?`;
};

const isJobShamanSource = (source?: string | null): boolean => {
  const normalized = String(source || '').trim().toLowerCase();
  if (!normalized) return false;
  return normalized.includes('jobshaman');
};

export const deriveChallengeFields = (source: ChallengeSource): ChallengeFields => {
  const description = normalizeText(source.description);
  const explicitChallenge = normalizeText(
    source.company_truth_hard ||
      extractMarkdownSection(description, ['Company Truth: What Is Actually Hard?', 'Challenge', 'The Challenge'])
  );
  const explicitRisk = normalizeText(
    source.company_truth_fail ||
      extractMarkdownSection(description, ['Company Truth: Who Typically Struggles?', 'Risk', 'The Risk'])
  );
  const explicitPrompt = normalizeText(
    source.first_reply_prompt ||
      extractMarkdownSection(description, ['First Reply', 'First Step'])
  );
  const roleSummary = normalizeText(source.role_summary);
  const roleSummarySentence = firstSentence(roleSummary);
  const usableRoleSummary =
    roleSummarySentence && !isPromotionalSentence(roleSummarySentence) ? roleSummary : '';
  const challenge =
    explicitChallenge || usableRoleSummary || deriveGenericChallenge(String(source.title || 'role'), description);
  const risk = explicitRisk || deriveGenericRisk(description);
  const firstStepPrompt = explicitPrompt || deriveGenericPrompt(String(source.title || 'role'), description);
  const listingKind: 'challenge' | 'imported' =
    explicitChallenge || explicitRisk || explicitPrompt || isJobShamanSource(source.source)
      ? 'challenge'
      : 'imported';

  return {
    challenge,
    risk,
    firstStepPrompt,
    listingKind,
    companyPageSummary: trimToLength(usableRoleSummary || challenge, 180)
  };
};
