import asyncio

from starlette.requests import Request

from backend.app.routers import jobs
from backend.app.models.requests import HybridJobSearchV2Request


def _request():
    return Request({
        "type": "http",
        "method": "GET",
        "path": "/tests",
        "headers": [],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
        "scheme": "http",
        "query_string": b"",
    })


def test_cached_external_feed_returns_live_seed_when_cache_is_empty(monkeypatch):
    calls = {"cache_reads": 0}
    monkeypatch.delenv("JOOBLE_API_KEY", raising=False)

    def fake_read_cached_external_jobs(**_kwargs):
        calls["cache_reads"] += 1
        return {"jobs": [], "total_count": 0, "has_more": False}

    monkeypatch.setattr(jobs, "_read_cached_external_jobs", fake_read_cached_external_jobs)
    monkeypatch.setattr(jobs, "_attach_job_dialogue_preview_metrics", lambda _jobs: None)
    monkeypatch.setattr(jobs, "_write_external_cache_snapshot", lambda **_kwargs: None)
    monkeypatch.setattr(jobs, "_provider_health_snapshot", lambda: {
        "arbeitnow": {"state": "healthy", "failure_count": 0},
        "weworkremotely": {"state": "healthy", "failure_count": 0},
        "jooble": {"state": "healthy", "failure_count": 0},
    })

    monkeypatch.setattr(jobs, "search_arbeitnow_jobs_live", lambda **_kwargs: [{
        "id": "a1",
        "title": "Backend Engineer",
        "company": "Acme",
        "location": "Remote",
        "description": "Build APIs",
        "url": "https://arbeitnow.example/jobs/a1",
        "source": "arbeitnow.com",
        "scraped_at": "2026-03-11T10:00:00+00:00",
    }])
    monkeypatch.setattr(jobs, "search_weworkremotely_jobs_live", lambda **_kwargs: [])
    monkeypatch.setattr(jobs, "search_jooble_jobs_live", lambda **_kwargs: [])

    payload = asyncio.run(
        jobs.get_cached_external_feed(
            request=_request(),
            search_term="backend",
            filter_city="",
            page=0,
            page_size=24,
            country_codes=None,
            exclude_country_codes=None,
        )
    )

    assert len(payload["jobs"]) == 1
    assert payload["meta"]["fallback_mode"] == "live_seeded"
    assert payload["meta"]["cache_hit"] is False
    assert "provider_not_configured:jooble" in payload["meta"]["degraded_reasons"]
    assert calls["cache_reads"] >= 2


def test_hybrid_search_v2_response_exposes_default_diagnostics_meta(monkeypatch):
    monkeypatch.setattr(jobs, "_try_get_optional_user_id", lambda _request: None)
    monkeypatch.setattr(jobs, "hybrid_search_jobs_v2", lambda *_args, **_kwargs: {
        "jobs": [{"id": "job-1", "title": "Engineer", "company": "Acme", "location": "Remote"}],
        "has_more": False,
        "total_count": 1,
        "meta": {},
    })
    monkeypatch.setattr(jobs, "_attach_job_dialogue_preview_metrics", lambda _jobs: None)

    payload = asyncio.run(
        jobs.jobs_hybrid_search_v2(
            payload=HybridJobSearchV2Request(search_term="engineer"),
            request=_request(),
            background_tasks=type("BackgroundTasks", (), {"add_task": lambda *_args, **_kwargs: None})(),
        )
    )

    assert payload["meta"]["provider_status"] == {}
    assert payload["meta"]["fallback_mode"] == "internal_only"
    assert payload["meta"]["cache_hit"] is False
    assert payload["meta"]["degraded_reasons"] == []


def test_provider_failure_opens_circuit_immediately_for_forbidden_errors():
    original_state = jobs._EXTERNAL_PROVIDER_HEALTH["jooble"].copy()
    try:
        jobs._EXTERNAL_PROVIDER_HEALTH["jooble"] = {
            "failures": 0,
            "circuit_open_until": None,
            "last_error": None,
            "last_failure_at": None,
            "last_success_at": None,
        }
        jobs._mark_provider_failure("jooble", PermissionError("Jooble API forbidden for host at.jooble.org"))
        snapshot = jobs._provider_health_snapshot()["jooble"]
        assert snapshot["state"] == "open"
        assert snapshot["failure_count"] >= 2
        assert snapshot["last_error"] == "Jooble API forbidden for host at.jooble.org"
    finally:
        jobs._EXTERNAL_PROVIDER_HEALTH["jooble"] = original_state
