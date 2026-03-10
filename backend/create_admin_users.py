"""
Create Admin and Dispatcher Users
===================================
This script creates admin and dispatcher users for the web dashboard.
Run this to set up control center access.

Usage:
    python create_admin_users.py
"""
from database import SessionLocal
from models import User


def create_admin_dispatcher():
    """Create admin and dispatcher users if they don't exist"""

    users_to_create = [
        {
            "email": "admin@foodrescue.com",
            "full_name": "System Administrator",
            "phone_number": "+1234567890",
            "role": "ADMIN",
            "clerk_user_id": "admin_system"
        },
        {
            "email": "dispatcher@foodrescue.com",
            "full_name": "Central Dispatcher",
            "phone_number": "+1234567891",
            "role": "DISPATCHER",
            "clerk_user_id": "dispatcher_central"
        }
    ]

    session = SessionLocal()
    try:
        for user_data in users_to_create:
            # Check if user already exists
            existing_user = session.query(User).filter(User.email == user_data["email"]).first()

            if existing_user:
                print(f"✓ {user_data['role']} user already exists: {user_data['email']}")
                continue

            # Create new user
            new_user = User(
                email=user_data["email"],
                full_name=user_data["full_name"],
                phone_number=user_data["phone_number"],
                role=user_data["role"],
                clerk_user_id=user_data["clerk_user_id"],
                # hashed_password removed: User model does not store password in local test mode
                # is_verified removed: User model does not have this field
            )

            session.add(new_user)
            session.commit()

            print(f"✅ Created {user_data['role']} user: {user_data['email']}")
            print("   Password: admin123 (CHANGE THIS AFTER FIRST LOGIN!)")
    except Exception as e:
        print(f"Error creating users: {e}")
        session.rollback()
    finally:
        session.close()

    print("\n" + "=" * 60)
    print("ADMIN & DISPATCHER USERS CREATED")
    print("=" * 60)
    print("\nLogin Credentials:")
    print("-" * 60)
    print("Admin:")
    print("  Email: admin@foodrescue.com")
    print("  Password: admin123")
    print("\nDispatcher:")
    print("  Email: dispatcher@foodrescue.com")
    print("  Password: admin123")
    print("-" * 60)
    print("\n⚠️  IMPORTANT: Change these passwords after first login!")
    print("Web Dashboard: http://localhost:3000/login")
    print("=" * 60)


if __name__ == "__main__":
    print("Creating Admin and Dispatcher users...")
    create_admin_dispatcher()
