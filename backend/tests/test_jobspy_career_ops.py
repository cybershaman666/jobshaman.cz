import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.services.jobspy_career_ops import (
    build_company_snapshot_documents,
    build_enriched_job_document,
    score_enriched_job_for_candidate,
)


def _raw_job(**overrides):
    now = datetime.now(timezone.utc)
    base = {
        "_id": "job-1",
        "title": "Senior Backend Engineer",
        "company": "Acme Cloud",
        "location": "Berlin, Germany",
        "country": "Germany",
        "country_indeed": "Germany",
        "source_site": "linkedin",
        "job_type": "fulltime",
        "job_url": "https://example.com/jobs/1",
        "description": "Build Python APIs, data pipelines and cloud services for platform teams.",
        "is_remote": True,
        "queried_sites": ["linkedin", "indeed"],
        "search_term": "software engineer",
        "location_query": "Berlin",
        "hours_old": 72,
        "query_hash": "abc",
        "scraped_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "expires_at": (now + timedelta(days=7)).isoformat(),
    }
    base.update(overrides)
    return base


def _candidate_profile():
    return {
        "id": "user-1",
        "job_title": "Backend Engineer",
        "skills": ["python", "apis", "cloud"],
        "cv_text": "Senior backend engineer working with Python, APIs and cloud systems.",
        "preferences": {
            "desired_role": "Backend Engineer",
            "searchProfile": {
                "primaryDomain": "it",
                "targetRole": "Backend Engineer",
                "seniority": "senior",
                "wantsRemoteRoles": True,
                "includeAdjacentDomains": True,
            },
        },
    }


def test_build_enriched_job_document_derives_taxonomy_and_freshness():
    enriched = build_enriched_job_document(_raw_job())

    assert enriched["raw_job_id"] == "job-1"
    assert enriched["primary_role_family"]
    assert enriched["freshness_bucket"] in {"hot", "warm", "aging", "stale"}
    assert enriched["work_mode_normalized"] == "remote"
    assert enriched["description_present"] is True


def test_scoring_is_deterministic_and_prefers_matching_role():
    enriched = build_enriched_job_document(_raw_job())
    candidate = _candidate_profile()

    first = score_enriched_job_for_candidate(enriched, candidate_profile=candidate, saved_job_ids=set())
    second = score_enriched_job_for_candidate(enriched, candidate_profile=candidate, saved_job_ids=set())

    assert first["fit_score"] == second["fit_score"]
    assert first["match_bucket"] in {"best_fit", "adjacent", "broader"}
    assert first["fit_score"] >= 60
    assert first["fit_reasons"]


def test_company_snapshot_groups_multiple_roles():
    docs = [
        build_enriched_job_document(_raw_job(_id="job-1", title="Senior Backend Engineer")),
        build_enriched_job_document(_raw_job(_id="job-2", title="Platform Engineer")),
    ]

    snapshots = build_company_snapshot_documents(docs)

    assert len(snapshots) == 1
    snapshot = snapshots[0]
    assert snapshot["open_jobs_count"] == 2
    assert snapshot["company"] == "Acme Cloud"
    assert snapshot["sample_titles"]
