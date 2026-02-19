from typing import Dict, Any

from pywebpush import webpush, WebPushException

from ..core.config import VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT


def is_push_configured() -> bool:
    return bool(VAPID_PRIVATE_KEY and VAPID_PUBLIC_KEY)


def send_push(subscription: Dict[str, Any], payload: str) -> bool:
    if not is_push_configured():
        print("⚠️ Push not configured. Missing VAPID keys.")
        return False

    endpoint = subscription.get("endpoint")
    p256dh = subscription.get("p256dh")
    auth = subscription.get("auth")
    if not endpoint or not p256dh or not auth:
        return False

    sub_info = {
        "endpoint": endpoint,
        "keys": {"p256dh": p256dh, "auth": auth},
    }

    try:
        webpush(
            subscription_info=sub_info,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
        )
        return True
    except WebPushException as exc:
        print(f"⚠️ Push send failed: {exc}")
        return False
