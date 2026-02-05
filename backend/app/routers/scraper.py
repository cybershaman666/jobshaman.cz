from fastapi import APIRouter, Request, HTTPException
import sys
import os
from ..core.config import SCRAPER_TOKEN
from ..core.limiter import limiter

# Ensure scraper can be found
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
try:
    from scraper.scraper_multi import run_all_scrapers
except ImportError:
    run_all_scrapers = None

router = APIRouter()

@router.get("/scrape")
@limiter.limit("5/minute")
async def trigger_scrape(request: Request):
    if not run_all_scrapers:
        raise HTTPException(status_code=500, detail="Scraper not found")
    # Simple admin token gate to prevent public triggering
    if not SCRAPER_TOKEN or request.headers.get("X-Admin-Token") != SCRAPER_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized")
    try:
        run_all_scrapers()
        return {"status": "success", "message": "Scraper triggered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
