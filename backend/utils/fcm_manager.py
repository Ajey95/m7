"""
Firebase Cloud Messaging manager.

Uses firebase-admin to send push notifications to registered FCM tokens.
Tokens are stored in-memory (single-process). For multi-process deployments
replace _token_store with Redis or a DB column.
"""
import os
import json
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)

# user_id (str) → fcm_token (str)
_token_store: Dict[str, str] = {}

_firebase_initialised = False


def _init_firebase() -> bool:
    """Lazily initialise Firebase Admin SDK. Returns True on success."""
    global _firebase_initialised
    if _firebase_initialised:
        return True

    try:
        import firebase_admin  # noqa: F401
        from firebase_admin import credentials

        service_account = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if not service_account:
            logger.warning(
                "[FCM] FIREBASE_SERVICE_ACCOUNT_JSON env var not set — "
                "push notifications disabled. Set it to a path or JSON string."
            )
            return False

        if not firebase_admin._apps:
            if service_account.strip().startswith("{"):
                cred = credentials.Certificate(json.loads(service_account))
            else:
                cred = credentials.Certificate(service_account)
            firebase_admin.initialize_app(cred)

        _firebase_initialised = True
        logger.info("[FCM] Firebase Admin SDK initialised ✅")
        return True

    except ImportError:
        logger.warning("[FCM] firebase-admin not installed. Run: pip install firebase-admin")
        return False
    except Exception as exc:
        logger.error(f"[FCM] Initialisation error: {exc}")
        return False


async def send_notification(
    token: str,
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    priority: str = "MEDIUM",
) -> bool:
    """Send a push notification to a single FCM token. Returns True on success."""
    if not _init_firebase():
        return False

    try:
        from firebase_admin import messaging

        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    title=title,
                    body=body,
                    icon="ic_notification",
                    color="#fb923c",
                    sound="default",
                ),
            ),
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    title=title,
                    body=body,
                    icon="/favicon.ico",
                    badge="/favicon.ico",
                ),
                headers={"Urgency": "high" if priority in ("CRITICAL", "HIGH") else "normal"},
                data={k: str(v) for k, v in (data or {}).items()},
            ),
            token=token,
        )
        messaging.send(msg)
        logger.info(f"[FCM] Sent: {title!r}")
        return True

    except Exception as exc:
        logger.warning(f"[FCM] Send failed ({exc}) — removing stale token")
        _remove_by_token(token)
        return False


async def send_to_user(
    user_id: str,
    title: str,
    body: str,
    data: Optional[Dict[str, str]] = None,
    priority: str = "MEDIUM",
) -> bool:
    """Convenience: send notification to a user by their ID."""
    token = _token_store.get(str(user_id))
    if not token:
        logger.debug(f"[FCM] No token for user {user_id}")
        return False
    return await send_notification(token, title, body, data, priority)


def register_token(user_id: str, token: str) -> None:
    _token_store[str(user_id)] = token
    logger.info(f"[FCM] Token registered for user {user_id}")


def remove_token(user_id: str) -> None:
    _token_store.pop(str(user_id), None)


def _remove_by_token(token: str) -> None:
    stale = [uid for uid, t in _token_store.items() if t == token]
    for uid in stale:
        del _token_store[uid]


def get_token(user_id: str) -> Optional[str]:
    return _token_store.get(str(user_id))
