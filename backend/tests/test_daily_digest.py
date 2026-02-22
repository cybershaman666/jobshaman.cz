from backend.app.services.daily_digest import (
    _candidate_has_matching_signal,
    _country_from_address,
    _country_from_coordinates,
    _resolve_digest_country_code,
)


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
