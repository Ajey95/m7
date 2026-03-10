from database import SessionLocal
from models import User, NGO


def dump_users():
    session = SessionLocal()
    try:
        email = "admin@foodrescue.com"
        user = session.query(User).filter(User.email == email).first()
        if user:
            print(f"✅ User FOUND: {email}")
            print(f"   ID: {user.id}")
            print(f"   ClerkID: {user.clerk_user_id}")
            print(f"   Role: {user.role}")
            print(f"   Active: {user.is_active}")
        else:
            print(f"❌ User NOT FOUND: {email}")

        # Also check dispatcher
        email = "dispatcher@foodrescue.com"
        user = session.query(User).filter(User.email == email).first()
        if user:
            print(f"✅ User FOUND: {email}")
        else:
            print(f"❌ User NOT FOUND: {email}")

        # Check NGOs
        print("\n--- NGOs ---")
        ngos_list = session.query(NGO).all()
        print(f"Found {len(ngos_list)} NGOs:")
        for n in ngos_list:
            print(f"  NGO: {n.organization_name} | Status: {n.verification_status}")

    except Exception as e:
        print(f"Error reading users: {e}")
    finally:
        session.close()


if __name__ == "__main__":
    dump_users()
