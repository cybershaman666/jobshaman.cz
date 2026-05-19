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
    content = f.read()

# We want to find inserts to jcfpm_items where the item_type is not 'likert'
# Example statement:
# INSERT INTO jcfpm_items(item_id, pool_key, variant_index, dimension, section, subdimension, item_type, scale_min, scale_max, reverse_scoring, sort_order, payload_json, assets_json, status, version) VALUES ('D1.1', 'D1.1', 1, 'd1_cognitive', 'psychometric', 'd1_cognitive_core_1', 'likert', ...
# Let's use regex to parse the item_id, item_type, and payload_json
pattern = re.compile(
    r"INSERT INTO jcfpm_items\([^)]*\)\s*VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(\d+)\s*,\s*'([^']+)'::jsonb",
    re.IGNORECASE
)

# Also let's extract translations for the matching items
translation_pattern = re.compile(
    r"INSERT INTO jcfpm_item_translations\(item_id, locale, prompt, payload_json, translation_status, source_locale\)\s*VALUES\s*\(\s*'([^']+)'\s*,\s*'cs'\s*,\s*'([^']*)'\s*,\s*'([^']*)'::jsonb",
    re.IGNORECASE
)

translations = {}
for match in translation_pattern.finditer(content):
    item_id, prompt, payload_cs = match.groups()
    translations[item_id] = {
        "prompt": prompt,
        "payload_cs": payload_cs
    }

non_likert_items = []
matches = pattern.findall(content)
print(f"Found {len(matches)} total items in seed.")

for m in matches:
    item_id, pool_key, variant_index, dimension, section, subdimension, item_type, scale_min, scale_max, reverse_scoring, sort_order, payload_json = m
    if item_type != "likert":
        # Load the payload json
        try:
            payload = json.loads(payload_json.replace("''", "'"))
        except Exception as e:
            payload = payload_json
            
        trans = translations.get(item_id, {"prompt": "(no cs prompt translation)", "payload_cs": "{}"})
        
        non_likert_items.append({
            "item_id": item_id,
            "dimension": dimension,
            "item_type": item_type,
            "prompt": trans["prompt"],
            "payload": payload,
            "translation": trans
        })

print(f"\nFound {len(non_likert_items)} non-likert items:")
for item in non_likert_items:
    print(f"\nItem ID: {item['item_id']} ({item['item_type']}) - Dimension: {item['dimension']}")
    print(f"  CS Translation Prompt: {item['prompt']}")
    print(f"  Payload: {item['payload']}")
