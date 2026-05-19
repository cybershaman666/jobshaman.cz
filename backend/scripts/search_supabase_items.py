import sys
import os
from dotenv import load_dotenv

# Load env variables first
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
load_dotenv(os.path.join(project_root, '.env'))

# Add project root to sys.path
sys.path.append(os.path.join(os.getcwd(), '..'))

from app.core.database import supabase
from app.core.legacy_supabase import get_legacy_supabase_client

client = get_legacy_supabase_client()
if not client:
    print("Supabase client not initialized")
    sys.exit(1)

# Fetch all rows from jcfpm_items
print("Fetching all items from Supabase table 'jcfpm_items'...")
page_size = 1000
offset = 0
all_rows = []

while True:
    res = client.table("jcfpm_items").select("*").range(offset, offset + page_size - 1).execute()
    data = res.data or []
    all_rows.extend(data)
    if len(data) < page_size:
        break
    offset += page_size

print(f"Total items fetched: {len(all_rows)}")

# Specific search terms
search_terms = ["řetěz", "spustí", "Která změna"]
output_path = os.path.join(os.path.dirname(__file__), "search_results.txt")

with open(output_path, "w", encoding="utf-8") as out:
    out.write(f"Total items fetched: {len(all_rows)}\n")
    for row in all_rows:
        row_str = str(row).lower()
        matches = [term for term in search_terms if term.lower() in row_str]
        if matches:
            out.write(f"\nMatch found in Item ID '{row.get('id')}':\n")
            out.write(f"  Dimension: {row.get('dimension')}\n")
            out.write(f"  Prompt: {row.get('prompt')}\n")
            out.write(f"  Prompt I18N: {row.get('prompt_i18n')}\n")
            out.write(f"  Payload: {row.get('payload')}\n")
            out.write(f"  Payload I18N: {row.get('payload_i18n')}\n")

print(f"Done! Results written to {output_path}")
