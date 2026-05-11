import os
import re
import json

def extract_translations(directory):
    t_regex = re.compile(r"t\('(?P<key>rebuild\.[^']+)'(?:,\s*{\s*defaultValue:\s*'(?P<value>[^']+)'[^}]*})?\)")
    translations = {}
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                path = os.path.join(root, file)
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        matches = t_regex.finditer(content)
                        for match in matches:
                            key = match.group('key')
                            value = match.group('value')
                            if key not in translations:
                                translations[key] = value
                            elif value and not translations.get(key):
                                translations[key] = value
                except Exception as e:
                    print(f"Error reading {path}: {e}")
    return translations

def update_json(file_path, translations, is_czech=False):
    if not os.path.exists(file_path):
        data = {}
    else:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    
    changed = False
    for key, default_value in translations.items():
        parts = key.split('.')
        curr = data
        for part in parts[:-1]:
            if part not in curr:
                curr[part] = {}
                changed = True
            curr = curr[part]
            if not isinstance(curr, dict):
                # Fix cases where parent might be a string instead of object
                # This can happen if some keys were misused before
                parent = data
                for p in parts[:parts.index(part)]:
                    parent = parent[p]
                parent[part] = {}
                curr = parent[part]
                changed = True
        
        last_part = parts[-1]
        if last_part not in curr:
            curr[last_part] = default_value or ""
            changed = True
    
    if changed:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    return changed

rebuild_dir = "frontend/src/rebuild"
locales_dir = "frontend/public/locales"

print("Extracting translations from source code...")
source_translations = extract_translations(rebuild_dir)
print(f"Extracted {len(source_translations)} keys.")

PRODUCTION_LANGS = ["cs", "en", "sk", "pl", "de", "at", "da", "sv", "no", "fi"]

for lang in PRODUCTION_LANGS:
    path = os.path.join(locales_dir, lang, "translation.json")
    if not os.path.exists(path):
        print(f"Skipping {path} (not found)")
        continue
    print(f"Updating {path}...")
    updated = update_json(path, source_translations, is_czech=(lang == "cs"))
    if updated:
        print(f"Updated {path}")
    else:
        print(f"No changes for {path}")
