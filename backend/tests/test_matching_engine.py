import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.matching_engine.feature_store import extract_candidate_features, extract_job_features
from backend.app.matching_engine.scoring import score_job
from backend.app.matching_engine import serve


def test_score_job_includes_inferred_and_leadership_skills():
    candidate = {
        "job_title": "projektovy manazer",
        "skills": ["python", "scrum"],
        "inferred_skills": ["vedeni tymu"],
        "leadership": ["koucovani"],
        "address": "brno",
        "work_preferences": ["hybrid"],
    }
    job = {
        "title": "Senior Project Manager",
        "description": "Hledame kandidata se scrum, vedeni tymu a koucovani.",
        "location": "Brno",
        "country_code": "cs",
        "salary_from": 90000,
        "currency": "czk",
    }

    score, reasons, breakdown = score_job(
        extract_candidate_features(candidate),
        extract_job_features(job),
        semantic_similarity=0.8,
    )

    assert score >= 25
    assert breakdown["skill_match"] > 0
    assert breakdown["seniority_alignment"] >= 0
    assert isinstance(breakdown.get("taxonomy_version"), str)
    assert isinstance(breakdown["missing_core_skills"], list)
    assert len(reasons) >= 1


def test_score_job_returns_zero_like_for_empty():
    score, reasons, breakdown = score_job(
        extract_candidate_features({}),
        extract_job_features({}),
        semantic_similarity=0.0,
    )
    assert score >= 0
    assert isinstance(reasons, list)
    assert "total" in breakdown


def test_score_job_penalizes_strong_domain_mismatch():
    candidate = {
        "job_title": "Senior Python Developer",
        "skills": ["python", "react", "kubernetes", "backend"],
        "address": "Brno",
    }
    job = {
        "title": "Řezník - uzenář",
        "description": "Bourání masa, výroba uzenin, HACCP, kontrola kvality surovin.",
        "location": "Mikulov",
        "country_code": "cs",
        "salary_from": 42000,
        "currency": "czk",
    }

    score, reasons, breakdown = score_job(
        extract_candidate_features(candidate),
        extract_job_features(job),
        semantic_similarity=0.78,  # even with high semantic prior, mismatch must be penalized
    )

    assert breakdown["domain_mismatch"] is True
    assert breakdown["domain_alignment"] <= 0.2
    assert "butcher" in (breakdown.get("missing_required_qualifications") or [])
    assert breakdown.get("hard_cap") <= 10.0
    assert score <= 10.0
    assert any("oborovy nesoulad" in reason.lower() for reason in reasons)


def test_score_job_penalizes_missing_required_qualification_multilang():
    candidate = {
        "job_title": "Senior Frontend Developer",
        "skills": ["react", "typescript", "css"],
        "education": [{"school": "FIT VUT", "degree": "Ing.", "field": "Informatika"}],
    }
    job = {
        "title": "Facharzt (m/w/d) Innere Medizin",
        "description": "Arzt fuer internistische Ambulanz. Approbation erforderlich.",
        "location": "Wien",
        "country_code": "at",
        "salary_from": 5500,
        "currency": "eur",
    }

    score, reasons, breakdown = score_job(
        extract_candidate_features(candidate),
        extract_job_features(job),
        semantic_similarity=0.82,
    )

    assert "doctor" in (breakdown.get("missing_required_qualifications") or [])
    assert breakdown.get("hard_cap") <= 10.0
    assert score <= 10.0
    assert any("kvalifikace" in reason.lower() for reason in reasons)


def test_score_job_boosts_same_profession_driver():
    candidate = {
        "job_title": "Ridic C+E",
        "skills": ["tachograf", "rozvoz", "logistika"],
        "work_history": [{"role": "Ridic nakladni dopravy", "company": "Doprava CZ"}],
    }
    job = {
        "title": "Kierowca C+E (międzynarodowy)",
        "description": "Praca jako truck driver, obsługa tachografu, trasy międzynarodowe.",
        "location": "Brno",
        "country_code": "cz",
        "salary_from": 52000,
        "currency": "czk",
    }

    score, reasons, breakdown = score_job(
        extract_candidate_features(candidate),
        extract_job_features(job),
        semantic_similarity=0.45,
    )

    assert breakdown["role_transfer_alignment"] >= 0.95
    assert score >= 40
    assert any("profese je ve velmi silne shode" in reason.lower() for reason in reasons)


def test_score_job_allows_transfer_lakyrnik_to_malir():
    candidate = {
        "job_title": "Autolakyrnik",
        "skills": ["strikani", "priprava povrchu"],
        "work_history": [{"role": "Lakyrnik", "company": "Auto lakovna"}],
    }
    job = {
        "title": "Malir / naterac",
        "description": "Malirske a natiracske prace, priprava povrchu, interiery i exteriery.",
        "location": "Olomouc",
        "country_code": "cs",
        "salary_from": 36000,
        "currency": "czk",
    }

    score, reasons, breakdown = score_job(
        extract_candidate_features(candidate),
        extract_job_features(job),
        semantic_similarity=0.38,
    )

    assert breakdown["role_transfer_alignment"] >= 0.68
    assert score >= 30
    assert any(
        ("pribuzna a dobre prenositelna" in reason.lower())
        or ("velmi silne shode" in reason.lower())
        for reason in reasons
    )


def test_matching_prefers_relevant_manager_ai_dev_hotel_roles_over_unrelated_trades():
    candidate = {
        "job_title": "Provozni manazer / AI Product & Software",
        "skills": [
            "operations manager",
            "project management",
            "team lead",
            "ai",
            "machine learning",
            "python",
            "product management",
            "hotel operations",
            "guest relations",
        ],
        "inferred_skills": ["process optimization", "data analytics", "agile"],
        "work_history": [
            {"role": "Operations Manager", "company": "Hotel Group"},
            {"role": "Product Manager AI", "company": "Tech Startup"},
            {"role": "Software Developer", "company": "SaaS Co"},
        ],
        "education": [{"school": "VUT", "degree": "Ing.", "field": "Informatika"}],
        "address": "Brno",
    }

    good_jobs = [
        {
            "title": "Operations Manager (Hospitality)",
            "description": "Operations manager pro hotel, process manager, team lead, guest relations, planner.",
            "location": "Brno",
            "country_code": "cz",
            "salary_from": 70000,
            "currency": "czk",
        },
        {
            "title": "AI Product Manager",
            "description": "Product manager pro AI platformu, machine learning, roadmap, analytics, collaboration s engineering.",
            "location": "Brno",
            "country_code": "cz",
            "salary_from": 100000,
            "currency": "czk",
        },
        {
            "title": "Senior Python Developer",
            "description": "Software engineer, backend, python, cloud, fullstack, agile team.",
            "location": "Brno",
            "country_code": "cz",
            "salary_from": 95000,
            "currency": "czk",
        },
        {
            "title": "Hotel Specialist / Front Office Lead",
            "description": "Hotel specialist, front office, guest relations, operations, process manager.",
            "location": "Brno",
            "country_code": "cz",
            "salary_from": 55000,
            "currency": "czk",
        },
    ]

    bad_jobs = [
        {
            "title": "Reznik - uzenar",
            "description": "Bourani masa, vyroba uzenin, HACCP, porcovani masa.",
            "location": "Mikulov",
            "country_code": "cz",
            "salary_from": 42000,
            "currency": "czk",
        },
        {
            "title": "Elektrikar silnoproud",
            "description": "Paragraf 6/7, silnoproud, elektroinstalace, rozvadece.",
            "location": "Brno",
            "country_code": "cz",
            "salary_from": 50000,
            "currency": "czk",
        },
        {
            "title": "Ridic C+E",
            "description": "Kamionova doprava, ridic sk C+E, tachograf, mezinarodni preprava.",
            "location": "Brno",
            "country_code": "cz",
            "salary_from": 52000,
            "currency": "czk",
        },
    ]

    good_scores = []
    for job in good_jobs:
        score, _, breakdown = score_job(
            extract_candidate_features(candidate),
            extract_job_features(job),
            semantic_similarity=0.55,
        )
        good_scores.append((score, breakdown))

    bad_scores = []
    for job in bad_jobs:
        score, _, breakdown = score_job(
            extract_candidate_features(candidate),
            extract_job_features(job),
            semantic_similarity=0.55,
        )
        bad_scores.append((score, breakdown))

    assert min(score for score, _ in good_scores) >= 35
    assert max(score for score, _ in bad_scores) <= 20
    assert min(score for score, _ in good_scores) > max(score for score, _ in bad_scores)
    assert all(breakdown.get("hard_cap", 100) <= 15 for _, breakdown in bad_scores)


def test_canonical_role_match_boosts_ai_product_direction_over_marketing():
    candidate = {
        "job_title": "Product Manager",
        "skills": ["roadmap", "product discovery", "stakeholder management", "ai"],
    }
    intelligence = {
        "target_roles": ["ai product manager"],
        "canonical_target_roles": ["ai product manager"],
        "canonical_role_families": ["product_management"],
        "canonical_domains": ["product_management"],
    }
    ai_job = {
        "title": "AI Product Manager",
        "description": "Own roadmap for AI assistant platform and model-powered workflows.",
        "location": "Brno",
        "country_code": "cz",
        "job_intelligence": {
            "canonical_role": "AI Product Manager",
            "canonical_role_id": "ai_product_manager",
            "role_family": "product_management",
            "domain_key": "product_management",
            "seniority": "mid",
            "work_mode": "hybrid",
            "language_code": "en",
            "market_code": "cz",
            "cluster_key": "cz__product_management__product_management__mid__hybrid",
        },
    }
    marketing_job = {
        "title": "Marketing Manager",
        "description": "Own campaign strategy, content calendar and brand activation.",
        "location": "Brno",
        "country_code": "cz",
        "job_intelligence": {
            "canonical_role": "Marketing Manager",
            "canonical_role_id": "marketing_manager",
            "role_family": "marketing_growth",
            "domain_key": "marketing",
            "seniority": "mid",
            "work_mode": "hybrid",
            "language_code": "en",
            "market_code": "cz",
            "cluster_key": "cz__marketing__marketing_growth__mid__hybrid",
        },
    }

    ai_score, _, ai_breakdown = score_job(
        extract_candidate_features(candidate, intelligence=intelligence),
        extract_job_features(ai_job),
        semantic_similarity=0.55,
    )
    marketing_score, _, marketing_breakdown = score_job(
        extract_candidate_features(candidate, intelligence=intelligence),
        extract_job_features(marketing_job),
        semantic_similarity=0.55,
    )

    assert ai_breakdown["canonical_role_exact_match"] is True
    assert ai_breakdown["canonical_role_match"] > marketing_breakdown["canonical_role_match"]
    assert ai_breakdown["cluster_proximity"] > marketing_breakdown["cluster_proximity"]
    assert ai_score > marketing_score


def test_score_job_boosts_ai_enriched_target_role_match():
    candidate = {
        "job_title": "Operations Specialist",
        "skills": ["operations", "process optimization", "analytics"],
    }
    intelligence = {
        "target_roles": ["product manager ai", "ai systems architect"],
        "adjacent_roles": ["operations manager"],
        "priority_keywords": ["product roadmap", "ai platform", "cross-functional", "stakeholder management"],
        "avoid_keywords": ["ridic", "svarec", "reznik"],
        "preferred_work_modes": ["hybrid", "remote"],
        "source": "test",
    }
    job = {
        "title": "AI Product Manager",
        "description": "Product roadmap for AI platform, stakeholder management, cross-functional work with engineering.",
        "location": "Brno",
        "country_code": "cz",
        "type": "Hybrid",
        "salary_from": 95000,
        "currency": "czk",
    }

    score, reasons, breakdown = score_job(
        extract_candidate_features(candidate, intelligence=intelligence),
        extract_job_features(job),
        semantic_similarity=0.42,
    )

    assert breakdown["intent_alignment"] >= 0.65
    assert "product manager ai" in (breakdown.get("intent_matched_signals") or [])
    assert score >= 45
    assert any("jasny cil a kontext kandidata" in reason.lower() for reason in reasons)


def test_score_job_penalizes_ai_enriched_avoid_direction():
    candidate = {
        "job_title": "Product Manager",
        "skills": ["roadmap", "product discovery", "stakeholder management"],
    }
    intelligence = {
        "target_roles": ["product manager", "operations manager"],
        "adjacent_roles": ["program manager"],
        "priority_keywords": ["roadmap", "stakeholder", "process"],
        "avoid_keywords": ["ridic", "kamion", "tachograf"],
        "preferred_work_modes": ["hybrid"],
        "source": "test",
    }
    job = {
        "title": "Ridic C+E",
        "description": "Kamionova doprava, tachograf, mezinarodni preprava.",
        "location": "Brno",
        "country_code": "cz",
        "salary_from": 52000,
        "currency": "czk",
    }

    score, reasons, breakdown = score_job(
        extract_candidate_features(candidate, intelligence=intelligence),
        extract_job_features(job),
        semantic_similarity=0.38,
    )

    assert breakdown["intent_penalty"] > 0
    assert breakdown.get("intent_avoid_hits")
    assert breakdown.get("hard_cap") <= 20.0
    assert score <= 20.0
    assert any("jasnemu zameru kandidata" in reason.lower() for reason in reasons)


def test_batch_refresh_recommendations_reuses_prefetched_jobs(monkeypatch):
    class _Query:
        def __init__(self, table_name):
            self.table_name = table_name

        def select(self, _columns):
            return self

        def limit(self, _value):
            return self

        def execute(self):
            if self.table_name == "candidate_profiles":
                return type(
                    "Resp",
                    (),
                    {
                        "data": [
                            {"id": "user-1", "job_title": "Developer", "skills": ["python"]},
                            {"id": "user-2", "job_title": "Analyst", "skills": ["sql"]},
                        ]
                    },
                )()
            return type("Resp", (), {"data": []})()

    class _SupabaseStub:
        def table(self, name):
            return _Query(name)

    fetch_calls = []
    recommend_calls = []
    shared_jobs = [{"id": 1, "title": "Backend Developer", "description": "Python", "location": "Brno"}]
    shared_embeddings = {"1": [0.1, 0.2]}

    monkeypatch.setattr(serve, "supabase", _SupabaseStub())
    monkeypatch.setattr(
        serve,
        "fetch_recent_jobs",
        lambda limit, days: fetch_calls.append((limit, days)) or shared_jobs,
    )
    monkeypatch.setattr(
        serve,
        "ensure_job_embeddings",
        lambda jobs, persist=False: shared_embeddings,
    )
    monkeypatch.setattr(
        serve,
        "recommend_jobs_for_user",
        lambda user_id, limit=50, allow_cache=True, candidate=None, jobs=None, job_embeddings=None: recommend_calls.append(
            {
                "user_id": user_id,
                "candidate": candidate,
                "jobs": jobs,
                "job_embeddings": job_embeddings,
                "allow_cache": allow_cache,
                "limit": limit,
            }
        ) or [{"job": {"id": 1}}],
    )

    generated = serve.batch_refresh_recommendations()

    assert generated == 2
    assert len(fetch_calls) == 1
    assert len(recommend_calls) == 2
    assert recommend_calls[0]["jobs"] is shared_jobs
    assert recommend_calls[1]["jobs"] is shared_jobs
    assert recommend_calls[0]["job_embeddings"] is shared_embeddings
    assert recommend_calls[1]["job_embeddings"] is shared_embeddings
    assert recommend_calls[0]["candidate"]["id"] == "user-1"
    assert recommend_calls[1]["candidate"]["id"] == "user-2"


def test_regulated_professions_without_background_stay_near_floor():
    candidate = {
        "job_title": "Frontend Developer",
        "skills": ["react", "typescript", "css", "ux"],
        "work_history": [{"role": "Web Developer", "company": "Agency"}],
        "education": [{"school": "FIT", "degree": "Bc.", "field": "Informatika"}],
    }
    regulated_jobs = [
        {
            "title": "Lekarnik / Pharmacist",
            "description": "Prace v lekarne, farmacie, dispensace, klinicky farmaceut.",
            "location": "Brno",
            "country_code": "cz",
            "salary_from": 65000,
            "currency": "czk",
        },
        {
            "title": "Veterinarian (small animals)",
            "description": "Veterinarni lekar, klinika malych zvirat, chirurgie, medicina.",
            "location": "Brno",
            "country_code": "cz",
            "salary_from": 70000,
            "currency": "czk",
        },
        {
            "title": "Optometrist",
            "description": "Optometrista, vysetreni zraku, optometrie, kontaktni cocky.",
            "location": "Brno",
            "country_code": "cz",
            "salary_from": 60000,
            "currency": "czk",
        },
    ]

    for job in regulated_jobs:
        score, reasons, breakdown = score_job(
            extract_candidate_features(candidate),
            extract_job_features(job),
            semantic_similarity=0.7,
        )
        assert breakdown.get("missing_required_qualifications")
        assert breakdown.get("hard_cap") <= 10.0
        assert score <= 10.0
        assert any("kvalifikace" in reason.lower() for reason in reasons)


def test_hybrid_search_jobs_radius_keeps_remote_roles_but_filters_far_onsite(monkeypatch):
    rows = [
        {
            "id": "near-onsite",
            "title": "Operations Manager",
            "description": "Operations role in Brno.",
            "location": "Brno",
            "lat": 49.1951,
            "lng": 16.6068,
            "scraped_at": "2026-03-20T12:00:00+00:00",
        },
        {
            "id": "far-onsite",
            "title": "Office Manager",
            "description": "Onsite role in Prague.",
            "location": "Praha",
            "lat": 50.0755,
            "lng": 14.4378,
            "scraped_at": "2026-03-20T12:00:00+00:00",
        },
        {
            "id": "unknown-onsite",
            "title": "Project Coordinator",
            "description": "Onsite coordination role with missing coordinates.",
            "location": "Brno",
            "scraped_at": "2026-03-20T12:00:00+00:00",
        },
        {
            "id": "remote-no-coords",
            "title": "Product Owner",
            "description": "Fully remote role for product operations.",
            "location": "Remote",
            "work_model": "remote",
            "scraped_at": "2026-03-20T12:00:00+00:00",
        },
        {
            "id": "remote-far-coords",
            "title": "AI Product Manager",
            "description": "Remote-first AI role.",
            "location": "Praha / remote",
            "work_model": "remote",
            "lat": 50.0755,
            "lng": 14.4378,
            "scraped_at": "2026-03-20T12:00:00+00:00",
        },
    ]

    monkeypatch.setattr(serve, "jobs_postgres_main_enabled", lambda: True)
    monkeypatch.setattr(serve, "query_jobs_for_hybrid_search", lambda **_: rows)
    monkeypatch.setattr(serve, "get_release_flag", lambda *_a, **_k: {"effective_enabled": True})
    monkeypatch.setattr(serve, "get_active_model_config", lambda *_a, **_k: {"config_json": {}})

    result = serve.hybrid_search_jobs(
        {
            "search_term": "",
            "user_lat": 49.1951,
            "user_lng": 16.6068,
            "radius_km": 45,
        },
        page=0,
        page_size=20,
    )

    returned_ids = {job["id"] for job in result["jobs"]}
    assert "near-onsite" in returned_ids
    assert "remote-no-coords" in returned_ids
    assert "remote-far-coords" in returned_ids
    assert "far-onsite" not in returned_ids
    assert "unknown-onsite" not in returned_ids
