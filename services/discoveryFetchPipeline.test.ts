import { jest } from '@jest/globals';

jest.mock('./geocodingService', () => ({
  geocodeWithCaching: jest.fn(),
  getStaticCoordinates: jest.fn(),
}));

jest.mock('./runtimeSignals', () => ({
  recordRuntimeSignal: jest.fn(),
}));

jest.mock('./jobService', () => ({
  dedupeJobsList: jest.fn((jobs: unknown[]) => jobs),
  fetchExternalOverlayJobs: jest.fn(),
  fetchJobsPaginated: jest.fn(),
  fetchJobsWithFilters: jest.fn(),
}));

import { geocodeWithCaching, getStaticCoordinates } from './geocodingService';
import { resolveDiscoveryCoordinates } from './discoveryCoordinates';
import { fetchExternalOverlayJobs, fetchJobsWithFilters } from './jobService';
import { applyExternalOverlayJobFilters, runFilteredFetchPipeline } from '../hooks/discovery/discoveryFetchPipeline';
import { createDomesticCountrySafeguard } from '../hooks/discovery/discoverySafeguards';
import type { Job, UserProfile } from '../types';

const mockedGeocodeWithCaching = geocodeWithCaching as jest.MockedFunction<typeof geocodeWithCaching>;
const mockedGetStaticCoordinates = getStaticCoordinates as jest.MockedFunction<typeof getStaticCoordinates>;
const mockedFetchJobsWithFilters = fetchJobsWithFilters as jest.MockedFunction<typeof fetchJobsWithFilters>;
const mockedFetchExternalOverlayJobs = fetchExternalOverlayJobs as jest.MockedFunction<typeof fetchExternalOverlayJobs>;

const makeProfile = (overrides?: Partial<UserProfile>): UserProfile => ({
  id: 'candidate-1',
  isLoggedIn: true,
  name: 'Candidate',
  email: 'candidate@example.com',
  role: 'candidate',
  address: 'Brno',
  preferences: {
    workLifeBalance: 50,
    financialGoals: 50,
    commuteTolerance: 45,
    priorities: [],
  },
  ...overrides,
}) as UserProfile;

describe('resolveDiscoveryCoordinates', () => {
  beforeEach(() => {
    mockedGeocodeWithCaching.mockReset();
    mockedGetStaticCoordinates.mockReset();
    mockedFetchJobsWithFilters.mockReset();
    mockedFetchExternalOverlayJobs.mockReset();
  });

  test('geocodes the profile address for implicit radius filtering even when commute toggle is off', async () => {
    mockedGetStaticCoordinates.mockReturnValue(null);
    mockedGeocodeWithCaching.mockResolvedValue({ lat: 49.1951, lon: 16.6068 });

    const coords = await resolveDiscoveryCoordinates({
      userProfile: makeProfile({ coordinates: undefined, address: 'Brno' }),
      enableCommuteFilter: false,
      filterCity: '',
      allowProfileAddressGeocode: true,
    });

    expect(mockedGeocodeWithCaching).toHaveBeenCalledWith('Brno');
    expect(coords).toEqual({ lat: 49.1951, lon: 16.6068 });
  });

  test('does not geocode profile address when there is no explicit or implicit commute need', async () => {
    mockedGetStaticCoordinates.mockReturnValue(null);

    const coords = await resolveDiscoveryCoordinates({
      userProfile: makeProfile({ coordinates: undefined, address: 'Brno' }),
      enableCommuteFilter: false,
      filterCity: '',
      allowProfileAddressGeocode: false,
    });

    expect(mockedGeocodeWithCaching).not.toHaveBeenCalled();
    expect(coords).toEqual({ lat: undefined, lon: undefined });
  });
});

describe('applyExternalOverlayJobFilters', () => {
  test('keeps remote roles outside commute radius but drops onsite jobs without usable distance', () => {
    const jobs = [
      {
        id: 'remote-no-coords',
        title: 'Product Owner',
        company: 'Remote Co',
        location: 'Remote',
        description: 'Fully remote role.',
        work_model: 'remote',
        listingKind: 'imported',
      },
      {
        id: 'onsite-no-coords',
        title: 'Store Manager',
        company: 'Retail Co',
        location: 'Praha',
        description: 'Onsite retail role.',
        work_model: 'onsite',
        listingKind: 'imported',
      },
      {
        id: 'onsite-near',
        title: 'Operations Manager',
        company: 'Ops Co',
        location: 'Brno',
        description: 'Onsite role nearby.',
        work_model: 'onsite',
        lat: 49.1951,
        lng: 16.6068,
      },
    ] as Job[];

    const filtered = applyExternalOverlayJobFilters({
      jobs,
      effectiveCountryCodes: undefined,
      excludeCountryCodes: undefined,
      retrievalLanguageCodes: undefined,
      remoteOnly: false,
      filterWorkArrangement: 'all',
      filterCity: '',
      enableCommuteFilter: true,
      filterMaxDistance: 45,
      lat: 49.1951,
      lon: 16.6068,
      inferJobCountryCode: () => 'cz',
      inferJobLanguageCode: () => 'cs',
      normalizeCountryCodes: (codes) => codes,
      calculateDistanceKm: () => 0,
      defaultMaxDistanceKm: 45,
    });

    expect(filtered.map((job) => job.id)).toEqual(['remote-no-coords', 'onsite-near']);
  });
});

describe('createDomesticCountrySafeguard', () => {
  test('blocks remote cross-border spillover during commute-based browse mode', () => {
    const safeguard = createDomesticCountrySafeguard({
      countryCodes: ['CZ'],
      marketBaselineCountryCodes: ['CZ'],
      enableCommuteFilter: true,
      globalSearch: false,
      abroadOnly: false,
      filterLanguageCodes: [],
    });

    const jobs = safeguard([
      {
        id: 'cz-remote',
        title: 'Remote Product Manager',
        company: 'CZ Co',
        location: 'Brno, Czech Republic',
        description: 'Remote role',
        work_model: 'remote',
        country_code: 'CZ',
      } as Job,
      {
        id: 'us-remote',
        title: 'Remote Product Manager',
        company: 'US Co',
        location: 'Austin, United States',
        description: 'Remote role',
        work_model: 'remote',
        country_code: 'US',
      } as Job,
      {
        id: 'at-onsite',
        title: 'Operations Manager',
        company: 'AT Co',
        location: 'Vienna, Austria',
        description: 'Onsite role',
        work_model: 'onsite',
        country_code: 'AT',
      } as Job,
    ]);

    expect(jobs.map((job) => job.id)).toEqual(['cz-remote', 'at-onsite']);
  });
});

describe('runFilteredFetchPipeline', () => {
  const abortController = new AbortController();

  test('does not trigger seed recovery during commute-based sparse browse mode', async () => {
    mockedFetchJobsWithFilters.mockResolvedValue({
      jobs: [
        {
          id: 'local-1',
          title: 'Operations Manager',
          company: 'Acme',
          location: 'Brno',
          description: 'Local operations role',
          work_model: 'onsite',
          lat: 49.1951,
          lng: 16.6068,
        },
        {
          id: 'local-2',
          title: 'Product Operations Lead',
          company: 'Acme',
          location: 'Brno',
          description: 'Another local role',
          work_model: 'hybrid',
          lat: 49.2,
          lng: 16.61,
        },
      ] as Job[],
      hasMore: false,
      totalCount: 2,
      meta: {},
    });
    mockedFetchExternalOverlayJobs.mockResolvedValue([
      {
        id: 'remote-1',
        title: 'Remote Product Owner',
        company: 'Remote Co',
        location: 'Remote',
        description: 'Remote role seeded by intent',
        work_model: 'remote',
        listingKind: 'imported',
      } as Job,
    ]);

    const result = await runFilteredFetchPipeline({
      page: 0,
      pageSize: 50,
      searchTerm: '',
      sortBy: 'newest',
      searchMode: 'discovery_default',
      filterCity: '',
      filterContractType: [],
      filterBenefits: [],
      filterMinSalary: 0,
      filterDate: 'all',
      filterExperience: [],
      effectiveRadiusKm: 45,
      lat: 49.1951,
      lon: 16.6068,
      effectiveCountryCodes: ['cz'],
      excludeCountryCodes: [],
      retrievalLanguageCodes: ['cs'],
      remoteOnly: false,
      filterWorkArrangement: 'all',
      externalSearchSeedTerm: 'operations manager',
      microJobsOnly: false,
      abortSignal: abortController.signal,
      userProfile: makeProfile(),
      filterDismissedJobs: (jobs) => jobs,
      applyDomesticCountrySafeguard: (jobs) => jobs,
      applyExternalRecoveryFilters: (jobs) => jobs,
      isStaleRequest: () => false,
      getSourceMixCounts: () => ({}),
    });

    expect(mockedFetchExternalOverlayJobs).not.toHaveBeenCalled();
    expect(result?.visibleJobs.map((job) => job.id)).toEqual(['local-1', 'local-2']);
    expect(result?.resolvedTotalCount).toBe(2);
  });

  test('supplements sparse browse mode with seed-based external recovery when commute radius is off', async () => {
    mockedFetchJobsWithFilters.mockResolvedValue({
      jobs: [
        {
          id: 'local-1',
          title: 'Operations Manager',
          company: 'Acme',
          location: 'Brno',
          description: 'Local operations role',
          work_model: 'onsite',
        },
      ] as Job[],
      hasMore: false,
      totalCount: 1,
      meta: {},
    });
    mockedFetchExternalOverlayJobs.mockResolvedValue([
      {
        id: 'remote-1',
        title: 'Remote Product Owner',
        company: 'Remote Co',
        location: 'Remote',
        description: 'Remote role seeded by intent',
        work_model: 'remote',
        listingKind: 'imported',
      } as Job,
    ]);

    const result = await runFilteredFetchPipeline({
      page: 0,
      pageSize: 50,
      searchTerm: '',
      sortBy: 'newest',
      searchMode: 'discovery_default',
      filterCity: '',
      filterContractType: [],
      filterBenefits: [],
      filterMinSalary: 0,
      filterDate: 'all',
      filterExperience: [],
      effectiveRadiusKm: undefined,
      lat: undefined,
      lon: undefined,
      effectiveCountryCodes: ['cz'],
      excludeCountryCodes: [],
      retrievalLanguageCodes: ['cs'],
      remoteOnly: false,
      filterWorkArrangement: 'all',
      externalSearchSeedTerm: 'operations manager',
      microJobsOnly: false,
      abortSignal: abortController.signal,
      userProfile: makeProfile(),
      filterDismissedJobs: (jobs) => jobs,
      applyDomesticCountrySafeguard: (jobs) => jobs,
      applyExternalRecoveryFilters: (jobs) => jobs,
      isStaleRequest: () => false,
      getSourceMixCounts: () => ({}),
    });

    expect(mockedFetchExternalOverlayJobs).toHaveBeenCalled();
    expect(result?.visibleJobs.map((job) => job.id)).toEqual(['local-1', 'remote-1']);
    expect(result?.resolvedTotalCount).toBe(2);
  });
});
