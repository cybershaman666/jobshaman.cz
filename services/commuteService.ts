import { Job, UserProfile, CommuteAnalysis } from '../types';
import {
    parseMonthlySalary,
    calculateBenefitsValue,
    detectCurrency,
    calculateFinancialScoreAdjustment,
    estimateCzechNetSalary,
    detectCurrencyFromLocation
} from './financialService';
import { geocodeWithCaching, getStaticCoordinates } from './geocodingService';

// --- UTILITIES ---

/**
 * @deprecated Use normalizeAddress from geocodingService for consistent hashing.
 */
const removeAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Helper to check if location implies foreign country
const isLocationAbroad = (location: string): boolean => {
    const loc = removeAccents(location);
    const foreignKeywords = [
        'nemecko', 'germany', 'deutschland',
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
    return geocodeWithCaching(address);
};

// Kept for backward compatibility where sync lookup is expected (fallbacks to geocode cache if possible)
// But ideally components should await resolveAddressToCoordinates
export const getCoordinates = (address: string): { lat: number, lon: number } | null => {
    // Note: This sync lookup only works for static cities moved to geocodingService.
    return getStaticCoordinates(address);
};

// Haversine formula for distance in km
export const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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

// Monthly public transport pass costs by CITY (2025 data) - Czech Republic specific
// This is the actual monthly pass price for getting around the city
const CITY_MONTHLY_PASSES_CZ: Record<string, number> = {
    // Prague - Most expensive, unlimited zones
    'praha': 1500, 'prague': 1500, 'prag': 1500,
    // Brno - Second largest city
    'brno': 1300, 'brünn': 1300,
    // Ostrava
    'ostrava': 1100,
    // Plzen
    'plzeň': 1000, 'plzen': 1000,
    // Liberec
    'liberec': 850,
    // Olomouc
    'olomouc': 900,
    // Ceske Budejovice
    'české budějovice': 950, 'ceske budejovice': 950,
    // Hradec Kralove
    'hradec králové': 1050, 'hradec kralove': 1050,
    // Pardubice
    'pardubice': 950,
    // Usti nad Labem
    'ústí nad labem': 850, 'usti nad labem': 850,
    // Jihlava
    'jihlava': 800,
    // Kladno
    'kladno': 900,
    // Karlovy Vary
    'karlovy vary': 850,
    // Default for small cities
    'default': 700 // Average for smaller Czech cities
};

// Monthly public transport pass costs by country (2025 data)
const MONTHLY_PUBLIC_TRANSPORT_COSTS = {
    // Czech Republic - Prague 1500 Kč, other cities 700-1300 Kč
    CZ: 1500, // Prague as default (highest)
    SK: 35, // Bratislava monthly pass (€35, 2025)
    DE: 49, // Germany 49€ ticket (nationwide, 2025)
    AT: 59, // Vienna monthly pass (€59, 2025)
    CH: 87, // Zurich 1-2 zones monthly pass (CHF 87, 2025)
    PL: 29, // Warsaw monthly pass (29€, estimated)
};

// Exchange rates to CZK (2025 averages)
const EXCHANGE_RATES_TO_CZK = {
    CZK: 1,
    EUR: 25, // 1 EUR = 25 CZK
    CHF: 27, // 1 CHF = 27 CZK
    USD: 24, // 1 USD = 24 CZK
};

// Simulation constants (Adjusted for Reality)
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

// Helper function to get country code from location and currency
const getCountryCode = (location: string, currency: string): keyof typeof MONTHLY_PUBLIC_TRANSPORT_COSTS => {
    const loc = location.toLowerCase();
    
    // Check location keywords first for better accuracy
    if (loc.includes('praha') || loc.includes('brno') || loc.includes('ostrava') || 
        loc.includes('česk') || loc.includes('czech') || currency === 'CZK') {
        return 'CZ';
    }
    if (loc.includes('bratislava') || loc.includes('kosice') || loc.includes('slovak') || 
        loc.includes('slovensk') || currency === '€' && loc.includes('sk')) {
        return 'SK';
    }
    if (loc.includes('berlin') || loc.includes('münchen') || loc.includes('hamburg') || 
        loc.includes('german') || loc.includes('deutsch')) {
        return 'DE';
    }
    if (loc.includes('vídeň') || loc.includes('wien') || loc.includes('austria') || 
        loc.includes('österreich') || loc.includes('raku')) {
        return 'AT';
    }
    if (loc.includes('zurich') || loc.includes('zürich') || loc.includes('swiss') || 
        loc.includes('schweiz') || loc.includes('švýc') || currency === 'CHF') {
        return 'CH';
    }
    if (loc.includes('warsaw') || loc.includes('varšava') || loc.includes('krakow') || 
        loc.includes('polsk') || loc.includes('polish')) {
        return 'PL';
    }
    
    // Default to Czech Republic if no country detected
    return 'CZ';
};

// Helper function to get city-specific monthly pass cost for Czech Republic
const getCityMonthlyPassCost = (location: string): number => {
    if (!location) return CITY_MONTHLY_PASSES_CZ['default'];
    
    const locLower = location.toLowerCase().trim();
    
    // Try exact match first
    for (const [city, cost] of Object.entries(CITY_MONTHLY_PASSES_CZ)) {
        if (city === 'default') continue;
        if (locLower === city || locLower.includes(city)) {
            return cost;
        }
    }
    
    // If no match, return default
    return CITY_MONTHLY_PASSES_CZ['default'];
};

// Helper function to get monthly public transport cost in the appropriate currency
const getMonthlyPublicTransportCost = (countryCode: keyof typeof MONTHLY_PUBLIC_TRANSPORT_COSTS, targetCurrency: string, location?: string): number => {
    // For Czech Republic, use city-specific prices
    if (countryCode === 'CZ' && location) {
        const cityPrice = getCityMonthlyPassCost(location);
        return cityPrice;
    }
    
    const baseCost = MONTHLY_PUBLIC_TRANSPORT_COSTS[countryCode];
    
    // Convert to target currency
    if (targetCurrency === 'CZK') {
        if (countryCode === 'CZ') return baseCost; // Already in CZK
        if (countryCode === 'SK' || countryCode === 'DE' || countryCode === 'AT') return baseCost * EXCHANGE_RATES_TO_CZK.EUR;
        if (countryCode === 'CH') return baseCost * EXCHANGE_RATES_TO_CZK.CHF;
        if (countryCode === 'PL') return baseCost * EXCHANGE_RATES_TO_CZK.EUR; // PL uses EUR estimate
    } else if (targetCurrency === '€') {
        return baseCost; // Most European countries in EUR
    } else if (targetCurrency === 'CHF') {
        if (countryCode === 'CH') return baseCost; // Already in CHF
        return baseCost * 0.9; // Approximate conversion from EUR to CHF
    }
    
    // Default fallback
    return baseCost * EXCHANGE_RATES_TO_CZK.EUR;
};

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
    if (!isRemote && !isRelocation && distanceKm !== -1 && mode === 'public') {
        // Get country code and monthly pass cost (with city-specific prices for CZ)
        const countryCode = getCountryCode(job.location, currency);
        const monthlyPassCost = getMonthlyPublicTransportCost(countryCode, currency, job.location);
        
        // Convert distance-based cost to actual monthly cost comparison
        // Base calculation: distance * rate * 2 trips * 20 days
        const distanceBasedCost = distanceKm * costPerKm * 2 * 20;
        
        // Use the cheaper of distance-based cost or monthly pass cost
        // This encourages use of monthly passes for regular commuting
        monthlyCost = Math.min(distanceBasedCost, monthlyPassCost);
        
        // Additional zone supplements for cross-zone commuting (Czech Republic specific)
        if (countryCode === 'CZ') {
            const jobLoc = job.location.toLowerCase();
            const userLoc = user.address.toLowerCase();
            
            const isJobInPrague = jobLoc.includes('praha') || jobLoc.includes('prague');
            const isUserInPrague = userLoc.includes('praha') || userLoc.includes('prague');
            
            if (isJobInPrague && !isUserInPrague) {
                // Additional zone cost for commuting to Prague from outside
                const zoneSupplement = Math.ceil((distanceKm - 15) / 10) * 300; // ~300 CZK per additional zone
                monthlyCost = Math.min(monthlyCost, monthlyPassCost + zoneSupplement);
            }
        }
    }

    // Calculate Avoided Cost for Remote
    let avoidedCommuteCost = 0;
    if (isRemote) {
        const distanceBasedCost = Math.round(avoidedDistanceKm * costPerKm * 2 * 20);
        
        if (mode === 'public') {
            // For public transport, use monthly pass cost as avoided cost (with city-specific prices)
            const countryCode = getCountryCode(job.location, currency);
            const monthlyPassCost = getMonthlyPublicTransportCost(countryCode, currency, job.location);
            avoidedCommuteCost = Math.min(distanceBasedCost, monthlyPassCost);
        } else {
            // For car, bike, walk - use distance-based calculation
            avoidedCommuteCost = distanceBasedCost;
        }
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
