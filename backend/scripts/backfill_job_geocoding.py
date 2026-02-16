import argparse
import math
import os
import sys
import time
from typing import Dict, Optional, Tuple

# Allow importing from backend root and scraper helpers.
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)
sys.path.insert(0, os.path.join(backend_dir, "scraper"))

from geocoding import (  # type: ignore
    MAJOR_CITIES_CACHE,
    geocode_location,
    normalize_address,
)
from scraper_base import get_supabase_client  # type: ignore


DEFAULT_BATCH_SIZE = int(os.getenv("BACKFILL_GEO_BATCH_SIZE", "300"))
DEFAULT_SLEEP_SECONDS = float(os.getenv("BACKFILL_GEO_SLEEP_SECONDS", "0.1"))
DEFAULT_CITY_MATCH_KM = float(os.getenv("BACKFILL_GEO_CITY_MATCH_KM", "3.0"))
DEFAULT_MIN_CHANGE_KM = float(os.getenv("BACKFILL_GEO_MIN_CHANGE_KM", "1.0"))

ADMIN_TOKENS = {"okres", "kraj", "region", "district", "county", "venkov"}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance between 2 points in km (great-circle)."""
    r = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def build_normalized_city_cache() -> Dict[str, Tuple[float, float]]:
    """Normalize static city keys so checks are diacritics/hyphen safe."""
    out: Dict[str, Tuple[float, float]] = {}
    for key, coords in MAJOR_CITIES_CACHE.items():
        out.setdefault(normalize_address(key), coords)
    return out


def has_admin_context(normalized_location: str) -> bool:
    tokens = normalized_location.split()
    return any(tok in ADMIN_TOKENS for tok in tokens)


def is_suspicious_city_collapse(
    normalized_location: str,
    lat: float,
    lng: float,
    normalized_city_cache: Dict[str, Tuple[float, float]],
    city_match_km: float,
) -> bool:
    """
    Detect likely bad geocoding where admin-area string collapsed to a city center.
    Example: "Kuřim, okres Brno-venkov" -> Brno centrum coordinates.
    """
    if not has_admin_context(normalized_location):
        return False

    tokens = set(normalized_location.split())
    for city_key, (city_lat, city_lng) in normalized_city_cache.items():
        city_tokens = city_key.split()
        if len(city_tokens) != 1:
            continue
        city = city_tokens[0]
        if city not in tokens:
            continue
        if haversine_km(lat, lng, city_lat, city_lng) <= city_match_km:
            return True
    return False


def is_plausible_geocode_result(
    location: str,
    new_lat: float,
    new_lng: float,
    normalized_city_cache: Dict[str, Tuple[float, float]],
    max_anchor_drift_km: float,
) -> bool:
    """
    Guard against ambiguous geocoder hits.
    If location text contains an anchor city token, new point should not be far away.
    """
    normalized_location = normalize_address(location)
    tokens = set(normalized_location.split())
    anchor_distances = []

    for city_key, (city_lat, city_lng) in normalized_city_cache.items():
        city_tokens = city_key.split()
        if len(city_tokens) != 1:
            continue
        city = city_tokens[0]
        if city not in tokens:
            continue
        anchor_distances.append(haversine_km(new_lat, new_lng, city_lat, city_lng))

    if not anchor_distances:
        return True

    return min(anchor_distances) <= max_anchor_drift_km


def should_process_row(
    location: Optional[str],
    lat: Optional[float],
    lng: Optional[float],
    mode: str,
    normalized_city_cache: Dict[str, Tuple[float, float]],
    city_match_km: float,
) -> bool:
    if not location:
        return False

    normalized_location = normalize_address(location)
    if not normalized_location:
        return False

    if mode == "all":
        return True

    if mode == "missing":
        return lat is None or lng is None

    # mode == "suspicious"
    if lat is None or lng is None:
        return False

    return is_suspicious_city_collapse(
        normalized_location=normalized_location,
        lat=lat,
        lng=lng,
        normalized_city_cache=normalized_city_cache,
        city_match_km=city_match_km,
    )


def backfill(
    dry_run: bool,
    mode: str,
    batch_size: int,
    max_rows: int,
    start_id: int,
    sleep_seconds: float,
    city_match_km: float,
    min_change_km: float,
    max_anchor_drift_km: float,
) -> None:
    supabase = get_supabase_client()
    if not supabase:
        print("❌ Supabase klient není dostupný.")
        return

    normalized_city_cache = build_normalized_city_cache()
    last_id = start_id
    scanned = 0
    candidates = 0
    geocoded = 0
    updates = 0
    unchanged = 0
    failed = 0
    rejected = 0

    mode_text = "DRY-RUN" if dry_run else "APPLY"
    print(
        f"🚀 Geocoding backfill start [{mode_text}] "
        f"mode={mode} batch_size={batch_size} max_rows={max_rows} start_id={start_id}"
    )

    while scanned < max_rows:
        limit = min(batch_size, max_rows - scanned)
        res = (
            supabase.table("jobs")
            .select("id,location,lat,lng")
            .gt("id", last_id)
            .order("id", desc=False)
            .limit(limit)
            .execute()
        )
        rows = res.data or []
        if not rows:
            break

        for row in rows:
            scanned += 1
            job_id = row.get("id")
            location = row.get("location")
            lat = row.get("lat")
            lng = row.get("lng")

            if not should_process_row(
                location=location,
                lat=lat,
                lng=lng,
                mode=mode,
                normalized_city_cache=normalized_city_cache,
                city_match_km=city_match_km,
            ):
                last_id = job_id
                continue

            candidates += 1
            new_geo = geocode_location(location)
            if not new_geo:
                failed += 1
                print(f"⚠️ {job_id}: geocode failed for '{location}'")
                last_id = job_id
                if sleep_seconds > 0:
                    time.sleep(sleep_seconds)
                continue

            geocoded += 1
            new_lat = float(new_geo["lat"])
            new_lng = float(new_geo["lon"])

            if not is_plausible_geocode_result(
                location=location,
                new_lat=new_lat,
                new_lng=new_lng,
                normalized_city_cache=normalized_city_cache,
                max_anchor_drift_km=max_anchor_drift_km,
            ):
                rejected += 1
                print(
                    f"⛔ {job_id}: rejected implausible geocode for '{location}' "
                    f"-> ({new_lat:.6f},{new_lng:.6f}) [{new_geo.get('source', 'unknown')}]"
                )
                last_id = job_id
                if sleep_seconds > 0:
                    time.sleep(sleep_seconds)
                continue

            if lat is not None and lng is not None:
                delta_km = haversine_km(float(lat), float(lng), new_lat, new_lng)
            else:
                delta_km = float("inf")

            if delta_km < min_change_km:
                unchanged += 1
                print(
                    f"↔️ {job_id}: unchanged ({delta_km:.2f} km) '{location}' "
                    f"[{new_geo.get('source', 'unknown')}]"
                )
                last_id = job_id
                if sleep_seconds > 0:
                    time.sleep(sleep_seconds)
                continue

            if dry_run:
                print(
                    f"🧪 {job_id}: would update '{location}' "
                    f"({lat},{lng}) -> ({new_lat:.6f},{new_lng:.6f}) "
                    f"delta={delta_km:.2f} km [{new_geo.get('source', 'unknown')}]"
                )
            else:
                try:
                    (
                        supabase.table("jobs")
                        .update({"lat": new_lat, "lng": new_lng})
                        .eq("id", job_id)
                        .execute()
                    )
                    updates += 1
                    print(
                        f"✅ {job_id}: updated '{location}' "
                        f"delta={delta_km:.2f} km [{new_geo.get('source', 'unknown')}]"
                    )
                except Exception as e:
                    failed += 1
                    print(f"❌ {job_id}: update failed: {e}")

            last_id = job_id
            if sleep_seconds > 0:
                time.sleep(sleep_seconds)

        print(
            "📦 Batch done "
            f"scanned={scanned} candidates={candidates} geocoded={geocoded} "
            f"updates={updates} unchanged={unchanged} rejected={rejected} failed={failed}"
        )

    print(
        "🏁 Geocoding backfill done "
        f"scanned={scanned} candidates={candidates} geocoded={geocoded} "
        f"updates={updates} unchanged={unchanged} rejected={rejected} failed={failed}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Backfill job geocoding (lat/lng) for suspicious or missing records."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist changes to DB. Without this flag runs in dry-run mode.",
    )
    parser.add_argument(
        "--mode",
        choices=["suspicious", "missing", "all"],
        default="suspicious",
        help="Record selection mode. Default: suspicious.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"Rows per batch (default {DEFAULT_BATCH_SIZE}).",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=20000,
        help="Maximum number of scanned rows.",
    )
    parser.add_argument(
        "--start-id",
        type=int,
        default=0,
        help="Start scanning from jobs.id > start_id (useful for resume).",
    )
    parser.add_argument(
        "--sleep-seconds",
        type=float,
        default=DEFAULT_SLEEP_SECONDS,
        help=f"Pause between processed candidates (default {DEFAULT_SLEEP_SECONDS}).",
    )
    parser.add_argument(
        "--city-match-km",
        type=float,
        default=DEFAULT_CITY_MATCH_KM,
        help=f"Threshold for city-center collapse detection (default {DEFAULT_CITY_MATCH_KM} km).",
    )
    parser.add_argument(
        "--min-change-km",
        type=float,
        default=DEFAULT_MIN_CHANGE_KM,
        help=f"Minimum coordinate delta required for update (default {DEFAULT_MIN_CHANGE_KM} km).",
    )
    parser.add_argument(
        "--max-anchor-drift-km",
        type=float,
        default=120.0,
        help="Reject geocode result if it is too far from anchor city token in location text.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    backfill(
        dry_run=not args.apply,
        mode=args.mode,
        batch_size=args.batch_size,
        max_rows=args.max_rows,
        start_id=args.start_id,
        sleep_seconds=args.sleep_seconds,
        city_match_km=args.city_match_km,
        min_change_km=args.min_change_km,
        max_anchor_drift_km=args.max_anchor_drift_km,
    )
