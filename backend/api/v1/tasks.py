from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import (
    Task, TaskStatus, Volunteer, VolunteerStatus,
    TrackingSession, User, UserRole
)
from schemas import QRVerifyRequest
from utils.auth import get_current_user
from utils.serialize import serialize_task, serialize_list
from services.assignment import trigger_auto_assignment, reassign_task
from utils.socket_manager import socket_manager
from datetime import datetime

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.get("/")
async def get_all_tasks(
    status_filter: TaskStatus = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tasks (admin/dispatcher only)"""
    if current_user.role not in [UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and dispatchers can view all tasks"
        )

    query = db.query(Task)
    if status_filter:
        query = query.filter(Task.status == status_filter)

    tasks = query.order_by(Task.created_at.desc()).all()
    return serialize_list(tasks, serialize_task)


@router.get("/{task_id}")
async def get_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get task details"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    return serialize_task(task)


@router.post("/{task_id}/assign/{volunteer_id}")
async def assign_task(
    task_id: str,
    volunteer_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually assign task to volunteer (admin/dispatcher only)"""
    if current_user.role not in [UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and dispatchers can assign tasks"
        )

    # Get task
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    if task.status != TaskStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task is not in PENDING status"
        )

    # Get volunteer
    volunteer = db.query(Volunteer).filter(Volunteer.id == volunteer_id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer not found"
        )

    if volunteer.status != VolunteerStatus.ONLINE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Volunteer is not available"
        )

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

    # Broadcast update
    await socket_manager.broadcast_task_update(task.id, {
        "status": TaskStatus.ASSIGNED.value,
        "volunteer_id": volunteer.id,
        "assigned_at": task.assigned_at.isoformat() if task.assigned_at else None
    })

    # Notify volunteer
    await socket_manager.send_task_assignment(volunteer.id, serialize_task(task))

    return serialize_task(task)


@router.post("/{task_id}/accept")
async def accept_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Volunteer accepts assigned task"""
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer profile not found"
        )

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    if task.volunteer_id != volunteer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This task is not assigned to you"
        )

    if task.status != TaskStatus.ASSIGNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task is not in ASSIGNED status"
        )

    # Update task status - Note: ACCEPTED status doesn't exist, staying at ASSIGNED
    task.assigned_at = datetime.utcnow()

    db.commit()
    db.refresh(task)

    return serialize_task(task)


@router.post("/{task_id}/pickup-verify")
async def verify_pickup(
    task_id: str,
    qr_data: QRVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify pickup with QR code"""
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer profile not found"
        )

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    if task.volunteer_id != volunteer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This task is not assigned to you"
        )

    if task.status != TaskStatus.ASSIGNED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task is not in ACCEPTED status"
        )

    # Verify QR token
    if task.pickup_token != qr_data.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid pickup QR code"
        )

    # Update task status
    task.status = TaskStatus.IN_TRANSIT
    task.pickup_verified_at = datetime.utcnow()

    db.commit()
    db.refresh(task)

    # Broadcast status update
    await socket_manager.broadcast_task_update(task.id, {
        "event": "task_updated",
        **serialize_task(task)
    })

    return serialize_task(task)


@router.post("/{task_id}/delivery-verify")
async def verify_delivery(
    task_id: str,
    qr_data: QRVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify delivery with QR code"""
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer profile not found"
        )

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    if task.volunteer_id != volunteer.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This task is not assigned to you"
        )

    if task.status != TaskStatus.IN_TRANSIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task is not in IN_TRANSIT status"
        )

    # Verify QR token
    if task.delivery_token != qr_data.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid delivery QR code"
        )

    # Update task status
    task.status = TaskStatus.DELIVERED
    task.delivery_verified_at = datetime.utcnow()

    # Update volunteer status
    volunteer.status = VolunteerStatus.ONLINE
    volunteer.current_task_id = None
    volunteer.total_deliveries += 1

    # End tracking session
    tracking_session = db.query(TrackingSession).filter(
        TrackingSession.task_id == task.id,
        TrackingSession.volunteer_id == volunteer.id,
        TrackingSession.end_time is None
    ).first()

    if tracking_session:
        tracking_session.end_time = datetime.utcnow()

    db.commit()
    db.refresh(task)

    # Broadcast status update
    await socket_manager.broadcast_task_update(task.id, {
        "event": "task_updated",
        **serialize_task(task)
    })

    return serialize_task(task)


@router.post("/{task_id}/complete")
async def complete_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark task as completed (admin/dispatcher only)"""
    if current_user.role not in [UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and dispatchers can complete tasks"
        )

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    if task.status != TaskStatus.DELIVERED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task must be DELIVERED before completion"
        )

    task.status = TaskStatus.COMPLETED

    db.commit()
    db.refresh(task)

    return serialize_task(task)


@router.post("/{task_id}/cancel")
async def cancel_task(
    task_id: str,
    reason: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel task"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    # Check permissions
    if current_user.role not in [UserRole.ADMIN]:
        # Check if user is donor who created the task
        from models import Donor
        donor = db.query(Donor).filter(Donor.user_id == current_user.id).first()
        if not donor or task.donor_id != donor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to cancel this task"
            )

    # Update task status
    task.status = TaskStatus.CANCELLED

    # If assigned to volunteer, free them up
    if task.volunteer_id:
        volunteer = db.query(Volunteer).filter(Volunteer.id == task.volunteer_id).first()
        if volunteer and volunteer.current_task_id == task.id:
            volunteer.status = VolunteerStatus.ONLINE
            volunteer.current_task_id = None

    db.commit()
    db.refresh(task)

    return serialize_task(task)


@router.post("/auto-assign")
async def trigger_auto_assign(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Trigger auto-assignment for all pending tasks (admin/dispatcher only)"""
    if current_user.role not in [UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and dispatchers can trigger auto-assignment"
        )

    result = await trigger_auto_assignment(db)
    return result


@router.post("/{task_id}/reassign")
async def reassign_task_to_volunteer(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reassign task to different volunteer (admin/dispatcher only)"""
    if current_user.role not in [UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and dispatchers can reassign tasks"
        )

    volunteer = await reassign_task(task_id, db)
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No available volunteers found nearby"
        )

    task = db.query(Task).filter(Task.id == task_id).first()
    return serialize_task(task)
