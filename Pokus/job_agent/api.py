from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .orchestrator import JobAgentService


app = FastAPI(title="Local Job Agent", version="0.1.0")
service = JobAgentService()
WEB_DIR = Path(__file__).resolve().parent.parent / "web"

app.mount("/assets", StaticFiles(directory=WEB_DIR), name="assets")


class ProfilePayload(BaseModel):
    resume: str
    preferences: str


class SuggestPreferencesPayload(BaseModel):
    use_llm: bool = True


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/llm/status")
def llm_status():
    return service.get_llm_status()


@app.get("/")
def index() -> FileResponse:
    return FileResponse(WEB_DIR / "index.html")


@app.post("/jobs/fetch")
def fetch_jobs(limit: int | None = None):
    jobs = service.fetch_all_jobs(limit=limit)
    return {"jobs": jobs, "report": service.fetch_report()}


@app.get("/profile")
def get_profile():
    return service.get_profile_bundle()


@app.put("/profile")
def update_profile(payload: ProfilePayload):
    try:
        return service.update_profile_bundle(payload.resume, payload.preferences)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/profile/suggest-preferences")
def suggest_preferences(payload: SuggestPreferencesPayload):
    return service.suggest_preferences_from_resume(use_llm=payload.use_llm)


@app.get("/jobs/recommendations")
def recommendations(limit: int | None = None, use_llm: bool = True):
    items = service.recommend(limit=limit, use_llm=use_llm)
    return {
        "items": [item.model_dump(mode="json") for item in items],
        "llm": service.get_llm_status() if use_llm else {"enabled": False},
    }


@app.get("/jobs/{job_id}/draft")
def draft(job_id: str, use_llm: bool = True):
    try:
        return service.draft(job_id, use_llm=use_llm).model_dump(mode="json")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/jobs/{job_id}/apply")
def apply(job_id: str, use_llm: bool = True):
    try:
        return service.apply(job_id, use_llm=use_llm).model_dump(mode="json")
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
