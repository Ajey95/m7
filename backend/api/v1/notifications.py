"""
Notifications API — FCM token registration and test-push endpoint.
"""
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from utils.auth import get_current_user
from utils.fcm_manager import register_token, remove_token, send_to_user
from models import User
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class FCMTokenPayload(BaseModel):
    token: str = Field(..., min_length=10, description="Firebase Messaging token")
    device: str = Field(default="web", description="Device type hint (web | android | ios)")


class TestPushPayload(BaseModel):
    title: str = Field(default="Test Notification")
    body: str = Field(default="Push notifications are working!")
    priority: str = Field(default="MEDIUM")


@router.post("/fcm-token", status_code=status.HTTP_204_NO_CONTENT)
async def register_fcm_token(
    payload: FCMTokenPayload,
    current_user: User = Depends(get_current_user),
):
    """Register or refresh the FCM push token for the authenticated user."""
    register_token(str(current_user.id), payload.token)


@router.delete("/fcm-token", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_fcm_token(
    current_user: User = Depends(get_current_user),
):
    """Remove the user's FCM token (call on logout)."""
    remove_token(str(current_user.id))


@router.post("/test-push")
async def test_push(
    payload: TestPushPayload,
    current_user: User = Depends(get_current_user),
):
    """Send a test push notification to the current user (dev/debug only)."""
    sent = await send_to_user(
        str(current_user.id),
        title=payload.title,
        body=payload.body,
        data={"type": "test", "priority": payload.priority},
        priority=payload.priority,
    )
    return {"sent": sent, "user_id": str(current_user.id)}
