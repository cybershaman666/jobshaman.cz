
import { Job, Candidate, BenefitInsight, CompanyProfile, UserProfile } from './types';
import { createDefaultCandidateSearchProfile } from './services/profileDefaults';

// Backend API Configuration
const getRuntimeBackendHint = (): string => {
  if (typeof document !== 'undefined') {
    const metaValue = document.querySelector('meta[name="backend-url"]')?.getAttribute('content')?.trim() || '';
    if (metaValue && metaValue !== '%VITE_BACKEND_URL%') return metaValue;
  }
  if (typeof window !== 'undefined') {
    const runtimeValue = (window as Window & { __BACKEND_URL__?: string }).__BACKEND_URL__?.trim() || '';
    if (runtimeValue) return runtimeValue;
  }
  return '';
};

const normalizeBackendHost = (raw?: string): string => {
  const value = (raw || '').trim();
  if (!value) {
    const runtimeHint = getRuntimeBackendHint();
    if (runtimeHint) return runtimeHint.replace(/\/$/, '');
    const legacyFallback =
      (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
      (import.meta.env.DEV ? 'http://localhost:8000' : 'https://api.jobshaman.cz');
    if (legacyFallback) return legacyFallback.replace(/\/$/, '');
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
    return 'http://localhost:8000';
  }
  try {
    const parsed = new URL(value);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    // If env contains malformed value, fall back safely.
    const runtimeHint = getRuntimeBackendHint();
    if (runtimeHint) return runtimeHint.replace(/\/$/, '');
    if (import.meta.env.DEV) return 'http://localhost:8000';
    return 'https://api.jobshaman.cz';
  }
};

export const BACKEND_URL = normalizeBackendHost(import.meta.env.VITE_BACKEND_URL);
export const BILLING_BACKEND_URL =
  import.meta.env.VITE_BILLING_BACKEND_URL ||
  import.meta.env.VITE_STRIPE_BACKEND_URL ||
  BACKEND_URL;
export const SEARCH_BACKEND_URL =
  import.meta.env.VITE_SEARCH_API_URL ||
  import.meta.env.VITE_SEARCH_BACKEND_URL ||
  BACKEND_URL;

export const FEATURE_ASSESSMENT_THREE =
  String(import.meta.env.VITE_FEATURE_ASSESSMENT_THREE || 'true').toLowerCase() !== 'false';

export const FEATURE_ASSESSMENT_COCKPIT_V2 =
  String(import.meta.env.VITE_FEATURE_ASSESSMENT_COCKPIT_V2 || 'false').toLowerCase() === 'true';

export const FEATURE_HAPPINESS_AUDIT_THREE =
  false;

export const FEATURE_ASSESSMENT_THREE_GALAXY_V3 =
  String(import.meta.env.VITE_FEATURE_ASSESSMENT_THREE_GALAXY_V3 || 'true').toLowerCase() !== 'false';

export const FEATURE_ASSESSMENT_THREE_GALAXY_FALLBACK =
  String(import.meta.env.VITE_FEATURE_ASSESSMENT_THREE_GALAXY_FALLBACK || 'true').toLowerCase() !== 'false';

export const FEATURE_ASSESSMENT_ROLE_DYNAMIC_WORLDS =
  String(import.meta.env.VITE_FEATURE_ASSESSMENT_ROLE_DYNAMIC_WORLDS || 'true').toLowerCase() !== 'false';

export const FEATURE_ASSESSMENT_LIVE3D_MOBILE_OPTIN =
  String(import.meta.env.VITE_FEATURE_ASSESSMENT_LIVE3D_MOBILE_OPTIN || 'true').toLowerCase() !== 'false';

export const FEATURE_ASSESSMENT_JOURNEY_EXPERIENCE_V1 =
  String(import.meta.env.VITE_FEATURE_ASSESSMENT_JOURNEY_EXPERIENCE_V1 || 'false').toLowerCase() === 'true';


export const FEATURE_SALARY_BENCHMARKS =
  String(import.meta.env.VITE_FEATURE_SALARY_BENCHMARKS || 'false').toLowerCase() === 'true';

// Backward-compatible flag used by older assessment router imports.
export const FEATURE_ASSESSMENT_CLASSIC_TOGGLE =
  String(import.meta.env.VITE_FEATURE_ASSESSMENT_CLASSIC_TOGGLE || 'true').toLowerCase() !== 'false';

// EMPTY - Using Live Supabase Data
export const MOCK_JOBS: Job[] = [];

export const MOCK_CANDIDATES: Candidate[] = [
  {
    id: 'c1',
    name: 'Jana K.',
    role: 'Senior React Dev',
    experienceYears: 6,
    salaryExpectation: 130000,
    skills: ['React', 'TypeScript', 'Node.js', 'AWS'],
    bio: 'Zkušená vývojářka, která preferuje stabilitu a čistý kód před startupovým chaosem.',
    flightRisk: 'Low',
    values: ['Stabilita', 'Kvalita kódu', 'Work-Life Balance']
  },
  {
    id: 'c2',
    name: 'Petr S.',
    role: 'Fullstack Engineer',
    experienceYears: 2,
    salaryExpectation: 80000,
    skills: ['JavaScript', 'Vue.js', 'Firebase'],
    bio: 'Rychle se učím, hledám mentora. Ochotný pracovat přesčas za equity.',
    flightRisk: 'High', // Job hopper potential
    values: ['Rychlý růst', 'Peníze', 'Nové technologie']
  },
  {
    id: 'c3',
    name: 'Martin V.',
    role: 'Tech Lead',
    experienceYears: 12,
    salaryExpectation: 160000,
    skills: ['System Design', 'Team Leadership', 'Java', 'Kotlin'],
    bio: 'Bývalý CTO malého startupu. Hledám roli, kde mohu stavět tým od nuly.',
    flightRisk: 'Medium',
    values: ['Vliv', 'Autonomie', 'Vize']
  }
];

export const MOCK_COMPANY_PROFILE: CompanyProfile = {
  id: 'mock_company_id',
  name: "Naše Firma s.r.o.",
  industry: "Technology",
  tone: "Professional but friendly",
  values: ["Transparentnost", "Work-Life Balance", "Kvalita nad kvantitu"],
  philosophy: "Věříme, že spokojení zaměstnanci dělají nejlepší produkty. Neslibujeme nemožné, ale garantujeme férovost."
};

export const MOCK_BENEFIT_STATS: BenefitInsight[] = [
  {
    name: "Remote First / Full Remote",
    category: "Lifestyle",
    popularityScore: 98,
    marketAdoption: 15,
    impactOnRetention: "High"
  },
  {
    name: "4-denní pracovní týden",
    category: "Lifestyle",
    popularityScore: 95,
    marketAdoption: 2,
    impactOnRetention: "High"
  },
  {
    name: "Flexibilní začátek/konec doby",
    category: "Lifestyle",
    popularityScore: 90,
    marketAdoption: 60,
    impactOnRetention: "Medium"
  },
  {
    name: "Zaměstnanecké akcie",
    category: "Financial",
    popularityScore: 85,
    marketAdoption: 10,
    impactOnRetention: "High"
  },
  {
    name: "Placené volno nad rámec zákona (Sick days, 6. týden)",
    category: "Health",
    popularityScore: 80,
    marketAdoption: 40,
    impactOnRetention: "Medium"
  },
  {
    name: "Rozpočet na vzdělávání",
    category: "Growth",
    popularityScore: 75,
    marketAdoption: 30,
    impactOnRetention: "Medium"
  },
  {
    name: "MultiSport Karta",
    category: "Health",
    popularityScore: 60,
    marketAdoption: 70,
    impactOnRetention: "Low"
  },
  {
    name: "Pizza days / Ovoce v kanclu",
    category: "Lifestyle",
    popularityScore: 20,
    marketAdoption: 80,
    impactOnRetention: "Low"
  }
];

export const JHI_COLORS = {
  high: '#059669', // Emerald 600
  medium: '#d97706', // Amber 600
  low: '#dc2626' // Red 600
};

// Default user profile
export const DEFAULT_USER_PROFILE: UserProfile = {
  isLoggedIn: false,
  name: '',
  email: '',
  address: '',
  transportMode: 'public',
  preferences: {
    workLifeBalance: 50,
    financialGoals: 50,
    commuteTolerance: 45,
    priorities: [],
    searchProfile: createDefaultCandidateSearchProfile(),
    profile_visibility: 'recruiter'
  },
  taxProfile: {
    countryCode: 'CZ',
    taxYear: 2026,
    employmentType: 'employee',
    maritalStatus: 'single',
    spouseAnnualIncome: 0,
    childrenCount: 0,
    isSingleParent: false,
    specialReliefs: []
  },
  jhiPreferences: {
    pillarWeights: {
      financial: 0.3,
      timeCost: 0.25,
      mentalLoad: 0.2,
      growth: 0.15,
      values: 0.1
    },
    hardConstraints: {
      mustRemote: false,
      maxCommuteMinutes: null,
      minNetMonthly: null,
      excludeShift: false,
      growthRequired: false
    },
    workStyle: {
      peopleIntensity: 50,
      careerGrowthPreference: 50,
      homeOfficePreference: 50
    }
  }
};
