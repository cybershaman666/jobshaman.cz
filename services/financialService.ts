
import { Job, UserProfile, FinancialReality, BenefitValuation, SupportedCountryCode, TaxProfile } from '../types';
import { convertCurrency, getExchangeRateSnapshot } from './exchangeRatesService';
import { computeTaxByProfile, createDefaultTaxProfile, DEFAULT_TAX_YEAR } from './taxEngine';

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
  'Essensgutscheine': 88,
  'Essenszuschuss': 88,
  'Mittagessen': 88,
  'Kantine': 88,
  'Bony żywieniowe': 88,
  'Dofinansowanie posiłków': 88,
  'Karta lunchowa': 88,

  // Pension - Penzijní: 1,000 Kč = 40 EUR  
  'Penzijní připojištění': 40,
  'Penzijní': 40,
  'Penzíjko': 40,
  'Doplňkové penzijní': 40,
  'Životní pojištění': 40,
  'Betriebliche Altersvorsorge': 40,
  'Rentenversicherung': 40,
  'Zusatzrente': 40,
  'Emerytalne': 40,
  'Ubezpieczenie emerytalne': 40,

  // Phone - Mobilní telefon: 500 Kč = 20 EUR
  'Mobilní telefon': 20,
  'Telefon': 20,
  'Mobil': 20,
  'Služební telefon': 20,
  'Diensthandy': 20,
  'Firmenhandy': 20,
  'Telefon służbowy': 20,

  // Sports - MultiSport: 500 Kč = 20 EUR
  'MultiSport': 20,
  'MultiSport Karta': 20,
  'Multisport': 20,
  'Sport': 20,
  'Sportovní karta': 20,
  'Sportpaket': 20,
  'Fitness': 20,
  'Karta Multisport': 20,
  'Pakiet sportowy': 20,

  // Other benefits - Conservative estimates
  'Služební auto': 400, // ~10,000 Kč
  'Auto': 400,
  'Dienstwagen': 400,
  'Firmenwagen': 400,
  'Samochód służbowy': 400,
  '5 týdnů dovolené': 100, // ~2,500 Kč extra week
  '25 dní dovolené': 100,
  'Týden dovolené navíc': 100,
  '30 Tage Urlaub': 100,
  '25 Tage Urlaub': 100,
  'Dodatkowy urlop': 100,
  '26 dni urlopu': 100,
  'Sick Days': 20, // ~500 Kč
  'Sick days': 20,
  'Krankentage': 20,
  'Dni chorobowe': 20,
  'Cafeteria': 40, // ~1,000 Kč
  'Kafeterie': 40,
  'Cafeteria system': 40,
  'Kafeteria': 40,
  'Zaměstnanecké akcie': 200, // Stock options (conservative)
  'Akcie': 200,
  'ESOP': 200, // Stock options (conservative)
  'Mitarbeiteraktien': 200,
  'Aktienoptionen': 200,
  'Opcje na akcje': 200,
  'Home Office': 40, // ~1,000 Kč allowance
  'Homeoffice': 40,
  'Remote First': 60, // ~1,500 Kč savings
  'Mobiles Arbeiten': 60,
  'Praca zdalna': 60,
  'Sleva': 20, // ~500 Kč
  'Občerstvení': 20, // ~500 Kč (coffee, fruit)
  'Obst': 20,
  'Getränke': 20,
  'Przekąski': 20,
  'Lítačka': 40, // ~1,000 Kč
  'ÖPNV-Ticket': 40,
  'Bilet komunikacji miejskiej': 40,
  'Školka': 200, // ~5,000 Kč subsidy
  'Kinderbetreuung': 200,
  'Opieka nad dziećmi': 200,
  'Prywatna opieka medyczna': 80,
  'Privatkrankenversicherung': 80
};

const normalizeCurrencyCode = (currency: string): string => {
  if (currency === '€') return 'EUR';
  if (currency === 'Kč') return 'CZK';
  if (currency === 'zł') return 'PLN';
  if (currency === '$') return 'USD';
  if (currency === '£') return 'GBP';
  return currency.toUpperCase();
};

export const detectCurrency = (text: string): string => {
  if (text.includes('Kč') || text.includes('CZK')) return 'Kč';
  if (text.includes('zł') || text.includes('PLN')) return 'PLN';
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
  if (locLower.includes('polsko') || locLower.includes('poland') || locLower.includes('warszawa') || locLower.includes('kraków') || locLower.includes('wroclaw') || locLower.includes('gdańsk')) return 'PLN';

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

const hasYearlyMarker = (text: string): boolean =>
  /(?:\/\s*rok|ročn|rocni|rok|year|annual|annually|jahr|jährlich|jaehrlich|rocznie|rok(?:u)?|p\.a\.)/i.test(text);

const hasMonthlyMarker = (text: string): boolean =>
  /(?:\/\s*m[eě]s|měs|mesi|month|monthly|monat|miesi[ąa]c)/i.test(text);

const hasShortTimeframeMarker = (text: string): boolean =>
  /(?:\/\s*h|\/\s*hod|hodin|hour|hourly|\/\s*den|daily|\/\s*t[ýy]d|weekly)/i.test(text);

const WORK_DAYS_PER_MONTH = 22;
const WORK_HOURS_PER_DAY = 8;
const WEEKS_PER_MONTH = 4.345;

const convertShortTimeframeToMonthly = (amount: number, timeframe: 'hour' | 'day' | 'week'): number => {
  if (timeframe === 'hour') return Math.round(amount * WORK_DAYS_PER_MONTH * WORK_HOURS_PER_DAY);
  if (timeframe === 'day') return Math.round(amount * WORK_DAYS_PER_MONTH);
  return Math.round(amount * WEEKS_PER_MONTH);
};

const detectShortTimeframe = (text: string): 'hour' | 'day' | 'week' | null => {
  if (/(?:\/\s*h|\/\s*hod|hodin|hour|hourly)/i.test(text)) return 'hour';
  if (/(?:\/\s*den|daily)/i.test(text)) return 'day';
  if (/(?:\/\s*t[ýy]d|weekly)/i.test(text)) return 'week';
  return null;
};

const inferAnnualByAmount = (amount: number, currency: string): boolean => {
  const code = normalizeCurrencyCode(currency);
  if (code === 'EUR') return amount >= 10000;
  if (code === 'PLN') return amount >= 30000;
  if (code === 'USD' || code === 'GBP' || code === 'CHF') return amount >= 12000;
  return false;
};

const normalizeSalaryToMonthly = (
  amount: number,
  currency: string,
  contextText: string,
  timeframe?: string
): number => {
  if (!amount || amount <= 0) return 0;

  const tf = String(timeframe || '').toLowerCase();
  if (tf === 'year' || tf === 'yearly' || tf === 'annual') return Math.round(amount / 12);
  if (tf === 'month' || tf === 'monthly') return amount;
  if (tf === 'hour' || tf === 'hourly') return convertShortTimeframeToMonthly(amount, 'hour');
  if (tf === 'day' || tf === 'daily') return convertShortTimeframeToMonthly(amount, 'day');
  if (tf === 'week' || tf === 'weekly') return convertShortTimeframeToMonthly(amount, 'week');

  const lower = (contextText || '').toLowerCase();
  if (hasShortTimeframeMarker(lower)) {
    const detected = detectShortTimeframe(lower);
    if (detected) return convertShortTimeframeToMonthly(amount, detected);
    return amount;
  }
  if (hasMonthlyMarker(lower)) return amount;
  if (hasYearlyMarker(lower)) return Math.round(amount / 12);
  if (inferAnnualByAmount(amount, currency)) return Math.round(amount / 12);

  return amount;
};

export const parseMonthlySalary = (salaryRange: string | undefined): number => {
  if (!salaryRange) return 0;

  // Remove commas and spaces
  const cleanString = salaryRange.replace(/,/g, '').replace(/\s/g, '');
  const lower = salaryRange.toLowerCase();

  // Extract first number found
  const match = cleanString.match(/(\d+)/);
  if (!match) return 0;

  let value = parseInt(match[0], 10);
  const currency = detectCurrency(salaryRange);

  // Detect annual vs monthly
  const hasThousandSuffix = /\d+\s*k(?!\s*(č|c|czk))\b/.test(lower); // e.g. 85k, but not Kč/CZK
  const isAnnualByText = hasYearlyMarker(lower) && !hasMonthlyMarker(lower) && !hasShortTimeframeMarker(lower);

  // Handle "k" suffix (e.g. 85k)
  if (hasThousandSuffix && value < 1000) {
    value *= 1000;
  }

  if (hasShortTimeframeMarker(lower)) {
    const detected = detectShortTimeframe(lower);
    if (detected) return convertShortTimeframeToMonthly(value, detected);
  }

  if (hasThousandSuffix || isAnnualByText || (inferAnnualByAmount(value, currency) && !hasMonthlyMarker(lower) && !hasShortTimeframeMarker(lower))) {
    return Math.round(value / 12);
  }

  return value;
};

export const calculateBenefitsValue = (benefits: string[], currency: string, grossMonthlySalary?: number): number => {
  const currencyCode = normalizeCurrencyCode(currency);
  const multiplier = convertCurrency(1, 'EUR', currencyCode);

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

const inferCountryCode = (location: string, currency: string, explicit?: string): SupportedCountryCode => {
  if (explicit) {
    const code = explicit.toUpperCase();
    if (code === 'CZ' || code === 'SK' || code === 'PL' || code === 'DE' || code === 'AT') return code;
  }

  const loc = (location || '').toLowerCase();
  if (loc.includes('slovak') || loc.includes('slovensk') || loc.includes('bratislava') || loc.includes('kosice')) return 'SK';
  if (loc.includes('polsk') || loc.includes('poland') || loc.includes('warsaw') || loc.includes('krakow') || loc.includes('kraków')) return 'PL';
  if (loc.includes('germany') || loc.includes('deutsch') || loc.includes('berlin') || loc.includes('münchen') || loc.includes('munich')) return 'DE';
  if (loc.includes('austria') || loc.includes('österreich') || loc.includes('wien') || loc.includes('vídeň')) return 'AT';
  if (currency === 'PLN') return 'PL';
  if (currency === 'EUR' || currency === '€') return 'DE';
  return 'CZ';
};

export const estimateNetSalaryByCountry = (
  grossMonthly: number,
  isIco: boolean,
  countryCode?: string,
  location: string = '',
  currency: string = 'CZK',
  taxProfile?: TaxProfile
): { tax: number, net: number, breakdown?: FinancialReality['taxBreakdown'], ruleVersion?: string } => {
  if (!grossMonthly) return { tax: 0, net: 0 };

  const cc = inferCountryCode(location, currency, countryCode);
  const fallbackTaxProfile = createDefaultTaxProfile(cc, DEFAULT_TAX_YEAR);
  const profile: TaxProfile = {
    ...fallbackTaxProfile,
    ...(taxProfile || {}),
    countryCode: cc,
    employmentType: isIco ? 'contractor' : (taxProfile?.employmentType || 'employee'),
  };

  const result = computeTaxByProfile({ grossMonthly, taxProfile: profile });
  return {
    tax: result.totalDeductionsMonthly,
    net: result.netMonthly,
    ruleVersion: result.ruleVersion,
    breakdown: {
      incomeTax: result.breakdown.incomeTax,
      employeeSocial: result.breakdown.employeeSocial,
      employeeHealth: result.breakdown.employeeHealth,
      reliefsApplied: result.breakdown.reliefsApplied,
      details: result.breakdown.details,
      effectiveRate: result.effectiveRate,
    },
  };
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
  const multiplier = convertCurrency(1, 'EUR', normalizeCurrencyCode(currency)) || 1;

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
  // Detect currency first so salary_from conversion can use it.
  const currency = job.salaryRange
    ? detectCurrency(job.salaryRange)
    : detectCurrencyFromLocation(job.location);

  // Extract salary information
  const rawSalaryFrom = job.salary_from || 0;
  const monthlySalaryFrom = normalizeSalaryToMonthly(
    rawSalaryFrom,
    currency,
    `${job.salaryRange || ''} ${job.description || ''}`,
    job.salary_timeframe
  );
  const baseSalary = monthlySalaryFrom ||
    parseMonthlySalary(job.salaryRange) ||
    (job.aiEstimatedSalary ? job.aiEstimatedSalary.min : 0);

  if (baseSalary === 0) {
    console.warn('No salary information available for job:', job.title);
    return null; // Return null instead of throwing error
  }

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
    : Math.round(convertCurrency(commuteDetails.monthlyCost, 'CZK', normalizeCurrencyCode(currency)));

  // Calculate net monthly (country-specific, versioned tax engine)
  const grossMonthly = baseSalary + (benefitsValue / 12);
  const taxResult = estimateNetSalaryByCountry(
    grossMonthly,
    userProfile.taxProfile?.employmentType === 'contractor',
    job.country_code,
    job.location,
    currency,
    userProfile.taxProfile
  );
  const netAfterCommute = taxResult.net - convertedCommuteCost;
  const ratesSnapshot = getExchangeRateSnapshot();
  const normalizedCurrency = normalizeCurrencyCode(currency);

  return {
    currency: normalizedCurrency,
    grossMonthlySalary: grossMonthly,
    estimatedTaxAndInsurance: taxResult.tax,
    netBaseSalary: taxResult.net,
    benefitsValue,
    commuteCost: convertedCommuteCost,
    avoidedCommuteCost: 0, // Could be calculated for remote jobs
    finalRealMonthlyValue: Math.max(0, netAfterCommute),
    scoreAdjustment: calculateFinancialScoreAdjustment(taxResult.net, baseSalary, benefitsValue, convertedCommuteCost),
    isIco: userProfile.taxProfile?.employmentType === 'contractor',
    taxBreakdown: taxResult.breakdown,
    ruleVersion: `${taxResult.ruleVersion}@fx-${ratesSnapshot.asOf}`,
    commuteDetails
  };
};
