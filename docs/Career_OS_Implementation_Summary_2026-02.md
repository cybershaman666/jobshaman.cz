# JobShaman -> Career OS: Implementační Souhrn (únor 2026)

## 1. Co se změnilo z pohledu produktu

JobShaman byl posunut z „job boardu + doplňkových marketplace modulů“ na **Career OS**:

- Primární fokus: kandidát + AI vedení profilu + doporučení práce.
- Freelancer a vzdělávací marketplace části byly funkčně utlumeny/odstraněny z hlavní cesty.
- Navigace a flow po přihlášení byly zjednodušeny, aby uživatel zůstával v nabídkách a aplikace ho samovolně nepřehazovala do cizích dashboardů.

## 2. Co je implementováno (high-level)

### A) AI Guided Profile + AI CV (Premium)

Byla přidána kompletní AI pipeline pro „odvyprávěný“ profil:

- Frontend wizard (6 kroků) s textem + hlasovým diktováním.
- Backend endpoint pro generaci profilu/CV:
  - `POST /ai/profile/generate` (V2)
- Legacy kompatibilita:
  - `POST /ai/profile-from-story` zůstává jako wrapper na V2.

Výstup AI:

- strukturované `profile_updates`
- rozšířené `ai_profile` (skryté schopnosti, motivace, leadership, atd.)
- `cv_ai_text` (plný životopis)
- `cv_summary` (krátké shrnutí)
- `meta` (prompt version, model, fallback, latency, token usage)

### B) AI Orchestration subsystem (backend)

Byla oddělena samostatná vrstva:

- `backend/app/ai_orchestration/`
  - `prompt_registry.py`
  - `client.py`
  - `pipeline.py`
  - `models.py`
  - `telemetry.py`

Klíčové vlastnosti:

- prompt versioning (DB `ai_prompt_versions`)
- schema-validace výstupu (Pydantic)
- retry + fallback model
- determinističtější produkční generace (`temperature=0`, `top_p=1`, `top_k=1`)
- auditní hashe:
  - `input_hash`, `prompt_hash`, `output_hash`, `section_hashes`
- diff tracking mezi generacemi (`ai_generation_diffs`)

### C) Matching Analytics Engine (backend)

Matching je oddělen do samostatného subsystemu:

- `backend/app/matching_engine/`
  - `feature_store.py`
  - `embeddings.py`
  - `retrieval.py`
  - `scoring.py`
  - `normalization.py`
  - `demand.py`
  - `serve.py`

`GET /jobs/recommendations` nyní používá tento engine.

Logika:

- **2-stage ranking**
  - 1) embedding similarity -> shortlist
  - 2) structured scoring -> finální pořadí
- score je vícerozměrné, normalizované komponenty:
  - `skill_match`
  - `demand_boost`
  - `seniority_alignment`
  - `salary_alignment`
  - `geography_weight`
- navíc vysvětlitelnost:
  - `missing_core_skills`
  - `seniority_gap`
  - `component_scores`

### D) Hybrid batch + online výpočty

APScheduler jobs:

- hodinově: embeddings + doporučení cache
- denně: demand layer refresh

Online request využívá cache, při miss/stale přepočítá.

## 3. Databázové změny

### Kandidátský profil

Rozšíření `candidate_profiles` (AI/hidden skills pole), včetně:

- `story`, `hobbies`, `volunteering`, `leadership`, `strengths`, `values`
- `inferred_skills`, `awards`, `certifications`, `side_projects`
- `motivations`, `work_preferences`
- `cv_ai_text`

### Nové Career OS tabulky

- `ai_prompt_versions`
- `ai_generation_logs`
- `ai_generation_diffs`
- `candidate_embeddings`
- `job_embeddings`
- `skill_graph_nodes`
- `skill_graph_edges`
- `market_skill_demand`
- `salary_normalization`
- `recommendation_cache`

`pgvector` extension je aktivována (`vector`).

## 4. Security / Governance

- Pro nové tabulky byla doplněna RLS.
- User-specific tabulky mají policy „jen vlastní data“ (např. logs/cache/embeddings kandidáta).
- Shared analytické tabulky mají read policy pro `authenticated`.
- AI telemetry loguje hashované/auditní metadata, ne raw citlivý obsah pro observability.

## 5. Frontend změny

- Nový AI wizard v profilu (`AIGuidedProfileWizard`).
- Profil editor umí uložit AI výsledky do profilu + CV.
- Job recommendation flow umí z backendu číst:
  - `score`
  - `reasons`
  - `breakdown`
  - `model_version`
- UI v detailu pozice zobrazuje „proč je doporučeno“.

## 6. UX změny mimo Career OS jádro

- Skryty/utlumeny části navázané na starý freelance/education navigační model.
- Upraveno přihlášení a přesměrování:
  - uživatel po loginu zůstává v aktuálním kontextu (např. nabídky)
  - odstraněny rušivé chybné modaly firemního onboardingu pro kandidáty
- Geocoding zpřesněn:
  - detailní adresa už není redukována jen na „město“

## 7. Build/tech debt status

- Byly odstraněny/nebo nahrazeny hlavní příčiny Vite warningů (mix dynamic + static importů).
- Upraven chunking ve `vite.config.ts` (vendor split) a odstraněny circular chunk problémy.
- Proběhl cleanup nepoužívaných/starých částí (např. staré AI service/legacy komponenty).

## 8. Jak systém funguje end-to-end (jednoduše)

1. Kandidát otevře profil a v AI průvodci odvypráví svůj příběh.
2. Backend AI orchestrace z příběhu vytvoří strukturovaný profil + CV.
3. Výstupy se uloží do kandidátského profilu.
4. Matching engine průběžně vytváří embeddings a recommendation cache.
5. V nabídkách práce uživatel dostane doporučené pozice s vysvětlením skóre.
6. Systém průběžně měří stabilitu/změny AI výstupů přes hash + diff audit.

## 9. Co je businessově nejdůležitější

- Produkt už není jen „seznam práce“, ale **Career OS** s aktivní AI podporou kandidáta.
- Máme základ pro enterprise požadavky na auditovatelnost:
  - verze promptů
  - determinističtější inference
  - logging + diffy
  - vysvětlitelné recommendation breakdown
- Technicky je připraven prostor pro další moat:
  - skill graph enrichment
  - lepší salary normalization data
  - přesnější demand modely podle regionu/času.

## 10. Doporučené další kroky (Q2)

- Zavést explicitní „model registry“ a release flagy pro AI/matching verze.
- Doplnit seasonal bias correction tabulku (měsíční korekce demand).
- Rozšířit salary normalization o robustní role taxonomy.
- Přidat interní dashboard pro AI quality:
  - schema pass rate
  - fallback rate
  - diff volatility
  - conversion impact na aplikace.

## 11. Onboarding: ideální workflow pro úplně nového uživatele

Tento postup je psaný srozumitelně pro každého, bez ohledu na obor (řidič, zdravotník, technik, obchodník, dělník, administrativa).

### Krok 1: První návštěva (bez registrace)

Co udělat:

- Otevřete nabídky práce a projděte si 5 až 10 pozic.
- Nastavte základní filtry: město, typ práce, plat, jazyk.
- Uložte si 3 až 5 nabídek, které Vás zaujaly.

Proč:

- Rychle uvidíte, co je na trhu.
- Uděláte si jasný obrázek, co má smysl řešit dál.

### Krok 2: Registrace a základ profilu

Co udělat:

- Založte si účet.
- Vyplňte základ:
  - jméno
  - jakou práci hledáte
  - kde chcete pracovat
  - co umíte

Proč:

- Systém pak ukazuje relevantní nabídky místo náhodného obsahu.
- Lokalita výrazně zpřesní doporučení.

### Krok 3: AI průvodce profilem (nejdůležitější krok)

Co udělat:

- Spusťte AI průvodce.
- Jednoduše popište svůj pracovní příběh:
  - kde jste pracovali
  - co se Vám povedlo
  - co Vás baví i mimo práci
  - jaké podmínky Vám vyhovují
- Zkontrolujte výstup a uložte profil + životopis.

Proč:

- Tady se ukáže hlavní hodnota: systém najde i schopnosti, které se běžně do životopisu nedostanou.
- Díky tomu dostanete nabídky, které sedí nejen podle názvu pozice.

### Krok 4: Doladění doporučení

Co udělat:

- Otevřete sekci Doporučené nabídky.
- U každé vhodné nabídky se podívejte, proč ji systém doporučuje.
- Vhodné nabídky si ukládejte.
- Když doporučení nesedí, upravte profil (typ práce, dovednosti, podmínky).

Proč:

- Po pár úpravách jde přesnost doporučení rychle nahoru.
- Místo chaosu dostanete jasný směr.

### Krok 5: Aktivní režim (týdenní rutina)

Doporučený rytmus:

- 2 až 3krát týdně zkontrolujte nové doporučené nabídky.
- Jakmile přibude nová zkušenost nebo kurz, doplňte to do profilu.
- Držte si seznam 10 až 20 nejlepších pozic.

Proč:

- Doporučení zůstává aktuální.
- Hledání práce je pak rychlejší a méně vyčerpávající.

### Krok 6: Kdy aktualizovat AI profil znovu

Doporučené spouštěče:

- změna oboru nebo typu práce
- dokončený větší projekt
- nový kurz nebo certifikát
- změna města nebo režimu práce (na místě / hybrid / na dálku)

Pravidlo:

- Projděte AI průvodce znovu alespoň jednou za 2 až 3 měsíce.

### „Maximum value“ checklist pro uživatele

- [ ] Vyplněný profil (ne jen založený účet)
- [ ] Dokončený AI průvodce
- [ ] Uložené AI CV + shrnutí
- [ ] Aktivní práce s doporučenými pozicemi
- [ ] Pravidelná aktualizace profilu podle skutečnosti

### Co uživatel získá při správném použití

- vhodnější nabídky než při běžném procházení pracovních portálů
- lepší přehled o tom, co opravdu umí
- jasnější rozhodování, protože u doporučení vidí důvod
- rychlejší cestu k práci, která sedí dovednostmi i osobně
