from backend.app.services.jcfpm_mapping import rank_roles


def test_high_ai_readiness_does_not_filter_only_high_ai_roles():
    user = {
        "d1_cognitive": 6.0,
        "d2_social": 5.2,
        "d3_motivational": 5.8,
        "d4_energy": 5.0,
        "d5_values": 5.2,
        "d6_ai_readiness": 6.5,
    }
    roles = [
        {
            "id": "ai-tech-lead",
            "title": "AI Tech Lead",
            "d1": 6.2,
            "d2": 5.2,
            "d3": 5.8,
            "d4": 5.0,
            "d5": 5.2,
            "d6": 6.8,
            "ai_intensity": "high",
        },
        {
            "id": "ops-manager",
            "title": "Operations Manager",
            "d1": 5.8,
            "d2": 5.4,
            "d3": 5.6,
            "d4": 5.1,
            "d5": 5.2,
            "d6": 5.4,
            "ai_intensity": "medium",
        },
        {
            "id": "marketing-specialist",
            "title": "Marketing Specialist",
            "d1": 5.6,
            "d2": 5.4,
            "d3": 5.7,
            "d4": 5.0,
            "d5": 5.3,
            "d6": 5.2,
            "ai_intensity": "medium",
        },
    ]

    ranked = rank_roles(user, roles, top_n=3)

    titles = {row["title"] for row in ranked}
    assert "AI Tech Lead" in titles
    assert "Operations Manager" in titles
    assert "Marketing Specialist" in titles


def test_high_ai_readiness_caps_number_of_high_ai_roles_in_top_results():
    user = {
        "d1_cognitive": 6.0,
        "d2_social": 5.3,
        "d3_motivational": 5.8,
        "d4_energy": 5.0,
        "d5_values": 5.2,
        "d6_ai_readiness": 6.6,
    }
    roles = []
    for idx in range(5):
        roles.append(
            {
                "id": f"high-{idx}",
                "title": f"High AI {idx}",
                "d1": 6.0,
                "d2": 5.3,
                "d3": 5.8,
                "d4": 5.0,
                "d5": 5.2,
                "d6": 6.7,
                "ai_intensity": "high",
            }
        )
    roles.append(
        {
            "id": "medium-1",
            "title": "Digital Product Manager",
            "d1": 5.9,
            "d2": 5.4,
            "d3": 5.7,
            "d4": 5.0,
            "d5": 5.2,
            "d6": 5.5,
            "ai_intensity": "medium",
        }
    )
    roles.append(
        {
            "id": "medium-2",
            "title": "Innovation Consultant",
            "d1": 5.8,
            "d2": 5.5,
            "d3": 5.6,
            "d4": 5.1,
            "d5": 5.3,
            "d6": 5.4,
            "ai_intensity": "medium",
        }
    )

    ranked = rank_roles(user, roles, top_n=5)

    high_ai_count = sum(1 for row in ranked if row.get("ai_intensity") == "high")
    titles = {row["title"] for row in ranked}
    assert high_ai_count <= 2
    assert "Digital Product Manager" in titles
    assert "Innovation Consultant" in titles
