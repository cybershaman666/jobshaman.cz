import json
import os

locales_dir = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/frontend/public/locales"

def update_lang(lang, updates):
    path = os.path.join(locales_dir, lang, "translation.json")
    if not os.path.exists(path):
        data = {}
    else:
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

# --- Swedish (sv) ---
sv_updates = {
  "financial": {
    "reality_title": "Finansiell verklighet",
    "based_on_location": "Baserat på {{location}}",
    "jhi_impact_label": "JHI-påverkan",
    "points": "poäng",
    "unlock_title": "Lås upp finansiell verklighet",
    "unlock_desc": "Logga in och ta reda på hur mycket du verkligen har kvar i plånboken efter skatt och pendling.",
    "unlock_commute_address": "För att låsa upp pendlingsverklighet måste du fylla i din adress i din profil.",
    "login_button": "Logga in",
    "missing_address": "Vi saknar en startpunkt",
    "set_address_desc": "Ange din adress i din profil så att vi kan beräkna pendlings-tid och kostnader.",
    "set_address_button": "Ange adress i profil",
    "gross_wage": "Bruttolön",
    "net_income": "Verklig nettoinkomst",
    "tax_insurance": "Skatter och försäkringar",
    "commute_costs": "Pendlingskostnader",
    "home_office_savings": "Hemmakontorsbesparingar",
    "net_base": "Nettobas",
    "reality_summary": "Finansiell verklighet",
    "benefit_value_label": "Förmånsvärde",
    "benefit_info_desc": "Uppskattning baserad på genomsnittliga marknadsvärden. Verkligt värde kan variera.",
    "per_month": "månad",
    "gross_monthly": "Bruttomånadslön",
    "reality_vs_income": "Nettoinkomst vs Verklighet",
    "market": {
      "insufficient": "Vi har inte tillräckligt med data för en tillförlitlig jämförelse än.",
      "title": "Lön vs marknad",
      "above": "Över marknaden",
      "below": "Under marknaden",
      "at": "På marknadsnivå",
      "p50": "Typisk lön (median)",
      "iqr": "Intervall (p25–p75)",
      "sample_size": "Antal erbjudanden",
      "window": "Period",
      "confidence": "Tillförlitlighet",
      "source_label": "Källa",
      "period_label": "Period",
      "measure_label": "Mått",
      "measure_median": "median",
      "measure_average": "genomsnitt",
      "gross_net_label": "Typ",
      "gross": "brutto",
      "net": "netto"
    },
    "ai_estimation_hint": "AI-uppskattning (lön ej angiven)",
    "methodology": {
      "title": "Hur JHI och transport beräknas",
      "jhi_title": "JHI-påverkningsformel",
      "jhi_formula": "Procentuell förändring i inkomst från pendling × 1.5 = JHI-poäng",
      "jhi_example": "Exempel: Om pendling minskar inkomsten med 1%, sjunker JHI med ~1.5 poäng",
      "transport_title": "Transportberäkning",
      "transport_car": "🚗 Bil: 0,20 €/km × 2 × 22 dagar",
      "transport_public": "🚋 Kollektivtrafik: månadskort - billigaste",
      "transport_bike": "🚴 Cykel: 0,05 €/km × 2 × 22 dagar",
      "transport_walk": "🚶 Promenad: 0 € (gratis)",
      "final_title": "Nettorealitetsformel",
      "final_formula": "Nettobas + Förmåner - Pendling = Verklig inkomst"
    },
    "current_location_label": "din nuvarande plats",
    "reality_desc": "Beräkning av nettoinkomst och pendlingskostnader.",
    "home_office": "Hemmakontor",
    "saved_commute_time_money": "Sparad pendlingstid och pengar.",
    "eco_friendly_choice": "Ett mer miljövänligt val.",
    "calculation_hint": "Nettoinkomst och uppskattning av pendlingskostnad."
  },
  "filters": {
    "location_commute": "Plats & Pendling",
    "cross_border": "Gränsöverskridande sökning 🦋",
    "search_all_desc": "Söker över EU-gränser",
    "search_current_desc": "Söker endast lokalt land",
    "abroad_only": "Endast utomlands",
    "abroad_only_desc": "Utanför ditt hemland",
    "use_current_location": "Använd min nuvarande plats",
    "city_placeholder": "Stad (t.ex. Stockholm)",
    "limit_by_commute": "Begränsa efter pendling",
    "max_distance": "Max avstånd",
    "radius_hint_no_location": "För att använda radie, ange en stad eller använd din nuvarande plats.",
    "search_nearby": "📬 Erbjudanden i närheten",
    "search_everywhere": "🦋 Sök överallt",
    "contract_type": "Anställningsform",
    "job_type": "Jobbtyp",
    "job_types": {
      "on_site": "På plats",
      "hybrid": "Hybrid",
      "remote": "Distans"
    },
    "benefits": "Förmåner",
    "key_benefits": {
      "title": "Nyckelförmåner",
      "items": {
        "car": "Tjänstebil för privat bruk",
        "kids_friendly": "Barnvänligt",
        "flex_hours": "Flexibla tider",
        "education": "Utbildningskurser",
        "multisport": "Friskvårdsbidrag",
        "meal": "Lunchförmån",
        "home_office": "Hemmakontor",
        "vacation_5w": "5 veckors semester",
        "dog_friendly": "Hundvänligt",
        "stock": "Personalaktier"
      }
    },
    "date_posted": "Publiceringsdatum",
    "any_time": "När som helst",
    "last_24h": "Senaste 24 timmarna",
    "last_3d": "Senaste 3 dagarna",
    "last_7d": "Senaste 7 dagarna",
    "last_14d": "Senaste 14 dagarna",
    "min_salary": "Min månadslön",
    "experience_level": "Erfarenhetsnivå",
    "junior": "Junior",
    "medior": "Medior",
    "senior": "Senior",
    "lead": "Lead / Chef",
    "language": "Annonsens språk",
    "language_all": "Alla språk",
    "sort_by": "Sortera efter",
    "sort_options": {
      "recommended": "Prioriterad översikt",
      "newest": "Nyaste",
      "distance": "Avstånd",
      "jhi_desc": "Högsta JHI",
      "salary_desc": "Högsta lön"
    }
  }
}

# --- Norwegian (no) ---
no_updates = {
  "financial": {
    "reality_title": "Økonomisk virkelighet",
    "based_on_location": "Basert på {{location}}",
    "jhi_impact_label": "JHI-påvirkning",
    "points": "poeng",
    "unlock_title": "Lås opp økonomisk virkelighet",
    "unlock_desc": "Logg inn og finn ut hvor mye du virkelig har igjen i lommeboken etter skatt og pendling.",
    "unlock_commute_address": "For å låse opp pendlingsvirkelighet må du fylle ut adressen din i profilen din.",
    "login_button": "Logg inn",
    "missing_address": "Vi mangler et startpunkt",
    "set_address_desc": "Oppgi adressen din i profilen din slik at vi kan beregne pendlings-tid og kostnader.",
    "set_address_button": "Oppgi adresse i profil",
    "gross_wage": "Bruttolønn",
    "net_income": "Reell nettoinntekt",
    "tax_insurance": "Skatt og forsikring",
    "commute_costs": "Pendlingskostnader",
    "home_office_savings": "Hjemmekontorsparing",
    "net_base": "Nettobase",
    "reality_summary": "Økonomisk virkelighet",
    "benefit_value_label": "Verdi av goder",
    "benefit_info_desc": "Estimat basert på gjennomsnittlige markedsverdier. Reell verdi kan variere.",
    "per_month": "måned",
    "gross_monthly": "Brutto månedslønn",
    "reality_vs_income": "Nettoinntekt vs Virkelighet",
    "market": {
      "insufficient": "Vi har ikke nok data for en pålitelig sammenligning ennå.",
      "title": "Lønn vs marked",
      "above": "Over markedet",
      "below": "Under markedet",
      "at": "På markedsnivå",
      "p50": "Typisk lønn (median)",
      "iqr": "Område (p25–p75)",
      "sample_size": "Antall tilbud",
      "window": "Periode",
      "confidence": "Pålitelighet",
      "source_label": "Kilde"
    },
    "ai_estimation_hint": "AI-estimat (lønn ikke spesifisert)",
    "methodology": {
      "title": "Hvordan JHI og transport beregnes",
      "jhi_title": "JHI-påvirkningsformel",
      "jhi_formula": "Prosentvis endring i inntekt fra pendling × 1.5 = JHI-poeng",
      "jhi_example": "Eksempel: Hvis pendling reduserer inntekten med 1%, synker JHI med ~1.5 poeng",
      "transport_title": "Transportberegning",
      "transport_car": "🚗 Bil: 0,20 €/km × 2 × 22 dager",
      "transport_public": "🚋 Kollektivtransport: månedskort - billigste",
      "transport_bike": "🚴 Sykkel: 0,05 €/km × 2 × 22 dager",
      "transport_walk": "🚶 Gå: 0 € (gratis)",
      "final_title": "Nettovirkelighetsformel",
      "final_formula": "Nettobase + Goder - Pendling = Reell inntekt"
    },
    "current_location_label": "din nåværende posisjon",
    "reality_desc": "Beregning av nettoinntekt og pendlingskostnader.",
    "home_office": "Hjemmekontor",
    "saved_commute_time_money": "Spart pendlingstid og penger.",
    "eco_friendly_choice": "Et mer miljøvennlig valg.",
    "calculation_hint": "Nettoinntekt og estimat for pendlingskostnad."
  },
  "filters": {
    "location_commute": "Sted og pendling",
    "cross_border": "Grenseoverskridende søk 🦋",
    "search_all_desc": "Søker på tvers av EU-grenser",
    "search_current_desc": "Søker kun i lokalt land",
    "abroad_only": "Kun utlandet",
    "abroad_only_desc": "Utenfor hjemlandet ditt",
    "use_current_location": "Bruk min nåværende posisjon",
    "city_placeholder": "By (f.eks. Oslo)",
    "limit_by_commute": "Begrens etter pendling",
    "max_distance": "Maks avstand",
    "radius_hint_no_location": "For å bruke radius, oppgi en by eller bruk din nåværende posisjon.",
    "search_nearby": "📬 Tilbud i nærheten",
    "search_everywhere": "🦋 Søk overalt",
    "contract_type": "Ansettelsesform",
    "job_type": "Jobbtype",
    "job_types": {
      "on_site": "På stedet",
      "hybrid": "Hybrid",
      "remote": "Fjernarbeid"
    },
    "benefits": "Goder",
    "key_benefits": {
      "title": "Nøkkelgoder",
      "items": {
        "car": "Firmabil for privat bruk",
        "kids_friendly": "Barnevennlig",
        "flex_hours": "Fleksitid",
        "education": "Kurs og utdanning",
        "multisport": "Treningsavtale",
        "meal": "Lunsjordning",
        "home_office": "Hjemmekontor",
        "vacation_5w": "5 ukers ferie",
        "dog_friendly": "Hundevennlig",
        "stock": "Ansatteaksjer"
      }
    },
    "date_posted": "Publisert dato",
    "any_time": "Når som helst",
    "last_24h": "Siste 24 timer",
    "last_3d": "Siste 3 dager",
    "last_7d": "Siste 7 dager",
    "last_14d": "Siste 14 dager",
    "min_salary": "Min månedslønn",
    "experience_level": "Erfaringsnivå",
    "junior": "Junior",
    "medior": "Medior",
    "senior": "Senior",
    "lead": "Lead / Leder",
    "language": "Annonsespråk",
    "language_all": "Alle språk",
    "sort_by": "Sorter etter",
    "sort_options": {
      "recommended": "Prioritert oversikt",
      "newest": "Nyeste",
      "distance": "Avstand",
      "jhi_desc": "Høyeste JHI",
      "salary_desc": "Høyeste lønn"
    }
  }
}

# --- Danish (da) ---
da_updates = {
  "financial": {
    "reality_title": "Økonomisk virkelighed",
    "based_on_location": "Baseret på {{location}}",
    "jhi_impact_label": "JHI-påvirkning",
    "points": "point",
    "unlock_title": "Lås op for økonomisk virkelighed",
    "unlock_desc": "Log ind og find ud af, hvor meget du virkelig har tilbage i tegnebogen efter skat og pendling.",
    "unlock_commute_address": "For at låse op for pendlingsvirkelighed skal du udfylde din adresse i din profil.",
    "login_button": "Log ind",
    "missing_address": "Vi mangler et startpunkt",
    "set_address_desc": "Indstil din adresse i din profil, så vi kan beregne pendlings-tid og omkostninger.",
    "set_address_button": "Indstil adresse i profil",
    "gross_wage": "Bruttoløn",
    "net_income": "Reel nettoindkomst",
    "tax_insurance": "Skatter og forsikringer",
    "commute_costs": "Pendlingsomkostninger",
    "home_office_savings": "Hjemmekontorbesparelser",
    "net_base": "Nettobasis",
    "reality_summary": "Økonomisk virkelighed",
    "benefit_value_label": "Værdi af goder",
    "benefit_info_desc": "Estimat baseret på gennemsnitlige markedsværdier. Reel værdi kan variere.",
    "per_month": "måned",
    "gross_monthly": "Brutto månedsløn",
    "reality_vs_income": "Nettoindkomst vs Virkelighed",
    "market": {
      "insufficient": "Vi har ikke nok data til en pålidelig sammenligning endnu.",
      "title": "Løn vs marked",
      "above": "Over markedet",
      "below": "Under markedet",
      "at": "På markedsniveau",
      "p50": "Typisk løn (median)",
      "iqr": "Område (p25–p75)",
      "sample_size": "Antal tilbud",
      "window": "Periode",
      "confidence": "Pålidelighed"
    },
    "ai_estimation_hint": "AI-estimat (løn ikke angivet)",
    "methodology": {
      "title": "Hvordan JHI og transport beregnes",
      "jhi_title": "JHI-påvirkningsformel",
      "jhi_formula": "Procentvis ændring i indkomst fra pendling × 1.5 = JHI-point",
      "jhi_example": "Eksempel: Hvis pendling reducerer indkomsten med 1%, falder JHI med ~1.5 point",
      "transport_title": "Transportberegning",
      "transport_car": "🚗 Bil: 0,20 €/km × 2 × 22 dage",
      "transport_public": "🚋 Offentlig transport: månedskort - billigste",
      "transport_bike": "🚴 Cykel: 0,05 €/km × 2 × 22 dage",
      "transport_walk": "🚶 Gå: 0 € (gratis)",
      "final_title": "Nettovirkelighedsformel",
      "final_formula": "Nettobasis + Goder - Pendling = Reel indkomst"
    },
    "current_location_label": "din nuværende placering",
    "reality_desc": "Beregning av nettoindkomst og pendlingsomkostninger.",
    "home_office": "Hjemmekontor",
    "saved_commute_time_money": "Sparet pendlingstid og penge.",
    "eco_friendly_choice": "Et mere miljøvenligt valg.",
    "calculation_hint": "Nettoindkomst og estimat for pendlingsomkostning."
  },
  "filters": {
    "location_commute": "Lokation og pendling",
    "cross_border": "Grænseoverskridende søgning 🦋",
    "search_all_desc": "Søger på tværs af EU-grænser",
    "search_current_desc": "Søger kun i lokalt land",
    "abroad_only": "Kun udlandet",
    "abroad_only_desc": "Uden for dit hjemland",
    "use_current_location": "Brug min nuværende placering",
    "city_placeholder": "By (f.eks. København)",
    "limit_by_commute": "Begræns efter pendling",
    "max_distance": "Maks afstand",
    "radius_hint_no_location": "For at bruge radius, angiv en by eller brug din nuværende placering.",
    "search_nearby": "📬 Tilbud i nærheden",
    "search_everywhere": "🦋 Søg overalt",
    "contract_type": "Ansættelsesform",
    "job_type": "Jobtype",
    "job_types": {
      "on_site": "På stedet",
      "hybrid": "Hybrid",
      "remote": "Fjernarbejde"
    },
    "benefits": "Goder",
    "key_benefits": {
      "title": "Nøglegoder",
      "items": {
        "car": "Firmabil til privat brug",
        "kids_friendly": "Børnevenlig",
        "flex_hours": "Fleksible arbejdstider",
        "education": "Uddannelseskurser",
        "multisport": "Fitness-ordning",
        "meal": "Frokostordning",
        "home_office": "Hjemmekontor",
        "vacation_5w": "5 ugers ferie",
        "dog_friendly": "Hundevenlig",
        "stock": "Medarbejderaktier"
      }
    },
    "date_posted": "Opslået dato",
    "any_time": "Når som helst",
    "last_24h": "Seneste 24 timer",
    "last_3d": "Seneste 3 dage",
    "last_7d": "Seneste 7 dage",
    "last_14d": "Seneste 14 dage",
    "min_salary": "Min månedsløn",
    "experience_level": "Erfaringsniveau",
    "junior": "Junior",
    "medior": "Medior",
    "senior": "Senior",
    "lead": "Lead / Manager",
    "language": "Opslagets sprog",
    "language_all": "Alle sprog",
    "sort_by": "Sorter efter",
    "sort_options": {
      "recommended": "Prioriteret oversigt",
      "newest": "Nyeste",
      "distance": "Afstand",
      "jhi_desc": "Højeste JHI",
      "salary_desc": "Højeste løn"
    }
  }
}

update_lang("sv", sv_updates)
update_lang("no", no_updates)
update_lang("da", da_updates)

# --- More Rebuild Keys for all Nordic ---
common_rebuild_updates = {
  "rebuild": {
    "recruiter": {
      "dashboard": "Dashboard",
      "assessment_center": "Assessment Center",
      "talent_pool": "Talent Pool",
      "calendar": "Kalender",
      "settings": "Indstillinger",
      "candidate_view": "Kandidatvisning",
      "command_center": "Hiring Overview"
    },
    "actions": {
      "reject": "Afvis",
      "schedule_interview": "Planlæg interview",
      "move_next_stage": "Næste fase",
      "send": "Send"
    }
  }
}

# Apply common rebuild updates (with language specific translations for common actions)
update_lang("sv", {
  "rebuild": {
    "recruiter": { "dashboard": "Dashboard", "assessment_center": "Assessment Center", "talent_pool": "Talentpool", "calendar": "Kalender", "settings": "Inställningar" },
    "actions": { "reject": "Avvisa", "schedule_interview": "Boka intervju", "move_next_stage": "Nästa steg", "send": "Skicka" }
  }
})

update_lang("no", {
  "rebuild": {
    "recruiter": { "dashboard": "Dashboard", "assessment_center": "Assessment Center", "talent_pool": "Talentpool", "calendar": "Kalender", "settings": "Innstillinger" },
    "actions": { "reject": "Avvis", "schedule_interview": "Planlegg intervju", "move_next_stage": "Neste steg", "send": "Send" }
  }
})

update_lang("da", {
  "rebuild": {
    "recruiter": { "dashboard": "Dashboard", "assessment_center": "Assessment Center", "talent_pool": "Talentpool", "calendar": "Kalender", "settings": "Indstillinger" },
    "actions": { "reject": "Afvis", "schedule_interview": "Planlæg samtale", "move_next_stage": "Næste fase", "send": "Send" }
  }
})

update_lang("fi", {
  "rebuild": {
    "recruiter": { "dashboard": "Dashboard", "assessment_center": "Assessment Center", "talent_pool": "Ehdokaspankki", "calendar": "Kalenteri", "settings": "Asetukset" },
    "actions": { "reject": "Hylkää", "schedule_interview": "Varaa haastattelu", "move_next_stage": "Seuraava vaihe", "send": "Lähetä" }
  }
})

print("Nordic translations updated.")
