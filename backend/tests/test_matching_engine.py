from backend.app.matching_engine.feature_store import extract_candidate_features, extract_job_features
from backend.app.matching_engine.scoring import score_job


def test_score_job_includes_inferred_and_leadership_skills():
    candidate = {
        "job_title": "projektovy manazer",
        "skills": ["python", "scrum"],
        "inferred_skills": ["vedeni tymu"],
        "leadership": ["koucovani"],
        "address": "brno",
        "work_preferences": ["hybrid"],
    }
    job = {
        "title": "Senior Project Manager",
        "description": "Hledame kandidata se scrum, vedeni tymu a koucovani.",
        "location": "Brno",
        "country_code": "cs",
        "salary_from": 90000,
        "currency": "czk",
    }

    score, reasons, breakdown = score_job(
        extract_candidate_features(candidate),
        extract_job_features(job),
        semantic_similarity=0.8,
    )

    assert score >= 25
    assert breakdown["skill_exact"] > 0
    assert breakdown["skill_semantic"] > 0
    assert len(reasons) >= 1


def test_score_job_returns_zero_like_for_empty():
    score, reasons, breakdown = score_job(
        extract_candidate_features({}),
        extract_job_features({}),
        semantic_similarity=0.0,
    )
    assert score >= 0
    assert isinstance(reasons, list)
    assert "total" in breakdown
