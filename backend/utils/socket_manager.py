"""
Unified Food Rescue - WebSocket Manager (Socket.IO)
Real-time location streaming and event broadcasting
"""
import socketio
from typing import Dict, Set, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class SocketManager:
    """
    Manages WebSocket connections and real-time events
    Handles volunteer location streaming and dispatcher notifications
    """

    def __init__(self):
        self.sio = socketio.AsyncServer(
            async_mode='asgi',
            cors_allowed_origins='*',
            logger=True,
            engineio_logger=True
        )

        # Track connected clients
        self.volunteer_sessions: Dict[str, str] = {}  # {volunteer_id: session_id}
        self.dispatcher_sessions: Set[str] = set()     # {session_ids}
        self.donor_sessions: Dict[str, str] = {}       # {task_id: session_id}
        self.ngo_sessions: Dict[str, str] = {}         # {ngo_id: session_id}

        self._register_handlers()

    def _register_handlers(self):
        """Register Socket.IO event handlers"""

        @self.sio.event
        async def connect(sid, environ, auth):
            """Client connected"""
            logger.info(f"🔌 Client connected: {sid}")
            return True

        @self.sio.event
        async def disconnect(sid):
            """Client disconnected - cleanup"""
            logger.info(f"🔌 Client disconnected: {sid}")

            # Remove from tracking
            for vol_id, session_id in list(self.volunteer_sessions.items()):
                if session_id == sid:
                    del self.volunteer_sessions[vol_id]
                    logger.info(f"Removed volunteer {vol_id}")

            self.dispatcher_sessions.discard(sid)

            for task_id, session_id in list(self.donor_sessions.items()):
                if session_id == sid:
                    del self.donor_sessions[task_id]

            for ngo_id, session_id in list(self.ngo_sessions.items()):
                if session_id == sid:
                    del self.ngo_sessions[ngo_id]

        @self.sio.on('volunteer_register')
        async def handle_volunteer_register(sid, data):
            """
            Volunteer registers their session
            Payload: {"volunteer_id": "uuid"}
            """
            volunteer_id = data.get('volunteer_id')
            if volunteer_id:
                self.volunteer_sessions[volunteer_id] = sid
                await self.sio.emit('registered', {'status': 'success', 'role': 'volunteer'}, room=sid)
                logger.info(f"✅ Volunteer {volunteer_id} registered")

        @self.sio.on('dispatcher_register')
        async def handle_dispatcher_register(sid, data):
            """Dispatcher joins monitoring room"""
            self.dispatcher_sessions.add(sid)
            await self.sio.emit('registered', {'status': 'success', 'role': 'dispatcher'}, room=sid)
            logger.info(f"✅ Dispatcher registered: {sid}")

        @self.sio.on('donor_track_task')
        async def handle_donor_track(sid, data):
            """
            Donor subscribes to task tracking
            Payload: {"task_id": "uuid"}
            """
            task_id = data.get('task_id')
            if task_id:
                self.donor_sessions[task_id] = sid
                await self.sio.emit('tracking_started', {'task_id': task_id}, room=sid)
                logger.info(f"📍 Donor tracking task {task_id}")

        @self.sio.on('ngo_register')
        async def handle_ngo_register(sid, data):
            """NGO registers for notifications"""
            ngo_id = data.get('ngo_id')
            if ngo_id:
                self.ngo_sessions[ngo_id] = sid
                await self.sio.emit('registered', {'status': 'success', 'role': 'ngo'}, room=sid)
                logger.info(f"✅ NGO {ngo_id} registered")

        @self.sio.on('location_update')
        async def handle_location_update(sid, data):
            """
            Volunteer sends location update
            Payload: {
                "volunteer_id": "uuid",
                "task_id": "uuid",
                "lat": 12.xxx,
                "lng": 77.xxx,
                "speed": 45,
                "heading": 90
            }
            """
            try:
                volunteer_id = data.get('volunteer_id')
                task_id = data.get('task_id')

                location_data = {
                    'event': 'volunteer_location',
                    'volunteer_id': volunteer_id,
                    'task_id': task_id,
                    'location': {
                        'lat': data.get('lat'),
                        'lng': data.get('lng'),
                        'speed': data.get('speed', 0),
                        'heading': data.get('heading', 0)
                    },
                    'timestamp': datetime.utcnow().isoformat()
                }

                # Broadcast to dispatcher
                await self._broadcast_to_dispatchers(location_data)

                # Broadcast to donor if tracking this task
                if task_id in self.donor_sessions:
                    donor_sid = self.donor_sessions[task_id]
                    await self.sio.emit('volunteer_location_update', location_data, room=donor_sid)

            except Exception as e:
                logger.error(f"❌ Error processing location update: {e}")

    async def send_task_assignment(self, volunteer_id: str, task_data: dict):
        """
        Push task assignment to volunteer
        Triggers notification on mobile app
        """
        if volunteer_id in self.volunteer_sessions:
            sid = self.volunteer_sessions[volunteer_id]
            await self.sio.emit('task_assigned', task_data, room=sid)
            logger.info(f"📬 Task assignment sent to volunteer {volunteer_id}")
        else:
            logger.warning(f"⚠️ Volunteer {volunteer_id} not connected via WebSocket")

    async def notify_state_change(self, volunteer_id: str, new_state: str, task_id: Optional[str] = None):
        """Notify volunteer of state transition"""
        if volunteer_id in self.volunteer_sessions:
            sid = self.volunteer_sessions[volunteer_id]
            await self.sio.emit('state_changed', {
                'new_state': new_state,
                'task_id': task_id,
                'timestamp': datetime.utcnow().isoformat()
            }, room=sid)
            logger.info(f"📢 State change notification sent to volunteer {volunteer_id}")

    async def broadcast_task_update(self, task_id: str, update_data: dict):
        """Broadcast task status update to relevant parties"""
        # Convert task_id to string if it's a UUID
        task_id_str = str(task_id) if task_id else None

        # Notify donor tracking this task
        if task_id_str in self.donor_sessions:
            donor_sid = self.donor_sessions[task_id_str]
            await self.sio.emit('task_status_update', update_data, room=donor_sid)

        # Notify dispatchers
        await self._broadcast_to_dispatchers({
            'event': 'task_updated',
            'task_id': task_id_str,
            **update_data
        })

    async def notify_ngo(self, ngo_id: str, notification_data: dict):
        """Send notification to NGO"""
        if ngo_id in self.ngo_sessions:
            sid = self.ngo_sessions[ngo_id]
            await self.sio.emit('notification', notification_data, room=sid)
            logger.info(f"📢 Notification sent to NGO {ngo_id}")

    async def _broadcast_to_dispatchers(self, data: dict):
        """Broadcast data to all connected dispatchers"""
        for sid in self.dispatcher_sessions:
            await self.sio.emit('dispatcher_update', data, room=sid)

    def get_asgi_app(self):
        """Return ASGI app for mounting in FastAPI"""
        return socketio.ASGIApp(self.sio)

    def get_connected_volunteers(self) -> list:
        """Get list of connected volunteer IDs"""
        return list(self.volunteer_sessions.keys())

    async def broadcast_volunteer_status(self, volunteer_id: str, status: str, name: str):
        """Broadcast volunteer status change to dispatchers"""
        event_type = 'volunteer_online' if status == 'ONLINE' else 'volunteer_offline'
        data = {
            'event': event_type,
            'volunteer_id': volunteer_id,
            'name': name,
            'status': status,
            'timestamp': datetime.utcnow().isoformat()
        }
        await self._broadcast_to_dispatchers(data)
        logger.info(f"📢 Volunteer status broadcast: {name} is {status}")

    def is_volunteer_connected(self, volunteer_id: str) -> bool:
        """Check if volunteer is connected via WebSocket"""
        return volunteer_id in self.volunteer_sessions


# Global instance
socket_manager = SocketManager()
