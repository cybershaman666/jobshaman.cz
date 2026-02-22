# JobShaman

JobShaman je **Career OS** pro transparentní nábor a objevování práce. Nejsme klasický job board – kombinujeme AI, důraz na realitu nabídky a měřitelné signály chování.

## Klíčové funkce

- **Hybridní vyhledávání (Search v2)**: kombinuje FTS, trigramy, recenci a behaviorální signály.
- **Chytré řazení**: default/recommended/newest + guardrails proti zahlcení jednou firmou.
- **JHI (Job Happiness Index)**: srovnání nabídek podle užitku a reálné hodnoty.
- **AI analýza nabídky**: detekce red‑flagů a kvality inzerátu.
- **AI profil a doporučení**: personalizované výsledky podle profilu a chování.
- **Telemetrie interakcí**: ukládání expozic a feedbacku pro zlepšování relevance.
- **Compliance a bezpečnost**: role‑based přístup, auditovatelné signály, limitované akce.

## Odlišnosti od běžných pracovních portálů

- **Nejen full‑text**: ranking není jen „obsah shody“, ale i relevance, recence a behaviorální signály.
- **Anti‑spam + kvalita**: systém aktivně odstraňuje nekvalitní/nevěrohodné nabídky.
- **Transparence hodnoty**: JHI a AI vysvětlení „proč“ má nabídka smysl.
- **Personalizace bez noise**: doporučování není reklamní feed, ale relevance pro kandidáta.
- **Měřitelnost**: interakce uživatelů se ukládají jako signály pro zlepšení rankingů.
- **Konzistentní UX**: stejné filtry a řazení napříč celým produktem.

## AI a doporučování (high‑level)

- **Embeddings + akční pravděpodobnost**: kombinuje sémantiku a reálné chování.
- **Guardrails**: limituje nadměrné opakování jedné firmy, preferuje čerstvé nabídky.
- **Bezpečné fallbacky**: systém udržuje stabilní výsledky i při degradaci backendu.

## Matching taxonomie (data-first)

- Taxonomie pro AI shodu je externí: `backend/app/matching_engine/role_taxonomy.json`.
- Engine načítá JSON jako primární zdroj (bez potřeby měnit Python kód).
- Volitelný fallback je CSV adresář: `backend/app/matching_engine/role_taxonomy_csv/`.
- Podporované CSV soubory:
  - `domain_keywords.csv` (`domain,keyword`)
  - `role_family_keywords.csv` (`family,keyword`)
  - `role_family_relations.csv` (`source_family,target_family,weight`)
  - `required_qualification_rules.csv` (`name,job_term,candidate_term`)
  - `taxonomy_meta.csv` (`key,value`) pro `taxonomy_version`
- Konverzní skript:
  - `python backend/scripts/taxonomy_json_csv.py export`
  - `python backend/scripts/taxonomy_json_csv.py import`
  - `python backend/scripts/taxonomy_json_csv.py roundtrip-check`

## Vyhledávání (high‑level)

- **Search v2** běží jako samostatná runtime služba.
- **Pre‑computed indexace** na zápis: stabilní výkon i při vyšší zátěži.
- **Geofilter** pouze při dostupných souřadnicích (nezpůsobí prázdné výsledky).

---

**Status:** Proprietární systém. README je pouze informační přehled schopností produktu.
