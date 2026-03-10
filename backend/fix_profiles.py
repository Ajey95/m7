from sqlalchemy.orm import Session
from database import SessionLocal
from models import User, Donor, UserRole
from utils.spatial import create_point
from utils.qr_generator import generate_pickup_delivery_tokens


def fix_missing_profiles():
    db: Session = SessionLocal()
    try:
        # Find all DONOR users without Donor profiles
        users = db.query(User).filter(User.role == UserRole.DONOR).all()
        fixed_count = 0

        for user in users:
            existing_donor = db.query(Donor).filter(Donor.user_id == user.id).first()
            if not existing_donor:
                print(f"Creating missing Donor profile for user: {user.email}")
                pickup_token, _ = generate_pickup_delivery_tokens()
                new_donor = Donor(
                    user_id=user.id,
                    organization_name=user.full_name,
                    address="Please update address",
                    location=create_point(0.0, 0.0),
                    qr_token=pickup_token,
                    rating=5.0,
                    total_donations=0
                )
                db.add(new_donor)
                fixed_count += 1

        db.commit()
        print(f"Fixed {fixed_count} missing Donor profiles.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    fix_missing_profiles()
