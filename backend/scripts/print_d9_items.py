import sys
import os

migration_path = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/backend/migrations/006_jcfpm_item_bank.sql"

if not os.path.exists(migration_path):
    print("Migration file not found")
    sys.exit(1)

with open(migration_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

print("--- jcfpm_items for D9 ---")
for line in lines:
    if "INSERT INTO jcfpm_items" in line and "'D9." in line:
        print(line.strip())

print("\n--- jcfpm_item_translations for D9 ---")
for line in lines:
    if "INSERT INTO jcfpm_item_translations" in line and "'D9." in line and "'cs'" in line:
        print(line.strip())
