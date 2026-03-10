from database import SessionLocal
from models import Task, NGO, User
from sqlalchemy import desc


def align_ngo_location():
    db = SessionLocal()

    # Get the test NGO
    ngo = db.query(NGO).join(User).filter(User.email == 'hope@foundation.org').first()
    if not ngo:
        print("Test NGO not found!")
        return

    # Get the latest task
    latest_task = db.query(Task).order_by(desc(Task.created_at)).first()
    if not latest_task:
        print("No tasks found in DB!")
        return

    print(f"Updating NGO '{ngo.organization_name}' location...")
    print(f"Current NGO Location: {ngo.location}")
    print(f"Target Task Location: {latest_task.pickup_location}")

    # Update NGO location to match task
    ngo.location = latest_task.pickup_location
    db.commit()
    print("✅ NGO location updated to match latest task!")


if __name__ == "__main__":
    align_ngo_location()
