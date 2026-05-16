#!/usr/bin/env python3
"""
Recompute JobShaman V2 job embeddings with the configured Azure AI embedding model.

Designed for the Azure migration cutover:
  - force re-embeds active jobs even when an old vector already exists
  - optionally refreshes recommendation snapshots for candidate users
"""

import argparse
import asyncio
import os
import sys
from pathlib import Path
from typing import Any

CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.domains.recommendation.service import RecommendationDomainService
from app.services.embedding_service import (
    EmbeddingService,
    build_job_embedding_text,
)


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


async def _count_jobs(force: bool) -> int:
    where_embedding = "" if force else "AND embedding IS NULL"
    async with AsyncSession(engine) as session:
        result = await session.execute(
            text(f"""
                SELECT COUNT(*)
                FROM jobs_nf
                WHERE COALESCE(is_active, true) = true
                  AND COALESCE(status, 'active') NOT IN ('archived', 'deleted', 'inactive')
                  {where_embedding}
            """)
        )
        return int(result.scalar() or 0)


async def _fetch_job_batch(limit: int, force: bool, after_id: str | None, order: str, offset: int = 0) -> list[dict[str, Any]]:
    where_embedding = "" if force else "AND embedding IS NULL"
    use_recent_order = order == "recent"
    where_after = "" if use_recent_order else ("AND id::text > :after_id" if after_id else "")
    order_by = "COALESCE(scraped_at, updated_at, created_at) DESC NULLS LAST, id::text ASC" if use_recent_order else "id::text ASC"
    offset_clause = "OFFSET :offset" if use_recent_order else ""
    params: dict[str, Any] = {"limit": limit}
    if after_id:
        params["after_id"] = after_id
    if use_recent_order:
        params["offset"] = offset

    async with AsyncSession(engine) as session:
        result = await session.execute(
            text(f"""
                SELECT id, title, company, location, description,
                       role_summary, tags, benefits, work_model, work_type,
                       ai_analysis, country_code
                FROM jobs_nf
                WHERE COALESCE(is_active, true) = true
                  AND COALESCE(status, 'active') NOT IN ('archived', 'deleted', 'inactive')
                  {where_embedding}
                  {where_after}
                ORDER BY {order_by}
                LIMIT :limit
                {offset_clause}
            """),
            params,
        )
        return [dict(row._mapping) for row in result.fetchall()]


async def _reset_active_embeddings() -> int:
    async with AsyncSession(engine) as session:
        result = await session.execute(
            text("""
                UPDATE jobs_nf
                SET embedding = NULL
                WHERE COALESCE(is_active, true) = true
                  AND COALESCE(status, 'active') NOT IN ('archived', 'deleted', 'inactive')
                  AND embedding IS NOT NULL
            """)
        )
        await session.commit()
        return int(result.rowcount or 0)


async def _store_embedding_batch(jobs: list[dict[str, Any]], embeddings: list[list[float]]) -> int:
    updates: list[dict[str, Any]] = []
    for job, embedding in zip(jobs, embeddings):
        job_id = str(job.get("id") or "")
        if not job_id or not embedding or all(v == 0.0 for v in embedding[:10]):
            continue
        updates.append(
            {
                "job_id": job_id,
                "embedding": "[" + ",".join(f"{v:.8f}" for v in embedding) + "]",
            }
        )
    if not updates:
        return 0

    async with AsyncSession(engine) as session:
        await session.execute(
            text("""
                UPDATE jobs_nf
                SET embedding = CAST(:embedding AS vector)
                WHERE id = :job_id
            """),
            updates,
        )
        await session.commit()
    return len(updates)


async def _candidate_user_ids(limit: int | None = None) -> list[str]:
    limit_clause = "LIMIT :limit" if limit else ""
    params = {"limit": limit} if limit else {}
    async with AsyncSession(engine) as session:
        result = await session.execute(
            text(f"""
                SELECT u.id::text AS id
                FROM users u
                JOIN candidate_profiles_v2 p ON p.user_id = u.id
                WHERE COALESCE(u.role, 'candidate') = 'candidate'
                ORDER BY COALESCE(u.last_login, u.created_at) DESC
                {limit_clause}
            """),
            params,
        )
        return [str(row._mapping["id"]) for row in result.fetchall()]


async def reembed_jobs(batch_size: int, force: bool, max_jobs: int | None, order: str) -> int:
    total = await _count_jobs(force=force)
    if max_jobs:
        total = min(total, max_jobs)
    print(f"Re-embedding target jobs: {total} (force={force}, batch_size={batch_size})", flush=True)

    processed = 0
    stored_total = 0
    after_id: str | None = None

    while processed < total:
        remaining = total - processed
        batch = await _fetch_job_batch(
            limit=min(batch_size, remaining),
            force=force,
            after_id=after_id,
            order=order,
            offset=processed,
        )
        if not batch:
            break
        after_id = str(batch[-1]["id"])

        texts = [build_job_embedding_text(job) for job in batch]
        embeddings = EmbeddingService.embed_texts(texts)
        stored = await _store_embedding_batch(batch, embeddings)
        processed += len(batch)
        stored_total += stored
        print(f"Embedded batch: processed={processed}/{total}, stored={stored_total}", flush=True)

    return stored_total


async def refresh_recommendations(limit: int | None) -> int:
    user_ids = await _candidate_user_ids(limit=limit)
    print(f"Refreshing recommendation feeds for {len(user_ids)} candidates", flush=True)
    refreshed = 0
    for user_id in user_ids:
        try:
            RecommendationDomainService.FEED_CACHE.pop(user_id, None)
            await RecommendationDomainService.build_candidate_feed(user_id, limit=60)
            refreshed += 1
            if refreshed % 10 == 0:
                print(f"Refreshed recommendations: {refreshed}/{len(user_ids)}", flush=True)
        except Exception as exc:
            print(f"WARNING: recommendation refresh failed for {user_id}: {exc}", flush=True)
    return refreshed


async def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=_int_env("REEMBED_BATCH_SIZE", 25))
    parser.add_argument("--max-jobs", type=int, default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--reset-active-embeddings", action="store_true")
    parser.add_argument("--order", choices=["id", "recent"], default="id")
    parser.add_argument("--refresh-recommendations", action="store_true")
    parser.add_argument("--max-users", type=int, default=None)
    args = parser.parse_args()

    if args.reset_active_embeddings:
        reset = await _reset_active_embeddings()
        print(f"Reset active embeddings: {reset}", flush=True)

    stored = await reembed_jobs(
        batch_size=max(1, min(args.batch_size, 500)),
        force=bool(args.force),
        max_jobs=args.max_jobs,
        order=args.order,
    )
    refreshed = 0
    if args.refresh_recommendations:
        refreshed = await refresh_recommendations(limit=args.max_users)

    print(
        {
            "stored_embeddings": stored,
            "refreshed_recommendation_users": refreshed,
            "embedding_model": os.getenv("AZURE_AI_EMBEDDING_MODEL", "text-embedding-3-large"),
            "embedding_dimensions": os.getenv("AZURE_AI_EMBEDDING_DIMENSIONS", "1024"),
        },
        flush=True,
    )
    await engine.dispose()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
