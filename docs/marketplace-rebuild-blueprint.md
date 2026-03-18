# JobShaman Marketplace Rebuild Blueprint

## 1. North Star

JobShaman nema byt dalsi vazny job board. Ma pusobit jako moderni marketplace pracovnich vyzev:

- jedna plocha pro `imported`, `native` i `micro_job` vyzvy
- detail neni "formular na CV", ale vstup do prostredi firmy a tymu
- primarni akce neni `apply`, ale `digital handshake`
- design ma byt futuristicky, hravy, lidsky a cisty
- mapa je diferencujici vrstva produktu a musi zustat zachovana

Produktova veta:

> "Nevybiras dalsi inzerat. Vstupujes do konkretni situace, ktera potrebuje tvoji energii, mysleni a pristup."

---

## 2. Co je dnes nejvetsi problem

Soucasny kod funguje, ale ztraci hranice mezi orchestraci, routingem, daty a zobrazenim.

### Frontend

- [App.tsx](/home/misha/Projekty/jobshaman-new/App.tsx) je hlavni orchestrator, router, state container i layout shell v jednom
- [components/AppSceneRouter.tsx](/home/misha/Projekty/jobshaman-new/components/AppSceneRouter.tsx) kombinuje scenove rozhodovani s props drillingem
- [components/challenges/ChallengeFocusView.tsx](/home/misha/Projekty/jobshaman-new/components/challenges/ChallengeFocusView.tsx) uz resi moc ruznych odpovednosti najednou
- vedle sebe existuji nove i stare varianty marketplace flow, napr. [components/challenges/ChallengeMarketplaceLegacy.tsx](/home/misha/Projekty/jobshaman-new/components/challenges/ChallengeMarketplaceLegacy.tsx)
- domenske koncepty jsou rozesete mezi `components`, `services`, `utils` a root soubory bez pevne hranice

### Backend

- backend je funkcne silnejsi a modularnejsi nez frontend
- ale router `jobs` drzi prilis velkou cast use-cases v jednom modulu: [backend/app/routers/jobs.py](/home/misha/Projekty/jobshaman-new/backend/app/routers/jobs.py)
- handshake, listing lifecycle, imported search a dialogue vrstvy je potreba oddelit do citelnych aplikacnich modulu

### Produkt / UX

- marketplace jeste nepusobi jako jednotny "challenge world"
- detail ma hodne informaci, ale ne dost silny prostorovy zazitek
- primarni user journey je porad misty blizko job boardu, ne "vstupu do mise"
- chybi jasna architektura pro tri druhy vyzev:
  - importovane
  - nativni firemni
  - mini vyzvy od uzivatelu

---

## 3. Cileny produktovy model

Misto "jobs" navrhuji pracovat s jednotnym entitnim pojmem:

## `Challenge`

Jedna domenska entita se spolecnym renderovacim modelem:

- `id`
- `sourceType`: `imported | native | micro`
- `visibility`
- `challengeFormat`
- `company`
- `workspace`
- `mission`
- `signals`
- `reality`
- `handshake`
- `activity`
- `navigation`

### Challenge jako wrapper nad ruznymi zdroji

#### `imported`
- pochazi z jineho portalu
- handshake je lehci / orientacni vrstva
- CTA smeruje ven, ale porad po priprave uzivatele

#### `native`
- publikovano firmou v JobShamanu
- handshake je plnohodnotna prvni interakce
- nasleduje dialog, ne blind apply

#### `micro`
- mensi fuska / audit / ukol / experiment
- publikovat muze firma i uzivatel
- handshake muze byt ultra kratky a casove ohraniceny

Klicova zmena:

`listing source` nesmi menit cele UX, jen intenzitu a moznosti handshake flow.

---

## 4. Nova informacni architektura

## Marketplace = 4 vrstvy

### A. Discovery Layer

Prvni dojem a objevovani:

- hero / atmosphere
- global search
- marketplace feed
- mapa
- quick filters
- lane switching (`all`, `native`, `imported`, `micro`)

### B. Challenge Layer

Detail karty jako "vstup do prostoru":

- mise / problem
- kontext tymu
- reality signal
- first-contact question
- proof / activity / trust
- handshake CTA

### C. Dialogue Layer

Po handshake:

- odeslana uvodni odpoved
- asynchronni dialog
- doplnujici materialy
- follow-up otazky

### D. Builder Layer

Pro firmy i uzivatele:

- create native challenge
- create mini challenge
- compose handshake prompt
- sprava dialogu a stavu reakci

---

## 5. Navrh noveho UX

## 5.1 Marketplace homepage

Homepage nema byt seznam. Ma pusobit jako `challenge harbor`.

### Nadpis

Misto korporatniho "find jobs" neco v tomto duchu:

- "Vyber si problem, ktery stoji za tvoji energii"
- "Vstup do tymu driv, nez posles CV"
- "Marketplace pracovnich vyzev"

### Hero skladba

- velke atmosfericke pozadi inspirovane mockupem
- ne fotobankovy korporat, ale futuristicka scenografie
- pres nej polozeny velmi cisty search shell
- pod nim tri vstupy:
  - `Prozkoumat vyzvy`
  - `Otevrit mapu`
  - `Zadat mini vyzvu`

### Discovery canvas

Pod hero:

- feed a mapa jako rovnocenne rezimy
- sticky exploration toolbar
- lanes:
  - `All Challenges`
  - `Company Challenges`
  - `Imported Opportunities`
  - `Mini Gigs`

### Karty

Kazda karta ma mit jen 4 odpovedi:

- co se tady realne resi
- kdo to resi
- proc je to zajimave pro me
- jak vypadat prvni krok

Nezobrazovat primarne:

- dlouhy text
- chaos badge
- tunu metadat bez hierarchie

---

## 5.2 Detail karty = vstup do firmy

Tady je nejvetsi produktova prilezitost.

Detail ma pusobit jako "mikro-prostor" firmy nebo pracoviste.

### Navrzena struktura detailu

#### 1. Arrival

Vrsek detailu:

- hero panel s atmosferou firmy / prostoru / provozu
- logo, nazev, tim / mise
- signal stylu spoluprace
- ton komunikace

#### 2. Mission

Hlavni problem:

- "Co je potreba vyresit"
- "Proc to prave ted hori"
- "Jak by vypadal prvni dobry krok"

#### 3. Reality

Pravdiva orientace:

- financni realita
- location / remote / commute
- casova narocnost
- seniority expectations
- trust signaly

#### 4. Handshake

Primarni CTA blok:

- kratka odpoved od kandidata
- "Jak bych zacal"
- "Co bych potreboval overit"
- volitelne prilozeni profilu / CV az jako druha vrstva

#### 5. Team / Workspace

- firma
- tym
- verejna aktivita
- tempo odpovedi
- jaci lide vedou dialog

#### 6. Deep context

- full text
- benchmarky
- original listing
- souvisejici vyzvy

### Zmena CTA logiky

Namisto:

- `Poslat CV`
- `Apply now`
- `Checkout premium`

Pouzivat:

- `Podat ruku`
- `Ukazat prvni pristup`
- `Vstoupit do dialogu`

---

## 5.3 Mapa

Mapa je konkurencni vyhoda. Nema byt beta bokem, ale druhy hlavni rezim discovery.

### Mapa ma zustat

- zachovat stavajici model a technologii
- zachovat karierni graf a neighborhood / ecosystem logiku
- zachovat pocit orientace v trhu, ne jen seznam bodu

### Co upravit

- mapa se stane plnohodnotnou vrstvou marketplace shellu
- detail z mapy otevre stejny challenge environment jako feed
- levostranna filtrace a pravostranny live preview panel
- `hover -> signal`, `click -> arrival panel`, `deep open -> detail scene`

### Mapa nema konkurovat feedu

Ma byt odpoved na jinou otazku:

- feed: "co je pro me relevantni ted"
- mapa: "v jakem prostoru se pohybuju a kam muzu rust"

---

## 6. Design direction

Zaklad neni "LinkedIn 2.0". Je to:

- futuristicke, ale klidne
- hrave, ale ne infantilni
- premium, ale ne snobske
- lidske, ne korporatni

### Doporuceny vizualni smer

- cosmic / atmospheric background jen v hero a arrival vrstvach
- UI vrstvy velmi ciste, sklenene, citelne
- silne kontrastni headlines
- teple svetlo + emerald / cyan signaly
- mene boxiku, vice velkych dechovych ploch

### Design principy

- primarni plocha je vzdy jedna dominantni myslena akce
- informacni hierarchie po blocich, ne po drobnych badge
- animace maji pusobit jako energie a tok, ne dashboard
- detail ma mit pocit "mista", ne "stranky"

### Doplnujici moodboard slova

- mission control
- quiet future
- human technology
- digital handshake
- workplace atmosphere
- signal over noise

---

## 7. Cilova frontend architektura

Navrhuji prejit na feature-first modularitu s jasnou hranici mezi:

- `app`
- `pages`
- `features`
- `entities`
- `shared`

## Navrzeny target tree

```text
src/
  app/
    providers/
    router/
    layout/
    boot/
  pages/
    marketplace/
    challenge-detail/
    company-space/
    create-challenge/
    profile/
  features/
    marketplace-discovery/
    marketplace-map/
    challenge-arrival/
    challenge-handshake/
    challenge-reality/
    challenge-dialogue/
    company-studio/
    mini-challenge-compose/
    auth-entry/
  entities/
    challenge/
      model/
      api/
      ui/
    company/
    user/
    dialogue/
    map-node/
  shared/
    ui/
    lib/
    theme/
    api/
    config/
```

## Klicova pravidla

### `app`
- jen bootstrap, providery, route shell, global theme, session hydration

### `pages`
- skladaji feature moduly do konkretnich scen

### `features`
- drzi konkretni use-case a UX flow

### `entities`
- drzi domenske modely, adaptery, API klienty a zakladni UI stavebnice

### `shared`
- design system, utility, API infrastructure, common hooks

---

## 8. Jak rozdelit dnesni frontend

## 8.1 Rozbit `App.tsx`

Aktualne je [App.tsx](/home/misha/Projekty/jobshaman-new/App.tsx) prilis velky.

### Cileny rozpad

- `app/boot/AppProviders.tsx`
- `app/layout/AppShell.tsx`
- `app/router/AppRouter.tsx`
- `app/router/routeState.ts`
- `app/session/useSessionBootstrap.ts`
- `app/discovery/useMarketplaceState.ts`
- `app/overlays/useGlobalModals.ts`

`App.tsx` pak ma zustat jen tenky composition root.

## 8.2 Rozbit `AppSceneRouter`

[components/AppSceneRouter.tsx](/home/misha/Projekty/jobshaman-new/components/AppSceneRouter.tsx) ma moc props a moc scen v jednom miste.

### Cileny rozpad

- `pages/marketplace/MarketplacePage.tsx`
- `pages/challenge-detail/ChallengeDetailPage.tsx`
- `pages/company-space/CompanySpacePage.tsx`
- `pages/blog/BlogPage.tsx`
- `pages/saved/SavedChallengesPage.tsx`

Routing ma pracovat s `page-level loaders / adapters`, ne s props drillingem pres vsechny sceny.

## 8.3 Rozbit challenge modul

### Nove feature bloky

- `features/marketplace-discovery/ui/MarketplaceHero.tsx`
- `features/marketplace-discovery/ui/MarketplaceToolbar.tsx`
- `features/marketplace-discovery/ui/ChallengeFeed.tsx`
- `features/marketplace-map/ui/ChallengeMapWorkspace.tsx`
- `features/challenge-arrival/ui/ChallengeArrivalScene.tsx`
- `features/challenge-reality/ui/ChallengeRealityPanel.tsx`
- `features/challenge-handshake/ui/DigitalHandshakePanel.tsx`
- `features/challenge-dialogue/ui/DialogueTimeline.tsx`

### Co presunout z dnesnich souboru

- z [components/challenges/ChallengeControlCenter.tsx](/home/misha/Projekty/jobshaman-new/components/challenges/ChallengeControlCenter.tsx)
  - workspace shell
  - toolbar
  - map/feed switching
  - create mini challenge entry

- z [components/challenges/ChallengeFocusView.tsx](/home/misha/Projekty/jobshaman-new/components/challenges/ChallengeFocusView.tsx)
  - arrival scene
  - reality section
  - company / trust blocks
  - handshake block
  - imported-specific guidance

### Co deprecovat

- [components/challenges/ChallengeMarketplaceLegacy.tsx](/home/misha/Projekty/jobshaman-new/components/challenges/ChallengeMarketplaceLegacy.tsx)

Legacy kod drzet jen po dobu migrace za feature flagem, pak odstranit.

---

## 9. Design system 2.0

Uz mate dobry smer v [docs/solarpunk-design-system-v2.md](/home/misha/Projekty/jobshaman-new/docs/solarpunk-design-system-v2.md). Doplnil bych ho o marketplace-specific primitives:

### Nove primitives

- `AtmosphereHero`
- `GlassPanel`
- `SignalBadge`
- `MissionCard`
- `HandshakeComposer`
- `TrustStrip`
- `RealityMetric`
- `WorkspaceSceneHeader`
- `MapDock`

### CSS token vrstvy

- `--aurora-*` pro hero ambient barvy
- `--signal-*` pro stavove komunikacni signaly
- `--surface-glass-*` pro translucent cards
- `--scene-*` pro detail view spacing a radii

### Typografie

- headline font muze byt expresivnejsi nez body
- body text musi zustat vysoko citelny
- velke display headlines jen v hero a arrival scene

### Motion

- pomale ambient animace pozadi
- handshake confirmation micro-animation
- map transition a panel reveal
- zadne agresivni hover disco

---

## 10. Cilova backend modularita

Backend neprepisovat kompletne. Je lepsi ho zpevnit kolem nove domenske mapy.

## Doporucene moduly

```text
backend/app/
  domain/
    challenges/
    handshakes/
    dialogues/
    companies/
    discovery/
    map/
  application/
    challenges/
    handshakes/
    discovery/
  infrastructure/
    db/
    search/
    ai/
    messaging/
  routers/
    marketplace.py
    challenges.py
    handshakes.py
    dialogues.py
    map.py
```

## Rozpad `jobs.py`

Z [backend/app/routers/jobs.py](/home/misha/Projekty/jobshaman-new/backend/app/routers/jobs.py) presunout:

- discovery search do `routers/marketplace.py`
- challenge CRUD / publishing do `routers/challenges.py`
- handshake create / submit / status do `routers/handshakes.py`
- dialogue a follow-up komunikaci do `routers/dialogues.py`
- map graph / annotations do `routers/map.py`

## Nova domenska jmena

- `jobs` v API muze interni dobu jeste prezivat
- ale na urovni nove UI vrstvy ma existovat adapter `Challenge`

To umozni migraci bez okamziteho prepisu cele databaze.

---

## 11. Handshake-first interaction model

Tohle je nejdulezitejsi produktovy motiv.

## Doporuzeny flow

### Step 1. Orientation
- uzivatel pochopi misi, kontext a reality signal

### Step 2. Handshake
- zodpovi 2 kratke prompty:
  - "Jak bys zacal?"
  - "Co bys potreboval overit?"

### Step 3. Optional support
- teprve potom prida:
  - profil
  - CV
  - portfolio
  - reference

### Step 4. Dialogue
- firma odpovida jako na zacatek pracovniho dialogu

## Varianty podle source type

### Imported
- handshake je draft / preparation mode
- odeslani smeruje ven

### Native
- handshake je primarni real interaction

### Micro
- handshake je superkratky a rychly

---

## 12. Migrační strategie bez velkeho rozbiti

Prestavbu delat po vrstvach, ne big bangem.

## Faze 0. Stabilization

- prestane pribyvat legacy kod
- oznacit stare komponenty jako deprecated
- zavest `Challenge` view model adapter
- zavest jednotne naming conventions

## Faze 1. Shell

- vytahnout `AppShell`, `AppRouter`, `MarketplacePage`
- nechat stary obsah uvnitr, ale prenest routing a state orchestration

## Faze 2. Discovery

- postavit novy marketplace shell
- feed a mapa pod jednou striskou
- znovu pouzit stavajici mapu a data model

## Faze 3. Detail

- vytahnout novy `ChallengeDetailPage`
- z `ChallengeFocusView` udelat 4-5 mensich modulu
- zavest novy `DigitalHandshakePanel`

## Faze 4. Composer

- spojit native a mini challenge publishing do jedne builder architektury
- odlisit sablonami, ne zcela jinymi flow

## Faze 5. Backend cleanup

- postupne rozbit `jobs.py`
- presunout endpointy bez zmen contractu
- az pak pripadne menit API shape

## Faze 6. Legacy removal

- odstranit stare marketplace varianty
- odstranit nevyuzivane props chains
- odstranit docasne adaptery

---

## 13. Co zachovat

Tyhle veci nejsou problem, ale aktivum:

- career map a graph thinking
- JHI a reality vrstva
- handshake idea
- company dashboard publishing
- public activity / trust signaly
- AI context a candidate intent vrstva

Prestavba nema tyto schopnosti zrusit. Ma je zpřehlednit a dat jim lepsi stage.

---

## 14. Co odstranit nebo omezit

- props drilling pres cele sceny
- feature branching uvnitr jednoho mega komponentu
- paralelni legacy a new UI bez jasneho ownershipu
- job-board jazyk v CTA a page copy
- genericke card-heavy dashboard patterns

---

## 15. Prvni konkretni implementacni baliky

## Balik A - Architecture foundation

- vytvorit `src/app`, `src/pages`, `src/features`, `src/entities`, `src/shared`
- vytvorit `Challenge` adapter nad stavajicim `Job`
- vytvorit `MarketplacePage` a presunout do ni discovery shell

## Balik B - New marketplace shell

- hero s futuristickou atmosferou
- toolbar
- lane tabs
- feed/map workspace
- sticky right preview dock

## Balik C - New challenge detail

- `ChallengeArrivalScene`
- `ChallengeRealityPanel`
- `DigitalHandshakePanel`
- `CompanyTrustPanel`
- `ChallengeDeepContext`

## Balik D - Backend routing cleanup

- vyclenit `marketplace.py`, `challenges.py`, `handshakes.py`
- ponechat stejny data contract pres adapter vrstvu

---

## 16. Doporucene success metrics

Prestavba nema byt jen vizualni.

Merit:

- open detail rate
- handshake start rate
- handshake completion rate
- dialogue start rate
- quality action rate
- conversion native vs imported vs micro
- map-to-detail open rate
- return visits to marketplace

---

## 17. Doporučeni pro dalsi krok

Nejlepsi dalsi krok neni hned "prepsat vsechno". Nejlepsi dalsi krok je:

1. vyrobit novy modul `MarketplacePage`
2. pod nim postavit novy shell pro feed + mapu
3. paralelne navrhnout novy `ChallengeDetailPage`
4. az potom vyrezavat kod ze starych mega souboru

Prvni implementacni sprint bych soustredil na:

- rozpad `App.tsx`
- novy page shell
- novy challenge detail arrival + handshake

Tohle da produktu novou tvar bez toho, aby se rozbil backend nebo mapa.
