import json

pool_path = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/docs/jcfpm_pool_v3.json"
with open(pool_path, "r", encoding="utf-8") as f:
    data = json.load(f)

d9_items = [item for item in data if isinstance(item, dict) and item.get("dimension") == "d9_systems_thinking"]

for item in d9_items:
    id_val = item.get("id")
    if id_val in ["D9.1", "D9.2", "D9.3", "D9.4", "D9.5", "D9.6"]:
        print("=================================================================")
        print(json.dumps(item, indent=2, ensure_ascii=False))
