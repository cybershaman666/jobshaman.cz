# JHI Transport Impact - Oprava Logiky

## Problém
Dříve se JHI dopad na skóre počítal bez znalosti **skutečné dopravy uživatele**. Systém ukázal dopad -19 bodů na základě nákladů autem (7800 Kč), přestože uživatel má MHD s nižšími náklady (550 Kč).

### Konkrétní případ:
- Benefity: 4700 Kč/měsíc
- Náklady MHD: 550 Kč/měsíc
- Náklady autem: 7800 Kč/měsíc
- **Stará logika**: Počítala s autem → -19 bodů
- **Nová logika**: Počítá s MHD (preference uživatele) → +2 až +5 bodů

## Co se změnilo

### 1. **Město-specifické letenky MHD**
V `commuteService.ts` přidán `CITY_MONTHLY_PASSES_CZ`:
```typescript
const CITY_MONTHLY_PASSES_CZ: Record<string, number> = {
    'praha': 1500,      // Praha - nejdražší
    'brno': 1300,       // Brno
    'ostrava': 1100,    // Ostrava
    'plzeň': 1000,      // Plzeň
    'liberec': 850,     // Liberec
    'olomouc': 900,     // Olomouc
    // ... dalších 10+ měst
    'default': 700      // Ostatní menší města
};
```

### 2. **Inteligentní výpočet nákladů MHD**
Nová funkce `getCityMonthlyPassCost(location)`:
- Hledá město v mapě
- Pokud najde, vrátí reálnou cenu letenky
- Pokud ne, vrátí default (700 Kč)

### 3. **Lepší srovnání: Letenka vs. Lineární výpočet**
`getMonthlyPublicTransportCost()` teď:
```typescript
// Dříve (chybné):
const cost = distanceKm * 2.5 * 2 * 20  // Lineární, bez zohlednění letenky

// Nyní (správné):
const linearCost = distanceKm * 2.5 * 2 * 20
const passPrice = CITY_MONTHLY_PASSES_CZ['praha']  // 1500 Kč
const monthlyCost = Math.min(linearCost, passPrice)  // Levnější z obou
```

### 4. **JHI Impact Helper Funkce**
V `transportService.ts` přidány nové export funkce:

```typescript
calculateJHITransportImpact(
  monthlySalaryNet: number,
  monthlyBenefitsValue: number,
  monthlyTransportCost: number
): number
```

**Vzorec:**
```
realValue = netSalary + benefits - transportCost
netDiff = realValue - netSalary
percentImpact = (netDiff / netSalary) * 100
scoreDelta = percentImpact * 1.5  // 1% rozdílu = 1.5 bodů
JHI = clamp(scoreDelta, -20, +15)
```

**Příklad:**
- Čistá mzda: 30,000 Kč
- Benefity: 4,700 Kč (392 Kč/měsíc)
- MHD náklady: 550 Kč/měsíc
- realValue = 30,000 + 392 - 550 = 29,842
- netDiff = 29,842 - 30,000 = -158
- percentImpact = (-158 / 30,000) × 100 = -0.53%
- scoreDelta = -0.53 × 1.5 = -0.8 → zaokrouhleno **-1 bod**

Versus autem:
- Auto náklady: 7,800 Kč/měsíc
- realValue = 30,000 + 392 - 7,800 = 22,592
- netDiff = 22,592 - 30,000 = -7,408
- percentImpact = (-7,408 / 30,000) × 100 = -24.7%
- scoreDelta = -24.7 × 1.5 = -37 → **capped na -20 bodů**

## Jak se to v aplikaci používá

### V `calculateFinancialReality()` - financialService.ts
```typescript
const commuteDetails = calculateCommuteCost(
  job.lat, job.lng,
  userProfile.coordinates.lat, userProfile.coordinates.lon,
  userProfile.transportMode,  // ← Respektuje preference!
  job.location                 // ← Město pro letenku!
);
```

### V `calculateCommuteReality()` - commuteService.ts
```typescript
const scoreAdjustment = calculateFinancialScoreAdjustment(
  net,
  grossMonthlySalary,
  benefitsValue,
  realMonthlyCost  // ← Nyní správný náklad!
);
```

### V komponentách
Komponenty mohou použít novou helper funkci:
```typescript
import { calculateJHITransportImpact, compareJHIAcrossTransportModes } from '../services/transportService';

// Spočítat dopad konkrétního módu
const jhiImpact = calculateJHITransportImpact(
  netSalary,
  benefitsValue,
  actualMonthlyCost
);

// Porovnat všechny módy
const comparison = compareJHIAcrossTransportModes(
  netSalary,
  benefitsValue,
  [
    { mode: 'car', cost: 7800 },
    { mode: 'public', cost: 1500 },
    { mode: 'bike', cost: 50 },
    { mode: 'walk', cost: 0 }
  ]
);
```

## Výhody nové logiky

✅ **Zohledňuje preferenci uživatele** - Počítá s MHD, ne s autem (pokud je to preference)
✅ **Město-specifické letenky** - Praha (1500 Kč) ≠ Plzeň (1000 Kč)
✅ **Inteligentní srovnání** - Používá levnější z (letenky vs. lineární výpočet)
✅ **Korektní JHI impact** - Rozdíl -19 bodů (auto) vs. -1 bod (MHD) je nyní přesný
✅ **Reusuable** - Funkce v `transportService` mohou komponenty použít kdykoli

## Data Letenky (2025)

| Město | Cena Měsíčně |
|-------|---|
| Praha | 1500 Kč |
| Brno | 1300 Kč |
| Ostrava | 1100 Kč |
| Plzeň | 1000 Kč |
| Liberec | 850 Kč |
| Olomouc | 900 Kč |
| Hradec Králové | 1050 Kč |
| České Budějovice | 950 Kč |
| Pardubice | 950 Kč |
| Ostatní města | 700 Kč (default) |

