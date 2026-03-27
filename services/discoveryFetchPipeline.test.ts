import { jest } from '@jest/globals';

jest.mock('./geocodingService', () => ({
  geocodeWithCaching: jest.fn(),
  getStaticCoordinates: jest.fn(),
}));

import { geocodeWithCaching, getStaticCoordinates } from './geocodingService';
import { resolveDiscoveryCoordinates } from './discoveryCoordinates';
import type { UserProfile } from '../types';

const mockedGeocodeWithCaching = geocodeWithCaching as jest.MockedFunction<typeof geocodeWithCaching>;
const mockedGetStaticCoordinates = getStaticCoordinates as jest.MockedFunction<typeof getStaticCoordinates>;

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
