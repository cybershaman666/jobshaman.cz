# Analýza Využití AI (Gemini) v JobShaman

## Shrnutí

Aplikace využívá **Google Gemini AI** velmi intenzivně, ale efektivním způsobem. Veškerá AI logika je implementována na **straně klienta (Frontend)** v souboru `services/geminiService.ts`. Backend slouží pouze jako proxy pro API klíče (v konfiguraci), ale sám neprovádí generování.

**Použitý Model:** `gemini-3-flash-preview` (v kódu)
> *Poznámka: V kódu je použit 'gemini-3', což je pravděpodobně experimentální/preview verze nebo placeholder pro `gemini-1.5-flash` / `gemini-2.0-flash`. Pro kalkulaci nákladů počítám s ceníkem pro **Gemini 1.5 Flash**, který je velmi levný a rychlý.*

## Seznam AI Funkcí

Aplikace obsahuje **11 klíčových AI funkcí**:

### Pro Uchazeče (B2C)

1.  **Analýza Inzerátu** (`analyzeJobDescription`)
    -   **Co dělá:** Generuje cynické shrnutí, hledá "red flags" (rizika) a hodnotí firemní kulturu.
    -   **Kdy:** Při zobrazení detailu inzerátu.
    -   **Odhad:** 1 volání / zobrazení.

2.  **Odhad Mzdy** (`estimateSalary`)
    -   **Co dělá:** Odhaduje platové rozmezí, pokud chybí v inzerátu.
    -   **Kdy:** U inzerátů bez uvedené mzdy.
    -   **Odhad:** ~30-50% inzerátů.

3.  **Generování Motivačního Dopisu** (`generateCoverLetter`)
    -   **Co dělá:** Píše krátké, profesionální dopisy na míru inzerátu.
    -   **Kdy:** Na vyžádání uživatele (tlačítko).

4.  **Analýza CV** (`analyzeUserCV`)
    -   **Co dělá:** Určuje senioritu, odhad tržní ceny, kariérní cestu a chybějící skills.
    -   **Kdy:** Při nahrání CV nebo v profilu.

5.  **Shaman Advice / Match** (`getShamanAdvice`)
    -   **Co dělá:** Porovnává profil uživatele s konkrétním inzerátem (Match Score 0-100).
    -   **Kdy:** Při zobrazení detailu inzerátu (pokud je uživatel přihlášen).

6.  **ATS Optimalizace** (`optimizeCvForAts`)
    -   **Co dělá:** Přepisuje CV do formátu čitelného pro roboty (keywords, structure).
    -   **Kdy:** Na vyžádání v nástrojích.

7.  **Parsování Profilu z CV** (`parseProfileFromCV`)
    -   **Co dělá:** Extrahuje jméno, skills, historii a vzdělání z textu/PDF CV.
    -   **Kdy:** Při registraci/onboardingu.

8.  **Generování Formátovaného CV** (`generateStyledCV`)
    -   **Co dělá:** Vytváří Markdown CV podle šablony (Modern, Executive, atd.).
    -   **Kdy:** Při exportu CV.

### Pro Firmy (B2B)

9.  **Optimalizace Inzerátu** (`optimizeJobDescription`)
    -   **Co dělá:** Přepisuje inzerát, odstraňuje klišé a buzzwords.
    -   **Kdy:** Při vytváření inzerátu.

10. **Matching Kandidátů** (`matchCandidateToJob`)
    -   **Co dělá:** Hodnotí shodu kandidáta na pozici.
    -   **Kdy:** V dashboardu firmy pro příchozí přihlášky.

11. **Generování Assessmentů** (`generateAssessment`)
    -   **Co dělá:** Vytváří technické testy a otázky na míru roli.
    -   **Kdy:** V modulu Assessments.

---

## Odhad Měsíčních Nákladů

Ceny vychází z ceníku **Gemini 1.5 Flash** (který je velmi, velmi levný).

*   **Vstup (Input):** $0.075 / 1 milion tokenů
*   **Výstup (Output):** $0.30 / 1 milion tokenů
*(Existuje i Free Tier s limity: 15 RPM, 1M TPM, 1,500 req/day)*

### Scénář: 1 000 Aktivních Uživatelů / Měsíc

Předpoklad:
- Každý uživatel si prohlédne 20 inzerátů (Analýza + Match).
- 5x použije generování dopisu.
- 1x nahraje/analyzuje CV.

| Funkce | Počet Volání | Tokeny (Input/Output) | Cena (Input) | Cena (Output) | Celkem |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Analýza Inzerátu** | 20,000 | 2k / 0.5k | $3.00 | $3.00 | **$6.00** |
| **Shaman Match** | 20,000 | 3k / 0.5k | $4.50 | $3.00 | **$7.50** |
| **Generování Dopisů** | 5,000 | 1.5k / 0.5k | $0.56 | $0.75 | **$1.31** |
| **Analýza/Parse CV** | 1,000 | 5k / 2k | $0.38 | $0.60 | **$0.98** |
| **Ostatní (B2B/Mzdy)** | 2,000 | 2k / 1k | $0.30 | $0.60 | **$0.90** |
| **CELKEM** | **~48,000** | **~67M / ~17M** | **~$8.74** | **~$7.95** | **~$16.69** |

### Závěr k nákladům

Při použití modelu **Flash** jsou náklady **extrémně nízké**. I při 1000 aktivních uživatelích se pravděpodobně vejdeme do **$20 měsíčně**.

Pokud by se přešlo na model **Pro** (Gemini 1.5 Pro), náklady by vzrostly cca **20-40x** (na ~$400–800 měsíčně). Pro tento typ úloh (krátké textové analýzy) je ale Flash naprosto dostatečný.

### Doporučení

1.  **Monitorovat Usage:** Sledovat v Google AI Studio konzoli spotřebu tokenů.
2.  **Caching:** Výsledky analýzy inzerátů (které se nemění) by bylo vhodné ukládat do databáze (Supabase), aby se nevolala AI při každém zobrazení stránky znovu. Tím by se náklady srazily na zlomek.
