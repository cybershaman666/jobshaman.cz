import { computeTaxByProfile, createDefaultTaxProfile } from './index';

describe('taxEngine', () => {
  it('computes non-negative net values for all supported countries', () => {
    const countries = ['CZ', 'SK', 'PL', 'DE', 'AT'] as const;

    for (const countryCode of countries) {
      const profile = createDefaultTaxProfile(countryCode);
      const result = computeTaxByProfile({
        grossMonthly: 50000,
        taxProfile: profile,
      });

      expect(result.netMonthly).toBeGreaterThanOrEqual(0);
      expect(result.totalDeductionsMonthly).toBeGreaterThanOrEqual(0);
      expect(result.ruleVersion.startsWith(countryCode)).toBe(true);
    }
  });

  it('applies family reliefs when spouse income and children are present', () => {
    const noFamily = computeTaxByProfile({
      grossMonthly: 70000,
      taxProfile: createDefaultTaxProfile('CZ'),
    });

    const withFamily = computeTaxByProfile({
      grossMonthly: 70000,
      taxProfile: {
        ...createDefaultTaxProfile('CZ'),
        maritalStatus: 'married',
        spouseAnnualIncome: 0,
        childrenCount: 2,
      },
    });

    expect(withFamily.netMonthly).toBeGreaterThanOrEqual(noFamily.netMonthly);
  });
});
