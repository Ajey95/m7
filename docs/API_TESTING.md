# API Testing Guide

Complete guide to test all API endpoints.

## Setup

1. **Start Backend:**
```powershell
cd C:\Users\sister\Documents\SE-VOLUNTEER\final\backend
python main.py
```

2. **Open Swagger UI:**
Navigate to http://localhost:8000/docs

## Test Sequence

### 1. Health Check

**Endpoint:** `GET /health`

**Expected Response:**
```json
{
  "status": "healthy",
  "database": "connected"
}
```

---

## Authentication Flow

### 2.1 Register Admin

**Endpoint:** `POST /api/v1/auth/register`

**Request Body:**
```json
{
  "email": "admin@test.com",
  "phone_number": "+1234567890",
  "full_name": "Admin User",
  "role": "ADMIN",
  "password": "admin123"
}
```

**Expected Response:**
```json
{
  "id": 1,
  "clerk_user_id": "user_...",
  "email": "admin@test.com",
  "phone_number": "+1234567890",
  "full_name": "Admin User",
  "role": "ADMIN",
  "is_active": true,
  "created_at": "2024-..."
}
```

### 2.2 Register Donor

**Request Body:**
```json
{
  "email": "donor@test.com",
  "phone_number": "+1111111111",
  "full_name": "John Donor",
  "role": "DONOR",
  "password": "test123"
}
```

### 2.3 Register NGO

**Request Body:**
```json
{
  "email": "ngo@test.com",
  "phone_number": "+2222222222",
  "full_name": "Food Bank NGO",
  "role": "NGO",
  "password": "test123"
}
```

### 2.4 Register Volunteer

**Request Body:**
```json
{
  "email": "volunteer@test.com",
  "phone_number": "+3333333333",
  "full_name": "Ram Kumar",
  "role": "VOLUNTEER",
  "password": "test123"
}
```

---

## Donor Workflow

### 3.1 Login as Donor

**Endpoint:** `POST /api/v1/auth/login`

**Form Data (OAuth2 format):**
- username: `donor@test.com`
- password: `test123`

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**📋 Copy the access_token!**

### 3.2 Authorize

Click **"Authorize"** button at top of Swagger UI.
Paste token: `eyJhbGciOiJIUzI1NiIs...`
Click "Authorize", then "Close".

### 3.3 Create Donor Profile

**Endpoint:** `POST /api/v1/donors/`

**Request Body (Kerala coordinates):**
```json
{
  "address": "Technopark Phase 1, Trivandrum, Kerala",
  "latitude": 8.5241,
  "longitude": 76.9366,
  "preferred_donation_types": ["COOKED_FOOD", "PACKAGED_FOOD"]
}
```

**Expected Response:**
```json
{
  "id": 1,
  "user_id": 2,
  "address": "Technopark Phase 1, Trivandrum, Kerala",
  "qr_token": "ABC123",
  "preferred_donation_types": ["COOKED_FOOD", "PACKAGED_FOOD"],
  "total_donations": 0,
  "average_rating": 0.0,
  "created_at": "2024-..."
}
```

### 3.4 Get My Donor Profile

**Endpoint:** `GET /api/v1/donors/me`

Should return same profile.

### 3.5 Create Donation Task

**Endpoint:** `POST /api/v1/donors/tasks`

**Request Body:**
```json
{
  "food_type": "COOKED_FOOD",
  "quantity": "20 meals",
  "perishable": true,
  "pickup_address": "Technopark Phase 1, Trivandrum",
  "pickup_latitude": 8.5241,
  "pickup_longitude": 76.9366,
  "dropoff_address": "Trivandrum Central",
  "dropoff_latitude": 8.4900,
  "dropoff_longitude": 76.9520,
  "special_instructions": "Hot meals, handle with care"
}
```

**Expected Response:**
```json
{
  "id": 1,
  "donor_id": 1,
  "ngo_id": null,
  "volunteer_id": null,  // Will be assigned if volunteer online
  "food_type": "COOKED_FOOD",
  "quantity": "20 meals",
  "perishable": true,
  "pickup_address": "Technopark Phase 1, Trivandrum",
  "pickup_latitude": 8.5241,
  "pickup_longitude": 76.9366,
  "dropoff_address": "Trivandrum Central",
  "dropoff_latitude": 8.4900,
  "dropoff_longitude": 76.9520,
  "special_instructions": "Hot meals, handle with care",
  "status": "PENDING",  // Or "ASSIGNED" if volunteer found
  "pickup_qr_token": "XYZ456",
  "delivery_qr_token": "DEF789",
  "created_at": "2024-..."
}
```

**📋 Note the task ID and QR tokens!**

### 3.6 View My Tasks

**Endpoint:** `GET /api/v1/donors/tasks`

Should show all tasks created by you.

---

## Volunteer Workflow

### 4.1 Login as Volunteer

**Logout first:** Click "Authorize", click "Logout".

**Endpoint:** `POST /api/v1/auth/login`
- username: `volunteer@test.com`
- password: `test123`

**Authorize with new token.**

### 4.2 Create Volunteer Profile

**Endpoint:** `POST /api/v1/volunteers/`

**Request Body:**
```json
{
  "vehicle_type": "BIKE",
  "license_plate": "KL-01-AB-1234",
  "availability_schedule": {
    "monday": "09:00-18:00",
    "tuesday": "09:00-18:00",
    "wednesday": "09:00-18:00",
    "thursday": "09:00-18:00",
    "friday": "09:00-18:00"
  }
}
```

### 4.3 Go Online

**Endpoint:** `POST /api/v1/volunteers/go-online`

**Query Parameters:**
- latitude: `8.5250`
- longitude: `76.9370`

**Expected Response:**
```json
{
  "id": 1,
  "user_id": 4,
  "vehicle_type": "BIKE",
  "license_plate": "KL-01-AB-1234",
  "current_status": "AVAILABLE",
  "current_task_id": null,
  "total_tasks_completed": 0,
  "average_rating": 0.0,
  "last_location_update": "2024-..."
}
```

### 4.4 Check Current Task

**Endpoint:** `GET /api/v1/volunteers/current-task`

If auto-assignment worked, you should see the task!

**If no task:** Create task as donor first (step 3.5), then check again.

### 4.5 Accept Task

**Endpoint:** `POST /api/v1/tasks/{task_id}/accept`

Replace `{task_id}` with actual task ID (e.g., `1`).

**Expected Response:**
```json
{
  "id": 1,
  "status": "ACCEPTED",
  "accepted_at": "2024-...",
  ...
}
```

### 4.6 Update Location

**Endpoint:** `PATCH /api/v1/volunteers/location`

**Request Body:**
```json
{
  "latitude": 8.5200,
  "longitude": 76.9400
}
```

Call this multiple times to simulate movement.

### 4.7 Verify Pickup (QR Scan)

**Endpoint:** `POST /api/v1/tasks/{task_id}/pickup-verify`

**Request Body:**
```json
{
  "qr_token": "XYZ456"
}
```

Use the `pickup_qr_token` from task response.

**Expected Response:**
```json
{
  "id": 1,
  "status": "IN_TRANSIT",
  "picked_up_at": "2024-...",
  ...
}
```

### 4.8 Verify Delivery (QR Scan)

**Endpoint:** `POST /api/v1/tasks/{task_id}/delivery-verify`

**Request Body:**
```json
{
  "qr_token": "DEF789"
}
```

Use the `delivery_qr_token` from task response.

**Expected Response:**
```json
{
  "id": 1,
  "status": "DELIVERED",
  "delivered_at": "2024-...",
  ...
}
```

✅ **Task Complete!** Volunteer status automatically changes to AVAILABLE.

### 4.9 View Task History

**Endpoint:** `GET /api/v1/volunteers/task-history`

Should show completed task.

### 4.10 Go Offline

**Endpoint:** `POST /api/v1/volunteers/go-offline`

---

## NGO Workflow

### 5.1 Login as NGO

**Logout, then login:**
- username: `ngo@test.com`
- password: `test123`

### 5.2 Create NGO Profile

**Endpoint:** `POST /api/v1/ngos/`

**Request Body:**
```json
{
  "organization_name": "Kerala Food Bank",
  "registration_number": "NGO-KL-2024-001",
  "headquarters_address": "Trivandrum, Kerala",
  "headquarters_latitude": 8.5241,
  "headquarters_longitude": 76.9366,
  "license_document_url": "https://example.com/license.pdf",
  "description": "Serving underprivileged communities in Kerala",
  "preferred_food_types": ["COOKED_FOOD", "PACKAGED_FOOD"],
  "max_capacity_per_day": 100
}
```

**Expected Response:**
```json
{
  "id": 1,
  "user_id": 3,
  "organization_name": "Kerala Food Bank",
  "registration_number": "NGO-KL-2024-001",
  "verification_status": "PENDING",
  ...
}
```

### 5.3 (Admin) Verify NGO

**Logout, login as admin:**
- username: `admin@test.com`
- password: `admin123`

**Manual step:** Update NGO verification status in database:
```sql
psql -U postgres -d foodrescue_unified_db
UPDATE ngos SET verification_status = 'VERIFIED' WHERE id = 1;
\q
```

### 5.4 Find Nearby Tasks

**Login back as NGO.**

**Endpoint:** `GET /api/v1/ngos/nearby-tasks`

**Query Parameters:**
- max_distance_km: `20`

Should show PENDING tasks within 20km.

### 5.5 Claim Task

**Endpoint:** `POST /api/v1/ngos/tasks/{task_id}/claim`

Replace `{task_id}` with task ID.

**Expected Response:**
```json
{
  "id": 1,
  "ngo_id": 1,
  ...
}
```

### 5.6 View My Tasks

**Endpoint:** `GET /api/v1/ngos/tasks`

---

## Admin Workflow

### 6.1 Login as Admin

- username: `admin@test.com`
- password: `admin123`

### 6.2 View All Tasks

**Endpoint:** `GET /api/v1/tasks/`

Should show all tasks in system.

**Filter by status:**
- status_filter: `PENDING`

### 6.3 Manual Assignment

**Endpoint:** `POST /api/v1/tasks/{task_id}/assign/{volunteer_id}`

Replace IDs with actual values.

### 6.4 Trigger Auto-Assignment

**Endpoint:** `POST /api/v1/tasks/auto-assign`

**Expected Response:**
```json
{
  "total_pending": 5,
  "assigned": 3,
  "failed": 2
}
```

### 6.5 Reassign Task

**Endpoint:** `POST /api/v1/tasks/{task_id}/reassign`

### 6.6 Complete Task

**Endpoint:** `POST /api/v1/tasks/{task_id}/complete`

Changes status from DELIVERED → COMPLETED.

### 6.7 Cancel Task

**Endpoint:** `POST /api/v1/tasks/{task_id}/cancel`

**Query Parameters:**
- reason: `Donor unavailable`

---

## Error Testing

### Invalid Credentials

**Endpoint:** `POST /api/v1/auth/login`
- username: `wrong@test.com`
- password: `wrong`

**Expected:** 401 Unauthorized

### Unauthorized Access

Try to access endpoint without token:
1. Click "Authorize", click "Logout"
2. Try `GET /api/v1/donors/me`

**Expected:** 401 Unauthorized

### Invalid QR Code

**Endpoint:** `POST /api/v1/tasks/1/pickup-verify`

**Request Body:**
```json
{
  "qr_token": "INVALID"
}
```

**Expected:** 400 Bad Request - "Invalid pickup QR code"

### Wrong User Access

Login as donor, try:
`GET /api/v1/volunteers/me`

**Expected:** 404 Not Found - "Volunteer profile not found"

---

## Performance Testing

### Spatial Query Performance

1. Create 10 volunteers at different locations
2. Create 10 tasks
3. Trigger auto-assignment
4. Check response time

### Location Update Performance

1. Volunteer goes online
2. Update location 100 times rapidly
3. Check tracking session path_coordinates array

---

## Complete Test Checklist

- [ ] Health check works
- [ ] Register 4 users (ADMIN, DONOR, NGO, VOLUNTEER)
- [ ] All users can login
- [ ] Donor creates profile
- [ ] Volunteer creates profile
- [ ] NGO creates profile (verify in DB)
- [ ] Volunteer goes online
- [ ] Donor creates task
- [ ] Task auto-assigns to volunteer
- [ ] Volunteer sees current task
- [ ] Volunteer accepts task
- [ ] Volunteer updates location
- [ ] Volunteer verifies pickup QR
- [ ] Task status changes to IN_TRANSIT
- [ ] Volunteer verifies delivery QR
- [ ] Task status changes to DELIVERED
- [ ] Volunteer status returns to AVAILABLE
- [ ] Volunteer sees task in history
- [ ] NGO finds nearby tasks
- [ ] NGO claims task
- [ ] Admin views all tasks
- [ ] Admin triggers auto-assignment
- [ ] Error handling works (invalid QR, unauthorized access)

---

## Postman Collection (Alternative)

Import into Postman:

```json
{
  "info": {
    "name": "Food Rescue Platform",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Auth",
      "item": [
        {
          "name": "Register",
          "request": {
            "method": "POST",
            "url": "http://localhost:8000/api/v1/auth/register",
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"test@test.com\",\n  \"full_name\": \"Test User\",\n  \"role\": \"DONOR\",\n  \"password\": \"test123\"\n}"
            }
          }
        },
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "url": "http://localhost:8000/api/v1/auth/login",
            "body": {
              "mode": "formdata",
              "formdata": [
                {"key": "username", "value": "test@test.com"},
                {"key": "password", "value": "test123"}
              ]
            }
          }
        }
      ]
    }
  ]
}
```

---

## Tips

1. **Use Swagger UI** - Easiest way to test
2. **Use "Try it out"** - Execute requests directly
3. **Copy tokens** - Store JWT tokens in notepad
4. **Check responses** - Verify all fields match schema
5. **Test errors** - Don't just test happy path
6. **Use realistic data** - Kerala coordinates for location
7. **Test workflows** - Complete end-to-end flows
8. **Check database** - Verify data is saved correctly

```powershell
# Check database
psql -U postgres -d foodrescue_unified_db
SELECT * FROM users;
SELECT * FROM tasks;
\q
```

---

**Happy Testing! 🚀**
