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
    /self[-\s]?employed/i,
    /freelanc/i,
    /independent\s*contractor/i,
    /fakturac/i,
    /živnost/i,
    /osvč/i
];

const COMMISSION_PATTERNS = [
    /proviz/i,
    /prowizj/i,
    /kommission/i,
    /provision/i,
    /commission/i,
    /nezastropovan/i,
    /neomezen/i,
    /bez\s*stropu/i,
    /neexistuje\s*strop/i,
    /finanční\s*nezávislost/i,
    /financial\s*independence/i,
    /finanzielle\s*unabh[aä]ngigkeit/i,
    /niezależno[sś][cć]\s*finansow/i,
    /uncapped/i,
    /no\s*cap/i,
    /unlimited\s*commissions?/i,
    /unbegrenzte\s*provision(en)?/i,
    /nieograniczone?\s*prowizje?/i,
    /výkonnostn/i,
    /performance[-\s]?based/i,
    /leistungsabh[aä]ngig/i,
    /wynagrodzenie\s*za\s*wynik/i,
    /odměn[aě]\s*za\s*výkon/i,
    /na\s*procenta/i,
    /%+\s*z/i
];

const ACQUISITION_PATTERNS = [
    /akvizic/i,
    /akwizycj/i,
    /acquisition/i,
    /lead\s*generation/i,
    /cold\s*call/i,
    /cold\s*calls/i,
    /telefonát/i,
    /telefonát(y)?/i,
    /telefonate/i,
    /call\s*center/i,
    /callcenter/i,
    /lead(y|ů|ů|y)/i,
    /nových\s*klient/i,
    /new\s*clients?/i,
    /neukunden/i,
    /nowych\s*klient/i
];

const PART_TIME_PATTERNS = [
    /zkr[aá]cen[yý]\s*[úu]vazek/i,
    /zkr[aá]cen[eé]\s*[úu]vazku/i,
    /part[-\s]?time/i,
    /teilzeit/i,
    /teil\s*zeit/i,
    /part\s*time/i,
    /part[-\s]?time\s*job/i,
    /mini\s*job/i,
    /mini\-job/i,
    /minijob/i,
    /geringf[üu]gig/i,
    /umowa\s*zlecenie/i,
    /umowa\s*o\s*prac[eę]\s*na\s*czas\s*cz[eę]ściowy/i,
    /niepełny\s*wymiar\s*czasu/i,
    /czas\s*cz[eę]ściowy/i,
    /\bč[aá]stečn[ýá]\s*[úu]vazek/i,
    /m[eě]n[šs][íi]\s*[úu]vazek/i,
    /contratto\s*part[-\s]?time/i,
    /tempo\s*parziale/i,
    /partial\s*time/i,
    /reduced\s*hours/i,
    /short\s*hours/i
];

const extractWeeklyHours = (text: string): number | null => {
    const t = text.toLowerCase();
    // e.g., "20 hod./týdně", "10 hodin týdně", "20h týdně", "20h/week", "20 Std./Woche", "20 godzin tygodniowo"
    const patterns = [
        /(\d{1,2})\s*(h|hod|hodin)[\.\s]*\/?\s*t[ýy]dn[ěe]/i,
        /(\d{1,2})\s*(h|hrs?|hours?)\s*\/?\s*week/i,
        /(\d{1,2})\s*std\.?\s*\/?\s*woche/i,
        /(\d{1,2})\s*stunden\s*\/?\s*woche/i,
        /(\d{1,2})\s*godzin(y|a)?\s*\/?\s*tygodniowo/i,
        /(\d{1,2})\s*hodin(y|a)?\s*\/?\s*týden/i,
        /(\d{1,2})\s*uur\s*\/?\s*week/i,
        /(\d{1,2})\s*ore\s*\/?\s*settimana/i,
        /(\d{1,2})\s*h\s*\/?\s*semaine/i
    ];
    for (const p of patterns) {
        const m = t.match(p);
        if (m) {
            const hrs = parseInt(m[1], 10);
            if (!isNaN(hrs) && hrs > 0 && hrs <= 40) return hrs;
        }
    }
    return null;
};

const getPartTimeInfo = (job: Partial<Job>): { isPartTime: boolean; hoursPerWeek: number | null } => {
    const desc = (job.description || '').toLowerCase();
    const title = (job.title || '').toLowerCase();
    const isPartTime = PART_TIME_PATTERNS.some(p => p.test(desc)) || PART_TIME_PATTERNS.some(p => p.test(title));
    const hours = extractWeeklyHours(desc);
    return { isPartTime, hoursPerWeek: hours };
};

const isCommissionRole = (job: Partial<Job>): boolean => {
    const title = (job.title || '').toLowerCase();
    const desc = (job.description || '').toLowerCase();
    return COMMISSION_PATTERNS.some(p => p.test(desc)) || COMMISSION_PATTERNS.some(p => p.test(title));
};

const isIcoRole = (job: Partial<Job>): boolean => {
    const title = (job.title || '').toLowerCase();
    const desc = (job.description || '').toLowerCase();
    return ICO_PATTERNS.some(p => p.test(desc)) || ICO_PATTERNS.some(p => p.test(title));
};

const hasFixedBase = (job: Partial<Job>): boolean => {
    const desc = (job.description || '').toLowerCase();
    return (
        /fixn[ií]\s*mzd/i.test(desc) || /základn[ií]\s*mzd/i.test(desc) || // CS
        /fixn[aá]\s*mzda/i.test(desc) || /z[aá]kladn[aá]\s*mzda/i.test(desc) || // SK
        /basic\s*salary/i.test(desc) || /base\s*salary/i.test(desc) || /fixed\s*salary/i.test(desc) || // EN
        /grundgehalt/i.test(desc) || /grundvergütung/i.test(desc) || /fixgehalt/i.test(desc) || // DE/AT
        /podstawowe\s*wynagrodzenie/i.test(desc) || /stał[ea]\s*pensja/i.test(desc) || /wynagrodzenie\s*podstawowe/i.test(desc) // PL
    );
};

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

    // Normalize salary for part-time (convert to full-time equivalent)
    const { isPartTime, hoursPerWeek } = getPartTimeInfo(job);
    if (salary && isPartTime && hoursPerWeek && hoursPerWeek > 0) {
        const factor = 40 / hoursPerWeek;
        salary = salary * factor;
    }

    if (salary) {
        salaryScore = normalizeSalary(salary, currency);
    } else {
        // Penalty for hidden salary
        salaryScore -= 20;
    }

    // Variable/commission-heavy comp volatility (especially on IČO)
    const description = (job.description || '').toLowerCase();
    const hasCommission = isCommissionRole(job);
    const isIco = isIcoRole(job);
    const hasFixed = hasFixedBase(job);
    if (hasCommission) {
        salaryScore -= 35; // volatile income (primary penalty)
        if (isIco) salaryScore -= 20; // no standard protections
        if (!hasFixed) salaryScore -= 20; // commission-only risk
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

    // Part-time bonus (more personal time)
    const { isPartTime, hoursPerWeek } = getPartTimeInfo(job);
    if (isPartTime) {
        if (hoursPerWeek && hoursPerWeek > 0) {
            const reduction = Math.max(0, Math.min(30, 40 - hoursPerWeek));
            score += Math.round((reduction / 40) * 30); // up to +22
        } else {
            score += 10; // generic part-time boost if hours not specified
        }
    }

    // Sales / acquisition time tax (meetings, calls, networking)
    const titleLower = (job.title || '').toLowerCase();
    const descLower = (job.description || '').toLowerCase();
    const isSalesRole = /sales|prodej|obchod|akvizic/i.test(titleLower) || /akvizic|schůzk|schuzk|telefon|call\s*center|lead(y|ů|u)/i.test(descLower);
    if (isSalesRole) {
        score -= 15;
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
    const hasCommission = isCommissionRole(job);
    const isIco = isIcoRole(job);
    const hasAquisition = ACQUISITION_PATTERNS.some(p => p.test(descLower)) || ACQUISITION_PATTERNS.some(p => p.test(title));
    if (hasCommission) baseLoad -= 28;
    if (hasAquisition) baseLoad -= 12;
    if (hasCommission && isIco) baseLoad -= 12;
    if (hasCommission && hasAquisition) baseLoad -= 8;

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

    // Commission uncertainty should be the heaviest driver of risk
    const commissionRole = isCommissionRole(job);
    if (commissionRole) {
        totalScore *= 0.78; // strong global penalty for volatile income
        if (!hasFixedBase(job)) {
            totalScore *= 0.9; // additional penalty for commission-only
        }
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
