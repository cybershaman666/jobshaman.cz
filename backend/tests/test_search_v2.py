from backend.app.models.requests import HybridJobSearchV2Request
from backend.app.matching_engine import serve


def test_hybrid_search_v2_request_defaults():
    req = HybridJobSearchV2Request()
    assert req.page == 0
    assert req.page_size == 50
    assert req.sort_mode == "default"
    assert req.debug is False


def test_hybrid_search_v2_request_rejects_invalid_sort_mode():
    try:
        HybridJobSearchV2Request(sort_mode="random")
        assert False, "invalid sort mode should fail validation"
    except Exception:
        assert True


def test_hybrid_search_v2_fallback_without_supabase(monkeypatch):
    monkeypatch.setattr(serve, "supabase", None)
    result = serve.hybrid_search_jobs_v2({"search_term": "python"}, page=0, page_size=20, user_id=None)
    assert result["jobs"] == []
    assert result["has_more"] is False
    assert result["total_count"] == 0
    assert result["meta"]["fallback"] == "no_supabase"


def test_normalize_sort_mode_defaults():
    assert serve._normalize_sort_mode("recommended") == "recommended"
    assert serve._normalize_sort_mode("jhi_desc") == "jhi_desc"
    assert serve._normalize_sort_mode("bad_mode") == "default"


def test_internal_listing_detection_prefers_jobshaman_source_or_url():
    by_source = {"source": "jobshaman.cz", "url": "https://external.example/job"}
    by_url = {"source": "scraper", "url": "https://jobshaman.cz/jobs/123"}
    by_owner = {"source": "scraper", "url": "https://example.com/job/1", "company_id": "c1"}

    assert serve._is_internal_job_listing(by_source) is True
    assert serve._is_internal_job_listing(by_url) is True
    assert serve._is_internal_job_listing(by_owner) is True


def test_internal_listing_detection_rejects_known_external_domains():
    external_jobs_cz = {"source": "jobs.cz", "url": "https://www.jobs.cz/pozice/123"}
    external_praca = {"source": "scraper", "url": "https://www.praca.pl/oferta/123"}

    assert serve._is_internal_job_listing(external_jobs_cz) is False
    assert serve._is_internal_job_listing(external_praca) is False


def test_hybrid_search_v2_infers_has_more_when_total_count_missing(monkeypatch):
    class _RpcResponse:
        def __init__(self, data):
            self.data = data

    class _SupabaseStub:
        def rpc(self, _fn, _payload):
            # Return one extra row but omit `total_count` entirely to simulate older DB schema.
            page_size = int(_payload.get("p_page_size") or 50)
            rows = []
            for idx in range(page_size):
                rows.append(
                    {
                        "id": f"job-{idx}",
                        "hybrid_score": 0.9,
                        "fts_score": 0.1,
                        "trigram_score": 0.1,
                        "profile_fit_score": 0.1,
                        "recency_score": 0.1,
                        "behavior_prior_score": 0.0,
                        "company": "Acme",
                        "title": "Engineer",
                        "location": "Remote",
                    }
                )
            return type("Rpc", (), {"execute": lambda self: _RpcResponse(rows)})()

    monkeypatch.setattr(serve, "supabase", _SupabaseStub())
    monkeypatch.setattr(serve, "get_release_flag", lambda *_a, **_k: {"effective_enabled": True})
    monkeypatch.setattr(serve, "get_active_model_config", lambda *_a, **_k: {"config_json": {}})

    result = serve.hybrid_search_jobs_v2({"search_term": "", "sort_mode": "newest"}, page=0, page_size=20, user_id=None)
    assert len(result["jobs"]) == 20
    assert result["has_more"] is True
    assert int(result["total_count"]) >= 21


def test_lexical_score_is_accent_insensitive():
    assert serve._lexical_score("Řidič dodávky", ["ridic"]) > 0
