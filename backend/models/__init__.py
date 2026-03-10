from sqlalchemy import (Column, String, Boolean, DateTime, Date,
                        Enum as SQLEnum, Text, ForeignKey, Integer, DECIMAL, ARRAY)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from geoalchemy2 import Geometry
from geoalchemy2.shape import to_shape
from database import Base
import uuid
from datetime import datetime
import enum


def get_coords_from_geom(geom):
    """Extract (latitude, longitude) from a Geometry field"""
    if geom is None:
        return None, None
    try:
        point = to_shape(geom)
        return point.y, point.x  # lat=y, lng=x
    except Exception:
        return None, None


# Enums
class UserRole(str, enum.Enum):
    DONOR = "DONOR"
    NGO = "NGO"
    VOLUNTEER = "VOLUNTEER"
    ADMIN = "ADMIN"
    DISPATCHER = "DISPATCHER"


class FoodType(str, enum.Enum):
    VEG = "VEG"
    NON_VEG = "NON_VEG"
    VEGAN = "VEGAN"
    MIXED = "MIXED"


class TaskStatus(str, enum.Enum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class VolunteerStatus(str, enum.Enum):
    ONLINE = "ONLINE"
    BUSY = "BUSY"
    OFFLINE = "OFFLINE"


class VehicleType(str, enum.Enum):
    BIKE = "BIKE"
    SCOOTER = "SCOOTER"
    CAR = "CAR"
    VAN = "VAN"


class VerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"


# Models
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clerk_user_id = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    phone_number = Column(String(15), unique=True)
    full_name = Column(String(100), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    donor = relationship("Donor", back_populates="user", uselist=False)
    ngo = relationship("NGO", back_populates="user", uselist=False)
    volunteer = relationship("Volunteer", back_populates="user", uselist=False)


class Donor(Base):
    __tablename__ = "donors"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    organization_name = Column(String(150))
    address = Column(Text, nullable=False)
    location = Column(Geometry('POINT', srid=4326), nullable=False)
    qr_token = Column(String(100), unique=True, nullable=False)
    rating = Column(DECIMAL(3, 2), default=5.0)
    total_donations = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="donor")
    tasks = relationship("Task", back_populates="donor")

    @hybrid_property
    def latitude(self):
        lat, _ = get_coords_from_geom(self.location)
        return lat

    @hybrid_property
    def longitude(self):
        _, lng = get_coords_from_geom(self.location)
        return lng


class NGO(Base):
    __tablename__ = "ngos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    organization_name = Column(String(150), nullable=False)
    license_number = Column(String(100), unique=True, nullable=False)
    license_expiry = Column(Date)
    license_document_url = Column(String(500))
    rejection_reason = Column(Text)
    verification_status = Column(SQLEnum(VerificationStatus), default=VerificationStatus.PENDING)
    address = Column(Text, nullable=False)
    location = Column(Geometry('POINT', srid=4326), nullable=False)
    capacity_kg = Column(Integer, default=100)
    current_stock_kg = Column(Integer, default=0)
    preferred_food_types = Column(ARRAY(SQLEnum(FoodType, name='food_type', create_type=False)))
    qr_token = Column(String(100), unique=True, nullable=False)
    rating = Column(DECIMAL(3, 2), default=5.0)
    total_claims = Column(Integer, default=0)
    verified_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="ngo")
    branches = relationship("NGOBranch", back_populates="ngo")
    tasks = relationship("Task", back_populates="ngo")

    @hybrid_property
    def latitude(self):
        lat, _ = get_coords_from_geom(self.location)
        return lat

    @hybrid_property
    def longitude(self):
        _, lng = get_coords_from_geom(self.location)
        return lng


class NGOBranch(Base):
    __tablename__ = "ngo_branches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ngo_id = Column(UUID(as_uuid=True), ForeignKey("ngos.id", ondelete="CASCADE"))
    branch_name = Column(String(100), nullable=False)
    address = Column(Text, nullable=False)
    location = Column(Geometry('POINT', srid=4326), nullable=False)
    capacity_kg = Column(Integer, default=50)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    ngo = relationship("NGO", back_populates="branches")


class Volunteer(Base):
    __tablename__ = "volunteers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    vehicle_type = Column(SQLEnum(VehicleType), nullable=False)
    vehicle_plate = Column(String(20))
    capacity_kg = Column(Integer, default=15)
    status = Column(SQLEnum(VolunteerStatus), default=VolunteerStatus.OFFLINE)
    current_location = Column(Geometry('POINT', srid=4326))
    current_task_id = Column(UUID(as_uuid=True))
    last_heartbeat = Column(DateTime)
    id_proof_url = Column(String(500))
    id_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime)
    availability_schedule = Column(JSONB)
    rating = Column(DECIMAL(3, 2), default=5.0)
    total_deliveries = Column(Integer, default=0)
    on_time_percentage = Column(DECIMAL(5, 2), default=100.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="volunteer")
    tasks = relationship("Task", back_populates="volunteer")

    @hybrid_property
    def latitude(self):
        lat, _ = get_coords_from_geom(self.current_location)
        return lat

    @hybrid_property
    def longitude(self):
        _, lng = get_coords_from_geom(self.current_location)
        return lng


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    donor_id = Column(UUID(as_uuid=True), ForeignKey("donors.id"), nullable=False)
    ngo_id = Column(UUID(as_uuid=True), ForeignKey("ngos.id"))
    volunteer_id = Column(UUID(as_uuid=True), ForeignKey("volunteers.id"))
    pickup_location = Column(Geometry('POINT', srid=4326), nullable=False)
    drop_location = Column(Geometry('POINT', srid=4326))
    distance_km = Column(DECIMAL(5, 2))
    food_type = Column(SQLEnum(FoodType), nullable=False)
    quantity_kg = Column(DECIMAL(10, 2), nullable=False)
    description = Column(Text)
    requires_cooling = Column(Boolean, default=False)
    expiry_time = Column(DateTime, nullable=False)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING)
    pickup_token = Column(String(100), unique=True, nullable=False)
    delivery_token = Column(String(100), unique=True, nullable=False)
    pickup_verified_at = Column(DateTime)
    delivery_verified_at = Column(DateTime)
    pickup_proof_url = Column(String(500))
    drop_proof_url = Column(String(500))
    assigned_at = Column(DateTime)
    completed_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    cancellation_reason = Column(Text)
    rating = Column(DECIMAL(3, 2))
    rating_feedback = Column(Text)
    rated_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    donor = relationship("Donor", back_populates="tasks")
    ngo = relationship("NGO", back_populates="tasks")
    volunteer = relationship("Volunteer", back_populates="tasks")

    @hybrid_property
    def pickup_lat(self):
        lat, _ = get_coords_from_geom(self.pickup_location)
        return lat

    @hybrid_property
    def pickup_lng(self):
        _, lng = get_coords_from_geom(self.pickup_location)
        return lng

    @hybrid_property
    def drop_lat(self):
        lat, _ = get_coords_from_geom(self.drop_location)
        return lat

    @hybrid_property
    def drop_lng(self):
        _, lng = get_coords_from_geom(self.drop_location)
        return lng


class TrackingSession(Base):
    __tablename__ = "tracking_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"))
    volunteer_id = Column(UUID(as_uuid=True), ForeignKey("volunteers.id"))
    route_polyline = Column(Text)
    start_time = Column(DateTime, default=datetime.utcnow)
    last_update = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime)
    current_speed_kmh = Column(DECIMAL(5, 2))
    distance_traveled_km = Column(DECIMAL(5, 2))
    estimated_arrival = Column(DateTime)


class TaskException(Base):
    __tablename__ = "task_exceptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"))
    volunteer_id = Column(UUID(as_uuid=True), ForeignKey("volunteers.id"))
    issue_type = Column(String(50), nullable=False)
    description = Column(Text)
    location = Column(Geometry('POINT', srid=4326))
    photo_url = Column(String(500))
    resolved = Column(Boolean, default=False)
    resolution_notes = Column(Text)
    reported_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime)


class PerformanceStat(Base):
    __tablename__ = "performance_stats"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    volunteer_id = Column(UUID(as_uuid=True), ForeignKey("volunteers.id"))
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id"))
    on_time = Column(Boolean)
    completion_time_minutes = Column(Integer)
    distance_traveled_km = Column(DECIMAL(5, 2))
    rating = Column(Integer)
    feedback = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class AdminAction(Base):
    __tablename__ = "admin_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action_type = Column(String(50), nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
