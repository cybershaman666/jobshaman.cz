# Transport Mode Selection - Implementace

## 📋 Souhrn implementace

Byl implementován kompletní systém pro výběr a kalkulaci nákladů na dopravu do práce s podporou:
- 4 módů dopravy: auto, MHD, kolo, pěšky
- Přesných kalkulací nákladů pro ČR, SK, PL, AT, DE
- Cen zájezdních karet pro 25+ velkých měst v Evropě
- Interaktivního UI v ProfileEditor komponentě

## 📁 Nové soubory

### 1. `services/transportService.ts`
Hlavní service pro kalkulace nákladů a časy na dopravu.

**Klíčové funkce:**
- `calculateTransportCost()` - Kalkuluje náklady pro jeden mód
- `compareAllTransportModes()` - Porovnává všechny módy
- `getBestTransportMode()` - Vrací nejlevnější mód
- `findCityPass()` - Hledá cenu zájezdní karty
- `getCitiesForCountry()` - Vrací seznam měst pro zemi

**Konstanta `CITY_PASSES`:**
- 25+ velkých měst v 5 zemích (CZ, SK, PL, AT, DE)
- Aktuální měsíční ceny zájezdních karet
- Měsíční a denní ceny kde dostupné

### 2. `components/TransportModeSelector.tsx`
React komponenta pro výběr a vizualizaci dopravy.

**Features:**
- Kartičky pro 4 módy dopravy s ikonami a barvami
- Interaktivní výběr s instant kalkulací
- Podrobné srovnání všech módů
- Volba města a země pro přesnější ceny
- Doporučení nejlevnějšího řešení
- Responsivní design (mobile-first)

**Props:**
```typescript
interface TransportModeSelectorProps {
  distanceKm: number;
  selectedMode: TransportMode;
  onModeChange: (mode: TransportMode) => void;
  city?: string;
  country?: string;
  showComparison?: boolean;
  className?: string;
}
```

### 3. `services/transportService.test.ts`
Kompletní test suite pro transportService.

**Pokryté testy:**
- Kalkulace nákladů pro jednotlivé módy
- Porovnání všech módů
- Hledání nejlepšího módu
- Hledání cen zájezdních karet
- Real-world scénáře (praha 5km, dlouhé cesty 30km)

### 4. `TRANSPORT_MODE_DOCUMENTATION.md`
Detailní dokumentace systému.

## 🔄 Upravené soubory

### 1. `components/ProfileEditor.tsx`
- Import `TransportMode` z types
- Import `TransportModeSelector` komponenty
- Nový oddíl "Dopravu do práce" v ProfileEditor
- Integracija s formData a onChange

### 2. `services/financialService.ts`
- Aktualizace `COMMUTE_COSTS` konstant:
  - Auto: 5 CZK/km (místo 4.5)
  - MHD: 2.5 CZK/km (místo 8 - nový výpočet)
  - Kolo: 0.05 CZK/km (místo 1.5)
  - Pěšky: 0 CZK/km (beze změny)

## 📊 Ceny a kalkulace

### Náklady na kilometer (Česká republika)
```
Auto:      5.00 Kč/km  (palivo 8 Kč/L, spotřeba 7 L/100km + údržba)
MHD:       2.50 Kč/km  (průměr z cen zájezdních karet)
Kolo:      0.05 Kč/km  (údržba a opotřebení)
Pěšky:     0.00 Kč/km  (žádné náklady)
```

### Časy cestování (minuty/km)
```
Auto:      1.5 min/km  (40 km/h průměr v městě)
MHD:       2.5 min/km  (čekání + cesta)
Kolo:      2.0 min/km  (30 km/h průměr)
Pěšky:     1.5 min/km  (40 km/h chůze)
```

### Příklad: Cesta 5 km do práce v Praze

#### Denní náklady:
- **Auto**: 50 Kč (5km × 2 × 5 Kč/km)
- **MHD**: 25 Kč (5km × 2 × 2.5 Kč/km)
- **Kolo**: 0.50 Kč (5km × 2 × 0.05 Kč/km)
- **Pěšky**: 0 Kč

#### Měsíční náklady (22 pracovních dní):
- **Auto**: 1 100 Kč
- **MHD**: 1 350 Kč (Praha zájezdná karta)
- **Kolo**: 11 Kč
- **Pěšky**: 0 Kč

#### Časy cestování (jednosměrně):
- **Auto**: 15 minut (10km × 1.5 min/km)
- **MHD**: 25 minut (10km × 2.5 min/km)
- **Kolo**: 20 minut (10km × 2 min/km)
- **Pěšky**: 15 minut (10km × 1.5 min/km)

## 🗺️ Podpořená města

### Česká republika (7 měst)
- Praha (1 350 Kč/měsíc)
- Brno (900 Kč/měsíc)
- Plzeň (700 Kč/měsíc)
- Ostrava (800 Kč/měsíc)
- Liberec (650 Kč/měsíc)
- Olomouc (600 Kč/měsíc)
- Hradec Králové (600 Kč/měsíc)

### Slovensko (4 města)
- Bratislava (65 EUR/měsíc)
- Košice (45 EUR/měsíc)
- Žilina (35 EUR/měsíc)
- Banská Bystrica (35 EUR/měsíc)

### Polsko (5 měst)
- Warszawa (150 PLN/měsíc)
- Kraków (120 PLN/měsíc)
- Wrocław (110 PLN/měsíc)
- Poznań (110 PLN/měsíc)
- Gdańsk (110 PLN/měsíc)

### Rakousko (4 města)
- Wien (50 EUR/měsíc)
- Graz (40 EUR/měsíc)
- Salzburg (40 EUR/měsíc)
- Linz (45 EUR/měsíc)

### Německo (8 měst)
- Berlin (115 EUR/měsíc)
- München (130 EUR/měsíc)
- Hamburg (120 EUR/měsíc)
- Köln (110 EUR/měsíc)
- Frankfurt (115 EUR/měsíc)
- Stuttgart (125 EUR/měsíc)
- Düsseldorf (115 EUR/měsíc)
- Leipzig (105 EUR/měsíc)

## 🔧 Instalace a použití

### 1. Importy
```typescript
import TransportModeSelector from './components/TransportModeSelector';
import { TransportMode } from './types';
```

### 2. V ProfileEditor
```tsx
<TransportModeSelector
  distanceKm={5}
  selectedMode={profile.transportMode || 'public'}
  onModeChange={(mode: TransportMode) => 
    onChange({ ...profile, transportMode: mode })
  }
  city="Praha"
  country="CZ"
  showComparison={true}
/>
```

### 3. V komponentě (bez ProfileEditor)
```tsx
const [transportMode, setTransportMode] = useState<TransportMode>('public');

<TransportModeSelector
  distanceKm={distance}
  selectedMode={transportMode}
  onModeChange={setTransportMode}
/>
```

## 🎯 Integrační body

### V App.tsx
```typescript
// Existující:
transportMode: 'public',

// Nyní podporuje:
transportMode: 'car' | 'public' | 'bike' | 'walk'
```

### V commuteService.ts
Existující funkce zůstávají kompatibilní, ale nyní mohou využívat přesnější kalkulace z transportService.ts.

### V financialService.ts
Aktualizované `calculateCommuteCost()` nyní používá nové náklady z transportService.ts.

## 📱 UI/UX

### Responsive design
- ✅ Mobile (1 sloupec)
- ✅ Tablet (2 sloupce)
- ✅ Desktop (4 kartičky vedle sebe)

### Dark mode
- ✅ Plná podpora dark mode
- ✅ Přizpůsobené barvy pro každý mód

### Komponenty
- **Transport cards**: Interaktivní kartičky s ikonami
- **City selector**: Dropdown pro výběr města
- **Comparison table**: Podrobné srovnání všech módů
- **Recommendation**: Doporučení nejlevnějšího řešení

## 🚀 Budoucí vylepšení

1. **PostGIS integrace**: Automatické vypočítání vzdálenosti z adres
2. **Google Maps API**: Real-time časy cestování
3. **Příspěvek od zaměstnavatele**: Kalkulace nálehu
4. **Environmental score**: CO2 emisje jednotlivých módů
5. **Real-time ceny**: API integrace s veřejnou dopravou
6. **Uložení preference**: Databáze uživatelských preferencí
7. **Doporučení pozic**: Filtrování pozic podle dopravní dostupnosti

## ✅ QA Checklist

- [x] Typy TypeScript
- [x] Responsive design
- [x] Dark mode podpora
- [x] Testovány všechny funkce
- [x] Dokumentace
- [x] Chybové stavy
- [x] Loading states
- [x] Přístupnost (a11y)

## 📞 Kontakt a podpora

Pro jakékoli otázky nebo problěmy:
1. Zkontrolujte `TRANSPORT_MODE_DOCUMENTATION.md`
2. Proveďte test suite: `npm test transportService.test.ts`
3. Zkontrolujte komponenty v Storybook (pokud dostupné)
