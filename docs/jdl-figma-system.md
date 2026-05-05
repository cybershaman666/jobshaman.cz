<<<<<<< HEAD
# JobShaman JDL Figma System

Praktický základ pro Figma soubor i produktovou implementaci. Tohle není moodboard. Je to pracovní kostra pro `00_Foundations`, `01_Components`, `02_Screens`, `03_Playground`.

## 1. Figma File Structure

### `00_Foundations`
- Color styles
- Text styles
- Effect styles
- Spacing, radius, blur tokeny

### `01_Components`
- `btn/primary/soft`
- `card/default`
- `card/interactive`
- `input/underline`
- `pill/filter`
- `hero/entry`

### `02_Screens`
- `onboarding/entry`
- další kandidátské, company a marketing plochy

### `03_Playground`
- experimenty
- motion testy
- nové layout patterny před přesunem do knihovny

## 2. Foundation Styles

### Colors

Používej tyto Figma styly jako dark-first prezentační základ:

- `bg/deep` → `#0E1111`
- `bg/elevated` → `#151919`
- `fog/light` → `rgba(255,255,255,0.06)`
- `fog/strong` → `rgba(255,255,255,0.12)`
- `accent/green-soft` → `#7FAF8E`
- `accent/green-glow` → `#A6D1B0`
- `accent/warm` → `#E6D3A3`
- `text/primary` → `#E8ECEC`
- `text/secondary` → `#A8B0B0`

### Typography

- `display` → Inter Medium, `32-40px`, tight tracking
- `heading` → Inter Medium, `20-24px`
- `body` → Inter Regular, `14-16px`
- `micro` → Inter Medium, `12px`

Poznámka pro produkt:
- v kódu zůstává `Inter` jako primární sans
- `Fraunces` je sekundární akcent pro hero a manifestové headline
- `JetBrains Mono` je jen pro technická data

### Effects

- `glass/soft` → fill `fog/light` + background blur `20`
- `glass/strong` → fill `fog/strong` + background blur `32-40`
- `glow/green` → drop shadow v `accent/green-glow`, blur `20-60`, opacity `20-40%`
- `glow/warm` → drop shadow v `accent/warm`, blur `20-60`, opacity `18-30%`

### Tokens

- spacing: `4 / 8 / 16 / 24 / 32`
- radius: `8 / 16 / 24`
- blur: `16 / 24 / 40`
- motion: `200ms / 280ms / 420ms`

## 3. Component Rules

### `btn/primary/soft`

- žádný tvrdý box
- jemný fog fill
- hover = lehké rozsvícení, ne agresivní posun
- active = o něco silnější glow

### `card/default`

- radius `16-24`
- fill `fog/light`
- background blur
- 1px outline v bílé kolem `5%`

### `card/interactive`

- stejné základy jako `card/default`
- hover = vyšší glow a lehký lift
- focus = jasný, ale měkký ring

### `input/underline`

- underline nebo velmi subtilní spodní hrana
- placeholder v `text/secondary`
- focus stav řešit světlem, ne tvrdým rámečkem

## 4. Motion Rules

- používej hlavně fade, opacity a blur shift
- jemný scale `0.98 -> 1` je v pořádku
- žádné tvrdé slide animace pro běžné karty a CTA
- default easing: `ease-out` nebo produktové `cubic-bezier(0.22, 1, 0.36, 1)`

## 5. First Screen Spec

### Screen

`onboarding/entry`

### Layout

- centered composition
- nahoře jemný halo nebo gradient
- jeden hlavní headline
- pod ním `3` volitelné směrové karty
- bez klasického `Continue` tlačítka

### Headline

- CZ: `Kam tě to teď táhne?`
- EN reference: `Where is your energy pulling you right now?`

### Entry Cards

- `Chci změnu`
- `Hledám směr`
- `Jen se rozhlížím`

Každá karta má:
- krátký titulek
- podpůrnou 1-2 větnou větu
- jemný micro-hint dole
- hover glow, ne tvrdý border flash

## 6. Product Mapping

Tyto Figma styly se v kódu mapují na JDL tokeny a utility:

- tmavý atmosférický entry panel → `app-entry-ritual-panel`
- interaktivní onboarding karta → `app-entry-intent-card`
- soft glass surface → `SurfaceCard` s `variant="frost"` nebo `variant="hero"`
- headline hero text → `PageHero` nebo `app-display`
- filtry a volby → `FilterChip`, `Pill`

Aktuální referenční implementace:
- onboarding entry v [CandidateOnboardingModal.tsx](/home/misha/Projekty/jobshaman-new/components/CandidateOnboardingModal.tsx)
- foundation CSS v [index.css](/home/misha/Projekty/jobshaman-new/index.css)
- onboarding copy contract v [taskFirstOnboardingCopy.ts](/home/misha/Projekty/jobshaman-new/components/candidate-onboarding/taskFirstOnboardingCopy.ts)

## 7. Guardrails

- atmosféra nesmí rozbít čitelnost
- glow je akcent, ne permanentní efekt
- mystic vrstva má být jemná a funkční
- když si musíš vybrat mezi wow a orientací, vyhrává orientace
=======
# JobShaman JDL Figma System

Praktický základ pro Figma soubor i produktovou implementaci. Tohle není moodboard. Je to pracovní kostra pro `00_Foundations`, `01_Components`, `02_Screens`, `03_Playground`.

## 1. Figma File Structure

### `00_Foundations`
- Color styles
- Text styles
- Effect styles
- Spacing, radius, blur tokeny

### `01_Components`
- `btn/primary/soft`
- `card/default`
- `card/interactive`
- `input/underline`
- `pill/filter`
- `hero/entry`

### `02_Screens`
- `onboarding/entry`
- další kandidátské, company a marketing plochy

### `03_Playground`
- experimenty
- motion testy
- nové layout patterny před přesunem do knihovny

## 2. Foundation Styles

### Colors

Používej tyto Figma styly jako dark-first prezentační základ:

- `bg/deep` → `#0E1111`
- `bg/elevated` → `#151919`
- `fog/light` → `rgba(255,255,255,0.06)`
- `fog/strong` → `rgba(255,255,255,0.12)`
- `accent/green-soft` → `#7FAF8E`
- `accent/green-glow` → `#A6D1B0`
- `accent/warm` → `#E6D3A3`
- `text/primary` → `#E8ECEC`
- `text/secondary` → `#A8B0B0`

### Typography

- `display` → Inter Medium, `32-40px`, tight tracking
- `heading` → Inter Medium, `20-24px`
- `body` → Inter Regular, `14-16px`
- `micro` → Inter Medium, `12px`

Poznámka pro produkt:
- v kódu zůstává `Inter` jako primární sans
- `Fraunces` je sekundární akcent pro hero a manifestové headline
- `JetBrains Mono` je jen pro technická data

### Effects

- `glass/soft` → fill `fog/light` + background blur `20`
- `glass/strong` → fill `fog/strong` + background blur `32-40`
- `glow/green` → drop shadow v `accent/green-glow`, blur `20-60`, opacity `20-40%`
- `glow/warm` → drop shadow v `accent/warm`, blur `20-60`, opacity `18-30%`

### Tokens

- spacing: `4 / 8 / 16 / 24 / 32`
- radius: `8 / 16 / 24`
- blur: `16 / 24 / 40`
- motion: `200ms / 280ms / 420ms`

## 3. Component Rules

### `btn/primary/soft`

- žádný tvrdý box
- jemný fog fill
- hover = lehké rozsvícení, ne agresivní posun
- active = o něco silnější glow

### `card/default`

- radius `16-24`
- fill `fog/light`
- background blur
- 1px outline v bílé kolem `5%`

### `card/interactive`

- stejné základy jako `card/default`
- hover = vyšší glow a lehký lift
- focus = jasný, ale měkký ring

### `input/underline`

- underline nebo velmi subtilní spodní hrana
- placeholder v `text/secondary`
- focus stav řešit světlem, ne tvrdým rámečkem

## 4. Motion Rules

- používej hlavně fade, opacity a blur shift
- jemný scale `0.98 -> 1` je v pořádku
- žádné tvrdé slide animace pro běžné karty a CTA
- default easing: `ease-out` nebo produktové `cubic-bezier(0.22, 1, 0.36, 1)`

## 5. First Screen Spec

### Screen

`onboarding/entry`

### Layout

- centered composition
- nahoře jemný halo nebo gradient
- jeden hlavní headline
- pod ním `3` volitelné směrové karty
- bez klasického `Continue` tlačítka

### Headline

- CZ: `Kam tě to teď táhne?`
- EN reference: `Where is your energy pulling you right now?`

### Entry Cards

- `Chci změnu`
- `Hledám směr`
- `Jen se rozhlížím`

Každá karta má:
- krátký titulek
- podpůrnou 1-2 větnou větu
- jemný micro-hint dole
- hover glow, ne tvrdý border flash

## 6. Product Mapping

Tyto Figma styly se v kódu mapují na JDL tokeny a utility:

- tmavý atmosférický entry panel → `app-entry-ritual-panel`
- interaktivní onboarding karta → `app-entry-intent-card`
- soft glass surface → `SurfaceCard` s `variant="frost"` nebo `variant="hero"`
- headline hero text → `PageHero` nebo `app-display`
- filtry a volby → `FilterChip`, `Pill`

Aktuální referenční implementace:
- onboarding entry v [CandidateOnboardingModal.tsx](/home/misha/Projekty/jobshaman-new/components/CandidateOnboardingModal.tsx)
- foundation CSS v [index.css](/home/misha/Projekty/jobshaman-new/index.css)
- onboarding copy contract v [taskFirstOnboardingCopy.ts](/home/misha/Projekty/jobshaman-new/components/candidate-onboarding/taskFirstOnboardingCopy.ts)

## 7. Guardrails

- atmosféra nesmí rozbít čitelnost
- glow je akcent, ne permanentní efekt
- mystic vrstva má být jemná a funkční
- když si musíš vybrat mezi wow a orientací, vyhrává orientace
>>>>>>> 4c20d82 (Jobshaman MVP 2.0: Clean repo, i18n Nordic expansion & engine optimization)
