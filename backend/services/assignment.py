from sqlalchemy.orm import Session
from models import Task, Volunteer, TaskStatus, VolunteerStatus, TrackingSession
from utils.spatial import find_nearby_volunteers, extract_coordinates, calculate_distance_km
from config import settings
from datetime import datetime
from typing import Optional
from utils.socket_manager import socket_manager
from utils.serialize import serialize_task
import logging

logger = logging.getLogger(__name__)


async def auto_assign_task(task_id: int, db: Session) -> Optional[Volunteer]:
    """
    Auto-assign task to nearest available volunteer.

    Returns:
        Volunteer: The assigned volunteer, or None if no volunteer found
    """
    # Get task
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return None

    if task.status != TaskStatus.PENDING:
        return None

    # Extract task pickup coordinates
    pickup_lat, pickup_lng = extract_coordinates(task.pickup_location)

    # Find nearby available volunteers
    nearby_volunteers = find_nearby_volunteers(
        db,
        pickup_lat,
        pickup_lng,
        settings.MAX_ASSIGNMENT_DISTANCE_KM
    )

    # Filter for ONLINE status only
    available_volunteers = [
        v for v in nearby_volunteers
        if v.status == VolunteerStatus.ONLINE
    ]

    if not available_volunteers:
        return None

    # Find closest volunteer
    closest_volunteer = None
    min_distance = float('inf')

    for volunteer in available_volunteers:
        if volunteer.current_location:
            vol_lat, vol_lng = extract_coordinates(volunteer.current_location)
            distance = calculate_distance_km(pickup_lat, pickup_lng, vol_lat, vol_lng)

            if distance < min_distance:
                min_distance = distance
                closest_volunteer = volunteer

    if not closest_volunteer:
        return None

    # Assign task to volunteer
    task.volunteer_id = closest_volunteer.id
    task.status = TaskStatus.ASSIGNED
    task.assigned_at = datetime.utcnow()

    # Update volunteer status
    closest_volunteer.status = VolunteerStatus.BUSY
    closest_volunteer.current_task_id = task.id

    # Create tracking session
    tracking_session = TrackingSession(
        task_id=task.id,
        volunteer_id=closest_volunteer.id,
        start_time=datetime.utcnow()
    )

    db.add(tracking_session)
    db.commit()
    db.refresh(task)

    # Broadcast assignment
    try:
        await socket_manager.broadcast_task_update(task.id, {
            "status": TaskStatus.ASSIGNED.value,
            "volunteer_id": closest_volunteer.id,
            "assigned_at": task.assigned_at.isoformat()
        })

        await socket_manager.send_task_assignment(closest_volunteer.id, serialize_task(task))
    except Exception as e:
        logger.error(f"Error broadcasting assignment: {e}")

    return closest_volunteer


async def trigger_auto_assignment(db: Session) -> dict:
    """
    Trigger auto-assignment for all pending tasks.

    Returns:
        dict: Summary of assignments made
    """
    pending_tasks = db.query(Task).filter(Task.status == TaskStatus.PENDING).all()

    assigned_count = 0
    failed_count = 0

    for task in pending_tasks:
        volunteer = await auto_assign_task(task.id, db)
        if volunteer:
            assigned_count += 1
        else:
            failed_count += 1

    return {
        "total_pending": len(pending_tasks),
        "assigned": assigned_count,
        "failed": failed_count
    }


async def reassign_task(task_id: int, db: Session) -> Optional[Volunteer]:
    """
    Reassign task to different volunteer (e.g., after cancellation).

    Returns:
        Volunteer: The newly assigned volunteer, or None if no volunteer found
    """
    # Get task
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        return None

    return await auto_assign_task(task_id, db)
