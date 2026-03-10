from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import (
    Task, TaskStatus, Volunteer, VolunteerStatus,
    TrackingSession, User, UserRole, NGO, Donor
)
from schemas import TaskAssignRequest
from utils.auth import get_current_user
from utils.serialize import (
    serialize_task, serialize_list, serialize_ngo,
    serialize_donor, serialize_volunteer
)
from utils.socket_manager import socket_manager
from datetime import datetime

router = APIRouter(prefix="/dispatcher", tags=["Dispatcher"])


def verify_dispatcher_access(user: User):
    """Verify user has dispatcher or admin access"""
    if user.role not in [UserRole.DISPATCHER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Dispatcher role required."
        )


@router.get("/tasks")
async def get_dispatcher_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tasks for dispatcher view"""
    print(f"[DISPATCHER_DEBUG] Accessing tasks for user: {current_user.email}, Role: {current_user.role}")
    verify_dispatcher_access(current_user)

    # Dispatchers see all tasks ordered by urgency/creation
    tasks = db.query(Task).order_by(
        Task.status == TaskStatus.PENDING,  # PENDING first
        Task.created_at.desc()
    ).all()

    return serialize_list(tasks, serialize_task)


@router.get("/ngos")
async def get_dispatcher_ngos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all NGOs for map view"""
    verify_dispatcher_access(current_user)
    ngos = db.query(NGO).all()
    return serialize_list(ngos, serialize_ngo)


@router.get("/donors")
async def get_dispatcher_donors(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all Donors for map view"""
    verify_dispatcher_access(current_user)
    donors = db.query(Donor).all()
    return serialize_list(donors, serialize_donor)


@router.post("/tasks/{task_id}/assign")
async def assign_task(
    task_id: str,
    assign_req: TaskAssignRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign task to volunteer"""
    verify_dispatcher_access(current_user)

    # Get task
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.status != TaskStatus.PENDING:
        raise HTTPException(status_code=400, detail="Task is not in PENDING status")

    # Get volunteer
    volunteer = db.query(Volunteer).filter(Volunteer.id == assign_req.volunteer_id).first()
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    if volunteer.status != VolunteerStatus.ONLINE:
        raise HTTPException(status_code=400, detail="Volunteer is not available (Must be ONLINE)")

    # Assign task
    task.volunteer_id = volunteer.id
    task.status = TaskStatus.ASSIGNED
    task.assigned_at = datetime.utcnow()

    # Update volunteer status
    volunteer.status = VolunteerStatus.BUSY
    volunteer.current_task_id = task.id

    # Create tracking session
    tracking_session = TrackingSession(
        task_id=task.id,
        volunteer_id=volunteer.id,
        start_time=datetime.utcnow()
    )

    db.add(tracking_session)
    db.commit()
    db.refresh(task)
    db.refresh(volunteer)

    # Notify volunteer via WebSocket
    await socket_manager.send_task_assignment(
        str(volunteer.id),
        serialize_task(task)
    )

    # Broadcast update to other dispatchers
    await socket_manager.broadcast_task_update(
        str(task.id),
        {'status': 'ASSIGNED', 'volunteer_id': str(volunteer.id)}
    )

    # Broadcast volunteer status change
    await socket_manager.broadcast_volunteer_status(
        str(volunteer.id), 'BUSY', volunteer.user.full_name
    )

    return serialize_task(task)


@router.get("/stats")
async def get_dispatcher_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard stats for dispatcher"""
    verify_dispatcher_access(current_user)

    today = datetime.utcnow().date()

    # Task stats
    pending_tasks = db.query(Task).filter(Task.status == TaskStatus.PENDING).count()
    active_tasks = db.query(Task).filter(
        Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.IN_TRANSIT, TaskStatus.PICKED_UP])
    ).count()
    completed_today = db.query(Task).filter(
        Task.status == TaskStatus.COMPLETED,
        func.date(Task.completed_at) == today
    ).count()

    # Volunteer stats
    online_volunteers = db.query(Volunteer).filter(
        Volunteer.status == VolunteerStatus.ONLINE
    ).count()

    total_volunteers = db.query(Volunteer).count()

    return {
        "pending_tasks": pending_tasks,
        "active_tasks": active_tasks,
        "completed_today": completed_today,
        "online_volunteers": online_volunteers,
        "total_volunteers": total_volunteers
    }


# ==========================================================================
# Volunteer Approval Endpoints
# ==========================================================================

@router.get("/volunteers/pending")
async def get_pending_volunteers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all volunteers pending ID verification"""
    verify_dispatcher_access(current_user)

    volunteers = db.query(Volunteer).filter(
        Volunteer.id_verified == False  # noqa: E712
    ).order_by(Volunteer.created_at.desc()).all()

    return serialize_list(volunteers, serialize_volunteer)


@router.patch("/volunteers/{volunteer_id}/approve")
async def approve_volunteer(
    volunteer_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a volunteer's ID verification"""
    verify_dispatcher_access(current_user)

    volunteer = db.query(Volunteer).filter(
        Volunteer.id == volunteer_id
    ).first()
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    volunteer.id_verified = True
    volunteer.verified_at = datetime.utcnow()

    db.commit()
    db.refresh(volunteer)

    return serialize_volunteer(volunteer)


@router.patch("/volunteers/{volunteer_id}/reject")
async def reject_volunteer(
    volunteer_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a volunteer application — deactivates the user account"""
    verify_dispatcher_access(current_user)

    volunteer = db.query(Volunteer).filter(
        Volunteer.id == volunteer_id
    ).first()
    if not volunteer:
        raise HTTPException(status_code=404, detail="Volunteer not found")

    # Deactivate the user account
    user = db.query(User).filter(User.id == volunteer.user_id).first()
    if user:
        user.is_active = False

    db.commit()

    return {"message": "Volunteer application rejected", "id": volunteer_id}
