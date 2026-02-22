from backend.app.matching_engine.feature_store import extract_candidate_features, extract_job_features
from backend.app.matching_engine.scoring import score_job


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
