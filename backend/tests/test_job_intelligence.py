import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import backend.app.services.job_intelligence as job_intelligence


def _job(title: str, **overrides):
    payload = {
        "id": overrides.pop("id", "job-1"),
        "title": title,
        "description": overrides.pop("description", title),
        "country_code": overrides.pop("country_code", ""),
        "language_code": overrides.pop("language_code", ""),
        "work_model": overrides.pop("work_model", ""),
        "work_type": overrides.pop("work_type", ""),
        "tags": overrides.pop("tags", []),
    }
    payload.update(overrides)
    return payload


def test_multilingual_aliases_map_to_same_customer_success_role():
    titles = [
        ("customer success manager", "en"),
        ("manazer zakaznickeho uspechu", "cs"),
        ("manager zakaznickeho uspechu", "sk"),
        ("kundenbindungsmanager", "de"),
        ("menedzer sukcesu klienta", "pl"),
    ]

    role_ids = {
        job_intelligence.map_job_to_intelligence(_job(title, id=f"job-{idx}", language_code=lang))["canonical_role_id"]
        for idx, (title, lang) in enumerate(titles, start=1)
    }

    assert role_ids == {"customer_success_manager"}


def test_ai_product_manager_does_not_collapse_to_marketing_manager():
    intelligence = job_intelligence.map_job_to_intelligence(
        _job(
            "AI Product Manager",
            description="Own product roadmap for AI platform, model evaluation, LLM workflows and product discovery.",
        )
    )

    assert intelligence["canonical_role_id"] == "ai_product_manager"
    assert intelligence["canonical_role"] == "AI Product Manager"
    assert intelligence["domain_key"] == "product_management"


def test_product_manager_keeps_mid_seniority_by_default():
    intelligence = job_intelligence.map_job_to_intelligence(
        _job(
            "Product Manager",
            description="Drive roadmap, stakeholder alignment and product discovery.",
        )
    )

    assert intelligence["canonical_role_id"] == "product_manager"
    assert intelligence["seniority"] == "mid"


def test_cluster_assignment_is_stable_across_languages_for_same_role():
    cs_role = job_intelligence.map_job_to_intelligence(
        _job("Koordinator provozu", id="job-cs", language_code="cs", country_code="")
    )
    de_role = job_intelligence.map_job_to_intelligence(
        _job("Betriebskoordinator", id="job-de", language_code="de", country_code="")
    )

    assert cs_role["canonical_role_id"] == "operations_coordinator"
    assert de_role["canonical_role_id"] == "operations_coordinator"
    assert cs_role["cluster_key"] == de_role["cluster_key"]


def test_low_confidence_mapping_can_use_ai_exception(monkeypatch):
    monkeypatch.setattr(job_intelligence.config, "JOB_INTELLIGENCE_AI_THRESHOLD", 0.99)
    monkeypatch.setattr(
        job_intelligence,
        "_ai_exception_candidate",
        lambda job_row, candidates: {
            "role_id": "ai_product_manager",
            "canonical_role": "AI Product Manager",
            "role_family": "product_management",
            "domain_key": "product_management",
            "default_seniority": "mid",
            "confidence": 1.0,
            "matched_alias": "ai exception",
            "matched_language": "ai",
        },
    )

    intelligence = job_intelligence.map_job_to_intelligence(
        _job("AI roadmap specialist", description="Own product for AI assistants and LLM workflows.")
    )

    assert intelligence["canonical_role_id"] == "ai_product_manager"
    assert intelligence["mapping_source"] == "rules+ai_exception"


def test_invalid_ai_result_is_not_accepted_as_canonical_truth(monkeypatch):
    class _FakeResult:
        text = '{"role_id":"made_up_role","confidence":0.96,"reason":"hallucinated"}'

    monkeypatch.setattr(job_intelligence, "_ai_available", lambda: True)
    monkeypatch.setattr(
        job_intelligence,
        "call_primary_with_fallback",
        lambda *args, **kwargs: (_FakeResult(), False),
    )

    candidate = job_intelligence._ai_exception_candidate(
        _job("AI Product Manager"),
        [
            {
                "role_id": "ai_product_manager",
                "canonical_role": "AI Product Manager",
                "role_family": "product_management",
                "domain_key": "product_management",
                "confidence": 0.61,
            }
        ],
    )

    assert candidate is None
