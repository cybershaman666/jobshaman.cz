import pytest
from datetime import datetime, timezone, timedelta

# Inject a mock for pymongo if needed (since some routers fail on import)
import sys
import types
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

# Import our target functions/endpoints
from backend.app.api.v2.endpoints.billing import (
    _subscription_priority,
    _get_latest_subscription_by,
    get_subscription_status,
)
import backend.app.api.v2.endpoints.billing as billing_module


def test_subscription_priority():
    # Active enterprise is higher than active professional, which is higher than inactive starter, etc.
    sub_active_ent = {
        "tier": "enterprise",
        "status": "active",
        "current_period_end": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    }
    sub_active_prof = {
        "tier": "professional",
        "status": "active",
        "current_period_end": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    }
    sub_inactive_ent = {
        "tier": "enterprise",
        "status": "active",
        "current_period_end": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    }
    sub_active_free = {
        "tier": "free",
        "status": "active",
        "current_period_end": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    }
    
    assert _subscription_priority(sub_active_ent) > _subscription_priority(sub_active_prof)
    assert _subscription_priority(sub_active_prof) > _subscription_priority(sub_inactive_ent)
    # Active free is prioritized over inactive/expired enterprise subscription.
    assert _subscription_priority(sub_active_free) > _subscription_priority(sub_inactive_ent)


class MockResponse:
    def __init__(self, data):
        self.data = data


class MockSupabase:
    def __init__(self):
        self.queries = []
        self.current_table = None
        self.filters = []
        self.mock_responses = {}

    def table(self, name):
        self.current_table = name
        return self

    def select(self, *args, **kwargs):
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def insert(self, payload):
        # Store insertion for verification
        self.inserted_payload = payload
        return self

    def execute(self):
        # Find matches by table and column
        data = []
        for table, col, val in self.mock_responses:
            if table == self.current_table and any(f[0] == col and f[1] == val for f in self.filters):
                data = self.mock_responses[(table, col, val)]
                break
        
        # Reset current filter tracking for next query in chain
        self.filters = []
        return MockResponse(data)


def test_get_latest_subscription_by(monkeypatch):
    mock_supabase = MockSupabase()
    now = datetime.now(timezone.utc)
    mock_data = [
        {
            "id": "sub_old_free",
            "tier": "free",
            "status": "active",
            "current_period_end": (now + timedelta(days=30)).isoformat(),
            "updated_at": (now - timedelta(days=5)).isoformat()
        },
        {
            "id": "sub_new_enterprise",
            "tier": "enterprise",
            "status": "active",
            "current_period_end": (now + timedelta(days=30)).isoformat(),
            "updated_at": now.isoformat()
        }
    ]
    mock_supabase.mock_responses[("subscriptions", "company_id", "comp_123")] = mock_data

    monkeypatch.setattr(billing_module, "supabase", mock_supabase)

    best_sub = _get_latest_subscription_by("company_id", "comp_123")
    assert best_sub is not None
    assert best_sub["id"] == "sub_new_enterprise"
    assert best_sub["tier"] == "enterprise"


@pytest.mark.anyio
async def test_get_subscription_status_recruiter_context(monkeypatch):
    user = {
        "id": "u_recruiter",
        "auth_id": "u_recruiter",
        "company_name": "Test Company",
        "company_id": "comp_abc",
        "authorized_ids": ["u_recruiter", "comp_abc"]
    }
    
    monkeypatch.setattr(billing_module, "require_company_access", lambda u, cid: "comp_abc")
    monkeypatch.setattr(billing_module, "count_company_active_jobs", lambda cid: 2)
    monkeypatch.setattr(billing_module, "_count_company_active_dialogues", lambda cid: 5)
    
    mock_supabase = MockSupabase()
    now = datetime.now(timezone.utc)
    
    # 1st query: get_subscription_status searches subscriptions by user_id
    mock_supabase.mock_responses[("subscriptions", "user_id", "u_recruiter")] = []
    
    # 2nd query: fallback searches company_id
    mock_supabase.mock_responses[("subscriptions", "company_id", "comp_abc")] = [{
        "id": "sub_company_prof",
        "company_id": "comp_abc",
        "tier": "professional",
        "status": "active",
        "current_period_end": (now + timedelta(days=10)).isoformat(),
        "updated_at": now.isoformat()
    }]
    
    # 3rd query: subscription_usage by subscription_id
    mock_supabase.mock_responses[("subscription_usage", "subscription_id", "sub_company_prof")] = [{
        "ai_assessments_used": 10,
        "active_jobs_count": 2,
        "active_dialogue_slots_used": 5,
        "role_opens_used": 2
    }]

    monkeypatch.setattr(billing_module, "supabase", mock_supabase)

    result = await get_subscription_status(request=None, userId="u_recruiter", user=user)

    assert result["tier"] == "professional"
    assert result["tierName"] == "Professional"
    assert result["status"] == "active"
    assert result["jobPostingsUsed"] == 2
    assert result["dialogueSlotsUsed"] == 5
    assert result["assessmentsAvailable"] == 140  # 150 - 10
