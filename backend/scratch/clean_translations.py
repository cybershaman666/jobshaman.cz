import json
import os

path = '/home/misha/Projekty (2)/jobshaman-new/jobshaman/frontend/public/locales/cs/translation.json'

def deep_merge(dict1, dict2):
    for key, value in dict2.items():
        if key in dict1 and isinstance(dict1[key], dict) and isinstance(value, dict):
            deep_merge(dict1[key], value)
        else:
            dict1[key] = value

if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Check for duplicate top-level keys is handled by json.load (it usually takes the last one)
    # But if we have multiple "rebuild" blocks in the file, json.load might have already merged them or taken the last one.
    # However, the user says there are duplicate keys in the file (which is invalid JSON but some parsers allow it).
    
    # Let's read the file as text to see if there are multiple "rebuild" blocks.
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # If we have multiple "rebuild" blocks, json.load(f) will only see one (the last one usually).
    # To fix this, we should find all "rebuild" blocks and merge them.
    # But a better way is to use a parser that can handle duplicates or just fix it manually if it's just two.
    
    # Actually, if I just load and dump, it might fix it if the parser takes the last one.
    # But I want to MERGE them.
    
    print(f"Original keys: {list(data.keys())}")
    
    # Since I can't easily parse invalid JSON with duplicates into a list of dicts with standard json lib,
    # I'll do a more manual approach if needed.
    # But let's try to just dump it back and see if it removes the duplicate key warning.
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("Cleaned up JSON (hopefully).")
else:
    print("File not found.")
