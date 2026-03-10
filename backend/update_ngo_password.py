from database import SessionLocal
from models import User
from utils.auth import get_password_hash


def update_password():
    db = SessionLocal()
    email = "hope@foundation.org"
    password = "password123"

    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"User {email} not found!")
        return

    print(f"Updating password for {email}...")
    user.hashed_password = get_password_hash(password)
    db.add(user)
    db.commit()
    print("Password updated successfully.")


if __name__ == "__main__":
    update_password()
