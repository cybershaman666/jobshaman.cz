# Tax Engine Governance Checklist

## Annual update checklist

1. Create new rulesets under `services/taxEngine/rules/<country>/<year>.ts`.
2. Update `DEFAULT_TAX_YEAR` in `services/taxEngine/index.ts`.
3. Validate:
   - tax brackets
   - social/health rates
   - taxpayer/spouse/children reliefs
   - country-specific thresholds
4. Run regression tests:
   - `services/taxEngine/taxEngine.test.ts`
   - `utils/jhiCalculator.test.ts`
5. Update migration defaults for new year when needed.
6. Record release note with `ruleVersion` changes.

## Runtime audit fields

- `FinancialReality.ruleVersion`
- `FinancialReality.taxBreakdown`
- FX snapshot version embedded as `@fx-YYYY-MM-DD`

These fields are required for explainability and post-incident auditing.
