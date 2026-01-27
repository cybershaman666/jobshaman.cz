# JHI Recalibration - Nový Systém Výpočtu

## Původní Problém
- Dopad dopravy byl příliš velký (penalizoval příliš agresivně)
- Benefity se nepočítaly do JHI
- Čas na cestu se nepočítal
- Vzorec 1% = 1.5 bodu byl příliš agresivní

## Nový Vzorec JHI

**Baseline = 50 bodů (průměrná pozice)**

### JHI = 50 + ΔMzda + ΔBenefity + ΔČas - ΔNáklady

#### 1. Salary Adjustment (ΔMzda)
- Porovnání s průměrným platem (35,000 Kč)
- **Vzorec:** (plat - 35000) / 35000 × 20
- **Rozsah:** -20 až +20 bodů
- Příklad: 55,000 Kč → (55000-35000)/35000 × 20 = **11 bodů**
- Příklad: 28,000 Kč → (28000-35000)/35000 × 20 = **-4 body**

#### 2. Benefits Adjustment (ΔBenefity)
- Procento ročního příjmu v benefitech (capped na 15%)
- **Vzorec:** min(benefity/plat, 0.15) × 15
- **Rozsah:** 0 až +15 bodů
- Příklad: 4,700 Kč benefitů z 55,000 Kč = 8.5% → min(0.085, 0.15) × 15 = **1.3 bodu (~1)**
- Příklad: 0 Kč benefitů = **0 bodů**

#### 3. Commute Time Adjustment (ΔČas)
- Týdenní dojezdový čas v minutách
- Referenční bod: 500 minut/týden (~100 min/den = 1.5 hodin bez přestupu)
- **Vzorec:** -((minuty_za_týden / 500) × 10)
- **Rozsah:** -10 až 0 bodů
- Příklad: 18 km → ~27 min/den → 135 min/týden → -(135/500 × 10) = **-3 body**
- Příklad: 39 km → ~59 min/den → 295 min/týden → -(295/500 × 10) = **-6 bodů**

#### 4. Transport Cost Adjustment (ΔNáklady)
- Roční náklady jako procento ročního příjmu
- **Vzorec:** -(náklady_ročně / plat_ročně × 100 × 0.1)
- **Rozsah:** -10 až 0 bodů
- Příklad: 18 km MHD Praha (1500 Kč/měs) = 18,000 Kč/rok z 660,000 Kč/rok = 2.7% → -(2.7 × 0.1) = **-0.3 bodu (~0)**
- Příklad: 39 km MHD Brno (1300 Kč/měs) = 15,600 Kč/rok z 336,000 Kč/rok = 4.6% → -(4.6 × 0.1) = **-0.5 bodu**

## Testovací Případy

### Případ 1: Premium Pozice s Benefity
```
Mzda:           55,000 Kč hrubého
Benefity:       4,700 Kč (stravenky, vzdělávání, apod)
Dojezdová dist: 18 km (Jižní Morava)
Doprava:        MHD (city pass Brno 1,300 Kč/měsíc)

ΔMzda:      +11 bodů   (55000 > 35000)
ΔBenefity:  +1 bod     (4700 = 8.5% z příjmu)
ΔČas:       -3 body    (135 minut týdně)
ΔNáklady:   -0 bodů    (velmi nízké náklady relativně)

CELKEM JHI: 50 + 11 + 1 - 3 - 0 = 59 bodů ✓ NAD PRŮMĚREM
```
*Poznámka: Skvělý work-life balance, super nabídka s benefity a slušným platem*

### Případ 2: Nižší Pozice Bez Benefitů
```
Mzda:           28,000 Kč hrubého
Benefity:       0 Kč
Dojezdová dist: 39 km (Brno)
Doprava:        MHD (city pass Brno 1,300 Kč/měsíc)

ΔMzda:      -4 body     (28000 < 35000)
ΔBenefity:  +0 bodů     (bez benefitů)
ΔČas:       -6 bodů     (295 minut týdně = 59 min/den)
ΔNáklady:   -0.5 bodu   (15,600 Kč/rok z 336,000 Kč = 4.6%)

CELKEM JHI: 50 - 4 - 6 - 0.5 = 39.5 ≈ 40 bodů ✓ POD PRŮMĚREM
```
*Poznámka: Nižší plat, bez benefitů, daleko dojíždění - podprůměrná nabídka*

## Změny v Kódu

### transportService.ts
- Nová funkce `calculateCompleteJHIScore()` - comprehensive vzorec
- Starý `calculateJHITransportImpact()` - zachován pro kompatibilitu

### commuteService.ts
- Aktualizován `calculateCommuteReality()` aby volal nový JHI vzorec
- `jhiImpact` vrací delta od baseline 50 (může být negativní)

### App.tsx
- Automaticky se aplikuje nový JHI výpočet na všechny job detaily
- UI zobrazuje JHI skóre s barvami (zelená = nad průměrem, červená = pod)

## Klíčové Rozdíly od Staré Logiky

| Aspekt | Staré | Nové |
|--------|-------|------|
| Baseline | N/A | 50 (explicitní průměr) |
| Dopad mzdy | Ad-hoc kategorie | Lineární porovnání |
| Benefity | Ignorovány | Počítány (max 15% dopad) |
| Čas dojezdu | Jen penalizace | Včleněn do skóre |
| Dopravy náklady | Příliš vysoký dopad | Upravený dopad (~1/3 původního) |
| Maximum skóre | ~100 | 100 (capped) |
| Minimum skóre | 0 | 0 (capped) |

## Výsledek
Nový systém lépe odráží "skutečnou" kvalitu práce:
- ✅ Případ 1: 55k + benefity + 18km → **59 JHI** (nad průměrem, jak se očekávalo)
- ✅ Případ 2: 28k + 0 benefitů + 39km → **~40 JHI** (pod průměrem, jak se očekávalo)
