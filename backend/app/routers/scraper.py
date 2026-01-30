from fastapi import APIRouter, Request, HTTPException
import sys
import os

# Ensure scraper can be found
sys.path.append(os.path.join(os.path.dirname(__file__), "..", ".."))
try:
    from scraper.scraper_multi import run_all_scrapers
except ImportError:
    run_all_scrapers = None

router = APIRouter()

@router.get("/scrape")
async def trigger_scrape(request: Request):
    if not run_all_scrapers:
        raise HTTPException(status_code=500, detail="Scraper not found")
    try:
        run_all_scrapers()
        return {"status": "success", "message": "Scraper triggered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
