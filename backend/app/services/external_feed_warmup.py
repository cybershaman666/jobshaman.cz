from __future__ import annotations

import os
from typing import Iterable

from scraper.scraper_api_sources import search_jooble_jobs_live, search_weworkremotely_jobs_live

DEFAULT_COUNTRY_CITY_MAP: dict[str, list[str]] = {
    "CZ": ["Praha", "Brno", "Ostrava"],
    "SK": ["Bratislava", "Kosice"],
    "DE": ["Berlin", "Munich", "Hamburg"],
    "AT": ["Vienna", "Linz"],
    "PL": ["Warsaw", "Krakow", "Wroclaw"],
}

DEFAULT_QUERY_SEEDS: list[str] = [
    "software engineer",
    "project manager",
    "customer support",
    "sales",
    "marketing",
    "operations",
    "data analyst",
]


def _env_enabled(key: str, default: bool = False) -> bool:
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _parse_csv(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(",") if part and part.strip()]


def _resolve_warmup_countries() -> list[str]:
    configured = [item.upper() for item in _parse_csv(os.getenv("EXTERNAL_FEED_WARMUP_COUNTRIES"))]
    return configured or ["CZ", "SK", "DE", "AT", "PL"]


def _resolve_warmup_queries() -> list[str]:
    configured = _parse_csv(os.getenv("EXTERNAL_FEED_WARMUP_QUERIES"))
    return configured or DEFAULT_QUERY_SEEDS[:]


def _resolve_warmup_limit() -> int:
    try:
        return max(4, min(20, int(os.getenv("EXTERNAL_FEED_WARMUP_LIMIT_PER_QUERY") or "12")))
    except ValueError:
        return 12


def _resolve_country_cities(country_code: str) -> list[str]:
    env_key = f"EXTERNAL_FEED_WARMUP_CITIES_{country_code.upper()}"
    configured = _parse_csv(os.getenv(env_key))
    if configured:
        return configured
    return DEFAULT_COUNTRY_CITY_MAP.get(country_code.upper(), [])


def _iter_country_city_pairs(countries: Iterable[str]) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for country in countries:
        for city in _resolve_country_cities(country):
            pairs.append((country.upper(), city))
    return pairs


def run_external_feed_warmup() -> dict[str, int]:
    if not _env_enabled("ENABLE_EXTERNAL_FEED_WARMUP", default=False):
        print("ℹ️ External feed warmup disabled (ENABLE_EXTERNAL_FEED_WARMUP=false).")
        return {"jooble_queries": 0, "wwr_queries": 0}

    countries = _resolve_warmup_countries()
    queries = _resolve_warmup_queries()
    limit = _resolve_warmup_limit()
    city_pairs = _iter_country_city_pairs(countries)

    jooble_runs = 0
    wwr_runs = 0

    print(
        f"🔥 External feed warmup started for countries={countries}, "
        f"queries={len(queries)}, city_pairs={len(city_pairs)}, limit={limit}"
    )

    for country in countries:
        for query in queries:
            try:
                search_jooble_jobs_live(
                    limit=limit,
                    search_term=query,
                    filter_city="",
                    country_codes=[country],
                    exclude_country_codes=[],
                    page=1,
                )
                jooble_runs += 1
            except Exception as exc:
                print(f"⚠️ External warmup Jooble failed for {country}/{query}: {exc}")

    for country, city in city_pairs:
        for query in queries[: max(2, min(4, len(queries)))]:
            try:
                search_jooble_jobs_live(
                    limit=limit,
                    search_term=query,
                    filter_city=city,
                    country_codes=[country],
                    exclude_country_codes=[],
                    page=1,
                )
                jooble_runs += 1
            except Exception as exc:
                print(f"⚠️ External warmup Jooble city failed for {country}/{city}/{query}: {exc}")

    for query in queries:
        try:
            search_weworkremotely_jobs_live(
                limit=limit,
                search_term=query,
                filter_city="",
                country_codes=countries,
                exclude_country_codes=[],
            )
            wwr_runs += 1
        except Exception as exc:
            print(f"⚠️ External warmup WWR failed for {query}: {exc}")

    for country, city in city_pairs[: max(3, min(8, len(city_pairs)))]:
        try:
            search_weworkremotely_jobs_live(
                limit=limit,
                search_term="",
                filter_city=city,
                country_codes=[country],
                exclude_country_codes=[],
            )
            wwr_runs += 1
        except Exception as exc:
            print(f"⚠️ External warmup WWR city failed for {country}/{city}: {exc}")

    print(f"✅ External feed warmup finished. jooble_runs={jooble_runs}, wwr_runs={wwr_runs}")
    return {"jooble_queries": jooble_runs, "wwr_queries": wwr_runs}
