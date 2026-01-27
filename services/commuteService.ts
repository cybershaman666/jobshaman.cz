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
            const estimatedZonesCost = Math.ceil((distanceKm - 15) / 10) * 300;
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
