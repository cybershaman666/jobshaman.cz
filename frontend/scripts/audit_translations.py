#!/usr/bin/env python3
"""Audit translation keys: find missing keys, defaultValues not in locale files, hardcoded strings."""
import re, os, json, sys

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'locales')
SRC_DIR = os.path.join(os.path.dirname(__file__), '..', 'src')

def get_all_keys(obj, prefix=''):
    keys = set()
    for k, v in obj.items():
        full = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            keys.update(get_all_keys(v, full))
        else:
            keys.add(full)
    return keys

def get_value(obj, dotpath):
    parts = dotpath.split('.')
    cur = obj
    for p in parts:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return None
    return cur

# Load locales
locales = {}
for lang in ['cs', 'en', 'de', 'pl', 'sk', 'at']:
    path = os.path.join(LOCALES_DIR, lang, 'translation.json')
    with open(path) as f:
        locales[lang] = json.load(f)

cs_keys = get_all_keys(locales['cs'])

# Find all t() calls with defaultValue in source
pattern = re.compile(r"""t\(['"]([^'"]+)['"]\s*,\s*\{\s*defaultValue:\s*['"]([^'"]+)['"]\s*\}\)""")

default_values = {}
for root, dirs, files in os.walk(SRC_DIR):
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for f in files:
        if f.endswith(('.tsx', '.ts')):
            path = os.path.join(root, f)
            try:
                content = open(path).read()
                for m in pattern.finditer(content):
                    default_values[m.group(1)] = m.group(2)
            except:
                pass

# Find t() calls without defaultValue  
pattern2 = re.compile(r"""t\(['"]([a-z][a-z0-9_.]+)['"]\s*[,)]""")
all_used_keys = set()
for root, dirs, files in os.walk(SRC_DIR):
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for f in files:
        if f.endswith(('.tsx', '.ts')):
            path = os.path.join(root, f)
            try:
                content = open(path).read()
                for m in pattern2.finditer(content):
                    key = m.group(1)
                    if len(key) > 3 and '.' in key:
                        all_used_keys.add(key)
            except:
                pass

print(f"=== TRANSLATION AUDIT ===")
print(f"CS keys: {len(cs_keys)}")
print(f"Used keys in source: {len(all_used_keys)}")
print(f"Keys with defaultValue: {len(default_values)}")
print()

# 1. Keys used in source but missing from CS
missing_cs = sorted(all_used_keys - cs_keys)
# Filter out obvious non-keys
missing_cs = [k for k in missing_cs if not any(x in k for x in ['http', 'www', 'color', 'grid', 'flex', 'border', 'text.', 'font.'])]
print(f"--- Keys used in t() but MISSING from CS: {len(missing_cs)} ---")
for k in missing_cs:
    dv = default_values.get(k, '')
    print(f"  {k}" + (f" (default: {dv})" if dv else ""))

print()

# 2. Keys missing from other locales vs CS
for lang in ['en', 'de', 'pl', 'sk', 'at']:
    lang_keys = get_all_keys(locales[lang])
    missing = sorted(cs_keys - lang_keys)
    print(f"--- Missing from {lang.upper()} vs CS: {len(missing)} ---")
    sections = {}
    for k in missing:
        sec = k.split('.')[0]
        sections[sec] = sections.get(sec, 0) + 1
    for sec in sorted(sections.keys()):
        print(f"  {sec}: {sections[sec]}")
    print()

# 3. Keys in EN but not CS
en_keys = get_all_keys(locales['en'])
only_en = sorted(en_keys - cs_keys)
print(f"--- Keys in EN but MISSING from CS: {len(only_en)} ---")
for k in only_en:
    print(f"  {k}")
