from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Donor, User, Task, TaskStatus
from schemas import DonorCreate, DonorUpdate, TaskCreate
from utils.auth import get_current_user
from utils.spatial import create_point
from utils.qr_generator import generate_pickup_delivery_tokens
from utils.serialize import serialize_donor, serialize_task, serialize_list
from services.assignment import auto_assign_task
from utils.socket_manager import socket_manager

router = APIRouter(prefix="/donors", tags=["Donors"])


@router.get("/")
async def get_all_donors(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all donors (admin/dispatcher endpoint)"""
    donors = db.query(Donor).offset(skip).limit(limit).all()
    return serialize_list(donors, serialize_donor)


# IMPORTANT: /me and /tasks routes MUST come BEFORE /{donor_id}
# to avoid FastAPI treating "me" or "tasks" as a donor_id

@router.get("/me")
async def get_my_donor_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's donor profile"""
    donor = db.query(Donor).filter(Donor.user_id == current_user.id).first()
    if not donor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donor profile not found"
        )
    return serialize_donor(donor)


@router.patch("/me")
async def update_my_donor_profile(
    donor_data: DonorUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's donor profile"""
    donor = db.query(Donor).filter(Donor.user_id == current_user.id).first()
    if not donor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donor profile not found"
        )

    if donor_data.organization_name is not None:
        donor.organization_name = donor_data.organization_name
    if donor_data.address is not None:
        print(f"[DONOR UPDATE] Updating address for {donor.organization_name}: '{donor_data.address}'")
        donor.address = donor_data.address

    if donor_data.latitude is not None and donor_data.longitude is not None:
        print(
            f"[DONOR UPDATE] Updating location for {donor.organization_name}: "
            f"({donor_data.latitude}, {donor_data.longitude})"
        )
        donor.location = create_point(donor_data.latitude, donor_data.longitude)

    db.commit()
    db.refresh(donor)
    print(f"[DONOR UPDATE] After commit - address: '{donor.address}'")
    return serialize_donor(donor)


@router.put("/profile")
async def update_donor_profile(
    donor_data: DonorUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update donor profile (alias for /me, used by mobile app)"""
    return await update_my_donor_profile(donor_data, current_user, db)


@router.get("/tasks")
async def get_my_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tasks created by the current donor"""
    donor = db.query(Donor).filter(Donor.user_id == current_user.id).first()
    if not donor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donor profile not found"
        )

    tasks = db.query(Task).filter(Task.donor_id == donor.id).order_by(Task.created_at.desc()).all()
    return serialize_list(tasks, serialize_task)


@router.post("/tasks")
async def create_donation_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new donation task"""
    # Get donor profile
    donor = db.query(Donor).filter(Donor.user_id == current_user.id).first()
    if not donor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donor profile not found. Please create a donor profile first."
        )

    # Generate pickup and delivery tokens
    pickup_token, delivery_token = generate_pickup_delivery_tokens()

    # Create pickup and drop locations
    pickup_location = create_point(task_data.pickup_lat, task_data.pickup_lng)
    drop_location = create_point(task_data.drop_lat,
                                 task_data.drop_lng) if task_data.drop_lat and task_data.drop_lng else None

    new_task = Task(
        donor_id=donor.id,
        pickup_location=pickup_location,
        drop_location=drop_location,
        food_type=task_data.food_type,
        quantity_kg=task_data.quantity_kg,
        description=task_data.description,
        requires_cooling=task_data.requires_cooling,
        expiry_time=task_data.expiry_time,
        pickup_token=pickup_token,
        delivery_token=delivery_token,
        status=TaskStatus.PENDING
    )

    db.add(new_task)

    # Update donor stats
    donor.total_donations += 1
    db.add(donor)

    db.commit()
    db.refresh(new_task)

    # Broadcast task creation
    await socket_manager.broadcast_task_update(new_task.id, {
        "event": "task_created",
        **serialize_task(new_task)
    })

    # Try auto-assignment
    await auto_assign_task(new_task.id, db)

    return serialize_task(new_task)


# Dynamic routes with path parameters MUST come AFTER static routes
@router.get("/{donor_id}")
async def get_donor_by_id(
    donor_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific donor by ID (admin/dispatcher endpoint)"""
    donor = db.query(Donor).filter(Donor.id == donor_id).first()
    if not donor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donor not found"
        )
    return serialize_donor(donor)


@router.post("/")
async def create_donor(
    donor_data: DonorCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new donor profile"""
    # Check if donor already exists for this user
    existing_donor = db.query(Donor).filter(Donor.user_id == current_user.id).first()
    if existing_donor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Donor profile already exists for this user"
        )

    # Generate unique QR token
    pickup_token, _ = generate_pickup_delivery_tokens()

    new_donor = Donor(
        user_id=current_user.id,
        organization_name=donor_data.organization_name,
        address=donor_data.address,
        location=create_point(donor_data.latitude, donor_data.longitude),
        qr_token=pickup_token,
        rating=5.0,
        total_donations=0
    )

    db.add(new_donor)
    db.commit()
    db.refresh(new_donor)

    return serialize_donor(new_donor)
