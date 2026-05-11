from backend.app.domains.reality.service import _interleave_marketplace_locations


def test_interleave_marketplace_locations_prevents_single_region_first_page():
    items = [
        {"id": "ostrava-1", "location": "Ostrava"},
        {"id": "ostrava-2", "location": "Ostrava"},
        {"id": "ostrava-3", "location": "Ostrava"},
        {"id": "praha-1", "location": "Praha"},
        {"id": "brno-1", "location": "Brno"},
        {"id": "opava-1", "location": "Opava"},
    ]

    mixed = _interleave_marketplace_locations(items, 5)

    assert [item["id"] for item in mixed] == [
        "ostrava-1",
        "praha-1",
        "brno-1",
        "opava-1",
        "ostrava-2",
    ]
