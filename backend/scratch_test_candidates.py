import asyncio
import os
import sys
import json

# Add app to path
sys.path.append(os.path.join(os.getcwd(), "v2", "backend"))

from app.domains.identity.service import IdentityDomainService
from app.core.database import engine

async def test_list_candidates():
    print("Fetching candidates...")
    candidates = await IdentityDomainService.list_registered_candidates(limit=10)
    print(f"Found {len(candidates)} candidates.")
    for c in candidates:
        source = c.get("source", "native")
        print(f"- {c['name']} (ID: {c['id']}, Source: {source})")
    
    if len(candidates) > 0:
        print("\nSuccess! Candidates loaded.")
    else:
        print("\nNo candidates found. Check Supabase connection.")

if __name__ == "__main__":
    # Ensure env vars are set
    os.environ["VITE_SUPABASE_URL"] = "https://frquoinhhxkxnvcyomtr.supabase.co"
    os.environ["VITE_SUPABASE_KEY"] = "<SECRET>"
    os.environ["SUPABASE_SERVICE_KEY"] = "<SECRET>"
    
    # We need a dummy DB_URL for testing or use the one from env if exists
    # If not set, it might fail. Let's check .env
    
    asyncio.run(test_list_candidates())
