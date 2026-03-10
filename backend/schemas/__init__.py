"""
Pydantic schemas for SE-VOLUNTEER API.
Includes validators for PostGIS Geometry field serialization.
"""
from pydantic import BaseModel, EmailStr, model_validator
from typing import Optional, List
from datetime import datetime, date
from uuid import UUID
from models import UserRole, FoodType, TaskStatus, VolunteerStatus, VehicleType, VerificationStatus


def extract_coords_from_geometry(geom) -> tuple:
    """Extract lat/lng from PostGIS Geometry object"""
    if geom is None:
        return None, None
    try:
        # Try WKB element extraction (GeoAlchemy2)
        from geoalchemy2.shape import to_shape
        point = to_shape(geom)
        return point.y, point.x  # lat, lng (y=lat, x=lng)
    except Exception:
        try:
            # Fallback: try direct attribute access
            return geom.y, geom.x
        except Exception:
            return None, None


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    phone_number: Optional[str] = None
    full_name: str
    role: UserRole


class UserCreate(UserBase):
    clerk_user_id: Optional[str] = None
    password: Optional[str] = None  # For non-Clerk auth
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    vehicle_type: Optional[str] = None   # For volunteer self-registration
    vehicle_plate: Optional[str] = None  # For volunteer self-registration


class UserResponse(UserBase):
    id: UUID
    clerk_user_id: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Donor Schemas
class DonorCreate(BaseModel):
    user_id: Optional[UUID] = None
    organization_name: Optional[str] = None
    address: str
    latitude: float
    longitude: float


class DonorResponse(BaseModel):
    id: UUID
    user_id: UUID
    organization_name: Optional[str] = None
    address: str
    qr_token: str
    rating: float = 5.0
    total_donations: int = 0
    created_at: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def extract_location(cls, values):
        """Extract lat/lng from Geometry location field"""
        if hasattr(values, '__dict__'):
            # SQLAlchemy model object
            data = {}
            for key in ['id', 'user_id', 'organization_name', 'address', 'qr_token',
                        'rating', 'total_donations', 'created_at', 'location']:
                if hasattr(values, key):
                    data[key] = getattr(values, key)

            if 'location' in data and data['location']:
                lat, lng = extract_coords_from_geometry(data['location'])
                data['latitude'] = lat
                data['longitude'] = lng
            return data
        return values


class DonorUpdate(BaseModel):
    organization_name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


# NGO Schemas
class NGOCreate(BaseModel):
    user_id: Optional[UUID] = None
    organization_name: str
    license_number: str
    address: str
    latitude: float
    longitude: float
    capacity_kg: int = 100
    preferred_food_types: Optional[List[FoodType]] = []


class NGOUpdate(BaseModel):
    organization_name: Optional[str] = None
    license_number: Optional[str] = None
    license_expiry: Optional[date] = None
    license_document_url: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    capacity_kg: Optional[int] = None
    preferred_food_types: Optional[List[FoodType]] = None


class NGOLicenseSubmit(BaseModel):
    license_number: str
    license_expiry: date
    license_document_url: Optional[str] = None


class NGOResponse(BaseModel):
    id: UUID
    user_id: UUID
    organization_name: str
    license_number: str
    verification_status: VerificationStatus = VerificationStatus.PENDING
    address: str
    capacity_kg: int = 100
    current_stock_kg: int = 0
    qr_token: str
    rating: float = 5.0
    total_claims: int = 0
    license_expiry: Optional[date] = None
    license_document_url: Optional[str] = None
    rejection_reason: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def extract_location(cls, values):
        """Extract lat/lng from Geometry location field"""
        if hasattr(values, '__dict__'):
            data = {}
            for key in ['id', 'user_id', 'organization_name', 'license_number', 'verification_status',
                        'address', 'capacity_kg', 'current_stock_kg', 'qr_token', 'rating',
                        'total_claims', 'license_expiry', 'license_document_url', 'rejection_reason',
                        'verified_at', 'created_at', 'location', 'preferred_food_types']:
                if hasattr(values, key):
                    data[key] = getattr(values, key)

            if 'location' in data and data['location']:
                lat, lng = extract_coords_from_geometry(data['location'])
                data['latitude'] = lat
                data['longitude'] = lng
            return data
        return values


# Volunteer Schemas
class VolunteerCreate(BaseModel):
    user_id: Optional[UUID] = None
    vehicle_type: VehicleType
    vehicle_plate: Optional[str] = None
    capacity_kg: int = 15


class VolunteerUpdate(BaseModel):
    vehicle_type: Optional[VehicleType] = None
    vehicle_plate: Optional[str] = None
    capacity_kg: Optional[int] = None


class VolunteerResponse(BaseModel):
    id: UUID
    user_id: UUID
    vehicle_type: VehicleType
    vehicle_plate: Optional[str] = None
    capacity_kg: int = 15
    status: VolunteerStatus = VolunteerStatus.OFFLINE
    current_task_id: Optional[UUID] = None
    id_verified: bool = False
    rating: float = 5.0
    total_deliveries: int = 0
    on_time_percentage: float = 100.0
    created_at: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def extract_location(cls, values):
        """Extract lat/lng from Geometry current_location field"""
        if hasattr(values, '__dict__'):
            data = {}
            for key in ['id', 'user_id', 'vehicle_type', 'vehicle_plate', 'capacity_kg',
                        'status', 'current_task_id', 'id_verified', 'rating', 'total_deliveries',
                        'on_time_percentage', 'created_at', 'current_location']:
                if hasattr(values, key):
                    data[key] = getattr(values, key)

            if 'current_location' in data and data['current_location']:
                lat, lng = extract_coords_from_geometry(data['current_location'])
                data['latitude'] = lat
                data['longitude'] = lng
            return data
        return values


class VolunteerLocationUpdate(BaseModel):
    latitude: float
    longitude: float


class VolunteerStatusUpdate(BaseModel):
    status: VolunteerStatus


# Task Schemas
class TaskCreate(BaseModel):
    donor_id: Optional[UUID] = None
    pickup_lat: float
    pickup_lng: float
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    food_type: FoodType
    quantity_kg: float
    description: Optional[str] = None
    requires_cooling: bool = False
    expiry_time: datetime


class TaskAssignRequest(BaseModel):
    volunteer_id: UUID


class TaskResponse(BaseModel):
    id: UUID
    donor_id: UUID
    ngo_id: Optional[UUID] = None
    volunteer_id: Optional[UUID] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    distance_km: Optional[float] = None
    food_type: FoodType
    quantity_kg: float
    description: Optional[str] = None
    requires_cooling: bool = False
    expiry_time: datetime
    status: TaskStatus = TaskStatus.PENDING
    pickup_token: str
    delivery_token: str
    pickup_verified_at: Optional[datetime] = None
    delivery_verified_at: Optional[datetime] = None
    assigned_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def extract_locations(cls, values):
        """Extract lat/lng from Geometry pickup_location and drop_location fields"""
        if hasattr(values, '__dict__'):
            data = {}
            for key in ['id', 'donor_id', 'ngo_id', 'volunteer_id', 'distance_km', 'food_type',
                        'quantity_kg', 'description', 'requires_cooling', 'expiry_time', 'status',
                        'pickup_token', 'delivery_token', 'pickup_verified_at', 'delivery_verified_at',
                        'assigned_at', 'completed_at', 'created_at', 'pickup_location', 'drop_location']:
                if hasattr(values, key):
                    data[key] = getattr(values, key)

            if 'pickup_location' in data and data['pickup_location']:
                lat, lng = extract_coords_from_geometry(data['pickup_location'])
                data['pickup_lat'] = lat
                data['pickup_lng'] = lng

            if 'drop_location' in data and data['drop_location']:
                lat, lng = extract_coords_from_geometry(data['drop_location'])
                data['drop_lat'] = lat
                data['drop_lng'] = lng

            return data
        return values


class QRVerifyRequest(BaseModel):
    token: str


# Authentication Schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[UUID] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
