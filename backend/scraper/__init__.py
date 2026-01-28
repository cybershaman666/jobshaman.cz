"""
JobShaman Scraper Package
Multi-country job scraping system
"""

from .scraper_base import BaseScraper, init_supabase
from .scraper_sk import run_slovakia_scraper
from .scraper_pl import run_poland_scraper
from .scraper_de import run_germany_scraper

__all__ = [
    'BaseScraper',
    'init_supabase',
    'run_slovakia_scraper',
    'run_poland_scraper',
    'run_germany_scraper',
]
