import sys
import types
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

if "pymongo" not in sys.modules:
    pymongo_stub = types.ModuleType("pymongo")
    pymongo_stub.ASCENDING = 1
    pymongo_stub.DESCENDING = -1

    class _MongoClient:
        def __init__(self, *args, **kwargs):
            pass

    class _UpdateOne:
        def __init__(self, *args, **kwargs):
            pass

    pymongo_stub.MongoClient = _MongoClient
    pymongo_stub.UpdateOne = _UpdateOne
    sys.modules["pymongo"] = pymongo_stub
    collection_stub = types.ModuleType("pymongo.collection")

    class _Collection:
        pass

    collection_stub.Collection = _Collection
    sys.modules["pymongo.collection"] = collection_stub

import backend.app.routers.jobs as jobs_router


def test_serialize_dialogue_dossier_includes_signal_boost_snapshot(monkeypatch):
    monkeypatch.setattr(jobs_router.config, "APP_PUBLIC_URL", "https://jobshaman.test")
    monkeypatch.setattr(
        jobs_router,
        "get_latest_published_signal_output_for_candidate_job",
        lambda **_kwargs: {
            "id": "sb_1",
            "share_slug": "share123",
            "locale": "en",
            "signal_summary": {
                "items": [
                    {"key": "context_read", "label": "Context Read", "score": 82},
                ]
            },
            "recruiter_readout": {
                "headline": "Shows how the candidate thinks beyond the CV.",
                "strength_signals": ["Commits to a concrete first move."],
                "risk_flags": [],
                "follow_up_questions": ["What would they verify first on site?"],
                "what_cv_does_not_show": ["How they work with incomplete context."],
                "recommended_next_step": "Use this as a follow-up interview anchor.",
            },
            "published_at": "2026-03-27T10:00:00Z",
        },
    )

    dossier = jobs_router._serialize_dialogue_dossier(
        {
            "id": "app_1",
            "job_id": "job_1",
            "candidate_id": "cand_1",
            "company_id": "comp_1",
            "status": "pending",
            "candidate_profile_snapshot": {"name": "Alex Candidate", "email": "alex@example.com"},
            "application_payload": {},
        }
    )

    assert dossier["signal_boost"]["output_id"] == "sb_1"
    assert dossier["signal_boost"]["share_url"] == "https://jobshaman.test/en/signal/share123"
    assert dossier["signal_boost"]["recruiter_readout"]["headline"].startswith("Shows how")
