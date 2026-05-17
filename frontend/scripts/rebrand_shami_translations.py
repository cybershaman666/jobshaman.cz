#!/usr/bin/env python3
import json
import os
import re

WORKSPACE_DIR = "/home/misha/Projekty (2)/jobshaman-new/jobshaman"
LOCALES_DIR = os.path.join(WORKSPACE_DIR, "frontend", "public", "locales")

CZECH_REPLACEMENTS = [
    (r"\bCybershamanem\b", "Shamim"),
    (r"\bcybershamanem\b", "shamim"),
    (r"\bCybershamana\b", "Shamiho"),
    (r"\bcybershamana\b", "shamiho"),
    (r"\bCybershamanu\b", "Shamiho"),
    (r"\bcybershamanu\b", "shamiho"),
    (r"\bCybershamanovi\b", "Shamimu"),
    (r"\bcybershamanovi\b", "shamimu"),
    (r"\bCybershamani\b", "Shamiové"),
    (r"\bcybershamani\b", "shamiové"),
    (r"\bCybershaman\b", "Shami"),
    (r"\bcybershaman\b", "shami"),
    (r"\bCyberShaman\b", "Shami"),
    (r"\bcybershamana_tip\b", "shami_tip"),
    (r"\bcybershaman_advises\b", "shami_advises"),
    (r"\bcybershaman_mentor\b", "shami_mentor"),
]

ENGLISH_REPLACEMENTS = [
    (r"\bCybershaman's\b", "Shami's"),
    (r"\bcybershaman's\b", "shami's"),
    (r"\bCybershaman\b", "Shami"),
    (r"\bcybershaman\b", "shami"),
    (r"\bCyberShaman\b", "Shami"),
    (r"\bcybershamana_tip\b", "shami_tip"),
    (r"\bcybershaman_advises\b", "shami_advises"),
    (r"\bcybershaman_mentor\b", "shami_mentor"),
]

def apply_regex_replacements(val, replacements):
    for pattern, replacement in replacements:
        val = re.sub(pattern, replacement, val)
    return val

def rebrand_value(val, lang):
    if not isinstance(val, str):
        return val
    
    is_cz_sk = lang in ["cs", "sk", "cs-CZ", "sk-SK"]
    
    # Pre-defined exact phrase replacements for highly polished look
    if "Cybershaman je přímý" in val:
        return "Shami je přímý kariérní průvodce. Mluví česky, je konkrétní, opírá se o data uživatele a po tvrdé pravdě vždy nabídne další krok."
    if "Answers go through Azure OpenAI" in val or "Cybershaman uses your profile" in val:
        if is_cz_sk:
            return "Shami používá tvůj profil, signály a doporučení z Azure AI. Když data chybí, řekne to nahlas a navrhne další konkrétní krok."
        elif lang == "pl":
            return "Shami korzysta z Twojego profilu, sygnałów i rekomendacji Azure AI. Gdy brakuje danych, mówi o tym głośno i proponuje kolejny konkretny krok."
        else:
            return "Shami uses your profile, signals, and Azure AI recommendations. If data is missing, it says so out loud and gives one concrete next step."
            
    # Apply declension regexes
    if is_cz_sk:
        val = apply_regex_replacements(val, CZECH_REPLACEMENTS)
    else:
        val = apply_regex_replacements(val, ENGLISH_REPLACEMENTS)
        
    return val

def rebrand_dict(d, lang):
    new_dict = {}
    for k, v in d.items():
        # Rebrand key name if it contains cybershaman
        new_key = k
        if "cybershaman" in k:
            new_key = k.replace("cybershaman", "shami")
            
        if isinstance(v, dict):
            new_dict[new_key] = rebrand_dict(v, lang)
        else:
            new_dict[new_key] = rebrand_value(v, lang)
    return new_dict

def process_file(file_path, lang):
    print(f"Rebranding {file_path} (lang: {lang})...")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    rebranded_data = rebrand_dict(data, lang)
    
    # Inject specific keys for the new Recruiter Shami Agent Chat
    if "rebuild" in rebranded_data and isinstance(rebranded_data["rebuild"], dict):
        rebuild = rebranded_data["rebuild"]
        
        # 1. Add recruiter assistant sidebar and panel texts
        if "nav" in rebuild and isinstance(rebuild["nav"], dict):
            nav = rebuild["nav"]
            if lang in ["cs", "sk", "cs-CZ", "sk-SK"]:
                nav["ai_guide"] = "Zeptej se Shamiho"
                nav["ai_guide_subtitle"] = "Váš náborový průvodce Shami"
                nav["chat_with_shaman"] = "Zeptej se Shamiho"
            elif lang == "pl":
                nav["ai_guide"] = "Zapytaj Shami"
                nav["ai_guide_subtitle"] = "Twój asystent rekrutacyjny"
                nav["chat_with_shaman"] = "Zapytaj Shami"
            else:
                nav["ai_guide"] = "Ask Shami"
                nav["ai_guide_subtitle"] = "Your AI recruitment guide"
                nav["chat_with_shaman"] = "Ask Shami"
                
        # 2. Add recruiter specific chat strings
        if "recruiter" in rebuild and isinstance(rebuild["recruiter"], dict):
            rec = rebuild["recruiter"]
            if lang in ["cs", "sk", "cs-CZ", "sk-SK"]:
                rec["assistant_title"] = "Ask Shami"
                rec["assistant_subtitle"] = "Váš náborový a asistenční průvodce Shami"
                rec["assistant_desc"] = "Shami je váš inteligentní kyber-sob, který vám pomůže s hledáním kandidátů, přehledem pozic i s navigací v celém systému."
                rec["assistant_placeholder"] = "Zeptejte se Shamiho na pozici, kandidáta nebo na pomoc s navigací..."
                rec["assistant_suggested_roles"] = "Najdi mé aktivní IT pozice"
                rec["assistant_suggested_candidates"] = "Ukaž kandidáty v talent poolu"
                rec["assistant_suggested_help"] = "Jak mi můžeš pomoci s onboardingem?"
                rec["assistant_quick_actions"] = "Rychlé akce Shamiho"
            elif lang == "pl":
                rec["assistant_title"] = "Ask Shami"
                rec["assistant_subtitle"] = "Twój przewodnik rekrutacyjny Shami"
                rec["assistant_desc"] = "Shami to Twój inteligentny cyber-renifer, który pomoże Ci w wyszukiwaniu kandydatów, przeglądzie stanowisk i nawigacji."
                rec["assistant_placeholder"] = "Zapytaj Shami o stanowisko, kandydata lub o pomoc w nawigacji..."
                rec["assistant_suggested_roles"] = "Znajdź moje aktywne role IT"
                rec["assistant_suggested_candidates"] = "Pokaż kandydatów w bazie"
                rec["assistant_suggested_help"] = "Jak możesz mi pomóc?"
                rec["assistant_quick_actions"] = "Szybkie akcje Shami"
            else:
                rec["assistant_title"] = "Ask Shami"
                rec["assistant_subtitle"] = "Your recruitment and assistant guide Shami"
                rec["assistant_desc"] = "Shami is your intelligent cyber-reindeer who will help you find candidates, browse active roles, and navigate the workspace."
                rec["assistant_placeholder"] = "Ask Shami about a role, a candidate, or how to navigate..."
                rec["assistant_suggested_roles"] = "Find my active IT roles"
                rec["assistant_suggested_candidates"] = "Show candidates in talent pool"
                rec["assistant_suggested_help"] = "How can you help me navigate?"
                rec["assistant_quick_actions"] = "Shami Quick Actions"
                
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(rebranded_data, f, ensure_ascii=False, indent=2)
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
            
    print("Rebranding to Shami completed successfully!")

if __name__ == "__main__":
    main()
