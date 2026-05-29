import asyncio
import os
import sys
from pathlib import Path

# Add project root to path
BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_DIR))

from dotenv import load_dotenv
load_dotenv(BACKEND_DIR.parent / ".env")

from app.core.database import engine
from app.domains.recommendation.service import RecommendationDomainService
from app.domains.identity.service import IdentityDomainService

async def main():
    print("=== Testing Recommendation Domain Service Dynamic Search ===")
    
    # 1. Fetch any registered candidate to use as mock user_id
    from sqlalchemy import text
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id FROM users LIMIT 1"))
        user_row = result.fetchone()
        if not user_row:
            print("No users found in database.")
            return 1
        user_id = str(user_row[0])
        print(f"Using mock user_id: {user_id}")
        
    # 2. Build candidate feed with PL country and EN language search parameters
    search_params = {
        "country": "PL",
        "language": "en"
    }
    
    try:
        print(f"Calling build_candidate_feed with search_params: {search_params}")
        feed = await RecommendationDomainService.build_candidate_feed(
            user_id=user_id,
            limit=12,
            search_params=search_params
        )
        
        print("\n=== Result ===")
        print(f"Total count: {feed.get('total_count')}")
        print(f"Items returned: {len(feed.get('items', []))}")
        
        print("\nSample items returned:")
        for idx, item in enumerate(feed.get("items", [])[:5]):
            job = item.get("job", {})
            print(f"  {idx + 1}. Title: {job.get('title')} | Company: {job.get('company_name')} | Location: {job.get('location')} | Country: {job.get('recommendation_country')} | Language: {job.get('language_code')}")
            print(f"     Fit Score: {item.get('fit_score')}% | Intent: {item.get('intent')}")
            
        return 0
    except Exception as e:
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    asyncio.run(main())
