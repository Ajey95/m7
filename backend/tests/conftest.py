"""
Test configuration and fixtures for API endpoint testing.
Uses proper transaction isolation to prevent test interference.
"""
import pytest
from sqlalchemy import event
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient
import os
import uuid

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Import app and database
from main import fastapi_app as app
from database import Base, get_db, engine  # reuse the same psycopg3 engine
from models import User, UserRole, Donor, NGO, Volunteer, Task, TaskStatus, VolunteerStatus, VerificationStatus

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """
    Get database session with transaction isolation.
    Uses SAVEPOINT to ensure each test runs in an isolated transaction
    that gets rolled back after the test completes.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    # Begin a nested transaction (SAVEPOINT)
    nested = connection.begin_nested()
    
    # Restart SAVEPOINT when it's released (committed or rolled back)
    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(s, tx):
        nonlocal nested
        if tx.nested and not tx._parent.nested:
            nested = connection.begin_nested()
    
    try:
        yield session
    finally:
        session.close()
        # Rollback the main transaction
        transaction.rollback()
        connection.close()


@pytest.fixture(scope="function")
def client(db):
    """Get test client with database dependency override"""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# --- Test Data Fixtures ---

@pytest.fixture
def test_user(db):
    """Create a test user in the database"""
    unique_id = uuid.uuid4().hex[:8]
    user = User(
        email=f"test_{unique_id}@example.com",
        phone_number=f"+1555{unique_id[:7]}",
        full_name="Test User",
        role=UserRole.DONOR,
        clerk_user_id=f"user_test_{unique_id}",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_admin(db):
    """Create a test admin user in the database"""
    unique_id = uuid.uuid4().hex[:8]
    admin = User(
        email=f"admin_{unique_id}@example.com",
        phone_number=f"+1555{unique_id[:7]}",
        full_name="Admin User",
        role=UserRole.ADMIN,
        clerk_user_id=f"user_admin_{unique_id}",
        is_active=True
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


@pytest.fixture
def test_volunteer_user(db):
    """Create a test volunteer user in the database"""
    unique_id = uuid.uuid4().hex[:8]
    user = User(
        email=f"volunteer_{unique_id}@example.com",
        phone_number=f"+1555{unique_id[:7]}",
        full_name="Volunteer User",
        role=UserRole.VOLUNTEER,
        clerk_user_id=f"user_volunteer_{unique_id}",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_ngo_user(db):
    """Create a test NGO user in the database"""
    unique_id = uuid.uuid4().hex[:8]
    user = User(
        email=f"ngo_{unique_id}@example.com",
        phone_number=f"+1555{unique_id[:7]}",
        full_name="NGO Manager",
        role=UserRole.NGO,
        clerk_user_id=f"user_ngo_{unique_id}",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user):
    """Generate auth headers for test user"""
    from utils.auth import create_access_token
    access_token = create_access_token(
        data={"sub": test_user.email, "user_id": str(test_user.id), "role": test_user.role.value}
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def admin_headers(test_admin):
    """Generate auth headers for admin user"""
    from utils.auth import create_access_token
    access_token = create_access_token(
        data={"sub": test_admin.email, "user_id": str(test_admin.id), "role": test_admin.role.value}
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def volunteer_headers(test_volunteer_user):
    """Generate auth headers for volunteer user"""
    from utils.auth import create_access_token
    access_token = create_access_token(
        data={"sub": test_volunteer_user.email, "user_id": str(test_volunteer_user.id), "role": test_volunteer_user.role.value}
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def ngo_headers(test_ngo_user):
    """Generate auth headers for NGO user"""
    from utils.auth import create_access_token
    access_token = create_access_token(
        data={"sub": test_ngo_user.email, "user_id": str(test_ngo_user.id), "role": test_ngo_user.role.value}
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def test_dispatcher_user(db):
    """Create a test dispatcher user in the database"""
    unique_id = uuid.uuid4().hex[:8]
    user = User(
        email=f"dispatcher_{unique_id}@example.com",
        phone_number=f"+1555{unique_id[:7]}",
        full_name="Dispatcher User",
        role=UserRole.DISPATCHER,
        clerk_user_id=f"user_dispatcher_{unique_id}",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def dispatcher_headers(test_dispatcher_user):
    """Generate auth headers for dispatcher user"""
    from utils.auth import create_access_token
    access_token = create_access_token(
        data={"sub": test_dispatcher_user.email, "user_id": str(test_dispatcher_user.id), "role": test_dispatcher_user.role.value}
    )
    return {"Authorization": f"Bearer {access_token}"}
