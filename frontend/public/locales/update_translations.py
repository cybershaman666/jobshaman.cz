import json
import os

locales_dir = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/frontend/public/locales"

def update_lang(lang, updates):
    path = os.path.join(locales_dir, lang, "translation.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    def deep_merge(d, u):
        for k, v in u.items():
            if isinstance(v, dict):
                d[k] = deep_merge(d.get(k, {}), v)
            else:
                d[k] = v
        return d
    
    data = deep_merge(data, updates)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

# Finnish Updates
fi_updates = {
  "financial": {
    "reality_title": "Taloudellinen todellisuus",
    "based_on_location": "Sijainnin {{location}} perusteella",
    "jhi_impact_label": "JHI-vaikutus",
    "points": "pistettä",
    "unlock_title": "Avaa taloudellinen todellisuus",
    "unlock_desc": "Kirjaudu sisään ja selvitä, kuinka paljon sinulle todella jää käteen verojen ja työmatkojen jälkeen.",
    "unlock_commute_address": "Avaaksesi työmatkatodellisuuden, täytä osoitteesi profiiliisi.",
    "login_button": "Kirjaudu sisään",
    "missing_address": "Aloituspiste puuttuu",
    "set_address_desc": "Aseta osoitteesi profiiliisi, jotta voimme laskea työmatka-ajan ja -kustannukset.",
    "set_address_button": "Aseta osoite profiiliin",
    "gross_wage": "Bruttopalkka",
    "net_income": "Todellinen nettotulo",
    "tax_insurance": "Verot ja vakuutukset",
    "commute_costs": "Työmatkakustannukset",
    "home_office_savings": "Etätyösäästöt",
    "net_base": "Nettopohja",
    "reality_summary": "Taloudellinen todellisuus",
    "benefit_value_label": "Edun arvo",
    "benefit_info_desc": "Arvio perustuu keskimääräisiin markkina-arvoihin. Todellinen arvo voi vaihdella.",
    "per_month": "kuukausi",
    "gross_monthly": "Bruttokuukausipalkka",
    "reality_vs_income": "Nettotulo vs. todellisuus",
    "market": {
      "insufficient": "Meillä ei ole vielä tarpeeksi tietoa luotettavaa vertailua varten.",
      "title": "Palkka vs. markkinat",
      "above": "Yli markkinahinnan",
      "below": "Alle markkinahinnan",
      "at": "Markkinatasolla",
      "p50": "Tyypillinen palkka (mediaani)",
      "iqr": "Vaihteluväli (p25–p75)",
      "sample_size": "Tarjousten määrä",
      "window": "Jakso",
      "confidence": "Luotettavuus",
      "source_label": "Lähde",
      "period_label": "Jakso",
      "measure_label": "Mittari",
      "measure_median": "mediaani",
      "measure_average": "keskiarvo",
      "gross_net_label": "Tyyppi",
      "gross": "brutto",
      "net": "netto",
      "scope_label": "Laajuus",
      "source_url_label": "URL",
      "source_hint": "lähde"
    },
    "ai_estimation_hint": "AI-arvio (palkkaa ei ilmoitettu)",
    "methodology": {
      "title": "Miten JHI ja kuljetus lasketaan",
      "jhi_title": "JHI-vaikutuskaava",
      "jhi_formula": "Tulojen prosentuaalinen muutos työmatkasta × 1.5 = JHI-pisteet",
      "jhi_example": "Esimerkki: Jos työmatka vähentää tuloja 1%, JHI laskee n. 1.5 pistettä",
      "transport_title": "Kuljetuslaskenta",
      "transport_car": "🚗 Auto: 0,20 €/km × 2 × 22 päivää",
      "transport_public": "🚋 Julkinen liikenne: kuukausilippu - halvin",
      "transport_bike": "🚴 Pyörä: 0,05 €/km × 2 × 22 päivää",
      "transport_walk": "🚶 Kävely: 0 € (ilmainen)",
      "final_title": "Nettotodellisuuskaava",
      "final_formula": "Nettopohja + Edut - Työmatka = Todellinen tulo",
      "jhi_desc": "Numeerinen indeksi, joka mittaa työtarjouksen \"terveyttä\". Se lasketaan useista tekijöistä:",
      "pillar_financial_title": "Taloudellinen vaikutus:",
      "pillar_financial_desc": "Miten palkka + edut - työmatka vaikuttavat kokonaistuloihisi",
      "pillar_time_title": "Aika:",
      "pillar_time_desc": "Miten työmatka ja työtyyppi vaikuttavat vapaa-aikaasi",
      "pillar_mental_title": "Henkinen kuormitus:",
      "pillar_mental_desc": "Sanat kuten \"nopeatempoinen\", \"stressi\" tai \"korkea paine\" laskevat pisteitä",
      "pillar_growth_title": "Kasvu ja kehitys:",
      "pillar_growth_desc": "Koulutus ja kurssit nostavat pisteitä",
      "jhi_formula_title": "Työmatkavaikutuksen kaava:",
      "jhi_example_long": "Esimerkki: Jos työmatka vähentää nettotuloja 1%, JHI laskee n. 1.5 pistettä. Rajoitettu välille -20 ... +15 pistettä.",
      "transport_desc": "Järjestelmä käyttää suosimaasi kuljetusmuotoa ja soveltaa halvinta vaihtoehtoa:",
      "transport_car_title": "Autolla",
      "transport_public_title": "Julkinen liikenne",
      "transport_public_example_title": "Kaupunkilippu (suositeltu):",
      "transport_public_example": "Helsinki HSL..."
    },
    "current_location_label": "nykyinen sijaintisi",
    "reality_desc": "Nettotulojen ja työmatkakustannusten laskenta.",
    "home_office": "Etätyö",
    "saved_commute_time_money": "Säästetty työmatka-aika ja raha.",
    "eco_friendly_choice": "Ympäristöystävällisempi valinta.",
    "calculation_hint": "Nettotulo- ja työmatkakustannusarvio."
  },
  "filters": {
    "location_commute": "Sijainti ja työmatka",
    "cross_border": "Rajat ylittävä haku 🦋",
    "search_all_desc": "Haku EU-rajojen yli",
    "search_current_desc": "Haku vain nykyisessä maassa",
    "abroad_only": "Vain ulkomailla",
    "abroad_only_desc": "Kotimaasi ulkopuolella",
    "use_current_location": "Käytä nykyistä sijaintiani",
    "city_placeholder": "Kaupunki (esim. Helsinki)",
    "limit_by_commute": "Rajoita työmatkan mukaan",
    "max_distance": "Max etäisyys",
    "radius_hint_no_location": "Käyttääksesi sädettä, syötä kaupunki tai käytä nykyistä sijaintiasi.",
    "search_nearby": "📬 Lähellä olevat tarjoukset",
    "search_everywhere": "🦋 Etsi kaikkialta",
    "contract_type": "Sopimustyyppi",
    "job_type": "Työtyyppi",
    "job_types": {
      "on_site": "Paikan päällä",
      "hybrid": "Hybridi",
      "remote": "Etätyö"
    },
    "benefits": "Edut",
    "key_benefits": {
      "title": "Avainedut",
      "items": {
        "car": "Työsuhdeauto henkilökohtaiseen käyttöön",
        "kids_friendly": "Lapsiystävällinen",
        "flex_hours": "Joustavat työajat",
        "education": "Koulutuskurssit",
        "multisport": "Liikuntasetelit",
        "meal": "Lounasetu",
        "home_office": "Etätyömahdollisuus",
        "vacation_5w": "5 viikkoa lomaa",
        "dog_friendly": "Koiraystävällinen",
        "stock": "Henkilöstöosakkeet"
      }
    },
    "date_posted": "Julkaisuaika",
    "any_time": "Milloin vain",
    "last_24h": "Viimeiset 24 tuntia",
    "last_3d": "Viimeiset 3 päivää",
    "last_7d": "Viimeiset 7 päivää",
    "last_14d": "Viimeiset 14 päivää",
    "min_salary": "Min kuukausipalkka",
    "experience_level": "Kokemustaso",
    "junior": "Junior",
    "medior": "Medior",
    "senior": "Senior",
    "lead": "Lead / Manager",
    "language": "Ilmoituksen kieli",
    "language_all": "Kaikki kielet",
    "sort_by": "Järjestä",
    "sort_options": {
      "recommended": "Prioriteettinäkymä",
      "newest": "Uusimmat",
      "distance": "Etäisyys",
      "jhi_desc": "Korkein JHI",
      "salary_desc": "Korkein palkka"
    },
    "sort_explain": {
      "recommended": "Tämä tila käyttää prioriteettinäkymää nykyisten suodattimien ja roolikontekstin perusteella."
    },
    "language_options": {
      "cs": "Tšekki",
      "sk": "Slovakki",
      "en": "Englanti",
      "de": "Saksa",
      "pl": "Puola",
      "uk": "Ukraina"
    },
    "min_salary_placeholder": "0",
    "currency_czk": "CZK",
    "salary_scale_min": "0 {{currency}}",
    "salary_scale_max": "150k {{currency}}"
  }
}

update_lang("fi", fi_updates)

# Repeat for other languages with their specific translations...
# (Simplified for now, will apply in steps)
