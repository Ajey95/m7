"""Seed one clean demo account per role for easy login testing."""
from database import SessionLocal
from models import User, UserRole, Volunteer, Donor, NGO, VehicleType, VolunteerStatus, VerificationStatus
from utils.qr_generator import generate_qr_token
from utils.spatial import create_point

DEMO_USERS = [
    {"email": "donor@demo.com",      "full_name": "Demo Donor",      "role": UserRole.DONOR,      "phone": "+10000000001", "clerk_id": "demo_donor"},
    {"email": "ngo@demo.com",        "full_name": "Demo NGO",        "role": UserRole.NGO,        "phone": "+10000000002", "clerk_id": "demo_ngo"},
    {"email": "volunteer@demo.com",  "full_name": "Demo Volunteer",  "role": UserRole.VOLUNTEER,  "phone": "+10000000003", "clerk_id": "demo_volunteer"},
    {"email": "dispatcher@demo.com", "full_name": "Demo Dispatcher", "role": UserRole.DISPATCHER, "phone": "+10000000004", "clerk_id": "demo_dispatcher"},
]

db = SessionLocal()
try:
    for u in DEMO_USERS:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if existing:
            print(f"EXISTS   {u['role'].value:<12}  {u['email']}")
            continue

        new_user = User(
            clerk_user_id=u["clerk_id"],
            email=u["email"],
            full_name=u["full_name"],
            phone_number=u["phone"],
            role=u["role"],
            is_active=True,
        )
        db.add(new_user)
        db.flush()

        role = u["role"]
        if role == UserRole.DONOR:
            db.add(Donor(
                user_id=new_user.id,
                organization_name=u["full_name"],
                address="123 Demo Street",
                location=create_point(12.97, 77.59),
                qr_token=generate_qr_token(),
                rating=5.0,
                total_donations=0,
            ))
        elif role == UserRole.NGO:
            db.add(NGO(
                user_id=new_user.id,
                organization_name=u["full_name"],
                license_number="DEMO-NGO-001",
                address="456 NGO Avenue",
                location=create_point(12.98, 77.60),
                capacity_kg=500,
                current_stock_kg=0,
                qr_token=generate_qr_token(),
                rating=5.0,
                verification_status=VerificationStatus.VERIFIED,
            ))
        elif role == UserRole.VOLUNTEER:
            db.add(Volunteer(
                user_id=new_user.id,
                vehicle_type=VehicleType.BIKE,
                vehicle_plate="DEMO-001",
                capacity_kg=20,
                status=VolunteerStatus.ONLINE,
                rating=5.0,
                total_deliveries=0,
                on_time_percentage=100.0,
            ))

        db.commit()
        print(f"CREATED  {u['role'].value:<12}  {u['email']}")

    print("\n=== Demo Login Credentials ===")
    print("Password: anything (TEST_MODE skips password check)")
    for u in DEMO_USERS:
        print(f"  {u['role'].value:<12}  {u['email']}")

finally:
    db.close()
