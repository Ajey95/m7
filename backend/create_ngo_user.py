from database import SessionLocal
from models import User, UserRole, NGO, FoodType, VerificationStatus
from utils.spatial import create_point
from passlib.context import CryptContext
import uuid
import datetime

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_ngo_user():
    db = SessionLocal()
    email = "hope@foundation.org"

    # Check if user exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        print(f"User {email} already exists.")
        return

    print(f"Creating user {email}...")

    # Create User
    new_user = User(
        id=uuid.uuid4(),
        clerk_user_id=f"test_ngo_{uuid.uuid4().hex[:8]}",  # Fake clerk ID
        email=email,
        full_name="Hope Foundation",
        role=UserRole.NGO,
        is_active=True,
        phone_number="1234567890"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Create NGO Profile
    print("Creating NGO profile...")
    new_ngo = NGO(
        id=uuid.uuid4(),
        user_id=new_user.id,
        organization_name="Hope Foundation",
        license_number=f"LIC-{uuid.uuid4().hex[:8]}",
        address="123 Charity Lane, Cityville",
        location=create_point(12.9716, 77.5946),  # Bangalore coordinates
        qr_token=f"ngo-qr-{uuid.uuid4().hex[:8]}",
        created_at=datetime.datetime.utcnow(),
        preferred_food_types=[FoodType.VEG, FoodType.NON_VEG],
        capacity_kg=500,
        current_stock_kg=50,
        verification_status=VerificationStatus.VERIFIED,
        verified_at=datetime.datetime.utcnow()
    )
    db.add(new_ngo)
    db.commit()
    print(f"Successfully created NGO user: {email} / password123 (implicit, mock login)")


if __name__ == "__main__":
    create_ngo_user()
