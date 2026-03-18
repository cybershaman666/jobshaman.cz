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
