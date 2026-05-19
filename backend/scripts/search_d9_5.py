import os

migration_path = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/backend/migrations/006_jcfpm_item_bank.sql"

print("Extracting D9.5 inserts and translations...")
with open(migration_path, "r", encoding="utf-8") as f:
    for line in f:
        if "'D9.5'" in line or "'D9.5_" in line:
            if "jcfpm_items" in line or "jcfpm_item_translations" in line:
                print(line.strip())
