import sys
import os
import re
import json

migration_path = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/backend/migrations/006_jcfpm_item_bank.sql"

if not os.path.exists(migration_path):
    print("Migration file not found")
    sys.exit(1)

print("Reading migration file...")
with open(migration_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

items = {}
translations = {}
form_items = []

# Parser for jcfpm_items inserts
# Example: INSERT INTO jcfpm_items(...) VALUES ('item_id', 'pool_key', variant_index, 'dimension', 'section', 'subdimension', 'item_type', 'scale_min', 'scale_max', reverse_scoring, sort_order, 'payload_json'::jsonb, 'assets_json'::jsonb, 'status', 'version')
item_re = re.compile(
    r"INSERT INTO jcfpm_items\([^)]*\)\s*VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(\d+)\s*,\s*'((?:[^']|'')*)'::jsonb",
    re.IGNORECASE
)

# Parser for jcfpm_item_translations inserts
# Example: INSERT INTO jcfpm_item_translations(item_id, locale, prompt, payload_json, translation_status, source_locale) VALUES ('item_id', 'locale', 'prompt', 'payload_json'::jsonb, 'translation_status', 'source_locale')
trans_re = re.compile(
    r"INSERT INTO jcfpm_item_translations\([^)]*\)\s*VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'::jsonb",
    re.IGNORECASE
)

# Parser for jcfpm_form_items inserts
# Example: INSERT INTO jcfpm_form_items(form_key, item_id, required, sort_order) VALUES ('form_key', 'item_id', required, sort_order)
form_item_re = re.compile(
    r"INSERT INTO jcfpm_form_items\([^)]*\)\s*VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'",
    re.IGNORECASE
)

print("Parsing SQL statements...")
for line_num, line in enumerate(lines, 1):
    line = line.strip()
    if not line:
        continue
        
    item_match = item_re.match(line)
    if item_match:
        item_id, pool_key, variant_index, dimension, section, subdimension, item_type, scale_min, scale_max, reverse_scoring, sort_order, payload_json_str = item_match.groups()
        payload_json_str = payload_json_str.replace("''", "'")
        try:
            payload = json.loads(payload_json_str)
        except Exception as e:
            payload = {"error": str(e), "raw": payload_json_str}
            
        items[item_id] = {
            "item_id": item_id,
            "pool_key": pool_key,
            "variant_index": int(variant_index),
            "dimension": dimension,
            "section": section,
            "subdimension": subdimension,
            "item_type": item_type,
            "scale_min": scale_min,
            "scale_max": scale_max,
            "reverse_scoring": reverse_scoring.lower() == "true",
            "sort_order": int(sort_order),
            "payload": payload,
            "line": line_num
        }
        continue
        
    trans_match = trans_re.match(line)
    if trans_match:
        item_id, locale, prompt, payload_json_str = trans_match.groups()
        prompt = prompt.replace("''", "'")
        payload_json_str = payload_json_str.replace("''", "'")
        try:
            payload = json.loads(payload_json_str) if payload_json_str else {}
        except Exception as e:
            payload = {"error": str(e), "raw": payload_json_str}
            
        if item_id not in translations:
            translations[item_id] = {}
        translations[item_id][locale] = {
            "prompt": prompt,
            "payload": payload,
            "line": line_num
        }
        continue
        
    form_item_match = form_item_re.match(line)
    if form_item_match:
        form_key, item_id = form_item_match.groups()
        form_items.append({"form_key": form_key, "item_id": item_id, "line": line_num})

print(f"Parsed {len(items)} items, {len(translations)} item translations packages, {len(form_items)} form items.")

# Scan for anomalies
anomalies = []
for item_id, item in items.items():
    item_type = item["item_type"]
    payload = item["payload"]
    item_trans = translations.get(item_id, {})
    
    # Check 1: Do we have Czech translation?
    if "cs" not in item_trans:
        # Check if it's in a form
        in_forms = [fi["form_key"] for fi in form_items if fi["item_id"] == item_id]
        if in_forms:
            anomalies.append({
                "item_id": item_id,
                "type": "missing_cs_translation",
                "message": f"Item in active forms {in_forms} is missing 'cs' translation.",
                "item": item
            })
        continue
        
    cs_trans = item_trans["cs"]
    cs_prompt = cs_trans["prompt"]
    cs_payload = cs_trans["payload"] or {}
    
    # Check 2: Mismatch between question / prompt in payload and translation prompt
    # In some items, prompt is the question itself. Let's see:
    base_q = payload.get("question")
    cs_q = cs_payload.get("question")
    
    # Check 3: Check if the question text or options are completely mismatched
    # For example, if options exist in base payload but cs translation payload has different options or no options
    base_options = payload.get("options", [])
    cs_options = cs_payload.get("options", [])
    
    if item_type in ["mcq", "scenario_choice", "ordering", "drag_drop"]:
        # If the prompt in Czech talks about one thing, but the base payload options talk about another thing, that's a mismatch!
        # E.g. prompt: "Klient chce řešení..." but base question: "Najdeš chybu s dopadem na uživatele:"
        # Or options in base/cs do not correspond to the question prompt.
        # Let's inspect the text!
        # For D9.2:
        # Prompt in cs: "Kde obvykle vzniká úzké místo v systému?" (Where does bottleneck usually form?)
        # What about prompt for D9.2 variants?
        pass

# Let's search for "řetěz" or "dopad" or similar in all parsed translations!
print("\n=== Searching parsed translations for terms from user screenshot ===")
search_terms = ["řetěz", "spustí", "Která změna", "řetězový"]
for item_id, locales in translations.items():
    for locale, trans in locales.items():
        prompt = trans["prompt"]
        payload = trans["payload"] or {}
        q = payload.get("question", "")
        opts = [o.get("label", "") for o in payload.get("options", [])]
        
        matches = [t for t in search_terms if t.lower() in prompt.lower() or t.lower() in q.lower() or any(t.lower() in opt.lower() for opt in opts)]
        if matches:
            print(f"Match found in Item: {item_id} (locale: {locale})")
            print(f"  Prompt: {prompt}")
            print(f"  Payload: {payload}")
            print(f"  Base Item: {items.get(item_id)}")

print("\n=== Checking for option/prompt mismatches in all MCQ / Scenario items ===")
mismatch_count = 0
for item_id, item in items.items():
    if item["item_type"] not in ["mcq", "scenario_choice"]:
        continue
    cs_prompt = translations.get(item_id, {}).get("cs", {}).get("prompt", "")
    cs_payload = translations.get(item_id, {}).get("cs", {}).get("payload", {})
    cs_q = cs_payload.get("question", "")
    
    base_payload = item["payload"]
    base_q = base_payload.get("question", "")
    base_options = base_payload.get("options", [])
    
    # Check if the prompt/question matches the options contextually
    # E.g. if prompt contains "Klient" or "eticky sporné" but options are "Počkám, jestli si někdo všimne" (from Najdeš chybu)
    # Let's see: Najdeš chybu has error-related options.
    # Klient chce řešení (D12.4) has client-related options: "Vyhovím mu", "Odmítnu to", etc.
    # Let's check D12.4 options:
    # 'Najdeš chybu s dopadem na uživatele:' has options 'Počkám, jestli si někdo všimne', etc.
    # But CS prompt for D12.4 is 'Klient chce řešení...'
    # This is a major mismatch! Let's print all such mismatches!
    
    # We can detect these mismatches by looking at the prompt vs the question or options.
    # In a correct translation:
    # If the CS Prompt is 'Klient chce řešení...', the CS question or Base question should be about the client!
    # But here: cs_prompt = 'Klient chce řešení...', but base_q = 'Najdeš chybu...'
    # Let's print this!
    if base_q and cs_prompt:
        # A simple check: do they share some words? Or does cs_prompt correspond to a different item's base question?
        # Let's print all of them so we can review them manually.
        mismatch_count += 1
        if mismatch_count <= 40:
            print(f"Item: {item_id}")
            print(f"  CS Prompt: {cs_prompt}")
            print(f"  Base Q:    {base_q}")
            print(f"  Options:   {[o.get('label') for o in base_options]}")
            print("-" * 50)
