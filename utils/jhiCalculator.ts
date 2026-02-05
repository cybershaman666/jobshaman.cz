import { Job, JHI } from '../types';
import { detectCurrency, detectCurrencyFromLocation } from '../services/financialService';

// --- CONFIGURATION ---

const TOXIC_PATTERNS = [
    { pattern: /mafiánsk/i, penalty: 40 },
    { pattern: /jsme rodina/i, penalty: 15 },
    { pattern: /vysoké pracovní tempo/i, penalty: 10 },
    { pattern: /odolnost vůči stresu/i, penalty: 20 },
    { pattern: /časová flexibilita/i, penalty: 10 },
    { pattern: /tah na branku/i, penalty: 5 },
    { pattern: /práce pod tlakem/i, penalty: 15 },
    { pattern: /ožele/i, penalty: 10 },
    // New "Igor" red flags
    { pattern: /přátelsk[áý]\s*atmosf[ée]ra/i, penalty: 5 }, // Often masks low pay
    { pattern: /lojalit/i, penalty: 15 }, // Looking for someone who won't leave when squeezed
    { pattern: /proaktivn/i, penalty: 5 }, // You'll do work for 3 people
    { pattern: /vysoce\s*motivovan/i, penalty: 10 }
];

const ICO_PATTERNS = [
    /i[čc]o/i,
    /b2b/i,
    /contractor/i,
    /fakturac/i,
    /živnost/i,
    /osvč/i
];

const COMMISSION_PATTERNS = [
    /proviz/i,
    /nezastropovan/i,
    /výkonnostn/i,
    /odměn[aě]\s*za\s*výkon/i,
    /na\s*procenta/i,
    /%+\s*z/i
];

const ACQUISITION_PATTERNS = [
    /akvizic/i,
    /cold\s*call/i,
    /telefonát/i,
    /call\s*center/i,
    /lead(y|ů|ů|y)/i,
    /nových\s*klient/i
];

const STRESS_ROLES = [
    { pattern: /sales|prodej|obchod/i, penalty: 20, label: 'Sales (pressure-driven)' },
    { pattern: /manažer|manager|vedoucí/i, penalty: 15, label: 'Management (responsibility)' },
    { pattern: /dispečer|dispatcher/i, penalty: 20, label: 'Dispatcher (high pace)' },
    { pattern: /call\s*center|zákaznick[áý]\s*podpora/i, penalty: 25, label: 'Customer Service (demanding)' },
    { pattern: /řidič|driver|kurýr/i, penalty: 15, label: 'Driving (time pressure)' },
    { pattern: /recepční|reception/i, penalty: 10, label: 'Reception (multi-tasking)' }
];

const BENEFIT_WEIGHTS = {
    // High Value (+10 to +20)
    'Sick Days': 15,
    '5 týdnů dovolené': 15,
    'Týden dovolené navíc': 15,
    'Plný Home Office': 20,
    'Vzdělávací budget': 15,
    'Penzijní připojištění': 10,
    '13. plat': 20,
    '14. plat': 20,
    'Služební auto': 15,

    // Medium Value (+2 to +5)
    'Flexibilní pracovní doba': 5,
    'Multisport': 5,
    'Občerstvení': 5,
    'Stravenky': 2, // Administrative necessity in 2026
    'Notebook': 0, // Standard equipment, not a benefit
    'Mobil': 0, // Standard equipment

    // Negative / Red Flags
    'Teambuilding': 0, // Context dependent
    'Ovoce': 0,
    'Mladý kolektiv': -5, // Often means "all juniors, no mentorship, sleeping under desks"
    'Dog-friendly': 2
};

const SALARY_BASELINE_EUR = 800; // 20k CZK
const SALARY_TARGET_EUR = 3200; // 80k CZK
const AVG_COMMUTE_PENALTY_PER_MIN = 1.2;

// --- HELPERS ---

const clamp = (val: number, min = 0, max = 100) => Math.min(Math.max(val, min), max);

const normalizeSalary = (amount: number, currency: string): number => {
    if (!amount) return 0;
    const { baseline, target } = getSalaryBounds(currency);
    const score = ((amount - baseline) / (target - baseline)) * 100;
    return clamp(score);
};

const normalizeCurrency = (currency?: string): string => {
    if (!currency) return 'CZK';
    if (currency === 'Kč') return 'CZK';
    return currency.toUpperCase();
};

const getCurrencyFromJob = (job: Partial<Job>): string => {
    const range = job.salaryRange || '';
    const rangeHasCurrency = /Kč|CZK|PLN|zł|CHF|€|\$|£/i.test(range);
    const fromRange = rangeHasCurrency ? normalizeCurrency(detectCurrency(range)) : '';
    if (fromRange) return fromRange;

    const cc = (job.country_code || '').toUpperCase();
    if (cc === 'PL') return 'PLN';
    if (cc === 'CH') return 'CHF';
    if (cc === 'CZ') return 'CZK';
    if (['DE', 'AT', 'SK', 'FR', 'IT', 'ES', 'NL', 'IE', 'BE', 'PT'].includes(cc)) return 'EUR';

    const fromLocation = normalizeCurrency(detectCurrencyFromLocation(job.location || ''));
    return fromLocation || 'CZK';
};

const getSalaryBounds = (currency: string): { baseline: number; target: number } => {
    const cur = normalizeCurrency(currency);
    const multiplier =
        cur === 'CZK' ? 25 :
        cur === 'PLN' ? 4.3 :
        cur === 'CHF' ? 1.05 :
        1; // EUR default

    return {
        baseline: SALARY_BASELINE_EUR * multiplier,
        target: SALARY_TARGET_EUR * multiplier
    };
};

// --- PILLARS ---

/**
 * 1. Financial Reality (F) - Weight 30%
 */
const calculateFinancialReality = (job: Partial<Job>): number => {
    let salaryScore = 40; // Default if hidden (below average but not 0)
    const currency = getCurrencyFromJob(job);

    // Determine salary to use
    let salary = job.salary_from;
    if (job.salary_to && job.salary_from) {
        salary = (job.salary_from + job.salary_to) / 2;

        // "Too wide to be true" penalty
        const spread = (job.salary_to - job.salary_from) / job.salary_from;
        if (spread > 0.4) {
            salaryScore -= 10; // Likely a trap: advertise high, offer low
        }
    } else if (job.salary_to) {
        salary = job.salary_to * 0.9; // Conservative estimate
    }

    if (salary) {
        salaryScore = normalizeSalary(salary, currency);
    } else {
        // Penalty for hidden salary
        salaryScore -= 20;
    }

    // Variable/commission-heavy comp volatility (especially on IČO)
    const description = (job.description || '').toLowerCase();
    const title = (job.title || '').toLowerCase();
    const hasCommission = COMMISSION_PATTERNS.some(p => p.test(description)) || COMMISSION_PATTERNS.some(p => p.test(title));
    const isIco = ICO_PATTERNS.some(p => p.test(description)) || ICO_PATTERNS.some(p => p.test(title));
    const hasFixed = /fixn[ií]\s*mzd/i.test(description) || /základn[ií]\s*mzd/i.test(description);
    if (hasCommission) {
        salaryScore -= 15; // volatile income
        if (isIco) salaryScore -= 10; // no standard protections
        if (!hasFixed) salaryScore -= 10; // commission-only risk
    }

    // Transparency bonus (EU compliant)
    if (job.salary_from && job.salary_to && !/dohodou/i.test(description)) {
        salaryScore += 10; // Reward transparency
    }

    return clamp(salaryScore);
};

/**
 * 2. Time Allocation (T) - Weight 25%
 */
const calculateTimeAllocation = (job: Partial<Job>): number => {
    let score = 100;

    // Work Type Impact
    if (job.type === 'Remote' || job.benefits?.includes('Plný Home Office')) {
        return 100; // Maximum score for remote
    }

    if (job.type === 'Hybrid' || job.benefits?.includes('Home Office')) {
        score = 80;
    } else {
        // On-site default
        score = 60;

        // "Modern office in center" trap - expensive parking/lunch, zero flexibility
        const description = (job.description || '').toLowerCase();
        if (/modern[íi]\s*kancel[áa]ř/i.test(description) && /centr/i.test(description)) {
            score -= 10; // Hidden costs + rigidity
        }
    }

    // Sick Days bonus (directly affects available time)
    const benefits = job.benefits || [];
    const hasSickDays = benefits.some(b => /sick\s*days/i.test(b) || /zdravotní volno/i.test(b));
    if (hasSickDays) {
        score += 5; // Don't need to use vacation when sick
    }

    // Commute Penalty (if available)
    if (job.distanceKm) {
        const estimatedMinutes = job.distanceKm * 2;
        score -= (estimatedMinutes * AVG_COMMUTE_PENALTY_PER_MIN);
    }

    return clamp(score);
};

/**
 * 3. Mental Well-being (W) - Weight 20%
 */
const calculateMentalWellbeing = (job: Partial<Job>, aiRiskScore: number = 0): number => {
    let baseLoad = 100;
    let toxicCount = 0;

    // Apply AI detected risk score if available
    baseLoad -= aiRiskScore;

    // Role-based stress detection
    const title = (job.title || '').toLowerCase();
    STRESS_ROLES.forEach(role => {
        if (role.pattern.test(title)) {
            baseLoad -= role.penalty;
        }
    });

    // Sales-specific volatility + acquisition pressure
    const descLower = (job.description || '').toLowerCase();
    const hasCommission = COMMISSION_PATTERNS.some(p => p.test(descLower)) || COMMISSION_PATTERNS.some(p => p.test(title));
    const isIco = ICO_PATTERNS.some(p => p.test(descLower)) || ICO_PATTERNS.some(p => p.test(title));
    const hasAquisition = ACQUISITION_PATTERNS.some(p => p.test(descLower)) || ACQUISITION_PATTERNS.some(p => p.test(title));
    if (hasCommission) baseLoad -= 12;
    if (hasAquisition) baseLoad -= 10;
    if (hasCommission && isIco) baseLoad -= 8;

    // Toxic Pattern Analysis
    TOXIC_PATTERNS.forEach(p => {
        if (p.pattern.test(descLower)) {
            baseLoad -= p.penalty;
            toxicCount++;
        }
    });

    // "Toxic Synergy" - Multiple red flags compound the problem
    if (toxicCount >= 3) {
        baseLoad *= 0.8; // Additional 20% penalty for toxic ecosystem
    }

    // Positive influence of health/wellbeing benefits
    const benefits = job.benefits || [];
    const hasSickDays = benefits.some(b => /sick\s*days/i.test(b) || /zdravotní volno/i.test(b));
    const hasVacation = benefits.some(b => /5 týdnů/i.test(b) || /dovolená navíc/i.test(b));
    const hasTherapy = benefits.some(b => /psycholog/i.test(b) || /duševní zdraví/i.test(b));

    if (hasSickDays) baseLoad += 10;
    if (hasVacation) baseLoad += 10;
    if (hasTherapy) baseLoad += 15;

    return clamp(baseLoad);
};

/**
 * 4. Growth Opportunity (G) - Weight 15%
 */
const calculateGrowthOpportunity = (job: Partial<Job>): number => {
    let score = 50; // Neutral start

    const description = (job.description || '').toLowerCase();
    const benefits = job.benefits || [];

    // Benefit Analysis
    let totalBenefitValue = 0;

    benefits.forEach(b => {
        for (const [key, weight] of Object.entries(BENEFIT_WEIGHTS)) {
            if (new RegExp(key, 'i').test(b)) {
                totalBenefitValue += weight;
                break;
            }
        }
    });

    // "Benefit Bullshit" Logic
    const hasRealBenefits = benefits.some(b =>
        /sick/i.test(b) || /dovolená/i.test(b) || /home\s*office/i.test(b) || /plat/i.test(b)
    );

    // If only low value benefits are present (e.g. only fruit or teambuilding), penalize
    if (!hasRealBenefits && totalBenefitValue < 10 && benefits.length > 0) {
        totalBenefitValue -= 10; // "Ovoce v kanclu" trap
    }

    score += totalBenefitValue;

    // Keywords in description
    if (/mentor/i.test(description)) score += 10;
    if (/školení/i.test(description) || /konference/i.test(description)) score += 10;
    if (/kariérní růst/i.test(description) || /posun/i.test(description)) score += 10;
    if (/budget/i.test(description) && /vzdělávání/i.test(description)) score += 15;

    return clamp(score);
};

/**
 * 5. Value Alignment (V) - Weight 10%
 */
const calculateValueAlignment = (_job: Partial<Job>): number => {
    // Placeholder - this requires User Profile matching.
    // Defaulting to neutral.
    return 50;
};

// --- MAIN CALCULATOR ---

export const calculateJHI = (job: Partial<Job>, aiRiskScore: number = 0): JHI => {

    const F = calculateFinancialReality(job);
    const T = calculateTimeAllocation(job);
    const W = calculateMentalWellbeing(job, aiRiskScore);
    const G = calculateGrowthOpportunity(job);
    const V = calculateValueAlignment(job);

    // Weighted Average
    // F(30) + T(25) + W(20) + G(15) + V(10)
    let totalScore = (F * 0.30) + (T * 0.25) + (W * 0.20) + (G * 0.15) + (V * 0.10);

    // Critical Red Flag Penalty
    // If any pillar is disastrously low (< 20), it drags the whole score down significantly
    const minPillar = Math.min(F, T, W, G);
    if (minPillar < 20) {
        totalScore *= 0.7; // 30% global penalty for a "broken" job aspect (e.g. highly toxic)
    }

    return {
        score: Math.round(totalScore),
        financial: Math.round(F),
        timeCost: Math.round(T),
        mentalLoad: Math.round(W),
        growth: Math.round(G),
        values: Math.round(V)
    };
};
