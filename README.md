# JobShaman

JobShaman je AI-first platforma pro objevování práce, hodnocení nabídek a rozhodování kandidáta. Kombinuje vlastní feed nativních nabídek, externí agregaci, personalizovaný scoring a nástroje, které pomáhají pochopit, proč role dává smysl nebo naopak ne.

Nejde jen o klasický job board. Produkt dnes pokrývá discovery feed, JHI decision layer, kandidátní profil, AI-assisted application workflow a experimentální market radar nad externím trhem.

## Co aplikace dnes umí

- Personalizovaný hlavní feed pracovních nabídek s filtrováním, stránkováním a relevance rankingem.
- Hybridní vyhledávání na backendu (`hybrid_search_jobs_v2`) kombinující text, recenci, behaviorální signály a guardrails.
- JHI (Job Happiness Index) jako decision layer nad nabídkou, včetně personalizovaných preferencí kandidáta.
- AI analýzu pracovních nabídek, red-flag signály a vysvětlení relevance.
- AI drafty pro kandidátní profil a pro aplikační workflow.
- Candidate profile editor včetně zkušeností, vzdělání, preferencí, JHI vah a hard constraints.
- Career Map / taxonomii rolí a domén pro inferenci kandidátního směru.
- Market Radar nad externími zdroji s job/company/action přehledem.
- Externí agregaci nabídek přes MongoDB cache, včetně JobSpy pipeline pro LinkedIn / Indeed / Google / ZipRecruiter a další zdroje podle dostupnosti.
- Geocoding externích nabídek a fail-open přístup tam, kde souřadnice chybí.
- Multi-language UI: `cs`, `sk`, `de`, `pl`, `en`.
- Premium vrstvy jako hlubší personalizace, JCFPM/JHI rozšíření a AI assistance.

## Hlavní produktové vrstvy

### 1. Discovery feed

- Hlavní kandidátní feed míchá nativní nabídky a externí zdroje.
- Ranking preferuje relevance, čerstvost a rozumnou diverzitu zdrojů/firem.
- Čerstvé nabídky z posledních 24 hodin mají vyšší prioritu.
- Externí feed má freshness cutoff a degrade fallbacky pro případ výpadku cache.

### 2. JHI a rozhodovací kontext

- JHI neslouží jen jako dekorativní skóre, ale jako rozhodovací vrstva nad financemi, časem, dojezdem, work modelem a osobní prioritou kandidáta.
- Kandidát si může nastavit váhy pilířů i hard constraints.
- Detail role zobrazuje JHI dopad, praktické trade-offy a vysvětlující copy.

### 3. AI a kandidátní workflow

- AI analýza nabídky a bullshit/red-flag heuristiky.
- AI drafty pro profil a aplikační texty.
- Candidate onboarding, profilové inferenční kroky a preference bootstrap.
- Ukládání interakčních signálů pro budoucí zlepšování relevance.

### 4. External market intelligence

- JobSpy import běží do separátní MongoDB vrstvy, ne do hlavní Supabase tabulky s nativními rolemi.
- Raw import je oddělený od enriched/company snapshot vrstvy.
- Market Radar zobrazuje externí příležitosti, firmy a doporučené akce.
- Systém umí degradovat do fallback režimu, pokud některý externí backend endpoint nebo Mongo cache není dostupná.

## Architektura

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- i18next

### Backend

- FastAPI
- Supabase jako primární aplikační datastore pro hlavní produktová data
- MongoDB pro externí cached feed, JobSpy raw/enriched/company collections a další doplňkové vrstvy
- Vlastní matching/search engine v `backend/app/matching_engine`

## Důležité backend části

- `backend/app/routers/jobs.py`
  Hlavní jobs API, hybrid search, application workflow, external endpoints, JobSpy read endpoints.

- `backend/app/services/jobspy_jobs.py`
  Raw JobSpy import/search vrstva nad MongoDB, serializace, freshness filtry, geocoding backfill, storage health.

- `backend/app/services/jobspy_career_ops.py`
  Enrichment, scoring, company snapshots a career-ops feed pro Radar.

- `backend/app/routers/career_map.py`
  Career map inference a taxonomie kandidátního směru.

- `backend/app/matching_engine/serve.py`
  Hybrid search a ranking runtime.

## JobSpy a externí zdroje

JobSpy pipeline je v projektu zavedena jako experimentální external ingestion vrstva.

- ukládá se do MongoDB kolekcí:
  - `jobspy_jobs`
  - `jobspy_jobs_enriched`
  - `jobspy_company_snapshots`
- podporuje seed/import skripty v `backend/scripts/`
- umí geocoding backfill pro nabídky bez souřadnic
- má read endpointy pro hlavní feed i Market Radar

Externí vrstva je záměrně oddělena od hlavního produktu, aby:

- nezasviňovala nativní datastore
- šla ladit samostatně
- šla bezpečně vypnout nebo degradovat bez rozbití hlavního feedu

## Taxonomie a matching

Matching taxonomie je data-first a verzovaná mimo samotný Python kód.

- primární zdroj:
  `backend/app/matching_engine/role_taxonomy.json`
- volitelný CSV fallback:
  `backend/app/matching_engine/role_taxonomy_csv/`

Podporované CSV soubory:

- `domain_keywords.csv`
- `role_family_keywords.csv`
- `role_family_relations.csv`
- `required_qualification_rules.csv`
- `taxonomy_meta.csv`

Konverze:

```bash
python backend/scripts/taxonomy_json_csv.py export
python backend/scripts/taxonomy_json_csv.py import
python backend/scripts/taxonomy_json_csv.py roundtrip-check
```

## Lokální vývoj

Požadavky:

- Node.js `>=18`
- Python `>=3.10`

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
npm run dev:backend
```

Obě části najednou:

```bash
npm run dev:full
```

Typecheck:

```bash
npm run typecheck
```

## Konfigurace

Klíčové proměnné prostředí:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` nebo ekvivalentní backend key
- `JWT_SECRET` / `SECRET_KEY`
- `MONGODB_URI`
- `MONGODB_DB`
- `MONGODB_JOBSPY_COLLECTION`
- `MONGODB_JOBSPY_ENRICHED_COLLECTION`
- `MONGODB_JOBSPY_COMPANY_COLLECTION`
- `SCRAPER_TOKEN`

Poznámky:

- `MONGODB_URI` patří pouze na backend.
- Hlavní feed a Radar umí fungovat i v degradovaném režimu, pokud externí Mongo vrstva není dostupná.
- JobSpy scraping runtime potřebuje v backend prostředí nainstalované závislosti jako `python-jobspy`.

## Stav projektu

Produkt je aktivně vyvíjený a obsahuje mix stabilních a experimentálních vrstev.

Relativně stabilní:

- hlavní feed
- hybrid search
- profil kandidáta
- JHI a detail rolí
- AI draft / analysis workflow

Experimentální nebo průběžně laděné:

- JobSpy external ingestion
- Market Radar
- company snapshots a career-ops enrichment nad externím trhem

## Poznámka

Tento repozitář je proprietární interní produktový kód. README je orientační technický přehled aktuálních schopností systému, ne veřejná produktová dokumentace ani kompletní architektonická specifikace.
