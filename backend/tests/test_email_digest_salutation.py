from backend.app.services.email import (
    _extract_first_name,
    _resolve_daily_digest_job_url,
    _to_czech_vocative,
)


def test_extract_first_name_trims_punctuation():
    assert _extract_first_name("Matěj, Novák") == "Matěj"


def test_czech_vocative_for_matej():
    assert _to_czech_vocative("Matěj") == "Matěji"


def test_czech_vocative_for_martin():
    assert _to_czech_vocative("Martin") == "Martine"


def test_daily_digest_job_url_uses_candidate_imported_fallback():
    assert (
        _resolve_daily_digest_job_url({"id": "200803"}, "https://jobshaman.com")
        == "https://jobshaman.com/candidate/imported/200803"
    )


def test_daily_digest_job_url_rewrites_legacy_jobs_detail_url():
    assert (
        _resolve_daily_digest_job_url(
            {"id": "200803", "detail_url": "https://jobshaman.com/jobs/200803"},
            "https://jobshaman.com",
        )
        == "https://jobshaman.com/candidate/imported/200803"
    )


def test_daily_digest_job_url_keeps_existing_candidate_url():
    assert (
        _resolve_daily_digest_job_url(
            {
                "id": "6456c9b4-6c29-52d3-bbcc-d17e2b48c188",
                "detail_url": "https://jobshaman.com/candidate/imported/6456c9b4-6c29-52d3-bbcc-d17e2b48c188",
            },
            "https://jobshaman.com",
        )
        == "https://jobshaman.com/candidate/imported/6456c9b4-6c29-52d3-bbcc-d17e2b48c188"
    )
