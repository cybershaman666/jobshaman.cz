import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.services.search_intelligence import enrich_search_query


def test_search_query_rewrite_falls_back_to_original_when_empty():
    result = enrich_search_query("", language="cs", subject_id="user-1")

    assert result["backend_query"] == ""
    assert result["used_ai"] is False


def test_search_query_includes_normalized_version():
    # Mock AI to return the same query
    import backend.app.services.search_intelligence as si
    original_call = si.call_primary_with_fallback
    si.call_primary_with_fallback = lambda *args, **kwargs: (type('MockResult', (), {'text': '{"normalized_query": "řidič"}', 'model_name': 'test'})(), False)
    si._extract_json = lambda x: {"normalized_query": "řidič"}
    try:
        result = enrich_search_query("řidič", language="cs", subject_id="user-1")
        assert "řidič" in result["backend_query"]
        # Since AI returns "řidič", backend_query = "řidič"
    finally:
        si.call_primary_with_fallback = original_call
