"""Script to add missing columns to PostgreSQL tables"""
from sqlalchemy import create_engine, text
from config import settings


def add_missing_columns():
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Check if tasks.rating column exists
        result = conn.execute(text("""
            SELECT EXISTS(
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'tasks' AND column_name = 'rating'
            )
        """))
        exists = result.scalar()

        if not exists:
            print("Adding rating column to tasks table...")
            conn.execute(text("""
                ALTER TABLE tasks ADD COLUMN rating DECIMAL(3, 2)
            """))
            conn.commit()
            print("rating column added successfully!")
        else:
            print("tasks.rating column already exists")

        # Check if tasks.rating_feedback column exists
        result = conn.execute(text("""
            SELECT EXISTS(
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'tasks' AND column_name = 'rating_feedback'
            )
        """))
        exists = result.scalar()

        if not exists:
            print("Adding rating_feedback column to tasks table...")
            conn.execute(text("""
                ALTER TABLE tasks ADD COLUMN rating_feedback TEXT
            """))
            conn.commit()
            print("rating_feedback column added successfully!")
        else:
            print("tasks.rating_feedback column already exists")

        # Check if tasks.rated_at column exists
        result = conn.execute(text("""
            SELECT EXISTS(
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'tasks' AND column_name = 'rated_at'
            )
        """))
        exists = result.scalar()

        if not exists:
            print("Adding rated_at column to tasks table...")
            conn.execute(text("""
                ALTER TABLE tasks ADD COLUMN rated_at TIMESTAMP
            """))
            conn.commit()
            print("rated_at column added successfully!")
        else:
            print("tasks.rated_at column already exists")

        # Show tasks columns
        result = conn.execute(text("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'tasks'
            ORDER BY ordinal_position
        """))
        print("\nTasks table columns:")
        for row in result:
            print(f"  {row[0]}: {row[1]}")


if __name__ == "__main__":
    add_missing_columns()
