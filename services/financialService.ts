
import { Job, UserProfile, FinancialReality, BenefitValuation } from '../types';

// MVP Benefit values - Conservative estimates based on CZ market averages
// Base is EUR, 1 EUR ~ 25 CZK
const BENEFIT_VALUES: Record<string, number> = {
  // Food benefits - Stravenky/stravování: 2,200 Kč = 88 EUR
  'Stravenky': 88,
  'Stravenkový paušál': 88,
  'Příspěvek na stravování': 88,
  'Straveny': 88,
  'Obědy': 88,
  'Jídelny': 88,

  // Pension - Penzijní: 1,000 Kč = 40 EUR  
  'Penzijní připojištění': 40,
  'Penzijní': 40,
  'Penzíjko': 40,
  'Doplňkové penzijní': 40,
  'Životní pojištění': 40,

  // Phone - Mobilní telefon: 500 Kč = 20 EUR
  'Mobilní telefon': 20,
  'Telefon': 20,
  'Mobil': 20,
  'Služební telefon': 20,

  // Sports - MultiSport: 500 Kč = 20 EUR
  'MultiSport': 20,
  'MultiSport Karta': 20,
  'Multisport': 20,
  'Sport': 20,
  'Sportovní karta': 20,

  // Other benefits - Conservative estimates
  'Služební auto': 400, // ~10,000 Kč
  'Auto': 400,
  '5 týdnů dovolené': 100, // ~2,500 Kč extra week
  '25 dní dovolené': 100,
  'Týden dovolené navíc': 100,
  'Sick Days': 20, // ~500 Kč
  'Sick days': 20,
  'Cafeteria': 40, // ~1,000 Kč
  'Kafeterie': 40,
  'Zaměstnanecké akcie': 200, // Stock options (conservative)
  'Akcie': 200,
  'ESOP': 200, // Stock options (conservative)
  'Home Office': 40, // ~1,000 Kč allowance
  'Remote First': 60, // ~1,500 Kč savings
  'Sleva': 20, // ~500 Kč
  'Občerstvení': 20, // ~500 Kč (coffee, fruit)
  'Lítačka': 40, // ~1,000 Kč
  'Školka': 200, // ~5,000 Kč subsidy
};

const CURRENCY_MULTIPLIERS: Record<string, number> = {
  '€': 1,
  '$': 1,
  '£': 1.15,
  'Kč': 25, // 1 EUR = 25 CZK (Approx)
  'CZK': 25
};

export const detectCurrency = (text: string): string => {
  if (text.includes('Kč') || text.includes('CZK')) return 'Kč';
  if (text.includes('£')) return '£';
  if (text.includes('$')) return '$';
  return '€'; // Default
};

export const detectCurrencyFromLocation = (location: string): string => {
  if (!location) return 'CZK'; // Default to CZK if location is missing
  const locLower = location.toLowerCase();

  // 1. Explicit Foreign Countries/Cities
  if (locLower.includes('usa') || locLower.includes('spojené státy') || locLower.includes('new york') || locLower.includes('san francisco')) return '$';
  if (locLower.includes('uk') || locLower.includes('británie') || locLower.includes('london') || locLower.includes('londýn') || locLower.includes('united kingdom')) return '£';
  if (locLower.includes('švýcarsko') || locLower.includes('switzerland') || locLower.includes('zürich') || locLower.includes('geneva')) return 'CHF';

  // 2. Eurozone keywords
  if (locLower.includes('německo') || locLower.includes('germany') || locLower.includes('deutschland') ||
    locLower.includes('rakousko') || locLower.includes('austria') ||
    locLower.includes('slovensko') || locLower.includes('slovakia') || locLower.includes('bratislava') ||
    locLower.includes('nizozemí') || locLower.includes('netherlands') ||
    locLower.includes('irsko') || locLower.includes('ireland') ||
    locLower.includes('francie') || locLower.includes('france') ||
    locLower.includes('itálie') || locLower.includes('italy') ||
    locLower.includes('španělsko') || locLower.includes('spain')) {
    return '€';
  }

  // 3. Default to CZK for this platform (JobShaman CZ)
  // This covers all Czech cities, villages, "Remote" (usually means Czech remote in this context), etc.
  return 'CZK';
}

export const parseMonthlySalary = (salaryRange: string | undefined): number => {
  if (!salaryRange) return 0;

  // Remove commas and spaces
  const cleanString = salaryRange.replace(/,/g, '').replace(/\s/g, '');

  // Extract first number found
  const match = cleanString.match(/(\d+)/);
  if (!match) return 0;

  let value = parseInt(match[0], 10);

  // Detect annual vs monthly
  const isAnnual = salaryRange.toLowerCase().includes('k') || value < 200; // e.g. 85k or 85

  // Handle "k" suffix (e.g. 85k)
  if (salaryRange.toLowerCase().includes('k') && value < 1000) {
    value *= 1000;
  }

  // Convert annual to monthly
  if (isAnnual || value > 150000 && !salaryRange.includes('mo') && !salaryRange.includes('mth')) {
    const currency = detectCurrency(salaryRange);
    if (currency === 'Kč' || currency === 'CZK') {
      if (value > 200000) return Math.round(value / 12);
    } else {
      if (value > 20000) return Math.round(value / 12);
    }
  }

  return value;
};

export const calculateBenefitsValue = (benefits: string[], currency: string, grossMonthlySalary?: number): number => {
  const multiplier = CURRENCY_MULTIPLIERS[currency] || 1;

  if (!benefits || benefits.length === 0) return 0;

  // Use a Set to avoid double counting similar keywords (e.g. "Stravenky" and "Obědy")
  let totalValue = 0;

  for (const benefit of benefits) {
    const benefitLower = benefit.toLowerCase();

    // Find matching key in values map
    for (const key of Object.keys(BENEFIT_VALUES)) {
      if (benefitLower.includes(key.toLowerCase())) {
        totalValue += (BENEFIT_VALUES[key] * multiplier);
        break; // Match first keyword in this benefit string and move to next benefit string
      }
    }
  }

  // Add conservative bonus/prémie estimate based on salary (2,000 Kč = 80 EUR)
  if (grossMonthlySalary && grossMonthlySalary > 0) {
    totalValue += (80 * multiplier);
  }

  return Math.round(totalValue);
};

// Simple estimator for Czech taxes
export const estimateCzechNetSalary = (gross: number, isIco: boolean): { tax: number, net: number } => {
  if (gross === 0) return { tax: 0, net: 0 };

  if (isIco) {
    // IČO / Contractor
    // Estimate: Flat tax (Paušální daň) or 60% expense lump sum.
    // Assuming typical IT freelancer with lump sum expenses:
    // Real tax burden is low.
    // Approx 15% combined tax/social/health for simplicity on average earnings.
    // Low earning (<50k) pays fixed tax (~7500 CZK).
    let estimatedTax = 0;
    if (gross < 60000) {
      estimatedTax = 7500; // Minimum flat tax approx
    } else {
      estimatedTax = gross * 0.13; // Higher earnings
    }
    return {
      tax: Math.round(estimatedTax),
      net: Math.round(gross - estimatedTax)
    };
  } else {
    // Employee (HPP)
    // 2024 Context:
    // Social + Health paid by employee: ~11%
    // Income Tax: 15% of Gross (minus deductions, but we simplify)
    // Approx 21-23% deduction from Gross.
    const estimatedDeductions = gross * 0.21;
    return {
      tax: Math.round(estimatedDeductions),
      net: Math.round(gross - estimatedDeductions)
    };
  }
};

export const calculateFinancialScoreAdjustment = (
  netSalary: number,
  baseGross: number,
  benefitsValue: number,
  commuteCost: number
): number => {
  // When no salary info available, still give bonus for good benefits
  if (netSalary === 0 && baseGross === 0) {
    // Give small positive score for good benefits, even without salary
    // Assuming benefitsValue is in EUR from financial calculation
    if (benefitsValue > 200) return 5; // Benefits worth >200 EUR/month
    if (benefitsValue > 100) return 3; // Benefits worth >100 EUR/month
    return 0;
  }

  if (netSalary === 0) return 0;

  // We compare: Net "Take Home + Benefits - Cost" vs just: Net Base.
  const realValue = netSalary + benefitsValue - commuteCost;
  const netDiff = realValue - netSalary;

  // Percent improvement or loss over: base net salary
  const percentImpact = (netDiff / netSalary) * 100;

  // Scale: 1% difference = 1.5 points
  let scoreDelta = Math.round(percentImpact * 1.5);

  return Math.min(15, Math.max(-20, scoreDelta));
};

// New GPS-based functionality for Career Pathfinder AI
// Commute cost coefficients (CZK per km)
const COMMUTE_COSTS = {
  car: 5.0,      // 5 CZK/km - fuel + maintenance + depreciation
  public: 2.5,   // 2.5 CZK/km - average for Czech Republic (fallback for small cities)
  bike: 0.05,    // 0.05 CZK/km - maintenance + wear
  walk: 0        // No cost
};

// Monthly public transport passes for major Czech cities
// When MHD is cheaper than linear calculation, use the pass price
const CITY_PUBLIC_TRANSPORT_PASSES: Record<string, number> = {
  // Prague
  'praha': 1500, 'prague': 1500, 'prag': 1500,
  // Brno
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
  'ústí nad labem': 850, 'usti nad labem': 850
};

// Calculate distance between two GPS coordinates (Haversine formula)
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateCommuteCost = (
  jobLat: number,
  jobLng: number,
  candidateLat: number,
  candidateLng: number,
  transportMode: string = 'public',
  jobCity?: string
): { distance: number; monthlyCost: number } => {
  const distance = calculateDistance(jobLat, jobLng, candidateLat, candidateLng);
  const dailyDistance = distance * 2; // Round trip
  const workingDaysPerMonth = 22; // Average working days

  const coefficient = COMMUTE_COSTS[transportMode as keyof typeof COMMUTE_COSTS] || COMMUTE_COSTS.public;
  const linearCost = dailyDistance * coefficient * workingDaysPerMonth;

  // For public transport, check if city has a monthly pass that's cheaper than linear calculation
  if (transportMode === 'public' && jobCity) {
    const cityLower = jobCity.toLowerCase().trim();
    
    // Try exact match or partial match for cities
    for (const [city, passPrice] of Object.entries(CITY_PUBLIC_TRANSPORT_PASSES)) {
      if (cityLower.includes(city) || city.includes(cityLower)) {
        // Use pass price if it's cheaper than linear calculation
        // But only if distance is reasonable for using the pass (e.g., < 30 km)
        if (distance < 30 && passPrice < linearCost) {
          return {
            distance: Math.round(distance * 10) / 10,
            monthlyCost: passPrice
          };
        }
        break;
      }
    }
  }

  return {
    distance: Math.round(distance * 10) / 10, // Round to 1 decimal
    monthlyCost: Math.round(linearCost)
  };
};

export const calculateBenefitsValueWithTable = async (
  benefits: string[],
  benefitValuations: BenefitValuation[],
  currency: string = 'CZK'
): Promise<number> => {
  if (!benefits.length) return 0;

  let totalValue = 0;
  const multiplier = CURRENCY_MULTIPLIERS[currency] || 25; // Default to CZK

  for (const benefit of benefits) {
    const valuation = benefitValuations.find(
      bv => benefit.toLowerCase().includes(bv.benefit_name.toLowerCase()) ||
        bv.benefit_name.toLowerCase().includes(benefit.toLowerCase())
    );

    if (valuation) {
      totalValue += (valuation.monetary_value / multiplier);
    } else {
      // Fallback to default valuations for common benefits
      for (const key of Object.keys(BENEFIT_VALUES)) {
        if (benefit.toLowerCase().includes(key.toLowerCase())) {
          totalValue += BENEFIT_VALUES[key];
          break;
        }
      }
    }
  }

  return Math.round(totalValue);
};

export const calculateFinancialReality = async (
  job: Job,
  userProfile: UserProfile,
  benefitValuations: BenefitValuation[]
): Promise<(FinancialReality & { commuteDetails: { distance: number; monthlyCost: number } }) | null> => {
  // Extract salary information
  const baseSalary = job.salary_from ||
    parseMonthlySalary(job.salaryRange) ||
    (job.aiEstimatedSalary ? job.aiEstimatedSalary.min : 0);

  if (baseSalary === 0) {
    console.warn('No salary information available for job:', job.title);
    return null; // Return null instead of throwing error
  }

  // Detect currency
  const currency = detectCurrency(job.salaryRange || '') || detectCurrencyFromLocation(job.location);

  // Calculate benefits value
  const benefitsValue = await calculateBenefitsValueWithTable(
    job.benefits || [],
    benefitValuations,
    currency
  );

  // Calculate commute costs
  const commuteDetails = userProfile.coordinates && job.lat && job.lng
    ? calculateCommuteCost(
      job.lat,
      job.lng,
      userProfile.coordinates.lat,
      userProfile.coordinates.lon,
      userProfile.transportMode,
      job.location // Pass job city for city-specific passes
    )
    : { distance: 0, monthlyCost: 0 };

  // Convert commute cost to the same currency
  const convertedCommuteCost = currency === 'CZK' || currency === 'Kč'
    ? commuteDetails.monthlyCost
    : Math.round(commuteDetails.monthlyCost / (CURRENCY_MULTIPLIERS[currency] || 25));

  // Calculate net monthly (using existing tax estimation)
  const grossMonthly = baseSalary + (benefitsValue / 12);
  const { net: netMonthly } = estimateCzechNetSalary(grossMonthly, false);
  const netAfterCommute = netMonthly - convertedCommuteCost;



  const { tax: estimatedTaxAndInsurance, net: netBaseSalary } = estimateCzechNetSalary(grossMonthly, false);

  return {
    currency: currency === 'CZK' || currency === 'Kč' ? 'CZK' : currency,
    grossMonthlySalary: grossMonthly,
    estimatedTaxAndInsurance,
    netBaseSalary,
    benefitsValue,
    commuteCost: convertedCommuteCost,
    avoidedCommuteCost: 0, // Could be calculated for remote jobs
    finalRealMonthlyValue: Math.max(0, netAfterCommute),
    scoreAdjustment: calculateFinancialScoreAdjustment(netBaseSalary, baseSalary, benefitsValue, convertedCommuteCost),
    isIco: false,
    commuteDetails
  };
};
