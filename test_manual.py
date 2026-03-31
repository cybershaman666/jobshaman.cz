import os
os.environ['SECRET_KEY'] = 'dummy'
os.environ['SUPABASE_URL'] = 'dummy'
os.environ['SUPABASE_KEY'] = 'dummy'

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.services.search_intelligence import enrich_search_query

# Mock AI
import backend.app.services.search_intelligence as si
original_call = si.call_primary_with_fallback
si.call_primary_with_fallback = lambda *args, **kwargs: (type('MockResult', (), {'text': '{"normalized_query": "řidič"}', 'model_name': 'test'})(), False)
si._extract_json = lambda x: {"normalized_query": "řidič"}

try:
    result = enrich_search_query("řidič", language="cs", subject_id="user-1")
    print("Result:", result)
    print("backend_query:", repr(result["backend_query"]))
    print("řidič in backend_query:", "řidič" in result["backend_query"])
    print("ridic in backend_query:", "ridic" in result["backend_query"])
finally:
    si.call_primary_with_fallback = original_call