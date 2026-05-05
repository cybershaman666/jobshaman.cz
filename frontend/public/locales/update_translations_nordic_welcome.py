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

# --- Finnish (fi) ---
fi_welcome = {
  "welcome": {
    "title_main": "Älykkäät työtarjoukset",
    "title_accent": "sinulle",
    "subtitle": "Löydä työtä, jossa on järkeä — läpinäkyvä palkka, edut ja AI-analyysi.",
    "page_hero": {
      "title_job": "Näe vihdoinkin, kuinka paljon ",
      "title_shaman": "todella",
      "title_end": "saat käteen.",
      "subtitle_items": [
        "Bruttopalkka valehtelee. Kuinka paljon todella pidät?",
        "Tarjous näyttää upealta. Mutta mitä se maksaa sinulle kuukausittain?",
        "Edut eivät ole vain lounaseteleitä. Mikä on sinulle todella tärkeää?",
        "Miksi haku loppuisi siihen, mihin kartta päättyy?"
      ],
      "try_free_btn": "Rekisteröidy avataksesi kaikki ominaisuudet",
      "browse_offers_btn": "Selaa {{count}} tarjousta"
    },
    "benefits_carousel": {
      "jhi_title": "Onnellisuusindeksi (JHI)",
      "jhi_desc": "Paljasta myrkylliset yritykset ennen kuin lähetät CV:si.",
      "salary_title": "Todellinen palkka",
      "salary_desc": "AI arvioi palkan jopa silloin, kun yritykset piilottavat sen.",
      "commute_title": "Työmatkatodellisuus",
      "commute_desc": "Laskemme menetetyn aikasi ja rahasi.",
      "coach_title": "AI-uravalmentaja",
      "coach_desc": "Parantaa CV:täsi ja kirjoittaa hakemuskirjeen puolestasi."
    }
  },
  "jhi": {
    "label_financial": "Raha",
    "label_time": "Aika",
    "label_mental": "Mieli",
    "label_growth": "Kasvu",
    "label_values": "Arvot"
  }
}

# --- Swedish (sv) ---
sv_welcome = {
  "welcome": {
    "title_main": "Smarta jobberbjudanden",
    "title_accent": "för dig",
    "subtitle": "Hitta arbete som ger mening — med transparent lön, förmåner och AI-analys.",
    "page_hero": {
      "title_job": "Se äntligen hur mycket du ",
      "title_shaman": "verkligen",
      "title_end": "får behålla.",
      "subtitle_items": [
        "Bruttolönen ljuger. Hur mycket får du verkligen behålla?",
        "Erbjudandet ser bra ut. Men vad kostar det dig varje månad?",
        "Förmåner är inte bara lunchkuponger. Vad betyder verkligen något för dig?",
        "Varför ska din sökning sluta där kartan slutar?"
      ],
      "try_free_btn": "Registrera dig för att låsa upp alla funktioner",
      "browse_offers_btn": "Bläddra bland {{count}} erbjudanden"
    },
    "benefits_carousel": {
      "jhi_title": "Lyckoindex (JHI)",
      "jhi_desc": "Avslöja giftiga företag innan du skickar ditt CV.",
      "salary_title": "Verklig lön",
      "salary_desc": "AI uppskattar lönen även där företag döljer den.",
      "commute_title": "Pendlingsverklighet",
      "commute_desc": "Vi beräknar din förlorade tid och pengar.",
      "coach_title": "AI Karriärcoach",
      "coach_desc": "Förbättrar ditt CV och skriver ett personligt brev åt dig."
    }
  },
  "jhi": {
    "label_financial": "Ekonomi",
    "label_time": "Tid",
    "label_mental": "Mental",
    "label_growth": "Tillväxt",
    "label_values": "Värderingar"
  }
}

# --- Norwegian (no) ---
no_welcome = {
  "welcome": {
    "title_main": "Smarte jobbtilbud",
    "title_accent": "for deg",
    "subtitle": "Finn arbeid som gir mening — med gjennomsiktig lønn, goder og AI-analyse.",
    "page_hero": {
      "title_job": "Se endelig hvor mye du ",
      "title_shaman": "virkelig",
      "title_end": "sitter igjen med.",
      "subtitle_items": [
        "Bruttolønn lyver. Hvor mye sitter du egentlig igjen med?",
        "Tilbudet ser bra ut. Men hva vil det koste deg hver måned?",
        "Goder er ikke bare lunsjkuponger. Hva betyr virkelig noe for deg?",
        "Hvorfor skal søket ditt stoppe der kartet slutter?"
      ],
      "try_free_btn": "Registrer deg for å låse opp alle funksjoner",
      "browse_offers_btn": "Bla gjennom {{count}} tilbud"
    },
    "benefits_carousel": {
      "jhi_title": "Lykkeindeks (JHI)",
      "jhi_desc": "Avslør giftige bedrifter før du sender din CV.",
      "salary_title": "Reell lønn",
      "salary_desc": "AI estimerer lønn selv der bedrifter skjuler den.",
      "commute_title": "Pendlingsvirkelighet",
      "commute_desc": "Vi beregner din tapte tid og penger.",
      "coach_title": "AI Karrierecoach",
      "coach_desc": "Forbedrer din CV og skriver et søknadsbrev for deg."
    }
  },
  "jhi": {
    "label_financial": "Økonomi",
    "label_time": "Tid",
    "label_mental": "Mental",
    "label_growth": "Vekst",
    "label_values": "Verdier"
  }
}

# --- Danish (da) ---
da_welcome = {
  "welcome": {
    "title_main": "Smarte jobtilbud",
    "title_accent": "til dig",
    "subtitle": "Find arbejde, der giver mening — med gennemsigtig løn, goder og AI-analyse.",
    "page_hero": {
      "title_job": "Se endelig, hvor meget du ",
      "title_shaman": "virkelig",
      "title_end": "får udbetalt.",
      "subtitle_items": [
        "Bruttoløn lyver. Hvor meget får du egentlig udbetalt?",
        "Tilbuddet ser godt ud. Men hvad vil det koste dig hver måned?",
        "Goder er ikke kun frokostordninger. Hvad betyder virkelig noget for dig?",
        "Hvorfor skal din søgning stoppe, hvor kortet ender?"
      ],
      "try_free_btn": "Tilmeld dig for at låse op for alle funktioner",
      "browse_offers_btn": "Gennemse {{count}} tilbud"
    },
    "benefits_carousel": {
      "jhi_title": "Lykkeindeks (JHI)",
      "jhi_desc": "Afslør giftige virksomheder, før du sender dit CV.",
      "salary_title": "Reel løn",
      "salary_desc": "AI estimerer løn, selv hvor virksomheder skjuler den.",
      "commute_title": "Pendlingsvirkelighed",
      "commute_desc": "Vi beregner din tabte tid og dine penge.",
      "coach_title": "AI Karrierecoach",
      "coach_desc": "Forbedrer dit CV og skriver en ansøgning for dig."
    }
  },
  "jhi": {
    "label_financial": "Økonomi",
    "label_time": "Tid",
    "label_mental": "Mental",
    "label_growth": "Vækst",
    "label_values": "Værdier"
  }
}

update_lang("fi", fi_welcome)
update_lang("sv", sv_welcome)
update_lang("no", no_welcome)
update_lang("da", da_welcome)

print("Nordic welcome and jhi translations updated.")
