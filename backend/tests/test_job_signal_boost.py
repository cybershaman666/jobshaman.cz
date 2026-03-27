import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import backend.app.services.job_signal_boost as job_signal_boost


def _job(title: str, **overrides):
    payload = {
        "id": overrides.pop("id", "job-1"),
        "title": title,
        "company": overrides.pop("company", "JobShaman Labs"),
        "description": overrides.pop("description", title),
        "location": overrides.pop("location", "Prague"),
        "country_code": overrides.pop("country_code", "CZ"),
        "language_code": overrides.pop("language_code", "en"),
        "work_model": overrides.pop("work_model", "hybrid"),
        "work_type": overrides.pop("work_type", "full-time"),
        "role_summary": overrides.pop("role_summary", ""),
        "tags": overrides.pop("tags", []),
    }
    payload.update(overrides)
    return payload


def _strong_payload() -> dict[str, str]:
    return {
        "problem_frame": (
            "The real issue is not only a visible delay. The next decisions could still go wrong because the live state on the ground is noisier than the plan."
        ),
        "first_step": (
            "First I would verify where the active sequence is blocked, call the trade leads, and compare the real site state with the latest plan before I touch the schedule."
        ),
        "solution_direction": (
            "I would stabilize the next critical sequence before widening the intervention. That means I would not reshuffle the whole plan yet, because I need to protect the dependencies that are still holding."
        ),
        "risk_and_unknowns": (
            "I still need confirmed readiness from the subcontractors, a clear safety view, and a reliable picture of which resources and permits are truly available before I commit the next move."
        ),
        "stakeholder_note": (
            "Then I would align the immediate plan with the PM and the trade leads so everyone is working from the same version of reality."
        ),
    }


def _candidate_profile_with_jcfpm(**overrides):
    percentile_summary = {
        "d1_cognitive": 82,
        "d2_social": 34,
        "d3_motivational": 58,
        "d4_energy": 41,
        "d6_ai_readiness": 71,
        "d12_moral_compass": 77,
    }
    percentile_summary.update(overrides.pop("percentile_summary", {}))
    ai_report = {
        "strengths": ["Strong systems thinking in messy contexts."],
        "ideal_environment": ["Works best when first reading reality before forcing activity."],
        "development_areas": ["Can get drained by heavy follow-up and constant people-chasing."],
        "top_roles": [{"title": "Product Manager", "reason": "Systems and prioritization."}],
    }
    ai_report.update(overrides.pop("ai_report", {}))
    return {
        "preferences": {
            "jcfpm_v1": {
                "percentile_summary": percentile_summary,
                "ai_report": ai_report,
            }
        }
    }


def test_construction_supervisor_brief_uses_broader_taxonomy_fallback():
    brief = job_signal_boost.build_signal_boost_brief(
        _job(
            "Stavbyvedouci",
            description=(
                "Coordinate subcontractors, keep site safety under control, and manage schedule pressure when material deliveries and crew readiness shift."
            ),
            tags=["construction", "subcontractors", "site safety"],
        ),
        "en",
    )

    assert brief["role_context"]["archetype"] == "construction_site"
    assert brief["role_context"]["role_family"] == "construction_site"
    question_blob = " ".join(item["question"] for item in brief["question_pack"]).lower()
    hint_blob = " ".join(section["hint"] for section in brief["structured_sections"]).lower()
    assert "subcontractor" in question_blob or "site" in question_blob
    assert "safety" in question_blob or "schedule" in question_blob
    assert "on-site" in hint_blob or "sequence" in hint_blob


def test_customer_support_brief_is_materially_different_from_construction():
    construction = job_signal_boost.build_signal_boost_brief(
        _job(
            "Construction Supervisor",
            description="Own site sequence, subcontractor coordination, and safety under deadline pressure.",
        ),
        "en",
    )
    support = job_signal_boost.build_signal_boost_brief(
        _job(
            "Customer Support Specialist",
            description="Handle frustrated users, missing ticket context, and escalation decisions for time-sensitive account issues.",
        ),
        "en",
    )

    construction_questions = [item["question"] for item in construction["question_pack"]]
    support_questions = [item["question"] for item in support["question_pack"]]
    construction_hints = [item["hint"] for item in construction["structured_sections"]]
    support_hints = [item["hint"] for item in support["structured_sections"]]

    assert construction["role_context"]["archetype"] == "construction_site"
    assert support["role_context"]["archetype"] == "customer_support"
    assert construction_questions != support_questions
    assert construction_hints != support_hints
    assert any("ticket" in question.lower() or "escalat" in question.lower() for question in support_questions)
    assert any("site" in question.lower() or "subcontract" in question.lower() for question in construction_questions)


def test_product_brief_stays_grounded_in_signal_before_solution():
    brief = job_signal_boost.build_signal_boost_brief(
        _job(
            "AI Product Manager",
            description="Own roadmap for AI onboarding, activation drop-off, product discovery, and experiment design.",
        ),
        "en",
    )

    question_blob = " ".join(item["question"] for item in brief["question_pack"]).lower()
    assert brief["role_context"]["archetype"] == "product"
    assert "signal" in question_blob or "experiment" in question_blob


def test_quality_flags_block_short_generic_output():
    quality = job_signal_boost.evaluate_signal_boost_quality(
        {
            "problem_frame": "I am a motivated team player in a dynamic environment.",
            "first_step": "I would communicate well.",
            "solution_direction": "I would use best practices and stakeholder alignment.",
            "risk_and_unknowns": "More details.",
        },
        "en",
    )

    assert quality["publish_ready"] is False
    assert quality["too_short"] is True
    assert quality["missing_solution_direction"] is True
    assert quality["likely_generic"] is True
    assert len(quality["nudges"]) >= 2


def test_summary_and_recruiter_readout_are_available_for_grounded_output():
    brief = job_signal_boost.build_signal_boost_brief(
        _job(
            "Construction Supervisor",
            description="Own sequencing on site, keep safety intact, and coordinate subcontractors under schedule pressure.",
        ),
        "en",
    )
    payload = _strong_payload()

    quality = job_signal_boost.evaluate_signal_boost_quality(payload, "en", brief=brief)
    summary = job_signal_boost.build_signal_boost_summary(payload, "en", quality, brief=brief)
    readout = job_signal_boost.build_signal_boost_recruiter_readout(payload, "en", brief, quality)

    assert quality["publish_ready"] is True
    assert summary is not None
    assert [item["key"] for item in summary["items"]] == [
        "context_read",
        "decision_quality",
        "risk_judgment",
        "role_specificity",
    ]
    assert any("subcontract" in item.lower() or "safety" in item.lower() for item in readout["what_cv_does_not_show"])
    assert any("site" in item.lower() or "trade" in item.lower() for item in readout["follow_up_questions"])


def test_signal_boost_brief_includes_soft_jcfpm_fit_context():
    brief = job_signal_boost.build_signal_boost_brief(
        _job(
            "Construction Supervisor",
            description="Own sequencing on site, keep safety intact, and coordinate subcontractors under schedule pressure.",
        ),
        "en",
        candidate_profile=_candidate_profile_with_jcfpm(),
    )

    fit_context = brief["fit_context"]
    assert fit_context is not None
    assert any("systems" in item.lower() or "structure" in item.lower() for item in fit_context["transferable_strengths"])
    assert any("follow-up" in item.lower() or "supplier" in item.lower() or "stretch" in item.lower() for item in fit_context["stretch_areas"])
    assert "ramp-up" in fit_context["framing_hint"].lower() or "transfers" in fit_context["framing_hint"].lower()


def test_recruiter_readout_carries_jcfpm_fit_context_without_hard_rejection():
    brief = job_signal_boost.build_signal_boost_brief(
        _job(
            "Construction Supervisor",
            description="Own sequencing on site, keep safety intact, and coordinate subcontractors under schedule pressure.",
        ),
        "en",
        candidate_profile=_candidate_profile_with_jcfpm(),
    )
    payload = _strong_payload()

    quality = job_signal_boost.evaluate_signal_boost_quality(payload, "en", brief=brief)
    readout = job_signal_boost.build_signal_boost_recruiter_readout(payload, "en", brief, quality)

    assert readout["fit_context"] is not None
    assert any("transfer" in item.lower() or "systems" in item.lower() for item in readout["fit_context"]["transferable_strengths"])
    assert any("validate" in item.lower() or "follow-up" in item.lower() or "supplier" in item.lower() for item in readout["fit_context"]["recruiter_validation_focus"])
    assert not any("not fit" in item.lower() or "bad fit" in item.lower() for item in readout["risk_flags"])


def test_customer_support_recruiter_readout_surfaces_beyond_cv_signal():
    brief = job_signal_boost.build_signal_boost_brief(
        _job(
            "Customer Support Specialist",
            description="Calm frustrated customers, gather missing context, and decide whether to resolve or escalate within SLA.",
        ),
        "en",
    )
    payload = {
        "problem_frame": (
            "The hardest part is not the emotion alone. It is that the customer is already frustrated while the ticket still lacks the facts I need to avoid a wrong answer."
        ),
        "first_step": (
            "First I would acknowledge ownership to the customer, pull the account history, and check the prior ticket trail so I know whether this is a known issue or a fresh escalation risk."
        ),
        "solution_direction": (
            "I would prioritize a calm, accurate next step over a fast but vague answer. That means I would not promise final resolution yet until I know whether the SLA, account impact, and technical evidence point to escalation."
        ),
        "risk_and_unknowns": (
            "I still need to know the business impact, what the customer already tried, whether similar cases are open, and whether a wrong answer here would increase the support burden."
        ),
        "stakeholder_note": (
            "If the evidence points outside support, I would hand off a concise summary to senior support or product with the confirmed facts and the remaining unknowns."
        ),
    }

    quality = job_signal_boost.evaluate_signal_boost_quality(payload, "en", brief=brief)
    readout = job_signal_boost.build_signal_boost_recruiter_readout(payload, "en", brief, quality)

    assert any("frustrated customer" in item.lower() or "escalat" in item.lower() for item in readout["what_cv_does_not_show"])
    assert any("ticket" in item.lower() or "escalat" in item.lower() for item in readout["follow_up_questions"])
    assert "cv" in readout["recommended_next_step"].lower() or "interview" in readout["recommended_next_step"].lower()
