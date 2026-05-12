#!/usr/bin/env python3
"""
Azure Container Instance startup script for JobShaman Scraper Job.

This script runs the unified jobs ingest pipeline and exits gracefully
when complete, allowing Azure Container Instances to manage the lifecycle.

Usage:
  python scripts/start_azure_scraper.py

Environment Variables:
  - SCRAPER_JOB_COUNTRIES: Comma-separated country codes (default: CZ,AT,DE,SK,PL)
  - SCRAPER_JOB_SITES: Comma-separated job sites (default: indeed,linkedin,google)
  - SCRAPER_JOB_RESULTS_WANTED: Number of results per query (default: 30)
  - JOBS_POSTGRES_ENABLED: Enable PostgreSQL backend (default: true)
  - JOBS_POSTGRES_WRITE_MAIN: Write to main jobs table (default: true)
"""

import asyncio
import os
import sys
import logging
from datetime import datetime
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from backend.scripts.run_unified_jobs_ingest import run_unified_ingest


async def main():
    """Run the scraper job."""
    logger.info("=" * 80)
    logger.info("🕷️  JobShaman Scraper Job (Azure Container Instance)")
    logger.info("=" * 80)
    logger.info(f"Started at: {datetime.now().isoformat()}")

    try:
        # Get configuration from environment
        countries = os.getenv("SCRAPER_JOB_COUNTRIES", "CZ,AT,DE,SK,PL").split(",")
        sites = os.getenv("SCRAPER_JOB_SITES", "indeed,linkedin,google").split(",")
        results_wanted = int(os.getenv("SCRAPER_JOB_RESULTS_WANTED", "30"))

        logger.info(f"Configuration:")
        logger.info(f"  Countries: {', '.join(countries)}")
        logger.info(f"  Job sites: {', '.join(sites)}")
        logger.info(f"  Results per query: {results_wanted}")

        # Run the scraper
        logger.info("\n🚀 Starting unified jobs ingest...")
        await run_unified_ingest()

        logger.info("\n✅ Scraper job completed successfully!")
        logger.info(f"Completed at: {datetime.now().isoformat()}")
        return 0

    except Exception as e:
        logger.error(f"\n❌ Scraper job failed with error:", exc_info=True)
        logger.error(f"Error details: {str(e)}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
