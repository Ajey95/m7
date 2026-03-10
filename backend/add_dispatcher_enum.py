"""Script to add DISPATCHER to user_role enum in PostgreSQL"""
from sqlalchemy import create_engine, text
from config import settings


def add_dispatcher_enum():
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        print("Checking user_role enum...")

        # Check if user_role type exists
        result = conn.execute(text(
            "SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'user_role')"
        ))
        exists = result.scalar()

        if not exists:
            print("❌ user_role enum type NOT found!")
            return

        print("✅ user_role enum found.")

        # Add DISPATCHER value
        try:
            print("Adding 'DISPATCHER' to user_role enum...")
            # Note: IF NOT EXISTS for ADD VALUE is only supported in Postgres 12+
            # If it fails, we catch the exception (likely "duplicate value")
            conn.execute(text("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'DISPATCHER'"))
            conn.commit()
            print("✅ 'DISPATCHER' added successfully!")
        except Exception as e:
            print(f"⚠️ Result: {e}")
            # If strictly duplicate, it's fine.
            if "already exists" in str(e) or "duplicate" in str(e):
                print("   (Value likely already exists, which is fine)")
            conn.rollback()


if __name__ == "__main__":
    add_dispatcher_enum()
