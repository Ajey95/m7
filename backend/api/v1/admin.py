from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from models import User, Volunteer, NGO, Donor, Task, TaskStatus, VolunteerStatus, VerificationStatus
from utils.auth import get_current_user
from datetime import datetime, timedelta, date
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats")
async def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Alias for system overview"""
    return await get_system_overview(db, current_user)


@router.get("/users")
async def get_all_users(
    skip: int = 0,
    limit: int = 100,
    role: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all users"""
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)

    users = query.offset(skip).limit(limit).all()
    from utils.serialize import serialize_user, serialize_list
    return serialize_list(users, serialize_user)


@router.get("/ngos")
async def get_admin_ngos(
    verification_status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get NGOs for admin review"""
    query = db.query(NGO)
    if verification_status:
        query = query.filter(NGO.verification_status == verification_status)

    ngos = query.all()
    from utils.serialize import serialize_ngo, serialize_list
    return serialize_list(ngos, serialize_ngo)


@router.get("/donations")
async def get_admin_donations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all donations (tasks)"""
    tasks = db.query(Task).order_by(Task.created_at.desc()).offset(skip).limit(limit).all()
    from utils.serialize import serialize_task, serialize_list
    return serialize_list(tasks, serialize_task)


@router.post("/ngos/{ngo_id}/approve")
async def approve_ngo(
    ngo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve an NGO"""
    ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
    if not ngo:
        raise HTTPException(status_code=404, detail="NGO not found")

    ngo.verification_status = VerificationStatus.VERIFIED
    ngo.verified_at = datetime.utcnow()
    db.commit()
    db.refresh(ngo)

    # Broadcast NGO approval to admin dashboards
    from utils.socket_manager import socket_manager
    from utils.serialize import serialize_ngo
    await socket_manager._broadcast_to_dispatchers({
        "event": "ngo_approved",
        "ngo": serialize_ngo(ngo)
    })

    return {"message": f"NGO {ngo.organization_name} approved"}


@router.post("/ngos/{ngo_id}/reject")
async def reject_ngo(
    ngo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reject an NGO with optional reason"""
    ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
    if not ngo:
        raise HTTPException(status_code=404, detail="NGO not found")

    ngo.verification_status = VerificationStatus.REJECTED
    ngo.verified_at = None
    db.commit()
    return {"message": f"NGO {ngo.organization_name} rejected"}


class RejectNgoRequest(BaseModel):
    reason: Optional[str] = None


@router.post("/ngos/{ngo_id}/reject-with-reason")
async def reject_ngo_with_reason(
    ngo_id: str,
    body: RejectNgoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reject an NGO with a specific reason"""
    ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
    if not ngo:
        raise HTTPException(status_code=404, detail="NGO not found")

    ngo.verification_status = VerificationStatus.REJECTED
    ngo.verified_at = None
    ngo.rejection_reason = body.reason
    db.commit()
    return {"message": f"NGO {ngo.organization_name} rejected", "reason": body.reason}


@router.get("/ngos/expiring")
async def get_expiring_ngos(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get NGOs with licenses expiring within specified days"""
    threshold = date.today() + timedelta(days=days)
    expiring_ngos = db.query(NGO).filter(
        NGO.license_expiry is not None,
        NGO.license_expiry <= threshold,
        NGO.verification_status == VerificationStatus.VERIFIED
    ).all()

    from utils.serialize import serialize_ngo, serialize_list
    return serialize_list(expiring_ngos, serialize_ngo)


@router.get("/stats/overview")
async def get_system_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get system-wide statistics (admin dashboard)"""

    # Total counts
    total_users = db.query(func.count(User.id)).scalar()
    total_volunteers = db.query(func.count(Volunteer.id)).scalar()
    total_ngos = db.query(func.count(NGO.id)).scalar()
    total_donors = db.query(func.count(Donor.id)).scalar()
    total_tasks = db.query(func.count(Task.id)).scalar()

    # Volunteer status breakdown
    volunteers_online = db.query(func.count(Volunteer.id)).filter(
        Volunteer.status == VolunteerStatus.ONLINE
    ).scalar()
    volunteers_busy = db.query(func.count(Volunteer.id)).filter(
        Volunteer.status == VolunteerStatus.BUSY
    ).scalar()
    volunteers_offline = db.query(func.count(Volunteer.id)).filter(
        Volunteer.status == VolunteerStatus.OFFLINE
    ).scalar()

    # NGO verification status
    ngos_pending = db.query(func.count(NGO.id)).filter(
        NGO.verification_status == VerificationStatus.PENDING
    ).scalar()
    ngos_approved = db.query(func.count(NGO.id)).filter(
        NGO.verification_status == VerificationStatus.VERIFIED
    ).scalar()
    ngos_rejected = db.query(func.count(NGO.id)).filter(
        NGO.verification_status == VerificationStatus.REJECTED
    ).scalar()

    # Task status breakdown
    tasks_pending = db.query(func.count(Task.id)).filter(
        Task.status == TaskStatus.PENDING
    ).scalar()
    tasks_assigned = db.query(func.count(Task.id)).filter(
        Task.status == TaskStatus.ASSIGNED
    ).scalar()
    tasks_in_progress = db.query(func.count(Task.id)).filter(
        Task.status.in_([TaskStatus.PICKED_UP, TaskStatus.IN_TRANSIT])
    ).scalar()
    tasks_completed = db.query(func.count(Task.id)).filter(
        Task.status == TaskStatus.DELIVERED
    ).scalar()
    tasks_cancelled = db.query(func.count(Task.id)).filter(
        Task.status == TaskStatus.CANCELLED
    ).scalar()

    # Recent activity (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    tasks_this_week = db.query(func.count(Task.id)).filter(
        Task.created_at >= week_ago
    ).scalar()

    # Calculate Total Weight Rescued (kg) and CO2 Saved (kg)
    # Sum quantity_kg for all DELIVERED or COMPLETED tasks
    total_weight = db.query(func.sum(Task.quantity_kg)).filter(
        Task.status.in_([TaskStatus.DELIVERED, TaskStatus.COMPLETED])
    ).scalar() or 0.0

    # CO2 saved factor: approx 2.5kg CO2e per kg of food waste prevented
    co2_saved = float(total_weight) * 2.5

    print(f"DEBUG STATS: Users={total_users}, NGOs={total_ngos}, Weight={total_weight}, CO2={co2_saved}")

    return {
        "users": {
            "total": total_users,
            "volunteers": total_volunteers,
            "ngos": total_ngos,
            "donors": total_donors
        },
        "volunteers": {
            "online": volunteers_online,
            "busy": volunteers_busy,
            "offline": volunteers_offline
        },
        "ngos": {
            "pending": ngos_pending,
            "approved": ngos_approved,
            "rejected": ngos_rejected
        },
        "tasks": {
            "total": total_tasks,
            "pending": tasks_pending,
            "assigned": tasks_assigned,
            "in_progress": tasks_in_progress,
            "completed": tasks_completed,
            "cancelled": tasks_cancelled,
            "this_week": tasks_this_week
        },
        "impact": {
            "total_weight_kg": float(total_weight),
            "co2_saved_kg": co2_saved
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/stats/volunteer/{volunteer_id}")
async def get_volunteer_stats(
    volunteer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get performance statistics for specific volunteer"""

    volunteer = db.query(Volunteer).filter(Volunteer.id == volunteer_id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer not found"
        )

    # Task counts
    total_tasks = db.query(func.count(Task.id)).filter(
        Task.volunteer_id == volunteer_id
    ).scalar()

    completed_tasks = db.query(func.count(Task.id)).filter(
        Task.volunteer_id == volunteer_id,
        Task.status == TaskStatus.DELIVERED
    ).scalar()

    cancelled_tasks = db.query(func.count(Task.id)).filter(
        Task.volunteer_id == volunteer_id,
        Task.status == TaskStatus.CANCELLED
    ).scalar()

    # Calculate average ratings from performance_stats table
    from models import PerformanceStat
    perf_stats = db.query(PerformanceStat).filter(
        PerformanceStat.volunteer_id == volunteer_id
    ).first()

    avg_rating = perf_stats.average_rating if perf_stats else 0.0

    # Current status
    current_task = db.query(Task).filter(
        Task.volunteer_id == volunteer_id,
        Task.status.in_([TaskStatus.ASSIGNED, TaskStatus.PICKED_UP, TaskStatus.IN_TRANSIT])
    ).first()

    return {
        "volunteer_id": volunteer_id,
        "user": {
            "name": volunteer.user.full_name,
            "email": volunteer.user.email,
            "phone": volunteer.user.phone_number
        },
        "vehicle_type": volunteer.vehicle_type.value if volunteer.vehicle_type else None,
        "current_status": volunteer.status.value if volunteer.status else None,
        "tasks": {
            "total": total_tasks,
            "completed": completed_tasks,
            "cancelled": cancelled_tasks,
            "completion_rate": round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 2)
        },
        "performance": {
            "average_rating": round(avg_rating, 2),
            "total_distance_km": perf_stats.total_distance_km if perf_stats else 0,
            "total_deliveries": perf_stats.total_deliveries if perf_stats else 0
        },
        "current_task": {
            "id": current_task.id if current_task else None,
            "status": current_task.status.value if current_task else None
        }
    }
