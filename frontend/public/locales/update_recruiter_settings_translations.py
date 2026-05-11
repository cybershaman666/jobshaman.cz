import json
import os

locales_dir = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/frontend/public/locales"

def update_lang(lang, updates):
    path = os.path.join(locales_dir, lang, "translation.json")
    if not os.path.exists(path):
        print(f"Skipping {lang}, file not found.")
        return
    
    with open(path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"Error decoding JSON for {lang}")
            return
    
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
    print(f"Updated {lang}")

translations = {
    "en": {
        "rebuild": {
            "recruiter": {
                "settings_general": "General",
                "settings_team": "Team",
                "settings_brand": "Brand",
                "settings_label": "Workspace Settings",
                "company_name": "Company Name",
                "website": "Website",
                "industry": "Industry",
                "narrative": "Company Narrative",
                "narrative_placeholder": "Describe what your company does, your mission and culture...",
                "save_changes": "Save Changes",
                "team_members": "Team Members",
                "team_copy": "Manage who has access to this workspace.",
                "invite_teammate": "Invite Teammate",
                "no_members": "No teammates yet.",
                "status_invited": "Pending",
                "status_active": "Active",
                "role_owner": "Owner",
                "role_recruiter": "Recruiter",
                "visual_identity": "Visual Identity",
                "brand_color": "Primary Brand Color",
                "accent_color": "Accent Color",
                "presets": "Premium Presets",
                "assets": "Logo & Cover",
                "logo": "Company Logo",
                "logo_hint": "Square SVG or PNG is recommended",
                "cover": "Brand Cover",
                "save_branding": "Apply Branding",
                "preview": "Preview",
                "invite_email": "Email Address",
                "invite_name": "Full Name (Optional)",
                "send_invitation": "Send Invitation"
            }
        }
    },
    "cs": {
        "rebuild": {
            "recruiter": {
                "settings_general": "Všeobecné",
                "settings_team": "Tým",
                "settings_brand": "Brand",
                "settings_label": "Nastavení workspace",
                "company_name": "Název společnosti",
                "website": "Webové stránky",
                "industry": "Obor",
                "narrative": "Příběh společnosti",
                "narrative_placeholder": "Popište, co vaše firma dělá, jaké je vaše poslání a kultura...",
                "save_changes": "Uložit změny",
                "team_members": "Členové týmu",
                "team_copy": "Správa uživatelů, kteří mají přístup k tomuto workspace.",
                "invite_teammate": "Pozvat kolegu",
                "no_members": "Zatím zde nejsou žádní kolegové.",
                "status_invited": "Pozvánka odeslána",
                "status_active": "Aktivní",
                "role_owner": "Vlastník",
                "role_recruiter": "Recruiter",
                "visual_identity": "Vizuální identita",
                "brand_color": "Hlavní barva značky",
                "accent_color": "Akcentní barva",
                "presets": "Prémiové šablony",
                "assets": "Logo a cover",
                "logo": "Logo společnosti",
                "logo_hint": "Doporučujeme čtvercové SVG nebo PNG",
                "cover": "Brand cover",
                "save_branding": "Použít branding",
                "preview": "Náhled",
                "invite_email": "E-mailová adresa",
                "invite_name": "Celé jméno (volitelné)",
                "send_invitation": "Odeslat pozvánku"
            }
        }
    },
    "sk": {
        "rebuild": {
            "recruiter": {
                "settings_general": "Všeobecné",
                "settings_team": "Tím",
                "settings_brand": "Brand",
                "settings_label": "Nastavenia workspace",
                "company_name": "Názov spoločnosti",
                "website": "Webové stránky",
                "industry": "Odbor",
                "narrative": "Príbeh spoločnosti",
                "narrative_placeholder": "Popíšte, čo vaša firma robí, aké je vaše poslanie a kultúra...",
                "save_changes": "Uložiť zmeny",
                "team_members": "Členovia tímu",
                "team_copy": "Správa používateľov, ktorí majú prístup k tomuto workspace.",
                "invite_teammate": "Pozvať kolegu",
                "no_members": "Zatiaľ tu nie sú žiadni kolegovia.",
                "status_invited": "Pozvánka odoslaná",
                "status_active": "Aktívny",
                "role_owner": "Vlastník",
                "role_recruiter": "Recruiter",
                "visual_identity": "Vizuálna identita",
                "brand_color": "Hlavná farba značky",
                "accent_color": "Akcentná farba",
                "presets": "Prémiové šablóny",
                "assets": "Logo a cover",
                "logo": "Logo spoločnosti",
                "logo_hint": "Odporúčame štvorcové SVG alebo PNG",
                "cover": "Brand cover",
                "save_branding": "Použiť branding",
                "preview": "Náhľad",
                "invite_email": "E-mailová adresa",
                "invite_name": "Celé meno (voliteľné)",
                "send_invitation": "Odoslať pozvánku"
            }
        }
    },
    "pl": {
        "rebuild": {
            "recruiter": {
                "settings_general": "Ogólne",
                "settings_team": "Zespół",
                "settings_brand": "Marka",
                "settings_label": "Ustawienia workspace",
                "company_name": "Nazwa firmy",
                "website": "Strona internetowa",
                "industry": "Branża",
                "narrative": "Opis firmy",
                "narrative_placeholder": "Opisz, czym zajmuje się Twoja firma, jaka jest Twoja misja i kultura...",
                "save_changes": "Zapisz zmiany",
                "team_members": "Członkowie zespołu",
                "team_copy": "Zarządzaj dostępem do tego obszaru roboczego.",
                "invite_teammate": "Zaproś współpracownika",
                "no_members": "Brak członków zespołu.",
                "status_invited": "Oczekujące",
                "status_active": "Aktywny",
                "role_owner": "Właściciel",
                "role_recruiter": "Rekruter",
                "visual_identity": "Tożsamość wizualna",
                "brand_color": "Główny kolor marki",
                "accent_color": "Kolor akcentu",
                "presets": "Presety premium",
                "assets": "Logo i okładka",
                "logo": "Logo firmy",
                "logo_hint": "Zalecany jest kwadratowy format SVG lub PNG",
                "cover": "Okładka marki",
                "save_branding": "Zastosuj branding",
                "preview": "Podgląd",
                "invite_email": "Adres e-mail",
                "invite_name": "Imię i nazwisko (opcjonalnie)",
                "send_invitation": "Wyślij zaproszenie"
            }
        }
    },
    "de": {
        "rebuild": {
            "recruiter": {
                "settings_general": "Allgemein",
                "settings_team": "Team",
                "settings_brand": "Marke",
                "settings_label": "Workspace-Einstellungen",
                "company_name": "Unternehmensname",
                "website": "Webseite",
                "industry": "Branche",
                "narrative": "Unternehmensbeschreibung",
                "narrative_placeholder": "Beschreiben Sie, was Ihr Unternehmen tut, Ihre Mission und Kultur...",
                "save_changes": "Änderungen speichern",
                "team_members": "Teammitglieder",
                "team_copy": "Verwalten Sie, wer Zugriff auf diesen Workspace hat.",
                "invite_teammate": "Teammitglied einladen",
                "no_members": "Noch keine Teammitglieder.",
                "status_invited": "Ausstehend",
                "status_active": "Aktiv",
                "role_owner": "Eigentümer",
                "role_recruiter": "Recruiter",
                "visual_identity": "Visuelle Identität",
                "brand_color": "Hauptmarkenfarbe",
                "accent_color": "Akzentfarbe",
                "presets": "Premium-Voreinstellungen",
                "assets": "Logo & Cover",
                "logo": "Unternehmenslogo",
                "logo_hint": "Quadratisches SVG oder PNG wird empfohlen",
                "cover": "Marken-Cover",
                "save_branding": "Branding anwenden",
                "preview": "Vorschau",
                "invite_email": "E-Mail-Adresse",
                "invite_name": "Vollständiger Name (optional)",
                "send_invitation": "Einladung senden"
            }
        }
    },
    "at": {
        "rebuild": {
            "recruiter": {
                "settings_general": "Allgemein",
                "settings_team": "Team",
                "settings_brand": "Marke",
                "settings_label": "Workspace-Einstellungen",
                "company_name": "Unternehmensname",
                "website": "Webseite",
                "industry": "Branche",
                "narrative": "Unternehmensbeschreibung",
                "narrative_placeholder": "Beschreiben Sie, was Ihr Unternehmen tut, Ihre Mission und Kultur...",
                "save_changes": "Änderungen speichern",
                "team_members": "Teammitglieder",
                "team_copy": "Verwalten Sie, wer Zugriff auf diesen Workspace hat.",
                "invite_teammate": "Teammitglied einladen",
                "no_members": "Noch keine Teammitglieder.",
                "status_invited": "Ausstehend",
                "status_active": "Aktiv",
                "role_owner": "Inhaber",
                "role_recruiter": "Recruiter",
                "visual_identity": "Visuelle Identität",
                "brand_color": "Hauptmarkenfarbe",
                "accent_color": "Akzentfarbe",
                "presets": "Premium-Voreinstellungen",
                "assets": "Logo & Cover",
                "logo": "Unternehmenslogo",
                "logo_hint": "Quadratisches SVG oder PNG wird empfohlen",
                "cover": "Marken-Cover",
                "save_branding": "Branding anwenden",
                "preview": "Vorschau",
                "invite_email": "E-Mail-Adresse",
                "invite_name": "Vollständiger Name (optional)",
                "send_invitation": "Einladung senden"
            }
        }
    },
    "da": {
        "rebuild": {
            "recruiter": {
                "settings_general": "Generelt",
                "settings_team": "Team",
                "settings_brand": "Brand",
                "settings_label": "Workspace-indstillinger",
                "company_name": "Virksomhedsnavn",
                "website": "Hjemmeside",
                "industry": "Branche",
                "narrative": "Virksomhedsbeskrivelse",
                "narrative_placeholder": "Beskriv, hvad din virksomhed laver, din mission og kultur...",
                "save_changes": "Gem ændringer",
                "team_members": "Teammedlemmer",
                "team_copy": "Administrer hvem der har adgang til dette workspace.",
                "invite_teammate": "Inviter kollega",
                "no_members": "Ingen teammedlemmer endnu.",
                "status_invited": "Afventer",
                "status_active": "Aktiv",
                "role_owner": "Ejer",
                "role_recruiter": "Recruiter",
                "visual_identity": "Visuel identitet",
                "brand_color": "Primær brandfarve",
                "accent_color": "Accentfarve",
                "presets": "Premium-forudindstillinger",
                "assets": "Logo og cover",
                "logo": "Virksomhedslogo",
                "logo_hint": "Kvadratisk SVG eller PNG anbefales",
                "cover": "Brand-cover",
                "save_branding": "Anvend branding",
                "preview": "Forhåndsvisning",
                "invite_email": "E-mailadresse",
                "invite_name": "Fulde navn (valgfrit)",
                "send_invitation": "Send invitation"
            }
        }
    },
    "sv": {
        "rebuild": {
            "recruiter": {
                "settings_general": "Allmänt",
                "settings_team": "Team",
                "settings_brand": "Varumärke",
                "settings_label": "Workspace-inställningar",
                "company_name": "Företagsnamn",
                "website": "Webbplats",
                "industry": "Bransch",
                "narrative": "Företagsbeskrivning",
                "narrative_placeholder": "Beskriv vad ditt företag gör, er mission och kultur...",
                "save_changes": "Spara ändringar",
                "team_members": "Teammedlemmar",
                "team_copy": "Hantera vem som har åtkomst till detta workspace.",
                "invite_teammate": "Bjud in kollega",
                "no_members": "Inga teammedlemmar ännu.",
                "status_invited": "Väntar",
                "status_active": "Aktiv",
                "role_owner": "Ägare",
                "role_recruiter": "Recruiter",
                "visual_identity": "Visuell identitet",
                "brand_color": "Primär varumärkesfärg",
                "accent_color": "Accentfärg",
                "presets": "Premium-förinställningar",
                "assets": "Logo och cover",
                "logo": "Företagslogo",
                "logo_hint": "Kvadratisk SVG eller PNG rekommenderas",
                "cover": "Varumärkes-cover",
                "save_branding": "Använd branding",
                "preview": "Förhandsvisning",
                "invite_email": "E-postadress",
                "invite_name": "Fullständigt namn (valfritt)",
                "send_invitation": "Skicka inbjudan"
            }
        }
    },
    "no": {
        "rebuild": {
            "recruiter": {
                "settings_general": "Generelt",
                "settings_team": "Team",
                "settings_brand": "Merkevare",
                "settings_label": "Workspace-innstillinger",
                "company_name": "Firmanavn",
                "website": "Nettside",
                "industry": "Bransje",
                "narrative": "Firmabeskrivelse",
                "narrative_placeholder": "Beskriv hva firmaet ditt gjør, deres misjon og kultur...",
                "save_changes": "Lagre endringer",
                "team_members": "Teammedlemmer",
                "team_copy": "Administrer hvem som har tilgang til dette workspace.",
                "invite_teammate": "Inviter kollega",
                "no_members": "Ingen teammedlemmer ennå.",
                "status_invited": "Venter",
                "status_active": "Aktiv",
                "role_owner": "Eier",
                "role_recruiter": "Rekrutterer",
                "visual_identity": "Visuell identitet",
                "brand_color": "Primær merkefarge",
                "accent_color": "Aksentfarge",
                "presets": "Premium-forhåndsinnstillinger",
                "assets": "Logo og cover",
                "logo": "Firmalogo",
                "logo_hint": "Kvadratisk SVG eller PNG anbefales",
                "cover": "Merkecover",
                "save_branding": "Bruk branding",
                "preview": "Forhåndsvisning",
                "invite_email": "E-postadresse",
                "invite_name": "Fullt navn (valgfritt)",
                "send_invitation": "Send invitasjon"
            }
        }
    },
    "fi": {
        "rebuild": {
            "recruiter": {
                "settings_general": "Yleiset",
                "settings_team": "Tiimi",
                "settings_brand": "Brändi",
                "settings_label": "Workspace-asetukset",
                "company_name": "Yrityksen nimi",
                "website": "Verkkosivusto",
                "industry": "Toimiala",
                "narrative": "Yrityksen kuvaus",
                "narrative_placeholder": "Kuvaile mitä yrityksesi tekee, missio ja kulttuuri...",
                "save_changes": "Tallenna muutokset",
                "team_members": "Tiimin jäsenet",
                "team_copy": "Hallitse kuka pääsee tähän työtilaan.",
                "invite_teammate": "Kutsu tiimin jäsen",
                "no_members": "Ei vielä tiimin jäseniä.",
                "status_invited": "Odottaa",
                "status_active": "Aktiivinen",
                "role_owner": "Omistaja",
                "role_recruiter": "Rekrytoija",
                "visual_identity": "Visuaalinen identiteetti",
                "brand_color": "Ensisijainen brändiväri",
                "accent_color": "Aksenttiväri",
                "presets": "Premium-esiasetukset",
                "assets": "Logo ja kansi",
                "logo": "Yrityksen logo",
                "logo_hint": "Neliönmuotoinen SVG tai PNG on suositeltu",
                "cover": "Brändin kansi",
                "save_branding": "Käytä brändiä",
                "preview": "Esikatselu",
                "invite_email": "Sähköpostiosoite",
                "invite_name": "Koko nimi (valinnainen)",
                "send_invitation": "Lähetä kutsu"
            }
        }
    }
}

for lang, updates in translations.items():
    update_lang(lang, updates)

print("All translations updated.")
