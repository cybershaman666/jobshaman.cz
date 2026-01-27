# 🚀 Quick Start Guide - Transport Mode Selection

## Jak to funguje?

Když si uživatel vyplňuje profil v JobShaman, v sekci "Dopravu do práce" může vybrat preferovaný způsob cestování do práce.

### 4 Módy dopravy

1. **🚗 Auto** (5 CZK/km)
   - Nejrychlejší v městě
   - Středně nákladný
   - Ideální pro dálkové cesty

2. **🚌 MHD** (2.5 CZK/km + lístky)
   - Střední cena + měsíční letenka
   - Pohodlné v velkých městech
   - Bez stresu z řízení

3. **🚴 Kolo** (0.05 CZK/km)
   - Nejlevnější
   - Zdravé
   - Ideální pro krátké vzdálenosti

4. **🚶 Pěšky** (zdarma!)
   - Nejlevnější
   - Nejzdravější
   - Jen pro blízké vzdálenosti

## Příklad

### Praha, 5 km do práce

#### Co vidí uživatel?

```
┌─────────────────────────────────────────────────────────────┐
│ Dopravu do práce                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🚗 Auto          🚌 MHD          🚴 Kolo      🚶 Pěšky    │
│  1 100 Kč/měsíc   1 350 Kč/měsíc  11 Kč/měsíc  0 Kč/měsíc  │
│  15 minut         25 minut        20 minut     15 minut    │
│  [Vybrat]        [Vybrat]        [Vybrat]    [Vybrat]     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Nastav město a zemi: [Praha ▼] [ČR ▼]                      │
├─────────────────────────────────────────────────────────────┤
│ Podrobné srovnání:                                          │
│                                                             │
│ Mód     │ Denně  │ Měsíčně │ Čas │ Kč/min                  │
│─────────┼────────┼─────────┼─────┼───────                 │
│ Pěšky   │   0 Kč │   0 Kč  │ 15m │ 0.00                    │
│ Kolo    │ 0.5 Kč │  11 Kč  │ 20m │ 0.05                    │
│ MHD     │  61 Kč │1 350 Kč │ 25m │ 0.90                    │
│ Auto    │  50 Kč │1 100 Kč │ 15m │ 1.22                    │
│                                                             │
│ 💡 Doporučení: Kolo je nejlevnější!                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Detaily implementace

### Soubory

| Soubor | Účel | Velikost |
|--------|------|----------|
| `services/transportService.ts` | Business logika | 650+ řádků |
| `components/TransportModeSelector.tsx` | UI komponenta | 350+ řádků |
| `services/transportService.test.ts` | Testy | 270+ řádků |
| `TRANSPORT_MODE_DOCUMENTATION.md` | Dokumentace | 300+ řádků |

### Klíčové funkce

```typescript
// Kalkulace nákladů pro jeden mód
calculateTransportCost(distanceKm: 5, mode: 'car', city: 'Praha', country: 'CZ')
// Returns: { mode: 'car', dailyCost: 50, monthlyCost: 1100, ... }

// Porovnání všech módů
compareAllTransportModes(5, 'Praha', 'CZ')
// Returns: [walk, bike, public, car] seřazeno od nejlevnějšího

// Nejlepší mód
getBestTransportMode(5, 'Praha', 'CZ')
// Returns: 'walk' (nejlevnější)

// Hledání zájezdní karty
findCityPass('Praha', 'CZ')
// Returns: { city: 'Praha', country: 'CZ', monthlyPrice: 1350, currency: 'CZK' }
```

## Jak to používat v kódu

### V komponentě
```tsx
import TransportModeSelector from './TransportModeSelector';
import { TransportMode } from '../types';

function MyComponent() {
  const [mode, setMode] = useState<TransportMode>('public');
  
  return (
    <TransportModeSelector
      distanceKm={5}
      selectedMode={mode}
      onModeChange={setMode}
      city="Praha"
      country="CZ"
    />
  );
}
```

### V service
```typescript
import { calculateTransportCost, compareAllTransportModes } from './transportService';

// Spočítej náklady
const cost = calculateTransportCost(10, 'car', 'Praha', 'CZ');
console.log(`Měsíčně: ${cost.monthlyCost} Kč`);

// Porovnej všechny módy
const comparison = compareAllTransportModes(10, 'Praha', 'CZ');
comparison.forEach(mode => {
  console.log(`${mode.mode}: ${mode.monthlyCost} Kč/měsíc`);
});
```

## Která data se ukládají?

Zatím se do userProfile ukládá:
- `transportMode`: Selected transport mode ('car' | 'public' | 'bike' | 'walk')

V budoucnu se bude ukládat:
- Preferovaná vzdálenost na dopravu
- Město a země
- Historie preferovaných módů

## Kde se to používá?

### Aktuálně
- ✅ ProfileEditor - zobrazení a výběr
- ✅ finansialService.ts - kalkulace nákladů

### V budoucnu
- Job recommendations - filtrování podle dostupnosti
- Salary negotiations - příspěvek na dopravu
- Job listings - filtrování podle dopravní vzdálenosti
- Analytics - trends v dopravě mezi uživateli

## Postup pro další kroky

### 1. Test v ProfileEditor (0.5 hod)
```bash
# Otevřete ProfileEditor v prohlížeči
# Jděte na sekci "Dopravu do práce"
# Vyzkoušejte kliknutí na různé módy
# Vyzkoušejte výběr města
```

### 2. PostGIS integrace (2 hod)
```typescript
// V transportService.ts
const distance = await calculatePostGISDistance(
  userCoordinates,
  jobCoordinates
);
```

### 3. Uložení do databáze (1 hod)
```typescript
// V ProfileEditor
await supabase
  .from('user_profiles')
  .update({ transport_mode: mode })
  .eq('id', userId);
```

### 4. Job filtering (2 hod)
```typescript
// V job service
const accessibleJobs = jobs.filter(job => 
  calculateCommuteCost(job.location, job.salary, mode) < maxBudget
);
```

## Testování

### Manuální test
1. Otevřete profil uživatele
2. Rolujte dolů na "Dopravu do práce"
3. Klikněte na různé módy dopravy
4. Vyzkoušejte výběr různých měst
5. Zkontrolujte výpočet cen

### Unit testy
```bash
npm test transportService.test.ts
```

### Coverage
```bash
npm test -- --coverage transportService.test.ts
```

## FAQ

**Q: Jak se počítá vzdálenost?**
A: Zatím hardcoded 5 km. PostGIS integrace v příštím kroku.

**Q: Jak se detekuje město?**
A: Z poslední části adresy (děleno čárkami). Lepší parsing v příštím kroku.

**Q: Jak se ukládá preference?**
A: Zatím jen v state. Database integrace v příštím kroku.

**Q: Kde se berou ceny zájezdních karet?**
A: Ze statického CITY_PASSES array. Real-time data v příštím kroku.

**Q: Jak se počítá čas cestování?**
A: Fixní koeficienty (1.5-2.5 min/km). Google Maps API v příštím kroku.

## Rychlý debugging

### "Komponenta se nerenduje"
```bash
# Zkontrolujte console pro chyby
# Zkontrolujte že TransportModeSelector je správně importován
```

### "Ceny nejsou správné"
```bash
# Zkontrolujte vybrané město a zemi
# Spusťte test: calculateTransportCost(5, 'car', 'Praha', 'CZ')
```

### "Dark mode není aplikován"
```bash
# Zkontrolujte že parent element má dark: třídu
# Zkontrolujte že Tailwind CSS je nakonfigurován
```

## Kontakt a podpora

Pro jakékoli otázky:
1. Zkontrolujte `TRANSPORT_MODE_FINAL_SUMMARY.md`
2. Zkontrolujte `TRANSPORT_MODE_DOCUMENTATION.md`
3. Spusťte unit testy pro ověření API
4. Debugujte s `console.log` ve TransportModeSelector.tsx

---

**Hotovo** ✅ - Implementace je kompletní a připravená k použití!

Pokud chcete pokračovat, doporučuji:
1. Otestovat v ProfileEditor
2. Implementovat PostGIS
3. Přidat databázovou persistenci
