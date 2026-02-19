import hmac
import hashlib

from ..core.config import SECRET_KEY

_PURPOSE = "daily_digest_unsubscribe"


def make_unsubscribe_token(user_id: str, email: str) -> str:
    payload = f"{user_id}:{email}:{_PURPOSE}".encode("utf-8")
    key = SECRET_KEY.encode("utf-8")
    return hmac.new(key, payload, hashlib.sha256).hexdigest()


def verify_unsubscribe_token(user_id: str, email: str, token: str) -> bool:
    if not user_id or not email or not token:
        return False
    expected = make_unsubscribe_token(user_id, email)
    return hmac.compare_digest(expected, token)
