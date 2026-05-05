"""
EmbeddingService — Semantic embedding infrastructure for JobShaman V2.

Uses Mistral's `mistral-embed` model (1024 dimensions) to generate vector
representations of candidate profiles and job opportunities. These vectors
are stored in the `jobs_nf.embedding` pgvector column and used for
semantic retrieval in the recommendation pipeline.

Architecture:
    - Candidate profile → single embedding (skills + bio + signals + preferences)
    - Job opportunity → single embedding (title + description + tags + skills)
    - Hybrid retrieval: vector recall (top-N by cosine similarity) → rule-based re-ranking

All embedding operations are logged for AI governance audit trail.
"""

import hashlib
import json
import logging
import re
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.services.mistral_client import (
    MistralClientError,
    call_mistral_embed,
)

logger = logging.getLogger(__name__)

# Maximum characters to send per text chunk to avoid token overflow.
# mistral-embed handles ~8K tokens; ~16K chars is safe with utf-8 multilingual text.
_MAX_TEXT_CHARS = 12_000

# Batch size for embedding multiple texts in one API call.
_EMBED_BATCH_SIZE = 25


def _truncate(text_value: str, limit: int = _MAX_TEXT_CHARS) -> str:
    """Truncate text to avoid exceeding embedding model token limits."""
    return text_value[:limit] if len(text_value) > limit else text_value


def _clean_for_embedding(text_value: str) -> str:
    """Normalize whitespace and strip HTML for cleaner embeddings."""
    cleaned = re.sub(r"<[^>]+>", " ", text_value)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _text_hash(text_value: str) -> str:
    """Stable hash for cache/dedup of embedding inputs."""
    return hashlib.sha256(text_value.encode("utf-8")).hexdigest()[:16]


def build_candidate_embedding_text(
    profile: Optional[Dict[str, Any]],
    signals: List[Dict[str, Any]],
    preferences: Dict[str, Any],
) -> str:
    """
    Compose a single text representation of a candidate's identity
    suitable for embedding. Combines:
    - Full name and location (context for geo-matching)
    - Bio / self-description
    - Skills list
    - Identity signals (demonstrated capabilities, not credentials)
    - Target role and domain preferences
    - JCFPM archetype if available
    """
    parts: list[str] = []

    if profile:
        if profile.get("full_name"):
            parts.append(f"Kandidát: {profile['full_name']}")
        if profile.get("location"):
            parts.append(f"Lokalita: {profile['location']}")
        if profile.get("bio"):
            parts.append(f"O mně: {profile['bio']}")

        # Skills
        skills_raw = profile.get("skills")
        if isinstance(skills_raw, str):
            try:
                skills_list = json.loads(skills_raw)
            except (json.JSONDecodeError, TypeError):
                skills_list = []
        elif isinstance(skills_raw, list):
            skills_list = skills_raw
        else:
            skills_list = []
        if skills_list:
            parts.append(f"Dovednosti: {', '.join(str(s) for s in skills_list)}")

    # Search preferences — target role, domain
    search_profile = preferences.get("searchProfile") or {}
    if search_profile.get("targetRole"):
        parts.append(f"Cílová role: {search_profile['targetRole']}")
    if search_profile.get("inferredTargetRole") and not search_profile.get("targetRole"):
        parts.append(f"Inferovaná cílová role: {search_profile['inferredTargetRole']}")
    if search_profile.get("primaryDomain"):
        parts.append(f"Primární doména: {search_profile['primaryDomain']}")
    secondary = search_profile.get("secondaryDomains") or []
    if secondary:
        parts.append(f"Sekundární domény: {', '.join(secondary)}")

    # Identity signals — the core of skill-first hiring
    for signal in signals:
        key = signal.get("signalKey") or signal.get("signal_key") or ""
        value = signal.get("signalValue") or signal.get("signal_value") or {}
        source = signal.get("sourceType") or signal.get("source_type") or ""
        if isinstance(value, dict):
            value_str = json.dumps(value, ensure_ascii=False)
        else:
            value_str = str(value)
        parts.append(f"Signál [{key}] ({source}): {value_str}")

    combined = _clean_for_embedding(" ".join(parts))
    return _truncate(combined)


def build_job_embedding_text(job: Dict[str, Any]) -> str:
    """
    Compose a single text representation of a job opportunity
    suitable for embedding. Focuses on the semantic content that
    matters for matching: what the role does, what skills are needed,
    and what the work reality looks like.
    """
    parts: list[str] = []

    if job.get("title"):
        parts.append(f"Role: {job['title']}")
    if job.get("company_name") or job.get("company"):
        parts.append(f"Firma: {job.get('company_name') or job.get('company')}")
    if job.get("location"):
        parts.append(f"Lokalita: {job['location']}")

    # Work model context
    work_model = job.get("work_model") or job.get("work_type") or ""
    if work_model:
        parts.append(f"Pracovní model: {work_model}")

    # Role summary (if curated) takes priority over raw description
    if job.get("role_summary"):
        parts.append(f"Shrnutí role: {job['role_summary']}")

    # Description — the richest signal
    description = job.get("description") or job.get("summary") or ""
    if description:
        # Truncate long descriptions but keep enough for semantic understanding
        parts.append(f"Popis: {description[:4000]}")

    # Tags and skills
    tags = job.get("tags") or []
    if isinstance(tags, list) and tags:
        parts.append(f"Tagy: {', '.join(str(t) for t in tags)}")
    benefits = job.get("benefits") or []
    if isinstance(benefits, list) and benefits:
        parts.append(f"Benefity: {', '.join(str(b) for b in benefits)}")

    # AI analysis context if available
    ai = job.get("ai_analysis")
    if isinstance(ai, dict):
        if ai.get("required_skills"):
            parts.append(f"Požadované dovednosti: {', '.join(ai['required_skills'])}")
        if ai.get("growth_signals"):
            parts.append(f"Růstové signály: {', '.join(ai['growth_signals'])}")

    combined = _clean_for_embedding(" ".join(parts))
    return _truncate(combined)


class EmbeddingService:
    """
    Service for generating, storing, and querying semantic embeddings
    using Mistral's mistral-embed model (1024 dimensions).
    """

    @staticmethod
    def embed_texts(texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for a list of texts using Mistral embed API.
        Handles batching for large input sets.

        Returns list of 1024-dimensional float vectors in input order.
        """
        if not texts:
            return []

        all_embeddings: list[list[float]] = []

        for batch_start in range(0, len(texts), _EMBED_BATCH_SIZE):
            batch = texts[batch_start : batch_start + _EMBED_BATCH_SIZE]
            # Truncate each text in the batch
            batch = [_truncate(_clean_for_embedding(t)) for t in batch]
            try:
                result = call_mistral_embed(batch)
                all_embeddings.extend(result.embeddings)
                logger.info(
                    "Embedded batch of %d texts (%d tokens, %dms)",
                    len(batch),
                    result.tokens_used,
                    result.latency_ms,
                )
            except MistralClientError as exc:
                logger.error("Embedding batch failed: %s", exc)
                # Return zero vectors as fallback so the pipeline doesn't crash
                all_embeddings.extend([[0.0] * 1024] * len(batch))

        return all_embeddings

    @staticmethod
    def embed_single(text_value: str) -> list[float]:
        """Convenience wrapper for embedding a single text."""
        results = EmbeddingService.embed_texts([text_value])
        return results[0] if results else [0.0] * 1024

    @staticmethod
    async def embed_candidate_profile(
        user_id: str,
        profile: Optional[Dict[str, Any]],
        signals: List[Dict[str, Any]],
        preferences: Dict[str, Any],
    ) -> list[float]:
        """
        Generate and return an embedding for a candidate profile.
        Does NOT store it — the recommendation engine uses it transiently
        for vector recall queries.
        """
        text_value = build_candidate_embedding_text(profile, signals, preferences)
        if not text_value.strip():
            logger.warning("Empty candidate profile text for user %s, using zero vector", user_id)
            return [0.0] * 1024

        embedding = EmbeddingService.embed_single(text_value)
        logger.info(
            "Generated candidate embedding for user %s (input hash: %s, %d chars)",
            user_id,
            _text_hash(text_value),
            len(text_value),
        )
        return embedding

    @staticmethod
    async def store_job_embedding(job_id: str, embedding: list[float]) -> bool:
        """
        Store a pre-computed embedding into the jobs_nf.embedding column.
        Returns True if successful, False otherwise.
        """
        if len(embedding) != 1024:
            logger.error("Embedding dimension mismatch: expected 1024, got %d", len(embedding))
            return False

        vector_literal = "[" + ",".join(f"{v:.8f}" for v in embedding) + "]"

        try:
            async with AsyncSession(engine) as session:
                await session.execute(
                    text("""
                        UPDATE jobs_nf
                        SET embedding = CAST(:embedding AS vector)
                        WHERE id = :job_id
                    """),
                    {"embedding": vector_literal, "job_id": job_id},
                )
                await session.commit()
            return True
        except Exception as exc:
            logger.error("Failed to store embedding for job %s: %s", job_id, exc)
            return False

    @staticmethod
    async def embed_and_store_jobs(jobs: List[Dict[str, Any]]) -> int:
        """
        Batch-embed a list of jobs and store their embeddings in the DB.
        Returns count of successfully stored embeddings.
        """
        if not jobs:
            return 0

        texts = [build_job_embedding_text(job) for job in jobs]
        embeddings = EmbeddingService.embed_texts(texts)

        stored = 0
        for job, embedding in zip(jobs, embeddings):
            job_id = str(job.get("id", ""))
            if not job_id:
                continue
            # Skip zero vectors (failed embeddings)
            if all(v == 0.0 for v in embedding[:10]):
                continue
            success = await EmbeddingService.store_job_embedding(job_id, embedding)
            if success:
                stored += 1

        logger.info("Stored embeddings for %d/%d jobs", stored, len(jobs))
        return stored

    @staticmethod
    async def vector_recall(
        candidate_embedding: list[float],
        limit: int = 200,
        domestic_country: str = "CZ",
        include_foreign: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve jobs from jobs_nf ordered by cosine similarity to the
        candidate embedding. This is the first stage of hybrid retrieval:
        cast a wide semantic net, then let the rule-based scorer refine.

        Uses pgvector's <=> operator (cosine distance) with the HNSW index.
        """
        if not candidate_embedding or len(candidate_embedding) != 1024:
            logger.warning("Invalid candidate embedding for vector recall, falling back to empty")
            return []

        vector_literal = "[" + ",".join(f"{v:.8f}" for v in candidate_embedding) + "]"
        country_lower = (domestic_country or "CZ").lower()

        # We fetch more than limit to allow the rule-based scorer room to filter
        fetch_limit = min(limit * 2, 800)

        columns = """
            id, company_id, title, company, location, description,
            role_summary, benefits, tags, contract_type,
            salary_from, salary_to, salary_timeframe, currency, salary_currency,
            work_type, work_model, source, source_kind, url, education_level,
            lat, lng, country_code, language_code,
            legality_status, verification_notes, ai_analysis,
            status, is_active, challenge_format, payload_json,
            created_at, scraped_at, updated_at,
            (embedding <=> CAST(:embedding AS vector)) AS vector_distance
        """

        query = f"""
            SELECT {columns}
            FROM jobs_nf
            WHERE COALESCE(is_active, true) = true
              AND COALESCE(status, 'active') NOT IN ('archived', 'deleted', 'inactive')
              AND embedding IS NOT NULL
            ORDER BY embedding <=> CAST(:embedding AS vector)
            LIMIT :fetch_limit
        """

        try:
            async with AsyncSession(engine) as session:
                result = await session.execute(
                    text(query),
                    {"embedding": vector_literal, "fetch_limit": fetch_limit},
                )
                rows = result.fetchall()

                serialized = []
                for row in rows:
                    mapping = row._mapping
                    item = dict(mapping)
                    # Convert cosine distance to similarity score (0-1)
                    distance = float(item.pop("vector_distance", 1.0))
                    item["vector_similarity"] = round(1.0 - distance, 4)
                    serialized.append(item)

                return serialized[:limit]

        except Exception as exc:
            logger.error("Vector recall failed: %s", exc)
            return []

    @staticmethod
    async def count_embedded_jobs() -> int:
        """Count how many jobs in jobs_nf have embeddings."""
        try:
            async with AsyncSession(engine) as session:
                result = await session.execute(
                    text("SELECT COUNT(*) FROM jobs_nf WHERE embedding IS NOT NULL")
                )
                return result.scalar() or 0
        except Exception:
            return 0

    @staticmethod
    async def list_unembedded_jobs(limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch jobs that don't have embeddings yet, for batch processing."""
        try:
            async with AsyncSession(engine) as session:
                result = await session.execute(
                    text("""
                        SELECT id, title, company, location, description,
                               role_summary, tags, benefits, work_model, work_type,
                               ai_analysis, country_code
                        FROM jobs_nf
                        WHERE embedding IS NULL
                          AND COALESCE(is_active, true) = true
                          AND COALESCE(status, 'active') NOT IN ('archived', 'deleted', 'inactive')
                        ORDER BY COALESCE(scraped_at, created_at) DESC
                        LIMIT :limit
                    """),
                    {"limit": limit},
                )
                return [dict(row._mapping) for row in result.fetchall()]
        except Exception as exc:
            logger.error("Failed to list unembedded jobs: %s", exc)
            return []
