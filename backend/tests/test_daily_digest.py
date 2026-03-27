from backend.app.services.daily_digest import (
    _candidate_has_matching_signal,
    _country_from_address,
    _country_from_coordinates,
    _did_any_enabled_digest_channel_succeed,
    _digest_job_sort_key,
    _extract_city_from_address,
    _is_remote_job,
    _job_language_allowed,
    _job_role_families,
    _pick_personalized_digest_jobs,
    _resolve_digest_profile_filters,
    _resolve_digest_country_code,
    _resolve_locale,
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


def test_extract_city_from_address_skips_country_suffix():
    assert _extract_city_from_address("Popice, Czechia") == "Popice"


def test_extract_city_from_address_prefers_city_before_country_and_postcode():
    assert _extract_city_from_address("U Sadu 12, 602 00 Brno, Czechia") == "Brno"


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


def test_resolve_digest_country_uses_timezone_when_locale_missing():
    code = _resolve_digest_country_code(
        preferred_country_code=None,
        preferred_locale=None,
        candidate_profile={"address": ""},
        c_lat=None,
        c_lng=None,
        digest_timezone="Europe/Prague",
    )
    assert code == "CZ"


def test_resolve_digest_country_prefers_locale_over_vienna_timezone():
    code = _resolve_digest_country_code(
        preferred_country_code=None,
        preferred_locale="cs",
        candidate_profile={"address": ""},
        c_lat=None,
        c_lng=None,
        digest_timezone="Europe/Vienna",
    )
    assert code == "CZ"


def test_resolve_digest_country_prefers_address_over_vienna_timezone():
    code = _resolve_digest_country_code(
        preferred_country_code=None,
        preferred_locale=None,
        candidate_profile={"address": "Brno, Czechia"},
        c_lat=None,
        c_lng=None,
        digest_timezone="Europe/Vienna",
    )
    assert code == "CZ"


def test_resolve_locale_prefers_country_default_for_conflicting_german_locale():
    assert _resolve_locale("de", "CZ") == "cs"


def test_resolve_locale_keeps_english_for_czech_user():
    assert _resolve_locale("en", "CZ") == "en"


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


def test_digest_delivery_succeeds_when_push_succeeds_even_if_email_fails():
    assert _did_any_enabled_digest_channel_succeed(
        email_enabled=True,
        email_ok=False,
        push_enabled=True,
        push_ok=True,
    ) is True


def test_digest_delivery_fails_when_no_enabled_channel_succeeds():
    assert _did_any_enabled_digest_channel_succeed(
        email_enabled=True,
        email_ok=False,
        push_enabled=False,
        push_ok=False,
    ) is False


def test_is_remote_job_does_not_treat_hybrid_as_fully_remote():
    hybrid_job = {
        "work_model": "hybrid",
        "work_type": "",
        "title": "Backend Developer",
        "description": "Hybrid mode",
        "location": "Brno",
    }
    assert _is_remote_job(hybrid_job) is False


def test_digest_sort_prefers_nearby_then_relevance():
    near_lower_score = {"distance_km": 8.0, "match_score": 77}
    far_higher_score = {"distance_km": 42.0, "match_score": 99}
    remote_higher_score = {"distance_km": None, "match_score": 100}

    ordered = sorted([far_higher_score, remote_higher_score, near_lower_score], key=_digest_job_sort_key)
    assert ordered == [near_lower_score, far_higher_score, remote_higher_score]


def test_pick_personalized_digest_jobs_falls_back_to_nonlocal_ai_matches():
    recs = [
        {
            "score": 96,
            "job": {
                "id": "job-remote-1",
                "title": "Senior Python Developer",
                "company": "Acme",
                "company_name": "Acme",
                "location": "Unknown",
                "country_code": "CZ",
                "work_model": "onsite",
                "lat": None,
                "lng": None,
            },
        },
        {
            "score": 88,
            "job": {
                "id": "job-far-1",
                "title": "Data Engineer",
                "company": "DataCorp",
                "company_name": "DataCorp",
                "location": "Ostrava",
                "country_code": "CZ",
                "work_model": "onsite",
                "lat": 49.8209,
                "lng": 18.2625,
            },
        },
    ]

    picks = _pick_personalized_digest_jobs(
        recs=recs,
        c_lat=48.1486,  # Bratislava area; far from Ostrava (>50km)
        c_lng=17.1077,
        country_code="CZ",
        limit=5,
    )

    assert len(picks) == 2
    assert picks[0]["id"] == "job-far-1"
    assert picks[0]["match_score"] == 88
    assert picks[1]["id"] == "job-remote-1"
    assert picks[1]["match_score"] == 96


def test_job_language_allowed_prefers_job_intelligence_language_code():
    job = {
        "language_code": "",
        "job_intelligence": {
            "language_code": "de",
        },
    }

    assert _job_language_allowed(job, {"de"}) is True
    assert _job_language_allowed(job, {"cs"}) is False


def test_job_role_families_prefers_job_intelligence_family():
    job = {
        "title": "Generic role",
        "description": "",
        "job_intelligence": {
            "role_family": "operations_coordination",
        },
    }

    assert _job_role_families(job) == {"operations_coordination"}


def test_persist_digest_last_sent_updates_profiles_and_candidate_fallback(monkeypatch):
    updates = []
    original_process_markers = dict(daily_digest_module._PROCESS_DIGEST_LAST_SENT_AT)
    daily_digest_module._PROCESS_DIGEST_LAST_SENT_AT.clear()

    class _Query:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.filters = {}

        def update(self, payload):
            self.payload = payload
            return self

        def eq(self, column, value):
            self.filters[column] = value
            return self

        def execute(self):
            updates.append(
                {
                    "table": self.table_name,
                    "payload": self.payload,
                    "filters": dict(self.filters),
                }
            )
            return type("Resp", (), {"data": [{"id": self.filters.get("id")}]} )()

    class _SupabaseStub:
        def table(self, name):
            return _Query(name)

    monkeypatch.setattr(daily_digest_module, "supabase", _SupabaseStub())

    sent_at = "2026-03-04T09:15:00+00:00"
    daily_digest_module._persist_digest_last_sent(
        user_id="user-1",
        candidate_profile={"preferences": {"existing": True}},
        sent_at_iso=sent_at,
    )

    assert daily_digest_module._PROCESS_DIGEST_LAST_SENT_AT["user-1"] == sent_at
    assert updates[0] == {
        "table": "profiles",
        "payload": {"daily_digest_last_sent_at": sent_at},
        "filters": {"id": "user-1"},
    }
    assert updates[1]["table"] == "candidate_profiles"
    assert updates[1]["filters"] == {"id": "user-1"}
    assert updates[1]["payload"]["preferences"]["existing"] is True
    assert updates[1]["payload"]["preferences"]["system"]["dailyDigestLastSentAt"] == sent_at

    daily_digest_module._PROCESS_DIGEST_LAST_SENT_AT.clear()
    daily_digest_module._PROCESS_DIGEST_LAST_SENT_AT.update(original_process_markers)


def test_run_daily_job_digest_backfills_profile_last_sent_from_fallback(monkeypatch):
    profile_updates = []

    class _Query:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.filters = {}

        def select(self, _columns):
            return self

        def in_(self, column, values):
            self.filters[column] = list(values)
            return self

        def eq(self, column, value):
            self.filters[column] = value
            return self

        def or_(self, _expr):
            return self

        def update(self, payload):
            self.payload = payload
            return self

        def execute(self):
            if self.table_name == "profiles" and self.payload is None:
                return type(
                    "Resp",
                    (),
                    {
                        "data": [
                            {
                                "id": "user-1",
                                "email": "candidate@example.com",
                                "full_name": "Candidate",
                                "preferred_locale": "cs",
                                "preferred_country_code": "CZ",
                                "daily_digest_enabled": True,
                                "daily_digest_last_sent_at": None,
                                "daily_digest_time": "10:00",
                                "daily_digest_timezone": "UTC",
                                "daily_digest_push_enabled": False,
                                "candidate_profiles": {
                                    "preferences": {
                                        "system": {
                                            "dailyDigestLastSentAt": "2026-03-04T08:00:00+00:00"
                                        }
                                    }
                                },
                            }
                        ]
                    },
                )()
            if self.table_name == "profiles" and self.payload is not None:
                profile_updates.append(
                    {
                        "payload": self.payload,
                        "filters": dict(self.filters),
                    }
                )
                return type("Resp", (), {"data": [{"id": self.filters.get("id")}]} )()
            return type("Resp", (), {"data": []})()

    class _SupabaseStub:
        def table(self, name):
            return _Query(name)

    monkeypatch.setattr(daily_digest_module, "supabase", _SupabaseStub())
    monkeypatch.setattr(daily_digest_module, "_should_send_now", lambda *_args, **_kwargs: False)

    daily_digest_module.run_daily_job_digest()

    assert profile_updates == [
        {
            "payload": {"daily_digest_last_sent_at": "2026-03-04T08:00:00+00:00"},
            "filters": {"id": "user-1"},
        }
    ]


def test_persist_digest_last_sent_supports_update_builders_without_select(monkeypatch):
    updates = []

    class _Query:
        def __init__(self, table_name):
            self.table_name = table_name
            self.payload = None
            self.filters = {}

        def update(self, payload):
            self.payload = payload
            return self

        def eq(self, column, value):
            self.filters[column] = value
            return self

        def execute(self):
            updates.append(
                {
                    "table": self.table_name,
                    "payload": self.payload,
                    "filters": dict(self.filters),
                }
            )
            return type("Resp", (), {"data": None})()

    class _SupabaseStub:
        def table(self, name):
            return _Query(name)

    monkeypatch.setattr(daily_digest_module, "supabase", _SupabaseStub())

    assert daily_digest_module._update_profile_digest_last_sent("user-1", "2026-03-06T10:00:00+00:00") is True
    assert daily_digest_module._persist_candidate_digest_last_sent(
        "user-1",
        {"preferences": {"existing": True}},
        "2026-03-06T10:00:00+00:00",
    ) is True
    assert updates[0]["table"] == "profiles"
    assert updates[1]["table"] == "candidate_profiles"


def test_pick_personalized_digest_jobs_filters_incompatible_language():
    recs = [
        {
            "score": 90,
            "job": {
                "id": "job-cs-1",
                "title": "Ridic C+E",
                "company": "LogiCZ",
                "company_name": "LogiCZ",
                "location": "Brno",
                "country_code": "CZ",
                "language_code": "cs",
                "work_model": "onsite",
                "lat": 49.1951,
                "lng": 16.6068,
            },
        },
        {
            "score": 92,
            "job": {
                "id": "job-en-1",
                "title": "Truck Driver",
                "company": "GlobalTrans",
                "company_name": "GlobalTrans",
                "location": "Brno",
                "country_code": "CZ",
                "language_code": "en",
                "work_model": "onsite",
                "lat": 49.1951,
                "lng": 16.6068,
            },
        },
    ]

    picks = _pick_personalized_digest_jobs(
        recs=recs,
        c_lat=49.1951,
        c_lng=16.6068,
        country_code="CZ",
        allowed_language_codes={"cs", "sk"},
        candidate_profile={"job_title": "Ridic", "skills": ["ridic"], "cv_text": "", "cv_ai_text": ""},
        limit=5,
    )

    assert len(picks) == 1
    assert picks[0]["id"] == "job-cs-1"


def test_pick_personalized_digest_jobs_skips_it_roles_when_profile_is_driver():
    recs = [
        {
            "score": 95,
            "job": {
                "id": "job-dev-1",
                "title": "Full Stack Developer",
                "company": "TechCo",
                "company_name": "TechCo",
                "location": "Brno",
                "country_code": "CZ",
                "language_code": "cs",
                "work_model": "remote",
                "lat": None,
                "lng": None,
            },
        },
        {
            "score": 80,
            "job": {
                "id": "job-driver-1",
                "title": "Ridic kamionu C+E",
                "company": "Doprava Plus",
                "company_name": "Doprava Plus",
                "location": "Brno",
                "country_code": "CZ",
                "language_code": "cs",
                "work_model": "onsite",
                "lat": 49.1951,
                "lng": 16.6068,
            },
        },
    ]

    picks = _pick_personalized_digest_jobs(
        recs=recs,
        c_lat=49.1951,
        c_lng=16.6068,
        country_code="CZ",
        allowed_language_codes={"cs"},
        candidate_profile={"job_title": "Ridic", "skills": ["ridic"], "cv_text": "", "cv_ai_text": ""},
        limit=5,
    )

    assert len(picks) == 1
    assert picks[0]["id"] == "job-driver-1"


def test_resolve_digest_profile_filters_reads_search_profile_defaults():
    candidate_profile = {
        "address": "Brno, Czechia",
        "preferences": {
            "searchProfile": {
                "nearBorder": True,
                "wantsContractorRoles": True,
                "wantsDogFriendlyOffice": True,
                "wantsRemoteRoles": False,
                "preferredWorkArrangement": "hybrid",
                "remoteLanguageCodes": ["en", "de"],
                "preferredBenefitKeys": ["meal_allowance"],
                "defaultEnableCommuteFilter": True,
                "defaultMaxDistanceKm": 45,
            }
        },
    }

    filters = _resolve_digest_profile_filters(
        candidate_profile,
        base_language_codes={"cs", "sk"},
        digest_country_code="CZ",
        c_lat=49.1951,
        c_lng=16.6068,
    )

    assert filters["enable_commute_filter"] is True
    assert filters["max_distance_km"] == 45.0
    assert filters["filter_work_arrangement"] == "hybrid"
    assert filters["remote_only"] is False
    assert filters["language_codes"] == {"cs", "sk"}
    assert filters["country_scope"] == {"CZ", "SK", "PL", "DE", "AT"}
    assert "ico" in filters["contract_filter_tags"]
    assert {"meal_allowance", "dog_friendly"}.issubset(filters["benefit_filter_tags"])


def test_pick_personalized_digest_jobs_respects_remote_language_contract_and_benefit_preferences():
    candidate_profile = {
        "address": "Brno, Czechia",
        "preferences": {
            "searchProfile": {
                "nearBorder": False,
                "wantsContractorRoles": True,
                "wantsDogFriendlyOffice": False,
                "wantsRemoteRoles": True,
                "preferredWorkArrangement": "remote",
                "remoteLanguageCodes": ["en", "de"],
                "preferredBenefitKeys": ["meal_allowance"],
                "defaultEnableCommuteFilter": False,
                "defaultMaxDistanceKm": 30,
            }
        },
    }
    digest_filters = _resolve_digest_profile_filters(
        candidate_profile,
        base_language_codes={"cs", "sk"},
        digest_country_code="CZ",
        c_lat=49.1951,
        c_lng=16.6068,
    )
    recs = [
        {
            "score": 96,
            "job": {
                "id": "job-remote-b2b-en",
                "title": "Remote Product Owner",
                "company": "Acme",
                "company_name": "Acme",
                "location": "Prague",
                "country_code": "CZ",
                "language_code": "en",
                "work_model": "remote",
                "contract_type": "B2B / ICO",
                "benefits": ["Meal allowance", "Home office"],
                "lat": None,
                "lng": None,
            },
        },
        {
            "score": 94,
            "job": {
                "id": "job-onsite-b2b-en",
                "title": "Operations Lead",
                "company": "OpsCo",
                "company_name": "OpsCo",
                "location": "Brno",
                "country_code": "CZ",
                "language_code": "en",
                "work_model": "onsite",
                "contract_type": "B2B / ICO",
                "benefits": ["Meal allowance"],
                "lat": 49.1951,
                "lng": 16.6068,
            },
        },
        {
            "score": 92,
            "job": {
                "id": "job-remote-hpp-en",
                "title": "Remote Product Owner",
                "company": "ScaleUp",
                "company_name": "ScaleUp",
                "location": "Remote",
                "country_code": "CZ",
                "language_code": "en",
                "work_model": "remote",
                "contract_type": "HPP",
                "benefits": ["Meal allowance"],
                "lat": None,
                "lng": None,
            },
        },
        {
            "score": 90,
            "job": {
                "id": "job-remote-b2b-cs",
                "title": "Remote Product Owner",
                "company": "LocaleCo",
                "company_name": "LocaleCo",
                "location": "Remote",
                "country_code": "CZ",
                "language_code": "cs",
                "work_model": "remote",
                "contract_type": "ICO",
                "benefits": ["Meal allowance"],
                "lat": None,
                "lng": None,
            },
        },
    ]

    picks = _pick_personalized_digest_jobs(
        recs=recs,
        c_lat=49.1951,
        c_lng=16.6068,
        country_code="CZ",
        allowed_language_codes={"cs", "sk"},
        candidate_profile=candidate_profile,
        digest_filters=digest_filters,
        limit=5,
    )

    assert [job["id"] for job in picks] == ["job-remote-b2b-en"]


def test_pick_personalized_digest_jobs_respects_commute_radius_and_near_border_scope():
    candidate_profile = {
        "address": "Breclav, Czechia",
        "preferences": {
            "searchProfile": {
                "nearBorder": True,
                "wantsContractorRoles": False,
                "wantsDogFriendlyOffice": False,
                "wantsRemoteRoles": False,
                "preferredWorkArrangement": "onsite",
                "remoteLanguageCodes": ["cs"],
                "preferredBenefitKeys": [],
                "defaultEnableCommuteFilter": True,
                "defaultMaxDistanceKm": 30,
            }
        },
    }
    digest_filters = _resolve_digest_profile_filters(
        candidate_profile,
        base_language_codes={"cs", "sk"},
        digest_country_code="CZ",
        c_lat=48.758,
        c_lng=16.882,
    )
    recs = [
        {
            "score": 91,
            "job": {
                "id": "job-vienna-near",
                "title": "Site Operations Coordinator",
                "company": "AT Build",
                "company_name": "AT Build",
                "location": "Poysdorf",
                "country_code": "AT",
                "language_code": "cs",
                "work_model": "onsite",
                "contract_type": "HPP",
                "benefits": [],
                "lat": 48.669,
                "lng": 16.635,
            },
        },
        {
            "score": 95,
            "job": {
                "id": "job-prague-far",
                "title": "Site Operations Coordinator",
                "company": "CZ Build",
                "company_name": "CZ Build",
                "location": "Praha",
                "country_code": "CZ",
                "language_code": "cs",
                "work_model": "onsite",
                "contract_type": "HPP",
                "benefits": [],
                "lat": 50.0755,
                "lng": 14.4378,
            },
        },
    ]

    picks = _pick_personalized_digest_jobs(
        recs=recs,
        c_lat=48.758,
        c_lng=16.882,
        country_code="CZ",
        allowed_language_codes={"cs", "sk", "de"},
        candidate_profile=candidate_profile,
        digest_filters=digest_filters,
        limit=5,
    )

    assert [job["id"] for job in picks] == ["job-vienna-near"]


def test_run_daily_job_digest_retries_without_language_restriction(monkeypatch):
    class _Query:
        def __init__(self, table_name, payload=None):
            self.table_name = table_name
            self.payload = payload

        def select(self, *_args, **_kwargs):
            return self

        def in_(self, *_args, **_kwargs):
            return self

        def eq(self, *_args, **_kwargs):
            return self

        def or_(self, *_args, **_kwargs):
            return self

        def update(self, payload):
            self.payload = payload
            return self

        def execute(self):
            if self.table_name == "profiles" and self.payload is None:
                return type(
                    "Resp",
                    (),
                    {
                        "data": [
                            {
                                "id": "user-1",
                                "email": "candidate@example.com",
                                "full_name": "Candidate",
                                "preferred_locale": "cs",
                                "preferred_country_code": "CZ",
                                "daily_digest_enabled": True,
                                "daily_digest_last_sent_at": None,
                                "daily_digest_time": "10:00",
                                "daily_digest_timezone": "UTC",
                                "daily_digest_push_enabled": False,
                                "candidate_profiles": {
                                    "address": "Brno, Czechia",
                                    "job_title": "",
                                    "skills": [],
                                    "cv_text": "",
                                    "cv_ai_text": "",
                                },
                            }
                        ]
                    },
                )()
            return type("Resp", (), {"data": []})()

    class _SupabaseStub:
        def table(self, name):
            return _Query(name)

    relaxed_calls = []
    sent_jobs = []

    def _relaxed_stub(country_code=None, allowed_language_codes=None, **_kwargs):
        relaxed_calls.append((country_code, allowed_language_codes))
        if allowed_language_codes is None and country_code == "CZ":
            return [
                {
                    "id": "job-1",
                    "title": "Operator vyroby",
                    "company": "Factory",
                    "location": "Brno",
                    "match_score": None,
                    "detail_url": "https://jobshaman.cz/jobs/job-1",
                }
            ]
        return []

    def _email_stub(**kwargs):
        sent_jobs.append(kwargs["jobs"])
        return True

    monkeypatch.setattr(daily_digest_module, "supabase", _SupabaseStub())
    monkeypatch.setattr(daily_digest_module, "_should_send_now", lambda *_args, **_kwargs: True)
    monkeypatch.setattr(daily_digest_module, "_fetch_newest_local_jobs", lambda **_kwargs: [])
    monkeypatch.setattr(daily_digest_module, "_fetch_newest_jobs_relaxed", _relaxed_stub)
    monkeypatch.setattr(daily_digest_module, "send_daily_digest_email", _email_stub)
    monkeypatch.setattr(daily_digest_module, "is_push_configured", lambda: False)

    daily_digest_module.run_daily_job_digest()

    assert relaxed_calls == [("CZ", {"cs", "sk"}), ("CZ", None)]
    assert len(sent_jobs) == 1
    assert sent_jobs[0][0]["id"] == "job-1"
