import type { Candidate, CandidateDomainKey, CompanyApplicationRow, CompanyProfile, Job, UserProfile } from '../types';
import { getStockCoverForDomain } from '../utils/domainCoverImages';
import { createDefaultCandidateSearchProfile } from '../services/profileDefaults';
import { getStaticCoordinates } from '../services/geocodingService';
import type {
  CalendarEvent,
  CandidateInsight,
  CandidatePreferenceProfile,
  Company,
  CompanyBrandTheme,
  MarketplaceFilters,
  Role,
  RoleFamily,
} from './models';
import type { ChallengeDraft } from '../services/v2ChallengeService';

const fallbackLogo =
  'https://images.unsplash.com/photo-1545239351-1141bd82e8a6?q=80&w=200&auto=format&fit=crop';

const paletteFromSeed = (seed: string): CompanyBrandTheme => {
  let hash = 0;
  for (const char of seed) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }
  const positive = Math.abs(hash);
  const hue = positive % 360;
  const accentHue = (hue + 24) % 360;
  return {
    primary: `hsl(${hue} 62% 42%)`,
    secondary: `hsl(${hue} 60% 94%)`,
    accent: `hsl(${accentHue} 72% 54%)`,
    surface: `hsl(${hue} 50% 98%)`,
    glow: '37,93,171',
  };
};

const slugify = (value: string): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'company';

const normalizeCurrency = (job: Job): Role['currency'] => {
  const raw = String(job.aiEstimatedSalary?.currency || job.salaryRange || job.salary_from || '').toUpperCase();
  if (raw.includes('PLN')) return 'PLN';
  if (raw.includes('EUR')) return 'EUR';
  return 'CZK';
};

const inferSalary = (job: Job): { from: number; to: number } => {
  const fallbackMin = job.aiEstimatedSalary?.min || 0;
  const fallbackMax = job.aiEstimatedSalary?.max || fallbackMin;
  const from = Number(job.salary_from || fallbackMin || 0);
  const to = Number(job.salary_to || fallbackMax || from || 0);
  if (from > 0 || to > 0) {
    return {
      from: from || to,
      to: to || from,
    };
  }
  return { from: 0, to: 0 };
};

const inferRoleFamily = (job: Job): RoleFamily => {
  const haystack = [
    job.title,
    job.description,
    job.challenge,
    ...(job.required_skills || []),
    ...(job.tags || []),
  ].join(' ').toLowerCase();

  if (/hotel|resort|restaurant|gastro|chef|cook|kucha[řr]|[čc]i[šs]n[ií]k|waiter|barista|kitchen|kuchyn/.test(haystack)) return 'frontline';
  if (/designer|design|ux|ui|figma|brand/.test(haystack)) return 'design';
  if (/product|pm\b|roadmap|discovery/.test(haystack)) return 'product';
  if (/marketing|content|seo|social|campaign|copy/.test(haystack)) return 'marketing';
  if (/finance|accounting|účet|ucet|payroll|controller|administrativ/.test(haystack)) return 'finance';
  if (/\b(hr|people|recruit|talent|personalist)\b/.test(haystack)) return 'people';
  if (/teacher|lektor|trainer|education|škola|skola|kurz/.test(haystack)) return 'education';
  if (/health|caregiver|nurse|doctor|zdrav|soci[aá]ln/.test(haystack)) return 'health';
  if (/construction|stavb|řemesl|remesl|electrician|plumber|tesař|tesar/.test(haystack)) return 'construction';
  if (/logistics|logistik|driver|řidič|ridic|warehouse|sklad|doprava/.test(haystack)) return 'logistics';
  if (/legal|law|compliance|práv|pravnik|gdpr/.test(haystack)) return 'legal';
  if (/sales|account executive|business development|revenue/.test(haystack)) return 'sales';
  if (/operations|logistics|supply|coordinator|delivery/.test(haystack)) return 'operations';
  if (/care|support|customer success|service/.test(haystack)) return 'care';
  if (/store|shift|frontline|warehouse|retail/.test(haystack)) return 'frontline';
  return 'engineering';
};

const inferVisualDomain = (job: Job): CandidateDomainKey => {
  const explicitDomain = job.inferredDomain;
  if (explicitDomain) return explicitDomain;

  const haystack = [
    job.title,
    job.company,
    job.description,
    job.challenge,
    job.location,
    ...(job.required_skills || []),
    ...(job.tags || []),
  ].join(' ').toLowerCase();

  if (/\b(hotel|resort|restaurant|gastro|gastronomie|chef|cook|sous chef|kucha[řr]|pizz[aá][řr]|kitchen|kuchyn|[čc]i[šs]n[ií]k|serv[ií]r|waiter|barista|bistro|catering)\b/.test(haystack)) {
    return 'hospitality';
  }
  if (/\b(sklad|warehouse|logistik|logistics|doprava|driver|[řr]idi[čc]|courier|kur[yý]r|delivery)\b/.test(haystack)) {
    return 'logistics';
  }
  if (/\b(retail|store|prodej|prodava[čc]|pokladn|shop|boutique)\b/.test(haystack)) {
    return 'retail';
  }
  if (/\b(v[yý]rob|manufactur|operator|mont[aá][žz]|cnc|machine|factory|linka)\b/.test(haystack)) {
    return 'manufacturing';
  }
  if (/\b(program|developer|engineer|software|frontend|backend|data|devops|cloud|it\b)\b/.test(haystack)) {
    return 'it';
  }

  return 'operations';
};

const inferHeroImage = (job: Job): string => {
  return job.companyProfile?.marketplace_media?.cover_url
    || job.companyProfile?.gallery_urls?.[0]
    || getStockCoverForDomain(inferVisualDomain(job), `${job.company}:${job.title}`, job.companyProfile?.marketplace_media?.visual_tone || null);
};


const inferRoleLevel = (job: Job): Role['level'] => {
  const title = String(job.title || '').toLowerCase();
  if (/(principal|staff|head|director)/.test(title)) return 'Lead';
  if (/lead|senior|sr\./.test(title)) return 'Senior';
  if (/junior|jr\./.test(title)) return 'Junior';
  return 'Mid';
};

const normalizeWorkModel = (job: Job): Role['workModel'] => {
  const raw = String(job.type || job.work_model || '').toLowerCase();
  if (raw.includes('remote')) return 'Remote';
  if (raw.includes('hybrid')) return 'Hybrid';
  return 'On-site';
};

const normalizeCountryCode = (job: Job): Role['countryCode'] => {
  const raw = String(job.country_code || '').toUpperCase();
  if (raw === 'SK' || raw === 'PL' || raw === 'DE' || raw === 'AT') return raw;
  return 'CZ';
};

const DEFAULT_PRAGUE_COORDINATES = { lat: 50.0755, lon: 14.4378 };

const hasDefaultPragueCoordinates = (coordinates?: { lat: number; lon: number } | null): boolean => {
  if (!coordinates) return false;
  return Math.abs(coordinates.lat - DEFAULT_PRAGUE_COORDINATES.lat) < 0.02
    && Math.abs(coordinates.lon - DEFAULT_PRAGUE_COORDINATES.lon) < 0.02;
};

const inferUserCoordinates = (
  profile: UserProfile,
  fallback: CandidatePreferenceProfile,
): CandidatePreferenceProfile['coordinates'] => {
  const staticCoordinates = getStaticCoordinates(profile.address || '');
  const profileCoordinates = profile.coordinates || null;

  if (staticCoordinates && (!profileCoordinates || hasDefaultPragueCoordinates(profileCoordinates))) {
    return staticCoordinates;
  }

  return profileCoordinates || staticCoordinates || fallback.coordinates;
};

const inferRoleCoordinates = (job: Job): Role['coordinates'] => {
  const lat = Number(job.lat);
  const lng = Number(job.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return { lat, lng };
  }

  const staticCoordinates = getStaticCoordinates(job.location || '');
  if (staticCoordinates) {
    return { lat: staticCoordinates.lat, lng: staticCoordinates.lon };
  }

  return { lat: 0, lng: 0 };
};

const normalizeRoleSource = (job: Job): Role['source'] => {
  const source = String(job.source || '').toLowerCase();
  if (job.listingKind === 'challenge') return 'curated';
  if (source.includes('jobshaman_curated') || source.includes('native') || source.includes('company')) return 'curated';
  return 'imported';
};

const normalizeFeaturedInsights = (job: Job, roleFamily: RoleFamily): string[] => {
  const candidates = [
    ...(job.matchReasons || []),
    ...(job.aiMatchReasons || []),
    ...(job.required_skills || []),
    ...(job.tags || []),
  ].map((item) => String(item || '').trim()).filter(Boolean);
  if (candidates.length > 0) return Array.from(new Set(candidates)).slice(0, 3);
  const fallback: Record<RoleFamily, string[]> = {
    engineering: ['Architecture-first', 'System judgment', 'Execution signal'],
    design: ['Portfolio-backed', 'Systems thinking', 'Visual craft'],
    product: ['Decision quality', 'Roadmap clarity', 'Cross-team fit'],
    operations: ['Operational tempo', 'Process thinking', 'Real-world execution'],
    sales: ['Commercial signal', 'Narrative fit', 'Outbound readiness'],
    care: ['Human clarity', 'Service judgment', 'Trust signal'],
    frontline: ['Operational readiness', 'Reliability', 'Team fit'],
    marketing: ['Audience judgment', 'Content clarity', 'Campaign signal'],
    finance: ['Accuracy', 'Business context', 'Reliability'],
    people: ['People judgment', 'Process clarity', 'Candidate care'],
    education: ['Learning design', 'Clarity', 'Human impact'],
    health: ['Care quality', 'Trust', 'Real-world judgment'],
    construction: ['Craft readiness', 'Safety judgment', 'Execution signal'],
    logistics: ['Coordination', 'Reliability', 'Operational tempo'],
    legal: ['Risk judgment', 'Compliance clarity', 'Precision'],
  };
  return fallback[roleFamily];
};

export const mapCompanyProfileToCompany = (companyProfile: CompanyProfile): Company => {
  const seed = `${companyProfile.id || companyProfile.name}:${companyProfile.industry || companyProfile.name}`;
  const brandAssets = companyProfile.brand_assets || {};
  const logoAsset = brandAssets.logo || null;
  const coverAsset = brandAssets.cover || null;
  const reviewerAvatarAsset = brandAssets.reviewer_avatar || null;
  const gallery = Array.isArray(brandAssets.gallery) && brandAssets.gallery.length > 0
    ? brandAssets.gallery
    : (companyProfile.gallery_urls || []).map((url, index) => ({
        id: `gallery-${index}`,
        name: `Gallery ${index + 1}`,
        url,
        download_url: url,
      }));
  const handshakeMaterials = Array.isArray(brandAssets.handshake_materials) && brandAssets.handshake_materials.length > 0
    ? brandAssets.handshake_materials
    : (companyProfile.handshake_materials || []);
  return {
    id: String(companyProfile.id || slugify(companyProfile.name)),
    name: companyProfile.name || 'Company',
    tagline: companyProfile.philosophy || companyProfile.description || companyProfile.tone || 'Company-branded hiring surface.',
    domain: companyProfile.industry || 'Employer',
    headquarters: companyProfile.address || companyProfile.legal_address || 'Location not specified',
    narrative: companyProfile.description || companyProfile.philosophy || 'The company has not added a public brand narrative yet.',
    coverImage: coverAsset?.url || companyProfile.marketplace_media?.cover_url || companyProfile.gallery_urls?.[0] || getStockCoverForDomain('operations', seed),
    logo: logoAsset?.url || companyProfile.logo_url || fallbackLogo,
    logoAsset,
    coverAsset,
    gallery,
    handshakeMaterials,
    theme: paletteFromSeed(seed),
    reviewer: {
      name: companyProfile.members?.[0]?.name || 'Hiring Team',
      role: companyProfile.members?.[0]?.companyRole || companyProfile.members?.[0]?.role || 'Recruiter',
      avatarUrl: reviewerAvatarAsset?.url || companyProfile.members?.[0]?.avatar || logoAsset?.url || companyProfile.logo_url || fallbackLogo,
      intro: companyProfile.tone || companyProfile.philosophy || 'We want to understand your signal before we talk live.',
      meetingLabel: 'Intro Call',
      durationMinutes: 25,
      tool: 'Google Meet',
    },
    reviewerAvatarAsset,
  };
};

export const mapJobToRole = (job: Job): Role => {
  const roleFamily = inferRoleFamily(job);
  const salary = inferSalary(job);
  const source = normalizeRoleSource(job);
  const companyId = String(job.company_id || slugify(job.company || 'company'));
  return {
    id: String(job.id),
    companyId,
    companyName: job.company,
    companyLogo: job.companyProfile?.logo_url || undefined,
    companyCoverImage: job.companyProfile?.marketplace_media?.cover_url || job.companyProfile?.gallery_urls?.[0] || undefined,
    companyNarrative: job.companyProfile?.description || job.companyGoal || undefined,
    title: job.title,
    team: job.companyGoal || job.company || 'Hiring',
    location: job.location || 'Location not specified',
    countryCode: normalizeCountryCode(job),
    workModel: normalizeWorkModel(job),
    source,
    roleFamily,
    level: inferRoleLevel(job),
    salaryFrom: salary.from,
    salaryTo: salary.to,
    currency: normalizeCurrency(job),
    heroImage: inferHeroImage(job),
    summary: job.companyPageSummary || job.challenge || job.description.slice(0, 180) || 'Role summary coming soon.',
    challenge: job.challenge || job.description.slice(0, 220) || 'Step into a realistic work scenario.',
    mission: job.companyGoal || job.description.slice(0, 240) || 'Evaluate mission, signal and next-step fit.',
    firstStep: job.firstStepPrompt || 'Show how you would approach the first real tension in this role.',
    description: job.description || '',
    roleSummary: job.role_summary || null,
    sourceUrl: job.url || undefined,
    contractType: job.type || null,
    salaryTimeframe: job.salary_timeframe || null,
    companyTruthHard: job.company_truth_hard || null,
    companyTruthFail: job.company_truth_fail || null,
    outboundUrl: source === 'imported' ? job.url : undefined,
    importedNote: source === 'imported' ? 'This role remains external. Jobshaman prepares your move before you leave the platform.' : undefined,
    skills: Array.from(new Set([...(job.required_skills || []), ...(job.tags || [])])).slice(0, 6),
    benefits: job.benefits || [],
    coordinates: inferRoleCoordinates(job),
    blueprintId: source === 'curated' ? undefined : undefined,
    featuredInsights: normalizeFeaturedInsights(job, roleFamily),
  };
};

export const mapUserProfileToCandidatePreferences = (
  profile: UserProfile,
  fallback: CandidatePreferenceProfile,
): CandidatePreferenceProfile => ({
  ...fallback,
  name: profile.name || fallback.name,
  legalName: profile.name || fallback.legalName,
  preferredAlias: profile.name || fallback.preferredAlias,
  story: profile.story || fallback.story,
  address: profile.address || fallback.address,
  coordinates: inferUserCoordinates(profile, fallback),
  transportMode: profile.transportMode || fallback.transportMode,
  commuteFilterEnabled: profile.preferences?.searchProfile?.defaultEnableCommuteFilter ?? fallback.commuteFilterEnabled,
  commuteToleranceMinutes: profile.preferences?.commuteTolerance || fallback.commuteToleranceMinutes,
  borderSearchEnabled: profile.preferences?.searchProfile?.nearBorder ?? fallback.borderSearchEnabled,
  searchRadiusKm: profile.preferences?.searchProfile?.defaultMaxDistanceKm || fallback.searchRadiusKm,
  taxProfile: profile.taxProfile || fallback.taxProfile,
  jhiPreferences: profile.jhiPreferences || fallback.jhiPreferences,
  portfolioUrl: profile.preferences?.portfolio || fallback.portfolioUrl,
  linkedInUrl: profile.preferences?.linkedIn || fallback.linkedInUrl,
});

export const candidatePreferencesToUserProfileUpdates = (
  preferences: CandidatePreferenceProfile,
  currentProfile?: UserProfile,
): Partial<UserProfile> => {
  const baseSearchProfile = currentProfile?.preferences?.searchProfile || createDefaultCandidateSearchProfile();
  return {
    name: preferences.legalName || preferences.name,
    address: preferences.address,
    coordinates: preferences.coordinates,
    transportMode: preferences.transportMode,
    story: preferences.story,
    taxProfile: preferences.taxProfile,
    jhiPreferences: {
      ...preferences.jhiPreferences,
      hardConstraints: {
        ...preferences.jhiPreferences.hardConstraints,
        maxCommuteMinutes: preferences.commuteFilterEnabled ? preferences.commuteToleranceMinutes : null,
      },
    },
    preferredCountryCode: preferences.taxProfile.countryCode,
    preferences: {
      ...(currentProfile?.preferences || {}),
      workLifeBalance: currentProfile?.preferences?.workLifeBalance || 50,
      financialGoals: currentProfile?.preferences?.financialGoals || 50,
      commuteTolerance: preferences.commuteToleranceMinutes,
      priorities: currentProfile?.preferences?.priorities || [],
      linkedIn: preferences.linkedInUrl || undefined,
      portfolio: preferences.portfolioUrl || undefined,
      searchProfile: {
        ...baseSearchProfile,
        nearBorder: preferences.borderSearchEnabled,
        defaultEnableCommuteFilter: preferences.commuteFilterEnabled,
        defaultMaxDistanceKm: preferences.searchRadiusKm,
      },
    },
  };
};

export const mapCandidateToInsight = (candidate: Candidate, t: any): CandidateInsight => ({
  id: candidate.id,
  candidateName: candidate.full_name || candidate.name,
  headline: candidate.job_title || candidate.title || candidate.role || t('rebuild.adapters.candidate', { defaultValue: 'Candidate' }),
  location: t('rebuild.adapters.candidate_profile', { defaultValue: 'Candidate profile' }),
  matchPercent: Math.round(candidate.matchScore || 78),
  verifiedScore: Math.round((candidate.matchScore || 78)),
  topSignals: candidate.skills.slice(0, 3),
  recommendation: t('rebuild.adapters.talent_pool_rec', { defaultValue: 'Registered candidate in talent pool. Detailed story, onboarding, JCFPM and sensitive signals will appear after explicit sharing or an active handshake.' }),
  internalNote: candidate.skills.length > 0
    ? t('rebuild.adapters.public_signals', { defaultValue: 'Public profile signals: {{skills}}.', skills: candidate.skills.slice(0, 3).join(', ') })
    : t('rebuild.adapters.no_public_signals', { defaultValue: 'No public profile signals yet.' }),
  skills: (candidate.skills.length > 0 ? candidate.skills : [t('rebuild.adapters.signal_clarity', { defaultValue: 'Signal clarity' }), t('rebuild.adapters.experience', { defaultValue: 'Experience' }), t('rebuild.adapters.role_fit', { defaultValue: 'Role fit' })]).slice(0, 3).map((label, index) => ({
    label,
    score: Math.max(62, Math.min(96, Math.round((candidate.matchScore || 78) - index * 7))),
    tags: [],
  })),
});

export const mapApplicationToInsight = (
  application: CompanyApplicationRow,
  roles: Role[],
  t: any,
): CandidateInsight => {
  const matchedRole = roles.find((role) => String(role.id) === String(application.job_id));
  const topSignals = (matchedRole?.skills || ['Structured submission', 'Candidate signal', 'Role fit']).slice(0, 3);
  const statusBoost = application.status === 'shortlisted' || application.status === 'reviewed' ? 8 : application.status === 'hired' ? 12 : 0;
  const hasCvBoost = application.hasCv ? 6 : 0;
  const hasJcfpmBoost = application.hasJcfpm ? 4 : 0;
  const baseScore = Math.max(72, Math.min(97, 74 + statusBoost + hasCvBoost + hasJcfpmBoost));

  return {
    id: `application-${application.id}`,
    candidateName: application.candidate_name || 'Candidate',
    headline: application.candidateHeadline || application.job_title || matchedRole?.title || 'Candidate submission',
    location: matchedRole?.location || 'Candidate submission',
    matchPercent: baseScore,
    verifiedScore: baseScore,
    topSignals,
    recommendation: application.status === 'shortlisted' || application.status === 'reviewed'
      ? t('rebuild.adapters.app_under_review', { defaultValue: 'Candidate response is already under active review. Check the materials and plan the next human step.' })
      : t('rebuild.adapters.app_completed', { defaultValue: 'Candidate completed the response via Jobshaman. Check the materials and decide on the next step.' }),
    internalNote: [
      application.hasCv ? t('rebuild.adapters.cv_attached', { defaultValue: 'CV attached.' }) : t('rebuild.adapters.cv_not_attached', { defaultValue: 'CV not attached yet.' }),
      application.hasJcfpm ? t('rebuild.adapters.jcfpm_shared', { defaultValue: 'JCFPM shared ({{level}}).', level: application.jcfpmShareLevel || 'summary' }) : t('rebuild.adapters.jcfpm_not_shared', { defaultValue: 'JCFPM not shared yet.' }),
      application.status ? t('rebuild.adapters.status_label', { defaultValue: 'Status: {{status}}.', status: application.status }) : null,
    ].filter(Boolean).join(' '),
    skills: topSignals.map((label, index) => ({
      label,
      score: Math.max(68, Math.min(96, baseScore - index * 5)),
      tags: matchedRole?.featuredInsights.slice(index, index + 2) || [],
    })),
  };
};

export const mapDialoguesToCalendarEvents = (dialogues: CompanyApplicationRow[]): CalendarEvent[] =>
  dialogues.slice(0, 10).map((dialogue, index) => {
    const created = dialogue.submitted_at ? new Date(dialogue.submitted_at) : new Date();
    const day = Number.isFinite(created.getDate()) ? created.getDate() : index + 1;
    const stage: CalendarEvent['stage'] =
      dialogue.status === 'shortlisted' || dialogue.status === 'reviewed'
        ? 'panel'
        : dialogue.status === 'hired'
          ? 'offer'
          : 'assessment';
    return {
      id: `dialogue-${dialogue.id}`,
      title: dialogue.candidate_name || 'Candidate review',
      stage,
      day,
      time: created.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      note: dialogue.status || '',
    };
  });

export const mapChallengeDraftToRole = (challenge: ChallengeDraft, t: any, company?: Company | null): Role => {
  const rawFamily = String(challenge.editor_state?.role_family || challenge.payload_json?.role_family || 'operations');
  const roleFamily = ([
    'engineering', 'design', 'product', 'operations', 'sales', 'care', 'frontline',
    'marketing', 'finance', 'people', 'education', 'health', 'construction', 'logistics', 'legal',
  ].includes(rawFamily) ? rawFamily : 'operations') as Role['roleFamily'];
  const workModel = challenge.work_model === 'Remote' || challenge.work_model === 'On-site' || challenge.work_model === 'Hybrid'
    ? challenge.work_model
    : 'Hybrid';
  const currency = challenge.currency === 'EUR' || challenge.currency === 'PLN' || challenge.currency === 'CZK'
    ? challenge.currency
    : 'CZK';
  const skills = Array.isArray(challenge.skills_required)
    ? challenge.skills_required
    : Array.isArray(challenge.tags)
      ? challenge.tags
      : [];
  const firstStep = String(challenge.editor_state?.first_reply_prompt || challenge.payload_json?.first_reply_prompt || '').trim();
  return {
    id: String(challenge.id),
    companyId: String(challenge.company_id),
    companyName: challenge.company_name || company?.name || t('rebuild.adapters.company_fallback', { defaultValue: 'Company' }),
    companyLogo: company?.logo,
    companyCoverImage: company?.coverImage,
    companyNarrative: company?.narrative,
    title: challenge.title,
    team: String(challenge.editor_state?.company_goal || company?.domain || t('rebuild.adapters.assessment_center', { defaultValue: 'Assessment center' })),
    location: challenge.location || company?.headquarters || t('rebuild.adapters.location_tbd', { defaultValue: 'Location to be specified' }),
    countryCode: 'CZ',
    workModel,
    source: 'curated',
    roleFamily,
    level: 'Mid',
    salaryFrom: Number(challenge.salary_from || 0),
    salaryTo: Number(challenge.salary_to || challenge.salary_from || 0),
    currency,
    heroImage: company?.coverImage || '',
    summary: challenge.summary || challenge.description || t('rebuild.adapters.challenge_summary_empty', { defaultValue: 'Challenge waiting for context addition.' }),
    challenge: challenge.summary || challenge.description || t('rebuild.adapters.handshake_desc', { defaultValue: 'Practical handshake over a real task.' }),
    mission: challenge.description || challenge.summary || t('rebuild.adapters.verify_mission', { defaultValue: 'Verify work signal on real context.' }),
    firstStep: firstStep || t('rebuild.adapters.first_step_default', { defaultValue: 'Respond to the first practical step and name the trade-off.' }),
    description: challenge.description || challenge.summary || '',
    roleSummary: challenge.summary || null,
    contractType: null,
    salaryTimeframe: 'monthly',
    companyTruthHard: null,
    companyTruthFail: null,
    skills,
    benefits: [],
    coordinates: { lat: 0, lng: 0 },
    blueprintId: String((challenge.handshake_blueprint_v1 as any)?.id || ''),
    featuredInsights: [challenge.status, workModel, roleFamily].filter(Boolean),
  };
};

export const buildDefaultMarketplaceFilters = (preferences: CandidatePreferenceProfile): MarketplaceFilters => ({
  city: '',
  targetRole: '',
  roleFamily: 'all',
  workArrangement: 'all',
  remoteOnly: false,
  crossBorder: preferences.borderSearchEnabled,
  radiusKm: preferences.searchRadiusKm,
  minSalary: 0,
  transportMode: preferences.transportMode,
  benefits: [],
  curatedOnly: false,
});
