from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import NGO, User, Task, TaskStatus, VerificationStatus
from schemas import NGOCreate, NGOUpdate, NGOLicenseSubmit
from utils.auth import get_current_user
from utils.spatial import create_point, find_nearby_tasks
from utils.serialize import serialize_ngo, serialize_task, serialize_list
from datetime import datetime
import os
import uuid as uuid_mod

router = APIRouter(prefix="/ngos", tags=["NGOs"])


@router.get("/")
async def get_all_ngos(
    skip: int = 0,
    limit: int = 100,
    verification_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all NGOs (admin/dispatcher endpoint)"""
    query = db.query(NGO)

    # Filter by verification status if provided
    if verification_status:
        try:
            status_enum = VerificationStatus[verification_status.upper()]
            query = query.filter(NGO.verification_status == status_enum)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid verification status: {verification_status}"
            )

    ngos = query.offset(skip).limit(limit).all()
    return serialize_list(ngos, serialize_ngo)


# IMPORTANT: Static routes (/me, /nearby-tasks, /tasks) MUST come BEFORE dynamic routes (/{ngo_id})

@router.get("/me")
async def get_my_ngo_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current NGO profile"""
    ngo = db.query(NGO).filter(NGO.user_id == current_user.id).first()
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NGO profile not found"
        )
    return serialize_ngo(ngo)


@router.patch("/me")
async def update_my_ngo_profile(
    ngo_data: NGOUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current NGO profile"""
    ngo = db.query(NGO).filter(NGO.user_id == current_user.id).first()
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NGO profile not found"
        )

    if ngo_data.organization_name is not None:
        ngo.organization_name = ngo_data.organization_name
    if ngo_data.license_number is not None:
        ngo.license_number = ngo_data.license_number
    if ngo_data.address is not None:
        ngo.address = ngo_data.address
    if ngo_data.capacity_kg is not None:
        ngo.capacity_kg = ngo_data.capacity_kg

    if ngo_data.preferred_food_types is not None:
        ngo.preferred_food_types = ngo_data.preferred_food_types

    if ngo_data.latitude is not None and ngo_data.longitude is not None:
        from utils.spatial import create_point
        ngo.location = create_point(ngo_data.latitude, ngo_data.longitude)

    db.commit()
    db.refresh(ngo)
    return serialize_ngo(ngo)


@router.post("/me/license")
async def submit_license(
    license_data: NGOLicenseSubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Submit or update license details for current NGO"""
    ngo = db.query(NGO).filter(NGO.user_id == current_user.id).first()
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NGO profile not found"
        )

    ngo.license_number = license_data.license_number
    ngo.license_expiry = license_data.license_expiry
    if license_data.license_document_url:
        ngo.license_document_url = license_data.license_document_url

    # Reset to pending if previously rejected (resubmission)
    if ngo.verification_status == VerificationStatus.REJECTED:
        ngo.verification_status = VerificationStatus.PENDING
        ngo.rejection_reason = None

    db.commit()
    db.refresh(ngo)
    return serialize_ngo(ngo)


@router.post("/upload-license")
async def upload_license_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload license PDF file"""
    # Validate file type
    if file.content_type not in ["application/pdf", "image/jpeg", "image/png"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF, JPEG, and PNG files are allowed"
        )

    # Validate file size (max 10MB)
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size must be less than 10MB"
        )

    # Save file
    upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "licenses")
    os.makedirs(upload_dir, exist_ok=True)

    ext = os.path.splitext(file.filename)[1] if file.filename else ".pdf"
    filename = f"{uuid_mod.uuid4()}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    file_url = f"/uploads/licenses/{filename}"
    return {"url": file_url, "filename": filename}


@router.get("/me/status")
async def get_my_verification_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current NGO verification status"""
    ngo = db.query(NGO).filter(NGO.user_id == current_user.id).first()
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NGO profile not found"
        )
    return {
        "verification_status": ngo.verification_status.value if ngo.verification_status else "PENDING",
        "rejection_reason": ngo.rejection_reason,
        "verified_at": ngo.verified_at.isoformat() if ngo.verified_at else None,
        "license_number": ngo.license_number,
        "license_expiry": ngo.license_expiry.isoformat() if ngo.license_expiry else None,
    }


@router.get("/nearby-tasks")
async def get_nearby_tasks(
    max_distance_km: float = 10.0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Find nearby donation tasks for NGO"""
    ngo = db.query(NGO).filter(NGO.user_id == current_user.id).first()
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NGO profile not found"
        )

    # Require verification for accessing tasks
    if ngo.verification_status != VerificationStatus.VERIFIED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="NGO not verified yet. Cannot access tasks."
        )

    # Get NGO coordinates
    from utils.spatial import extract_coordinates
    ngo_lat, ngo_lng = extract_coordinates(ngo.location)

    # Find nearby tasks using spatial helper
    # Find nearby tasks using spatial helper
    try:
        # If NGO is at (0, 0) (legacy/default), show global tasks
        if abs(ngo_lat) < 0.01 and abs(ngo_lng) < 0.01:
            # Fetch all pending tasks without location filter
            nearby_tasks = db.query(Task).filter(
                Task.status == TaskStatus.PENDING,
                Task.ngo_id is None
            ).all()
        else:
            nearby_tasks = find_nearby_tasks(db, ngo_lat, ngo_lng, max_distance_km)

        # Filter by PENDING status
        available_tasks = [task for task in nearby_tasks if task.status == TaskStatus.PENDING]

        return serialize_list(available_tasks, serialize_task)
    except Exception as e:
        import logging
        import traceback
        logging.error(f"Error in get_nearby_tasks: {e}")
        logging.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal Server Error: {str(e)}"
        )


@router.get("/tasks")
async def get_my_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tasks assigned to current NGO"""
    ngo = db.query(NGO).filter(NGO.user_id == current_user.id).first()
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NGO profile not found"
        )

    tasks = db.query(Task).filter(Task.ngo_id == ngo.id).order_by(Task.created_at.desc()).all()
    return serialize_list(tasks, serialize_task)


@router.get("/claimed-tasks")
async def get_my_claimed_tasks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all tasks claimed by current NGO (alias for /tasks)"""
    return await get_my_tasks(current_user, db)


@router.post("/")
async def create_ngo(
    ngo_data: NGOCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create NGO profile"""
    # Check if NGO already exists
    existing_ngo = db.query(NGO).filter(NGO.user_id == current_user.id).first()
    if existing_ngo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NGO profile already exists"
        )

    # Create NGO with PostGIS coordinates
    location = create_point(ngo_data.latitude, ngo_data.longitude)

    # Generate QR token
    from utils.qr_generator import generate_qr_token
    qr_token = generate_qr_token()

    new_ngo = NGO(
        user_id=current_user.id,
        organization_name=ngo_data.organization_name,
        license_number=ngo_data.license_number,
        address=ngo_data.address,
        location=location,
        capacity_kg=ngo_data.capacity_kg,
        qr_token=qr_token,
        verification_status=VerificationStatus.PENDING
    )

    # Only set preferred_food_types if provided (avoid PostgreSQL enum type issue)
    if ngo_data.preferred_food_types:
        new_ngo.preferred_food_types = ngo_data.preferred_food_types

    db.add(new_ngo)
    db.commit()
    db.refresh(new_ngo)

    return serialize_ngo(new_ngo)


@router.post("/tasks/{task_id}/claim")
async def claim_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """NGO claims a task"""
    ngo = db.query(NGO).filter(NGO.user_id == current_user.id).first()
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NGO profile not found"
        )

    # Check verification status
    if ngo.verification_status != VerificationStatus.VERIFIED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="NGO verification pending. Please wait for admin approval."
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
            detail="Task already claimed or completed"
        )

    # Update task with NGO
    task.ngo_id = ngo.id
    db.commit()
    db.refresh(task)

    return serialize_task(task)


@router.post("/tasks/{task_id}/verify")
async def verify_receipt(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """NGO verifies receipt of donation (completes the task)"""
    ngo = db.query(NGO).filter(NGO.user_id == current_user.id).first()
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NGO profile not found"
        )

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )

    if task.ngo_id != ngo.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This task is not claimed by you"
        )

    # Update status to COMPLETED
    task.status = TaskStatus.COMPLETED
    task.completed_at = datetime.utcnow()
    task.delivery_verified_at = datetime.utcnow()  # Treat as verified delivery

    # If a volunteer was assigned, free them up
    if task.volunteer_id:
        from models import Volunteer, VolunteerStatus
        volunteer = db.query(Volunteer).filter(Volunteer.id == task.volunteer_id).first()
        if volunteer and volunteer.current_task_id == task.id:
            volunteer.status = VolunteerStatus.ONLINE
            volunteer.current_task_id = None
            volunteer.total_deliveries += 1

            # End tracking session
            from models import TrackingSession
            tracking = db.query(TrackingSession).filter(
                TrackingSession.task_id == task.id,
                TrackingSession.volunteer_id == volunteer.id,
                TrackingSession.end_time is None
            ).first()
            if tracking:
                tracking.end_time = datetime.utcnow()

    db.commit()
    db.refresh(task)

    return serialize_task(task)


# Dynamic routes with path parameters MUST come AFTER static routes
@router.get("/{ngo_id}")
async def get_ngo_by_id(
    ngo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get specific NGO by ID (admin/dispatcher endpoint)"""
    ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NGO not found"
        )
    return serialize_ngo(ngo)


@router.patch("/{ngo_id}/verify")
async def verify_ngo(
    ngo_id: str,
    verification_status: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve or reject NGO verification (admin endpoint)"""
    # Validate status
    valid_statuses = ["APPROVED", "REJECTED", "VERIFIED", "PENDING", "SUSPENDED"]
    if verification_status.upper() not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Status must be one of: {', '.join(valid_statuses)}"
        )

    ngo = db.query(NGO).filter(NGO.id == ngo_id).first()
    if not ngo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NGO not found"
        )

    # Map APPROVED to VERIFIED
    status_value = verification_status.upper()
    if status_value == "APPROVED":
        status_value = "VERIFIED"

    # Update verification status
    ngo.verification_status = VerificationStatus[status_value]

    db.commit()
    db.refresh(ngo)

    return serialize_ngo(ngo)
