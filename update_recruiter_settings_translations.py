import json
import os

# Supported languages
LANGUAGES = ['cs', 'en', 'sk', 'pl', 'de', 'at', 'da', 'sv', 'no', 'fi']

NEW_STRINGS = {
    "recruiter": {
        "settings_general": {
            "cs": "Všeobecné",
            "en": "General",
            "sk": "Všeobecné",
            "pl": "Ogólne",
            "de": "Allgemein",
            "at": "Allgemein",
            "da": "Generelt",
            "sv": "Allmänt",
            "no": "Generelt",
            "fi": "Yleiset"
        },
        "settings_team": {
            "cs": "Tým",
            "en": "Team",
            "sk": "Tím",
            "pl": "Zespół",
            "de": "Team",
            "at": "Team",
            "da": "Team",
            "sv": "Team",
            "no": "Team",
            "fi": "Tiimi"
        },
        "settings_brand": {
            "cs": "Brand",
            "en": "Brand",
            "sk": "Brand",
            "pl": "Marka",
            "de": "Marke",
            "at": "Marke",
            "da": "Brand",
            "sv": "Varumärke",
            "no": "Merkevare",
            "fi": "Brändi"
        },
        "handshake_materials": {
            "cs": "Podklady pro handshake",
            "en": "Handshake Materials",
            "sk": "Podklady pre handshake",
            "pl": "Materiały do handshake",
            "de": "Handshake-Materialien",
            "at": "Handshake-Materialien",
            "da": "Handshake-materialer",
            "sv": "Handshake-material",
            "no": "Handshake-materialer",
            "fi": "Handshake-materiaalit"
        },
        "materials_desc": {
            "cs": "Nahrajte prezentace, dokumenty nebo videa, které by měli kandidáti vidět.",
            "en": "Upload decks, briefs or videos that candidates should see.",
            "sk": "Nahrajte prezentácie, dokumenty alebo videá, ktoré by mali kandidáti vidieť.",
            "pl": "Prześlij prezentacje, dokumenty lub filmy, które powinni zobaczyć kandydaci.",
            "de": "Laden Sie Decks, Briefings oder Videos hoch, die Kandidaten sehen sollten.",
            "at": "Laden Sie Decks, Briefings oder Videos hoch, die Kandidaten sehen sollten.",
            "da": "Upload præsentationer, briefs eller videoer, som kandidater skal se.",
            "sv": "Ladda upp presentationer, briefs eller videor som kandidater bör se.",
            "no": "Last opp presentasjoner, briefs eller videoer som kandidater bør se.",
            "fi": "Lataa esityksiä, ohjeistuksia tai videoita, jotka ehdokkaiden tulisi nähdä."
        },
        "add_material": {
            "cs": "Přidat podklad",
            "en": "Add Material",
            "sk": "Pridať podklad",
            "pl": "Dodaj materiał",
            "de": "Material hinzufügen",
            "at": "Material hinzufügen",
            "da": "Tilføj materiale",
            "sv": "Lägg till material",
            "no": "Legg til materiale",
            "fi": "Lisää materiaali"
        },
        "no_materials": {
            "cs": "Zatím nebyly nahrány žádné další podklady.",
            "en": "No additional materials uploaded yet.",
            "sk": "Zatiaľ neboli nahrané žiadne ďalšie podklady.",
            "pl": "Nie przesłano jeszcze żadnych dodatkowych materiałów.",
            "de": "Noch keine zusätzlichen Materialien hochgeladen.",
            "at": "Noch keine zusätzlichen Materialien hochgeladen.",
            "da": "Ingen yderligere materialer uploadet endnu.",
            "sv": "Inga ytterligare material har laddats upp än.",
            "no": "Ingen ytterligere materialer er lastet opp ennå.",
            "fi": "Lisämateriaaleja ei ole vielä ladattu."
        },
        "upload_error": {
            "cs": "Nahrávání selhalo",
            "en": "Upload failed",
            "sk": "Nahrávanie zlyhalo",
            "pl": "Przesyłanie nie powiodło się",
            "de": "Upload fehlgeschlagen",
            "at": "Upload fehlgeschlagen",
            "da": "Upload mislykkedes",
            "sv": "Uppladdningen misslyckades",
            "no": "Opplasting feilet",
            "fi": "Lataus epäonnistui"
        }
    }
}

def deep_merge(base, update):
    for key, value in update.items():
        if isinstance(value, dict) and key in base and isinstance(base[key], dict):
            deep_merge(base[key], value)
        else:
            base[key] = value

def update_translations():
    locales_dir = 'frontend/public/locales'
    for lang in LANGUAGES:
        file_path = os.path.join(locales_dir, lang, 'translation.json')
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            continue
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'rebuild' not in data:
            data['rebuild'] = {}
        
        update_data = {"recruiter": {}}
        for key, translations in NEW_STRINGS["recruiter"].items():
            update_data["recruiter"][key] = translations.get(lang, translations['en'])
            
        deep_merge(data['rebuild'], update_data)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Updated {lang}")

if __name__ == '__main__':
    update_translations()
