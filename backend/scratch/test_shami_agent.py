import sys
from pathlib import Path

# Add backend app directory to sys.path
backend_path = Path(__file__).resolve().parents[1]
sys.path.append(str(backend_path))

from app.services.shami_agent_service import build_shami_recruiter_agent_reply

print("Testing Shami Recruiter AI Agent reasoning...")
try:
    company = {"name": "Cybershaman Labs", "industry": "Technology"}
    roles = [{"id": "1", "title": "Senior Python Developer"}]
    candidates = [{"id": "1", "name": "John Doe", "target_role": "Python Developer"}]
    
    import unittest.mock as mock
    from app.services.azure_ai_client import AzureAIResult
    
    mock_payload = {
        "reply": "Ahoj! Našel jsem 1 aktivní roli: Senior Python Developer. Mohu tě navigovat na seznam rolí.",
        "navigation_suggestion": "/recruiter/roles",
        "navigation_label": "Zobrazit pozice",
        "suggested_prompts": ["Ukaž mi kandidáty", "Jaké máme aktivní pozice?"]
    }
    mock_result = AzureAIResult(text="json", model_name="gpt-5-mini", latency_ms=120)
    
    with mock.patch("app.services.shami_agent_service.call_ai_json", return_value=(mock_payload, mock_result)):
        res = build_shami_recruiter_agent_reply(
            message="Ukaž mi pozice",
            company=company,
            roles=roles,
            candidates=candidates
        )
        print("Success! Response from Shami agent:")
        print(res)
        assert res["navigation_suggestion"] == "/recruiter/roles"
        assert res["navigation_label"] == "Zobrazit pozice"
        print("Unit verification test passed!")
except Exception as e:
    print("Test failed:", e)
    sys.exit(1)
