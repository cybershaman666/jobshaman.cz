/**
 * Transport Mode Service
 * Handles cost and time calculations for different transport modes
 */

export type TransportMode = 'car' | 'public' | 'bike' | 'walk';

export interface CityPassInfo {
  city: string;
  country: string;
  monthlyPass: number; // CZK
  dailyPass?: number; // CZK
  description: string;
}

// City passes and public transport costs
export const CITY_PASSES: CityPassInfo[] = [
  // Czech Republic (2025 prices - current monthly passes)
  {
    city: 'Praha',
    country: 'CZ',
    monthlyPass: 1500,
    dailyPass: 130,
    description: 'PID - Pražská integrovaná doprava'
  },
  {
    city: 'Brno',
    country: 'CZ',
    monthlyPass: 1300,
    dailyPass: 90,
    description: 'DPP Brno - mestská doprava'
  },
  {
    city: 'Plzeň',
    country: 'CZ',
    monthlyPass: 1000,
    dailyPass: 70,
    description: 'PMDP - mestská doprava'
  },
  {
    city: 'Ostrava',
    country: 'CZ',
    monthlyPass: 1100,
    dailyPass: 80,
    description: 'MHD Ostrava'
  },
  {
    city: 'Liberec',
    country: 'CZ',
    monthlyPass: 850,
    dailyPass: 65,
    description: 'DPML - mestská doprava'
  },
  {
    city: 'Olomouc',
    country: 'CZ',
    monthlyPass: 900,
    dailyPass: 60,
    description: 'MHD Olomouc'
  },
  {
    city: 'Hradec Králové',
    country: 'CZ',
    monthlyPass: 1050,
    dailyPass: 60,
    description: 'MHD Hradec Králové'
  },
  {
    city: 'České Budějovice',
    country: 'CZ',
    monthlyPass: 950,
    dailyPass: 60,
    description: 'MHD České Budějovice'
  },
  {
    city: 'Pardubice',
    country: 'CZ',
    monthlyPass: 950,
    dailyPass: 60,
    description: 'MHD Pardubice'
  },

  // Slovakia
  {
    city: 'Bratislava',
    country: 'SK',
    monthlyPass: 65,
    dailyPass: 8,
    description: 'DPB Bratislava - mestská doprava (EUR)'
  },
  {
    city: 'Košice',
    country: 'SK',
    monthlyPass: 45,
    dailyPass: 6,
    description: 'DPMK Košice (EUR)'
  },
  {
    city: 'Žilina',
    country: 'SK',
    monthlyPass: 35,
    dailyPass: 4.5,
    description: 'MHD Žilina (EUR)'
  },
  {
    city: 'Banská Bystrica',
    country: 'SK',
    monthlyPass: 35,
    dailyPass: 4.5,
    description: 'MHD Banská Bystrica (EUR)'
  },

  // Poland
  {
    city: 'Warszawa',
    country: 'PL',
    monthlyPass: 150,
    dailyPass: 15,
    description: 'ZTM Warszawa - mestská doprava (PLN)'
  },
  {
    city: 'Kraków',
    country: 'PL',
    monthlyPass: 120,
    dailyPass: 12,
    description: 'MZA Kraków (PLN)'
  },
  {
    city: 'Wrocław',
    country: 'PL',
    monthlyPass: 110,
    dailyPass: 11,
    description: 'MZK Wrocław (PLN)'
  },
  {
    city: 'Poznań',
    country: 'PL',
    monthlyPass: 110,
    dailyPass: 11,
    description: 'MZK Poznań (PLN)'
  },
  {
    city: 'Gdańsk',
    country: 'PL',
    monthlyPass: 110,
    dailyPass: 11,
    description: 'ZKM Gdańsk (PLN)'
  },

  // Austria
  {
    city: 'Wien',
    country: 'AT',
    monthlyPass: 50,
    dailyPass: 6,
    description: 'ÖBB/Wiener Linien (EUR)'
  },
  {
    city: 'Graz',
    country: 'AT',
    monthlyPass: 40,
    dailyPass: 5,
    description: 'Holding Graz (EUR)'
  },
  {
    city: 'Salzburg',
    country: 'AT',
    monthlyPass: 40,
    dailyPass: 5,
    description: 'SLP Salzburg (EUR)'
  },
  {
    city: 'Linz',
    country: 'AT',
    monthlyPass: 45,
    dailyPass: 5.5,
    description: 'LIVA Linz (EUR)'
  },

  // Germany
  {
    city: 'Berlin',
    country: 'DE',
    monthlyPass: 115,
    dailyPass: 12,
    description: 'BVG Berlin (EUR)'
  },
  {
    city: 'München',
    country: 'DE',
    monthlyPass: 130,
    dailyPass: 13,
    description: 'MVG München (EUR)'
  },
  {
    city: 'Hamburg',
    country: 'DE',
    monthlyPass: 120,
    dailyPass: 12,
    description: 'HVV Hamburg (EUR)'
  },
  {
    city: 'Köln',
    country: 'DE',
    monthlyPass: 110,
    dailyPass: 11,
    description: 'KVB Köln (EUR)'
  },
  {
    city: 'Frankfurt',
    country: 'DE',
    monthlyPass: 115,
    dailyPass: 12,
    description: 'RMV Frankfurt (EUR)'
  },
  {
    city: 'Stuttgart',
    country: 'DE',
    monthlyPass: 125,
    dailyPass: 12.5,
    description: 'VVS Stuttgart (EUR)'
  },
  {
    city: 'Düsseldorf',
    country: 'DE',
    monthlyPass: 115,
    dailyPass: 12,
    description: 'VRR Düsseldorf (EUR)'
  },
  {
    city: 'Leipzig',
    country: 'DE',
    monthlyPass: 105,
    dailyPass: 10.5,
    description: 'MDV Leipzig (EUR)'
  }
];

// Cost per kilometer for different transport modes (in CZK)
export const TRANSPORT_COSTS_PER_KM = {
  car: 5.0,      // 5 CZK/km (fuel + maintenance + depreciation)
  public: 2.5,   // 2.5 CZK/km (average for Czech Republic)
  bike: 0.05,    // 0.05 CZK/km (maintenance + wear)
  walk: 0        // Free
};

// Time in minutes per kilometer for different transport modes
export const TRANSPORT_TIME_PER_KM = {
  car: 1.5,      // 1.5 min/km (average 40 km/h in city)
  public: 2.5,   // 2.5 min/km (waiting + travel)
  bike: 2.0,     // 2 min/km (average 30 km/h)
  walk: 1.5      // 1.5 min/km (average 40 km/h walking speed)
};

// Fixed costs per trip (in CZK)
export const TRANSPORT_FIXED_COSTS = {
  car: 0,        // No fixed cost per trip
  public: 0,     // Included in monthly pass or per-ride ticket
  bike: 0,       // No cost
  walk: 0        // No cost
};

// Cost adjustment factors for different countries
export const COUNTRY_COST_MULTIPLIERS: Record<string, number> = {
  'CZ': 1.0,     // Czech Republic baseline
  'SK': 0.7,     // Slovakia ~30% cheaper
  'PL': 0.65,    // Poland ~35% cheaper
  'AT': 0.95,    // Austria ~5% cheaper
  'DE': 0.9,     // Germany ~10% cheaper
  'HU': 0.6,     // Hungary ~40% cheaper
  'RO': 0.45,    // Romania ~55% cheaper
};

export interface TransportCostCalculation {
  mode: TransportMode;
  distanceKm: number;
  dailyCost: number;
  monthlyCost: number;
  yearlyAnnualCost: number;
  dailyTime: number; // in minutes
  monthlyTime: number; // in hours
  costPerMinute: number;
  cityPass?: CityPassInfo;
}

/**
 * Calculate commute costs and time for a given distance and transport mode
 * @param distanceKm Distance in kilometers (one way)
 * @param mode Transport mode
 * @param city Optional city for public transport pass lookup
 * @param country Optional country code
 * @returns Detailed cost and time calculation
 */
export function calculateTransportCost(
  distanceKm: number,
  mode: TransportMode,
  city?: string,
  country?: string
): TransportCostCalculation {
  const dailyDistance = distanceKm * 2; // Round trip
  const workingDaysPerMonth = 22;
  const workingDaysPerYear = 260;

  let dailyCost = 0;
  let monthlyCost = 0;
  let yearlyCost = 0;
  let cityPass: CityPassInfo | undefined;

  const costMultiplier = country ? COUNTRY_COST_MULTIPLIERS[country] || 1.0 : 1.0;

  switch (mode) {
    case 'car':
      dailyCost = dailyDistance * TRANSPORT_COSTS_PER_KM.car;
      break;

    case 'public':
      // Try to find city-specific pass
      if (city && country) {
        cityPass = CITY_PASSES.find(
          p => p.city.toLowerCase() === city.toLowerCase() && p.country === country
        );

        if (cityPass) {
          // Use monthly pass cost as basis
          monthlyCost = cityPass.monthlyPass;
          // Adjust for country if not CZK
          if (country !== 'CZ') {
            monthlyCost = cityPass.monthlyPass * costMultiplier * 25; // Convert EUR/PLN to CZK equivalent
          }
          dailyCost = monthlyCost / workingDaysPerMonth;
        } else {
          // Fallback to per-km calculation
          dailyCost = dailyDistance * TRANSPORT_COSTS_PER_KM.public * costMultiplier;
        }
      } else {
        // Default calculation without city pass
        dailyCost = dailyDistance * TRANSPORT_COSTS_PER_KM.public * costMultiplier;
      }
      break;

    case 'bike':
      dailyCost = dailyDistance * TRANSPORT_COSTS_PER_KM.bike;
      break;

    case 'walk':
      dailyCost = 0;
      break;
  }

  // Calculate monthly and yearly costs
  if (!cityPass || mode !== 'public') {
    monthlyCost = dailyCost * workingDaysPerMonth;
    yearlyCost = dailyCost * workingDaysPerYear;
  } else {
    yearlyCost = monthlyCost * 12;
  }

  // Calculate time
  const dailyTime = dailyDistance * TRANSPORT_TIME_PER_KM[mode];
  const monthlyTime = (dailyTime * workingDaysPerMonth) / 60; // Convert to hours

  // Cost per minute of commute
  const costPerMinute = dailyTime > 0 ? dailyCost / dailyTime : 0;

  return {
    mode,
    distanceKm,
    dailyCost: Math.round(dailyCost * 100) / 100,
    monthlyCost: Math.round(monthlyCost),
    yearlyAnnualCost: Math.round(yearlyCost),
    dailyTime: Math.round(dailyTime),
    monthlyTime: Math.round(monthlyTime * 10) / 10,
    costPerMinute: Math.round(costPerMinute * 100) / 100,
    cityPass
  };
}

/**
 * Compare all transport modes for a given distance
 */
export function compareAllTransportModes(
  distanceKm: number,
  city?: string,
  country?: string
): TransportCostCalculation[] {
  const modes: TransportMode[] = ['car', 'public', 'bike', 'walk'];
  return modes.map(mode => calculateTransportCost(distanceKm, mode, city, country))
    .sort((a, b) => a.monthlyCost - b.monthlyCost);
}

/**
 * Get the best transport mode (cheapest)
 */
export function getBestTransportMode(
  distanceKm: number,
  city?: string,
  country?: string
): TransportMode {
  const comparison = compareAllTransportModes(distanceKm, city, country);
  return comparison[0].mode;
}

/**
 * Find city pass information
 */
export function findCityPass(city: string, country: string): CityPassInfo | undefined {
  return CITY_PASSES.find(
    p => p.city.toLowerCase() === city.toLowerCase() && p.country === country
  );
}

/**
 * Get all cities for a given country
 */
export function getCitiesForCountry(country: string): CityPassInfo[] {
  return CITY_PASSES.filter(p => p.country === country);
}
/**
 * Calculate complete JHI score accounting for salary, benefits, commute time and costs
 * New formula is more balanced and accounts for work-life balance (commute time) too
 * 
 * Baseline JHI = 50 (average job)
 * Adjustments:
 * - Salary vs average (35000 CZK): (salary - 35000) / 35000 × 20 points
 * - Benefits value: min(benefits / salary, 0.15) × 15 points
 * - Commute time: -((minutes_per_week / 500) × 10) points
 * - Transport costs: -(yearly_cost / salary × 10) points
 * 
 * @param monthlySalaryGross - Gross monthly salary in CZK
 * @param monthlyBenefitsValue - Monthly value of benefits in CZK (stravenky, vzdělávání, etc)
 * @param commutingDistanceKm - One-way commute distance in kilometers
 * @param transportMode - User's preferred transport mode
 * @param city - City for public transport pass lookup
 * @param country - Country code for cost calculation
 * @returns Complete JHI score (0-100, baseline 50)
 */
export function calculateCompleteJHIScore(
  monthlySalaryGross: number,
  monthlyBenefitsValue: number,
  commutingDistanceKm: number,
  transportMode: TransportMode,
  city?: string,
  country?: string
): number {
  const AVERAGE_SALARY = 35000; // CZK - baseline for comparison
  const baselineJHI = 50;

  // Get transport cost calculation
  const transportCalc = calculateTransportCost(commutingDistanceKm, transportMode, city, country);
  
  // Calculate weekly commute time (round trip, 5 days/week)
  const dailyCommuteMinutes = transportCalc.dailyTime;
  const weeklyCommuteMinutes = dailyCommuteMinutes * 5;
  const yearlyTransportCost = transportCalc.yearlyAnnualCost;

  // 1. Salary adjustment (compared to average 35000 CZK)
  const salaryRatio = monthlySalaryGross / AVERAGE_SALARY;
  const salaryAdjustment = Math.round((salaryRatio - 1) * 20); // Max ±20 points
  
  // 2. Benefits adjustment (capped at 15% of salary, gives max 15 points)
  const benefitsRatio = Math.min(monthlyBenefitsValue / monthlySalaryGross, 0.15);
  const benefitsAdjustment = Math.round(benefitsRatio * 15); // Max 15 points
  
  // 3. Commute time adjustment (work-life balance impact)
  // 500 minutes/week = 100 min/day = about 1.5 hours round trip (reference point = 0 impact)
  // Less time = positive impact, more time = negative impact
  const timeAdjustment = -Math.round((weeklyCommuteMinutes / 500) * 10); // Max ±10 points
  
  // 4. Transport cost adjustment
  // Calculate as percent of annual salary
  const costAsPercentOfSalary = (yearlyTransportCost / (monthlySalaryGross * 12)) * 100;
  const costAdjustment = -Math.round(costAsPercentOfSalary * 0.1); // Reduced weight - Max ±10 points
  
  // Final JHI score
  let totalJHI = baselineJHI + salaryAdjustment + benefitsAdjustment + timeAdjustment + costAdjustment;
  
  // Cap between 0 and 100
  return Math.min(100, Math.max(0, Math.round(totalJHI)));
}

/**
 * Calculate JHI impact from transport costs specifically
 * Properly accounts for actual user's preferred transport mode and benefits
 * 
 * @param monthlySalaryNet - Net monthly salary in CZK
 * @param monthlyBenefitsValue - Monthly value of benefits in CZK
 * @param monthlyTransportCost - Actual monthly transport cost in CZK based on user's preferred mode
 * @returns JHI score adjustment (-20 to +15)
 */
export function calculateJHITransportImpact(
  monthlySalaryNet: number,
  monthlyBenefitsValue: number,
  monthlyTransportCost: number
): number {
  if (monthlySalaryNet === 0) {
    // When no salary info available, still give small impact for transport
    if (monthlyTransportCost > 2000) return -3;
    if (monthlyTransportCost > 1000) return -1;
    return 0;
  }

  // Calculate real value: Net salary + Benefits - Transport Cost
  const realValue = monthlySalaryNet + monthlyBenefitsValue - monthlyTransportCost;
  const netDiff = realValue - monthlySalaryNet;

  // Percent impact on the net salary
  const percentImpact = (netDiff / monthlySalaryNet) * 100;

  // Scale: Each 1% = 1.5 JHI points (adjusted for transport)
  // Transport is one of most controllable costs, so weight it properly
  let scoreDelta = Math.round(percentImpact * 1.5);

  // Cap between -20 and +15
  return Math.min(15, Math.max(-20, scoreDelta));
}

/**
 * Compare actual JHI impact between different transport modes for the same job
 * Useful for showing user what they'd save/gain switching modes
 */
export function compareJHIAcrossTransportModes(
  monthlySalaryNet: number,
  monthlyBenefitsValue: number,
  modes: Array<{ mode: TransportMode; cost: number }>
): Array<{ mode: TransportMode; cost: number; jhiImpact: number }> {
  return modes.map(({ mode, cost }) => ({
    mode,
    cost,
    jhiImpact: calculateJHITransportImpact(monthlySalaryNet, monthlyBenefitsValue, cost)
  }));
}