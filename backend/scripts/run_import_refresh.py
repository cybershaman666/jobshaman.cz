import argparse
import os
import sys

# Allow importing from backend/scraper when run as a script
if __name__ == "__main__":
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    if os.path.join(backend_dir, "scraper") not in sys.path:
        sys.path.insert(0, os.path.join(backend_dir, "scraper"))

try:
    from scraper.scraper_multi import run_all_scrapers # type: ignore
except (ImportError, ModuleNotFoundError):
    from scraper_multi import run_all_scrapers # type: ignore


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the full imported-jobs refresh pipeline, including remote metadata normalization."
    )
    parser.add_argument(
        "--disable-remote-normalization",
        action="store_true",
        help="Skip the post-import remote metadata backfill for this run.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    if args.disable_remote_normalization:
        os.environ["SCRAPER_REMOTE_METADATA_BACKFILL"] = "false"

    total = run_all_scrapers()
    print(f"🏁 Import refresh completed. Saved {total} jobs.")
