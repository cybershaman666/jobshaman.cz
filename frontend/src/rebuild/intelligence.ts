import type { Job, UserProfile } from '../types';
import { calculateCommuteReality } from '../services/commuteService';
import { estimateNetSalaryByCountry } from '../services/financialService';
import { calculateJHI } from '../utils/jhiCalculator';
import type { CandidatePreferenceProfile, Role, RoleEvaluationSnapshot } from './models';

const getBorderCountryLabel = (countryCode: Role['countryCode'], t: any): string => {
  const labels: Record<Role['countryCode'], { key: string; def: string }> = {
    CZ: { key: 'rebuild.intelligence.market_domestic', def: 'Domestic market' },
    SK: { key: 'rebuild.intelligence.market_sk', def: 'Border Slovakia' },
    PL: { key: 'rebuild.intelligence.market_pl', def: 'Border Poland' },
    DE: { key: 'rebuild.intelligence.market_de', def: 'Border Germany' },
    AT: { key: 'rebuild.intelligence.market_at', def: 'Border Austria' },
  };
  const label = labels[countryCode] || labels.CZ;
  return t(label.key, { defaultValue: label.def });
};

export const roleToLegacyJob = (role: Role): Job => {
  const salaryRange = `${role.salaryFrom.toLocaleString('cs-CZ')} - ${role.salaryTo.toLocaleString('cs-CZ')} ${role.currency}`;
  return {
    id: role.id,
    title: role.title,
    company: role.companyId,
    location: role.location,
    type: role.workModel,
    work_model: role.workModel,
    salaryRange,
    description: `${role.summary}\n\n${role.challenge}\n\n${role.mission}`,
    postedAt: new Date().toISOString(),
    source: role.source === 'curated' ? 'jobshaman_curated' : 'jobshaman_import',
    jhi: calculateJHI({
      title: role.title,
      location: role.location,
      type: role.workModel,
      benefits: role.benefits,
      description: `${role.summary} ${role.challenge}`,
      salary_from: role.salaryFrom,
      salary_to: role.salaryTo,
      work_model: role.workModel,
    }),
    noiseMetrics: { score: 12, manipulativePatterns: [], obligationsWithoutValue: [], genericFluff: [], jargonClusters: [] } as any,
    transparency: { score: 82, strengths: ['Salary visible', 'Clear mission'], warnings: [] } as any,
    market: { demandSignal: 'strong', salarySignal: 'transparent', competitionLevel: 'healthy' } as any,
    tags: [...role.skills],
    benefits: role.benefits,
    required_skills: role.skills,
    challenge: role.challenge,
    firstStepPrompt: role.firstStep,
    listingKind: role.source === 'curated' ? 'challenge' : 'imported',
    country_code: role.countryCode,
    source_kind: role.source as any,
    lat: role.coordinates.lat,
    lng: role.coordinates.lng,
    salary_from: role.salaryFrom,
    salary_to: role.salaryTo,
  } as Job;
};

export const preferencesToLegacyUser = (profile: CandidatePreferenceProfile): UserProfile => ({
  id: 'candidate-session',
  name: profile.name,
  isLoggedIn: true,
  address: profile.address,
  coordinates: profile.coordinates,
  transportMode: profile.transportMode,
  preferences: {
    workLifeBalance: 72,
    financialGoals: 68,
    commuteTolerance: profile.commuteToleranceMinutes,
    priorities: ['Growth', 'Signal clarity'],
    searchProfile: {
      nearBorder: profile.borderSearchEnabled,
      dogCount: 0,
      wantsContractorRoles: false,
      wantsDogFriendlyOffice: false,
      wantsRemoteRoles: false,
      preferredWorkArrangement: null,
      remoteLanguageCodes: ['cs'],
      preferredBenefitKeys: [],
      defaultEnableCommuteFilter: profile.commuteFilterEnabled,
      defaultMaxDistanceKm: profile.searchRadiusKm,
      primaryDomain: null,
      secondaryDomains: [],
      avoidDomains: [],
      targetRole: '',
      seniority: null,
      includeAdjacentDomains: true,
      inferredPrimaryDomain: null,
      inferredTargetRole: '',
      inferenceSource: 'none',
      inferenceConfidence: null,
    },
  },
  taxProfile: profile.taxProfile,
  jhiPreferences: {
    ...profile.jhiPreferences,
    hardConstraints: {
      ...profile.jhiPreferences.hardConstraints,
      maxCommuteMinutes: profile.commuteFilterEnabled ? profile.commuteToleranceMinutes : null,
    },
  },
});

export const evaluateRole = (role: Role, profile: CandidatePreferenceProfile, t: any): RoleEvaluationSnapshot => {
  const legacyJob = roleToLegacyJob(role);
  const legacyUser = preferencesToLegacyUser(profile);
  const commute = calculateCommuteReality(legacyJob, legacyUser);
  const fallbackNet = estimateNetSalaryByCountry(
    Math.round((role.salaryFrom + role.salaryTo) / 2),
    false,
    role.countryCode,
    role.location,
    role.currency,
    profile.taxProfile,
  );
  const jhi = calculateJHI(
    {
      title: role.title,
      location: role.location,
      type: role.workModel,
      benefits: role.benefits,
      description: `${role.summary} ${role.challenge}`,
      salary_from: role.salaryFrom,
      salary_to: role.salaryTo,
      work_model: role.workModel,
    },
    0,
    profile.jhiPreferences,
  );
  const takeHome = Math.round(commute?.financialReality.netBaseSalary || fallbackNet.net);
  const commuteCost = Math.round(commute?.financialReality.commuteCost || 0);
  const totalValue = Math.round(commute?.financialReality.finalRealMonthlyValue || fallbackNet.net);
  const commuteMinutes = Math.round(commute?.timeMinutes || 0);
  const financialReality = commute?.financialReality;
  const taxBreakdown = financialReality?.taxBreakdown || fallbackNet.breakdown;
  const borderEligible = role.countryCode !== 'CZ';
  const borderFitLabel = borderEligible
    ? profile.borderSearchEnabled
      ? t('rebuild.intelligence.border_active', { defaultValue: '{{country}} active', country: getBorderCountryLabel(role.countryCode, t) })
      : t('rebuild.intelligence.border_disabled', { defaultValue: '{{country}} disabled', country: getBorderCountryLabel(role.countryCode, t) })
    : getBorderCountryLabel('CZ', t);

  return {
    roleId: role.id,
    jhi,
    takeHomeMonthly: takeHome,
    commuteMonthlyCost: commuteCost,
    commuteMinutesOneWay: commuteMinutes,
    commuteDistanceKm: Math.max(0, Math.round((commute?.distanceKm || 0) * 10) / 10),
    avoidedCommuteCost: Math.round(financialReality?.avoidedCommuteCost || 0),
    benefitsValue: Math.round(financialReality?.benefitsValue || 0),
    grossMonthlySalary: Math.round(financialReality?.grossMonthlySalary || Math.round((role.salaryFrom + role.salaryTo) / 2)),
    estimatedTaxAndInsurance: Math.round(financialReality?.estimatedTaxAndInsurance || fallbackNet.tax || 0),
    financialScoreAdjustment: Math.round(financialReality?.scoreAdjustment || 0),
    taxEffectiveRate: Math.round((taxBreakdown?.effectiveRate || 0) * 10) / 10,
    taxBreakdownDetails: taxBreakdown?.details || [],
    taxRuleVersion: financialReality?.ruleVersion || fallbackNet.ruleVersion,
    isContractorMode: Boolean(financialReality?.isIco),
    parkingWarning: commute?.parkingWarning,
    isRelocation: commute?.isRelocation,
    totalRealMonthlyValue: totalValue,
    borderFitLabel,
    borderEligible,
    taxRuleLabel: `${profile.taxProfile.countryCode} ${profile.taxProfile.taxYear}`,
    summary:
      role.source === 'curated'
        ? t('rebuild.intelligence.summary_curated', { 
            defaultValue: 'JHI {{score}}/100, estimated net value {{value}} {{currency}} monthly and direct branded journey entry.',
            score: jhi.personalizedScore,
            value: totalValue.toLocaleString(t('rebuild.locale', { defaultValue: 'en-GB' })),
            currency: role.currency
          })
        : t('rebuild.intelligence.summary_imported', { 
            defaultValue: 'JHI {{score}}/100, realistic outbound preparation considering {{fit}} fit and real costs.',
            score: jhi.personalizedScore,
            fit: borderEligible ? t('rebuild.intelligence.border', { defaultValue: 'border' }) : t('rebuild.intelligence.domestic', { defaultValue: 'domestic' })
          }),
  };
};

const normalizeDiscoverySearchText = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const DRIVER_QUERY_TOKENS = new Set(['ridic', 'ridicsky', 'ridicske', 'driver', 'fahrer', 'kierowca', 'vodic', 'kuryr', 'kurier']);

export const roleMatchesDiscovery = (role: Role, _profile: CandidatePreferenceProfile, search: string, onlyCurated: boolean): boolean => {
  if (onlyCurated && role.source !== 'curated') return false;
  const query = normalizeDiscoverySearchText(search);
  if (query) {
    const queryTokens = query.split(' ').filter(Boolean);
    const hasDriverQuery = queryTokens.some((token) => DRIVER_QUERY_TOKENS.has(token));
    const primaryHaystack = normalizeDiscoverySearchText([
      role.title,
      role.team,
      role.companyName || '',
      role.skills.join(' '),
      role.featuredInsights.join(' '),
    ].join(' '));
    const haystack = normalizeDiscoverySearchText([
      role.title,
      role.team,
      role.companyName || '',
      role.location,
      role.summary,
      role.challenge,
      role.mission,
      role.firstStep,
      role.description,
      role.roleSummary || '',
      role.companyNarrative || '',
      role.contractType || '',
      role.skills.join(' '),
      role.benefits.join(' '),
      role.featuredInsights.join(' '),
    ].join(' '));
    if (hasDriverQuery && !queryTokens.some((token) => DRIVER_QUERY_TOKENS.has(token) && primaryHaystack.includes(token))) {
      return false;
    }
    if (!queryTokens.every((token) => haystack.includes(token))) return false;
  }
  return true;
};
