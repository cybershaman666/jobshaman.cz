from backend.geocoding import geocode_location


def test_geocoding_does_not_collapse_kurim_to_brno_center(monkeypatch):
    def fake_nominatim(address: str):
        return {
            "lat": 49.2988,
            "lon": 16.5314,
            "country": "CZ",
            "source": "nominatim_api",
        }

    monkeypatch.setattr("backend.geocoding._geocode_with_nominatim", fake_nominatim)

    result = geocode_location("Kuřim, okres Brno-venkov")

    assert result is not None
    assert result["source"] == "nominatim_api"
    assert round(result["lat"], 4) == 49.2988
    assert round(result["lon"], 4) == 16.5314


def test_geocoding_keeps_brno_district_static_match():
    result = geocode_location("Brno-střed")

    assert result is not None
    assert result["source"] in {"static_cache", "static_cache_partial"}
    assert round(result["lat"], 4) == 49.1951
    assert round(result["lon"], 4) == 16.6068
