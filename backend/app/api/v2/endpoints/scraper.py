import os
import sys
from fastapi import APIRouter, Request, HTTPException
from app.core.legacy_compat import limiter

SCRAPER_TOKEN = os.environ.get("SCRAPER_TOKEN", "")

# Add scraper directories to sys.path
_here = os.path.dirname(__file__)
_root = os.path.abspath(os.path.join(_here, "../../../../../"))
_runtime_services = os.path.join(_root, "runtime-services")
_scraper_dir = os.path.join(_runtime_services, "scraper")

if _runtime_services not in sys.path:
    sys.path.insert(0, _runtime_services)
if _scraper_dir not in sys.path:
    sys.path.insert(0, _scraper_dir)

try:
    # Try local import first if run from within package, then fallback to absolute
    try:
        from scraper.scraper_multi import run_all_scrapers
    except ImportError:
        import scraper_multi as scraper_multi_local
        run_all_scrapers = scraper_multi_local.run_all_scrapers
except Exception as e:
    print(f"⚠️ Scraper import failed: {e}")
    run_all_scrapers = None

router = APIRouter()

@router.get("/scrape")
@limiter.limit("5/minute")
async def trigger_scrape(request: Request):
    if not run_all_scrapers:
        raise HTTPException(status_code=500, detail="Scraper module not found in runtime-services/scraper")
    
    # Admin token gate
    if not SCRAPER_TOKEN or request.headers.get("X-Admin-Token") != SCRAPER_TOKEN:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    try:
        run_all_scrapers()
        return {"status": "success", "message": "Scraper triggered successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
