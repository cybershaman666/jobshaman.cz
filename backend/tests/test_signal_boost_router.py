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
