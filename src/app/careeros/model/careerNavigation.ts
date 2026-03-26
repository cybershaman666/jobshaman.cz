import type { CandidateDomainKey, CandidateSeniority, UserProfile } from '../../../../types';

export type CareerNavigationGoalStatus = 'resolved' | 'resolved_with_low_confidence' | 'needs_clarification';
export type CareerNavigationRouteStatus = 'ready' | 'weak' | 'needs_clarification';
export type CareerNavigationStepKind =
  | 'intent_clarify'
  | 'profile_fill'
  | 'skill_gap'
  | 'learning_step'
  | 'proof_step'
  | 'bridge_role'
  | 'target_role'
  | 'offer_activation';
export type CareerNavigationFriction = 'low' | 'medium' | 'high';
export type CareerNavigationCtaKind =
  | 'open_profile'
  | 'open_learning_path'
  | 'open_mini_challenges'
  | 'open_path'
  | 'open_offers';

type NavigationLocale = 'cs' | 'sk' | 'de' | 'pl' | 'en';

export interface CareerNavigationRoleOption {
  id: string;
  title: string;
  challengeIds: string[];
}

export interface CareerNavigationPathOption {
  id: string;
  title: string;
  summary: string;
  preview: string;
  primaryDomain: CandidateDomainKey | null;
  challengeIds: string[];
  x: number;
  y: number;
  roleOptions: CareerNavigationRoleOption[];
  topSkills: string[];
}

export interface CareerNavigationLearningSignal {
  currentRole: string;
  targetRole: string;
  targetDomainLabel: string;
  intentReady: boolean;
  skillDataReady: boolean;
  currentSkills: string[];
  targetSkills: string[];
  missingSkills: string[];
  hasResourceMatches: boolean;
}

export interface CareerNavigationMiniChallengeOption {
  id: string;
  title: string;
  summary: string;
}

export interface CareerNavigationGoalAlternative {
  id: string;
  label: string;
  targetRole: string;
  primaryDomain: CandidateDomainKey | null;
  confidence: number;
}

export interface CareerNavigationGoal {
  rawInput: string;
  normalizedInput: string;
  targetRole: string;
  primaryDomain: CandidateDomainKey | null;
  seniority: CandidateSeniority | null;
  workModeHint: 'remote' | 'hybrid' | 'onsite' | null;
  status: CareerNavigationGoalStatus;
  confidence: number;
  explanation: string;
  alternatives: CareerNavigationGoalAlternative[];
  usedAi: boolean;
}

export interface CareerNavigationWaypoint {
  id: string;
  kind: 'current' | 'bridge' | 'target';
  label: string;
  x: number;
  y: number;
  pathId: string | null;
  roleId: string | null;
}

export interface CareerNavigationStep {
  id: string;
  kind: CareerNavigationStepKind;
  title: string;
  body: string;
  etaLabel: string;
  confidence: number;
  friction: CareerNavigationFriction;
  ctaLabel: string;
  ctaTarget: {
    kind: CareerNavigationCtaKind;
    pathId?: string | null;
    roleId?: string | null;
  };
}

export interface CareerNavigationRoute {
  goal: CareerNavigationGoal;
  status: CareerNavigationRouteStatus;
  destinationLabel: string;
  summary: string;
  etaLabel: string;
  confidence: number;
  likelyFrictions: string[];
  missingSignalHint: string | null;
  waypoints: CareerNavigationWaypoint[];
  steps: CareerNavigationStep[];
  targetPathId: string | null;
  targetRoleId: string | null;
  bridgePathId: string | null;
}

export interface CareerNavigationGoalAiResult {
  targetRole?: string | null;
  primaryDomain?: CandidateDomainKey | null;
  seniority?: CandidateSeniority | null;
  workModeHint?: 'remote' | 'hybrid' | 'onsite' | null;
  confidence?: number | null;
  alternatives?: Array<{
    label?: string | null;
    targetRole?: string | null;
    primaryDomain?: CandidateDomainKey | null;
    confidence?: number | null;
  }> | null;
}

const domainAliases: Record<CandidateDomainKey, string[]> = {
  agriculture: ['agriculture', 'farming', 'farm', 'agro'],
  ai_data: ['ai', 'data', 'analytics', 'machine learning'],
  aviation: ['aviation', 'airport', 'flight', 'airline'],
  automotive: ['automotive', 'car', 'vehicle', 'autoservis'],
  construction: ['construction', 'builder', 'site manager', 'stavba'],
  creative_media: ['creative', 'media', 'content', 'video'],
  customer_support: ['customer support', 'customer success', 'helpdesk', 'support', 'service desk', 'client care'],
  ecommerce: ['ecommerce', 'e-commerce', 'eshop', 'shopify'],
  education: ['education', 'teacher', 'school', 'trainer'],
  energy_utilities: ['energy', 'utilities', 'power', 'utility'],
  engineering: ['engineering', 'engineer', 'mechanical', 'electrical'],
  finance: ['finance', 'accounting', 'controller', 'accountant'],
  government_defense: ['government', 'public administration', 'defense', 'army'],
  healthcare: ['healthcare', 'nurse', 'doctor', 'clinic', 'hospital'],
  hospitality: ['hospitality', 'hotel', 'reception', 'front office', 'guest relations'],
  insurance: ['insurance', 'broker', 'claims'],
  it: ['it', 'software', 'developer', 'engineer', 'tech', 'frontend', 'backend'],
  logistics: ['logistics', 'supply chain', 'warehouse', 'dispatcher'],
  manufacturing: ['manufacturing', 'production', 'factory', 'cnc'],
  maritime: ['maritime', 'shipping', 'port', 'vessel'],
  marketing: ['marketing', 'brand', 'growth marketing', 'performance marketing'],
  media_design: ['design', 'ux', 'ui', 'graphic design'],
  mining_heavy_industry: ['mining', 'heavy industry', 'steel', 'industrial'],
  operations: ['operations', 'coordinator', 'office manager', 'project coordinator', 'process'],
  pharma_biotech: ['pharma', 'biotech', 'laboratory', 'clinical'],
  procurement: ['procurement', 'buyer', 'sourcing', 'purchasing'],
  product_management: ['product', 'product manager', 'product owner'],
  public_services: ['public services', 'municipal', 'social services'],
  real_estate: ['real estate', 'property', 'leasing'],
  retail: ['retail', 'store', 'shop assistant', 'merchandising'],
  sales: ['sales', 'account executive', 'business development', 'commercial'],
  science_lab: ['science', 'lab', 'research', 'scientist'],
  security: ['security', 'guard', 'cybersecurity', 'soc'],
  telecom_network: ['telecom', 'network', 'fiber', 'mobile network'],
};

const normalizeLocale = (locale?: string): NavigationLocale => {
  const base = String(locale || 'en').split('-')[0].toLowerCase();
  if (base === 'cs' || base === 'sk' || base === 'de' || base === 'pl') return base;
  return 'en';
};

const localeText = (locale: NavigationLocale, copy: Record<NavigationLocale, string>): string => copy[locale];

const normalizeText = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s/+.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const uniqueStrings = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text) return;
    const key = normalizeText(text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(text);
  });
  return out;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const destinationSegment = (value: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const separators = ['->', '→', '=>'];
  for (const separator of separators) {
    if (raw.includes(separator)) {
      const parts = raw.split(separator).map((item) => item.trim()).filter(Boolean);
      return parts[parts.length - 1] || raw;
    }
  }
  return raw;
};

const isVagueGoal = (value: string): boolean => {
  const normalized = normalizeText(value);
  if (!normalized) return true;
  return [
    'better job',
    'better role',
    'new job',
    'something better',
    'something new',
    'i dont know',
    'nevim',
    'nejaka zmena',
    'change',
    'career growth',
  ].includes(normalized);
};

const inferWorkModeHint = (value: string): CareerNavigationGoal['workModeHint'] => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/\b(remote|fully remote|work from home)\b/.test(normalized)) return 'remote';
  if (/\b(hybrid)\b/.test(normalized)) return 'hybrid';
  if (/\b(on site|onsite|office|site based)\b/.test(normalized)) return 'onsite';
  return null;
};

const inferSeniority = (value: string): CandidateSeniority | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (/\b(lead|head|manager|director|principal)\b/.test(normalized)) return 'lead';
  if (/\b(senior|staff|expert)\b/.test(normalized)) return 'senior';
  if (/\b(mid|medior|intermediate)\b/.test(normalized)) return 'medior';
  if (/\b(junior|associate)\b/.test(normalized)) return 'junior';
  if (/\b(entry|intern|trainee|graduate)\b/.test(normalized)) return 'entry';
  return null;
};

const matchCount = (haystack: string, needle: string): number => {
  const normalizedHaystack = normalizeText(haystack);
  const normalizedNeedle = normalizeText(needle);
  if (!normalizedHaystack || !normalizedNeedle) return 0;
  if (normalizedHaystack.includes(normalizedNeedle)) return 6;
  return normalizedNeedle
    .split(' ')
    .filter((token) => token.length >= 3)
    .reduce((sum, token) => sum + (normalizedHaystack.includes(token) ? 2 : 0), 0);
};

const inferDomainFromGoal = (goalText: string): CandidateDomainKey | null => {
  const normalized = normalizeText(goalText);
  if (!normalized) return null;
  let best: { domain: CandidateDomainKey | null; score: number } = { domain: null, score: 0 };
  (Object.keys(domainAliases) as CandidateDomainKey[]).forEach((domain) => {
    const score = domainAliases[domain].reduce((sum, alias) => sum + matchCount(normalized, alias), 0);
    if (score > best.score) {
      best = { domain, score };
    }
  });
  return best.score >= 4 ? best.domain : null;
};

const resolveProfileIntent = (profile: UserProfile): {
  primaryDomain: CandidateDomainKey | null;
  secondaryDomains: CandidateDomainKey[];
  targetRole: string;
  seniority: CandidateSeniority | null;
} => {
  const searchProfile = profile.preferences?.searchProfile;
  const currentRole = String(
    searchProfile?.targetRole
      || profile.preferences?.desired_role
      || profile.jobTitle
      || profile.workHistory?.find((item) => String(item?.role || '').trim())?.role
      || '',
  ).trim();
  const inferredPrimaryDomain =
    searchProfile?.primaryDomain
    || searchProfile?.inferredPrimaryDomain
    || inferDomainFromGoal([
      currentRole,
      ...(profile.skills || []),
      ...(profile.inferredSkills || []),
      ...(profile.workHistory || []).flatMap((item) => [item.role, item.description]),
    ].filter(Boolean).join(' '));

  return {
    primaryDomain: inferredPrimaryDomain,
    secondaryDomains: Array.isArray(searchProfile?.secondaryDomains) ? searchProfile.secondaryDomains.slice(0, 3) : [],
    targetRole: currentRole,
    seniority:
      searchProfile?.seniority
      || inferSeniority([
        currentRole,
        profile.cvAiText,
        profile.cvText,
        profile.story,
      ].filter(Boolean).join(' ')),
  };
};

const cleanRoleLabel = (value: string): string => {
  const role = destinationSegment(value)
    .replace(/\b(remote|hybrid|onsite|on site)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return role || String(value || '').trim();
};

const rankPathOptions = (
  input: string,
  pathOptions: CareerNavigationPathOption[],
  preferredDomain: CandidateDomainKey | null,
): Array<{ path: CareerNavigationPathOption; role: CareerNavigationRoleOption | null; score: number }> => {
  const normalizedInput = normalizeText(input);
  return pathOptions
    .map((path) => {
      const pathScore = matchCount([path.title, path.summary, path.preview].join(' '), normalizedInput);
      const rankedRoles = path.roleOptions
        .map((role) => ({ role, score: matchCount(role.title, normalizedInput) }))
        .sort((left, right) => right.score - left.score);
      const roleScore = rankedRoles[0]?.score || 0;
      const domainScore = preferredDomain && path.primaryDomain === preferredDomain ? 8 : 0;
      const score = pathScore + roleScore + domainScore + Math.min(6, path.challengeIds.length);
      return { path, role: rankedRoles[0]?.role || null, score };
    })
    .sort((left, right) => right.score - left.score);
};

const formatConfidenceLabel = (locale: NavigationLocale, confidence: number): string => {
  if (confidence >= 80) {
    return localeText(locale, {
      cs: 'Silná cesta',
      sk: 'Silná cesta',
      de: 'Starke Route',
      pl: 'Mocna ścieżka',
      en: 'Strong route',
    });
  }
  if (confidence >= 62) {
    return localeText(locale, {
      cs: 'Realistická cesta',
      sk: 'Realistická cesta',
      de: 'Realistische Route',
      pl: 'Realistyczna ścieżka',
      en: 'Realistic route',
    });
  }
  return localeText(locale, {
    cs: 'Potřebuje víc signálu',
    sk: 'Potrebuje viac signálu',
    de: 'Braucht mehr Signal',
    pl: 'Potrzebuje więcej sygnału',
    en: 'Needs more signal',
  });
};

const formatEta = (locale: NavigationLocale, stepCount: number, missingSkillCount: number): string => {
  if (missingSkillCount >= 4 || stepCount >= 6) {
    return localeText(locale, {
      cs: '2-4 měsíce',
      sk: '2-4 mesiace',
      de: '2-4 Monate',
      pl: '2-4 miesiące',
      en: '2-4 months',
    });
  }
  if (missingSkillCount >= 2 || stepCount >= 4) {
    return localeText(locale, {
      cs: '4-8 týdnů',
      sk: '4-8 týždňov',
      de: '4-8 Wochen',
      pl: '4-8 tygodni',
      en: '4-8 weeks',
    });
  }
  return localeText(locale, {
    cs: '1-3 týdny',
    sk: '1-3 týždne',
    de: '1-3 Wochen',
    pl: '1-3 tygodnie',
    en: '1-3 weeks',
  });
};

export const inferCareerNavigationGoal = (input: {
  goalText: string;
  userProfile: UserProfile;
  pathOptions: CareerNavigationPathOption[];
  locale?: string;
}): CareerNavigationGoal => {
  const locale = normalizeLocale(input.locale);
  const rawInput = String(input.goalText || '').trim();
  const normalizedInput = normalizeText(rawInput);
  const cleanedRole = cleanRoleLabel(rawInput);

  if (!rawInput || isVagueGoal(rawInput)) {
    const fallbackAlternatives = rankPathOptions(
      String(input.userProfile.preferences?.searchProfile?.targetRole || input.userProfile.preferences?.desired_role || input.userProfile.jobTitle || ''),
      input.pathOptions,
      null,
    ).slice(0, 3);

    return {
      rawInput,
      normalizedInput,
      targetRole: '',
      primaryDomain: null,
      seniority: null,
      workModeHint: null,
      status: 'needs_clarification',
      confidence: 26,
      explanation: localeText(locale, {
        cs: 'Cíl je zatím příliš obecný. Vyberte konkrétnější roli nebo směr.',
        sk: 'Cieľ je zatiaľ príliš všeobecný. Vyberte konkrétnejšiu rolu alebo smer.',
        de: 'Das Ziel ist noch zu allgemein. Wählen Sie eine konkretere Rolle oder Richtung.',
        pl: 'Cel jest na razie zbyt ogólny. Wybierz bardziej konkretną rolę lub kierunek.',
        en: 'The goal is still too vague. Choose a more concrete role or direction.',
      }),
      alternatives: fallbackAlternatives.map((item, index) => ({
        id: `fallback-${index}`,
        label: item.path.title,
        targetRole: item.role?.title || item.path.title,
        primaryDomain: item.path.primaryDomain,
        confidence: clamp(56 + item.score, 40, 88),
      })),
      usedAi: false,
    };
  }

  const syntheticProfile: UserProfile = {
    ...input.userProfile,
    preferences: {
      ...input.userProfile.preferences,
      desired_role: cleanedRole,
      searchProfile: {
        ...(input.userProfile.preferences?.searchProfile || {
          nearBorder: false,
          dogCount: 0,
          wantsContractorRoles: false,
          wantsDogFriendlyOffice: false,
          wantsRemoteRoles: false,
          remoteLanguageCodes: [],
          preferredBenefitKeys: [],
          defaultEnableCommuteFilter: false,
          defaultMaxDistanceKm: 30,
        }),
        targetRole: cleanedRole,
        inferredTargetRole: cleanedRole,
      },
    },
  };

  const inferredIntent = resolveProfileIntent(syntheticProfile);
  const explicitDomain = inferDomainFromGoal(cleanedRole);
  const rankedPaths = rankPathOptions(cleanedRole, input.pathOptions, explicitDomain || inferredIntent.primaryDomain || null);
  const topPath = rankedPaths[0] || null;
  const inferredDomain = explicitDomain || inferredIntent.primaryDomain || topPath?.path.primaryDomain || null;
  const inferredRole = cleanedRole || topPath?.role?.title || topPath?.path.title || inferredIntent.targetRole;

  let confidence = 46;
  if (cleanedRole.split(/\s+/).length >= 2) confidence += 12;
  if (inferredDomain) confidence += 12;
  if (topPath) confidence += Math.min(24, topPath.score);
  if (topPath?.role && normalizeText(topPath.role.title) === normalizeText(cleanedRole)) confidence += 8;
  confidence = clamp(confidence, 24, 94);

  const status: CareerNavigationGoalStatus =
    confidence >= 74
      ? 'resolved'
      : confidence >= 48
        ? 'resolved_with_low_confidence'
        : 'needs_clarification';

  const alternatives = rankedPaths
    .filter((item) => item.score > 0)
    .slice(0, 3)
    .map((item, index) => ({
      id: `alt-${index}`,
      label: item.role?.title || item.path.title,
      targetRole: item.role?.title || item.path.title,
      primaryDomain: item.path.primaryDomain,
      confidence: clamp(48 + item.score, 40, 90),
    }));

  return {
    rawInput,
    normalizedInput,
    targetRole: inferredRole,
    primaryDomain: inferredDomain,
    seniority: inferSeniority(cleanedRole) || inferredIntent.seniority || null,
    workModeHint: inferWorkModeHint(rawInput),
    status,
    confidence,
    explanation:
      status === 'resolved'
        ? localeText(locale, {
            cs: 'Cíl je dost konkrétní na sestavení realistické trasy.',
            sk: 'Cieľ je dosť konkrétny na zostavenie realistickej trasy.',
            de: 'Das Ziel ist konkret genug für eine realistische Route.',
            pl: 'Cel jest wystarczająco konkretny, aby ułożyć realistyczną trasę.',
            en: 'The goal is specific enough to build a realistic route.',
          })
        : status === 'resolved_with_low_confidence'
          ? localeText(locale, {
              cs: 'Máme použitelný směr, ale některé kroky budou zatím orientační.',
              sk: 'Máme použiteľný smer, ale niektoré kroky budú zatiaľ orientačné.',
              de: 'Wir haben eine brauchbare Richtung, aber einige Schritte bleiben vorerst nur Richtwerte.',
              pl: 'Mamy użyteczny kierunek, ale część kroków będzie na razie orientacyjna.',
              en: 'We have a usable direction, but some steps are still provisional.',
            })
          : localeText(locale, {
              cs: 'Tady je nejbližší realistický směr, ale pomůže upřesnit cíl.',
              sk: 'Tu je najbližší realistický smer, ale pomôže cieľ ešte spresniť.',
              de: 'Das ist die nächstliegende realistische Richtung, aber eine Präzisierung hilft.',
              pl: 'To najbliższy realistyczny kierunek, ale warto jeszcze doprecyzować cel.',
              en: 'This is the closest realistic direction, but the goal still needs clarification.',
            }),
    alternatives,
    usedAi: false,
  };
};

export const mergeCareerNavigationGoalWithAi = (input: {
  baseGoal: CareerNavigationGoal;
  aiResult: CareerNavigationGoalAiResult;
  pathOptions: CareerNavigationPathOption[];
  locale?: string;
}): CareerNavigationGoal => {
  const locale = normalizeLocale(input.locale);
  const nextTargetRole = cleanRoleLabel(String(input.aiResult.targetRole || input.baseGoal.targetRole || input.baseGoal.rawInput));
  const nextDomain = input.aiResult.primaryDomain ?? input.baseGoal.primaryDomain ?? inferDomainFromGoal(nextTargetRole);
  const merged = inferCareerNavigationGoal({
    goalText: nextTargetRole || input.baseGoal.rawInput,
    userProfile: {
      name: '',
      email: '',
      isLoggedIn: true,
      preferences: {
        searchProfile: {
          nearBorder: false,
          dogCount: 0,
          wantsContractorRoles: false,
          wantsDogFriendlyOffice: false,
          wantsRemoteRoles: false,
          remoteLanguageCodes: [],
          preferredBenefitKeys: [],
          defaultEnableCommuteFilter: false,
          defaultMaxDistanceKm: 30,
          primaryDomain: nextDomain ?? undefined,
          targetRole: nextTargetRole,
          seniority: input.aiResult.seniority ?? input.baseGoal.seniority ?? undefined,
        },
      },
    } as unknown as UserProfile,
    pathOptions: input.pathOptions,
    locale,
  });

  return {
    ...merged,
    rawInput: input.baseGoal.rawInput,
    normalizedInput: input.baseGoal.normalizedInput,
    primaryDomain: nextDomain ?? merged.primaryDomain,
    seniority: input.aiResult.seniority ?? merged.seniority,
    workModeHint: input.aiResult.workModeHint ?? input.baseGoal.workModeHint,
    confidence: clamp(
      Math.max(merged.confidence, Number(input.aiResult.confidence || 0) || input.baseGoal.confidence),
      24,
      96,
    ),
    alternatives:
      Array.isArray(input.aiResult.alternatives) && input.aiResult.alternatives.length > 0
        ? input.aiResult.alternatives
          .map((item, index) => ({
            id: `ai-alt-${index}`,
            label: String(item.label || item.targetRole || '').trim(),
            targetRole: String(item.targetRole || item.label || '').trim(),
            primaryDomain: item.primaryDomain ?? null,
            confidence: clamp(Number(item.confidence || 0) || 60, 40, 90),
          }))
          .filter((item) => item.label && item.targetRole)
          .slice(0, 3)
        : merged.alternatives,
    explanation: localeText(locale, {
      cs: 'Cíl jsme upřesnili a trasu jsme přepočítali podle konkrétnější interpretace.',
      sk: 'Cieľ sme spresnili a trasu sme prepočítali podľa konkrétnejšej interpretácie.',
      de: 'Das Ziel wurde präzisiert und die Route anhand der genaueren Interpretation neu berechnet.',
      pl: 'Cel został doprecyzowany, a trasa przeliczona według bardziej konkretnej interpretacji.',
      en: 'The goal was refined and the route was recalculated from a more specific interpretation.',
    }),
    usedAi: true,
  };
};

const buildStep = (
  locale: NavigationLocale,
  step: Omit<CareerNavigationStep, 'title' | 'body' | 'ctaLabel'> & { meta?: Record<string, string | number> },
): CareerNavigationStep => {
  const meta = step.meta || {};
  const templates: Record<CareerNavigationStepKind, Record<NavigationLocale, { title: string; body: string; cta: string }>> = {
    intent_clarify: {
      cs: {
        title: 'Upřesnit směr',
        body: `Nejbližší realistický cíl je ${meta.role || ''}. Ještě pomůže potvrdit, že míříte právě sem.`,
        cta: 'Upravit směr',
      },
      sk: {
        title: 'Spresniť smer',
        body: `Najbližší realistický cieľ je ${meta.role || ''}. Ešte pomôže potvrdiť, že mierite práve sem.`,
        cta: 'Upraviť smer',
      },
      de: {
        title: 'Richtung präzisieren',
        body: `Das nächstliegende realistische Ziel ist ${meta.role || ''}. Es hilft, dieses Ziel noch zu bestätigen.`,
        cta: 'Richtung bearbeiten',
      },
      pl: {
        title: 'Doprecyzować kierunek',
        body: `Najbliższy realistyczny cel to ${meta.role || ''}. Warto jeszcze potwierdzić, że właśnie tam chcesz dojść.`,
        cta: 'Edytuj kierunek',
      },
      en: {
        title: 'Clarify the direction',
        body: `The closest realistic target is ${meta.role || ''}. It still helps to confirm that this is really where you want to go.`,
        cta: 'Edit direction',
      },
    },
    profile_fill: {
      cs: {
        title: 'Doplnit profilový signál',
        body: 'Bez aktuální role, směru nebo dovedností bude navigace příliš odhadovat.',
        cta: 'Doplnit profil',
      },
      sk: {
        title: 'Doplniť profilový signál',
        body: 'Bez aktuálnej roly, smeru alebo zručností bude navigácia príliš odhadovať.',
        cta: 'Doplniť profil',
      },
      de: {
        title: 'Profilsignal ergänzen',
        body: 'Ohne aktuelle Rolle, Richtung oder Skills muss die Navigation zu viel raten.',
        cta: 'Profil ergänzen',
      },
      pl: {
        title: 'Uzupełnić sygnał profilowy',
        body: 'Bez aktualnej roli, kierunku lub umiejętności nawigacja będzie zbyt mocno zgadywać.',
        cta: 'Uzupełnij profil',
      },
      en: {
        title: 'Fill in profile signal',
        body: 'Without a current role, direction, or skills, the navigation has to guess too much.',
        cta: 'Complete profile',
      },
    },
    skill_gap: {
      cs: {
        title: 'Pojmenovat mezery',
        body: `Trh kolem cíle opakovaně chce ${meta.skills || ''}.`,
        cta: 'Otevřít learning path',
      },
      sk: {
        title: 'Pomenovať medzery',
        body: `Trh okolo cieľa opakovane chce ${meta.skills || ''}.`,
        cta: 'Otvoriť learning path',
      },
      de: {
        title: 'Lücken benennen',
        body: `Der Zielmarkt fragt wiederholt nach ${meta.skills || ''}.`,
        cta: 'Learning Path öffnen',
      },
      pl: {
        title: 'Nazwać luki',
        body: `Rynek wokół celu regularnie wymaga ${meta.skills || ''}.`,
        cta: 'Otwórz learning path',
      },
      en: {
        title: 'Name the gap',
        body: `The market around this target repeatedly asks for ${meta.skills || ''}.`,
        cta: 'Open learning path',
      },
    },
    learning_step: {
      cs: {
        title: 'Uzavřít nejbližší gap',
        body: 'Nejdřív má smysl zavřít menší počet konkrétních skill gapů, ne studovat všechno.',
        cta: 'Jít do learning path',
      },
      sk: {
        title: 'Uzavrieť najbližší gap',
        body: 'Najprv má zmysel zavrieť menší počet konkrétnych skill gapov, nie študovať všetko.',
        cta: 'Ísť do learning path',
      },
      de: {
        title: 'Nächste Lücke schließen',
        body: 'Am sinnvollsten ist es, zuerst wenige konkrete Skill-Gaps zu schließen statt alles gleichzeitig zu lernen.',
        cta: 'Zum Learning Path',
      },
      pl: {
        title: 'Domknąć najbliższą lukę',
        body: 'Najpierw warto domknąć kilka konkretnych braków zamiast uczyć się wszystkiego naraz.',
        cta: 'Przejdź do learning path',
      },
      en: {
        title: 'Close the nearest gap',
        body: 'It makes more sense to close a small set of concrete gaps than to study everything at once.',
        cta: 'Go to learning path',
      },
    },
    proof_step: {
      cs: {
        title: 'Ukázat důkaz v praxi',
        body: 'Krátká reálná spolupráce zrychlí přechod hlavně u adjacent move.',
        cta: 'Otevřít mini challenge',
      },
      sk: {
        title: 'Ukázať dôkaz v praxi',
        body: 'Krátka reálna spolupráca zrýchli prechod hlavne pri adjacent move.',
        cta: 'Otvoriť mini challenge',
      },
      de: {
        title: 'Praxisbeleg získat',
        body: 'Eine kurze reale Zusammenarbeit beschleunigt den Wechsel besonders bei einem angrenzenden Schritt.',
        cta: 'Mini Challenge öffnen',
      },
      pl: {
        title: 'Pokazać dowód w praktyce',
        body: 'Krótka realna współpraca przyspiesza zmianę szczególnie przy ruchu sąsiednim.',
        cta: 'Otwórz mini challenge',
      },
      en: {
        title: 'Show proof in practice',
        body: 'A short real collaboration speeds the move up, especially for an adjacent jump.',
        cta: 'Open mini challenge',
      },
    },
    bridge_role: {
      cs: {
        title: 'Přes mezistanici',
        body: `Nejsilnější přestupní bod je ${meta.role || ''}, protože drží část vašeho současného kontextu i cíle.`,
        cta: 'Otevřít mezistanici',
      },
      sk: {
        title: 'Cez medzistanicu',
        body: `Najsilnejší prestupný bod je ${meta.role || ''}, pretože drží časť vášho súčasného kontextu aj cieľa.`,
        cta: 'Otvoriť medzistanicu',
      },
      de: {
        title: 'Über eine Zwischenstation',
        body: `${meta.role || ''} ist der stärkste Übergangspunkt, weil er einen Teil Ihres heutigen Kontexts und des Ziels verbindet.`,
        cta: 'Zwischenstation öffnen',
      },
      pl: {
        title: 'Przez przystanek pośredni',
        body: `${meta.role || ''} to najmocniejszy punkt przejścia, bo łączy część obecnego kontekstu z celem.`,
        cta: 'Otwórz przystanek',
      },
      en: {
        title: 'Use a bridge step',
        body: `${meta.role || ''} is the strongest transition point because it keeps part of your current context while moving toward the target.`,
        cta: 'Open bridge step',
      },
    },
    target_role: {
      cs: {
        title: 'Zacílit cluster',
        body: `Nejbližší cílová vrstva je ${meta.role || ''}. Tady už se trasa láme do konkrétních nabídek.`,
        cta: 'Otevřít cílový směr',
      },
      sk: {
        title: 'Zamerať cluster',
        body: `Najbližšia cieľová vrstva je ${meta.role || ''}. Tu sa trasa láme do konkrétnych ponúk.`,
        cta: 'Otvoriť cieľový smer',
      },
      de: {
        title: 'Zielcluster ansteuern',
        body: `${meta.role || ''} ist die nächste Zielschicht. Ab hier geht die Route in konkrete Angebote über.`,
        cta: 'Zielrichtung öffnen',
      },
      pl: {
        title: 'Ustawić klaster docelowy',
        body: `${meta.role || ''} to najbliższa warstwa docelowa. Od tego miejsca trasa przechodzi do konkretnych ofert.`,
        cta: 'Otwórz kierunek docelowy',
      },
      en: {
        title: 'Aim at the target cluster',
        body: `${meta.role || ''} is the nearest target layer. From here the route turns into concrete opportunities.`,
        cta: 'Open target direction',
      },
    },
    offer_activation: {
      cs: {
        title: 'Otevřít konkrétní příležitosti',
        body: 'Jakmile je směr zacílený, další krok je jít do offer layer a otevírat relevantní handshaky.',
        cta: 'Otevřít nabídky',
      },
      sk: {
        title: 'Otvoriť konkrétne príležitosti',
        body: 'Keď je smer zameraný, ďalší krok je ísť do offer layer a otvárať relevantné handshaky.',
        cta: 'Otvoriť ponuky',
      },
      de: {
        title: 'Konkrete Chancen öffnen',
        body: 'Sobald die Richtung sitzt, geht der nächste Schritt in die Offer Layer und zu den relevanten Handshakes.',
        cta: 'Angebote öffnen',
      },
      pl: {
        title: 'Otworzyć konkretne szanse',
        body: 'Gdy kierunek jest już ustawiony, kolejnym krokiem jest wejście do warstwy ofert i otwieranie właściwych handshake’ów.',
        cta: 'Otwórz oferty',
      },
      en: {
        title: 'Open concrete opportunities',
        body: 'Once the direction is set, the next move is to enter the offer layer and open the relevant handshakes.',
        cta: 'Open offers',
      },
    },
  };

  const localized = templates[step.kind][locale];
  return {
    ...step,
    title: localized.title,
    body: localized.body,
    ctaLabel: localized.cta,
  };
};

const chooseBridgePath = (
  currentDomain: CandidateDomainKey | null,
  secondaryDomains: CandidateDomainKey[],
  targetPath: CareerNavigationPathOption | null,
  pathOptions: CareerNavigationPathOption[],
): CareerNavigationPathOption | null => {
  if (!targetPath) return null;
  const candidates = pathOptions
    .filter((path) => path.id !== targetPath.id)
    .map((path) => {
      let score = 0;
      if (path.primaryDomain && secondaryDomains.includes(path.primaryDomain)) score += 12;
      if (path.primaryDomain && path.primaryDomain === currentDomain) score += 8;
      if (path.primaryDomain && path.primaryDomain === targetPath.primaryDomain) score += 5;
      if (path.roleOptions.length > 1) score += 2;
      return { path, score };
    })
    .sort((left, right) => right.score - left.score);

  return candidates[0]?.score >= 8 ? candidates[0].path : null;
};

export const buildCareerNavigationRoute = (input: {
  goal: CareerNavigationGoal;
  userProfile: UserProfile;
  pathOptions: CareerNavigationPathOption[];
  learning: CareerNavigationLearningSignal;
  miniChallenges: CareerNavigationMiniChallengeOption[];
  useMarketPreferences: boolean;
  locale?: string;
}): CareerNavigationRoute => {
  const locale = normalizeLocale(input.locale);
  const intent = resolveProfileIntent(input.userProfile);
  const currentRole = String(input.userProfile.jobTitle || intent.targetRole || input.learning.currentRole || '').trim()
    || localeText(locale, {
      cs: 'Současný profil',
      sk: 'Súčasný profil',
      de: 'Aktuelles Profil',
      pl: 'Obecny profil',
      en: 'Current profile',
    });

  const pathRanking = rankPathOptions(
    input.goal.targetRole || input.goal.rawInput,
    input.pathOptions,
    input.useMarketPreferences ? (input.goal.primaryDomain || intent.primaryDomain) : input.goal.primaryDomain,
  );
  const targetMatch = pathRanking[0] || null;
  const targetPath = targetMatch?.path || null;
  const targetRole = targetMatch?.role || targetPath?.roleOptions[0] || null;

  const currentRanking = rankPathOptions(
    currentRole,
    input.pathOptions,
    intent.primaryDomain,
  );
  const currentPath = currentRanking[0]?.path || null;
  const directMove = Boolean(
    targetPath
    && (
      targetPath.id === currentPath?.id
      || (intent.primaryDomain && input.goal.primaryDomain && intent.primaryDomain === input.goal.primaryDomain)
      || (
        input.learning.missingSkills.length <= 1
        && input.goal.confidence >= 78
        && (!intent.primaryDomain || !input.goal.primaryDomain || intent.primaryDomain === input.goal.primaryDomain)
      )
    ),
  );
  const bridgePath = directMove
    ? null
    : chooseBridgePath(intent.primaryDomain, intent.secondaryDomains, targetPath, input.pathOptions);

  const likelyFrictions = uniqueStrings([
    input.goal.status !== 'resolved'
      ? localeText(locale, {
          cs: 'Cíl je potřeba ještě zpřesnit',
          sk: 'Cieľ je potrebné ešte spresniť',
          de: 'Das Ziel braucht noch mehr Präzisierung',
          pl: 'Cel trzeba jeszcze doprecyzować',
          en: 'The goal still needs clarification',
        })
      : '',
    input.learning.missingSkills.length > 0
      ? localeText(locale, {
          cs: `Chybí ${input.learning.missingSkills.slice(0, 2).join(', ')}`,
          sk: `Chýba ${input.learning.missingSkills.slice(0, 2).join(', ')}`,
          de: `Es fehlen ${input.learning.missingSkills.slice(0, 2).join(', ')}`,
          pl: `Brakuje ${input.learning.missingSkills.slice(0, 2).join(', ')}`,
          en: `Missing ${input.learning.missingSkills.slice(0, 2).join(', ')}`,
        })
      : '',
    !targetPath
      ? localeText(locale, {
          cs: 'V datech není silná cílová shoda',
          sk: 'V dátach nie je silná cieľová zhoda',
          de: 'In den Daten fehlt ein starkes Ziel-Match',
          pl: 'W danych brakuje mocnego dopasowania celu',
          en: 'There is no strong target match in the data',
        })
      : '',
    bridgePath
      ? localeText(locale, {
          cs: 'Přímý skok je slabší než přes mezistanici',
          sk: 'Priamy skok je slabší než cez medzistanicu',
          de: 'Ein direkter Sprung ist schwächer als über eine Zwischenstation',
          pl: 'Bezpośredni skok jest słabszy niż przejście przez przystanek pośredni',
          en: 'A direct jump is weaker than going through a bridge step',
        })
      : '',
  ]).slice(0, 3);

  const missingSignalHint =
    !input.learning.intentReady
      ? localeText(locale, {
          cs: 'Pomůže nastavit cílovou roli nebo obor v profilu.',
          sk: 'Pomôže nastaviť cieľovú rolu alebo obor v profile.',
          de: 'Hilfreich wäre eine Zielrolle oder Zielbranche im Profil.',
          pl: 'Pomocne będzie ustawienie roli docelowej lub branży w profilu.',
          en: 'Adding a target role or domain in the profile would help.',
        })
      : !input.learning.skillDataReady
        ? localeText(locale, {
            cs: 'Potřebujeme silnější skill signal z profilu nebo z trhu.',
            sk: 'Potrebujeme silnejší skill signál z profilu alebo z trhu.',
            de: 'Wir brauchen ein stärkeres Skill-Signal aus Profil oder Markt.',
            pl: 'Potrzebujemy mocniejszego sygnału kompetencyjnego z profilu lub rynku.',
            en: 'We need a stronger skill signal from the profile or market.',
          })
        : null;

  const baseConfidence = clamp(
    input.goal.confidence
      + (targetPath ? 10 : -14)
      + (directMove ? 10 : -4)
      - Math.min(16, input.learning.missingSkills.length * 3)
      - (input.learning.hasResourceMatches || input.learning.missingSkills.length === 0 ? 0 : 8),
    28,
    96,
  );

  const steps: CareerNavigationStep[] = [];
  if (input.goal.status === 'needs_clarification') {
    steps.push(buildStep(locale, {
      id: 'intent',
      kind: 'intent_clarify',
      etaLabel: localeText(locale, {
        cs: '5 minut',
        sk: '5 minút',
        de: '5 Minuten',
        pl: '5 minut',
        en: '5 minutes',
      }),
      confidence: 42,
      friction: 'high',
      ctaTarget: { kind: 'open_profile' },
      meta: { role: targetRole?.title || targetPath?.title || input.goal.targetRole || input.goal.rawInput },
    }));
  }

  const profileSignalCount = uniqueStrings([
    input.userProfile.jobTitle,
    ...(input.userProfile.skills || []),
    ...(input.userProfile.inferredSkills || []),
    ...(input.userProfile.workHistory || []).map((item) => item.role),
  ]).length;
  if (profileSignalCount < 4) {
    steps.push(buildStep(locale, {
      id: 'profile-fill',
      kind: 'profile_fill',
      etaLabel: localeText(locale, {
        cs: '10 minut',
        sk: '10 minút',
        de: '10 Minuten',
        pl: '10 minut',
        en: '10 minutes',
      }),
      confidence: 58,
      friction: 'medium',
      ctaTarget: { kind: 'open_profile' },
    }));
  }

  if (input.learning.missingSkills.length > 0) {
    steps.push(buildStep(locale, {
      id: 'skill-gap',
      kind: 'skill_gap',
      etaLabel: localeText(locale, {
        cs: 'Tento týden',
        sk: 'Tento týždeň',
        de: 'Diese Woche',
        pl: 'W tym tygodniu',
        en: 'This week',
      }),
      confidence: clamp(76 - input.learning.missingSkills.length * 4, 44, 82),
      friction: input.learning.missingSkills.length >= 4 ? 'high' : 'medium',
      ctaTarget: { kind: 'open_learning_path' },
      meta: { skills: input.learning.missingSkills.slice(0, 3).join(', ') },
    }));
  }

  if (input.learning.missingSkills.length > 0 && input.learning.hasResourceMatches) {
    steps.push(buildStep(locale, {
      id: 'learning',
      kind: 'learning_step',
      etaLabel: formatEta(locale, 3, input.learning.missingSkills.length),
      confidence: clamp(72 - input.learning.missingSkills.length * 3, 48, 84),
      friction: input.learning.missingSkills.length >= 4 ? 'high' : 'medium',
      ctaTarget: { kind: 'open_learning_path' },
    }));
  }

  if (!directMove && bridgePath) {
    steps.push(buildStep(locale, {
      id: 'bridge',
      kind: 'bridge_role',
      etaLabel: formatEta(locale, 4, input.learning.missingSkills.length),
      confidence: clamp(baseConfidence - 6, 40, 82),
      friction: 'medium',
      ctaTarget: { kind: 'open_path', pathId: bridgePath.id },
      meta: { role: bridgePath.title },
    }));
  }

  if (input.miniChallenges.length > 0 && (!directMove || input.learning.missingSkills.length > 0)) {
    steps.push(buildStep(locale, {
      id: 'proof',
      kind: 'proof_step',
      etaLabel: localeText(locale, {
        cs: '1-2 týdny',
        sk: '1-2 týždne',
        de: '1-2 Wochen',
        pl: '1-2 tygodnie',
        en: '1-2 weeks',
      }),
      confidence: clamp(baseConfidence - 4, 46, 80),
      friction: 'medium',
      ctaTarget: { kind: 'open_mini_challenges' },
    }));
  }

  steps.push(buildStep(locale, {
    id: 'target',
    kind: 'target_role',
    etaLabel: formatEta(locale, 4, input.learning.missingSkills.length),
    confidence: clamp(baseConfidence, 38, 92),
    friction: directMove ? 'low' : 'medium',
    ctaTarget: { kind: 'open_path', pathId: targetPath?.id || null, roleId: targetRole?.id || null },
    meta: { role: targetRole?.title || targetPath?.title || input.goal.targetRole },
  }));

  steps.push(buildStep(locale, {
    id: 'offers',
    kind: 'offer_activation',
    etaLabel: localeText(locale, {
      cs: 'Teď',
      sk: 'Teraz',
      de: 'Jetzt',
      pl: 'Teraz',
      en: 'Now',
    }),
    confidence: clamp(baseConfidence + (targetPath ? 4 : -10), 28, 94),
    friction: targetPath ? 'low' : 'high',
    ctaTarget: { kind: 'open_offers', pathId: targetPath?.id || null, roleId: targetRole?.id || null },
  }));

  const routeStatus: CareerNavigationRouteStatus =
    input.goal.status === 'needs_clarification'
      ? 'needs_clarification'
      : baseConfidence >= 62 && Boolean(targetPath)
        ? 'ready'
        : 'weak';

  const waypoints: CareerNavigationWaypoint[] = [
    {
      id: 'current',
      kind: 'current',
      label: currentRole,
      x: 0,
      y: 0,
      pathId: currentPath?.id || null,
      roleId: null,
    },
    ...(bridgePath
      ? [{
          id: `bridge-${bridgePath.id}`,
          kind: 'bridge' as const,
          label: bridgePath.title,
          x: bridgePath.x,
          y: bridgePath.y,
          pathId: bridgePath.id,
          roleId: bridgePath.roleOptions[0]?.id || null,
        }]
      : []),
    ...(targetPath
      ? [{
          id: `target-${targetPath.id}`,
          kind: 'target' as const,
          label: targetRole?.title || targetPath.title,
          x: targetPath.x,
          y: targetPath.y,
          pathId: targetPath.id,
          roleId: targetRole?.id || null,
        }]
      : []),
  ];

  const destinationLabel = targetRole?.title || targetPath?.title || input.goal.targetRole || input.goal.rawInput;
  const etaLabel = formatEta(locale, steps.length, input.learning.missingSkills.length);
  const routeConfidence = clamp(
    Math.round(
      (steps.reduce((sum, step) => sum + step.confidence, 0) / Math.max(1, steps.length) + baseConfidence) / 2,
    ),
    28,
    96,
  );

  return {
    goal: input.goal,
    status: routeStatus,
    destinationLabel,
    summary: localeText(locale, {
      cs: `${formatConfidenceLabel(locale, routeConfidence)} směrem k ${destinationLabel}.`,
      sk: `${formatConfidenceLabel(locale, routeConfidence)} smerom k ${destinationLabel}.`,
      de: `${formatConfidenceLabel(locale, routeConfidence)} in Richtung ${destinationLabel}.`,
      pl: `${formatConfidenceLabel(locale, routeConfidence)} w stronę ${destinationLabel}.`,
      en: `${formatConfidenceLabel(locale, routeConfidence)} toward ${destinationLabel}.`,
    }),
    etaLabel,
    confidence: routeConfidence,
    likelyFrictions,
    missingSignalHint,
    waypoints,
    steps,
    targetPathId: targetPath?.id || null,
    targetRoleId: targetRole?.id || null,
    bridgePathId: bridgePath?.id || null,
  };
};

export const buildCareerNavigationGoalFromAlternative = (
  baseGoal: CareerNavigationGoal,
  alternative: CareerNavigationGoalAlternative,
): CareerNavigationGoal => ({
  ...baseGoal,
  targetRole: alternative.targetRole,
  primaryDomain: alternative.primaryDomain,
  status: alternative.confidence >= 70 ? 'resolved' : 'resolved_with_low_confidence',
  confidence: clamp(alternative.confidence, 40, 92),
  explanation: alternative.label,
});
