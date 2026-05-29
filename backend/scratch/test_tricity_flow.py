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
from app.api.v2.endpoints.mentor import _parse_search_params, _compact_job_recommendations
from app.domains.recommendation.service import RecommendationDomainService
from app.domains.identity.service import IdentityDomainService
from app.services.cybershaman_service import build_cybershaman_reply
from sqlalchemy import text


async def main():
    print("=== Testing Tricity English Job Search & Personality Flow ===")
    
    # 1. Fetch a user_id from the DB to mock the current user
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT id FROM users LIMIT 1"))
        user_row = result.fetchone()
        if not user_row:
            print("No users found in database.")
            return 1
        user_id = str(user_row[0])
        print(f"Using mock user_id: {user_id}")
        
    # 2. Test parameter parsing
    message = "najdi mi pozice v tricity kde stačí angličtina"
    search_params = _parse_search_params(message)
    print(f"\nParsed Search Params for message '{message}':")
    print(f"  {search_params}")
    
    # Assertions for parsing
    assert search_params is not None, "search_params should not be None"
    assert search_params.get("country") == "PL", f"Expected country PL, got {search_params.get('country')}"
    assert search_params.get("language") == "en", f"Expected language en, got {search_params.get('language')}"
    print("✅ Parameter parsing validated successfully!")
    
    # 3. Retrieve feed
    print("\nFetching candidate feed...")
    feed = await RecommendationDomainService.build_candidate_feed(
        user_id=user_id,
        limit=24,
        search_params=search_params
    )
    
    items = feed.get("items", [])
    print(f"Feed fetched. Found {len(items)} matching jobs.")
    
    # Print sample items
    for idx, item in enumerate(items[:5]):
        job = item.get("job", {})
        print(f"  {idx + 1}. Title: {job.get('title')} | Company: {job.get('company_name')} | Location: {job.get('location')} | Country: {job.get('country_code')} / {job.get('recommendation_country')} | Language: {job.get('language_code')}")
        
    job_recs = _compact_job_recommendations(feed, limit=4)
    print(f"\nCompacted Recommendations for LLM ({len(job_recs)} jobs):")
    for rec in job_recs:
        print(f"  - {rec.get('title')} at {rec.get('company')} in {rec.get('location')} (ID: {rec.get('id')})")
        
    # 4. Generate Cybershaman AI reply
    print("\nGenerating Cybershaman reply...")
    profile = await IdentityDomainService.get_candidate_profile(user_id)
    
    reply_data = build_cybershaman_reply(
        message=message,
        profile=profile,
        recent_messages=[],
        job_recommendations=job_recs
    )
    
    print("\n=== Shami's AI Response ===")
    print(f"Tone: {reply_data.get('tone')}")
    print(f"Reply:\n{reply_data.get('reply')}")
    print(f"\nJob Recommendations Returned by Shami:")
    for idx, job in enumerate(reply_data.get("job_recommendations", [])):
        print(f"  {idx + 1}. {job.get('title')} at {job.get('company')} | Location: {job.get('location')}")
        print(f"     Why: {job.get('why')}")
        print(f"     Watch out: {job.get('watch_out')}")
        
    print("\n=== End of Test ===")
    return 0

if __name__ == "__main__":
    try:
        exit_code = asyncio.run(main())
        sys.exit(exit_code)
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
