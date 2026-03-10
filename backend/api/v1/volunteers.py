from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Volunteer, User, Task, TaskStatus, VolunteerStatus, TrackingSession
from schemas import (
    VolunteerCreate, VolunteerUpdate, VolunteerResponse, VolunteerLocationUpdate,
    VolunteerStatusUpdate, TaskResponse
)
from utils.auth import get_current_user
from utils.spatial import create_point, extract_coordinates
from utils.serialize import serialize_volunteer, serialize_task, serialize_list
from utils.socket_manager import socket_manager
from datetime import datetime
import json

router = APIRouter(prefix="/volunteers", tags=["Volunteers"])


@router.get("/")
async def get_all_volunteers(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all volunteers (admin/dispatcher endpoint)"""
    query = db.query(Volunteer)
    
    # Filter by status if provided
    if status_filter:
        try:
            status_enum = VolunteerStatus[status_filter.upper()]
            query = query.filter(Volunteer.status == status_enum)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}"
            )
    
    volunteers = query.offset(skip).limit(limit).all()
    return serialize_list(volunteers, serialize_volunteer)


# IMPORTANT: Static routes MUST come BEFORE dynamic routes (/{volunteer_id})

@router.get("/me")
async def get_my_volunteer_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current volunteer profile"""
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer profile not found"
        )
    return serialize_volunteer(volunteer)


@router.patch("/me")
async def update_my_volunteer_profile(
    vol_data: VolunteerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current volunteer profile"""
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer profile not found"
        )
    
    if vol_data.vehicle_type is not None:
        volunteer.vehicle_type = vol_data.vehicle_type
    if vol_data.vehicle_plate is not None:
        volunteer.vehicle_plate = vol_data.vehicle_plate
    if vol_data.capacity_kg is not None:
        volunteer.capacity_kg = vol_data.capacity_kg
        
    db.commit()
    db.refresh(volunteer)
    return serialize_volunteer(volunteer)


@router.get("/current-task")
async def get_current_task(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get volunteer's current assigned task"""
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer profile not found"
        )
    
    if not volunteer.current_task_id:
        return None
    
    task = db.query(Task).filter(Task.id == volunteer.current_task_id).first()
    return serialize_task(task) if task else None


@router.get("/task-history")
async def get_task_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get volunteer's completed tasks"""
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer profile not found"
        )
    
    tasks = db.query(Task).filter(
        Task.volunteer_id == volunteer.id
    ).order_by(Task.created_at.desc()).all()
    
    return serialize_list(tasks, serialize_task)


@router.post("/")
async def create_volunteer(
    volunteer_data: VolunteerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create volunteer profile"""
    # Check if volunteer already exists
    existing_volunteer = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if existing_volunteer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Volunteer profile already exists"
        )
    
    # Create volunteer
    new_volunteer = Volunteer(
        user_id=current_user.id,
        vehicle_type=volunteer_data.vehicle_type,
        vehicle_plate=volunteer_data.vehicle_plate,
        capacity_kg=volunteer_data.capacity_kg,
        status=VolunteerStatus.OFFLINE
    )
    
    db.add(new_volunteer)
    db.commit()
    db.refresh(new_volunteer)
    
    return serialize_volunteer(new_volunteer)


@router.patch("/location")
async def update_location(
    location_data: VolunteerLocationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update volunteer's current location"""
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer profile not found"
        )
    
    # Update location
    new_location = create_point(location_data.latitude, location_data.longitude)
    volunteer.current_location = new_location
    volunteer.last_heartbeat = datetime.utcnow()
    
    # If volunteer has active task, update tracking session
    if volunteer.current_task_id:
        tracking_session = db.query(TrackingSession).filter(
            TrackingSession.task_id == volunteer.current_task_id,
            TrackingSession.volunteer_id == volunteer.id,
            TrackingSession.end_time == None
        ).first()
        
        if tracking_session:
            # Append new coordinate to path (store as JSON in route_polyline)
            current_path = []
            if tracking_session.route_polyline:
                try:
                    current_path = json.loads(tracking_session.route_polyline)
                except:
                    current_path = []
            
            current_path.append({
                "lat": location_data.latitude,
                "lng": location_data.longitude,
                "timestamp": datetime.utcnow().isoformat()
            })
            tracking_session.route_polyline = json.dumps(current_path)
    
    db.commit()
    db.refresh(volunteer)

    # Broadcast real-time location update to all connected dispatchers via Socket.IO
    await socket_manager._broadcast_to_dispatchers({
        'event': 'volunteer_location',
        'volunteer_id': str(volunteer.id),
        'task_id': str(volunteer.current_task_id) if volunteer.current_task_id else None,
        'location': {
            'lat': location_data.latitude,
            'lng': location_data.longitude,
            'speed': 0,
            'heading': 0,
        },
        'timestamp': datetime.utcnow().isoformat(),
    })

    return serialize_volunteer(volunteer)


@router.patch("/status")
async def update_status(
    status_data: VolunteerStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update volunteer's availability status"""
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer profile not found"
        )
    
    # Validate status transition
    if volunteer.status == VolunteerStatus.BUSY and status_data.status == VolunteerStatus.ONLINE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot go available while on task. Complete task first."
        )
    
    # Update status
    volunteer.status = status_data.status
    
    # If going offline, clear current location
    if status_data.status == VolunteerStatus.OFFLINE:
        volunteer.current_location = None
        volunteer.last_heartbeat = None
    
    db.commit()
    db.refresh(volunteer)

    # Broadcast status change
    await socket_manager.broadcast_volunteer_status(
        str(volunteer.id), 
        volunteer.status.value, 
        volunteer.user.full_name
    )
    
    return serialize_volunteer(volunteer)


@router.post("/go-online")
async def go_online(
    latitude: float,
    longitude: float,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Volunteer goes online and becomes available"""
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer profile not found"
        )
    
    # Update status and location
    volunteer.status = VolunteerStatus.ONLINE
    volunteer.current_location = create_point(latitude, longitude)
    volunteer.last_heartbeat = datetime.utcnow()
    
    db.commit()
    db.refresh(volunteer)

    # Broadcast status change (ONLINE)
    await socket_manager.broadcast_volunteer_status(
        str(volunteer.id), 
        "ONLINE", 
        volunteer.user.full_name
    )
    
    return serialize_volunteer(volunteer)


@router.post("/go-offline")
async def go_offline(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Volunteer goes offline"""
    volunteer = db.query(Volunteer).filter(Volunteer.user_id == current_user.id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer profile not found"
        )
    
    if volunteer.status == VolunteerStatus.BUSY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot go offline while on task"
        )
    
    # Update status
    volunteer.status = VolunteerStatus.OFFLINE
    volunteer.current_location = None
    volunteer.last_heartbeat = None
    
    db.commit()
    db.refresh(volunteer)

    # Broadcast status change (OFFLINE)
    await socket_manager.broadcast_volunteer_status(
        str(volunteer.id), 
        "OFFLINE", 
        volunteer.user.full_name
    )
    
    return serialize_volunteer(volunteer)


# Dynamic routes with path parameters MUST come AFTER static routes
@router.get("/{volunteer_id}")
async def get_volunteer_by_id(
    volunteer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific volunteer by ID (admin/dispatcher endpoint)"""
    volunteer = db.query(Volunteer).filter(Volunteer.id == volunteer_id).first()
    if not volunteer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Volunteer not found"
        )
    return serialize_volunteer(volunteer)
