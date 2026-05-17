#!/usr/bin/env python3
import json
import os

WORKSPACE_DIR = "/home/misha/Projekty (2)/jobshaman-new/jobshaman"
LOCALES_DIR = os.path.join(WORKSPACE_DIR, "frontend", "public", "locales")

def clean_value(val, lang):
    if not isinstance(val, str):
        return val
    
    # Czech/Slovak/Polish translations
    is_cz_sk = lang in ["cs", "sk", "cs-CZ", "sk-SK"]
    
    # 1. Loading text replacement
    if "Mistral is composing" in val:
        if is_cz_sk:
            return "Cybershaman formuluje odpověď..."
        elif lang == "pl":
            return "Cybershaman układa odpowiedź..."
        else:
            return "Cybershaman is composing a reply..."
            
    if "Mistral skládá" in val:
        return "Cybershaman formuluje odpověď..."
        
    if "Mistral is composing a response" in val:
        return "Cybershaman is composing a response..."

    # 2. Disclaimer / description replacement
    if "Answers go through Mistral" in val:
        if lang == "pl":
            return "Odpowiedzi przechodzą przez Azure OpenAI i są zgodne z podręcznikiem szamańskiej uczciwości. Gdy brakuje danych, należy o tym głośno powiedzieć."
        elif lang == "sk":
            return "Odpovede prechádzajú cez Azure OpenAI a riadia sa manuálom šamanskej úprimnosti. Keď chýbajú dáta, má to povedať nahlas."
        elif lang == "de" or lang == "at":
            return "Antworten laufen über Azure OpenAI und folgen dem Handbuch der schamanischen Ehrlichkeit. Wenn Daten fehlen, sollte dies laut ausgesprochen werden."
        else:
            return "Answers go through Azure OpenAI and follow the manual of shamanic honesty. If data is missing, it should say so out loud."
            
    if "Odpovědi jdou přes Mistral" in val:
        return "Odpovědi jdou přes Azure OpenAI a drží se manuálu šamanské upřímnosti. Když chybí data, má to říct nahlas."

    # 3. Help / assist text replacement
    if "Mistral pomůže" in val:
        return "AI pomůže formulovat"
    if "Mistral will help" in val:
        return "AI will help formulate"
    if "mistral_assist" in val or "Mistral" in val:
        # Generic fallback replacements to ensure no leftover "Mistral"
        val = val.replace("Mistral", "Azure OpenAI")
        val = val.replace("mistral", "ai")
        
    # Lowercase references
    if "přes Mistral" in val:
        val = val.replace("přes Mistral", "přes AI")
    if "via Mistral" in val:
        val = val.replace("via Mistral", "via AI")
        
    return val

def clean_dict(d, lang):
    new_dict = {}
    for k, v in d.items():
        # Handle key name rename if necessary, e.g. containing mistral
        new_key = k
        if "mistral" in k:
            new_key = k.replace("mistral", "ai")
            
        if isinstance(v, dict):
            new_dict[new_key] = clean_dict(v, lang)
        else:
            new_dict[new_key] = clean_value(v, lang)
    return new_dict

def process_file(file_path, lang):
    print(f"Processing {file_path} (lang: {lang})...")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    cleaned_data = clean_dict(data, lang)
    
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(cleaned_data, f, ensure_ascii=False, indent=2)
        f.write("\n")

def main():
    # 1. Process public locales
    for lang in os.listdir(LOCALES_DIR):
        lang_path = os.path.join(LOCALES_DIR, lang)
        if os.path.isdir(lang_path):
            trans_file = os.path.join(lang_path, "translation.json")
            if os.path.exists(trans_file):
                process_file(trans_file, lang)
                
    # 2. Process root rebuild translation files
    for filename in ["rebuild_cs.json", "rebuild_en.json", "rebuild_fi.json"]:
        file_path = os.path.join(WORKSPACE_DIR, filename)
        if os.path.exists(file_path):
            lang = "cs" if "cs" in filename else ("fi" if "fi" in filename else "en")
            process_file(file_path, lang)
            
    print("Mistral translations cleaning complete!")

if __name__ == "__main__":
    main()
