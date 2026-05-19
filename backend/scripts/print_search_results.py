import sys
import os
import re

migration_path = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/backend/migrations/006_jcfpm_item_bank.sql"

if not os.path.exists(migration_path):
    print("Migration file not found")
    sys.exit(1)

with open(migration_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

search_terms = ["řetěz", "spustí", "řetězový", "dopad v systému"]

print("Searching lines...")
for i, line in enumerate(lines, 1):
    for term in search_terms:
        if term.lower() in line.lower():
            # Print the line number and the line
            print(f"Line {i} ({term}): {line.strip()}")
            print("-" * 80)
            break
