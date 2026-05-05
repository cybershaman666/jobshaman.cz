import json
import math
import re
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.domains.identity.service import IdentityDomainService
from app.domains.reality.service import RealityDomainService
from app.domains.recommendation.learning import LifecycleBackprop
from app.services.embedding_service import EmbeddingService, build_candidate_embedding_text

logger = __import__("logging").getLogger(__name__)


def _tokens(value: Any) -> set[str]:
    normalized = re.sub(r"[^a-z0-9á-ž]+", " ", str(value or "").lower())
    return {part for part in normalized.split() if len(part) > 2}


def _safe_json(value: Any, fallback: Any) -> Any:
    if isinstance(value, (dict, list)):
        return value
    if not value:
        return fallback
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return fallback


def _normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _normalize_country(value: Any) -> str:
    raw = _normalize_text(value).upper()
    aliases = {
        "CZECHIA": "CZ",
        "CZECH REPUBLIC": "CZ",
        "ČESKÁ REPUBLIKA": "CZ",
        "CESKA REPUBLIKA": "CZ",
        "SLOVAKIA": "SK",
        "SLOVENSKO": "SK",
        "GERMANY": "DE",
        "DEUTSCHLAND": "DE",
        "AUSTRIA": "AT",
        "ÖSTERREICH": "AT",
        "OSTERREICH": "AT",
        "POLAND": "PL",
        "POLSKA": "PL",
    }
    if raw in {"CZ", "SK", "DE", "AT", "PL"}:
        return raw
    return aliases.get(raw, "")


def _infer_country(job: Dict[str, Any]) -> str:
    explicit = _normalize_country(job.get("country_code"))
    if explicit:
        return explicit
    payload = job.get("payload_json") if isinstance(job.get("payload_json"), dict) else {}
    explicit = _normalize_country(payload.get("country_code") or payload.get("country"))
    if explicit:
        return explicit
    haystack = _normalize_text(" ".join(str(job.get(key) or "") for key in ("location", "title", "source", "url")))
    if re.search(r"\b(germany|deutschland|berlin|munich|münchen|hamburg|frankfurt)\b", haystack):
        return "DE"
    if re.search(r"\b(austria|österreich|osterreich|vienna|wien|linz|graz)\b", haystack):
        return "AT"
    if re.search(r"\b(slovakia|slovensko|bratislava|kosice|košice)\b", haystack):
        return "SK"
    if re.search(r"\b(poland|polska|warsaw|warszawa|krakow|kraków)\b", haystack):
        return "PL"
    return "CZ"


def _work_model(job: Dict[str, Any]) -> str:
    raw = _normalize_text(" ".join(str(job.get(key) or "") for key in ("work_model", "work_type", "location", "title", "description")))
    if "remote" in raw or "home office" in raw or "homeoffice" in raw:
        return "remote"
    if "hybrid" in raw or "hybridní" in raw or "hybridni" in raw:
        return "hybrid"
    return "on_site"


def _as_number(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        number = float(value)
        if math.isnan(number):
            return None
        return number
    except (TypeError, ValueError):
        return None


def _distance_km(lat1: Any, lon1: Any, lat2: Any, lon2: Any) -> Optional[float]:
    values = [_as_number(lat1), _as_number(lon1), _as_number(lat2), _as_number(lon2)]
    if any(value is None for value in values):
        return None
    a_lat, a_lon, b_lat, b_lon = [float(value) for value in values]
    if (b_lat == 0 and b_lon == 0) or (a_lat == 0 and a_lon == 0):
        return None
    radius = 6371.0
    d_lat = math.radians(b_lat - a_lat)
    d_lon = math.radians(b_lon - a_lon)
    root = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(a_lat)) * math.cos(math.radians(b_lat)) * math.sin(d_lon / 2) ** 2
    )
    return radius * 2 * math.atan2(math.sqrt(root), math.sqrt(1 - root))


def _extract_candidate_preferences(profile: Optional[Dict[str, Any]], preferences: Dict[str, Any]) -> Dict[str, Any]:
    search_profile = preferences.get("searchProfile") if isinstance(preferences.get("searchProfile"), dict) else {}
    tax_profile = preferences.get("taxProfile") if isinstance(preferences.get("taxProfile"), dict) else {}
    jhi_preferences = preferences.get("jhiPreferences") if isinstance(preferences.get("jhiPreferences"), dict) else {}
    hard_constraints = jhi_preferences.get("hardConstraints") if isinstance(jhi_preferences.get("hardConstraints"), dict) else {}
    coordinates = preferences.get("coordinates") if isinstance(preferences.get("coordinates"), dict) else {}
    domestic_country = (
        _normalize_country(preferences.get("preferredCountryCode"))
        or _normalize_country(tax_profile.get("countryCode"))
        or "CZ"
    )
    return {
        "domestic_country": domestic_country,
        "near_border": bool(search_profile.get("nearBorder")),
        "wants_remote": bool(search_profile.get("wantsRemoteRoles")) or hard_constraints.get("mustRemote") is True,
        "must_remote": hard_constraints.get("mustRemote") is True,
        "preferred_work": search_profile.get("preferredWorkArrangement"),
        "remote_languages": {str(item).lower() for item in (search_profile.get("remoteLanguageCodes") or []) if item},
        "target_role": str(search_profile.get("targetRole") or search_profile.get("inferredTargetRole") or "").strip(),
        "primary_domain": search_profile.get("primaryDomain") or search_profile.get("inferredPrimaryDomain"),
        "secondary_domains": set(search_profile.get("secondaryDomains") or []),
        "avoid_domains": set(search_profile.get("avoidDomains") or []),
        "include_adjacent": search_profile.get("includeAdjacentDomains") is not False,
        "max_distance_km": _as_number(search_profile.get("defaultMaxDistanceKm")),
        "commute_filter": bool(search_profile.get("defaultEnableCommuteFilter")),
        "max_commute_minutes": _as_number(hard_constraints.get("maxCommuteMinutes")),
        "min_net_monthly": _as_number(hard_constraints.get("minNetMonthly")),
        "candidate_lat": coordinates.get("lat"),
        "candidate_lon": coordinates.get("lon") or coordinates.get("lng"),
        "profile_location": profile.get("location") if profile else "",
    }


DOMAIN_KEYWORDS: Dict[str, set[str]] = {
    "it": {"developer", "engineer", "software", "python", "java", "javascript", "cloud", "devops", "data", "backend", "frontend", "ai", "ml", "platform"},
    "engineering": {"konstruktér", "elektro", "mechanik", "automation", "strojírenství", "cad", "vývoj", "technika"},
    "design": {"designer", "design", "ux", "ui", "figma", "product designer", "visual", "grafik"},
    "product": {"product", "owner", "roadmap", "discovery", "manager", "projekt"},
    "sales": {"sales", "obchod", "account", "business development", "vertrieb", "akvizice"},
    "operations": {"operations", "logistics", "supply", "coordinator", "provoz", "logistika", "nákup"},
    "care": {"support", "care", "customer", "service", "péče", "pece", "podpora"},
    "craft": {"svářeč", "svářet", "obráběč", "zámečník", "instalatér", "elektrikář", "technik", "dílna", "stroje", "montáž", "cnc"},
    "education": {"učitel", "lektor", "pedagog", "trénink", "škola", "školka", "vzdělávání", "akademie", "pedago"},
    "transport": {"řidič", "bus", "autobus", "kamion", "lkw", "truck", "doprava", "přeprava", "kurýr"},
    "frontline": {"warehouse", "sklad", "retail", "výroba", "vyroba", "prodavač", "pokladní", "obsluha", "gastronom", "hotel"},
}


def _infer_domain(job_text: str) -> str:
    best_domain = "general"
    best_hits = 0
    for domain, keywords in DOMAIN_KEYWORDS.items():
        hits = sum(1 for keyword in keywords if keyword in job_text)
        if hits > best_hits:
            best_domain = domain
            best_hits = hits
    return best_domain


def _clamp_score(value: float) -> float:
    return round(max(0, min(100, value)), 2)


def _list_from_json(value: Any) -> List[str]:
    parsed = _safe_json(value, [])
    if not isinstance(parsed, list):
        return []
    return [str(item).strip() for item in parsed if str(item or "").strip()]


def _contains_any(text: str, patterns: set[str]) -> bool:
    return any(pattern in text for pattern in patterns)


def _component(
    label: str,
    score: float,
    evidence: Optional[List[str]] = None,
    caveats: Optional[List[str]] = None,
) -> Dict[str, Any]:
    return {
        "label": label,
        "score": _clamp_score(score),
        "evidence": evidence or [],
        "caveats": caveats or [],
    }


class RecommendationDomainService:
    # Optimization: simple in-memory cache
    FEED_CACHE: Dict[str, Dict[str, Any]] = {}
    TOKEN_CACHE: Dict[str, set[str]] = {}
    CACHE_TTL_SECONDS = 300  # 5 minutes

    FIT_WEIGHTS = {
        "alpha_skill": 0.38,
        "beta_evidence": 0.18,
        "gamma_growth": 0.18,
        "delta_values": 0.26,
        "lambda_risk": 0.32,
        "calibration": 8,
    }

    # Intent assignment thresholds
    INTENT_THRESHOLDS = {
        "safe_match_min": 72,
        "stretch_match_min": 55,
        "growth_path_growth_bonus": 60,
        "income_now_salary_present": True,
    }

    @staticmethod
    async def build_candidate_feed(user_id: str, limit: int = 60) -> Dict[str, Any]:
        """
        Hybrid retrieval pipeline with caching:
          1. Check cache for recent results
          2. Build candidate profile representation
          3. Vector recall via pgvector (semantic similarity)
          4. Keyword fallback for jobs without embeddings
          5. Rule-based scoring (skill-first formula)
          6. Intent assignment per item
          7. Feed sectioning for structured UI display
        """
        # --- Step -1: Check Cache ---
        now = time.time()
        cached = RecommendationDomainService.FEED_CACHE.get(user_id)
        if cached and (now - cached["timestamp"] < RecommendationDomainService.CACHE_TTL_SECONDS):
            # Only return if limit matches or is smaller (simple cache policy)
            if cached.get("limit", 0) >= limit:
                logger.info("Serving cached recommendation feed for user %s", user_id)
                return cached["data"]

        # --- Step 0: Gather candidate data ---
        profile = await IdentityDomainService.get_candidate_profile(user_id)
        signals = await IdentityDomainService.list_identity_signals(user_id)
        preferences = _safe_json(profile.get("preferences") if profile else None, {})
        candidate_preferences = _extract_candidate_preferences(profile, preferences)

        # Build candidate text for both token matching and embedding
        candidate_text = " ".join(
            [
                profile.get("full_name") if profile else "",
                profile.get("bio") if profile else "",
                profile.get("location") if profile else "",
                " ".join(_list_from_json(profile.get("skills") if profile else None)),
                json.dumps(preferences, ensure_ascii=False),
                " ".join(
                    [
                        signal.get("signalKey", "")
                        + " "
                        + json.dumps(signal.get("signalValue") or {}, ensure_ascii=False)
                        for signal in signals
                    ]
                ),
            ]
        )
        candidate_tokens = _tokens(candidate_text)

        personalized_weights_model = await LifecycleBackprop.get_user_weights(user_id)
        personalized_weights = {
            "alpha_skill": personalized_weights_model.alpha_skill,
            "beta_evidence": personalized_weights_model.beta_evidence,
            "gamma_growth": personalized_weights_model.gamma_growth,
            "delta_values": personalized_weights_model.delta_values,
            "lambda_risk": personalized_weights_model.lambda_risk,
            "calibration": personalized_weights_model.calibration,
        }

        # --- Step 1: Hybrid retrieval ---
        retrieval_mode = "keyword"  # default fallback
        vector_jobs: List[Dict[str, Any]] = []

        # Try vector recall first
        try:
            embedded_count = await EmbeddingService.count_embedded_jobs()
            if embedded_count >= 50:  # Minimum threshold for meaningful vector search
                candidate_embedding = await EmbeddingService.embed_candidate_profile(
                    user_id=user_id,
                    profile=profile,
                    signals=signals,
                    preferences=preferences,
                )
                # Check embedding is non-zero (not a fallback)
                if any(v != 0.0 for v in candidate_embedding[:10]):
                    vector_jobs = await EmbeddingService.vector_recall(
                        candidate_embedding=candidate_embedding,
                        limit=400,
                        domestic_country=candidate_preferences["domestic_country"],
                        include_foreign=candidate_preferences["near_border"],
                    )
                    if vector_jobs:
                        retrieval_mode = "hybrid"
                        logger.info(
                            "Vector recall returned %d candidates for user %s (embedded pool: %d)",
                            len(vector_jobs), user_id, embedded_count,
                        )
        except Exception as vector_exc:
            logger.warning("Vector recall failed, falling back to keyword: %s", vector_exc)

        # Keyword-based retrieval (always runs as supplement or sole source)
        keyword_jobs = await RealityDomainService.list_recommendation_candidate_jobs(
            domestic_country=candidate_preferences["domestic_country"],
            domestic_limit=900 if retrieval_mode == "keyword" else 400,
            foreign_limit=(700 if candidate_preferences["near_border"] else 320) if retrieval_mode == "keyword" else 200,
        )

        # Merge: vector jobs first (already semantically ranked), then keyword backfill
        seen_ids: set[str] = set()
        merged_jobs: List[Dict[str, Any]] = []
        for job in vector_jobs:
            job_id = str(job.get("id", ""))
            if job_id and job_id not in seen_ids:
                seen_ids.add(job_id)
                merged_jobs.append(job)
        for job in keyword_jobs:
            job_id = str(job.get("id", ""))
            if job_id and job_id not in seen_ids:
                seen_ids.add(job_id)
                merged_jobs.append(job)

        # --- Step 2: Rule-based scoring ---
        scored = [
            RecommendationDomainService._score_job(
                job, candidate_tokens, preferences, candidate_preferences, personalized_weights
            )
            for job in merged_jobs
        ]
        scored = [item for item in scored if item["fit_score"] >= 15]

        # Boost vector-recalled items: if a job was found via semantic search,
        # it gets a small bonus reflecting non-obvious relevance
        vector_id_set = {str(j.get("id", "")) for j in vector_jobs}
        for item in scored:
            job_id = str(item["job"].get("id", ""))
            if job_id in vector_id_set:
                similarity = next(
                    (j.get("vector_similarity", 0) for j in vector_jobs if str(j.get("id")) == job_id),
                    0,
                )
                # Add up to 8 points based on semantic similarity
                vector_bonus = round(similarity * 8, 2)
                item["fit_score"] = _clamp_score(item["fit_score"] + vector_bonus)
                item["retrieval_source"] = "vector"
                item["vector_similarity"] = round(similarity, 4)
            else:
                item["retrieval_source"] = "keyword"

        # Deduplicate by content (Title + Company + Location)
        seen_content: set[str] = set()
        unique_scored: List[Dict[str, Any]] = []
        for item in scored:
            job = item["job"]
            content_key = f"{str(job.get('title', '')).lower()}|{str(job.get('company_name', '')).lower()}|{str(job.get('location', '')).lower()}"
            if content_key in seen_content:
                continue
            seen_content.add(content_key)
            unique_scored.append(item)

        unique_scored.sort(key=lambda item: item["fit_score"], reverse=True)

        # --- Step 3: Intent assignment ---
        for item in unique_scored:
            item["intent"] = RecommendationDomainService._assign_intent(item)

        # --- Step 4: Feed balancing + sectioning ---
        limited = RecommendationDomainService._balanced_feed(
            unique_scored,
            limit=max(1, min(limit, 500)),
            candidate_preferences=candidate_preferences,
        )
        sections = RecommendationDomainService._section_feed(limited)

        snapshot_id = await RecommendationDomainService._store_snapshot(
            user_id=user_id,
            ranked_ids=[item["job"]["id"] for item in limited],
            preferences=preferences,
            signal_count=len(signals),
            recommendation_breakdowns=[
                {
                    "job_id": str(item["job"].get("id")),
                    "fit_score": item["fit_score"],
                    "fit_breakdown": item.get("fit_breakdown", {}),
                    "risk_flags": item.get("risk_flags", []),
                    "eligibility_status": item.get("eligibility_status"),
                    "intent": item.get("intent"),
                    "retrieval_source": item.get("retrieval_source"),
                }
                for item in limited
            ],
        )

        result_data = {
            "snapshot_id": snapshot_id,
            "algorithm_version": RecommendationDomainService.ALGORITHM_VERSION,
            "source": "jobs_nf",
            "retrieval_mode": retrieval_mode,
            "items": limited,
            "sections": sections,
            "total_count": len(scored),
            "vector_recall_count": len(vector_jobs),
        }

        # Store in cache
        RecommendationDomainService.FEED_CACHE[user_id] = {
            "timestamp": now,
            "limit": limit,
            "data": result_data
        }

        return result_data

    @staticmethod
    async def trigger_match_notifications(user_id: str):
        """
        Runs matching and sends notifications for new high-fit roles.
        This would be called by a background worker after scraping/matching finishes.
        """
        # 1. Build the feed to get current scores
        feed = await RecommendationDomainService.build_candidate_feed(user_id, limit=20)
        items = feed.get("items", [])
        
        # 2. Filter for very high matches
        high_matches = [item for item in items if item["fit_score"] >= 85]
        
        # 3. Check existing notifications to avoid duplicates
        existing = await IdentityDomainService.list_notifications(user_id, limit=20)
        existing_titles = {n["title"] for n in existing}

        for match in high_matches[:3]:
            job = match["job"]
            title = "Nová shoda nalezena! 🚀"
            # More specific title to help dedup
            job_title = f"Nová shoda: {job['title']}" 
            
            if job_title in existing_titles:
                continue

            await IdentityDomainService.create_notification(user_id, {
                "title": job_title,
                "content": f"Pozice u firmy {job['company_name']} ti skvěle sedí ({match['fit_score']}%).",
                "type": "match",
                "link": "/candidate/marketplace"
            })

    @staticmethod
    def _score_job(
        job: Dict[str, Any],
        candidate_tokens: set[str],
        preferences: Dict[str, Any],
        candidate_preferences: Dict[str, Any],
        personalized_weights: Dict[str, float] = None,
    ) -> Dict[str, Any]:
        job_id = str(job.get("id") or "")
        
        # Optimization: cache tokens to avoid expensive regex/string ops in large loops
        if job_id and job_id in RecommendationDomainService.TOKEN_CACHE:
            job_tokens = RecommendationDomainService.TOKEN_CACHE[job_id]
        else:
            job_text = " ".join(
                [
                    job.get("title") or "",
                    job.get("company_name") or "",
                    job.get("summary") or "",
                    job.get("description") or "",
                    " ".join(job.get("tags") or []),
                    " ".join(job.get("benefits") or []),
                ]
            )
            job_tokens = _tokens(job_text)
            if job_id:
                # Keep cache size reasonable
                if len(RecommendationDomainService.TOKEN_CACHE) > 5000:
                    RecommendationDomainService.TOKEN_CACHE.clear()
                RecommendationDomainService.TOKEN_CACHE[job_id] = job_tokens

        normalized_job_text = _normalize_text(" ".join([job.get("title") or "", job.get("description") or ""]))
        overlap = len(candidate_tokens.intersection(job_tokens))
        overlap_score = min(30, overlap * 4)

        country = _infer_country(job)
        domestic_country = candidate_preferences["domestic_country"]
        is_domestic = country == domestic_country
        near_border = candidate_preferences["near_border"]
        eligibility_status = "eligible" if is_domestic or near_border else "needs_confirmation"

        model = _work_model(job)
        language = str(job.get("language_code") or "").lower()

        target_role = _normalize_text(candidate_preferences.get("target_role"))
        target_overlap = 0
        if target_role:
            target_tokens = _tokens(target_role)
            title_tokens = _tokens(job.get("title") or "")
            target_overlap = len(target_tokens.intersection(title_tokens))

        domain = _infer_domain(normalized_job_text)
        primary_domain = candidate_preferences.get("primary_domain")
        domain_alignment = "unknown"
        if primary_domain:
            if domain == primary_domain:
                domain_alignment = "primary"
            elif domain in candidate_preferences["secondary_domains"]:
                domain_alignment = "secondary"
            elif domain in candidate_preferences["avoid_domains"]:
                domain_alignment = "avoid"
                eligibility_status = "needs_confirmation"
            elif not candidate_preferences["include_adjacent"]:
                domain_alignment = "outside_allowed"
            else:
                domain_alignment = "adjacent"

        distance = _distance_km(
            candidate_preferences.get("candidate_lat"),
            candidate_preferences.get("candidate_lon"),
            job.get("lat"),
            job.get("lng"),
        )
        distance_status = "unknown"
        if distance is not None and model != "remote":
            max_distance = candidate_preferences.get("max_distance_km")
            if max_distance and distance <= max_distance:
                distance_status = "inside_radius"
            elif max_distance and distance > max_distance:
                distance_status = "outside_radius"
                if candidate_preferences.get("commute_filter"):
                    eligibility_status = "needs_confirmation"
            else:
                distance_status = "known_no_radius"
        elif distance is None and model != "remote":
            distance_status = "missing"

        if job.get("legality_status") == "illegal":
            eligibility_status = "needs_confirmation"

        fit = RecommendationDomainService._build_skill_first_breakdown(
            job=job,
            normalized_job_text=normalized_job_text,
            overlap=overlap,
            overlap_score=overlap_score,
            target_overlap=target_overlap,
            target_role=target_role,
            domain_alignment=domain_alignment,
            country=country,
            is_domestic=is_domestic,
            model=model,
            language=language,
            distance=distance,
            distance_status=distance_status,
            candidate_preferences=candidate_preferences,
            weights=personalized_weights or RecommendationDomainService.FIT_WEIGHTS,
        )
        score = fit["final_score"]
        job = {
            **job,
            "recommendation_country": country,
            "recommendation_work_model": model,
            "recommendation_domain": domain,
            "recommendation_distance_km": round(distance, 1) if distance is not None else None,
        }
        return {
            "job": job,
            "fit_score": score,
            "reasons": fit["reasons"][:4],
            "caveats": fit["caveats"][:4],
            "risk_flags": fit["risk_flags"][:8],
            "fit_breakdown": fit["components"],
            "debug_formula": fit["formula"],
            "eligibility_status": eligibility_status if score >= 45 else "needs_confirmation",
        }

    @staticmethod
    def _build_skill_first_breakdown(
        job: Dict[str, Any],
        normalized_job_text: str,
        overlap: int,
        overlap_score: float,
        target_overlap: int,
        target_role: str,
        domain_alignment: str,
        country: str,
        is_domestic: bool,
        model: str,
        language: str,
        distance: Optional[float],
        distance_status: str,
        candidate_preferences: Dict[str, Any],
        weights: Dict[str, float],
    ) -> Dict[str, Any]:
        reasons: List[str] = []
        caveats: List[str] = []
        risk_flags: List[str] = []

        skill_evidence: List[str] = []
        skill_caveats: List[str] = []
        skill_score = 34 + overlap_score
        if overlap:
            skill_evidence.append("Profilove signaly se prekryvaji s realnymi pozadavky role")
        else:
            skill_caveats.append("Skill match stoji hlavne na kontextu, ne na prokazanych schopnostech")
            risk_flags.append("low_demonstrated_capability")
        if target_role:
            if target_overlap:
                skill_score += min(18, target_overlap * 6)
                skill_evidence.append("Nazev role odpovida cilove trajektorii")
            else:
                skill_score -= 8
                skill_caveats.append("Nazev role se miji s cilovou roli")
        if domain_alignment == "primary":
            skill_score += 12
            skill_evidence.append("Domena role odpovida hlavni profilove oblasti")
        elif domain_alignment == "secondary":
            skill_score += 7
            skill_evidence.append("Domena role odpovida sekundarni profilove oblasti")
        elif domain_alignment == "avoid":
            skill_score -= 28
            skill_caveats.append("Domena role je v seznamu vyhnout se")
            risk_flags.append("avoided_domain")
        elif domain_alignment == "outside_allowed":
            skill_score -= 12
            skill_caveats.append("Domena role je mimo povolene sousedni oblasti")

        evidence_score = 46
        evidence: List[str] = []
        evidence_caveats: List[str] = []
        description_length = len(normalized_job_text)
        if job.get("salary_from") or job.get("salary_to"):
            evidence_score += 14
            evidence.append("Role ma uvedene mzdove rozpeti")
        else:
            evidence_score -= 10
            evidence_caveats.append("Role nema uvedenou mzdu")
            risk_flags.append("missing_salary")
        if description_length > 1200:
            evidence_score += 12
            evidence.append("Popis role ma dost kontextu pro rozhodovani")
        elif description_length < 350:
            evidence_score -= 12
            evidence_caveats.append("Popis role je prilis kratky pro vysokou jistotu")
            risk_flags.append("thin_role_description")
        if job.get("tags"):
            evidence_score += 5
        if job.get("benefits"):
            evidence_score += 4
        if job.get("verification_notes"):
            evidence_score += 8
            evidence.append("Nabidka ma verifikacni poznamky")
        if job.get("source_kind") in {"native", "company"}:
            evidence_score += 7
        elif job.get("source_kind") in {"jobs_nf", "imported"}:
            evidence_score -= 2

        growth_score = 44
        growth_evidence: List[str] = []
        growth_caveats: List[str] = []
        growth_positive = {
            "mentor", "mentoring", "learning", "training", "skoleni", "školení", "certifikac",
            "growth", "rozvoj", "career path", "junior", "trainee", "academy", "upskill",
        }
        growth_dead_end = {"routine", "rutina", "repetitive", "monotonn", "dead end", "bez rozvoje"}
        if _contains_any(normalized_job_text, growth_positive):
            growth_score += 20
            growth_evidence.append("Role obsahuje signal uceni nebo dalsiho rozvoje")
        if _contains_any(normalized_job_text, growth_dead_end):
            growth_score -= 16
            growth_caveats.append("Text role naznacuje rutinni nebo uzavrenou praci")
            risk_flags.append("growth_dead_end")
        if domain_alignment in {"adjacent", "secondary"} and candidate_preferences.get("include_adjacent"):
            growth_score += 10
            growth_evidence.append("Role muze byt rozumny sousedni krok")
        if target_role and not target_overlap and overlap >= 2:
            growth_score += 6
            growth_evidence.append("Role muze byt stretch match mimo presny titulek")

        values_score = 48
        values_evidence: List[str] = []
        values_caveats: List[str] = []
        preferred_work = str(candidate_preferences.get("preferred_work") or "").lower()
        wants_remote = candidate_preferences["wants_remote"]
        if is_domestic:
            values_score += 18
            values_evidence.append("Domaci trh odpovida profilu kandidata")
        elif candidate_preferences["near_border"]:
            values_score -= 8
            values_caveats.append(f"Preshranicni role ({country}) vyzaduje overeni reality")
            risk_flags.append("cross_border_reality")
        else:
            values_score -= 32
            values_caveats.append(f"Mimo domaci trh ({country}) a preshranicni hledani neni zapnute")
            risk_flags.append("outside_domestic_market")
        if model == "remote":
            if candidate_preferences.get("must_remote") or preferred_work == "remote":
                values_score += 12
                values_evidence.append("Remote odpovida explicitni preferenci")
            elif wants_remote:
                values_score += 5
                values_evidence.append("Remote je povoleny, ale neni jediny rezim")
            else:
                values_score -= 12
                values_caveats.append("Remote role nema explicitni podporu v profilu")
                risk_flags.append("remote_context_mismatch")
        elif model == "hybrid":
            values_score += 5
            values_evidence.append("Hybrid drzi cast osobniho kontextu")
        if preferred_work:
            if preferred_work in model or (preferred_work == "on_site" and model == "on_site"):
                values_score += 8
                values_evidence.append("Pracovni model odpovida preferenci")
            else:
                values_score -= 7
                values_caveats.append("Pracovni model neni presna preference")
                risk_flags.append("work_model_mismatch")
        remote_languages = candidate_preferences["remote_languages"]
        if model == "remote" and language and remote_languages and language not in remote_languages and not is_domestic:
            values_score -= 14
            values_caveats.append(f"Remote jazyk {language.upper()} neni v preferovanych jazycich")
            risk_flags.append("remote_language_mismatch")
        if distance_status == "inside_radius":
            values_score += 12
            values_evidence.append(f"Role je v dojezdovem radiusu ({round(distance or 0)} km)")
        elif distance_status == "outside_radius":
            values_score -= 18
            values_caveats.append(f"Role je mimo radius ({round(distance or 0)} km)")
            risk_flags.append("commute_drag")
        elif distance_status == "missing":
            values_score -= 5
            values_caveats.append("Chybi presna data pro dojezd")
            risk_flags.append("missing_commute_data")

        risk_score = 8
        risk_caveats: List[str] = []
        if "missing_salary" in risk_flags:
            risk_score += 10
        if "thin_role_description" in risk_flags:
            risk_score += 12
        if "outside_domestic_market" in risk_flags:
            risk_score += 28
        if "commute_drag" in risk_flags:
            risk_score += 18
        if "remote_language_mismatch" in risk_flags:
            risk_score += 16
        if "avoided_domain" in risk_flags:
            risk_score += 30
        if job.get("legality_status") == "illegal":
            risk_score += 35
            risk_flags.append("legal_risk")
            risk_caveats.append("Role je oznacena jako pravni riziko")
        if not job.get("lat") and model != "remote":
            risk_score += 5
        if risk_flags:
            risk_caveats.extend(risk_flags[:4])

        components = {
            "skill_match": _component("S(c,j) skill match", skill_score, skill_evidence, skill_caveats),
            "evidence_quality": _component("E(c,j) evidence quality", evidence_score, evidence, evidence_caveats),
            "growth_potential": _component("G(c,j) growth potential", growth_score, growth_evidence, growth_caveats),
            "values_alignment": _component("V(c,j) values/context alignment", values_score, values_evidence, values_caveats),
            "risk_penalty": _component("R(c,j) risk/uncertainty penalty", risk_score, [], risk_caveats),
        }
        final_score = _clamp_score(
            weights["calibration"]
            + weights["alpha_skill"] * components["skill_match"]["score"]
            + weights["beta_evidence"] * components["evidence_quality"]["score"]
            + weights["gamma_growth"] * components["growth_potential"]["score"]
            + weights["delta_values"] * components["values_alignment"]["score"]
            - weights["lambda_risk"] * components["risk_penalty"]["score"]
        )
        for key in ("skill_match", "values_alignment", "growth_potential", "evidence_quality"):
            if components[key]["evidence"]:
                reasons.append(components[key]["evidence"][0])
        for key in ("skill_match", "evidence_quality", "values_alignment", "growth_potential"):
            if components[key]["caveats"]:
                caveats.append(components[key]["caveats"][0])

        return {
            "final_score": final_score,
            "components": components,
            "formula": {
                "version": RecommendationDomainService.ALGORITHM_VERSION,
                "weights": weights,
                "expression": "H = alpha*S + beta*E + gamma*G + delta*V - lambda*R",
            },
            "reasons": reasons,
            "caveats": caveats,
            "risk_flags": list(dict.fromkeys(risk_flags)),
        }

    @staticmethod
    def _assign_intent(item: Dict[str, Any]) -> str:
        """
        Assign a recommendation intent to each scored item.
        Intent drives how the frontend communicates the recommendation.

        Intents (from RECOMMENDATION_LOGIC_V1.md Step 4):
          - safe_match: High fit across all dimensions, low risk
          - stretch_match: Good fit with some challenge/growth aspect
          - growth_path: Primarily valuable for career growth, not perfect skill match
          - income_now: Strong economic fit, quick opportunity
          - exploration: Non-obvious match, semantically interesting
          - fallback: Low confidence, included for diversity
        """
        score = item.get("fit_score", 0)
        breakdown = item.get("fit_breakdown", {})
        risk_flags = item.get("risk_flags", [])
        retrieval_source = item.get("retrieval_source", "keyword")

        skill_score = breakdown.get("skill_match", {}).get("score", 0)
        growth_score = breakdown.get("growth_potential", {}).get("score", 0)
        evidence_score = breakdown.get("evidence_quality", {}).get("score", 0)
        values_score = breakdown.get("values_alignment", {}).get("score", 0)
        risk_score = breakdown.get("risk_penalty", {}).get("score", 0)

        # Safe match: high overall score, strong evidence, low risk
        if score >= 72 and risk_score < 25 and evidence_score >= 55:
            return "safe_match"

        # Income now: salary present, decent fit, economic signals
        job = item.get("job", {})
        has_salary = bool(job.get("salary_from") or job.get("salary_to"))
        if has_salary and score >= 55 and values_score >= 50 and "missing_salary" not in risk_flags:
            # Only income_now if growth isn't the primary driver
            if growth_score < 55 or skill_score >= 50:
                return "income_now"

        # Growth path: growth score dominates, role is adjacent/stretch
        if growth_score >= 60 and score >= 45:
            if skill_score < 55 or "growth_dead_end" not in risk_flags:
                return "growth_path"

        # Stretch match: decent score, some challenge
        if score >= 55 and skill_score >= 40:
            return "stretch_match"

        # Exploration: vector-recalled but not a strong rule-based match
        if retrieval_source == "vector" and score >= 35:
            return "exploration"

        # Fallback: everything else that passed the minimum threshold
        return "fallback"

    @staticmethod
    def _section_feed(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Group scored and intent-assigned items into UI-ready sections.
        Each section has a key, label, description, and ordered items.

        Sections (from RECOMMENDATION_LOGIC_V1.md Step 7):
          1. "Přesná shoda" — safe_match items
          2. "Výzvy pro růst" — stretch_match + growth_path items
          3. "Rychlý příjem" — income_now items
          4. "Prozkoumej" — exploration items
          5. "Další příležitosti" — fallback items
        """
        section_config = [
            {
                "key": "best_matches",
                "label": "Přesná shoda",
                "description": "Role, kde se vaše schopnosti a kontext setkávají s tím, co firma reálně potřebuje.",
                "intents": {"safe_match"},
                "max_items": 8,
            },
            {
                "key": "growth_challenges",
                "label": "Výzvy pro růst",
                "description": "Role, které nabízejí krok dál — nové dovednosti, sousední doména, nebo stretch.",
                "intents": {"stretch_match", "growth_path"},
                "max_items": 10,
            },
            {
                "key": "income_now",
                "label": "Rychlý příjem",
                "description": "Ekonomicky silné nabídky s nízkou bariérou vstupu.",
                "intents": {"income_now"},
                "max_items": 8,
            },
            {
                "key": "exploration",
                "label": "Prozkoumej",
                "description": "Neočekávané shody, které jsme našli díky sémantické analýze vašeho profilu.",
                "intents": {"exploration"},
                "max_items": 6,
            },
            {
                "key": "other",
                "label": "Další příležitosti",
                "description": "Méně přesné shody, ale stojí za zvážení.",
                "intents": {"fallback"},
                "max_items": 15,
            },
        ]

        sections: List[Dict[str, Any]] = []
        used_ids: set[str] = set()

        for config in section_config:
            section_items: List[Dict[str, Any]] = []
            for item in items:
                if len(section_items) >= config["max_items"]:
                    break
                job_id = str(item.get("job", {}).get("id", ""))
                if job_id in used_ids:
                    continue
                if item.get("intent") in config["intents"]:
                    section_items.append(item)
                    used_ids.add(job_id)

            if section_items:
                sections.append({
                    "key": config["key"],
                    "label": config["label"],
                    "description": config["description"],
                    "count": len(section_items),
                    "items": section_items,
                })

        return sections

    @staticmethod
    def _balanced_feed(scored: List[Dict[str, Any]], limit: int, candidate_preferences: Dict[str, Any]) -> List[Dict[str, Any]]:
        domestic_country = candidate_preferences["domestic_country"]
        wants_remote = candidate_preferences["wants_remote"]
        must_remote = candidate_preferences.get("must_remote") or str(candidate_preferences.get("preferred_work") or "").lower() == "remote"
        near_border = candidate_preferences["near_border"]
        max_foreign = limit if near_border else max(4, int(limit * 0.15))
        if near_border:
            max_foreign = max(12, int(limit * 0.35))
        max_remote = limit if must_remote else max(8, int(limit * (0.55 if wants_remote else 0.35)))
        counts = defaultdict(int)
        selected: List[Dict[str, Any]] = []

        def can_take(item: Dict[str, Any], relaxed: bool = False) -> bool:
            job = item["job"]
            country = job.get("recommendation_country") or _infer_country(job)
            model = job.get("recommendation_work_model") or _work_model(job)
            if relaxed:
                return True
            if country != domestic_country and counts["foreign"] >= max_foreign:
                return False
            if model == "remote" and counts["remote"] >= max_remote:
                return False
            return True

        for item in scored:
            if len(selected) >= limit:
                break
            if not can_take(item):
                continue
            selected.append(item)
            country = item["job"].get("recommendation_country") or _infer_country(item["job"])
            model = item["job"].get("recommendation_work_model") or _work_model(item["job"])
            if country != domestic_country:
                counts["foreign"] += 1
            if model == "remote":
                counts["remote"] += 1

        if len(selected) < limit:
            selected_ids = {str(item["job"].get("id")) for item in selected}
            for item in scored:
                if len(selected) >= limit:
                    break
                if str(item["job"].get("id")) in selected_ids:
                    continue
                selected.append(item)

        return selected

    @staticmethod
    async def _store_snapshot(
        user_id: str,
        ranked_ids: List[str],
        preferences: Dict[str, Any],
        signal_count: int,
        recommendation_breakdowns: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        async with AsyncSession(engine) as session:
            result = await session.execute(
                text(
                    """
                    INSERT INTO recommendation_snapshots (
                      user_id,
                      feed_key,
                      algorithm_version,
                      eligibility_inputs,
                      scoring_inputs,
                      ranked_opportunity_ids
                    )
                    VALUES (
                      CAST(:user_id AS uuid),
                      'candidate_main',
                      :algorithm_version,
                      CAST(:eligibility_inputs AS jsonb),
                      CAST(:scoring_inputs AS jsonb),
                      CAST(:ranked_ids AS jsonb)
                    )
                    RETURNING id
                    """
                ),
                {
                    "user_id": user_id,
                    "algorithm_version": RecommendationDomainService.ALGORITHM_VERSION,
                    "eligibility_inputs": json.dumps({"source": "jobs_nf"}, ensure_ascii=False),
                    "scoring_inputs": json.dumps(
                        {
                            "preference_keys": sorted(preferences.keys()),
                            "signal_count": signal_count,
                            "fit_formula": {
                                "version": RecommendationDomainService.ALGORITHM_VERSION,
                                "expression": "H = alpha*S + beta*E + gamma*G + delta*V - lambda*R",
                                "weights": RecommendationDomainService.FIT_WEIGHTS,
                            },
                            "ranked_breakdowns": recommendation_breakdowns or [],
                        },
                        ensure_ascii=False,
                    ),
                    "ranked_ids": json.dumps(ranked_ids, ensure_ascii=False),
                },
            )
            snapshot_id = result.scalar_one()
            await session.commit()
            return str(snapshot_id)
