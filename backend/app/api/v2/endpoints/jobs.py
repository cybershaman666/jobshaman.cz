from fastapi import APIRouter, Depends, HTTPException, Query
from app.domains.reality.service import RealityDomainService
from typing import List, Dict, Any

router = APIRouter()

@router.get("/")
async def get_jobs(
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    country: str | None = Query(None),
    q: str | None = Query(None, max_length=200),
    city: str | None = Query(None, max_length=120),
    min_salary: int | None = Query(None, ge=0),
    benefits: str | None = Query(None, max_length=500),
    work_arrangement: str | None = Query(None, max_length=20),
) -> Dict[str, Any]:
    """
    Public endpoint to list active jobs.
    In V2, this fetches from Northflank Postgres.
    """
    return await RealityDomainService.list_active_jobs_page(
        limit=limit,
        offset=offset,
        country=country,
        query=q,
        city=city,
        min_salary=min_salary,
        benefits=[item.strip() for item in str(benefits or "").split(",") if item.strip()],
        work_arrangement=work_arrangement,
    )

@router.get("/{job_id}")
async def get_job(job_id: str) -> Dict[str, Any]:
    job = await RealityDomainService.get_job_details(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
