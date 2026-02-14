import pytest

from backend.app.models.requests import AIGuidedProfileRequestV2, AIGuidedProfileStep
from backend.app.models.responses import AIGuidedProfileResponseV2


def test_ai_v2_request_requires_non_empty_step():
    with pytest.raises(Exception):
        AIGuidedProfileRequestV2(steps=[AIGuidedProfileStep(id="story", text="   ")])


def test_ai_v2_response_shape():
    payload = {
        "profile_updates": {
            "name": "User",
            "skills": ["python"],
            "workHistory": [],
            "education": [],
        },
        "ai_profile": {
            "story": "text",
            "hobbies": [],
            "volunteering": [],
            "leadership": [],
            "strengths": [],
            "values": [],
            "inferred_skills": [],
            "awards": [],
            "certifications": [],
            "side_projects": [],
            "motivations": [],
            "work_preferences": [],
        },
        "cv_ai_text": "full",
        "cv_summary": "short",
        "meta": {
            "prompt_version": "v1",
            "model_used": "gemini-1.5-flash",
            "fallback_used": False,
            "latency_ms": 123,
            "token_usage": {"input": 10, "output": 20},
        },
    }
    model = AIGuidedProfileResponseV2(**payload)
    assert model.meta.prompt_version == "v1"
    assert model.ai_profile.story == "text"
