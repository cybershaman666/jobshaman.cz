# Transport Mode Selection - Dokumentace

## Přehled

Nový systém výběru způsobu dopravy do práce v JobShaman umožňuje uživatelům:
- Vybrat preferovaný způsob dopravy (auto, MHD, kolo, pěšky)
- Porovnat náklady a časy cestování pro jednotlivé módus
- Automaticky kalkulovat měsíční a roční náklady na dopravu
- Vybrat město a zemi pro přesnější ceny veřejné dopravy
- Vizualizovat doporučení nejlevnějšího řešení

## Datový model

### TransportMode
```typescript
type TransportMode = 'car' | 'public' | 'bike' | 'walk';
```

## Náklady na dopravu

### Obecné náklady (Česká republika - CZK/km)
- **Auto**: 5 Kč/km (palivo + údržba + opotřebení)
- **Veřejná doprava**: 2,5 Kč/km (průměr v ČR)
- **Kolo**: 0,05 Kč/km (údržba + opotřebení)
- **Pěšky**: 0 Kč/km

### Časy cestování (minuty/km)
- **Auto**: 1,5 min/km (40 km/h průměr v městě)
- **Veřejná doprava**: 2,5 min/km (čekání + cesta)
- **Kolo**: 2,0 min/km (30 km/h průměr)
- **Pěšky**: 1,5 min/km (40 km/h průměr chůze)

### Zájezdné karty - měsíční ceny

#### Česká republika
| Město | Cena | Odkaz |
|-------|------|-------|
| Praha | 1 350 Kč | PID - Pražská integrovaná doprava |
| Brno | 900 Kč | DPP Brno |
| Plzeň | 700 Kč | PMDP |
| Ostrava | 800 Kč | MHD Ostrava |
| Liberec | 650 Kč | DPML |
| Olomouc | 600 Kč | MHD Olomouc |
| Hradec Králové | 600 Kč | MHD Hradec Králové |

#### Slovensko
| Město | Cena (EUR) |
|-------|-----------|
| Bratislava | 65 EUR |
| Košice | 45 EUR |
| Žilina | 35 EUR |
| Banská Bystrica | 35 EUR |

#### Polsko
| Město | Cena (PLN) |
|-------|-----------|
| Warszawa | 150 PLN |
| Kraków | 120 PLN |
| Wrocław | 110 PLN |
| Poznań | 110 PLN |
| Gdańsk | 110 PLN |

#### Rakousko
| Město | Cena (EUR) |
|-------|-----------|
| Wien | 50 EUR |
| Graz | 40 EUR |
| Salzburg | 40 EUR |
| Linz | 45 EUR |

#### Německo
| Město | Cena (EUR) |
|-------|-----------|
| Berlin | 115 EUR |
| München | 130 EUR |
| Hamburg | 120 EUR |
| Köln | 110 EUR |
| Frankfurt | 115 EUR |
| Stuttgart | 125 EUR |
| Düsseldorf | 115 EUR |
| Leipzig | 105 EUR |

## Komponenty

### TransportModeSelector

Hlavní komponenta pro výběr způsobu dopravy.

#### Props
```typescript
interface TransportModeSelectorProps {
  distanceKm: number;                    // Vzdálenost jednosměrně
  selectedMode: TransportMode;           // Aktuálně vybraný režim
  onModeChange: (mode: TransportMode) => void;
  city?: string;                         // Volitelné město pro lookup zájezdné karty
  country?: string;                      // Volitelný kód země (CZ, SK, PL, AT, DE)
  showComparison?: boolean;              // Zobrazit podrobné srovnání (default: true)
  className?: string;                    // CSS třídy
}
```

#### Příklad použití
```tsx
<TransportModeSelector
  distanceKm={5}
  selectedMode={profile.transportMode || 'public'}
  onModeChange={(mode) => onChange({ ...profile, transportMode: mode })}
  city="Praha"
  country="CZ"
  showComparison={true}
/>
```

## Service: transportService.ts

Funkce pro kalkulaci nákladů a časů na dopravu.

### Hlavní funkce

#### calculateTransportCost()
```typescript
function calculateTransportCost(
  distanceKm: number,
  mode: TransportMode,
  city?: string,
  country?: string
): TransportCostCalculation
```

Vrací:
- `mode`: Vybraný způsob dopravy
- `distanceKm`: Vzdálenost (jednosměrně)
- `dailyCost`: Denní náklady (Kč)
- `monthlyCost`: Měsíční náklady (Kč)
- `yearlyAnnualCost`: Roční náklady (Kč)
- `dailyTime`: Čas cestování denně (minuty)
- `monthlyTime`: Čas cestování měsíčně (hodiny)
- `costPerMinute`: Náklady za minutu cestování (Kč)
- `cityPass`: Informace o zájezdné kartě (pokud dostupná)

#### compareAllTransportModes()
```typescript
function compareAllTransportModes(
  distanceKm: number,
  city?: string,
  country?: string
): TransportCostCalculation[]
```

Vrací pole všech režimů seřazené od nejlevnějšího.

#### getBestTransportMode()
```typescript
function getBestTransportMode(
  distanceKm: number,
  city?: string,
  country?: string
): TransportMode
```

Vrací nejlevnější režim dopravy.

#### findCityPass()
```typescript
function findCityPass(city: string, country: string): CityPassInfo | undefined
```

Hledá informace o zájezdné kartě pro vybrané město.

#### getCitiesForCountry()
```typescript
function getCitiesForCountry(country: string): CityPassInfo[]
```

Vrací seznam všech měst s dostupnými kartami pro danou zemi.

## Integrace do ProfileEditor

V ProfileEditor se komponenta nachází v novém oddílu "Dopravu do práce":

```tsx
<TransportModeSelector
  distanceKm={profile.coordinates && profile.address ? 5 : 0}
  selectedMode={profile.transportMode || 'public'}
  onModeChange={(mode: TransportMode) => onChange({ ...profile, transportMode: mode })}
  city={formData.personal.address?.split(',').pop()?.trim()}
  country="CZ"
  showComparison={true}
/>
```

## Jak se používá

1. Uživatel otevře svůj profil
2. Přejde na sekci "Dopravu do práce"
3. Vybere svůj preferovaný způsob dopravy
4. Může rozbalit "Nastavit město a zemi" pro přesnější ceny
5. Vybere své město (pro veřejnou dopravu se automaticky načte cena zájezdné karty)
6. Vidí detailní srovnání všech módů s měsíčními a ročními náklady

## Budoucí vylepšení

1. **Integration s API**: Automatické parsování vzdálenosti z GPS souřadnic
2. **Real-time kalkulace**: Integracija s Google Maps API pro přesnější časy
3. **Preference uživatele**: Uložení preference do profilu
4. **Doporučení pozic**: Filtrování pracovních pozic podle dopravní dostupnosti
5. **Příspěvek zaměstnavatele**: Kalkulace nálehu na zaměstnavatele
6. **Environmentální dopad**: Srovnání CO2 emisí jednotlivých módů

## Poznámky

- Všechny ceny jsou v CZK (Česká koruna) nebo EUR pro zahraniční města
- Výpočty předpokládají 22 pracovních dní v měsíci
- Ceny veřejné dopravy jsou aktualizovány ručně (doporučuje se měsíční update)
- Koeficienty nákladů pro jednotlivé země zohledňují rozdíly v cenách pohonných hmot a údržby
