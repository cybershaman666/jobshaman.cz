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
fi_rebuild_more = {
  "rebuild": {
    "status": {
      "applied": "Haettu",
      "review": "Arvioinnissa",
      "interview": "Haastattelu",
      "offer": "Tarjous",
      "hired": "Palkattu",
      "rejected": "Hylätty",
      "withdrawn": "Peruttu",
      "closed": "Suljettu",
      "active": "Aktiivinen",
      "draft": "Luonnos",
      "pending": "Odottaa"
    },
    "lifestory": {
      "ai_guide": "AI-elämäntarinan opas",
      "placeholder": "Kirjoita vapaasti, vaikka ranskalaisilla viivoilla...",
      "back": "Takaisin",
      "next": "Jatka",
      "generate": "Dokonoi tarina",
      "roots_title": "Juuret ja unelmat",
      "roots_prompt": "Mitä halusit olla isona? Mitkä olivat ensimmäiset suuret harrastuksesi (esim. partio, urheilu, musiikki)?",
      "growth_title": "Ensimmäiset askeleet",
      "growth_prompt": "Milloin koit ensimmäistä kertaa loistavasi jossakin? Ensimmäiset kesätyöt, koulut, mikä niissä oli hauskaa?",
      "signals_title": "Mikä toimi",
      "signals_prompt": "Muistele hetkiä, jolloin olit \"vyöhykkeellä\". Mitä teit silloin? Ja mikä taas vei energiaasi?",
      "craft_title": "Taidot ja kurssit",
      "craft_prompt": "Mitä taitoja olet hankkinut työn ulkopuolella? Sertifikaatit, itseopiskelu, epävirallinen johtajuus?",
      "context_title": "Nykyinen tilanne",
      "context_prompt": "Mikä on nykyinen tilanteesi? (Esim. paluu vanhempainvapaalta, loppuunpalaminen, halu vaihtaa alaa?)",
      "vision_title": "Mihin seuraavaksi?",
      "vision_prompt": "Jos esteitä ei olisi, mihin suuntaan haluaisit kehittyä seuraavien 5 vuoden aikana?"
    },
    "insights": {
      "title": "Oivallukset",
      "profile_completeness": "Profiilin täydellisyys",
      "match_rate": "Osumatarkkuus",
      "career_path": "Urapolku",
      "top_skills": "Huipputaidot",
      "missing_skills": "Puuttuvat taidot",
      "salary_reality": "Palkkatodellisuus"
    }
  }
}

# --- Swedish (sv) ---
sv_rebuild_more = {
  "rebuild": {
    "status": {
      "applied": "Sökt",
      "review": "Granskas",
      "interview": "Intervju",
      "offer": "Erbjudande",
      "hired": "Anställd",
      "rejected": "Avvisad",
      "withdrawn": "Återkallad",
      "closed": "Stängd",
      "active": "Aktiv",
      "draft": "Utkast",
      "pending": "Väntar"
    },
    "lifestory": {
      "ai_guide": "AI-livsberättelseguide",
      "placeholder": "Skriv gärna i punktform...",
      "back": "Tillbaka",
      "next": "Nästa",
      "generate": "Slutför berättelse",
      "roots_title": "Rötter och drömmar",
      "roots_prompt": "Vad ville du bli när du var liten? Vilka var dina första stora intressen (t.ex. scout, sport, musik)?",
      "growth_title": "Första stegen",
      "growth_prompt": "När kände du för första gången att du var bra på något? Första extrajobben, skolor, vad var det som var roligt?",
      "signals_title": "Vad som fungerade",
      "signals_prompt": "Minns stunder när du var \"i zonen\". Vad var det för aktivitet? Och vad tog å andra sidan din energi?",
      "craft_title": "Färdigheter och kurser",
      "craft_prompt": "Vilka färdigheter har du skaffat dig utanför jobbet? Certifikat, självstudier, informellt ledarskap?",
      "context_title": "Nuvarande situation",
      "context_prompt": "Hur ser din nuvarande situation ut? (T.ex. återgång efter föräldraledighet, utbrändhet, lust att byta bransch?)",
      "vision_title": "Vart härnäst?",
      "vision_prompt": "Om det inte fanns några hinder, vilken riktning skulle du vilja utvecklas i de närmaste 5 åren?"
    },
    "insights": {
      "title": "Insikter",
      "profile_completeness": "Profilens fullständighet",
      "match_rate": "Matchningsgrad",
      "career_path": "Karriärväg",
      "top_skills": "Toppkompetenser",
      "missing_skills": "Saknade kompetenser",
      "salary_reality": "Lönerealitet"
    }
  }
}

# --- Norwegian (no) ---
no_rebuild_more = {
  "rebuild": {
    "status": {
      "applied": "Søkt",
      "review": "Til vurdering",
      "interview": "Intervju",
      "offer": "Tilbud",
      "hired": "Ansatt",
      "rejected": "Avvist",
      "withdrawn": "Trukket",
      "closed": "Lukket",
      "active": "Aktiv",
      "draft": "Utkast",
      "pending": "Venter"
    },
    "lifestory": {
      "ai_guide": "AI-livshistorieguide",
      "placeholder": "Skriv gjerne i punkter...",
      "back": "Tilbake",
      "next": "Neste",
      "generate": "Fullfør historie",
      "roots_title": "Røtter og drømmer",
      "roots_prompt": "Hva ville du bli da du var liten? Hva var dine første store hobbyer (f.eks. speider, sport, musikk)?",
      "growth_title": "Første skritt",
      "growth_prompt": "Når følte du for første gang at du var god til noe? Første sommerjobber, skoler, hva var det som var gøy?",
      "signals_title": "Hva som fungerte",
      "signals_prompt": "Husk øyeblikk da du var \"i sonen\". Hva var det for en aktivitet? Og hva tok derimot energien din?",
      "craft_title": "Ferdigheter og kurs",
      "craft_prompt": "Hvilke ferdigheter har du skaffet deg utenfor jobben? Sertifikater, selvstudier, uformell ledelse?",
      "context_title": "Nåværende situasjon",
      "context_prompt": "Hvordan er din nåværende situasjon? (F.eks. retur etter foreldrepermisjon, utbrenthet, lyst til å bytte bransje?)",
      "vision_title": "Hvor går veien videre?",
      "vision_prompt": "Hvis det ikke fantes noen hindringer, hvilken retning ville du ønske å utvikle deg i de neste 5 årene?"
    },
    "insights": {
      "title": "Innsikt",
      "profile_completeness": "Profilens fullstendighet",
      "match_rate": "Matchingsgrad",
      "career_path": "Karrierevei",
      "top_skills": "Toppferdigheter",
      "missing_skills": "Manglende ferdigheter",
      "salary_reality": "Lønnsvirkelighet"
    }
  }
}

# --- Danish (da) ---
da_rebuild_more = {
  "rebuild": {
    "status": {
      "applied": "Søgt",
      "review": "Til vurdering",
      "interview": "Samtale",
      "offer": "Tilbud",
      "hired": "Ansat",
      "rejected": "Afvist",
      "withdrawn": "Trukket tilbage",
      "closed": "Lukket",
      "active": "Aktiv",
      "draft": "Udkast",
      "pending": "Venter"
    },
    "lifestory": {
      "ai_guide": "AI-livshistorieguide",
      "placeholder": "Skriv gerne i punktform...",
      "back": "Tilbage",
      "next": "Næste",
      "generate": "Færdiggør historie",
      "roots_title": "Rødder og drømme",
      "roots_prompt": "Hvad ville du være, da du var lille? Hvad var dine første store hobbyer (f.eks. spejder, sport, musik)?",
      "growth_title": "Første skridt",
      "growth_prompt": "Hvornår følte du for første gang, at du var god til noget? Første sommerjobs, skoler, hvad var det, der var sjovt?",
      "signals_title": "Hvad der fungerede",
      "signals_prompt": "Husk øjeblikke, hvor du var \"i zonen\". Hvad var det for en aktivitet? Og hvad tog til gengæld din energi?",
      "craft_title": "Færdigheder og kurser",
      "craft_prompt": "Hvilke færdigheder har du tilegnet dig uden for jobbet? Certifikater, selvstudie, uformel ledelse?",
      "context_title": "Nuværende situation",
      "context_prompt": "Hvordan er din nuværende situation? (F.eks. retur efter barsel, udbrændthed, lyst til at skifte branche?)",
      "vision_title": "Hvad nu?",
      "vision_prompt": "Hvis der ikke var nogen forhindringer, hvilken retning ville du så gerne udvikle dig i de næste 5 år?"
    },
    "insights": {
      "title": "Indsigter",
      "profile_completeness": "Profilens fuldstændighed",
      "match_rate": "Match-rate",
      "career_path": "Karrierevej",
      "top_skills": "Topkompetencer",
      "missing_skills": "Manglende kompetencer",
      "salary_reality": "Lønvirkelighed"
    }
  }
}

update_lang("fi", fi_rebuild_more)
update_lang("sv", sv_rebuild_more)
update_lang("no", no_rebuild_more)
update_lang("da", da_rebuild_more)

print("More Nordic rebuild translations updated.")
