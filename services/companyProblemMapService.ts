import type { Candidate, CompanyProfile, JobDraft } from '../types';

type LocaleKey = 'cs' | 'en';

type ProblemCategory =
  | 'operations'
  | 'hospitality'
  | 'support'
  | 'marketing'
  | 'sales'
  | 'finance'
  | 'general';

export interface CompanyProblemAmbientNode {
  id: string;
  label: string;
}

export interface CompanyProblemSummary {
  locale: LocaleKey;
  rawInput: string;
  normalizedInput: string;
  category: ProblemCategory;
  title: string;
  summary: string;
  candidatePreview: string;
  firstReplyPrompt: string;
  companyTruthHard: string;
  companyTruthFail: string;
  workModel: 'On-site' | 'Hybrid' | 'Remote';
  urgencyLabel: string;
  keywords: string[];
  fitSignals: string[];
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
  ambientNodes: CompanyProblemAmbientNode[];
}

export interface CompanyProblemCandidateMatch {
  candidate: Candidate;
  score: number;
  fitSignals: string[];
  caution: string | null;
  reactionPreview: string;
  evidenceLabel: string;
  matchedKeywords: string[];
}

const DEFAULT_PROBLEM_CS = 'Rozjet provoz ve dvou městech bez chaosu a bez ztráty kvality.';
const DEFAULT_PROBLEM_EN = 'Scale a multi-site operation without losing quality or speed.';

const STOP_WORDS = new Set([
  'a', 'aby', 'ale', 'an', 'and', 'bez', 'by', 'co', 'do', 'for', 'i', 'in', 'je', 'jsme', 'k', 'na',
  'ne', 'nebo', 'of', 'po', 'pro', 's', 'se', 'si', 'ta', 'tak', 'team', 'ten', 'the', 'to', 'u', 'v',
  've', 'we', 'with', 'z', 'za',
]);

const CATEGORY_KEYWORDS: Record<ProblemCategory, string[]> = {
  operations: ['process', 'system', 'workflow', 'operations', 'provoz', 'rekonstrukce', 'site', 'města', 'mesta', 'location', 'handoff', 'team', 'scale'],
  hospitality: ['hotel', 'hotels', 'hospitality', 'restaurant', 'restaurace', 'guest', 'host', 'front office', 'reception', 'recepce'],
  support: ['support', 'customer support', 'queue', 'tickets', 'sla', 'eskalace', 'helpdesk'],
  marketing: ['marketing', 'brand', 'campaign', 'content', 'trade marketing', 'launch', 'communication'],
  sales: ['sales', 'pipeline', 'lead', 'account', 'revenue'],
  finance: ['finance', 'banking', 'budget', 'controlling', 'cashflow'],
  general: [],
};

const PUBLIC_PREVIEW_CANDIDATES: Candidate[] = [
  {
    id: 'preview-ops-1',
    name: 'Matěj Hlaváč',
    role: 'Regional Operations Lead',
    experienceYears: 8,
    salaryExpectation: 0,
    skills: ['Operations', 'Process design', 'Multi-site coordination', 'Onboarding'],
    bio: 'Scaled field teams across multiple cities and rebuilt handoff rituals between operations and HQ.',
    flightRisk: 'Low',
    hasJcfpm: true,
    values: ['Ownership', 'Clarity', 'Tempo'],
  },
  {
    id: 'preview-hotel-1',
    name: 'Lucie Bártová',
    role: 'Hospitality Opening Manager',
    experienceYears: 6,
    salaryExpectation: 0,
    skills: ['Hotel operations', 'Openings', 'Guest experience', 'Scheduling'],
    bio: 'Opened new hospitality locations, stabilized shifts, and built standards for guest-facing teams.',
    flightRisk: 'Low',
    hasJcfpm: true,
    values: ['Service', 'Reliability', 'Calm under pressure'],
  },
  {
    id: 'preview-marketing-1',
    name: 'Nora Stein',
    role: 'Trade Marketing Specialist',
    experienceYears: 5,
    salaryExpectation: 0,
    skills: ['Campaign execution', 'Retail launch', 'Brand operations'],
    bio: 'Turns brand plans into local execution, field visibility, and operational launch readiness.',
    flightRisk: 'Medium',
    values: ['Craft', 'Coordination', 'Energy'],
  },
  {
    id: 'preview-banking-1',
    name: 'David Weber',
    role: 'Business Architect Banking',
    experienceYears: 11,
    salaryExpectation: 0,
    skills: ['Enterprise architecture', 'Banking transformation', 'Governance'],
    bio: 'Strong in strategy and operating model design, but works far from field execution.',
    flightRisk: 'Medium',
    values: ['Structure', 'Precision'],
  },
];

const normalizeLocale = (language?: string | null): LocaleKey => {
  const normalized = String(language || 'en').split('-')[0].toLowerCase();
  return normalized === 'cs' || normalized === 'sk' ? 'cs' : 'en';
};

const compact = (value: unknown): string => String(value || '').trim();

const toTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

const unique = <T,>(items: T[]): T[] => Array.from(new Set(items));

const includesKeyword = (text: string, keyword: string): boolean => {
  const normalizedText = text.toLowerCase();
  return normalizedText.includes(keyword.toLowerCase());
};

const detectCategory = (input: string): ProblemCategory => {
  const normalized = input.toLowerCase();
  const priority: Record<ProblemCategory, number> = {
    hospitality: 6,
    support: 5,
    marketing: 4,
    sales: 3,
    finance: 2,
    operations: 1,
    general: 0,
  };
  const ranked = (Object.keys(CATEGORY_KEYWORDS) as ProblemCategory[])
    .filter((key) => key !== 'general')
    .map((key) => ({
      key,
      score: CATEGORY_KEYWORDS[key].reduce((count, keyword) => count + (includesKeyword(normalized, keyword) ? 1 : 0), 0),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return priority[right.key] - priority[left.key];
    });
  return ranked[0]?.score > 0 ? ranked[0].key : 'general';
};

const deriveWorkModel = (input: string): 'On-site' | 'Hybrid' | 'Remote' => {
  const normalized = input.toLowerCase();
  if (/(remote|distributed|home office)/.test(normalized)) return 'Remote';
  if (/(onsite|on-site|field|ter[eé]n|site|pobo[cč]k|hotel|restaurant|provoz|sm[eě]n)/.test(normalized)) return 'On-site';
  return 'Hybrid';
};

const deriveKeywords = (input: string, category: ProblemCategory): string[] => {
  const tokens = toTokens(input);
  const categoryTokens = CATEGORY_KEYWORDS[category] || [];
  return unique([...tokens, ...categoryTokens]).slice(0, 12);
};

const makeAmbientNodes = (locale: LocaleKey, category: ProblemCategory): CompanyProblemAmbientNode[] => {
  const csNodes: Record<ProblemCategory, string[]> = {
    operations: ['Rozjet onboarding bez chaosu', 'Stabilizovat předávky směn', 'Postavit provoz pro více poboček', 'Zastavit ztráty mezi HQ a terénem'],
    hospitality: ['Rozjet hotelový provoz bez výpadků', 'Otevřít novou restauraci bez improvizace', 'Zvednout kvalitu hostovské zkušenosti', 'Srovnat směny a standardy'],
    support: ['Vyčistit support queue', 'Zastavit eskalace mezi týmy', 'Nastavit SLA bez přetížení', 'Zrychlit odpovědi bez ztráty kvality'],
    marketing: ['Rozjet lokální launch bez chaosu', 'Srovnat trade marketing v terénu', 'Změnit brand plán na reálné spuštění', 'Vyladit retail exekuci'],
    sales: ['Postavit sales rytmus pro nový trh', 'Zastavit chaos v pipeline', 'Zvednout kvalitu předání leadů', 'Rozšířit tým bez rozpadu procesu'],
    finance: ['Srovnat controlling v růstu', 'Zpřesnit cashflow disciplínu', 'Postavit finance pro expanzi', 'Včas vidět rizika v provozu'],
    general: ['Onboarding redesign', 'Scaling support', 'Field operations', 'Customer handoffs'],
  };
  const enNodes: Record<ProblemCategory, string[]> = {
    operations: ['Fix multi-site handoffs', 'Scale onboarding without chaos', 'Rebuild field execution rhythm', 'Connect HQ and ground reality'],
    hospitality: ['Stabilize hotel operations', 'Open new locations without improvisation', 'Upgrade guest experience execution', 'Align shifts and standards'],
    support: ['Clean up the support queue', 'Reduce escalations across teams', 'Set better SLA discipline', 'Improve response quality under load'],
    marketing: ['Launch locally without chaos', 'Turn brand plans into field execution', 'Stabilize trade marketing operations', 'Improve retail rollout quality'],
    sales: ['Build a new-market sales rhythm', 'Fix pipeline chaos', 'Improve lead handoff quality', 'Scale the team without breaking process'],
    finance: ['Build finance for expansion', 'Improve cashflow discipline', 'See operational risk earlier', 'Tighten controlling in growth'],
    general: ['Onboarding redesign', 'Scaling support', 'Field operations', 'Customer handoffs'],
  };
  const source = locale === 'cs' ? csNodes : enNodes;
  return source[category].map((label, index) => ({ id: `${category}-${index}`, label }));
};

const buildLocalizedText = (locale: LocaleKey, category: ProblemCategory, input: string) => {
  if (locale === 'cs') {
    const titleByCategory: Record<ProblemCategory, string> = {
      operations: 'Operations Builder',
      hospitality: 'Hospitality Operations Lead',
      support: 'Support Operations Lead',
      marketing: 'Trade Marketing & Execution Lead',
      sales: 'Commercial Operations Lead',
      finance: 'Finance Operations Lead',
      general: 'Problem-Solving Operator',
    };
    const summaryByCategory: Record<ProblemCategory, string> = {
      operations: 'Firma nehledá další ruce na úkoly. Hledá člověka, který srovná realitu mezi místy, nastaví rytmus a udělá z chaosu systém.',
      hospitality: 'Tahle role stojí na provozu, hostovské zkušenosti a schopnosti přenést standard do reálného dne. Potřebujete někoho, kdo zvládá terén, ne jen prezentaci.',
      support: 'Jde o provozní kvalitu pod tlakem. Klíčové je srovnat fronty, eskalace a odpovědnost mezi týmy tak, aby podpora znovu fungovala spolehlivě.',
      marketing: 'Nejde o krásný deck. Jde o člověka, který přenese strategii do poboček, kampaní a viditelné exekuce bez chaosu mezi týmy.',
      sales: 'Firma potřebuje srovnat rytmus, předání a exekuci. Hledá se někdo, kdo spojí obchodní tlak s fungujícím systémem.',
      finance: 'Tahle role musí přinést disciplínu, čitelnost a lepší rozhodování v růstu. Potřebujete člověka, který umí držet realitu i detail.',
      general: 'Nezadáváte pozici. Popisujete realitu, která se musí přestat rozpadat mezi týmy, prioritami a provozem.',
    };
    return {
      title: titleByCategory[category],
      summary: summaryByCategory[category],
      candidatePreview: `Když jsem si četl zadání „${input}“, první co bych udělal(a), je pojmenovat, kde dnes padá rytmus, předání a odpovědnost mezi lidmi.`,
      firstReplyPrompt: `Když si čtete zadání „${input}“, co vám dojde jako první a kde byste začal(a) během prvních 10 dnů?`,
      companyTruthHard: 'Nejtěžší nebude jednotlivý úkol. Těžké bude srovnat několik realit najednou, vytvořit jeden rytmus a udržet důvěru lidí i kvalitu provozu pod tlakem.',
      companyTruthFail: 'Obvykle tady selžou lidé, kteří zůstávají jen v prezentaci, neumí jít do provozní reality, nebo potřebují dlouho dokonalý brief místo rychlého záběru do neuklizené situace.',
      urgencyLabel: /urgent|hned|asap|rychle/.test(input.toLowerCase()) ? 'Vysoká urgence' : 'První challenge může začít hned',
      fitSignals: [
        'Potřebujete člověka, který vidí systém, ne jen úkol.',
        'Důležitá je schopnost držet tempo i realitu v terénu.',
        'Hledáme důkaz exekuce, ne jen hezké CV formulace.',
      ],
    };
  }
  const titleByCategory: Record<ProblemCategory, string> = {
    operations: 'Operations Builder',
    hospitality: 'Hospitality Operations Lead',
    support: 'Support Operations Lead',
    marketing: 'Trade Marketing & Execution Lead',
    sales: 'Commercial Operations Lead',
    finance: 'Finance Operations Lead',
    general: 'Problem-Solving Operator',
  };
  const summaryByCategory: Record<ProblemCategory, string> = {
    operations: 'This company does not need another task-taker. It needs someone who can align real operating conditions across places, people, and pressure.',
    hospitality: 'This role lives in operations, guest reality, and standards that survive the actual day. You need someone who can handle the field, not just presentation.',
    support: 'This is about operational quality under pressure. The core problem is queue discipline, escalation flow, and team ownership.',
    marketing: 'This is not about decks. It is about turning strategy into local execution, launches, and visible operational quality.',
    sales: 'The company needs a steadier rhythm, better handoffs, and clearer commercial execution. This role sits between pressure and system.',
    finance: 'This role needs to bring discipline, visibility, and stronger decisions during growth. It requires someone who can hold reality and detail at the same time.',
    general: 'You are not naming a position. You are describing a reality that needs a stronger operator and a cleaner system.',
  };
  return {
    title: titleByCategory[category],
    summary: summaryByCategory[category],
    candidatePreview: `When I read “${input}”, my first instinct is to map where rhythm, ownership, and execution break down before adding more activity.`,
    firstReplyPrompt: `When you read “${input}”, what would you tackle first and what would you deliberately not fix in the first 10 days?`,
    companyTruthHard: 'The hard part will not be one task. The hard part is aligning multiple realities at once, creating one operating rhythm, and protecting quality under pressure.',
    companyTruthFail: 'People usually fail here when they stay in presentation mode, avoid messy operating reality, or need a perfect brief before they can move.',
    urgencyLabel: /urgent|asap|immediately/.test(input.toLowerCase()) ? 'High urgency' : 'First challenge can open now',
    fitSignals: [
      'You need someone who sees the system, not just the task list.',
      'Field reality and execution discipline matter more than polished language.',
      'The right person should show operating judgment early.',
    ],
  };
};

export const buildCompanyProblemSummary = (
  input: string,
  options?: {
    language?: string | null;
    companyProfile?: Partial<CompanyProfile> | null;
  },
): CompanyProblemSummary => {
  const locale = normalizeLocale(options?.language);
  const normalizedInput = compact(input) || (locale === 'cs' ? DEFAULT_PROBLEM_CS : DEFAULT_PROBLEM_EN);
  const category = detectCategory(normalizedInput);
  const localized = buildLocalizedText(locale, category, normalizedInput);
  const keywords = deriveKeywords(normalizedInput, category);

  return {
    locale,
    rawInput: input,
    normalizedInput,
    category,
    title: localized.title,
    summary: localized.summary,
    candidatePreview: localized.candidatePreview,
    firstReplyPrompt: localized.firstReplyPrompt,
    companyTruthHard: localized.companyTruthHard,
    companyTruthFail: localized.companyTruthFail,
    workModel: deriveWorkModel(normalizedInput),
    urgencyLabel: localized.urgencyLabel,
    keywords,
    fitSignals: localized.fitSignals,
    responsibilities: [
      locale === 'cs' ? 'Srovnat realitu mezi týmy, místy a prioritami.' : 'Align reality across teams, places, and priorities.',
      locale === 'cs' ? 'Nastavit první provozní rytmus a jasné handoff body.' : 'Set the first operating rhythm and clear handoff points.',
      locale === 'cs' ? 'Odhalit, kde dnes vzniká ztráta kvality nebo času.' : 'Find where quality or time is currently leaking.',
    ],
    requirements: [
      locale === 'cs' ? 'Důkaz, že umíte převést chaos do systému.' : 'Evidence that you can turn chaos into a usable system.',
      locale === 'cs' ? 'Zkušenost s exekucí v reálném provozu, ne jen s návrhem.' : 'Experience with execution in live operations, not only design.',
      locale === 'cs' ? 'Schopnost držet prioritu, tempo a komunikaci zároveň.' : 'Ability to hold priorities, tempo, and communication at the same time.',
    ],
    niceToHave: [
      locale === 'cs' ? 'Zkušenost s více pobočkami nebo rychlým růstem.' : 'Experience with multi-site work or rapid growth.',
      locale === 'cs' ? 'Silná orientace v handoffech mezi HQ a terénem.' : 'Comfort with HQ-to-field handoffs.',
    ],
    ambientNodes: makeAmbientNodes(locale, category),
  };
};

const overlapScore = (keywords: string[], haystackTokens: string[]): { score: number; matched: string[] } => {
  const matched = keywords.filter((keyword) => haystackTokens.includes(keyword));
  return {
    score: Math.min(40, matched.length * 8),
    matched: matched.slice(0, 5),
  };
};

const buildCandidateHaystack = (candidate: Candidate): string[] =>
  unique(
    toTokens([
      candidate.role,
      candidate.bio,
      ...(candidate.skills || []),
      ...(candidate.values || []),
      ...(candidate.jcfpmComparisonSignals || []).map((signal) => signal.label),
    ].join(' ')),
  );

const buildReactionPreview = (locale: LocaleKey, candidate: Candidate): string => {
  const role = compact(candidate.role);
  if (locale === 'cs') {
    return `První dojem: ${candidate.name} nepůsobí jako člověk na izolovaný úkol. Spíš jako ${role || 'operátor'}, který by začal(a) srovnáním rytmu, priorit a reality mezi lidmi.`;
  }
  return `First impression: ${candidate.name} reads less like a task-taker and more like a ${role || 'builder'} who would start by aligning rhythm, priorities, and ground reality.`;
};

const buildEvidenceLabel = (locale: LocaleKey, candidate: Candidate): string => {
  if (candidate.hasJcfpm) return locale === 'cs' ? 'Silnější profilový signál' : 'Stronger profile signal';
  if ((candidate.skills || []).length >= 6) return locale === 'cs' ? 'Dobře čitelná zkušenost' : 'Readable experience signal';
  return locale === 'cs' ? 'Lehčí profil, ale použitelný' : 'Lighter profile, still usable';
};

export const rankCandidatesForCompanyProblem = (
  summary: CompanyProblemSummary,
  candidates: Candidate[],
): CompanyProblemCandidateMatch[] => {
  const locale = summary.locale;

  return candidates
    .map((candidate) => {
      const haystackTokens = buildCandidateHaystack(candidate);
      const overlap = overlapScore(summary.keywords, haystackTokens);
      const roleText = `${candidate.role} ${candidate.bio}`.toLowerCase();
      const operationsBias = /(lead|manager|supervisor|operations|provoz|site|hospitality|support|coordination|coordinator|opening)/i.test(roleText) ? 18 : 0;
      const executionBias = candidate.experienceYears >= 4 ? Math.min(16, 8 + candidate.experienceYears) : candidate.experienceYears * 2;
      const evidenceBias = (candidate.hasJcfpm ? 8 : 0) + Math.min(7, (candidate.skills || []).length);
      const valuesBias = Math.min(6, (candidate.values || []).length * 2);
      let penalty = 0;

      if (summary.category === 'hospitality' && /(banking|architect|enterprise architecture|finance)/i.test(roleText)) {
        penalty += 32;
      }
      if (summary.workModel === 'On-site' && /(remote|distributed|architect|consultant)/i.test(roleText) && !/(operations|hospitality|site|field)/i.test(roleText)) {
        penalty += 18;
      }
      if (summary.category === 'operations' && /(brand|copywriter|seo)/i.test(roleText)) {
        penalty += 18;
      }

      const score = Math.max(0, overlap.score + operationsBias + executionBias + evidenceBias + valuesBias - penalty);

      const fitSignals = unique([
        ...overlap.matched.map((keyword) => locale === 'cs' ? `Shoda na tématu: ${keyword}` : `Topic overlap: ${keyword}`),
        candidate.experienceYears >= 5
          ? (locale === 'cs' ? `${candidate.experienceYears} let praxe v exekuci` : `${candidate.experienceYears} years in execution-heavy work`)
          : '',
        candidate.hasJcfpm
          ? (locale === 'cs' ? 'Má sdílený hlubší profilový signál' : 'Has a deeper shared profile signal')
          : '',
      ].filter(Boolean)).slice(0, 3);

      const caution = penalty >= 28
        ? (locale === 'cs'
          ? 'Silný profil, ale pravděpodobně moc daleko od provozní reality tohoto problému.'
          : 'Strong profile, but probably too far from the operating reality of this problem.')
        : overlap.matched.length === 0
          ? (locale === 'cs'
            ? 'Profil působí obecněji a bude chtít rychlé ověření v detailu.'
            : 'This profile reads more generic and needs a quick reality check in detail.')
          : null;

      return {
        candidate,
        score,
        fitSignals,
        caution,
        reactionPreview: buildReactionPreview(locale, candidate),
        evidenceLabel: buildEvidenceLabel(locale, candidate),
        matchedKeywords: overlap.matched,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 24);
};

export const buildProblemDraftSeed = (
  summary: CompanyProblemSummary,
  companyProfile: Partial<CompanyProfile> | null | undefined,
  userEmail?: string,
): Partial<JobDraft> => {
  const locale = summary.locale;
  const summaryLead = locale === 'cs'
    ? `Hledáme člověka, který pomůže vyřešit situaci: ${summary.normalizedInput}`
    : `We are looking for someone who can help solve this situation: ${summary.normalizedInput}`;
  const teamIntro = companyProfile?.description
    ? String(companyProfile.description)
    : locale === 'cs'
      ? 'Tým potřebuje někoho, kdo rychle pochopí realitu a přinese klidnější systém.'
      : 'The team needs someone who can understand reality quickly and create a calmer system.';

  return {
    title: summary.title,
    role_summary: `${summaryLead}\n\n${summary.summary}`,
    team_intro: teamIntro,
    responsibilities: summary.responsibilities.join('\n'),
    requirements: summary.requirements.join('\n'),
    nice_to_have: summary.niceToHave.join('\n'),
    benefits_structured: [],
    work_model: summary.workModel,
    workplace_address: compact(companyProfile?.address || companyProfile?.legal_address),
    location_public: compact(companyProfile?.address || companyProfile?.legal_address),
    application_instructions: locale === 'cs'
      ? 'Odpovězte přímo na první krok v handshaku a popište, co byste řešil(a) jako první.'
      : 'Reply directly to the first handshake step and explain what you would tackle first.',
    contact_email: userEmail || '',
    company_goal: summary.summary,
    first_reply_prompt: summary.firstReplyPrompt,
    company_truth_hard: summary.companyTruthHard,
    company_truth_fail: summary.companyTruthFail,
    editor_state: {
      selected_section: 'role_summary',
      hiring_stage: 'drafting',
      handshake: {
        first_reply_prompt: summary.firstReplyPrompt,
        company_truth_hard: summary.companyTruthHard,
        company_truth_fail: summary.companyTruthFail,
        company_goal: summary.summary,
      },
    },
  } as Partial<JobDraft>;
};

export const getPublicProblemPreviewCandidates = (): Candidate[] => PUBLIC_PREVIEW_CANDIDATES;
