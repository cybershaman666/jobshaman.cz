import sys
import os
import json

# Add project root to sys.path
sys.path.append(os.path.join(os.getcwd(), '..'))

from app.services.jcfpm_pool import _fetch_items_from_supabase

print("Fetching items from Supabase...")
items = _fetch_items_from_supabase()
print(f"Total items fetched: {len(items)}")

# 1. Search for the specific question from the screenshot
search_terms = ["řetěz", "retez", "změna nejspíš", "dopad v systému", "bottleneck"]
found_search = []

for idx, item in enumerate(items):
    # Check item representation
    item_str = json.dumps(item, ensure_ascii=False)
    for term in search_terms:
        if term.lower() in item_str.lower():
            found_search.append((term, item.get('id'), item.get('dimension'), item.get('item_type'), item.get('prompt'), item.get('prompt_i18n')))

print("\n--- Search Results for Screen Terms ---")
for res in found_search[:30]:
    print(f"Term: {res[0]} | ID: {res[1]} | Dim: {res[2]} | Type: {res[3]}")
    print(f"  Prompt: {res[4]}")
    print(f"  Prompt i18n keys: {list(res[5].keys()) if res[5] else 'None'}")
    if res[5] and 'cs' in res[5]:
        print(f"  CS translation: {res[5]['cs']}")
    print("-" * 50)

# 2. Inspect all items for mismatches
print("\n--- Scanning for Structural Anomalies ---")
anomalies = []
for item in items:
    iid = item.get('id')
    item_type = item.get('item_type')
    payload = item.get('payload') or {}
    payload_i18n = item.get('payload_i18n') or {}
    
    # Check MCQ options matching translation options
    if item_type == 'mcq':
        options = payload.get('options', [])
        correct_id = payload.get('correct_id')
        question = payload.get('question')
        
        # Check in English and Czech translations if they match
        cs_trans = payload_i18n.get('cs', {})
        if cs_trans:
            cs_question = cs_trans.get('question')
            cs_options = cs_trans.get('options', [])
            
            if cs_question and question and cs_question != question:
                # Potential mismatch
                anomalies.append({
                    "id": iid,
                    "type": "mcq_question_mismatch",
                    "base_q": question,
                    "cs_q": cs_question,
                    "base_options": [o.get('label') for o in options],
                    "cs_options": [o.get('label') for o in cs_options]
                })

print(f"Found {len(anomalies)} anomalies.")
for a in anomalies[:20]:
    print(f"ID: {a['id']} | Type: {a['type']}")
    print(f"  Base Q: {a['base_q']}")
    print(f"  CS Q: {a['cs_q']}")
    print(f"  Base Options: {a['base_options']}")
    print(f"  CS Options: {a['cs_options']}")
    print("=" * 60)
