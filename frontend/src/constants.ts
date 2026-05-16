
import { UserProfile } from './types';
import { createDefaultCandidateSearchProfile } from './services/profileDefaults';

// Backend API Configuration. Production calls go directly to the V2 backend
// because the Vercel /api/v2 rewrite can fall through to the SPA fallback.
const DEFAULT_PRODUCTION_BACKEND_URL = '/api/v2';

const normalizeBackendHost = (raw?: string): string => {
  const value = (raw || '').trim();
  
  // If explicitly provided via env var and NOT pointing to localhost, use that
  if (value && !value.startsWith('/') && !value.includes('localhost') && !value.includes('127.0.0.1')) {
    return value.replace(/\/$/, '');
  }

  // Otherwise, use relative path which works for both dev (Vite proxy) and prod (SWA link)
  // This prevents localhost from being baked into production builds.
  return '/api/v2';
};

export const BACKEND_URL = normalizeBackendHost(
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_V2_API_URL ||
  import.meta.env.VITE_BACKEND_URL
);
export const BILLING_BACKEND_URL =
  import.meta.env.VITE_BILLING_BACKEND_URL ||
  import.meta.env.VITE_STRIPE_BACKEND_URL ||
  BACKEND_URL;
export const SEARCH_BACKEND_URL =
  (import.meta.env.DEV ? BACKEND_URL : '') ||
  import.meta.env.VITE_SEARCH_API_URL ||
  import.meta.env.VITE_SEARCH_BACKEND_URL ||
  BACKEND_URL;

export const FEATURE_JOB_INTERACTION_SYNC =
  String(import.meta.env.VITE_ENABLE_JOB_INTERACTION_SYNC || 'false').toLowerCase() === 'true';

// Assessment system flags (stable features, no longer experimental)
export const FEATURE_ASSESSMENT_THREE = true;
export const FEATURE_ASSESSMENT_THREE_GALAXY_V3 = true;
export const FEATURE_ASSESSMENT_THREE_GALAXY_FALLBACK = true;
export const FEATURE_ASSESSMENT_ROLE_DYNAMIC_WORLDS = true;
export const FEATURE_ASSESSMENT_LIVE3D_MOBILE_OPTIN = true;

// Backward-compatible flag used by older assessment router imports.
export const FEATURE_ASSESSMENT_CLASSIC_TOGGLE = true;

// Feature toggles for future features
export const FEATURE_SALARY_BENCHMARKS =
  String(import.meta.env.VITE_FEATURE_SALARY_BENCHMARKS || 'false').toLowerCase() === 'true';

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
