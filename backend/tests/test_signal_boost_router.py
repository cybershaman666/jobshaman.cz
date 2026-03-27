import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import backend.app.routers.signal_boost as signal_boost_router


def test_build_signal_boost_candidate_snapshot_uses_profile_avatar_fallback(monkeypatch):
    monkeypatch.setattr(
        signal_boost_router,
        "_fetch_candidate_profile_for_draft",
        lambda user_id: {"job_title": "Product Owner"},
    )
    monkeypatch.setattr(
        signal_boost_router,
        "_fetch_profile_identity",
        lambda user_id: {
            "full_name": "Alex Recruiter",
            "email": "alex@example.com",
            "avatar_url": "https://cdn.jobshaman.test/avatar.png",
        },
    )

    snapshot = signal_boost_router._build_signal_boost_candidate_snapshot(
        {"email": "alex@example.com"},
        "user-1",
    )

    assert snapshot["name"] == "Alex Recruiter"
    assert snapshot["avatar_url"] == "https://cdn.jobshaman.test/avatar.png"


def test_serialize_signal_output_public_restores_missing_avatar_from_profile(monkeypatch):
    monkeypatch.setattr(signal_boost_router.config, "APP_PUBLIC_URL", "https://jobshaman.test")
    monkeypatch.setattr(
        signal_boost_router,
        "_fetch_candidate_profile_for_draft",
        lambda user_id: {},
    )
    monkeypatch.setattr(
        signal_boost_router,
        "_fetch_profile_identity",
        lambda user_id: {
            "avatar_url": "https://cdn.jobshaman.test/profile-avatar.png",
        },
    )

    serialized = signal_boost_router._serialize_signal_output_public(
        {
            "id": "sb-1",
            "candidate_id": "user-1",
            "share_slug": "share-1",
            "locale": "en",
            "job_snapshot": {"title": "Operations Manager"},
            "candidate_snapshot": {"name": "Alex"},
            "scenario_payload": {},
            "response_payload": {},
            "quality_flags": {},
        }
    )

    assert serialized is not None
    assert serialized["share_url"] == "https://jobshaman.test/en/signal/share-1"
    assert serialized["candidate_snapshot"]["avatar_url"] == "https://cdn.jobshaman.test/profile-avatar.png"


def test_serialize_signal_output_public_prefers_live_profile_snapshot_over_stale_publish_data(monkeypatch):
    monkeypatch.setattr(signal_boost_router.config, "APP_PUBLIC_URL", "https://jobshaman.test")
    monkeypatch.setattr(
        signal_boost_router,
        "_fetch_candidate_profile_for_draft",
        lambda user_id: {
            "job_title": "AI Product Operator",
            "avatar_url": "https://cdn.jobshaman.test/live-avatar.png",
            "linkedin": "https://linkedin.com/in/alex-live",
            "skills": ["Operations", "Product", "Automation"],
        },
    )
    monkeypatch.setattr(
        signal_boost_router,
        "_fetch_profile_identity",
        lambda user_id: {
            "full_name": "Alex Live",
            "avatar_url": "https://cdn.jobshaman.test/profile-avatar.png",
        },
    )

    serialized = signal_boost_router._serialize_signal_output_public(
        {
            "id": "sb-2",
            "candidate_id": "user-2",
            "share_slug": "share-2",
            "locale": "en",
            "job_snapshot": {"title": "Operations Manager"},
            "candidate_snapshot": {
                "name": "Alex Stale",
                "jobTitle": "Old Headline",
                "avatar_url": "https://cdn.jobshaman.test/stale-avatar.png",
                "linkedin": "https://linkedin.com/in/alex-stale",
                "skills": ["Legacy"],
            },
            "scenario_payload": {},
            "response_payload": {},
            "quality_flags": {},
        }
    )

    assert serialized is not None
    assert serialized["candidate_snapshot"]["name"] == "Alex Live"
    assert serialized["candidate_snapshot"]["jobTitle"] == "AI Product Operator"
    assert serialized["candidate_snapshot"]["avatar_url"] == "https://cdn.jobshaman.test/live-avatar.png"
    assert serialized["candidate_snapshot"]["linkedin"] == "https://linkedin.com/in/alex-live"
    assert serialized["candidate_snapshot"]["skills"] == ["Operations", "Product", "Automation"]


def test_build_public_candidate_snapshot_preserves_long_avatar_urls(monkeypatch):
    long_avatar_url = "https://images.jobshaman.test/avatar/" + ("a" * 1200) + ".png"
    monkeypatch.setattr(
        signal_boost_router,
        "_fetch_candidate_profile_for_draft",
        lambda user_id: {
            "avatar_url": long_avatar_url,
        },
    )
    monkeypatch.setattr(
        signal_boost_router,
        "_fetch_profile_identity",
        lambda user_id: {},
    )

    snapshot = signal_boost_router._build_public_candidate_snapshot(
        {
            "candidate_id": "user-long-avatar",
            "candidate_snapshot": {"name": "Alex"},
        }
    )

    assert snapshot["avatar_url"] == long_avatar_url


def test_serialize_signal_output_public_backfills_fit_context_for_legacy_outputs(monkeypatch):
    monkeypatch.setattr(signal_boost_router.config, "APP_PUBLIC_URL", "https://jobshaman.test")
    monkeypatch.setattr(
        signal_boost_router,
        "_fetch_candidate_profile_for_draft",
        lambda user_id: {
            "preferences": {
                "jcfpm_v1": {
                    "percentile_summary": {
                        "d1_cognitive": 81,
                        "d2_social": 32,
                        "d4_energy": 41,
                        "d6_ai_readiness": 72,
                        "d12_moral_compass": 75,
                    },
                    "ai_report": {
                        "strengths": ["Strong systems thinking in messy contexts."],
                        "ideal_environment": ["Works best when first reading reality before forcing activity."],
                        "development_areas": ["Can get drained by heavy follow-up and people-chasing."],
                        "top_roles": [{"title": "Product Manager"}],
                    },
                }
            }
        },
    )
    monkeypatch.setattr(
        signal_boost_router,
        "_fetch_profile_identity",
        lambda user_id: {"full_name": "Alex"},
    )
    monkeypatch.setattr(
        signal_boost_router,
        "_load_signal_boost_job_row",
        lambda job_id: {
            "id": job_id,
            "title": "Construction Supervisor",
            "company": "BuildCo",
            "description": "Coordinate subcontractors, safety, and site sequencing under deadline pressure.",
            "location": "Brno",
            "language_code": "en",
            "work_model": "onsite",
            "work_type": "full-time",
            "role_summary": "",
            "tags": ["construction", "subcontractors", "site safety"],
        },
    )

    serialized = signal_boost_router._serialize_signal_output_public(
        {
            "id": "sb-legacy-fit",
            "candidate_id": "user-legacy",
            "job_id": "job-legacy",
            "share_slug": "legacy-fit",
            "locale": "en",
            "job_snapshot": {"title": "Construction Supervisor", "company": "BuildCo"},
            "candidate_snapshot": {"name": "Alex"},
            "scenario_payload": {},
            "response_payload": {},
            "recruiter_readout": {},
            "quality_flags": {},
        }
    )

    assert serialized is not None
    assert serialized["scenario_payload"]["fit_context"]["headline"]
    assert serialized["recruiter_readout"]["fit_context"]["transferable_strengths"]
    assert serialized["jcfpm_signal"]["strengths"]
    assert serialized["jcfpm_signal"]["top_dimensions"]


def test_build_public_jcfpm_signal_respects_opt_out():
    signal = signal_boost_router._build_public_jcfpm_signal(
        {
            "preferences": {
                "signal_boost_share_jcfpm": False,
                "jcfpm_v1": {
                    "percentile_summary": {"d1_cognitive": 80},
                    "ai_report": {"strengths": ["Systems thinker."]},
                },
            }
        }
    )

    assert signal is None
