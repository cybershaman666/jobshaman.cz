import sys
import os
import re

migration_path = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/backend/migrations/006_jcfpm_item_bank.sql"

if not os.path.exists(migration_path):
    print("Migration file not found")
    sys.exit(1)

with open(migration_path, "r", encoding="utf-8") as f:
    content = f.read()

# Find all occurrences of D9. followed by any characters except quote
item_ids = sorted(list(set(re.findall(r"'D9\.[^']+'", content))))
print(f"Total D9 item IDs in migration file: {len(item_ids)}")
for iid in item_ids:
    print(iid)
