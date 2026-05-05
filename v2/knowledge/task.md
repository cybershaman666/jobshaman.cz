# Úkoly pro Fázi 1: Greenfield Setup a AuthContext

- [ ] Založení kořenové složky `/home/misha/Projekty (2)/jobshaman-new/jobshaman-v2`
- [x] Založení struktury pro Frontend (React/Vite app) a vyčištění výchozího kódu
- [x] Založení struktury pro Backend (FastAPI) s novými doménovými složkami
- [x] Zkopírování relevantního V2 UI kódu ze starého `/src/rebuild/` a `/src/cybershaman/` do nového frontendu
- [x] Odstranění všech produktových Supabase callů ze zkopírovaných frontendových komponent
- [x] Nastavení Supabase Auth inicializace v novém frontendu
- [x] Vytvoření backendové služby `AccessControlService` pro validaci JWT ze Supabase
- [x] Vytvoření zkušebního chráněného V2 endpointu na backendu (např. `/api/v2/candidate/profile/me`)

## Poznámka ke stavu

Aktivní V2 shell (`src/rebuild`, `src/cybershaman` a používané shell hooky) je odříznutý od přímého přístupu k produktovým Supabase tabulkám. Supabase klient je ve V2 auth-only a hranici hlídá `npm run check:boundaries`.

Některé legacy služby zůstávají v `src/services` jako nepřepojený migrační materiál, ale aktivní shell je nesmí importovat. Funkce bez hotového V2 API kontraktu vracejí prázdný stav nebo explicitně hlásí, že potřebují nový endpoint.

## Nově dokončeno po vyčištění Fáze 1

- [x] Explicitní V2 SQL migrace běží proti Northflank Postgresu.
- [x] V2 company profil umí ukládat rozšířená brand data, galerie a handshake materiály.
- [x] V2 asset vrstva obsluhuje upload session, finalize flow a podepsané download URL.
- [x] Frontend používá V2 upload flow pro CV, profilovou fotku, company branding a message attachments.

# Úkoly pro Fázi 2: Paralelní V2 datový model

- [x] Přidat idempotentní migraci pro produkční doménové kontrakty bez přepisování už aplikovaných migrací.
- [x] Doplnit legacy mapování pro `candidate_profiles_v2`, `opportunities` a `handshakes`.
- [x] Doplnit Identity signály s povinným původem, důvěrou, citlivostí, viditelností a confirmation statusem.
- [x] Doplnit opportunity ingest vrstvu (`raw_opportunity_imports`, source links, duplicity, quality report).
- [x] Doplnit Reality/JHI tabulky pro oddělené výpočty mzdy, dojezdu, reality role a JHI skóre.
- [x] Doplnit Recommendation snapshoty, vysvětlení a feedback.
- [x] Doplnit candidate-company share layer, sensitive access audit a handshake event trail.
- [x] Doplnit AI governance tabulky pro prompt verze, interpretační joby, AI výstupy a feedback.
- [x] Spustit migrace `001_core.sql`, `002_media_assets.sql` a `003_phase2_domain_contracts.sql` proti Northflank Postgresu.
- [ ] Napojit SQLModel/Pydantic modely na nové tabulky, které budou přímo používané backend services.
- [x] Napojit backend modely a API pro `candidate_identity_signals`.
- [x] Napojit backend modely a service zápisy pro `handshake_events`.
- [ ] Přepsat domain services tak, aby zapisovaly audit/event záznamy přes nové kontrakty.
- [x] Přidat BFF endpoint pro V2 recommendation feed nad `jobs_nf`.
- [x] Přidat BFF endpointy pro candidate/company share workflow.

## Další postup po candidate/company share BFF

- [x] Přidat SQLModel modely pro `candidate_company_shares` a `sensitive_access_logs`.
- [x] Přidat candidate endpointy `/api/v2/candidate/company-shares` pro vytvoření, výpis a revokaci sdílení.
- [x] Přidat company endpointy `/api/v2/company/{company_id}/candidate-shares` pro výpis a detail aktivních candidate shares.
- [x] Detail company share zapisuje auditní záznam do `sensitive_access_logs`.
- [x] Ověřeno: backend kompilace/import OK.
- [x] Opravit V2 frontend dev API routing: Vite bere env z `v2/frontend/.env` a lokální prohlížeč má pojistku na `http://localhost:8000/api/v2`, ne na produkční `site--jobshaman...` host z kořenového `.env`.
- [x] Opravit guest copy v candidate shellu: nepřihlášený uživatel už nevidí fallback `Ahoj, Tomáši`.
- [x] Zkopírovat root `/public` assety do `v2/frontend/public`, aby V2 shell našel loga, company stock ikony a Cybershaman ilustrace.
- [x] Doplnit V2 backend auth fallback přes Supabase `auth.get_user()`, když není dostupný `SUPABASE_JWT_SECRET`.
- [x] Doplnit lazy backfill existujících Supabase `profiles` + `candidate_profiles` do V2 `users` / `candidate_profiles_v2`.
- [x] Opravit paralelní lazy-provisioning V2 user mirroru, aby více současných requestů nenaráželo na unique constraint.
- [x] Frontend V2 profile mapping přenáší legacy story, CV, skills, tax/JHI preference a onboarding metadata z V2 mirroru.
- [x] Opravit profilovou navigaci v candidate sidebaru: `/candidate/insights#profile` už nepropadává do marketplace, profil má stabilní URL `/candidate/profile`.

## Poznámka po Northflank migraci

Migrace proběhla úspěšně proti `primary.jobs--rb4dlj74d5kc.addon.code.run` / databázi `_1ecf76718543`.
V této databázi není tabulka `jobs`; aktuální zdrojové tabulky s nabídkami jsou `jobs_nf` (46 413 řádků) a `jobspy_jobs_nf` (23 716 řádků). V2 canonical tabulka `opportunities` existuje a je zatím prázdná, takže Fáze 2 zůstává paralelní bez přepsání zdrojového feedu.

## Další postup po env/feed napojení

- [x] V2 frontend čte env z kořenového `.env`, tedy ze stejného env setu jako Northflank/Supabase backend.
- [x] Supabase frontend klient zůstává auth-only a bere `VITE_SUPABASE_URL` + `VITE_SUPABASE_KEY` / `VITE_SUPABASE_ANON_KEY`.
- [x] Backend auth vrstva načítá kořenový `.env` i `backend/.env`, aby JWT ověření a Northflank DB běžely ze stejného sdíleného nastavení.
- [x] `/api/v2/jobs` je dočasně napojený jako read-through adaptér nad `jobs_nf`.
- [x] `jobspy_jobs_nf` se nepoužívá jako V2 feed zdroj kvůli nízké kvalitě nabídek.
- [x] Ověřeno: `RealityDomainService.list_active_jobs()` vrací 200 položek z `jobs_nf`.

## Další postup po backend model napojení

- [x] Přidat `CandidateIdentitySignal` SQLModel pro tabulku `candidate_identity_signals`.
- [x] Přidat `HandshakeEvent` SQLModel pro tabulku `handshake_events`.
- [x] Přidat `/api/v2/candidate/signals` pro čtení a zápis kandidátních identity signálů.
- [x] Přidat `/api/v2/handshake/{handshake_id}/events` pro audit timeline kandidátových handshaků.
- [x] `HandshakeDomainService.initiate_handshake()` vytváří audit event `handshake_started`.
- [x] `HandshakeDomainService.update_status()` vytváří audit event `handshake_status_changed` a zvyšuje `state_version`.
- [x] Ověřeno: backend soubory kompilují a `app.main` importuje bez chyby.

## Další postup po Recommendation BFF

- [x] Přidat `RecommendationDomainService` pro deterministický baseline feed bez LLM rozhodování.
- [x] Přidat `/api/v2/recommendation/feed`, kt. když oerý vyžaduje Supabase JWT, lazy-provisionuje uživatele a vrací scored položky z `jobs_nf`.
- [x] Feed ukládá `recommendation_snapshots` s ranked `jobs_nf` ids jako auditovatelný snapshot paralelního modelu.
- [x] Frontend `jobServiceV2` nejdřív používá `/recommendation/feed?limit=120` a až při chybě padá zpět na `/jobs/`.
- [x] `jobspy_jobs_nf` zůstává mimo recommendation flow.
- [x] Ověřeno: backend kompilace/import OK a frontend `npm run build` OK.

## Další postup po opravě detailu importovaných nabídek

- [x] Importované nabídky z marketplace otevírají detail přes `/candidate/imported/{id}`, ne přes curated `/candidate/role/{id}`.
- [x] Frontend mapování `jobs_nf` už nedoplňuje falešné fallbacky `Česká republika`, `CZ`, `Hybrid` ani souřadnice Prahy.
- [x] Country/work model/currency se normalizují z reálných dat nabídky, URL, lokace a textu; zjevně německé importy se označí jako `DE`.
- [x] Marketplace respektuje domácí/cross-border filtr z profilu, takže zahraniční importy nespamují český feed, pokud není povolené hledání za hranicí.
- [x] Backend serializer nad `jobs_nf` už neposílá defaultní `CZK` / `Hybrid`, když zdrojová hodnota chybí.
- [x] Ověřeno: `npm run build` ve `v2/frontend` OK.

## Další postup po přestavbě detailu nabídky

- [x] Native i importovaný detail mají plnohodnotný hero layout s firemním kontextem a metadaty role.
- [x] Detail zobrazuje finanční realitu, dojezdovou realitu, daňový režim a JHI jako samostatný rozhodovací panel.
- [x] Native nabídka vede primárním CTA do branded handshake/journey.
- [x] Importovaná nabídka vede primárním CTA na původní server a explicitně upozorňuje na nutnost ověření zdroje.
- [x] Detail má panel „S kým máš tu čest“ pro kontakt/recruitera nebo externí zdroj a drží design V2 shellu.
- [x] Ověřeno: `npm run build` ve `v2/frontend` OK.

## Další postup po oživení marketplace a dashboardu

- [x] Marketplace quick actions už nejsou mrtvé: přepínají lokální/prezenční režim, curated změnu oboru nebo vedou do JCFPM.
- [x] Marketplace karty „Zobrazit“, sandboxy, mentor CTA a aktivita mají reálné akce/navigaci.
- [x] Dashboard archetypové taby přepínají obsah místo statického zobrazení.
- [x] Dashboard tlačítka „Zobrazit všechny“ u výzev a handshaků vedou do marketplace / handshake přehledu a řádky handshaků otevírají správnou roli nebo journey.
- [x] V2 profil zachovává zpětnou kompatibilitu s legacy Supabase JCFPM výsledky z `jcfpm_results` a ukládá je do `preferences.jcfpm_v1`, pokud ještě nejsou v Northflank mirroru.
- [x] Marketplace kompas používá legacy `preferences.jcfpm_v1.dimension_scores`, pokud existují.
- [x] Ověřeno: `npm run build` ve `v2/frontend` OK a backend soubory `legacy_supabase.py` / `identity/service.py` se kompilují.

## Další postup po produkčním V2 handshake řezu

- [x] V2 handshake už vrací plný `handshake-session-v1` kontrakt nad Northflank/PostgreSQL, ne pouze ID.
- [x] Přidány SQLModel vrstvy pro `handshake_messages`, `sandbox_sessions` a `sandbox_evaluations`.
- [x] Candidate API umí načíst handshake detail, ukládat odpovědi přes `PATCH /api/v2/handshake/{id}/answer` a finalizovat přes `POST /api/v2/handshake/{id}/finalize`.
- [x] Handshake odpovědi, submit a company readout zapisují auditní záznamy do `handshake_events`.
- [x] Sandbox assignment používá obecný adapter registry pro `native_text`, `native_file` a budoucí `external_launch` providery bez vendor lock-inu.
- [x] Company API má V2-only endpointy `/company/{company_id}/handshakes`, `/company/{company_id}/dashboard` a anonymní `/company/{company_id}/handshakes/{handshake_id}/readout`.
- [x] Recruiter dashboard se napojuje na V2 dashboard agregaci a prázdné V2 stavy už neskrývá demo kandidáty.
- [x] Ověřeno: backend `py_compile` OK, `app.main` importuje přes `v2/backend/.venv`, `npm run build` ve `v2/frontend` OK.

## Další postup po zjednodušení candidate sidebaru a vzdělávání

- [x] Candidate sidebar je zredukovaný na srozumitelné položky: Domů, Profil, Práce, Žádosti, Učení.
- [x] Technické názvy `Můj kód (JCFPM)`, `Výzvy (Sandbox)`, `Shody (Handshake)` a nefunkční zprávy už nejsou v hlavní levé navigaci.
- [x] Přidána route `/candidate/learning` / `/candidate/kurzy` / `/candidate/uceni`.
- [x] Přidána první V2 stránka `CandidateLearningPage` s doporučenými Czechitas cestami pro data, Python, testování a AI v datové analýze.
- [x] Ověřeno: `npm run build` ve `v2/frontend` OK.
- [x] V horní liště V2 dashboardu je vedle profilové fotky explicitní tlačítko pro odhlášení, aby šlo snadno přepnout kandidátský/firemní účet.
- [x] Horní lišta kandidáta má přímé tlačítko `Firma`, které vede do `/recruiter`; odhlášení už posílá na firemní vstup `/firmy`, ne zpět do kandidátského dashboardu.
- [x] Odhlášený kandidátní dashboard už nezobrazuje osobní/fallback archetypy, JHI ani profilová data; místo toho ukazuje přihlašovací bránu a logout čistí lokální kandidátní stav.
- [x] Registrace ve V2 auth modalu má povinný souhlas s obchodními podmínkami, povinný souhlas se zpracováním osobních údajů a samostatný volitelný opt-in pro e-mailové novinky/digest; souhlasy se ukládají do V2 profilu.
- [x] Firemní vstup už při otevření `/recruiter` dohledává existující firmu přes V2 `/company/me`; backend umí lazy backfill legacy Supabase firmy do Northflank `companies`/`company_users`, takže existující účet nemá padat do prázdného onboardingu.
- [x] Firemní loading stav už nezobrazuje interní V2/legacy diagnostiku a auth modal jasně rozlišuje přihlášení existujícího účtu od registrace nového účtu se souhlasy.
- [x] Firemní lookup má timeout/retry stav a backend backfill umí navázat membership na už přenesenou legacy firmu místo vytváření duplicit.
- [x] Legacy firemní backfill umí dohledat Supabase Auth user id podle e-mailu, když V2 mirror nemá stejný identifikátor, a frontend už neignoruje pozdější platnou odpověď `/company/me`.
- [x] Firemní dashboard po načtení V2 payloadu už nepoužívá demo kandidáty, demo týmovou mapu ani vyplňovací grafy; prázdné produkční stavy ukazují čisté empty states.
- [x] Firemní sidebar je sjednocený napříč přehledem a dalšími obrazovkami, odstraněná tvrdě napsaná demo firma `FutureTech` i zbytečný přepínač firem pro jednoho vlastníka.
- [x] Přidán V2 endpoint `/company/{company_id}/talent-pool`, který vrací registrované kandidátní profily; frontendový Talent pool už nevrací prázdný stub a řadí kandidáty podle překryvu s aktivními výzvami firmy.

## Další postup po opravě lokálního V2 startu

- [x] Kořenová route `/` už otevírá candidate dashboard, ne prázdný marketplace.
- [x] Marketplace má stabilní URL `/candidate/marketplace`.
- [x] Lokální frontend používá same-origin `/api/v2` přes Vite proxy místo přímého cross-origin volání na `localhost:8000`.
- [x] Pokud V2 profile endpoint dočasně selže, shell zachová přihlášení ze Supabase session a nezobrazí uživatele jako hosta.
- [x] Ověřeno: `node scripts/dev-v2.mjs` spustí backend na `localhost:8000`, frontend na `localhost:5173`, `/health` vrací healthy a proxy `/api/v2/jobs/` vrací data.
- [x] Ověřeno: `npm run build` ve `v2/frontend` OK.
- [x] V2 shell už nevolá legacy CSRF endpoint `/api/v2/csrf-token`.
- [x] V2 interaction state zůstává lokální cache/no-op, dokud nevznikne nový V2 endpoint, takže nevolá legacy `/api/v2/jobs/interactions/state/sync`.
- [x] Backend asyncpg engine používá `pool_pre_ping` a krátký recycle, aby první recommendation/profile request po reloadu nespadl na zavřené DB spojení.

## Další postup po vylepšení V2 recommendation feedu

- [x] Recommendation algoritmus už není čistý baseline nad posledními importy; používá preferenční a realitní scoring `v2.jobs_nf.preference_reality.2`.
- [x] Backend předvýběr nabídek skládá domácí kandidátní pool a omezený recent pool, aby čerstvé zahraniční importy nepřeválcovaly feed.
- [x] Scoring respektuje domácí zemi z `taxProfile/preferredCountryCode`, cross-border nastavení, remote preference, jazyk remote role, mzdu, target roli, doménu, dojezdový radius a legalitu.
- [x] Feed má balancer, který omezuje podíl zahraničních a remote nabídek, pokud kandidát nemá explicitní hard constraint `mustRemote`.
- [x] Identity update ukládá do V2 preferencí také `taxProfile`, `jhiPreferences`, `coordinates`, `transportMode` a `preferredCountryCode`, aby recommendation vidělo aktuální profil.
- [x] Výchozí V2 candidate preference už nemají cross-border hledání zapnuté automaticky.
- [x] Ověřeno: backend soubory kompilují; smoke test top 40 feedu po změně vrátil `CZ: 40` a mix `on_site: 18`, `remote: 18`, `hybrid: 4`.
- [x] Ověřeno: `npm run build` ve `v2/frontend` OK.

## Další postup po opravě lokální sekce marketplace

- [x] Marketplace sekce „Práce blízko tebe“ už nebere první nejbližší nabídku bez ohledu na radius; filtruje pouze ověřené non-remote role do nastavených km.
- [x] Pokud lokální nabídka v radiusu neexistuje, zobrazí se prázdný stav místo falešné Prahy nebo zahraničí vydávané za práci poblíž.
- [x] Efektivní souřadnice kandidáta se dopočítají ze statické geocoding cache podle adresy, když starší profil stále drží pražský fallback.
- [x] Importované nabídky bez `lat/lng` už nedostávají pražské souřadnice; zkusí se dopočítat z lokace, jinak jsou pro lokální vzdálenost neurčité.
- [x] Featured lokální karta ukazuje vzdálenost od kandidáta, aby bylo na první pohled jasné, proč je v sekci.
- [x] Ověřeno: `npm run build` ve `v2/frontend` OK.

## Další postup po opravě doménových obrázků

- [x] Frontend adaptér importovaných nabídek doplňuje vizuální doménu z titulku, firmy, popisu, tagů a lokace, když backend neposílá `inferredDomain`.
- [x] Gastro/hospitality nabídky jako kuchař, chef, restaurant, resort nebo catering padají do `hospitality` coverů místo technického/operations fallbacku.
- [x] Role family pro gastro nabídky je frontline, aby ladila s pracovním typem a nepadala do engineering fallbacku.
- [x] Ověřeno: `npm run build` ve `v2/frontend` OK.

## Další postup po rozšíření marketplace feedu

- [x] Nový marketplace už neřeže doporučené role na featured + 11 položek; používá stránkovaný grid po 24 kartách.
- [x] Horizontální posun u doporučených a tréninkových rolí je nahrazen responzivním gridem.
- [x] Doporučený blok při nastaveném radiusu drží prezenční/hybridní nabídky v dojezdovém radiusu a mimo radius nechává jen informativní počítadlo; remote role zůstávají ve výběru.
- [x] Frontend si žádá až 360 položek z recommendation feedu místo 120.
- [x] Backend recommendation limit je zvýšený na 500 a kandidátní pool nad `jobs_nf` bere větší domácí vzorek, aby 50k databáze nebyla reprezentovaná malým ořezem.
- [x] Ověřeno: backend soubory kompilují; `npm run build` ve `v2/frontend` OK.

## Další postup po napojení marketplace na stránkovaný katalog

- [x] `/api/v2/jobs/` je nově stránkovaný katalog nad `jobs_nf` s `limit`, `offset`, `country`, `total_count` a `has_more`.
- [x] Frontend první stránku marketplace skládá z recommendation feedu a katalogové stránky, další kliknutí tahá další offsety z databáze.
- [x] Marketplace zobrazuje stav načteno/celkem a umožňuje pokračovat v procházení katalogu místo konce po několika desítkách doporučení.
- [x] Role model má `matchScore`; recommendation položky používají skutečný `fit_score`, katalogové položky bez skóre už neukazují falešných 85 %.
- [x] Katalogové karty bez recommendation skóre ukazují neutrální štítek `nové`.
- [x] Frontend V2 katalog dopočítává souřadnice ze statické geocoding cache i pro jobs endpoint, takže radius filtr nezahazuje zbytečně nabídky s textovou lokací.
- [x] Ověřeno: backend soubory kompilují; `npm run build` ve `v2/frontend` OK.
