import ApiService from './apiService';
import { getStaticCoordinates } from './geocodingService';
import { getStockCoverForDomain } from '../utils/domainCoverImages';
import type { CandidateDomainKey } from '../types';
import type { MarketplaceFilters, MarketplaceSection, Role, RoleFamily, RoleRecommendationFitComponent } from '../rebuild/models';

const COUNTRY_LABELS: Record<Role['countryCode'], string> = {
  CZ: 'Česká republika',
  SK: 'Slovensko',
  PL: 'Polsko',
  DE: 'Německo',
  AT: 'Rakousko',
};

const normalizeText = (value: unknown) => String(value || '').trim();

const normalizeCountryCode = (job: any): Role['countryCode'] => {
  const regionText = [
    job.location,
    job.payload_json?.location,
    job.title,
    job.url,
    job.source,
  ].map(normalizeText).join(' ').toLowerCase();
  if (/(germany|deutschland|berlin|munich|münchen|hamburg|frankfurt|köln|koln|stuttgart|düsseldorf|dusseldorf)/.test(regionText)) return 'DE';
  if (/(austria|österreich|osterreich|vienna|wien|linz|graz|salzburg)/.test(regionText)) return 'AT';
  if (/(poland|polska|warszawa|krakow|kraków|wroclaw|wrocław|poznan|poznań)/.test(regionText)) return 'PL';
  if (/(slovakia|slovensko|bratislava|košice|kosice|žilina|zilina)/.test(regionText)) return 'SK';

  const raw = normalizeText(job.country_code || job.countryCode || job.payload_json?.country_code || job.payload_json?.country).toUpperCase();
  if (raw === 'SK' || raw.includes('SLOVAK')) return 'SK';
  if (raw === 'PL' || raw.includes('POL')) return 'PL';
  if (raw === 'DE' || raw.includes('GER') || raw.includes('DEUTSCH')) return 'DE';
  if (raw === 'AT' || raw.includes('AUS') || raw.includes('ÖSTER') || raw.includes('OSTER')) return 'AT';

  const haystack = [
    regionText,
    job.description,
    job.summary,
    job.role_summary,
  ].map(normalizeText).join(' ').toLowerCase();
  if (/(germany|deutschland|berlin|munich|münchen|hamburg|frankfurt|köln|koln|stuttgart|düsseldorf|dusseldorf)/.test(haystack)) return 'DE';
  if (/(austria|österreich|osterreich|vienna|wien|linz|graz|salzburg)/.test(haystack)) return 'AT';
  if (/(poland|polska|warszawa|krakow|kraków|wroclaw|wrocław|poznan|poznań)/.test(haystack)) return 'PL';
  if (/(slovakia|slovensko|bratislava|košice|kosice|žilina|zilina)/.test(haystack)) return 'SK';
  return 'CZ';
};

const normalizeWorkModel = (job: any): Role['workModel'] => {
  const raw = [
    job.work_model,
    job.work_type,
    job.type,
    job.contract_type,
    job.location,
    job.payload_json?.location,
    job.payload_json?.work_model,
    job.payload_json?.work_type,
    job.title,
    job.description,
    job.summary,
    job.role_summary,
  ].map(normalizeText).join(' ').toLowerCase();
  if (/(remote|home office|homeoffice|fully remote|remote-first|remotely|fernarbeit|telearbeit|100%\s*remote)/.test(raw)) return 'Remote';
  if (/(hybrid|hybridní|hybridni|teilweise remote|partly remote)/.test(raw)) return 'Hybrid';
  return 'On-site';
};

const inferRoleFamily = (job: any): RoleFamily => {
  const explicit = normalizeText(job.editor_state?.role_family || job.payload_json?.role_family || job.payload_json?.handshake_blueprint_v1?.role_family);
  if (['engineering', 'design', 'product', 'operations', 'sales', 'care', 'frontline', 'marketing', 'finance', 'people', 'education', 'health', 'construction', 'logistics', 'legal'].includes(explicit)) {
    return explicit as RoleFamily;
  }
  const haystack = [
    job.title,
    job.description,
    job.summary,
    job.role_summary,
    ...(Array.isArray(job.tags) ? job.tags : []),
  ].map(normalizeText).join(' ').toLowerCase();
  if (/design|designer|ux|ui|figma|grafik/.test(haystack)) return 'design';
  if (/product|produkt|owner|roadmap|discovery/.test(haystack)) return 'product';
  if (/marketing|content|seo|social|campaign|copy/.test(haystack)) return 'marketing';
  if (/finance|accounting|účet|ucet|payroll|controller|administrativ/.test(haystack)) return 'finance';
  if (/\b(hr|people|recruit|talent|personalist)\b/.test(haystack)) return 'people';
  if (/teacher|lektor|trainer|education|škola|skola|kurz/.test(haystack)) return 'education';
  if (/health|caregiver|nurse|doctor|zdrav|soci[aá]ln/.test(haystack)) return 'health';
  if (/construction|stavb|řemesl|remesl|electrician|plumber|tesař|tesar/.test(haystack)) return 'construction';
  if (/logistics|logistik|driver|řidič|ridic|warehouse|sklad|doprava/.test(haystack)) return 'logistics';
  if (/legal|law|compliance|práv|pravnik|gdpr/.test(haystack)) return 'legal';
  if (/sales|obchod|account|business development|vertrieb/.test(haystack)) return 'sales';
  if (/logistik|logistics|supply|operations|provoz|koordin/.test(haystack)) return 'operations';
  if (/support|care|customer|kunden|service|péče|pece/.test(haystack)) return 'care';
  if (/warehouse|sklad|výrob|vyrob|montáž|montaz|retail|prodava|fahrer|driver/.test(haystack)) return 'frontline';
  return 'engineering';
};

const inferRoleLevel = (job: any): Role['level'] => {
  const title = normalizeText(job.title).toLowerCase();
  if (/(head|director|principal|staff|vedoucí|vedouci|leiter)/.test(title)) return 'Lead';
  if (/(senior|sr\.|lead)/.test(title)) return 'Senior';
  if (/(junior|jr\.|trainee|praktikant|stáž|staz)/.test(title)) return 'Junior';
  return 'Mid';
};

const toStringList = (...values: unknown[]): string[] => {
  const result: string[] = [];
  for (const value of values) {
    const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[;,|]/) : [];
    for (const item of raw) {
      const text = normalizeText(item);
      if (text && !result.some((existing) => existing.toLowerCase() === text.toLowerCase())) result.push(text);
    }
  }
  return result.slice(0, 18);
};

const normalizeCurrency = (job: any, countryCode: Role['countryCode']): Role['currency'] => {
  const raw = normalizeText(job.currency || job.salary_currency).toUpperCase();
  if (raw.includes('PLN')) return 'PLN';
  if (raw.includes('EUR')) return 'EUR';
  if (raw.includes('CZK') || raw.includes('KČ')) return 'CZK';
  if (countryCode === 'PL') return 'PLN';
  if (countryCode === 'DE' || countryCode === 'AT' || countryCode === 'SK') return 'EUR';
  return 'CZK';
};

const buildLocation = (job: any, countryCode: Role['countryCode'], workModel: Role['workModel']): string => {
  const rawLocation = normalizeText(job.location || job.payload_json?.location);
  if (rawLocation) return rawLocation;
  return workModel === 'Remote' ? `Remote · ${COUNTRY_LABELS[countryCode]}` : COUNTRY_LABELS[countryCode];
};

const normalizeMatchScore = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.max(1, Math.min(99, Math.round(numeric)));
};

const normalizeFitComponent = (value: any, fallbackLabel: string): RoleRecommendationFitComponent => ({
  label: normalizeText(value?.label) || fallbackLabel,
  score: normalizeMatchScore(value?.score) ?? 0,
  evidence: toStringList(value?.evidence).slice(0, 4),
  caveats: toStringList(value?.caveats).slice(0, 4),
});

const normalizeRecommendationFit = (job: any): Role['recommendationFit'] => {
  const breakdown = job.recommendation_fit_breakdown;
  if (!breakdown || typeof breakdown !== 'object') return null;
  return {
    components: {
      skillMatch: normalizeFitComponent(breakdown.skill_match, 'Skill match'),
      evidenceQuality: normalizeFitComponent(breakdown.evidence_quality, 'Evidence quality'),
      growthPotential: normalizeFitComponent(breakdown.growth_potential, 'Growth potential'),
      valuesAlignment: normalizeFitComponent(breakdown.values_alignment, 'Values/context alignment'),
      riskPenalty: normalizeFitComponent(breakdown.risk_penalty, 'Risk penalty'),
    },
    reasons: toStringList(job.recommendation_reasons).slice(0, 4),
    caveats: toStringList(job.recommendation_caveats).slice(0, 4),
    riskFlags: toStringList(job.recommendation_risk_flags).slice(0, 8),
    formula: job.recommendation_debug_formula && typeof job.recommendation_debug_formula === 'object'
      ? job.recommendation_debug_formula
      : undefined,
  };
};

const buildCoordinates = (job: any, location: string): Role['coordinates'] => {
  const lat = Number(job.lat);
  const lng = Number(job.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) {
    return { lat, lng };
  }

  const staticCoordinates = getStaticCoordinates(location);
  if (staticCoordinates) return { lat: staticCoordinates.lat, lng: staticCoordinates.lon };

  return { lat: 0, lng: 0 };
};

const normalizeRoleSource = (job: any, fallback: Role['source']): Role['source'] => {
  const raw = normalizeText(job.source_kind || job.source || job.payload_json?.listing_kind).toLowerCase();
  return raw.includes('native') || raw.includes('challenge') || raw.includes('jobshaman') ? 'curated' : fallback;
};

const inferVisualDomain = (job: any, roleFamily: RoleFamily): CandidateDomainKey => {
  const inferred = normalizeText(job.inferred_domain || job.primary_domain || job.payload_json?.primary_domain).toLowerCase();
  if (inferred) {
    const knownDomains = new Set<CandidateDomainKey>([
      'agriculture', 'ai_data', 'aviation', 'automotive', 'construction', 'creative_media',
      'customer_support', 'ecommerce', 'education', 'energy_utilities', 'engineering', 'finance',
      'government_defense', 'healthcare', 'hospitality', 'insurance', 'it', 'logistics',
      'manufacturing', 'maritime', 'marketing', 'media_design', 'mining_heavy_industry',
      'operations', 'pharma_biotech', 'procurement', 'product_management', 'public_services',
      'real_estate', 'retail', 'sales', 'science_lab', 'security', 'telecom_network',
    ]);
    if (knownDomains.has(inferred as CandidateDomainKey)) return inferred as CandidateDomainKey;
  }

  const haystack = [
    job.title,
    job.company_name,
    job.company,
    job.location,
    job.description,
    job.summary,
    job.role_summary,
    ...(Array.isArray(job.tags) ? job.tags : []),
    ...(Array.isArray(job.skills_required) ? job.skills_required : []),
    ...(Array.isArray(job.required_skills) ? job.required_skills : []),
  ].map(normalizeText).join(' ').toLowerCase();

  if (/\b(hotel|resort|restaurant|gastro|gastronomie|chef|cook|sous chef|kucha[řr]|pizz[aá][řr]|kitchen|kuchyn|[čc]i[šs]n[ií]k|serv[ií]r|waiter|barista|bistro|catering)\b/.test(haystack)) return 'hospitality';
  if (/\b(sklad|warehouse|logistik|logistics|doprava|driver|[řr]idi[čc]|courier|kur[yý]r|delivery)\b/.test(haystack)) return 'logistics';
  if (/\b(retail|store|prodej|prodava[čc]|pokladn|shop|boutique)\b/.test(haystack)) return 'retail';
  if (/\b(v[yý]rob|manufactur|operator|mont[aá][žz]|cnc|machine|factory|linka)\b/.test(haystack)) return 'manufacturing';
  if (/\b(program|developer|engineer|software|frontend|backend|data|devops|cloud|it\b)\b/.test(haystack)) return 'it';
  if (/\b(zdrav|health|nurse|doctor|sestra|ambulance|clinic|hospital|psychiatr)\b/.test(haystack)) return 'healthcare';
  if (/\b(staveb|construction|stavby|rozpočt|rozpoct|tesař|zedník|electrician|plumber)\b/.test(haystack)) return 'construction';
  if (/\b(marketing|seo|ppc|brand|content|social media|copywriter)\b/.test(haystack)) return 'marketing';
  if (/\b(accounting|finance|controller|audit|účet|ucet|payroll|econom)\b/.test(haystack)) return 'finance';
  if (/\b(product|produkt|product manager|product owner)\b/.test(haystack)) return 'product_management';
  if (/\b(procurement|buyer|sourcing|nákup|nakup)\b/.test(haystack)) return 'procurement';
  if (/\b(ai|machine learning|analytics|analyt|science|laboratoř|laborator|lab)\b/.test(haystack)) return 'ai_data';

  switch (roleFamily) {
    case 'engineering':
      return 'engineering';
    case 'design':
      return 'media_design';
    case 'product':
      return 'product_management';
    case 'operations':
      return 'operations';
    case 'sales':
      return 'sales';
    case 'care':
      return 'customer_support';
    case 'frontline':
      return 'retail';
    case 'marketing':
      return 'marketing';
    case 'finance':
      return 'finance';
    case 'people':
      return 'public_services';
    case 'education':
      return 'education';
    case 'health':
      return 'healthcare';
    case 'construction':
      return 'construction';
    case 'logistics':
      return 'logistics';
    case 'legal':
      return 'government_defense';
    default:
      return 'operations';
  }
};

const inferHeroImage = (job: any, roleFamily: RoleFamily, companyName: string, title: string): string => {
  const explicit = normalizeText(job.hero_image || job.company_cover_image || job.payload_json?.hero_image);
  if (explicit) return explicit;

  return getStockCoverForDomain(
    inferVisualDomain(job, roleFamily),
    `${companyName}:${title}:${normalizeText(job.location)}`,
    normalizeText(job.payload_json?.visual_tone) || null,
  );
};

const mapJobToRole = (job: any, source: Role['source'] = 'imported'): Role => {
  const resolvedSource = normalizeRoleSource(job, source);
  const countryCode = normalizeCountryCode(job);
  const workModel = normalizeWorkModel(job);
  const currency = normalizeCurrency(job, countryCode);
  const roleFamily = inferRoleFamily(job);
  const skills = toStringList(job.skills_required, job.required_skills, job.tags, job.ai_analysis?.skills);
  const benefits = toStringList(job.benefits, job.ai_analysis?.benefits);
  const tags = toStringList(job.tags);
  const location = buildLocation(job, countryCode, workModel);
  const companyName = normalizeText(job.company_name || job.company) || 'Neznámá firma';
  const summary = normalizeText(job.summary || job.role_summary || job.ai_analysis?.summary);
  const description = normalizeText(job.description || job.role_summary || summary);
  const title = normalizeText(job.title) || 'Untitled role';

  return {
    id: String(job.id),
    companyId: normalizeText(job.company_id) || `imported-${companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'company'}`,
    companyName,
    companyLogo: job.company_logo,
    title,
    team: normalizeText(job.education_level || job.contract_type || job.source_kind) || 'Imported feed',
    location,
    countryCode,
    workModel,
    source: resolvedSource,
    roleFamily,
    level: inferRoleLevel(job),
    salaryFrom: Number(job.salary_from || 0),
    salaryTo: Number(job.salary_to || 0),
    currency,
    heroImage: inferHeroImage(job, roleFamily, companyName, title),
    summary: summary || description.slice(0, 240),
    challenge: summary || 'Tahle importovaná nabídka čeká na ověření detailů.',
    mission: description || summary || 'Detail nabídky je převzatý z externího zdroje.',
    firstStep: normalizeText(job.payload_json?.first_reply_prompt || job.editor_state?.first_reply_prompt)
      || (job.url ? 'Otevři původní nabídku a ověř aktuální podmínky.' : 'Ulož si nabídku a ověř podmínky před odpovědí.'),
    description,
    roleSummary: job.role_summary || summary || null,
    sourceUrl: job.url,
    outboundUrl: resolvedSource === 'imported' ? job.url : undefined,
    contractType: job.contract_type || null,
    salaryTimeframe: job.salary_timeframe || null,
    companyTruthHard: job.verification_notes || null,
    companyTruthFail: job.legality_status === 'illegal' ? 'Nabídka je označená jako právně riziková.' : null,
    importedNote: resolvedSource === 'imported' ? [
      job.source_kind || 'jobs_nf',
      job.language_code ? `jazyk: ${String(job.language_code).toUpperCase()}` : '',
      tags.length ? `tagy: ${tags.slice(0, 4).join(', ')}` : '',
    ].filter(Boolean).join(' · ') : undefined,
    skills,
    benefits,
    coordinates: {
      ...buildCoordinates(job, location),
    },
    featuredInsights: [
      ...(Array.isArray(job.recommendation_reasons) ? job.recommendation_reasons : []),
      workModel,
      COUNTRY_LABELS[countryCode],
      ...(typeof job.recommendation_fit_score === 'number' ? [`Fit ${Math.round(job.recommendation_fit_score)}/100`] : []),
    ].filter(Boolean).slice(0, 3),
    matchScore: normalizeMatchScore(job.recommendation_fit_score),
    recommendationFit: normalizeRecommendationFit(job),
  };
};

const dedupeRoles = (roles: Role[]): Role[] => {
  const merged = new Map<string, Role>();
  roles.forEach((role) => {
    const existing = merged.get(role.id);
    if (!existing) {
      merged.set(role.id, role);
      return;
    }
    merged.set(role.id, {
      ...existing,
      ...role,
      matchScore: existing.matchScore ?? role.matchScore ?? null,
      recommendationFit: existing.recommendationFit ?? role.recommendationFit ?? null,
      featuredInsights: existing.featuredInsights.length ? existing.featuredInsights : role.featuredInsights,
    });
  });
  return Array.from(merged.values());
};

export const fetchJobsWithFiltersV2 = async (
  page = 0,
  pageSize = 500,
  options: {
    countryCode?: Role['countryCode'];
    includeRecommendations?: boolean;
    searchTerm?: string;
    filters?: MarketplaceFilters;
  } = {},
): Promise<{ jobs: Role[]; sections: MarketplaceSection[]; hasMore: boolean; totalCount: number }> => {
  try {
    const offset = Math.max(0, page) * pageSize;
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(offset),
    });
    if (options.countryCode) params.set('country', options.countryCode);
    const searchTerm = normalizeText(options.searchTerm || options.filters?.targetRole);
    if (searchTerm) params.set('q', searchTerm);
    if (options.filters?.city) params.set('city', options.filters.city);
    if (options.filters?.minSalary && options.filters.minSalary > 0) params.set('min_salary', String(options.filters.minSalary));
    if (options.filters?.benefits?.length) params.set('benefits', options.filters.benefits.join(','));
    if (options.filters?.remoteOnly) {
      params.set('work_arrangement', 'remote');
    } else if (options.filters?.workArrangement && options.filters.workArrangement !== 'all') {
      params.set('work_arrangement', options.filters.workArrangement);
    }

    let jobs: Role[] = [];
    let sections: MarketplaceSection[] = [];
    let totalCount = 0;
    let hasMore = false;

    try {
      // Skip recommendation feed if user is explicitly searching or heavily filtering
      const hasSearchFilters = Boolean(options.searchTerm || options.filters?.city || (options.filters?.roleFamily && options.filters.roleFamily !== 'all'));
      if (page === 0 && options.includeRecommendations !== false && !hasSearchFilters) {
        const hasAuthSession = await ApiService.hasAuthSession();
        if (hasAuthSession) {
          const feed = await ApiService.get<any>('/recommendation/feed?limit=360');
          const recommendationItems = Array.isArray(feed?.data?.items) ? feed.data.items : [];
          jobs.push(...recommendationItems.map((item) => mapJobToRole({
            ...(item.job || {}),
            recommendation_fit_score: item.fit_score,
            recommendation_reasons: item.reasons,
            recommendation_caveats: item.caveats,
            recommendation_fit_breakdown: item.fit_breakdown,
            recommendation_risk_flags: item.risk_flags,
            recommendation_debug_formula: item.debug_formula,
          }, 'imported')));

          if (Array.isArray(feed?.data?.sections)) {
            sections = feed.data.sections.map((section: any) => ({
              id: section.id,
              title: section.title,
              description: section.description,
              intent: section.intent,
              items: Array.isArray(section.items)
                ? section.items.map((item: any) => mapJobToRole({
                    ...(item.job || {}),
                    recommendation_fit_score: item.fit_score,
                    recommendation_reasons: item.reasons,
                    recommendation_caveats: item.caveats,
                    recommendation_fit_breakdown: item.fit_breakdown,
                    recommendation_risk_flags: item.risk_flags,
                    recommendation_debug_formula: item.debug_formula,
                  }, 'imported'))
                : [],
            }));
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '');
      if (!/not authenticated|401|403/i.test(message)) {
        console.warn('V2 recommendation feed unavailable, continuing with catalog page', error);
      }
    }

    const catalogResponse = await ApiService.get<any>(`/jobs/?${params.toString()}`);
    const rawCatalogJobs = Array.isArray(catalogResponse)
      ? catalogResponse
      : Array.isArray(catalogResponse?.items)
        ? catalogResponse.items
        : [];
    jobs.push(...rawCatalogJobs.map((job) => mapJobToRole(job, 'imported')));
    totalCount = Number(catalogResponse?.total_count || rawCatalogJobs.length || jobs.length);
    hasMore = Boolean(catalogResponse?.has_more) || offset + rawCatalogJobs.length < totalCount;

    return {
      jobs: dedupeRoles(jobs),
      sections,
      hasMore,
      totalCount,
    };
  } catch (error) {
    console.error('V2 Job Service Error:', error);
    return { jobs: [], sections: [], hasMore: false, totalCount: 0 };
  }
};

export const getMainDatabaseJobCountV2 = async (): Promise<number> => {
  const result = await fetchJobsWithFiltersV2();
  return result.totalCount;
};

export const fetchJobByIdV2 = async (id: string): Promise<Role | null> => {
  try {
    const job = await ApiService.get<any>(`/jobs/${id}`);
    return mapJobToRole(job, 'imported');
  } catch (error) {
    return null;
  }
};
