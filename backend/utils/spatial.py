from sqlalchemy.orm import Session
from geoalchemy2.elements import WKTElement


def create_point(latitude: float, longitude: float) -> WKTElement:
    """Create PostGIS POINT from lat/lng"""
    return WKTElement(f'POINT({longitude} {latitude})', srid=4326)


def extract_coordinates(geometry) -> tuple[float, float]:
    """Extract lat/lng from PostGIS geometry"""
    if geometry is None:
        return None, None
    # Convert to WKB and extract coordinates
    from geoalchemy2.shape import to_shape
    point = to_shape(geometry)
    return point.y, point.x  # lat, lng


def find_nearby_volunteers(
    db: Session,
    pickup_lat: float,
    pickup_lng: float,
    max_distance_km: float = 10
):
    """Find volunteers within distance using direct ORM query"""
    from models import Volunteer, VolunteerStatus

    # Get all online volunteers
    volunteers = db.query(Volunteer).filter(
        Volunteer.status == VolunteerStatus.ONLINE,
        Volunteer.current_task_id is None,
        Volunteer.current_location is not None
    ).all()

    # Filter by distance using Python
    nearby_volunteers = []
    for volunteer in volunteers:
        vol_lat, vol_lng = extract_coordinates(volunteer.current_location)
        if vol_lat and vol_lng:
            distance = calculate_distance_km(pickup_lat, pickup_lng, vol_lat, vol_lng)
            if distance <= max_distance_km:
                nearby_volunteers.append(volunteer)

    return nearby_volunteers


def find_nearby_tasks(
    db: Session,
    ngo_lat: float,
    ngo_lng: float,
    max_distance_km: float = 10
):
    """Find available tasks within distance using direct ORM query"""
    from models import Task, TaskStatus

    # Get all pending tasks without NGO assigned
    tasks = db.query(Task).filter(
        Task.status == TaskStatus.PENDING,
        Task.ngo_id is None
    ).all()

    # Filter by distance using Python (simpler, works without PostGIS functions)
    nearby_tasks = []
    for task in tasks:
        if task.pickup_location:
            task_lat, task_lng = extract_coordinates(task.pickup_location)
            if task_lat and task_lng:
                distance = calculate_distance_km(ngo_lat, ngo_lng, task_lat, task_lng)
                if distance <= max_distance_km:
                    nearby_tasks.append(task)

    return nearby_tasks


def calculate_distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two points in kilometers"""
    from math import radians, cos, sin, asin, sqrt

    # Haversine formula
    lon1, lat1, lon2, lat2 = map(radians, [lng1, lat1, lng2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    c = 2 * asin(sqrt(a))
    km = 6371 * c
    return round(km, 2)
