"""
Serialization utilities for converting SQLAlchemy models to JSON-serializable dicts.
Handles PostGIS Geometry fields by extracting lat/lng coordinates.
"""
from typing import Any, Dict, List
from datetime import datetime
from decimal import Decimal
from uuid import UUID


def geometry_to_coords(geom) -> tuple:
    """Extract (latitude, longitude) from a PostGIS Geometry field"""
    if geom is None:
        return None, None
    try:
        from geoalchemy2.shape import to_shape
        point = to_shape(geom)
        return point.y, point.x  # lat=y, lng=x
    except Exception:
        return None, None


def serialize_value(value: Any) -> Any:
    """Convert a value to JSON-serializable format"""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    if hasattr(value, '__geo_interface__'):  # Geometry-like object
        lat, lng = geometry_to_coords(value)
        return {"latitude": lat, "longitude": lng}
    if hasattr(value, 'value'):  # Enum
        return value.value
    if isinstance(value, list):
        return [serialize_value(item) for item in value]
    return value


def serialize_user(user) -> Dict:
    """Serialize a User model to dict"""
    if user is None:
        return None
    return {
        "id": str(user.id),
        "clerk_user_id": user.clerk_user_id,
        "email": user.email,
        "phone_number": user.phone_number,
        "full_name": user.full_name,
        "role": user.role.value if user.role else None,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


def serialize_donor(donor) -> Dict:
    """Serialize a Donor model to dict"""
    if donor is None:
        return None
    lat, lng = geometry_to_coords(donor.location)
    return {
        "id": str(donor.id),
        "user_id": str(donor.user_id),
        "organization_name": donor.organization_name,
        "address": donor.address,
        "latitude": lat,
        "longitude": lng,
        "qr_token": donor.qr_token,
        "rating": float(donor.rating) if donor.rating else 5.0,
        "total_donations": donor.total_donations or 0,
        "created_at": donor.created_at.isoformat() if donor.created_at else None,
    }


def serialize_ngo(ngo) -> Dict:
    """Serialize an NGO model to dict"""
    if ngo is None:
        return None
    lat, lng = geometry_to_coords(ngo.location)
    return {
        "id": str(ngo.id),
        "user_id": str(ngo.user_id),
        "name": ngo.organization_name,  # Frontend expects 'name'
        "organization_name": ngo.organization_name,
        "email": ngo.user.email if ngo.user else None,
        "phone": ngo.user.phone_number if ngo.user else None,
        "license_number": ngo.license_number,
        "verification_status": ngo.verification_status.value if ngo.verification_status else "PENDING",
        # Frontend expects 'approval_status'
        "approval_status": ngo.verification_status.value if ngo.verification_status else "PENDING",
        # Frontend expects 'status'
        "status": ngo.verification_status.value if ngo.verification_status else "PENDING",
        "address": ngo.address,
        "latitude": lat,
        "longitude": lng,
        "capacity_kg": ngo.capacity_kg or 100,
        "storage_capacity": ngo.capacity_kg or 100,  # Frontend expects 'storage_capacity'
        "current_stock_kg": ngo.current_stock_kg or 0,
        "total_stored": ngo.current_stock_kg or 0,  # Frontend expects 'total_stored'
        "qr_token": ngo.qr_token,
        "rating": float(ngo.rating) if ngo.rating else 5.0,
        "total_claims": ngo.total_claims or 0,
        "license_expiry": ngo.license_expiry.isoformat() if ngo.license_expiry else None,
        "license_document_url": ngo.license_document_url,
        "rejection_reason": ngo.rejection_reason,
        "verified_at": ngo.verified_at.isoformat() if ngo.verified_at else None,
        "created_at": ngo.created_at.isoformat() if ngo.created_at else None,
    }


def serialize_volunteer(volunteer) -> Dict:
    """Serialize a Volunteer model to dict"""
    if volunteer is None:
        return None
    lat, lng = geometry_to_coords(volunteer.current_location)
    return {
        "id": str(volunteer.id),
        "user_id": str(volunteer.user_id),
        "name": volunteer.user.full_name if volunteer.user else "Unknown Volunteer",
        "email": volunteer.user.email if volunteer.user else None,
        "phone": volunteer.user.phone_number if volunteer.user else None,
        "id_proof_url": volunteer.id_proof_url,
        "vehicle_type": volunteer.vehicle_type.value if volunteer.vehicle_type else None,
        "vehicle_plate": volunteer.vehicle_plate,
        "capacity_kg": volunteer.capacity_kg or 15,
        "status": volunteer.status.value if volunteer.status else "OFFLINE",
        "is_available": (volunteer.status.value == "ONLINE") if volunteer.status else False,
        "current_task_id": str(volunteer.current_task_id) if volunteer.current_task_id else None,
        "id_verified": volunteer.id_verified or False,
        "rating": float(volunteer.rating) if volunteer.rating else 5.0,
        "total_deliveries": volunteer.total_deliveries or 0,
        "on_time_percentage": float(volunteer.on_time_percentage) if volunteer.on_time_percentage else 100.0,
        "latitude": lat,
        "longitude": lng,
        "created_at": volunteer.created_at.isoformat() if volunteer.created_at else None,
    }


def serialize_task(task) -> Dict:
    """Serialize a Task model to dict"""
    if task is None:
        return None
    pickup_lat, pickup_lng = geometry_to_coords(task.pickup_location)
    drop_lat, drop_lng = geometry_to_coords(task.drop_location)
    return {
        "id": str(task.id),
        "donor_id": str(task.donor_id),
        "donor_name": task.donor.organization_name if task.donor else "Unknown Donor",
        "ngo_id": str(task.ngo_id) if task.ngo_id else None,
        "volunteer_id": str(task.volunteer_id) if task.volunteer_id else None,
        "pickup_lat": pickup_lat,
        "pickup_lng": pickup_lng,
        "pickup_address": task.donor.address if (task.donor and task.donor.address) else "Please update address",
        "delivery_address": task.ngo.address if task.ngo else None,
        "drop_lat": drop_lat,
        "drop_lng": drop_lng,
        "distance_km": float(task.distance_km) if task.distance_km else None,
        "food_type": task.food_type.value if task.food_type else None,
        "quantity_kg": float(task.quantity_kg) if task.quantity_kg else 0,
        "description": task.description,
        "requires_cooling": task.requires_cooling or False,
        "expiry_time": task.expiry_time.isoformat() if task.expiry_time else None,
        "status": task.status.value if task.status else "PENDING",
        "pickup_token": task.pickup_token,
        "delivery_token": task.delivery_token,
        "pickup_verified_at": task.pickup_verified_at.isoformat() if task.pickup_verified_at else None,
        "delivery_verified_at": task.delivery_verified_at.isoformat() if task.delivery_verified_at else None,
        "assigned_at": task.assigned_at.isoformat() if task.assigned_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        "created_at": task.created_at.isoformat() if task.created_at else None,
    }


def serialize_list(items: List, serializer) -> List[Dict]:
    """Serialize a list of model items"""
    return [serializer(item) for item in items]
