import json

pool_path = "/home/misha/Projekty (2)/jobshaman-new/jobshaman/docs/jcfpm_pool_v3.json"
with open(pool_path, "r", encoding="utf-8") as f:
    data = json.load(f)

d9_items = [item for item in data if isinstance(item, dict) and item.get("dimension") == "d9_systems_thinking"]

print(f"Found {len(d9_items)} systems thinking items in pool_v3.json.")

# Let's print the first few items, their types, prompt, and payloads
for item in d9_items:
    id_val = item.get("id")
    item_type = item.get("item_type")
    prompt = item.get("prompt")
    payload = item.get("payload", {})
    options = payload.get("options") if isinstance(payload, dict) else None
    print(f"ID: {id_val} | Type: {item_type} | Prompt: {prompt}")
    if options:
        print(f"  Options ({len(options)}): {options}")
    else:
        print(f"  No options in payload")
