import json
import os

pool_path = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/docs/jcfpm_pool_v3.json"
if not os.path.exists(pool_path):
    print("Pool file not found")
    sys.exit(1)

with open(pool_path, "r", encoding="utf-8") as f:
    data = json.load(f)

for item in data:
    item_str = json.dumps(item, ensure_ascii=False)
    if "řetěz" in item_str or "spustí" in item_str or "dopad" in item_str:
        print(f"ID: {item.get('id')} | Prompt: {item.get('prompt')}")
