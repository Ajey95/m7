# Backend Setup Guide

## Prerequisites

1. **PostgreSQL 15+** with PostGIS extension
2. **Python 3.10+**
3. **Redis** (optional, for caching)

## Step 1: Database Setup

### Install PostgreSQL with PostGIS

**Windows:**
```powershell
# Download and install PostgreSQL from https://www.postgresql.org/download/windows/
# During installation, make sure to install "PostGIS" from Stack Builder
```

**Linux:**
```bash
sudo apt update
sudo apt install postgresql-15 postgresql-15-postgis-3
```

**macOS:**
```bash
brew install postgresql@15 postgis
```

### Create Database

```powershell
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE foodrescue_unified_db;

# Exit psql
\q
```

### Run Schema

```powershell
# From the backend directory
cd C:\Users\sister\Documents\SE-VOLUNTEER\final\backend
psql -U postgres -d foodrescue_unified_db -f ../database/schema.sql
```

Verify tables created:
```powershell
psql -U postgres -d foodrescue_unified_db
\dt
# Should show: users, donors, ngos, ngo_branches, volunteers, tasks, tracking_sessions, task_exceptions, performance_stats, admin_actions
\q
```

## Step 2: Python Environment

### Create Virtual Environment

```powershell
# From the backend directory
cd C:\Users\sister\Documents\SE-VOLUNTEER\final\backend
python -m venv venv
```

### Activate Virtual Environment

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows (CMD):**
```cmd
venv\Scripts\activate.bat
```

**Linux/macOS:**
```bash
source venv/bin/activate
```

### Install Dependencies

```powershell
pip install -r requirements.txt
```

## Step 3: Configuration

### Update .env File

Edit `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/foodrescue_unified_db

# JWT
SECRET_KEY=your-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS (add your frontend URLs)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://10.252.76.145:3000

# Redis (optional)
REDIS_URL=redis://localhost:6379/0

# Assignment Configuration
MAX_ASSIGNMENT_DISTANCE_KM=10
QR_TOKEN_LENGTH=6
```

**Generate Secret Key:**
```powershell
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

## Step 4: Run Backend

```powershell
# Make sure virtual environment is activated
python main.py
```

You should see:
```
✅ Database tables created/verified
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## Step 5: Test API

### Open Swagger UI

Navigate to: http://localhost:8000/docs

### Test Health Endpoint

```powershell
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected"
}
```

## Step 6: Create Test User

### Using Swagger UI

1. Go to http://localhost:8000/docs
2. Find **POST /api/v1/auth/register**
3. Click "Try it out"
4. Enter:
```json
{
  "email": "admin@test.com",
  "phone_number": "+1234567890",
  "full_name": "Admin User",
  "role": "ADMIN",
  "password": "test123"
}
```
5. Click "Execute"

### Using cURL

```powershell
curl -X POST "http://localhost:8000/api/v1/auth/register" `
  -H "Content-Type: application/json" `
  -d '{
    "email": "admin@test.com",
    "phone_number": "+1234567890",
    "full_name": "Admin User",
    "role": "ADMIN",
    "password": "test123"
  }'
```

## Step 7: Test Complete Workflow

### 1. Register Users

**Create Donor:**
```json
{
  "email": "donor@test.com",
  "phone_number": "+1111111111",
  "full_name": "Test Donor",
  "role": "DONOR",
  "password": "test123"
}
```

**Create NGO:**
```json
{
  "email": "ngo@test.com",
  "phone_number": "+2222222222",
  "full_name": "Test NGO",
  "role": "NGO",
  "password": "test123"
}
```

**Create Volunteer:**
```json
{
  "email": "volunteer@test.com",
  "phone_number": "+3333333333",
  "full_name": "Test Volunteer",
  "role": "VOLUNTEER",
  "password": "test123"
}
```

### 2. Login as Donor

Use **POST /api/v1/auth/login** (OAuth2 form):
- username: `donor@test.com`
- password: `test123`

Copy the `access_token` from response.

### 3. Create Donor Profile

Click "Authorize" button in Swagger UI, paste token.

Use **POST /api/v1/donors/** with Kerala coordinates:
```json
{
  "address": "Technopark, Trivandrum, Kerala",
  "latitude": 8.5241,
  "longitude": 76.9366,
  "preferred_donation_types": ["COOKED_FOOD"]
}
```

### 4. Login as Volunteer

Logout (clear authorization), login as `volunteer@test.com`.

### 5. Create Volunteer Profile

Use **POST /api/v1/volunteers/**:
```json
{
  "vehicle_type": "CAR",
  "license_plate": "KL-01-AB-1234",
  "availability_schedule": {
    "monday": "09:00-18:00",
    "tuesday": "09:00-18:00"
  }
}
```

### 6. Go Online

Use **POST /api/v1/volunteers/go-online** with nearby coordinates:
```json
{
  "latitude": 8.5250,
  "longitude": 76.9370
}
```

### 7. Login as Donor and Create Task

Login as donor again, use **POST /api/v1/donors/tasks**:
```json
{
  "food_type": "COOKED_FOOD",
  "quantity": "20 meals",
  "perishable": true,
  "pickup_address": "Technopark Phase 1",
  "pickup_latitude": 8.5241,
  "pickup_longitude": 76.9366,
  "dropoff_address": "Trivandrum Central",
  "dropoff_latitude": 8.4900,
  "dropoff_longitude": 76.9520,
  "special_instructions": "Handle with care"
}
```

**✅ Task should auto-assign to volunteer!**

### 8. Check Assignment

Login as volunteer, use **GET /api/v1/volunteers/current-task**.
You should see the task with `pickup_qr_token` and `delivery_qr_token`.

### 9. Complete Workflow

As volunteer:
1. **POST /api/v1/tasks/{task_id}/accept** - Accept task
2. **POST /api/v1/tasks/{task_id}/pickup-verify** - Scan pickup QR
3. **PATCH /api/v1/volunteers/location** - Update location during transit
4. **POST /api/v1/tasks/{task_id}/delivery-verify** - Scan delivery QR

Task complete! 🎉

## Troubleshooting

### Database Connection Error

**Error:** `could not connect to server`

**Fix:**
1. Check PostgreSQL is running: `pg_isready`
2. Verify DATABASE_URL in .env
3. Test connection: `psql -U postgres -d foodrescue_unified_db`

### Import Errors

**Error:** `ModuleNotFoundError: No module named 'fastapi'`

**Fix:**
1. Activate virtual environment
2. Reinstall dependencies: `pip install -r requirements.txt`

### PostGIS Error

**Error:** `type "geometry" does not exist`

**Fix:**
1. Install PostGIS extension:
```sql
psql -U postgres -d foodrescue_unified_db
CREATE EXTENSION IF NOT EXISTS postgis;
\q
```

### Port Already in Use

**Error:** `Address already in use: port 8000`

**Fix:**
```powershell
# Find process using port 8000
netstat -ano | findstr :8000

# Kill process
taskkill /PID <PID> /F
```

## Next Steps

1. **Update Flutter Apps:**
   - Change API base URL to `http://localhost:8000/api/v1`
   - Implement authentication with JWT tokens

2. **Update React Dashboard:**
   - Add login page
   - Store JWT token in localStorage
   - Add authorization header to API calls

3. **Deploy to Production:**
   - Set up production PostgreSQL database
   - Configure production SECRET_KEY
   - Set up nginx reverse proxy
   - Enable HTTPS

## Useful Commands

```powershell
# Run backend
python main.py

# Run with auto-reload
uvicorn main:app --reload

# Run on different port
uvicorn main:app --port 8001

# Check database
psql -U postgres -d foodrescue_unified_db

# View logs
# Check terminal where backend is running

# Stop backend
# Press Ctrl+C in terminal
```

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Support

If you encounter issues:
1. Check PostgreSQL is running
2. Verify database schema is created
3. Check .env configuration
4. Ensure virtual environment is activated
5. Check backend logs for errors
