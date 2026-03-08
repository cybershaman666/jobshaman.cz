# Local Job Agent

Lokální agent pro hledání práce nad:
- `JobShaman` API
- `We Work Remotely` RSS feedem
- lokálním modelem v `Ollama`

Umí:
- stáhnout nabídky,
- ohodnotit shodu vůči CV a preferencím,
- vygenerovat personalizovanou odpověď,
- v `dry-run` režimu připravit payload pro odeslání,
- skutečně poslat aplikaci do `JobShaman`, pokud doplníš auth tokeny.

## Omezení

`We Work Remotely` nepoužívám pro automatické podání. Agent tam jen najde nabídku, vyhodnotí match a připraví odpověď s `apply_url`, protože podle jejich API Terms musí být samotné přihlášení směrované přes `weworkremotely.com`. Pro čtení používám jejich veřejný RSS feed, ne partnerské API s tokenem.

Pokud zlobí certifikát na `api.jobshaman.cz`, agent automaticky zkusí fallback domény z `.env`. Teprve jako nouzové lokální řešení můžeš nastavit `JOBSHAMAN_VERIFY_SSL=false`, ale to je vhodné jen pro testování.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Pak uprav:
- runtime `resume.md` a `preferences.yaml` v `/tmp/job-agent/` nebo přes web UI
- `.env` a hlavně `OLLAMA_MODEL=glm-4.5-flash` nebo `glm-4.7-flash`, podle toho co máš skutečně natažené v Ollamě

## CLI

```bash
python3 -m job_agent.cli fetch --limit 30
python3 -m job_agent.cli recommend
python3 -m job_agent.cli draft JOB_ID
python3 -m job_agent.cli apply JOB_ID
```

## API

```bash
uvicorn job_agent.api:app --reload
```

Po spuštění otevři:

```text
http://127.0.0.1:8000/
```

Na rootu je jednoduchý webový dashboard pro fetch, scoring, draft i apply dry-run.
Součástí dashboardu je i editor `resume.md` a `preferences.yaml`, takže už nemusíš profil měnit jen ručně v souborech.

Runtime soubory se defaultně ukládají do `/tmp/job-agent/`, ne zpět do repozitáře. Je to záměr, aby `uvicorn --reload` nerestartoval server po každém fetchi nebo uložení profilu.

Endpointy:
- `POST /jobs/fetch`
- `GET /jobs/recommendations`
- `GET /jobs/{job_id}/draft`
- `POST /jobs/{job_id}/apply`

## Doporučený postup

1. Vyplň vlastní CV a preference.
2. Spusť `fetch`.
3. Spusť `recommend` a zkontroluj high-match role.
4. U konkrétní role vygeneruj `draft`.
5. Nech zapnutý `JOB_AGENT_DRY_RUN=true`, dokud nebudeš spokojený s texty.
6. Teprve potom doplň JobShaman tokeny a vypni dry-run.
