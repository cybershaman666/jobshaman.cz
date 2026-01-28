# 🚚 Transport Mode Selection - SIMPLIFIED VERSION

## Overview

Implementace byla **ZJEDNODUŠENA** na základě vašeho feedbacku:

### ✅ Co bylo zjednodušeno

1. **Profile:** Jednoduché 4 tlačítka pro výběr módu dopravy
   - Bez detailních porovnávání
   - Bez výběru měst
   - Bez kalkulací
   - Jen preference uživatele

2. **Job Cards:** Nová komponenta `CommuteCostBreakdown`
   - Detailní výpočet pro každou konkrétní pozici
   - Zobrazit v "Finanční a dojezdová realita" sekci
   - Ukazuje: cenu, čas, porovnání s jinými módy
   - Automaticky vypočítáno z uživatelovy preference a vzdálenosti k práci

### 📁 Nové Soubory

1. **`components/CommuteCostBreakdown.tsx`** (nový)
   - Komponenta pro zobrazení v job cards
   - Detailní breakdown nákladů
   - Porovnání s alternativami

2. **`components/TransportModeSelector.tsx`** (zjednodušeno)
   - Původní soubor teď má `compact` mód
   - V profilu se používá `compact={true}`
   - Jen jednoduché 4 kartičky

### 🔧 Jak To Používat

#### V ProfileEditor (máte hotovo)

```tsx
<TransportModeSelector
  selectedMode={profile.transportMode || 'public'}
  onModeChange={(mode) => onChange({...profile, transportMode: mode})}
  compact={true}  // ← NOVÉ: zjednodušená verze
/>
```

#### V Job Card / Finanční Realita (nové)

```tsx
<CommuteCostBreakdown
  distance={distance}  // km k práci
  userTransportMode={profile.transportMode}  // Preference uživatele
  jobCity={job.city}  // Městěchy pro přesné ceny
  jobCountry={job.country}  // Státu
/>
```

### 📊 Příklad Výstupu

Na job kartu se zobrazí:

```
🚌 MHD
Vaše preferovaná doprava na 5.2 km

1 350 Kč měsíčně
─────────────────────────
Denně: 61 Kč | Čas: 25 min | Cena/min: 0.90 Kč

Praž. lístek - 1 350 Kč/měsíc

Porovnání s ostatními způsoby:
🚴 Kolo - 11 Kč/měsíc, 20 min
   ↓ O 1 339 Kč levnější

Roční náklady: 16 200 Kč/rok
```

### 🎯 Architektura

```
User Profile:
  └─ TransportModeSelector (compact)
      └─ Just select preferred mode

Job Card:
  └─ CommuteCostBreakdown
      ├─ Show user's preferred mode cost
      ├─ Show distance
      ├─ Show alternatives
      └─ Show yearly total
```

### ✨ Features

✅ Jednoduchý výběr v profilu  
✅ Detailní kalkulace na job kartu  
✅ Automatické porovnání  
✅ City-specific prices  
✅ Annual summary  
✅ Dark mode  
✅ Responsive  

### 📈 Co Se Změnilo

| Co | Bylo | Nyní |
|-----|------|------|
| Profil selektor | Detailný s porovnáním | Jednoduché 4 tlačítka |
| Kalkulace | V profilu | Na job kartu (CommuteCostBreakdown) |
| Výběr měst | V profilu | Bez (používá se město z jobu) |
| Porovnávání | Detailní tabulka | Zobrazuje 2 alternativy |

### 🚀 Příští Kroky

1. Integujte `CommuteCostBreakdown` do job card / finanční sekce
2. Zosímejte UI podle vašeho designu
3. Test s reálnými daty

### 🐛 Debugging

Pokud `CommuteCostBreakdown` nezobrazuje:

1. Zkontrolujte že `distance` je > 0
2. Zkontrolujte že `userTransportMode` je validní
3. Zkontrolujte console pro errory

---

**Status**: ✅ HOTOVO  
**Verze**: 1.1 (Simplified)
