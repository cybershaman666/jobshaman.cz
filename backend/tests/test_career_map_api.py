import asyncio

import backend.app.routers.career_map as cm


def test_career_map_taxonomy_endpoint_schema():
    payload = asyncio.run(cm.career_map_taxonomy())

    assert isinstance(payload.taxonomy_version, str)
    assert isinstance(payload.role_families, list)
    assert isinstance(payload.role_family_relations, dict)
    assert len(payload.role_families) > 0


def test_career_map_infer_returns_primary_family_and_domain():
    req = cm.CareerMapInferRequest(
        jobs=[
            cm.CareerMapInferJob(
                id="ops",
                title="Operations Manager",
                description="Logistics and supply chain operations, process optimization, warehouse.",
                required_skills=["logistics", "process", "warehouse"],
            ),
            cm.CareerMapInferJob(
                id="pm",
                title="Product Manager",
                description="Product strategy, roadmap, discovery, stakeholders.",
                required_skills=["product management", "discovery", "roadmap"],
            ),
        ]
    )

    payload = asyncio.run(cm.career_map_infer(req))
    assert isinstance(payload.meta.taxonomy_version, str)

    by_id = {row.id: row for row in payload.jobs}
    assert by_id["ops"].primary_role_family is not None
    assert by_id["ops"].primary_domain is not None
    assert by_id["pm"].primary_role_family == "product_management"
    assert isinstance(by_id["pm"].domains, list)
