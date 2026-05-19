import json

pool_path = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/docs/jcfpm_pool_v3.json"
with open(pool_path, "r", encoding="utf-8") as f:
    data = json.load(f)

d12_items = [item for item in data if isinstance(item, dict) and item.get("dimension") == "d12_moral_compass"]

for item in d12_items:
    id_val = item.get("id")
    if id_val in ["D12.4", "D12.5"]:
        print("=================================================================")
        print(json.dumps(item, indent=2, ensure_ascii=False))
