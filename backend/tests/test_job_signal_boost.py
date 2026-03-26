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
        "tags": overrides.pop("tags", []),
    }
    payload.update(overrides)
    return payload


def test_ai_product_manager_brief_uses_product_specific_template():
    brief = job_signal_boost.build_signal_boost_brief(
        _job(
            "AI Product Manager",
            description="Own roadmap for AI product onboarding, model evaluation, assistant UX, and product discovery.",
        ),
        "en",
    )

    assert brief["meta"]["canonical_role"] == "AI Product Manager"
    assert brief["meta"]["domain_key"] == "product_management"
    assert "product" in brief["scenario_title"].lower()
    assert "experiment" in brief["core_problem"].lower() or "discovery" in brief["core_problem"].lower()


def test_operations_brief_stays_grounded_in_bottlenecks():
    brief = job_signal_boost.build_signal_boost_brief(
        _job(
            "Operations Coordinator",
            description="Reduce delays, fleet overload, and manual workarounds across daily dispatch.",
        ),
        "en",
    )

    assert brief["meta"]["domain_key"] == "operations"
    assert "bottleneck" in brief["core_problem"].lower()
    assert "stability" in brief["core_problem"].lower()


def test_customer_support_brief_mentions_incomplete_information():
    brief = job_signal_boost.build_signal_boost_brief(
        _job(
            "Customer Support Specialist",
            description="Handle user issues, missing context, and time-sensitive account problems.",
        ),
        "en",
    )

    combined = " ".join(
        [
            brief["scenario_title"],
            brief["scenario_context"],
            brief["core_problem"],
        ]
    ).lower()
    assert "incomplete" in combined
    assert "communication" in combined or "frustrated" in combined


def test_quality_flags_block_short_generic_output():
    quality = job_signal_boost.evaluate_signal_boost_quality(
        {
            "problem_understanding": "I am a motivated team player who would analyze the requirements carefully.",
            "first_move": "I would communicate well.",
            "approach_tradeoffs": "I would use best practices in a dynamic environment.",
            "needs_to_know": "More details.",
        },
        "en",
    )

    assert quality["publish_ready"] is False
    assert quality["too_short"] is True
    assert quality["missing_tradeoff"] is True
    assert quality["likely_generic"] is True
    assert len(quality["nudges"]) >= 2


def test_summary_is_suppressed_for_weak_output_and_available_for_grounded_output():
    weak_payload = {
        "problem_understanding": "I would analyze requirements in a dynamic environment.",
        "first_move": "I would communicate with the team.",
        "approach_tradeoffs": "I would follow best practices and stakeholder alignment.",
        "needs_to_know": "More context.",
    }
    assert job_signal_boost.build_signal_boost_summary(weak_payload, "en") is None

    strong_payload = {
        "problem_understanding": (
            "The real problem is not just drop-off. Users hit onboarding before they understand what value the AI workspace can unlock, "
            "so I would treat this as a clarity and sequencing issue rather than only a UI issue."
        ),
        "first_move": (
            "First I would review 20 recent sessions, map the first moment where users hesitate, and compare that with activation data. "
            "Then I would speak with support to see which questions appear in the first week."
        ),
        "approach_tradeoffs": (
            "I would prioritize one small experiment that reduces early confusion over a full onboarding redesign. "
            "That means I would not rebuild the whole flow yet, because speed matters more than polish at this stage."
        ),
        "needs_to_know": (
            "I would still need to know which user segment drops off most, what success means after week one, "
            "and whether the current onboarding promise matches what the product can actually deliver."
        ),
    }

    summary = job_signal_boost.build_signal_boost_summary(strong_payload, "en")
    assert summary is not None
    assert len(summary["items"]) == 4
    assert all(item["score"] >= 18 for item in summary["items"])
