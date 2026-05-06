import hashlib
import hmac
from datetime import datetime
from uuid import uuid4

from app.domains.integrations.models import IntegrationApiKey
from app.domains.integrations.service import IntegrationDomainService


def test_api_key_token_is_hashed_and_not_serialized():
    token = "jsh_live_test_secret"
    key = IntegrationApiKey(
        company_id=uuid4(),
        name="ATS",
        token_prefix=token[:18],
        token_hash=IntegrationDomainService.hash_token(token),
        scopes=["applications:read"],
        created_at=datetime.utcnow(),
    )

    serialized = IntegrationDomainService._serialize_key(key)

    assert key.token_hash == hashlib.sha256(token.encode("utf-8")).hexdigest()
    assert key.token_hash != token
    assert "token" not in serialized
    assert serialized["token_prefix"] == token[:18]


def test_scope_enforcement_helper_blocks_missing_scope():
    assert IntegrationDomainService.has_scope(["applications:read"], "applications:read")
    assert not IntegrationDomainService.has_scope(["applications:read"], "handshakes:read")


def test_webhook_signature_uses_raw_body_hmac_sha256():
    secret = "whsec_test"
    raw = b'{"event_id":"evt_1","type":"candidate.packet_ready"}'

    signature = IntegrationDomainService.sign_webhook_payload(secret, raw)

    expected = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    assert signature == f"sha256={expected}"


def test_openapi_schema_exposes_integration_paths():
    schema = IntegrationDomainService.openapi_schema()

    assert schema["openapi"].startswith("3.")
    assert "/integrations/v1/applications" in schema["paths"]
    assert "/integrations/v1/handshakes/{id}/packet" in schema["paths"]
