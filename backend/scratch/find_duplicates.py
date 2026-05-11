import json

path = '/home/misha/Projekty (2)/jobshaman-new/jobshaman/frontend/public/locales/cs/translation.json'

def find_duplicates(data, path_prefix=""):
    seen = set()
    # Note: json.load doesn't help find duplicates because it handles them by default.
    # We need to parse manually or use a library that reports them.
    pass

# Simple manual parser for top-level keys
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

keys = []
for line in lines:
    if line.strip().startswith('"') and line.strip().endswith('": {'):
        key = line.strip().split('"')[1]
        keys.append(key)

from collections import Counter
counts = Counter(keys)
for key, count in counts.items():
    if count > 1:
        print(f"Duplicate top-level key: {key} ({count} times)")
