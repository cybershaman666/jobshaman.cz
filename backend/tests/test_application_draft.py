import asyncio

import pytest
from fastapi import HTTPException
from starlette.requests import Request

import backend.app.routers.jobs as jobs_router
from backend.app.models.requests import JobApplicationDraftRequest


class _MockResponse:
    def __init__(self, data=None):
        self.data = data


class _FakeSupabaseQuery:
    def __init__(self, parent, table_name: str):
        self.parent = parent
        self.table_name = table_name
        self.operation = None
        self.filters = {}
        self.payload = None

    def select(self, *_args, **_kwargs):
        self.operation = "select"
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def maybe_single(self):
        return self

    def insert(self, payload):
        self.operation = "insert"
        self.payload = payload
        return self

    def execute(self):
        if self.operation == "insert" and self.table_name == "analytics_events":
            self.parent.analytics_events.append(self.payload)
            return _MockResponse(data=[self.payload])

        if self.table_name == "jobs":
            row = self.parent.jobs.get(self.filters.get("id"))
            return _MockResponse(data=row)

        if self.table_name == "candidate_profiles":
            row = self.parent.candidate_profiles.get(self.filters.get("id"))
            return _MockResponse(data=row)

        if self.table_name == "cv_documents":
            row = self.parent.cv_documents.get(self.filters.get("id"))
            if row and row.get("user_id") == self.filters.get("user_id"):
                return _MockResponse(data=row)
            return _MockResponse(data=None)

        return _MockResponse(data=None)


class _FakeSupabase:
    def __init__(self):
        self.jobs = {
            101: {
                "id": 101,
                "company_id": "comp_1",
                "title": "Backend Engineer",
                "company": "Acme",
                "location": "Prague",
                "description": "Python FastAPI distributed systems remote role",
                "salary_from": 120000,
                "salary_to": 150000,
                "salary_currency": "CZK",
            }
        }
        self.candidate_profiles = {
            "user_1": {
                "id": "user_1",
                "job_title": "Backend Engineer",
                "skills": ["Python", "FastAPI", "SQL"],
                "strengths": ["delivery", "API design"],
                "cv_text": "Backend engineer focused on Python and FastAPI systems.",
                "cv_ai_text": "Experienced backend engineer with API and data platform work.",
                "preferences": {"preferredCountryCode": "CZ"},
            }
        }
        self.cv_documents = {
            "cv_1": {
                "id": "cv_1",
                "user_id": "user_1",
                "locale": "cs",
                "parsed_data": {
                    "cvText": "Stored CV text",
                    "cvAiText": "Stored AI CV summary",
                },
            }
        }
        self.analytics_events = []

    def table(self, name):
        return _FakeSupabaseQuery(self, name)


def _make_request(path: str) -> Request:
    return Request({"type": "http", "headers": [], "path": path, "method": "POST"})


def test_job_application_draft_request_defaults_and_validation():
    payload = JobApplicationDraftRequest.model_validate({})
    assert payload.tone == "concise"
    assert payload.language == "auto"
    assert payload.regenerate is False

    with pytest.raises(Exception):
        JobApplicationDraftRequest.model_validate({"tone": "casual"})


def test_generate_job_application_draft_success(monkeypatch):
    fake_supabase = _FakeSupabase()
    monkeypatch.setattr(jobs_router, "supabase", fake_supabase)
    monkeypatch.setattr(jobs_router, "_read_job_record", lambda job_id: fake_supabase.jobs.get(job_id))
    monkeypatch.setattr(jobs_router, "_user_has_allowed_subscription", lambda user, allowed: True)
    monkeypatch.setattr(
        jobs_router,
        "recommend_jobs_for_user",
        lambda **_kwargs: [
            {
                "job": {"id": 101},
                "score": 88.4,
                "reasons": ["Sedí klíčové technologie Python a FastAPI."],
                "breakdown": {},
            }
        ],
    )
    monkeypatch.setattr(
        jobs_router,
        "_generate_application_draft_text",
        lambda prompt: (
            "Dobrý den, reaguji na pozici Backend Engineer ve společnosti Acme. "
            "Navazuji na zkušenosti s Pythonem a FastAPI a rád doplním konkrétní ukázky práce.",
            {"model_used": "gpt-test", "fallback_used": False, "token_usage": {"input": 11, "output": 22}, "latency_ms": 33},
        ),
    )

    result = asyncio.run(
        jobs_router.generate_job_application_draft(
            job_id="101",
            payload=JobApplicationDraftRequest(cv_document_id="cv_1"),
            request=_make_request("/jobs/101/application-draft"),
            user={"id": "user_1", "auth_id": "user_1", "subscription_tier": "premium"},
        )
    )

    assert result.fit_score == 88.4
    assert result.language == "cs"
    assert result.draft_text.startswith("Dobrý den")
    assert fake_supabase.analytics_events[0]["event_type"] == "application_draft_generated"


def test_generate_job_application_draft_falls_back_when_ai_fails(monkeypatch):
    fake_supabase = _FakeSupabase()
    monkeypatch.setattr(jobs_router, "supabase", fake_supabase)
    monkeypatch.setattr(jobs_router, "_read_job_record", lambda job_id: fake_supabase.jobs.get(job_id))
    monkeypatch.setattr(jobs_router, "_user_has_allowed_subscription", lambda user, allowed: True)
    monkeypatch.setattr(jobs_router, "recommend_jobs_for_user", lambda **_kwargs: [])

    def _raise(_prompt):
        raise RuntimeError("provider down")

    monkeypatch.setattr(jobs_router, "_generate_application_draft_text", _raise)

    result = asyncio.run(
        jobs_router.generate_job_application_draft(
            job_id="101",
            payload=JobApplicationDraftRequest(),
            request=_make_request("/jobs/101/application-draft"),
            user={"id": "user_1", "auth_id": "user_1", "subscription_tier": "premium"},
        )
    )

    assert result.used_fallback is True
    assert "provider down" in str(result.model_meta.get("error"))
    assert result.draft_text


def test_generate_job_application_draft_rejects_missing_user(monkeypatch):
    fake_supabase = _FakeSupabase()
    monkeypatch.setattr(jobs_router, "supabase", fake_supabase)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            jobs_router.generate_job_application_draft(
                job_id="101",
                payload=JobApplicationDraftRequest(),
                request=_make_request("/jobs/101/application-draft"),
                user={},
            )
        )

    assert exc.value.status_code == 401


def test_generate_job_application_draft_rejects_foreign_cv_document(monkeypatch):
    fake_supabase = _FakeSupabase()
    monkeypatch.setattr(jobs_router, "supabase", fake_supabase)
    monkeypatch.setattr(jobs_router, "_read_job_record", lambda job_id: fake_supabase.jobs.get(job_id))
    monkeypatch.setattr(jobs_router, "_user_has_allowed_subscription", lambda user, allowed: True)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            jobs_router.generate_job_application_draft(
                job_id="101",
                payload=JobApplicationDraftRequest(cv_document_id="foreign_cv"),
                request=_make_request("/jobs/101/application-draft"),
                user={"id": "user_1", "auth_id": "user_1", "subscription_tier": "premium"},
            )
        )

    assert exc.value.status_code == 404
