import sys
from pathlib import Path

from fastapi import Request

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.app.utils.request_urls import get_request_base_url


def _make_request(headers: list[tuple[bytes, bytes]]) -> Request:
    return Request(
        {
            "type": "http",
            "scheme": "http",
            "server": ("internal-service", 80),
            "path": "/assets/upload-session",
            "headers": headers,
        }
    )


def test_request_base_url_prefers_forwarded_https_host() -> None:
    request = _make_request(
        [
            (b"host", b"internal-service"),
            (b"x-forwarded-proto", b"https"),
            (b"x-forwarded-host", b"site--jobshaman--rb4dlj74d5kc.code.run"),
        ]
    )

    assert get_request_base_url(request) == "https://site--jobshaman--rb4dlj74d5kc.code.run"


def test_request_base_url_uses_forwarded_header_when_available() -> None:
    request = _make_request(
        [
            (b"host", b"internal-service"),
            (b"forwarded", b'for=1.2.3.4;proto=https;host="jobshaman.cz"'),
        ]
    )

    assert get_request_base_url(request) == "https://jobshaman.cz"
