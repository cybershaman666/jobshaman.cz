from backend.app.services.jcfpm_scoring import (
    compute_profile_confidence,
    score_dimensions_partial,
)


def test_ordering_scores_partial_credit_for_near_miss():
    items = [
        {
            "id": "d11-order-1",
            "dimension": "d11_problem_decomposition",
            "item_type": "ordering",
            "payload": {
                "correct_order": ["a", "b", "c", "d"],
            },
        }
    ]
    responses = {
        "d11-order-1": {
            "order": ["a", "c", "b", "d"],
            "time_ms": 18000,
        }
    }

    scores = score_dimensions_partial(items, responses)

    assert len(scores) == 1
    assert scores[0]["raw_score"] > 60
    assert scores[0]["raw_score"] < 100


def test_drag_drop_penalizes_extra_wrong_pairs():
    items = [
        {
            "id": "d9-drag-1",
            "dimension": "d9_systems_thinking",
            "item_type": "drag_drop",
            "payload": {
                "correct_pairs": [
                    {"source": "a", "target": "1"},
                    {"source": "b", "target": "2"},
                ],
            },
        }
    ]
    responses = {
        "d9-drag-1": {
            "pairs": [
                {"source": "a", "target": "1"},
                {"source": "b", "target": "2"},
                {"source": "c", "target": "3"},
            ],
            "time_ms": 20000,
        }
    }

    scores = score_dimensions_partial(items, responses)

    assert len(scores) == 1
    assert scores[0]["raw_score"] < 100
    assert scores[0]["raw_score"] > 70


def test_profile_confidence_reflects_partial_coverage():
    items = [
        {"id": "1", "dimension": "d1_cognitive"},
        {"id": "2", "dimension": "d1_cognitive"},
        {"id": "3", "dimension": "d2_social"},
        {"id": "4", "dimension": "d2_social"},
    ]
    responses = {
        "1": 5,
        "2": 6,
        "3": 4,
    }
    dimension_scores = [
        {"dimension": "d1_cognitive", "item_count": 2},
        {"dimension": "d2_social", "item_count": 1},
    ]

    confidence = compute_profile_confidence(items, responses, dimension_scores)

    assert confidence < 80
    assert confidence > 40
