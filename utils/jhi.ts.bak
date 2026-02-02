export const JHI_TUNING = {
    clampMin: 0,
    clampMax: 100,

    timeCost: {
        impactMultiplier: 2,
    },

    benefits: {
        thresholdEur: 100,      // minimum to count
        eurPerPoint: 30,        // scaling
        maxBonus: 8,
    },

    netBenefit: {
        thresholdEur: 200,
        eurPerPoint: 100,
        maxBonus: 6,
    },

    score: {
        minFactorWeight: 0.3,   // how much the weakest dimension penalizes score
    },
};

export const clamp = (value: number) =>
    Math.max(JHI_TUNING.clampMin, Math.min(JHI_TUNING.clampMax, value));

export const average = (values: number[]) =>
    values.reduce((sum, v) => sum + v, 0) / values.length;

export const applyTimeCostImpact = (base: number, jhiImpact: number) => {
    if (!jhiImpact) return base;
    return clamp(base + jhiImpact * JHI_TUNING.timeCost.impactMultiplier);
};

export const calculateBenefitsBonus = (benefitsValue: number) => {
    if (benefitsValue <= JHI_TUNING.benefits.thresholdEur) return 0;

    return Math.min(
        JHI_TUNING.benefits.maxBonus,
        Math.round(benefitsValue / JHI_TUNING.benefits.eurPerPoint)
    );
};

export const calculateNetBenefitBonus = (netBenefitValue: number) => {
    if (netBenefitValue <= JHI_TUNING.netBenefit.thresholdEur) return 0;

    return Math.min(
        JHI_TUNING.netBenefit.maxBonus,
        Math.round(
            (netBenefitValue - JHI_TUNING.netBenefit.thresholdEur) /
            JHI_TUNING.netBenefit.eurPerPoint
        )
    );
};

export const calculateOverallScore = (jhi: {
    financial: number;
    timeCost: number;
    mentalLoad: number;
    growth: number;
    values: number;
}) => {
    const dimensions = [
        jhi.financial,
        jhi.timeCost,
        jhi.mentalLoad,
        jhi.growth,
        jhi.values,
    ];

    const avg = average(dimensions);
    const minFactor = Math.min(...dimensions) / 100;

    const penaltyMultiplier =
        1 - JHI_TUNING.score.minFactorWeight * (1 - minFactor);

    return Math.round(avg * penaltyMultiplier);
};
