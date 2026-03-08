import asyncio
import sys
import types

from starlette.requests import Request
from fastapi import HTTPException

if "pymongo" not in sys.modules:
    pymongo_stub = types.ModuleType("pymongo")
    pymongo_stub.ASCENDING = 1

    class _MongoClient:
        def __init__(self, *args, **kwargs):
            pass

    pymongo_stub.MongoClient = _MongoClient
    sys.modules["pymongo"] = pymongo_stub
    collection_stub = types.ModuleType("pymongo.collection")

    class _Collection:
        pass

    collection_stub.Collection = _Collection
    sys.modules["pymongo.collection"] = collection_stub

import backend.app.routers.jobs as jobs_router
import backend.app.routers.assessments as assessments_router
import backend.app.routers.ai as ai_router
from backend.app.models.requests import JobApplicationCreateRequest
from backend.app.models.requests import AIExecuteRequest


class _MockResponse:
    def __init__(self, data=None, count=None):
        self.data = data
        self.count = count


class _FakeJobsSupabase:
    def __init__(self):
        self._table = None
        self._operation = None
        self._filters = {}
        self.insert_payload = None

    def table(self, name):
        self._table = name
        self._operation = None
        self._filters = {}
        return self

    def select(self, *_args, **_kwargs):
        self._operation = "select"
        return self

    def eq(self, column, value):
        self._filters[column] = value
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def maybe_single(self):
        return self

    def insert(self, payload):
        self._operation = "insert"
        self.insert_payload = payload
        return self

    def execute(self):
        if self._table == "job_applications" and self._operation == "select":
            return _MockResponse(data=[])
        if self._table == "jobs" and self._operation == "select":
            return _MockResponse(data={"company_id": "comp_1"})
        if self._table == "job_applications" and self._operation == "insert":
            row = {"id": "app_1", **(self.insert_payload or {})}
            return _MockResponse(data=[row])
        return _MockResponse(data=[])


def _make_request(path: str = "/jobs/applications") -> Request:
    return Request({"type": "http", "headers": [], "path": path, "method": "POST"})


def test_enforce_company_job_publish_limit_blocks_at_limit(monkeypatch):
    monkeypatch.setattr(jobs_router, "_require_company_tier", lambda user, company_id, allowed: "starter")
    monkeypatch.setattr(jobs_router, "_count_company_active_jobs", lambda company_id, exclude_job_id=None: 3)

    try:
        jobs_router._enforce_company_job_publish_limit("comp_1", {"id": "u_1"})
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "up to 3 active job postings" in str(exc.detail)


def test_require_company_assessment_capacity_blocks_when_usage_exhausted(monkeypatch):
    monkeypatch.setattr(
        assessments_router,
        "_get_latest_company_subscription",
        lambda company_id: {
            "id": "sub_1",
            "company_id": company_id,
            "tier": "starter",
            "status": "active",
        },
    )
    monkeypatch.setattr(
        assessments_router,
        "_get_latest_usage_for_subscription",
        lambda subscription_id: {"ai_assessments_used": 15},
    )

    try:
        assessments_router._require_company_assessment_capacity("comp_1")
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "Assessment limit reached" in str(exc.detail)


def test_create_job_application_downgrades_forged_jcfpm_share_for_free(monkeypatch):
    fake_supabase = _FakeJobsSupabase()
    monkeypatch.setattr(jobs_router, "supabase", fake_supabase)
    monkeypatch.setattr(jobs_router, "verify_csrf_token_header", lambda request, user: True)
    monkeypatch.setattr(jobs_router, "_user_has_direct_premium", lambda user: False)

    payload = JobApplicationCreateRequest(
        job_id=123,
        jcfpm_share_level="full_report",
        shared_jcfpm_payload={"archetype": {"title": "Explorer"}},
    )
    user = {"id": "user_1", "auth_id": "user_1"}

    result = asyncio.run(
        jobs_router.create_job_application(payload=payload, request=_make_request(), user=user)
    )

    assert fake_supabase.insert_payload is not None
    assert fake_supabase.insert_payload["jcfpm_share_level"] == "do_not_share"
    assert fake_supabase.insert_payload["shared_jcfpm_payload"] is None
    assert result["application"]["jcfpm_share_level"] == "do_not_share"


def test_ai_execute_blocks_generate_assessment_without_company_plan(monkeypatch):
    monkeypatch.setattr(ai_router, "_user_has_allowed_subscription", lambda user, allowed_tiers: False)

    payload = AIExecuteRequest(action="generate_assessment", params={"role": "Designer"})
    user = {"id": "user_1", "auth_id": "user_1", "authorized_ids": []}

    try:
        asyncio.run(
            ai_router.ai_execute(payload=payload, request=_make_request("/ai/execute"), user=user)
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "Company subscription required" in str(exc.detail)


def test_match_candidates_requires_growth_or_higher(monkeypatch):
    monkeypatch.setattr(
        jobs_router,
        "_require_job_access",
        lambda user, job_id: {"id": job_id, "company_id": "comp_1"},
    )

    def _deny(*_args, **_kwargs):
        raise HTTPException(status_code=403, detail="Current plan does not include this feature")

    monkeypatch.setattr(jobs_router, "_require_company_tier", _deny)

    try:
        asyncio.run(
            jobs_router.match_candidates_service(
                request=_make_request("/match-candidates"),
                job_id="123",
                user={"id": "user_1", "company_id": "comp_1", "authorized_ids": ["comp_1"]},
            )
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "Current plan does not include this feature" in str(exc.detail)


def test_ai_execute_blocks_cv_optimization_without_premium(monkeypatch):
    monkeypatch.setattr(ai_router, "_user_has_allowed_subscription", lambda user, allowed_tiers: False)

    payload = AIExecuteRequest(
        action="optimize_cv_for_ats",
        params={"cvText": "Product designer with 5 years of experience"},
    )
    user = {"id": "user_1", "auth_id": "user_1", "authorized_ids": []}

    try:
        asyncio.run(
            ai_router.ai_execute(payload=payload, request=_make_request("/ai/execute"), user=user)
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "Premium subscription required" in str(exc.detail)


def test_ai_execute_blocks_cv_analysis_without_premium(monkeypatch):
    monkeypatch.setattr(ai_router, "_user_has_allowed_subscription", lambda user, allowed_tiers: False)

    payload = AIExecuteRequest(
        action="analyze_user_cv",
        params={"cvText": "Experienced recruiter with international background"},
    )
    user = {"id": "user_1", "auth_id": "user_1", "authorized_ids": []}

    try:
        asyncio.run(
            ai_router.ai_execute(payload=payload, request=_make_request("/ai/execute"), user=user)
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "Premium subscription required" in str(exc.detail)


def test_ai_execute_blocks_profile_parse_without_premium(monkeypatch):
    monkeypatch.setattr(ai_router, "_user_has_allowed_subscription", lambda user, allowed_tiers: False)

    payload = AIExecuteRequest(
        action="parse_profile_from_cv",
        params={"text": "Designer skilled in product strategy and UX research"},
    )
    user = {"id": "user_1", "auth_id": "user_1", "authorized_ids": []}

    try:
        asyncio.run(
            ai_router.ai_execute(payload=payload, request=_make_request("/ai/execute"), user=user)
        )
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "Premium subscription required" in str(exc.detail)
