import json
import os

locales_dir = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/frontend/public/locales"
en_path = os.path.join(locales_dir, "en", "translation.json")

with open(en_path, "r", encoding="utf-8") as f:
    en_data = json.load(f)

nordic_langs = ["fi", "sv", "no", "da"]

for lang in nordic_langs:
    lang_path = os.path.join(locales_dir, lang, "translation.json")
    if not os.path.exists(lang_path):
        print(f"{lang}: File not found")
        continue
    
    with open(lang_path, "r", encoding="utf-8") as f:
        lang_data = json.load(f)
    
    missing_top_keys = [k for k in en_data.keys() if k not in lang_data]
    print(f"{lang}: Missing top-level keys: {missing_top_keys}")
    
    # Count total keys in EN vs LANG
    def count_keys(d):
        count = 0
        if isinstance(d, dict):
            count += len(d)
            for v in d.values():
                count += count_keys(v)
        return count

    en_total = count_keys(en_data)
    lang_total = count_keys(lang_data)
    print(f"{lang}: Total keys: {lang_total} / {en_total}")
