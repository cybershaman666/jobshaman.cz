"""Natural-language → structured marketplace filters parser.

Turns a free-text candidate query (e.g. "remote product role in Prague over 60k
with home office") into the structured filter shape the marketplace UI uses.

Primary path uses the shared AI orchestration client (OpenRouter/Azure). If no
model is configured or the call fails, a deterministic heuristic parser is used
so the search box always returns something usable.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Keep in sync with frontend getRoleFamilyOptions().
ROLE_FAMILIES: List[str] = [
    "engineering",
    "design",
    "product",
    "operations",
    "sales",
    "care",
    "frontline",
    "marketing",
    "finance",
    "people",
    "education",
    "health",
    "construction",
    "logistics",
    "legal",
]

WORK_ARRANGEMENTS = ["all", "remote", "hybrid", "onsite"]
DIFFICULTIES = ["all", "low", "medium", "high"]

# Keyword hints used both to build the AI prompt and to drive the fallback.
ROLE_FAMILY_KEYWORDS: Dict[str, List[str]] = {
    "engineering": ["engineer", "developer", "vyvojar", "programator", "software", "backend", "frontend", "devops", "fullstack"],
    "design": ["design", "designer", "ux", "ui", "grafik"],
    "product": ["product", "produkt", "product owner", "product manager", "po", "pm"],
    "operations": ["operations", "provoz", "operacni", "operations manager"],
    "sales": ["sales", "obchod", "obchodnik", "account", "business development"],
    "care": ["care", "pece", "pecovatel", "socialni"],
    "frontline": ["frontline", "prodavac", "sklad", "operator", "vyroba"],
    "marketing": ["marketing", "seo", "ppc", "social media", "brand"],
    "finance": ["finance", "financ", "ucetni", "controller", "analyst", "controlling"],
    "people": ["hr", "people", "recruiter", "nabor", "lidske zdroje"],
    "education": ["education", "vzdelav", "ucitel", "lektor", "teacher"],
    "health": ["health", "zdrav", "sestra", "lekar", "nurse", "doctor"],
    "construction": ["construction", "stavba", "stavebni", "remeslo", "zednik"],
    "logistics": ["logistics", "logistika", "ridic", "doprava", "driver", "warehouse"],
    "legal": ["legal", "pravo", "pravnik", "lawyer", "advokat"],
}

REMOTE_KEYWORDS = ["remote", "na dalku", "z domova", "home office", "fully remote", "100% remote"]
HYBRID_KEYWORDS = ["hybrid", "hybridni"]
ONSITE_KEYWORDS = ["onsite", "on-site", "na miste", "v kancelari", "office only"]

BENEFIT_KEYWORDS: Dict[str, List[str]] = {
    "Home office": ["home office", "z domova", "remote work"],
    "Služební auto": ["sluzebni auto", "company car", "auto"],
    "Stravenky": ["stravenky", "meal voucher", "stravenkovy"],
    "Multisport": ["multisport"],
    "Vzdělávání": ["vzdelavani", "education budget", "kurzy", "training"],
    "Flexibilní směny": ["flexibilni", "flexible hours", "flex"],
    "Příspěvek na dopravu": ["prispevek na dopravu", "transport allowance"],
    "13. plat": ["13 plat", "13. plat", "thirteenth salary"],
    "Zkrácený úvazek": ["zkraceny uvazek", "part time", "part-time", "castecny uvazek"],
    "Ubytování": ["ubytovani", "accommodation"],
    "Dog-friendly office": ["dog friendly", "dog-friendly", "pet friendly"],
    "Child friendly office": ["child friendly", "detsky koutek"],
}

DIFFICULTY_KEYWORDS: Dict[str, List[str]] = {
    "low": ["junior", "nizka narocnost", "nizka", "entry", "zacatecnik", "easy"],
    "medium": ["medior", "mid", "stredni narocnost", "stredni"],
    "high": ["senior", "lead", "vysoka narocnost", "vysoka", "expert", "principal", "head of"],
}

# Common CZ/SK/EU cities for the heuristic fallback.
KNOWN_CITIES = [
    "praha", "praze", "prague", "brno", "brne", "ostrava", "ostrave", "plzen", "plzni",
    "pilsen", "liberec", "olomouc", "ceske budejovice", "hradec kralove", "pardubice",
    "zlin", "kladno", "most", "bratislava", "kosice", "wien", "vienna", "berlin",
    "munich", "warsaw", "warszawa",
]

CITY_CANONICAL = {
    "prague": "Praha",
    "praha": "Praha",
    "praze": "Praha",
    "brno": "Brno",
    "brne": "Brno",
    "ostrava": "Ostrava",
    "ostrave": "Ostrava",
    "pilsen": "Plzeň",
    "plzen": "Plzeň",
    "plzni": "Plzeň",
    "vienna": "Wien",
    "wien": "Wien",
    "warsaw": "Warszawa",
    "warszawa": "Warszawa",
}


def _strip_accents(value: str) -> str:
    import unicodedata

    normalized = unicodedata.normalize("NFD", value)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _normalize(value: Any) -> str:
    return _strip_accents(str(value or "").lower()).strip()


def _empty_filters() -> Dict[str, Any]:
    return {
        "targetRole": "",
        "city": "",
        "roleFamily": "all",
        "workArrangement": "all",
        "remoteOnly": False,
        "minSalary": 0,
        "difficulty": "all",
        "benefits": [],
        "freeText": "",
    }


def _coerce_min_salary(value: Any) -> int:
    try:
        salary = int(round(float(value)))
    except (TypeError, ValueError):
        return 0
    return max(0, salary)


def _sanitize_filters(raw: Dict[str, Any]) -> Dict[str, Any]:
    base = _empty_filters()
    if not isinstance(raw, dict):
        return base

    target_role = str(raw.get("targetRole") or raw.get("target_role") or "").strip()
    base["targetRole"] = target_role[:120]

    city = str(raw.get("city") or "").strip()
    base["city"] = city[:120]

    role_family = _normalize(raw.get("roleFamily") or raw.get("role_family") or "all")
    base["roleFamily"] = role_family if role_family in ROLE_FAMILIES else "all"

    work = _normalize(raw.get("workArrangement") or raw.get("work_arrangement") or "all")
    if work in ("on-site", "on site"):
        work = "onsite"
    base["workArrangement"] = work if work in WORK_ARRANGEMENTS else "all"

    remote_only = raw.get("remoteOnly")
    if remote_only is None:
        remote_only = raw.get("remote_only")
    base["remoteOnly"] = bool(remote_only) or base["workArrangement"] == "remote"
    if base["remoteOnly"]:
        base["workArrangement"] = "remote"

    base["minSalary"] = _coerce_min_salary(raw.get("minSalary") or raw.get("min_salary"))

    difficulty = _normalize(raw.get("difficulty") or "all")
    base["difficulty"] = difficulty if difficulty in DIFFICULTIES else "all"

    benefits = raw.get("benefits")
    if isinstance(benefits, list):
        seen: set[str] = set()
        cleaned: List[str] = []
        for item in benefits:
            label = str(item or "").strip()
            if label and label not in seen:
                seen.add(label)
                cleaned.append(label)
        base["benefits"] = cleaned[:8]

    base["freeText"] = str(raw.get("freeText") or raw.get("free_text") or "").strip()[:200]
    return base


def heuristic_parse(query: str) -> Dict[str, Any]:
    """Deterministic, no-AI fallback parser."""
    filters = _empty_filters()
    normalized = _normalize(query)
    if not normalized:
        return filters

    # Work arrangement.
    if any(kw in normalized for kw in REMOTE_KEYWORDS):
        filters["remoteOnly"] = True
        filters["workArrangement"] = "remote"
    elif any(kw in normalized for kw in HYBRID_KEYWORDS):
        filters["workArrangement"] = "hybrid"
    elif any(kw in normalized for kw in ONSITE_KEYWORDS):
        filters["workArrangement"] = "onsite"

    # Role family.
    for family, keywords in ROLE_FAMILY_KEYWORDS.items():
        if any(kw in normalized for kw in keywords):
            filters["roleFamily"] = family
            break

    # Difficulty.
    for level, keywords in DIFFICULTY_KEYWORDS.items():
        if any(kw in normalized for kw in keywords):
            filters["difficulty"] = level
            break

    # Benefits.
    benefits: List[str] = []
    for label, keywords in BENEFIT_KEYWORDS.items():
        if any(kw in normalized for kw in keywords):
            benefits.append(label)
    filters["benefits"] = benefits

    # City.
    for city in KNOWN_CITIES:
        if re.search(rf"\b{re.escape(city)}\b", normalized):
            filters["city"] = CITY_CANONICAL.get(city, city.title())
            break

    # Min salary: handle "60k", "60 000", "over 45000", "od 50 000".
    salary = _extract_salary(normalized)
    if salary:
        filters["minSalary"] = salary

    return _sanitize_filters(filters)


def _extract_salary(normalized: str) -> int:
    # "60k" / "60 k"
    k_match = re.search(r"(\d{2,3})\s*k\b", normalized)
    if k_match:
        return int(k_match.group(1)) * 1000

    # "60 000", "60000", "45,000"
    num_match = re.search(r"(\d{1,3}(?:[ .,]\d{3})+|\d{4,6})", normalized)
    if num_match:
        digits = re.sub(r"[ .,]", "", num_match.group(1))
        try:
            value = int(digits)
        except ValueError:
            return 0
        if 1000 <= value <= 10_000_000:
            return value
    return 0


def _build_prompt(query: str, locale: str) -> str:
    families = ", ".join(ROLE_FAMILIES)
    return (
        "You convert a job seeker's free-text search into structured marketplace filters.\n"
        "Return ONLY a single minified JSON object, no prose, no code fences.\n\n"
        "Schema (use exactly these keys):\n"
        "{\n"
        '  "targetRole": string,        // the role/title the user wants, e.g. "Product Manager" (empty if none)\n'
        '  "city": string,              // city or region, empty if none\n'
        f'  "roleFamily": string,        // one of: {families}, or "all"\n'
        '  "workArrangement": string,   // one of: all, remote, hybrid, onsite\n'
        '  "remoteOnly": boolean,\n'
        '  "minSalary": number,         // monthly net salary floor in local currency, 0 if unspecified\n'
        '  "difficulty": string,        // one of: all, low, medium, high (seniority/effort)\n'
        '  "benefits": string[],        // any explicitly requested perks (e.g. "Home office", "Stravenky")\n'
        '  "freeText": string           // remaining keywords that do not map to a field\n'
        "}\n\n"
        "Rules:\n"
        "- Map seniority words (junior=low, mid=medium, senior/lead=high).\n"
        '- Interpret salary shorthand: "60k" => 60000.\n'
        "- If a value is not present, use the empty/zero/\"all\"/false default.\n"
        f"- The query language may be Czech, Slovak, German, Polish or English (locale hint: {locale}).\n\n"
        f"Query: {query}\n"
        "JSON:"
    )


def _extract_json_safe(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1:
            return None
        try:
            return json.loads(cleaned[start : end + 1])
        except Exception:
            return None


def _ai_parse(query: str, locale: str) -> Optional[Dict[str, Any]]:
    try:
        from app.ai_orchestration.client import (
            call_primary_with_fallback,
            get_default_fallback_model,
            get_default_primary_model,
        )
    except Exception as exc:  # pragma: no cover - import guard
        logger.debug("AI search parse client unavailable: %s", exc)
        return None

    primary = get_default_primary_model()
    if not primary:
        return None

    prompt = _build_prompt(query, locale)
    try:
        result, _fallback_used = call_primary_with_fallback(
            prompt,
            primary,
            get_default_fallback_model(),
            generation_config={"temperature": 0, "top_p": 1},
        )
    except Exception as exc:
        logger.info("AI search parse failed, using heuristic fallback: %s", exc)
        return None

    parsed = _extract_json_safe(result.text)
    if not isinstance(parsed, dict):
        return None
    return parsed


def parse_natural_language_search(query: str, locale: str = "cs") -> Dict[str, Any]:
    """Return structured filters for a free-text query.

    Always returns a fully-populated filter dict. Uses AI when available and
    falls back to a deterministic heuristic parser otherwise.
    """
    text = str(query or "").strip()
    if not text:
        return {**_empty_filters(), "source": "empty"}

    ai_raw = _ai_parse(text, locale)
    if ai_raw is not None:
        merged = _sanitize_filters(ai_raw)
        # Backfill anything the model missed using the heuristic parser.
        heuristic = heuristic_parse(text)
        if not merged["city"]:
            merged["city"] = heuristic["city"]
        if merged["roleFamily"] == "all":
            merged["roleFamily"] = heuristic["roleFamily"]
        if merged["minSalary"] == 0:
            merged["minSalary"] = heuristic["minSalary"]
        if merged["workArrangement"] == "all" and not merged["remoteOnly"]:
            merged["workArrangement"] = heuristic["workArrangement"]
            merged["remoteOnly"] = heuristic["remoteOnly"]
        if merged["difficulty"] == "all":
            merged["difficulty"] = heuristic["difficulty"]
        if not merged["benefits"]:
            merged["benefits"] = heuristic["benefits"]
        if not merged["targetRole"] and not merged["freeText"]:
            merged["freeText"] = text
        merged["source"] = "ai"
        return merged

    fallback = heuristic_parse(text)
    if not fallback["targetRole"] and not fallback["freeText"]:
        fallback["freeText"] = text
    fallback["source"] = "heuristic"
    return fallback
