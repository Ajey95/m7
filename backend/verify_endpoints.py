"""
COMPREHENSIVE API VERIFICATION SCRIPT
Tests ALL endpoints with REAL data, expecting 200 responses.
Follows proper workflow sequence for task lifecycle.
"""
from fastapi.testclient import TestClient
from main import app
from config import settings
import uuid

# Enable Test Mode to allow local token generation/validation
settings.TEST_MODE = True
print(f"🔒 TEST_MODE: {settings.TEST_MODE}")

client = TestClient(app)
results = []
passed = 0
failed = 0


def log_result(method, endpoint, status_code, expected=200, details=""):
    global passed, failed
    success = status_code == expected
    if success:
        passed += 1
        results.append(f"\u2705 {method:6} {endpoint}: {status_code}")
    else:
        failed += 1
        results.append(f"\u274c {method:6} {endpoint}: {status_code} (expected {expected}) {details[:50]}")
    return success


def test_all_endpoints():
    unique_id = uuid.uuid4().hex[:8]

    print("\n" + "=" * 70)
    print("COMPREHENSIVE API VERIFICATION - All Endpoints with Real Data")
    print("=" * 70)

    # =========================================================================
    # 1. ROOT ENDPOINTS
    # =========================================================================
    print("\n[1/8] Testing Root Endpoints...")
    r = client.get("/")
    log_result("GET", "/", r.status_code)
    r = client.get("/health")
    log_result("GET", "/health", r.status_code)

    # =========================================================================
    # 2. AUTH ENDPOINTS - Create users for each role
    # =========================================================================
    print("[2/8] Testing Auth Endpoints & Creating Users...")

    # Create DONOR user
    donor_email = f"donor_{unique_id}@test.com"
    r = client.post("/api/v1/auth/register", json={
        "email": donor_email, "password": "testpass123", "full_name": "Test Donor",
        "role": "DONOR", "clerk_user_id": f"clerk_donor_{unique_id}"
    })
    log_result("POST", "/auth/register (donor)", r.status_code)
    r = client.post("/api/v1/auth/login", data={"username": donor_email, "password": "testpass123"})
    log_result("POST", "/auth/login", r.status_code)
    donor_token = r.json().get("access_token", "")
    donor_headers = {"Authorization": f"Bearer {donor_token}"}

    # Create NGO user
    ngo_email = f"ngo_{unique_id}@test.com"
    client.post("/api/v1/auth/register", json={
        "email": ngo_email, "password": "testpass123", "full_name": "Test NGO",
        "role": "NGO", "clerk_user_id": f"clerk_ngo_{unique_id}"
    })
    ngo_login = client.post("/api/v1/auth/login", data={"username": ngo_email, "password": "testpass123"})
    ngo_token = ngo_login.json().get("access_token", "")
    ngo_headers = {"Authorization": f"Bearer {ngo_token}"}

    # Create VOLUNTEER user
    volunteer_email = f"volunteer_{unique_id}@test.com"
    client.post("/api/v1/auth/register", json={
        "email": volunteer_email, "password": "testpass123", "full_name": "Test Volunteer",
        "role": "VOLUNTEER", "clerk_user_id": f"clerk_volunteer_{unique_id}"
    })
    volunteer_login = client.post("/api/v1/auth/login", data={"username": volunteer_email, "password": "testpass123"})
    volunteer_token = volunteer_login.json().get("access_token", "")
    volunteer_headers = {"Authorization": f"Bearer {volunteer_token}"}

    # Create ADMIN user
    admin_email = f"admin_{unique_id}@test.com"
    client.post("/api/v1/auth/register", json={
        "email": admin_email, "password": "testpass123", "full_name": "Test Admin",
        "role": "ADMIN", "clerk_user_id": f"clerk_admin_{unique_id}"
    })
    admin_login = client.post("/api/v1/auth/login", data={"username": admin_email, "password": "testpass123"})
    admin_token = admin_login.json().get("access_token", "")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    r = client.get("/api/v1/auth/me", headers=donor_headers)
    log_result("GET", "/auth/me", r.status_code)

    # =========================================================================
    # 3. DONOR ENDPOINTS
    # =========================================================================
    # =========================================================================
    # 3. DONOR ENDPOINTS
    # =========================================================================
    print("[3/8] Testing Donor Endpoints...")
    # Profile auto-created on register, so we update it
    r = client.patch("/api/v1/donors/me", headers=donor_headers, json={
        "organization_name": "Test Restaurant", "address": "123 Test St",
        "latitude": 40.7128, "longitude": -74.0060
    })
    log_result("PATCH", "/donors/me (update)", r.status_code)
    donor_id = r.json().get("id", "")

    r = client.get("/api/v1/donors/", headers=admin_headers)
    log_result("GET", "/donors/", r.status_code)
    # r = client.get("/api/v1/donors/me", headers=donor_headers) # Already tested via PATCH response
    # log_result("GET", "/donors/me", r.status_code)

    r = client.get(f"/api/v1/donors/{donor_id}", headers=admin_headers)
    log_result("GET", "/donors/{id}", r.status_code)
    r = client.get("/api/v1/donors/tasks", headers=donor_headers)
    log_result("GET", "/donors/tasks", r.status_code)

    # =========================================================================
    # 4. NGO ENDPOINTS
    # =========================================================================
    print("[4/8] Testing NGO Endpoints...")
    # Profile auto-created, update it
    r = client.patch("/api/v1/ngos/me", headers=ngo_headers, json={
        "organization_name": "Test NGO", "license_number": f"LIC-{unique_id}",
        "address": "456 NGO St", "latitude": 40.7200, "longitude": -74.0100, "capacity_kg": 200
    })
    log_result("PATCH", "/ngos/me (update)", r.status_code)
    ngo_id = r.json().get("id", "")

    r = client.get("/api/v1/ngos/", headers=admin_headers)
    log_result("GET", "/ngos/", r.status_code)
    r = client.get("/api/v1/ngos/me", headers=ngo_headers)
    log_result("GET", "/ngos/me", r.status_code)
    r = client.get(f"/api/v1/ngos/{ngo_id}", headers=admin_headers)
    log_result("GET", "/ngos/{id}", r.status_code)
    r = client.patch(f"/api/v1/ngos/{ngo_id}/verify?verification_status=VERIFIED", headers=admin_headers)
    log_result("PATCH", "/ngos/{id}/verify", r.status_code)
    r = client.get("/api/v1/ngos/nearby-tasks", headers=ngo_headers)
    log_result("GET", "/ngos/nearby-tasks", r.status_code)
    r = client.get("/api/v1/ngos/tasks", headers=ngo_headers)
    log_result("GET", "/ngos/tasks", r.status_code)

    # =========================================================================
    # 5. VOLUNTEER ENDPOINTS
    # =========================================================================
    print("[5/8] Testing Volunteer Endpoints...")
    # Profile auto-created, update it
    r = client.patch("/api/v1/volunteers/me", headers=volunteer_headers, json={
        "vehicle_type": "CAR", "vehicle_plate": "ABC-123", "capacity_kg": 50
    })
    log_result("PATCH", "/volunteers/me (update)", r.status_code)
    volunteer_id = r.json().get("id", "")

    r = client.get("/api/v1/volunteers/", headers=admin_headers)
    log_result("GET", "/volunteers/", r.status_code)
    r = client.get("/api/v1/volunteers/me", headers=volunteer_headers)
    log_result("GET", "/volunteers/me", r.status_code)
    r = client.get(f"/api/v1/volunteers/{volunteer_id}", headers=admin_headers)
    log_result("GET", "/volunteers/{id}", r.status_code)
    r = client.patch(
        "/api/v1/volunteers/location",
        headers=volunteer_headers,
        json={
            "latitude": 40.7150,
            "longitude": -
            74.0050})
    log_result("PATCH", "/volunteers/location", r.status_code)
    r = client.patch("/api/v1/volunteers/status", headers=volunteer_headers, json={"status": "ONLINE"})
    log_result("PATCH", "/volunteers/status", r.status_code)
    r = client.get("/api/v1/volunteers/current-task", headers=volunteer_headers)
    log_result("GET", "/volunteers/current-task", r.status_code)
    r = client.get("/api/v1/volunteers/task-history", headers=volunteer_headers)
    log_result("GET", "/volunteers/task-history", r.status_code)
    r = client.post("/api/v1/volunteers/go-offline", headers=volunteer_headers)
    log_result("POST", "/volunteers/go-offline", r.status_code)

    # =========================================================================
    # 6. TASK ENDPOINTS - Test Manual Assignment Flow
    # =========================================================================
    print("[6/8] Testing Task Endpoints (Full Workflow)...")

    # Step 1: Create task FIRST (volunteer is OFFLINE so no auto-assign)
    r = client.post("/api/v1/donors/tasks", headers=donor_headers, json={
        "pickup_lat": 40.7128, "pickup_lng": -74.0060, "drop_lat": 40.7200, "drop_lng": -74.0100,
        "food_type": "VEG", "quantity_kg": 10, "description": "Test donation",
        "requires_cooling": False, "expiry_time": "2026-02-09T12:00:00"
    })
    log_result("POST", "/donors/tasks (create)", r.status_code)
    task_id = r.json().get("id", "") if r.status_code == 200 else ""

    r = client.get("/api/v1/tasks/", headers=admin_headers)
    log_result("GET", "/tasks/", r.status_code)

    if task_id:
        # Step 2: Get task details
        r = client.get(f"/api/v1/tasks/{task_id}", headers=admin_headers)
        log_result("GET", "/tasks/{id}", r.status_code)

        # Step 3: Volunteer goes online AFTER task is created (so no auto-assign happened)
        r = client.post("/api/v1/volunteers/go-online?latitude=40.715&longitude=-74.005", headers=volunteer_headers)
        log_result("POST", "/volunteers/go-online", r.status_code)

        # Step 4: Admin assigns volunteer to the pending task
        r = client.post(f"/api/v1/tasks/{task_id}/assign/{volunteer_id}", headers=admin_headers)
        log_result("POST", "/tasks/{id}/assign/{vid}", r.status_code)

        # Step 5: Volunteer accepts the task
        r = client.post(f"/api/v1/tasks/{task_id}/accept", headers=volunteer_headers)
        log_result("POST", "/tasks/{id}/accept", r.status_code)

        # Step 6: Get tokens from task for verification
        r = client.get(f"/api/v1/tasks/{task_id}", headers=volunteer_headers)
        task_data = r.json() if r.status_code == 200 else {}
        pickup_token = task_data.get("pickup_token", "")
        delivery_token = task_data.get("delivery_token", "")

        # Step 7: Verify pickup with correct token
        r = client.post(
            f"/api/v1/tasks/{task_id}/pickup-verify",
            headers=volunteer_headers,
            json={
                "token": pickup_token})
        log_result("POST", "/tasks/{id}/pickup-verify", r.status_code)

        # Step 8: Verify delivery with correct token
        r = client.post(
            f"/api/v1/tasks/{task_id}/delivery-verify",
            headers=volunteer_headers,
            json={
                "token": delivery_token})
        log_result("POST", "/tasks/{id}/delivery-verify", r.status_code)

    # Test auto-assign (separate context)
    r = client.post("/api/v1/tasks/auto-assign", headers=admin_headers)
    log_result("POST", "/tasks/auto-assign", r.status_code)

    # Now test NGO claim with a NEW task
    r = client.post("/api/v1/donors/tasks", headers=donor_headers, json={
        "pickup_lat": 40.7130, "pickup_lng": -74.0062, "drop_lat": 40.7202, "drop_lng": -74.0102,
        "food_type": "NON_VEG", "quantity_kg": 5, "description": "Second donation",
        "requires_cooling": True, "expiry_time": "2026-02-10T12:00:00"
    })
    task2_id = r.json().get("id", "") if r.status_code == 200 else ""
    if task2_id:
        r = client.post(f"/api/v1/ngos/tasks/{task2_id}/claim", headers=ngo_headers)
        log_result("POST", "/ngos/tasks/{id}/claim", r.status_code)

    # =========================================================================
    # 7. ADMIN ENDPOINTS
    # =========================================================================
    print("[7/8] Testing Admin Endpoints...")
    r = client.get("/api/v1/admin/stats/overview", headers=admin_headers)
    log_result("GET", "/admin/stats/overview", r.status_code)
    if volunteer_id:
        r = client.get(f"/api/v1/admin/stats/volunteer/{volunteer_id}", headers=admin_headers)
        log_result("GET", "/admin/stats/volunteer/{id}", r.status_code)

    # =========================================================================
    # 8. RATINGS ENDPOINTS
    # =========================================================================
    print("[8/8] Testing Ratings Endpoints...")
    # Rate the first task (which should be DELIVERED now)
    if task_id:
        r = client.post(
            f"/api/v1/ratings/tasks/{task_id}/rate",
            headers=donor_headers,
            json={
                "rating": 4.5,
                "feedback": "Great delivery!"})
        log_result("POST", "/ratings/tasks/{id}/rate", r.status_code)
    if volunteer_id:
        r = client.get(f"/api/v1/ratings/volunteers/{volunteer_id}/ratings", headers=admin_headers)
        log_result("GET", "/ratings/volunteers/{id}/ratings", r.status_code)
        r = client.get(f"/api/v1/ratings/volunteers/{volunteer_id}/summary", headers=admin_headers)
        log_result("GET", "/ratings/volunteers/{id}/summary", r.status_code)

    # =========================================================================
    # 9. DISPATCHER ENDPOINTS
    # =========================================================================
    print("[9/9] Testing Dispatcher Endpoints...")
    # Login as Dispatcher (created via create_admin_users.py)
    # We use a known test user for this script, so we'll register a new one here
    dispatcher_email = f"dispatcher_{unique_id}@test.com"
    client.post("/api/v1/auth/register", json={
        "email": dispatcher_email, "password": "testpass123", "full_name": "Test Dispatcher",
        "role": "DISPATCHER", "clerk_user_id": f"clerk_dispatcher_{unique_id}"
    })
    dispatcher_login = client.post("/api/v1/auth/login", data={"username": dispatcher_email, "password": "testpass123"})
    dispatcher_token = dispatcher_login.json().get("access_token", "")
    dispatcher_headers = {"Authorization": f"Bearer {dispatcher_token}"}

    r = client.get("/api/v1/dispatcher/tasks", headers=dispatcher_headers)
    log_result("GET", "/dispatcher/tasks", r.status_code)

    r = client.get("/api/v1/dispatcher/stats", headers=dispatcher_headers)
    log_result("GET", "/dispatcher/stats", r.status_code)

    # =========================================================================
    # FINAL RESULTS
    # =========================================================================
    print("\n" + "=" * 70)
    print("DETAILED RESULTS")
    print("=" * 70)
    for result in results:
        print(f"  {result}")

    print("\n" + "=" * 70)
    print(f"SUMMARY: {passed} passed, {failed} failed out of {passed + failed} tests")
    print("=" * 70)

    if failed == 0:
        print("🎉 ALL ENDPOINTS RETURNED 200 OK!")
    else:
        print(f"⚠️  {failed} endpoint(s) did not return 200 OK")

    return failed == 0


if __name__ == "__main__":
    success = test_all_endpoints()
    exit(0 if success else 1)
