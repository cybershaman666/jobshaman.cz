import json
import os
import re

def has_czech_chars(text):
    return bool(re.search("[řčěůňťďáéíóúýŽŠČŘĎŤŇ]", text))

locales_dir = "frontend/public/locales"
en_path = os.path.join(locales_dir, "en", "translation.json")

with open(en_path, "r", encoding="utf-8") as f:
    data = json.load(f)

def find_czech_keys(d, prefix=""):
    results = []
    if isinstance(d, dict):
        for k, v in d.items():
            results.extend(find_czech_keys(v, f"{prefix}{k}."))
    elif isinstance(d, str):
        if has_czech_chars(d):
            results.append((prefix[:-1], d))
    return results

czech_in_en = find_czech_keys(data.get("rebuild", {}), "rebuild.")
for key, val in czech_in_en:
    print(f"{key}: {val}")
