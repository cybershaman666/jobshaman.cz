# JHI Dimensions - Komplexní Systém Hodnocení Práce

## Overview

Nový JHI systém má 5 nezávislých dimenzí, které spolu tvoří komplexní obrázek kvality práce:

```
JHI = (Finance + Čas + Psychika + Růst + Hodnoty) / 5
```

Každá dimenze je **0-100 bodů**, s **baseline 50** (průměr).

---

## 1. 💰 FINANCE (Financial Stability)
**Baseline = 50 bodů, rozsah 0-100**

### Vzorec:
```
Finance = 50 + ΔMzda + ΔBenefity - ΔNáklady_dopravy
```

### Komponenty:
- **ΔMzda** (±20 bodů): Porovnání s průměrem 35,000 Kč
  - 55,000 Kč → +11 bodů
  - 28,000 Kč → -4 body
  
- **ΔBenefity** (+0-15 bodů): % ročního příjmu (capped 15%)
  - 4,700 Kč z 55,000 → +1 bod
  - 0 Kč → 0 bodů
  
- **ΔNáklady_dopravy** (-0-10 bodů): % ročního příjmu
  - 1,500 Kč/měs (18,000 Kč/rok) z 660,000 → -0.3 bodu
  - 1,300 Kč/měs (15,600 Kč/rok) z 336,000 → -0.5 bodu

### Příklady:
```
Případ 1: 55k + 4.7k benefity + 18km (Praha)
Finance = 50 + 11 + 1 - 0.3 = 61 bodů ✓

Případ 2: 28k + 0 benefitů + 39km (Brno)
Finance = 50 - 4 + 0 - 0.5 = 45.5 ≈ 46 bodů ✓
```

---

## 2. ⏰ ČAS (Work-Life Balance & Schedule)
**Baseline = 50 bodů, rozsah 0-100**

### Komponenty:
- **Remote work** (+20 bodů): Práce z domu = massive time savings
- **Commute time** (±15 bodů):
  - < 30 min/den: +8 bodů
  - 30-60 min/den: +4 body
  - 60-120 min/den: -10 bodů
  - \> 120 min/den: -15 bodů
  
- **Work hours** (±12 bodů):
  - 8h standardně: 0 bodů (baseline)
  - 10h: -8 bodů
  - 12h: -12 bodů
  
- **Schedule flexibility** (+10 bodů):
  - Flexibilní úprava / gliding time
  
- **Vacation** (+8 bodů):
  - 25+ dní dovolené

### Příklady:
```
Remote 8h standard:
Čas = 50 + 20 + 0 + 0 + 0 = 70 bodů ✓ (super)

Dojezdová 18km, 8h standard:
Čas = 50 - 3 (27 min) + 0 + 0 = 47 bodů (ok)

Dojezdová 39km, 10h:
Čas = 50 - 6 (59 min) - 8 (10h) + 0 = 36 bodů (špatně)
```

---

## 3. 🧠 PSYCHIKA (Mental Health & Stress)
**Baseline = 50 bodů, rozsah 0-100**

### Komponenty:
- **Commute stress** (-15 bodů):
  - \> 50 km: -15 bodů
  - > 30 km: -10 bodů
  - > 15 km: -5 bodů
  
- **Shift work** (-15 bodů):
  - 3-směnný provoz: -15 bodů (velmi stresující)
  - Noční/víkendové práce: -10 bodů
  
- **Overtime risk** (-8 bodů):
  - "Přesčasy", "podle potřeb" = unpredictable stres
  
- **Work intensity** (-5 bodů):
  - "Dynamické", "ambiciózní" role = vyšší stres
  
- **Positive factors** (+5-12 bodů):
  - Home office: +12 bodů
  - Flexibilní: +8 bodů
  - Přátelský tým: +5 bodů

### Příklady:
```
Remote friendly tým:
Psychika = 50 + 12 (home office) + 5 (tým) = 67 bodů ✓

Dojezdová 39km, 3-směnný:
Psychika = 50 - 6 (čas) - 15 (3-směny) = 29 bodů ✗ (velmi stres)

Normální 18km, standardní hodiny:
Psychika = 50 - 3 (čas) + 0 = 47 bodů (ok)
```

---

## 4. 📈 RŮST (Career Development)
**Baseline = 50 bodů, rozsah 0-100**

### Komponenty:
- **Position level** (±15 bodů):
  - Junior / Asistent: +15 bodů (vysoký potenciál růstu)
  - Senior / Specialista: +5 bodů
  - Manager: -5 bodů (méně místa pro růst)
  - CEO/Generální ředitel: -15 bodů (maximum dosaženo)
  
- **Learning opportunities** (+12 bodů):
  - Školení, kurzy, vzdělávání
  
- **Mentoring** (+8 bodů):
  - Coaching / mentoring program
  
- **Skill progression** (+8 bodů):
  - Nové technologie, moderní stack
  
- **Role predictability** (-12 bodů):
  - Rutinní / jednoduchá práce
  - Uklizečka, údržba (omezený potenciál)
  
- **Salary as proxy** (+5 bodů):
  - > 100,000 Kč = often more advanced role

### Příklady:
```
Junior role + školení:
Růst = 50 + 15 (junior) + 12 (školení) = 77 bodů ✓ (super)

Senior role bez učení:
Růst = 50 + 5 (senior) + 0 = 55 bodů (ok)

CEO role:
Růst = 50 - 15 (max dosaženo) = 35 bodů (limitovaný potenciál)

Uklizečka:
Růst = 50 - 12 (rutinní) = 38 bodů (velmi omezeno)
```

---

## 5. ♥️ HODNOTY (Personal Values & Work-Life Integration)
**Baseline = 50 bodů, rozsah 0-100**

### Komponenty:
- **Family-friendly** (±12 bodů):
  - Zaměření na rodinu: +12 bodů
  - Home office dostupnost: +10 bodů
  - Flexibilita: +8 bodů
  
- **Personal benefits** (+5 bodů each):
  - Pojištění / zdraví
  - Penzijní benefits
  - Sport/wellness příspěvek
  
- **Purpose-driven work** (+10 bodů):
  - Sociální práce, zdravotnictví, vzdělání, životní prostředí
  - "Smysluplná práce" = lépe s hodnotami
  
- **Negative factors** (-10 bodů):
  - Víkendová / nonstop práce
  - Nepřátelský startup (dlouhé hodiny)
  
- **Company stability** (+5 bodů):
  - Zavedená firma = stabilita, lepší work-life

### Příklady:
```
Sociální práce, flexibilní, home office:
Hodnoty = 50 + 12 (rodina) + 10 (sociální) + 5 (stabilita) = 77 bodů ✓

Startup s nonstop tlakem:
Hodnoty = 50 - 5 (startup) - 10 (nonstop) = 35 bodů ✗

Zdravotnictví, pojištění, flexibilní:
Hodnoty = 50 + 10 (zdravo) + 5 (pojištění) + 5 (stabilita) = 70 bodů ✓
```

---

## Komplexní Příklad: 3 Scénáře

### Scénář A: 55k Jižní Morava, MHD, benefity
```
Finance:   50 + 11 (plat) + 1 (benefity) - 0.3 (doprava) = 61 bodů
Čas:       50 - 3 (27 min) + 0 + 5 (stabilita) = 52 bodů
Psychika:  50 - 3 (čas) + 5 (tým) = 52 bodů
Růst:      50 + 0 (mid-level) + 8 (školení) = 58 bodů
Hodnoty:   50 + 5 (pojištění) + 5 (stabilita) = 60 bodů

CELKEM JHI: (61 + 52 + 52 + 58 + 60) / 5 = 56.6 ≈ 57 bodů
STATUS: ✓ Nad průměrem - slušná pozice
```

### Scénář B: 28k Brno, MHD, bez benefitů
```
Finance:   50 - 4 (plat) + 0 (bez benefitů) - 0.5 (doprava) = 45.5 bodů
Čas:       50 - 6 (59 min) + 0 = 44 bodů
Psychika:  50 - 6 (čas) - 5 (intenzita) = 39 bodů
Růst:      50 - 12 (rutinní) = 38 bodů
Hodnoty:   50 - 5 (startup) = 45 bodů

CELKEM JHI: (45.5 + 44 + 39 + 38 + 45) / 5 = 42.3 ≈ 42 bodů
STATUS: ✗ Pod průměrem - slabá nabídka
```

### Scénář C: 80k Remote, senior role, zdravotnictví
```
Finance:   50 + 15 (plat) + 5 (benefity) - 1 (doprava) = 69 bodů
Čas:       50 + 20 (remote) + 0 + 10 (flexibilní) = 80 bodů
Psychika:  50 + 12 (home office) + 5 (tým) = 67 bodů
Růst:      50 + 5 (senior) + 12 (školení) = 67 bodů
Hodnoty:   50 + 10 (zdravo) + 5 (pojištění) + 5 (stabilita) = 70 bodů

CELKEM JHI: (69 + 80 + 67 + 67 + 70) / 5 = 70.6 ≈ 71 bodů
STATUS: ✓✓ Značně nad průměrem - skvělá nabídka
```

---

## Implementace

### V App.tsx
```tsx
{commuteAnalysis?.jhi && (
  <JHIChart
    jhi={commuteAnalysis.jhi}
    theme="dark"
    highlightGrowth={false}
  />
)}
```

### V commuteService.ts
```typescript
export const calculateMentalHealthScore = (job, distanceKm, timeMinutes) => { ... }
export const calculateGrowthScore = (job, salary) => { ... }
export const calculateTimeScore = (job, distanceKm, timeMinutes, isRemote) => { ... }
export const calculateValuesScore = (job, benefits) => { ... }
```

---

## Výhody Nového Systému

✅ **Komplexní**: Zahrnuje všechny aspekty práce (ne jen peníze)
✅ **Transparentní**: Jasně ukazuje co jednotlivé dimenze znamenají
✅ **Realistické**: Zohledňuje realitu (benefity, dojezdový čas, shift work, etc.)
✅ **Balanc**: Žádná dimenze není diktující (všechny stejně důležité)
✅ **Adaptivní**: Snadno se přidají další faktory (např. vzdělání uchazece apod.)

---

## Poznámky

- **Baseline 50** = průměrná práce
- **60+** = dobrá pozice (preferuj ji)
- **40-59** = průměrná (zvážit podle priorit)
- **< 40** = slabá pozice (vyhni se)
- Jednotlivé dimenze jsou **nezávislé** - můžeš preferovat jednu přes druhou
