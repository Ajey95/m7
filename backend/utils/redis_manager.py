"""
Unified Food Rescue - Redis Client
For caching live location data and session management
"""
import redis.asyncio as redis
from typing import Optional
from config import settings
import json
import time


class RedisManager:
    """Redis connection manager for async operations"""

    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None

    async def connect(self):
        """Establish Redis connection"""
        try:
            self.redis_client = await redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
        except Exception as e:
            print(f"⚠️ Redis connection failed: {e}")
            print("⚠️ Continuing without Redis (real-time features disabled)")

    async def disconnect(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()

    async def set_volunteer_location(
            self,
            volunteer_id: str,
            lat: float,
            lng: float,
            heading: float = 0,
            speed: float = 0):
        """
        Cache volunteer's current location
        Key: volunteer_loc:{volunteer_id}
        TTL: 60 seconds (auto-expire if no updates)
        """
        if not self.redis_client:
            return

        key = f"volunteer_loc:{volunteer_id}"
        data = {
            "lat": lat,
            "lng": lng,
            "heading": heading,
            "speed": speed,
            "timestamp": time.time()
        }
        await self.redis_client.setex(key, 60, json.dumps(data))

    async def get_volunteer_location(self, volunteer_id: str) -> Optional[dict]:
        """Retrieve volunteer's cached location"""
        if not self.redis_client:
            return None

        key = f"volunteer_loc:{volunteer_id}"
        data = await self.redis_client.get(key)
        return json.loads(data) if data else None

    async def set_task_session(self, task_id: str, session_data: dict):
        """Store active task session data"""
        if not self.redis_client:
            return

        key = f"task_session:{task_id}"
        await self.redis_client.setex(key, 3600, json.dumps(session_data))  # 1 hour TTL

    async def get_task_session(self, task_id: str) -> Optional[dict]:
        """Retrieve task session data"""
        if not self.redis_client:
            return None

        key = f"task_session:{task_id}"
        data = await self.redis_client.get(key)
        return json.loads(data) if data else None

    async def delete_task_session(self, task_id: str):
        """Remove task session from cache"""
        if not self.redis_client:
            return

        key = f"task_session:{task_id}"
        await self.redis_client.delete(key)

    async def add_to_online_volunteers(self, volunteer_id: str):
        """Add volunteer to online set"""
        if not self.redis_client:
            return
        await self.redis_client.sadd("online_volunteers", volunteer_id)

    async def remove_from_online_volunteers(self, volunteer_id: str):
        """Remove volunteer from online set"""
        if not self.redis_client:
            return
        await self.redis_client.srem("online_volunteers", volunteer_id)

    async def get_online_volunteers(self) -> list:
        """Get all online volunteer IDs"""
        if not self.redis_client:
            return []
        return list(await self.redis_client.smembers("online_volunteers"))


# Global instance
redis_manager = RedisManager()


async def get_redis() -> RedisManager:
    """Dependency for FastAPI endpoints"""
    return redis_manager
