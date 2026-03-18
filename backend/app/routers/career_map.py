from __future__ import annotations

import unicodedata
from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..matching_engine.role_taxonomy import (
    DOMAIN_KEYWORDS,
    ROLE_FAMILY_KEYWORDS,
    ROLE_FAMILY_RELATIONS,
    TAXONOMY_VERSION,
)

router = APIRouter()


def _normalize_text(value: str) -> str:
    text = (value or "").lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text


def _keyword_hits(normalized_text: str, keywords: List[str]) -> int:
    if not normalized_text or not keywords:
        return 0
    hits = 0
    for keyword in keywords:
        if keyword and keyword in normalized_text:
            hits += 1
    return hits


def _rank_keyword_map(normalized_text: str, key_to_keywords: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    """
    Rank by keyword hit counts, with a deterministic tiebreaker.

    We prefer:
    1) more hits
    2) longer matched keywords (more specific phrases)
    3) stable key order (lexicographic)
    """
    counts: Dict[str, int] = {}
    max_len: Dict[str, int] = {}
    best = 0
    for key, keywords in key_to_keywords.items():
        if not keywords:
            continue
        count = 0
        best_len = 0
        for keyword in keywords:
            if not keyword:
                continue
            if keyword in normalized_text:
                count += 1
                best_len = max(best_len, len(keyword))
        if count <= 0:
            continue
        counts[key] = count
        max_len[key] = best_len
        if count > best:
            best = count

    if not counts:
        return []

    denom = float(best or 1)
    ranked = sorted(
        counts.items(),
        key=lambda item: (item[1], max_len.get(item[0], 0), item[0]),
        reverse=True,
    )
    return [{"key": key, "score": round(count / denom, 4)} for key, count in ranked]


class CareerMapTaxonomyResponse(BaseModel):
    taxonomy_version: str
    role_families: List[str]
    role_family_relations: Dict[str, Dict[str, float]]


@router.get("/api/career-map/taxonomy", response_model=CareerMapTaxonomyResponse)
async def career_map_taxonomy() -> CareerMapTaxonomyResponse:
    role_families = sorted(set(ROLE_FAMILY_KEYWORDS.keys()) | set(ROLE_FAMILY_RELATIONS.keys()))
    return CareerMapTaxonomyResponse(
        taxonomy_version=TAXONOMY_VERSION,
        role_families=role_families,
        role_family_relations=ROLE_FAMILY_RELATIONS,
    )


class CareerMapInferJob(BaseModel):
    id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    required_skills: Optional[List[str]] = None


class CareerMapInferRequest(BaseModel):
    jobs: List[CareerMapInferJob] = Field(default_factory=list)


class CareerMapKeyScore(BaseModel):
    key: str
    score: float


class CareerMapInferJobResult(BaseModel):
    id: str
    role_families: List[CareerMapKeyScore]
    primary_role_family: Optional[str] = None
    domains: List[CareerMapKeyScore]
    primary_domain: Optional[str] = None


class CareerMapInferMeta(BaseModel):
    taxonomy_version: str


class CareerMapInferResponse(BaseModel):
    meta: CareerMapInferMeta
    jobs: List[CareerMapInferJobResult]


@router.post("/api/career-map/infer", response_model=CareerMapInferResponse)
async def career_map_infer(payload: CareerMapInferRequest) -> CareerMapInferResponse:
    results: List[CareerMapInferJobResult] = []
    for job in payload.jobs or []:
        skills_text = " ".join((job.required_skills or [])[:40])
        joined = " ".join([job.title or "", job.description or "", skills_text]).strip()
        normalized = _normalize_text(joined)

        role_families_raw = _rank_keyword_map(normalized, ROLE_FAMILY_KEYWORDS)[:6]
        domains_raw = _rank_keyword_map(normalized, DOMAIN_KEYWORDS)[:6]

        role_families = [CareerMapKeyScore(**row) for row in role_families_raw]
        domains = [CareerMapKeyScore(**row) for row in domains_raw]

        primary_role_family = role_families[0].key if role_families else None
        primary_domain = domains[0].key if domains else None

        results.append(
            CareerMapInferJobResult(
                id=job.id,
                role_families=role_families,
                primary_role_family=primary_role_family,
                domains=domains,
                primary_domain=primary_domain,
            )
        )

    return CareerMapInferResponse(
        meta=CareerMapInferMeta(taxonomy_version=TAXONOMY_VERSION),
        jobs=results,
    )
