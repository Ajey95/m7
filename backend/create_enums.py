"""Script to create missing PostgreSQL enum types"""
from sqlalchemy import create_engine, text
from config import settings


def create_enums():
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Check if foodtype enum exists
        result = conn.execute(text(
            "SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'foodtype')"
        ))
        exists = result.scalar()

        if not exists:
            print("Creating foodtype enum...")
            conn.execute(text("""
                CREATE TYPE foodtype AS ENUM (
                    'COOKED_FOOD',
                    'RAW_VEGETABLES',
                    'FRUITS',
                    'DAIRY',
                    'BAKERY',
                    'PACKAGED',
                    'BEVERAGES',
                    'OTHER'
                )
            """))
            conn.commit()
            print("foodtype enum created successfully!")
        else:
            print("foodtype enum already exists")

        # Check column type in ngos table
        result = conn.execute(text("""
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_name = 'ngos'
            ORDER BY ordinal_position
        """))
        print("\nNGOs table columns:")
        for row in result:
            print(f"  {row[0]}: {row[1]} ({row[2]})")


if __name__ == "__main__":
    create_enums()
