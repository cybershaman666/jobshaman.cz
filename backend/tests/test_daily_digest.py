from backend.app.services.daily_digest import (
    _candidate_has_matching_signal,
    _country_from_address,
    _country_from_coordinates,
    _resolve_digest_country_code,
    _should_send_now,
)
import backend.app.services.daily_digest as daily_digest_module
from datetime import datetime
from zoneinfo import ZoneInfo


def test_candidate_matching_signal_accepts_job_title_only():
    candidate = {
        "job_title": "Projektovy manazer",
        "skills": [],
        "cv_text": "",
        "cv_ai_text": "",
    }
    assert _candidate_has_matching_signal(candidate) is True


def test_country_from_coordinates_resolves_czechia():
    # Popice area (South Moravia)
    code = _country_from_coordinates(48.928, 16.672)
    assert code == "CZ"


def test_country_from_address_detects_czechia():
    code = _country_from_address("Popice, Czechia")
    assert code == "CZ"


def test_resolve_digest_country_prefers_explicit_profile_country():
    code = _resolve_digest_country_code(
        preferred_country_code="sk",
        preferred_locale="cs",
        candidate_profile={"address": "Popice, Czechia"},
        c_lat=48.928,
        c_lng=16.672,
    )
    assert code == "SK"


def test_resolve_digest_country_uses_locale_when_country_missing():
    code = _resolve_digest_country_code(
        preferred_country_code=None,
        preferred_locale="cs",
        candidate_profile={"address": "Popice"},
        c_lat=None,
        c_lng=None,
    )
    assert code == "CZ"


def test_should_send_now_allows_second_send_same_day_after_time_shift(monkeypatch):
    tz = ZoneInfo("Europe/Prague")
    fixed_now = datetime(2026, 2, 22, 12, 35, tzinfo=tz)

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed_now if tz is not None else fixed_now.replace(tzinfo=None)

    monkeypatch.setattr(daily_digest_module, "datetime", FrozenDateTime)

    # Last digest was sent in the morning local time (same day),
    # but today's configured window starts at 12:30.
    last_sent_utc = "2026-02-22T06:33:17+00:00"
    assert _should_send_now(last_sent_utc, datetime.strptime("12:30", "%H:%M").time(), "Europe/Prague") is True


def test_should_send_now_blocks_when_already_sent_in_current_window(monkeypatch):
    tz = ZoneInfo("Europe/Prague")
    fixed_now = datetime(2026, 2, 22, 12, 35, tzinfo=tz)

    class FrozenDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed_now if tz is not None else fixed_now.replace(tzinfo=None)

    monkeypatch.setattr(daily_digest_module, "datetime", FrozenDateTime)

    # Last digest already sent after today's 12:30 window started.
    last_sent_utc = "2026-02-22T11:31:00+00:00"
    assert _should_send_now(last_sent_utc, datetime.strptime("12:30", "%H:%M").time(), "Europe/Prague") is False
