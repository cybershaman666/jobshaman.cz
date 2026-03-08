import argparse
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)
sys.path.insert(0, os.path.join(backend_dir, "scraper"))

from scraper.scraper_multi import run_all_scrapers  # type: ignore


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
