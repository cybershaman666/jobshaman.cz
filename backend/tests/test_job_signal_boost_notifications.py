import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import backend.app.services.job_signal_boost_notifications as notifications


class _Response:
    def __init__(self, data):
        self.data = data


class _TableQuery:
    def __init__(self, table_name: str, dataset):
        self.table_name = table_name
        self.dataset = dataset
        self.filters = {}
        self.single = False

    def select(self, _fields: str):
        return self

    def eq(self, key: str, value):
        self.filters[key] = value
        return self

    def maybe_single(self):
        self.single = True
        return self

    def execute(self):
        rows = [
            row for row in self.dataset.get(self.table_name, [])
            if all(row.get(key) == value for key, value in self.filters.items())
        ]
        if self.single:
            return _Response(rows[0] if rows else None)
        return _Response(rows)


class _SupabaseStub:
    def __init__(self, dataset):
        self.dataset = dataset

    def table(self, name: str):
        return _TableQuery(name, self.dataset)


def test_notify_candidate_of_signal_boost_interest_sends_only_on_first_strong_action(monkeypatch):
    sent = {"email": [], "push": []}
    monkeypatch.setattr(
        notifications,
        "supabase",
        _SupabaseStub(
            {
                "profiles": [
                    {
                        "id": "cand-1",
                        "email": "candidate@example.com",
                        "full_name": "Misha Novak",
                        "preferred_locale": "en",
                        "daily_digest_enabled": True,
                        "daily_digest_push_enabled": True,
                    }
                ],
                "push_subscriptions": [
                    {
                        "user_id": "cand-1",
                        "endpoint": "https://push.example/1",
                        "p256dh": "p256dh",
                        "auth": "auth",
                        "is_active": True,
                    }
                ],
            }
        ),
    )
    monkeypatch.setattr(notifications, "is_push_configured", lambda: True)
    monkeypatch.setattr(
        notifications,
        "send_signal_boost_interest_email",
        lambda **kwargs: sent["email"].append(kwargs) or True,
    )
    monkeypatch.setattr(
        notifications,
        "send_push",
        lambda subscription, payload: sent["push"].append((subscription, json.loads(payload))) or True,
    )

    delivery = notifications.notify_candidate_of_signal_boost_interest(
        {
            "candidate_id": "cand-1",
            "share_slug": "signal-123",
            "locale": "en",
            "job_snapshot": {"id": "job-123", "title": "AI Product Manager", "company": "JobShaman"},
            "analytics": {"view": 4, "recruiter_cta_click": 1, "open_original_listing": 0},
        }
    )

    assert delivery == {"email": True, "push": True}
    assert len(sent["email"]) == 1
    assert sent["email"][0]["job_title"] == "AI Product Manager"
    assert sent["email"][0]["signal_url"].endswith("/en/signal/signal-123")
    assert len(sent["push"]) == 1
    assert sent["push"][0][1]["url"].endswith("/en/jobs/job-123")


def test_notify_candidate_of_signal_boost_interest_defaults_to_existing_channels_when_prefs_missing(monkeypatch):
    sent = {"email": 0, "push": 0}
    monkeypatch.setattr(
        notifications,
        "supabase",
        _SupabaseStub(
            {
                "profiles": [
                    {
                        "id": "cand-2",
                        "email": "candidate@example.com",
                        "full_name": "Danijela",
                        "preferred_locale": "cs",
                        "daily_digest_enabled": None,
                        "daily_digest_push_enabled": None,
                    }
                ],
                "push_subscriptions": [
                    {
                        "user_id": "cand-2",
                        "endpoint": "https://push.example/2",
                        "p256dh": "p256dh",
                        "auth": "auth",
                        "is_active": True,
                    }
                ],
            }
        ),
    )
    monkeypatch.setattr(notifications, "is_push_configured", lambda: True)
    monkeypatch.setattr(
        notifications,
        "send_signal_boost_interest_email",
        lambda **_kwargs: sent.__setitem__("email", sent["email"] + 1) or True,
    )
    monkeypatch.setattr(
        notifications,
        "send_push",
        lambda *_args, **_kwargs: sent.__setitem__("push", sent["push"] + 1) or True,
    )

    delivery = notifications.notify_candidate_of_signal_boost_interest(
        {
            "candidate_id": "cand-2",
            "share_slug": "signal-456",
            "locale": "cs",
            "job_snapshot": {"title": "Customer Support Specialist", "company": "JobShaman"},
            "analytics": {"view": 2, "recruiter_cta_click": 0, "open_original_listing": 1},
        }
    )

    assert delivery == {"email": True, "push": True}
    assert sent == {"email": 1, "push": 1}


def test_notify_candidate_of_signal_boost_interest_ignores_repeated_strong_actions(monkeypatch):
    sent = {"email": 0, "push": 0}
    monkeypatch.setattr(
        notifications,
        "supabase",
        _SupabaseStub(
            {
                "profiles": [
                    {
                        "id": "cand-3",
                        "email": "candidate@example.com",
                        "full_name": "Alex",
                        "preferred_locale": "en",
                        "daily_digest_enabled": True,
                        "daily_digest_push_enabled": True,
                    }
                ],
                "push_subscriptions": [
                    {
                        "user_id": "cand-3",
                        "endpoint": "https://push.example/3",
                        "p256dh": "p256dh",
                        "auth": "auth",
                        "is_active": True,
                    }
                ],
            }
        ),
    )
    monkeypatch.setattr(notifications, "is_push_configured", lambda: True)
    monkeypatch.setattr(
        notifications,
        "send_signal_boost_interest_email",
        lambda **_kwargs: sent.__setitem__("email", sent["email"] + 1) or True,
    )
    monkeypatch.setattr(
        notifications,
        "send_push",
        lambda *_args, **_kwargs: sent.__setitem__("push", sent["push"] + 1) or True,
    )

    delivery = notifications.notify_candidate_of_signal_boost_interest(
        {
            "candidate_id": "cand-3",
            "share_slug": "signal-789",
            "locale": "en",
            "job_snapshot": {"id": "job-789", "title": "Operations Coordinator", "company": "JobShaman"},
            "analytics": {"recruiter_cta_click": 1, "open_original_listing": 1},
        }
    )

    assert delivery == {"email": False, "push": False}
    assert sent == {"email": 0, "push": 0}
