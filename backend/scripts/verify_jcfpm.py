import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.join(os.getcwd(), '..'))

from app.services.jcfpm_pool import fetch_jcfpm_items, jcfpm_pool_diagnostics
from app.core import config
import json

print(f"Current Provider: {config.JCFPM_ITEMS_PROVIDER}")
print(f"Collection: {config.MONGODB_JCFPM_COLLECTION}")

try:
    print("\n--- Running Diagnostics ---")
    diag = jcfpm_pool_diagnostics()
    print(json.dumps(diag, indent=2))
    
    print("\n--- Fetching Items ---")
    result = fetch_jcfpm_items()
    print(f"Source: {result.source}")
    print(f"Items fetched: {len(result.items)}")
    print(f"Latency: {result.latency_ms}ms")
    print(f"Fallback Used: {result.fallback_used} (Reason: {result.fallback_reason})")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
