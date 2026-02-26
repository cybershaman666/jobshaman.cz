# Audit interakcí a benchmark pipeline

## Slabá místa (stav k 2026-02-26)
- Benchmark metriky pro shortlist/hire vycházejí z `job_applications.status`, ale v aplikaci není proces, který by statusy průběžně aktualizoval na `shortlisted` / `hired`.
- Externí aplikace (otevření URL mimo JobShaman) nejsou konzistentně zapisované do `job_applications`, což vede k podhodnocení pipeline i benchmarků.

## Doporučení
- Zavést server‑side workflow pro aktualizaci `job_applications.status` (např. webhook z ATS nebo interní workflow v dashboardu).
- U externích apply flow zavést potvrzení a zápis do `job_applications` na backendu (nezávisle na frontendu).
