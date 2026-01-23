
import { Job, UserProfile, CommuteAnalysis } from '../types';
import { 
  parseMonthlySalary, 
  calculateBenefitsValue, 
  detectCurrency, 
  calculateFinancialScoreAdjustment,
  estimateCzechNetSalary,
  detectCurrencyFromLocation
} from './financialService';

// --- GEOLOCATION DATA (Expanded for CZ + SK) ---

const CITIES_DB: Record<string, { lat: number, lon: number }> = {
    // --- Major Czech Cities ---
    'praha': { lat: 50.0755, lon: 14.4378 },
    'prague': { lat: 50.0755, lon: 14.4378 },
    'brno': { lat: 49.1951, lon: 16.6068 },
    'ostrava': { lat: 49.8209, lon: 18.2625 },
    'plzen': { lat: 49.7384, lon: 13.3736 },
    'plzeň': { lat: 49.7384, lon: 13.3736 },
    'liberec': { lat: 50.7663, lon: 15.0543 },
    'olomouc': { lat: 49.5938, lon: 17.2509 },
    'ceske budejovice': { lat: 48.9745, lon: 14.4743 },
    'české budějovice': { lat: 48.9745, lon: 14.4743 },
    'hradec kralove': { lat: 50.2104, lon: 15.8252 },
    'hradec králové': { lat: 50.2104, lon: 15.8252 },
    'ustinad labem': { lat: 50.6611, lon: 14.0520 },
    'ústí nad labem': { lat: 50.6611, lon: 14.0520 },
    'pardubice': { lat: 50.0343, lon: 15.7812 },
    'zlin': { lat: 49.2242, lon: 17.6627 },
    'zlín': { lat: 49.2242, lon: 17.6627 },
    'havirov': { lat: 49.7798, lon: 18.4369 },
    'havířov': { lat: 49.7798, lon: 18.4369 },
    'kladno': { lat: 50.1473, lon: 14.1029 },
    'most': { lat: 50.5030, lon: 13.6362 },
    'opava': { lat: 49.9387, lon: 17.9026 },
    'frydek mistek': { lat: 49.6819, lon: 18.3673 },
    'frýdek-místek': { lat: 49.6819, lon: 18.3673 },
    'karvina': { lat: 49.8540, lon: 18.5417 },
    'karviná': { lat: 49.8540, lon: 18.5417 },
    'jihlava': { lat: 49.3961, lon: 15.5912 },
    'teplice': { lat: 50.6611, lon: 13.8245 },
    'decin': { lat: 50.7822, lon: 14.2148 },
    'děčín': { lat: 50.7822, lon: 14.2148 },
    'karlovy vary': { lat: 50.2319, lon: 12.8720 },
    'chomutov': { lat: 50.4605, lon: 13.4178 },
    'jablonec nad nisou': { lat: 50.7243, lon: 15.1710 },
    'mlada boleslav': { lat: 50.4124, lon: 14.9056 },
    'mladá boleslav': { lat: 50.4124, lon: 14.9056 },
    'prostejov': { lat: 49.4719, lon: 17.1128 },
    'prostějov': { lat: 49.4719, lon: 17.1128 },
    
    // --- Specific Villages/Towns requested by users ---
    'popice': { lat: 48.9284, lon: 16.6664 },
    'hustopece': { lat: 48.9408, lon: 16.7378 },
    'hustopeče': { lat: 48.9408, lon: 16.7378 },
    'mikulov': { lat: 48.8056, lon: 16.6378 },
    'breclav': { lat: 48.7590, lon: 16.8820 },
    'břeclav': { lat: 48.7590, lon: 16.8820 },
};

// --- UTILITIES ---

const removeAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Helper to check if location implies foreign country
const isLocationAbroad = (location: string): boolean => {
    const loc = removeAccents(location);
    const foreignKeywords = [
        'nemecko', 'nemecko', 'germany', 'deutschland', 
        'rakousko', 'austria', 'osterreich', 
        'usa', 'spojene staty', 
        'uk', 'britanie', 'london', 'londyn',
        'polsko', 'poland',
        'svycarsko', 'switzerland',
        'nizozemi', 'netherlands'
    ];
    
    return foreignKeywords.some(kw => loc.includes(kw));
};

// EXPORTED FOR ASYNC USE IN PROFILE
export const resolveAddressToCoordinates = async (address: string): Promise<{ lat: number, lon: number } | null> => {
    if (!address) return null;
    
    // 1. Try Local DB first (Instant)
    const localResult = getCoordinates(address);
    if (localResult) return localResult;

    // 2. Try Nominatim (OpenStreetMap) - Rate Limited
    try {
        const query = encodeURIComponent(address);
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
            headers: {
                'User-Agent': 'JobShaman-App/1.0' // Polite user agent
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lon: parseFloat(data[0].lon)
                };
            }
        }
    } catch (e) {
        console.warn("Geocoding failed for", address, e);
    }

    return null;
};

export const getCoordinates = (address: string): { lat: number, lon: number } | null => {
    if (!address) return null;
    const normalized = removeAccents(address);
    
    // Exact or contains match in DB
    // 1. Exact match keys
    if (CITIES_DB[normalized]) return CITIES_DB[normalized];

    // 2. Check for city name inside the string (e.g., "Hlavní 99, Popice" -> contains "Popice")
    // We sort keys by length descending to match "Mladá Boleslav" before "Boleslav"
    const keys = Object.keys(CITIES_DB).sort((a, b) => b.length - a.length);
    for (const key of keys) {
        // We use word boundary check or simple includes
        if (normalized.includes(key)) {
            return CITIES_DB[key];
        }
    }
    
    return null;
};

// Haversine formula for distance in km
const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    const d = R * c; // Distance in km
    return d;
};

const deg2rad = (deg: number) => deg * (Math.PI / 180);

// Simulation constants (Adjusted for CZK Reality)
const COST_PER_KM_BASE = {
  car: 0.20, // ~5 CZK/km (Fuel ~2.1 CZK + Wear/Service ~2.9 CZK)
  public: 0.10, // ~2.5 CZK/km (General Train/Bus rate baseline)
  bike: 0.05, // Maintenance
  walk: 0
};

// Speed constants
const SPEED_KMPH = {
  car: 45, // Average speed including city traffic
  public: 30, // Average door-to-door public transport speed
  bike: 18,
  walk: 5
};

const PAID_PARKING_ZONES = ['praha 1', 'praha 2', 'praha 3', 'praha 7', 'brno-stred'];

export const calculateCommuteReality = (job: Job, user: UserProfile): CommuteAnalysis | null => {
  if (!user.address) {
    return null;
  }

  // 1. Calculate Physical Commute
  const isRemote = job.type === 'Remote';
  const isAbroad = isLocationAbroad(job.location);
  let distanceKm = 0;
  let isRelocation = isAbroad; 

  if (!isRemote) {
      // Priority: Use stored coordinates if available, otherwise fallback to text lookup
      const userCoords = user.coordinates || getCoordinates(user.address);
      const jobCoords = getCoordinates(job.location);

      if (userCoords && jobCoords) {
          // Calculate real air distance
          const airDistance = calculateDistanceKm(userCoords.lat, userCoords.lon, jobCoords.lat, jobCoords.lon);
          // Apply road factor (usually ~1.3x air distance)
          distanceKm = Math.round(airDistance * 1.3);
          
          if (distanceKm > 200) {
              isRelocation = true;
          }
      } else {
          if (isAbroad) {
              isRelocation = true;
              distanceKm = 9999;
          } else {
              distanceKm = -1; 
          }
      }
  }
  
  const avoidedDistanceKm = isRemote ? 20 : 0; 

  const mode = user.transportMode;
  const timeMinutes = (isRemote || isRelocation || distanceKm === -1) ? 0 : Math.round((distanceKm / SPEED_KMPH[mode]) * 60);

  // 2. Determine Financial Baseline (Gross & Currency)
  let grossMonthlySalary = 0;
  let currency = '€';

  // Priority 1: Real Salary Range
  if (job.salaryRange && job.salaryRange !== "Mzda neuvedena") {
      currency = detectCurrency(job.salaryRange);
      grossMonthlySalary = parseMonthlySalary(job.salaryRange);
  } 
  // Priority 2: AI Estimate
  else if (job.aiEstimatedSalary) {
      currency = job.aiEstimatedSalary.currency;
      grossMonthlySalary = Math.round((job.aiEstimatedSalary.min + job.aiEstimatedSalary.max) / 2);
  }
  // Priority 3: Fallback Location Detection
  else {
      currency = detectCurrencyFromLocation(job.location);
      // Keep gross 0, but currency correct for benefits/commute calc
  }

  // Normalize CZK strings
  if (currency === 'Kč') currency = 'CZK';

  // Commute Cost Calculation
  const currencyMultiplier = currency === 'CZK' ? 25 : 1;
  const costPerKm = COST_PER_KM_BASE[mode] * currencyMultiplier;
  
  // Base Monthly Cost: 2 trips * 20 days
  let monthlyCost = (isRemote || isRelocation || distanceKm === -1) ? 0 : Math.round(distanceKm * costPerKm * 2 * 20); 
  
  // --- CAR SPECIFIC LOGIC ---
  let parkingWarning = undefined;
  if (!isRemote && !isRelocation && distanceKm !== -1 && mode === 'car') {
      const jobLocNormalized = removeAccents(job.location);
      const isPaidZone = PAID_PARKING_ZONES.some(zone => jobLocNormalized.includes(zone));
      
      const hasParkingBenefit = job.benefits.some(b => 
          b.toLowerCase().includes('parkování') || 
          b.toLowerCase().includes('garáž') ||
          b.toLowerCase().includes('vlastní místo')
      );

      if (isPaidZone && !hasParkingBenefit) {
          parkingWarning = "Pozor: Zóny placeného stání. Bez firemního místa může parkování stát 3-5 000 Kč měsíčně.";
          if (currency === 'CZK') {
              monthlyCost += 3500; 
          }
      }
  }

  // --- PUBLIC TRANSPORT SPECIFIC LOGIC ---
  if (!isRemote && !isRelocation && distanceKm !== -1 && mode === 'public' && currency === 'CZK') {
      const jobLoc = job.location.toLowerCase();
      const userLoc = user.address.toLowerCase();
      
      const isJobInPrague = jobLoc.includes('praha') || jobLoc.includes('prague');
      const isUserInPrague = userLoc.includes('praha') || userLoc.includes('prague');
      
      // Cap public transport costs at realistic monthly pass prices
      // Eg. Lítačka ~3650/year (305/mo) + Zones
      // Eg. IDS JMK (Brno) ~4750/year + Zones
      // Maximum realistic monthly cost for public transport (even inter-city) is around 3000-4000 CZK
      
      if (isJobInPrague) {
          // Base Prague (305) + Zones estimated by distance
          const estimatedZonesCost = Math.ceil((distanceKm - 15)/10) * 300; 
          const calculatedCost = isUserInPrague ? 305 : 305 + Math.max(0, estimatedZonesCost);
          monthlyCost = Math.min(monthlyCost, Math.min(calculatedCost, 4000));
      } else if (jobLoc.includes('brno') || jobLoc.includes('ostrava') || jobLoc.includes('plzen')) {
          // Regional cities often cheaper or similar
          // 400 CZK base + distance factor
          const regionalCost = 400 + (distanceKm * 50); // Rough approximation of zone additions
          monthlyCost = Math.min(monthlyCost, Math.min(regionalCost, 4000));
      } else {
          // General inter-city cap
          monthlyCost = Math.min(monthlyCost, 4500); 
      }
  }

  // Calculate Avoided Cost for Remote
  let avoidedCommuteCost = 0;
  if (isRemote) {
     let potentialCost = Math.round(avoidedDistanceKm * costPerKm * 2 * 20);
     if (mode === 'public' && currency === 'CZK') {
        potentialCost = Math.min(potentialCost, 3600);
     }
     avoidedCommuteCost = potentialCost;
  }

  // 3. Financial Analysis (NET Basis)
  const isIco = job.title.includes('IČO') || job.description.includes('IČO') || job.description.includes('contractor') || job.tags.includes('Contractor');
  
  const { tax, net } = estimateCzechNetSalary(grossMonthlySalary, isIco);
  const benefitsValue = calculateBenefitsValue(job.benefits, currency, grossMonthlySalary);
  
  const realMonthlyCost = (distanceKm === -1 || isRelocation) ? 0 : monthlyCost;
  const finalRealMonthlyValue = net + benefitsValue - realMonthlyCost;
  
  const scoreAdjustment = calculateFinancialScoreAdjustment(net, grossMonthlySalary, benefitsValue, realMonthlyCost);

  // 4. JHI Time Impact
  let timePenalty = 0;
  let remoteBonus = 0;
  
  if (isRemote) {
    // Positive impact for home office - saves time and money
    remoteBonus = 5; // Base bonus for remote work
    // Additional bonus based on potential commute savings
    const potentialDailyCommute = (avoidedDistanceKm / SPEED_KMPH[mode]) * 2; // Round trip in hours
    if (potentialDailyCommute > 1) {
      remoteBonus += Math.min(3, Math.round(potentialDailyCommute * 2)); // Up to 3 extra points
    }
  } else if (distanceKm === -1 || isRelocation) {
    timePenalty = 0;
  } else {
    timePenalty = Math.max(0, timeMinutes - user.preferences.commuteTolerance) * 1;
  }
  
  const totalJhiImpact = Math.round(remoteBonus - timePenalty);

  return {
    distanceKm,
    timeMinutes,
    monthlyCost: realMonthlyCost,
    jhiImpact: totalJhiImpact,
    parkingWarning,
    isRelocation,
    financialReality: {
      currency,
      grossMonthlySalary,
      estimatedTaxAndInsurance: tax,
      netBaseSalary: net,
      benefitsValue,
      commuteCost: realMonthlyCost,
      avoidedCommuteCost,
      finalRealMonthlyValue,
      scoreAdjustment,
      isIco
    }
  };
};
