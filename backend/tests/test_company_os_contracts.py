from types import SimpleNamespace

from backend.app.domains.handshake.service import HandshakeDomainService
from backend.app.domains.reality.service import RealityDomainService


def test_company_dashboard_composition_uses_role_data_not_fixed_demo_split():
    roles = [
        {"id": "r1", "role_family": "engineering"},
        {"id": "r2", "role_family": "engineering"},
        {"id": "r3", "role_family": "operations"},
    ]

    composition = HandshakeDomainService._composition_from_roles(roles)

    assert composition == [
        {"id": "engineering", "label": "Engineering", "value": 67, "color": "#7da9f5"},
        {"id": "operations", "label": "Operations", "value": 33, "color": "#88cfe0"},
    ]
    assert all(item["id"] not in {"visionaries", "architects", "realizers"} for item in composition)


def test_company_handshake_radar_requires_real_scorecards():
    evaluation_without_scorecards = SimpleNamespace(score=84, evaluation_payload={})
    evaluation_with_scorecards = SimpleNamespace(
        score=91,
        evaluation_payload={
            "scorecards": [
                {"key": "evidence", "score": 80},
                {"key": "judgment", "score": 70},
            ]
        },
    )

    assert HandshakeDomainService._radar_metrics([evaluation_without_scorecards]) == []
    assert HandshakeDomainService._resonance_from_evaluations([evaluation_with_scorecards]) == [
        {"id": "evidence", "label": "Evidence", "value": 80},
        {"id": "judgment", "label": "Judgment", "value": 70},
    ]


def test_challenge_blueprint_propagates_assessment_tasks():
    tasks = RealityDomainService._default_assessment_tasks(
        "Improve onboarding",
        "Design the first practical step and verification method.",
        "product",
    )
    blueprint = RealityDomainService._default_blueprint("Improve onboarding", tasks, "product")

    task_ids = {task["id"] for task in tasks}
    blueprint_task_ids = {step["id"] for step in blueprint["steps"]}

    assert task_ids.issubset(blueprint_task_ids)
    assert blueprint["review_policy"]["human_confirmation_required"] is True
    assert blueprint["review_policy"]["jcfpm_required_if_missing"] is True


def test_handshake_assignment_merges_assessment_tasks_into_existing_blueprint():
    job = {
        "id": "role-1",
        "title": "Product operator",
        "company": "Acme",
        "payload_json": {
            "handshake_blueprint_v1": {
                "id": "bp-1",
                "steps": [
                    {"id": "intro", "type": "context", "title": "Intro", "prompt": "Why this role?"}
                ],
            },
            "assessment_tasks": [
                {"id": "case_task", "type": "text_response", "title": "Case", "prompt": "Solve the case."}
            ],
        },
    }

    assignment = HandshakeDomainService._build_assignment_payload(job, {"jcfpm": {"completed": True}})
    step_ids = {step["id"] for step in assignment["blueprint"]["steps"]}

    assert {"intro", "case_task"}.issubset(step_ids)


def test_handshake_assignment_adds_jcfpm_when_missing():
    assignment = HandshakeDomainService._build_assignment_payload(
        {"id": "role-2", "title": "Ops", "company": "Acme", "payload_json": {}},
        {"jcfpm": {"completed": False}},
    )

    step_ids = {step["id"] for step in assignment["blueprint"]["steps"]}
    task_ids = {task["id"] for task in assignment["assessment_tasks"]}

    assert "jcfpm_profile" in step_ids
    assert "jcfpm_profile" in task_ids
    assert assignment["blueprint"]["jcfpm_policy"]["candidate_has_completed"] is False
