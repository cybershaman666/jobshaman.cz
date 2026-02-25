# External benchmark inputs (ISCO major groups)

This folder hosts **raw manual inputs** for external salary benchmarks
before they are transformed into `salary_public_reference`.

## File: `isco_major_inputs.csv`
Expected columns:
```
country_code,isco_major,region_key,seniority_band,employment_type,currency,p25,p50,p75,sample_size,data_window_days,source_name,source_url,period_label,measure_type,gross_net,employment_scope,updated_at,method_version
```

Notes:
- `isco_major` is 1–9 (ISCO major group).
- `role_family` will be generated as `isco_major_{n}`.
- `region_key` can be empty (default `xx_national`).
- If `p25`/`p75` are not provided, `p50` will be used for all.

## Flow
1. Fill `isco_major_inputs.csv` with external data.
2. Run:
```
python backend/scripts/etl_salary_public_reference.py
```
3. Seed:
```
python backend/scripts/seed_salary_public_reference.py --csv-dir backend/data/benchmarks_public
```
