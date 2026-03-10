from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import timedelta
from database import get_db
from models import User, UserRole, Donor, Volunteer, NGO, VehicleType, VolunteerStatus, VerificationStatus
from schemas import UserCreate, UserResponse, Token, LoginRequest
from utils.auth import get_password_hash, verify_password, create_access_token, get_current_user
from utils.qr_generator import generate_qr_token, generate_pickup_delivery_tokens
from utils.spatial import create_point
from config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Sync user from Clerk to Local DB.
    Call this after Clerk registration.
    """
    # Check if user exists by email
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if phone number exists
    if user_data.phone_number:
        existing_phone = db.query(User).filter(User.phone_number == user_data.phone_number).first()
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number already registered"
            )
    
    # Create user (Password is handled by Clerk, we just store the record)
    clerk_id = user_data.clerk_user_id or f"user_{generate_qr_token(16)}"
    
    new_user = User(
        clerk_user_id=clerk_id,
        email=user_data.email,
        phone_number=user_data.phone_number,
        full_name=user_data.full_name,
        role=user_data.role,
        is_active=True
    )
    
    # Use GPS coords if provided directly, otherwise geocode from address
    lat, lng = 0.0, 0.0
    if user_data.latitude is not None and user_data.longitude is not None:
        lat, lng = user_data.latitude, user_data.longitude
    elif user_data.address:
        from utils.geocoding import geocode_address
        lat, lng = await geocode_address(user_data.address)
    
    try:
        db.add(new_user)
        db.flush() # Flush to get new_user.id
        
        # Auto-create profile based on role
        if new_user.role == UserRole.DONOR:
             pickup_token, _ = generate_pickup_delivery_tokens()
             new_donor = Donor(
                 user_id=new_user.id,
                 organization_name=new_user.full_name, # Default to name
                 address=user_data.address or "Please update address",
                 location=create_point(lat, lng),
                 qr_token=pickup_token,
                 rating=5.0,
                 total_donations=0
             )
             db.add(new_donor)
             
        elif new_user.role == UserRole.VOLUNTEER:
            vol_vehicle = VehicleType.BIKE
            if user_data.vehicle_type:
                try:
                    vol_vehicle = VehicleType(user_data.vehicle_type.upper())
                except ValueError:
                    pass
            new_volunteer = Volunteer(
                user_id=new_user.id,
                vehicle_type=vol_vehicle,
                vehicle_plate=user_data.vehicle_plate or "UPDATE_ME",
                capacity_kg=20,
                status=VolunteerStatus.OFFLINE,
                rating=5.0,
                total_deliveries=0,
                on_time_percentage=100.0
            )
            db.add(new_volunteer)
            
        elif new_user.role == UserRole.NGO:
             pickup_token, _ = generate_pickup_delivery_tokens()
             new_ngo = NGO(
                 user_id=new_user.id,
                 organization_name=new_user.full_name,
                 license_number=f"PENDING-{clerk_id[:8]}", # Unique placeholder
                 address=user_data.address or "Please update address",
                 location=create_point(lat, lng),
                 capacity_kg=100,
                 current_stock_kg=0,
                 qr_token=pickup_token,
                 rating=5.0,
                 # Auto-verify if in dev mode or handle via admin
                 verification_status=VerificationStatus.PENDING 
             )
             db.add(new_ngo)

        db.commit()
        db.refresh(new_user)
    except Exception as e:
        db.rollback()
        # Catch any other constraint violations
        if "unique constraint" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email or phone number already registered"
            )
        print(f"Registration Error: {e}") # Log error
        raise
    
    return new_user


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Get Access Token (TEST MODE ONLY).
    In production, use Clerk tokens directly.
    """
    if not settings.TEST_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Login endpoint disabled in Production. Use Clerk Auth."
        )

    # Case-insensitive email check
    user = db.query(User).filter(func.lower(User.email) == func.lower(form_data.username)).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is suspended"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": str(user.id), "role": user.role},
        expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return current_user

