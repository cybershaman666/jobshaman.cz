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

# Match jcfpm_items
item_re = re.compile(
    r"INSERT INTO jcfpm_items\([^)]*\)\s*VALUES\s*\(\s*'([^']+)'\s*,\s*'[^']+'\s*,\s*\d+\s*,\s*'[^']+'\s*,\s*'[^']+'\s*,\s*'[^']*'\s*,\s*'([^']+)'\s*,\s*'[^']*'\s*,\s*[^,]+\s*,\s*[^,]+\s*,\s*\d+\s*,\s*'((?:[^']|'')*)'::jsonb",
    re.IGNORECASE
)

# Match jcfpm_item_translations
trans_re = re.compile(
    r"INSERT INTO jcfpm_item_translations\([^)]*\)\s*VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'[^']*'\s*,\s*'((?:[^']|'')*)'::jsonb",
    re.IGNORECASE
)

print("Checking items...")
for match in item_re.finditer(content):
    item_id, item_type, payload_str = match.groups()
    payload_str = payload_str.replace("''", "'")
    try:
        payload = json.loads(payload_str)
    except Exception:
        continue
    
    if item_type in ["mcq", "scenario_choice"]:
        options = payload.get("options")
        if not options:
            print(f"Base Item anomaly: {item_id} (type: {item_type}) has NO options or empty options: {options}")

print("\nChecking translations...")
for match in trans_re.finditer(content):
    item_id, locale, payload_str = match.groups()
    payload_str = payload_str.replace("''", "'")
    try:
        payload = json.loads(payload_str)
    except Exception:
        continue
        
    if "options" in payload:
        options = payload.get("options")
        if not options or len(options) == 0:
            print(f"Translation anomaly: {item_id} (locale: {locale}) overrides 'options' with empty or null: {options}")
