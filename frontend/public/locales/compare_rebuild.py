import json
import os

def get_keys(data, prefix=""):
    keys = {}
    if isinstance(data, dict):
        for k, v in data.items():
            keys.update(get_keys(v, f"{prefix}{k}."))
    else:
        keys[prefix[:-1]] = data
    return keys

locales_dir = "frontend/public/locales"
en_path = os.path.join(locales_dir, "en", "translation.json")
cs_path = os.path.join(locales_dir, "cs", "translation.json")

with open(en_path, "r", encoding="utf-8") as f:
    en_data = json.load(f)
with open(cs_path, "r", encoding="utf-8") as f:
    cs_data = json.load(f)

en_rebuild = get_keys(en_data.get("rebuild", {}), "rebuild.")
cs_rebuild = get_keys(cs_data.get("rebuild", {}), "rebuild.")

# Find keys where values are the same in both (likely untranslated)
# or where value in CS is the same as key (placeholder)
# or where value in CS is English

with open("rebuild_comparison.txt", "w", encoding="utf-8") as f:
    f.write("Key | EN Value | CS Value\n")
    f.write("---|---|---\n")
    for key in sorted(en_rebuild.keys()):
        en_val = en_rebuild[key]
        cs_val = cs_rebuild.get(key, "MISSING")
        if en_val == cs_val or cs_val == "MISSING":
             f.write(f"{key} | {en_val} | {cs_val}\n")
