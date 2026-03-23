import asyncio

from fastapi import Request

from backend.app.models.requests import CandidateOnboardingEvaluateRequest
from backend.app.routers import ai as ai_router


def _make_request(path: str = "/candidate-onboarding/evaluate") -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": path,
        "headers": [],
        "query_string": b"",
        "client": ("127.0.0.1", 1234),
        "server": ("testserver", 80),
        "scheme": "http",
        "root_path": "",
    }
    return Request(scope)


def test_candidate_onboarding_evaluate_returns_structured_payload(monkeypatch):
    monkeypatch.setattr(
        ai_router,
        "_ai_json",
        lambda prompt, feature: (
            {
                "summary": "You started from user behavior first.",
                "strengths": ["Clear first diagnostic move", "You looked for signal before polish"],
                "misses": ["Assumptions stayed implicit"],
                "role_signals": ["Fits product and growth roles"],
                "reality_check": "You describe yourself as strategic, but this answer reads execution-first.",
                "intent_hints": ["try_real_work", "compare_offers"],
            },
            {"model_used": "test-model", "fallback_used": False},
        ),
    )

    payload = CandidateOnboardingEvaluateRequest(
        scenario_id="product_dropoff",
        answer="I would first inspect signup behavior and identify where users drop before changing the flow.",
        locale="en",
    )

    result = asyncio.run(
        ai_router.evaluate_candidate_onboarding(
            payload=payload,
            request=_make_request(),
            user={"id": "user_1", "auth_id": "user_1"},
        )
    )

    assert result["evaluation"]["summary"] == "You started from user behavior first."
    assert result["evaluation"]["intent_hints"] == ["try_real_work", "compare_offers"]
    assert result["meta"]["model_used"] == "test-model"
