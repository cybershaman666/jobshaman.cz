import { geocodeWithCaching, getStaticCoordinates } from './geocodingService';
import type { UserProfile } from '../types';

export interface ResolveDiscoveryCoordinatesArgs {
  userProfile: UserProfile;
  enableCommuteFilter: boolean;
  filterCity: string;
  allowProfileAddressGeocode?: boolean;
}

export const resolveDiscoveryCoordinates = async ({
  userProfile,
  enableCommuteFilter,
  filterCity,
  allowProfileAddressGeocode = false,
}: ResolveDiscoveryCoordinatesArgs): Promise<{ lat?: number; lon?: number }> => {
  let lat = userProfile.coordinates?.lat;
  let lon = userProfile.coordinates?.lon;

  if ((lat == null || lon == null) && (enableCommuteFilter || allowProfileAddressGeocode) && userProfile.address) {
    const addressCoords = getStaticCoordinates(userProfile.address) || await geocodeWithCaching(userProfile.address);
    if (addressCoords) {
      lat = addressCoords.lat;
      lon = addressCoords.lon;
    }
  }

  if ((lat == null || lon == null) && filterCity && (enableCommuteFilter || allowProfileAddressGeocode)) {
    const cityCoords = getStaticCoordinates(filterCity);
    if (cityCoords) {
      lat = cityCoords.lat;
      lon = cityCoords.lon;
    }
  }

  return { lat: lat ?? undefined, lon: lon ?? undefined };
};
