import sys
import os
import re
import json

migration_path = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/backend/migrations/006_jcfpm_item_bank.sql"

if not os.path.exists(migration_path):
    print("Migration file not found")
    sys.exit(1)

with open(migration_path, "r", encoding="utf-8") as f:
    content = f.read()

item_re = re.compile(
    r"INSERT INTO jcfpm_items\([^)]*\)\s*VALUES\s*\(\s*'(D9\.[^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(\d+)\s*,\s*'((?:[^']|'')*)'::jsonb",
    re.IGNORECASE
)

trans_re = re.compile(
    r"INSERT INTO jcfpm_item_translations\([^)]*\)\s*VALUES\s*\(\s*'(D9\.[^']+)'\s*,\s*'cs'\s*,\s*'((?:[^']|'')*)'\s*,\s*'((?:[^']|'')*)'::jsonb",
    re.IGNORECASE
)

translations = {}
for match in trans_re.finditer(content):
    item_id, prompt, payload_json_str = match.groups()
    prompt = prompt.replace("''", "'")
    payload_json_str = payload_json_str.replace("''", "'")
    try:
        payload = json.loads(payload_json_str) if payload_json_str else {}
    except Exception as e:
        payload = {"error": str(e), "raw": payload_json_str}
    translations[item_id] = {
        "prompt": prompt,
        "payload": payload
    }

items = {}
for match in item_re.finditer(content):
    item_id, pool_key, variant_index, dimension, section, subdimension, item_type, scale_min, scale_max, reverse_scoring, sort_order, payload_json_str = match.groups()
    payload_json_str = payload_json_str.replace("''", "'")
    try:
        payload = json.loads(payload_json_str)
    except Exception as e:
        payload = {"error": str(e), "raw": payload_json_str}
        
    items[item_id] = {
        "item_id": item_id,
        "pool_key": pool_key,
        "variant_index": int(variant_index),
        "item_type": item_type,
        "payload": payload
    }

output_path = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/backend/scripts/d9_questions.txt"
from collections import defaultdict
grouped = defaultdict(list)
for iid, item in items.items():
    grouped[item["pool_key"]].append(item)

with open(output_path, "w", encoding="utf-8") as out:
    out.write(f"Loaded {len(items)} items and {len(translations)} translation slots.\n")
    for pool_key in sorted(grouped.keys()):
        out.write(f"\n======================================\n")
        out.write(f"Pool Key: {pool_key}\n")
        out.write(f"======================================\n")
        variants = sorted(grouped[pool_key], key=lambda x: x["variant_index"])
        for var in variants:
            iid = var["item_id"]
            trans = translations.get(iid, {"prompt": "(no cs prompt translation)", "payload": {}})
            out.write(f"\nItem: {iid} | Type: {var['item_type']} | Variant: {var['variant_index']}\n")
            out.write(f"  Base Question: {var['payload'].get('question')}\n")
            out.write(f"  CS Prompt:     {trans['prompt']}\n")
            out.write(f"  Base Options:  {var['payload'].get('options') or var['payload'].get('sources') or var['payload'].get('correct_order') or var['payload'].get('correct_pairs')}\n")
            out.write(f"  CS Payload:    {trans['payload']}\n")

print(f"Done! Written to {output_path}")
