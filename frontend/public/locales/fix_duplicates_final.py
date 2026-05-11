import json
import os

files_to_fix = [
    "/home/misha/Projekty (2)/jobshaman-new/jobshaman/frontend/public/locales/da/translation.json",
    "/home/misha/Projekty (2)/jobshaman-new/jobshaman/frontend/public/locales/de/translation.json",
    "/home/misha/Projekty (2)/jobshaman-new/jobshaman/frontend/public/locales/pl/translation.json"
]

def fix_json(file_path):
    print(f"Fixing {file_path}")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        class FirstDuplicateDecoder(json.JSONDecoder):
            def __init__(self, *args, **kwargs):
                super().__init__(object_pairs_hook=self.deduplicate, *args, **kwargs)
            
            def deduplicate(self, pairs):
                d = {}
                for k, v in pairs:
                    if k not in d:
                        d[k] = v
                return d

        data = json.loads(content, cls=FirstDuplicateDecoder)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Successfully fixed {file_path}")
            
    except Exception as e:
        print(f"Error fixing {file_path}: {e}")

for f in files_to_fix:
    fix_json(f)
