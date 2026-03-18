import importlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def test_prefers_mistral_when_key_is_configured(monkeypatch):
    monkeypatch.setenv("MISTRAL_API_KEY", "test-mistral")
    monkeypatch.delenv("AI_PROVIDER", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    client = importlib.import_module("backend.app.ai_orchestration.client")
    importlib.reload(client)

    assert client.resolve_ai_provider() == "mistral"
    assert client.get_default_primary_model() == "mistral-small-latest"


def test_explicit_provider_overrides_auto_detection(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.setenv("MISTRAL_API_KEY", "test-mistral")

    client = importlib.import_module("backend.app.ai_orchestration.client")
    importlib.reload(client)

    assert client.resolve_ai_provider() == "openai"
