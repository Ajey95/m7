from database import SessionLocal
from models import User
from sqlalchemy import func


def verify_dispatcher():
    db = SessionLocal()
    try:
        email = "dispatcher@foodrescue.com"
        print(f"Checking user: {email}...")

        user = db.query(User).filter(func.lower(User.email) == email.lower()).first()

        if user:
            print("✅ User found!")
            print(f"ID: {user.id}")
            print(f"Name: {user.full_name}")
            print(f"Email: {user.email}")
            print(f"Role: {user.role}")
            print(f"Is Active: {user.is_active}")
            print(f"Clerk ID: {user.clerk_user_id}")
        else:
            print("❌ User NOT found!")

    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    verify_dispatcher()
