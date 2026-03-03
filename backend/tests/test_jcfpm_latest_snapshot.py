from backend.app.routers.tests import _is_renderable_jcfpm_snapshot, _snapshot_from_result_row


def test_snapshot_from_result_row_builds_renderable_snapshot():
    row = {
        "created_at": "2026-03-03T10:00:00Z",
        "raw_responses": {"D1.1": 5},
        "dimension_scores": [
            {
                "dimension": "d1_cognitive",
                "raw_score": 5.4,
                "percentile": 82,
                "label": "Analytical structure",
            }
        ],
        "fit_scores": [
            {
                "title": "Business Analyst",
                "fit_score": 88,
            }
        ],
        "ai_report": {"strengths": ["Structured thinking"]},
        "version": "jcfpm-v1",
    }

    snapshot = _snapshot_from_result_row(row)

    assert snapshot is not None
    assert snapshot["completed_at"] == "2026-03-03T10:00:00Z"
    assert snapshot["percentile_summary"]["d1_cognitive"] == 82
    assert _is_renderable_jcfpm_snapshot(snapshot) is True
