# Public Salary Benchmarks

CSV files in this directory are used to seed the `salary_public_reference` table.

## Expected CSV header
```
country_code,role_family,region_key,seniority_band,employment_type,currency,p25,p50,p75,sample_size,data_window_days,source_name,source_url,period_label,measure_type,gross_net,employment_scope,updated_at,method_version
```

## Notes
- `gross_net` must be `gross` (we only store gross numbers).
- `measure_type` should be `median` or `average`.
- `region_key` can be `cz_national`, `sk_national`, etc. for national datasets.
- `employment_scope` should be `full_time` unless specified otherwise by the source.
- Role-specific external data can be stored as `role_family=isco_major_{n}` where `n` is ISCO major group 1–9.

## Usage
- Seed: `python backend/scripts/seed_salary_public_reference.py --csv-dir backend/data/benchmarks_public`
- Scheduled refresh uses the same directory via `SALARY_PUBLIC_REFERENCE_CSV_DIR`.
