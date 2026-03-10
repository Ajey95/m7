# Quick Start - Supabase Database Setup

Your Supabase database is already configured! ✅

## Step 1: Enable PostGIS Extension (if not already enabled)

Supabase usually has PostGIS pre-installed. Let's verify:

```powershell
# Connect to Supabase database
$env:PGPASSWORD="surplusSync@12345"
psql -h db.bwrwszeftkiwbybolzrh.supabase.co -U postgres -d postgres -p 5432 -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql -h db.bwrwszeftkiwbybolzrh.supabase.co -U postgres -d postgres -p 5432 -c "CREATE EXTENSION IF NOT EXISTS uuid-ossp;"
```

**Or use Supabase Dashboard:**
1. Go to https://app.supabase.com
2. Select your project
3. Go to **Database** → **Extensions**
4. Enable `postgis` and `uuid-ossp`

## Step 2: Run Database Schema

```powershell
# From your terminal
cd C:\Users\sister\Documents\SE-VOLUNTEER\final

# Set password as environment variable
$env:PGPASSWORD="surplusSync@12345"

# Run schema
psql -h db.bwrwszeftkiwbybolzrh.supabase.co -U postgres -d postgres -p 5432 -f database/schema.sql
```

**Expected output:**
```
CREATE EXTENSION
CREATE TYPE
CREATE TYPE
...
CREATE TABLE
CREATE INDEX
...
INSERT 0 1
```

## Step 3: Verify Tables Created

```powershell
$env:PGPASSWORD="surplusSync@12345"
psql -h db.bwrwszeftkiwbybolzrh.supabase.co -U postgres -d postgres -p 5432 -c "\dt"
```

**Expected tables:**
- users
- donors
- ngos
- ngo_branches
- volunteers
- tasks
- tracking_sessions
- task_exceptions
- performance_stats
- admin_actions

## Step 4: Install Python Dependencies

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Step 5: Run Backend

```powershell
# Make sure you're in backend directory with venv activated
python main.py
```

**Expected output:**
```
✅ Database tables created/verified
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## Step 6: Test API

Open browser: http://localhost:8000/docs

### Quick Test:

1. **Register Admin:**
```json
POST /api/v1/auth/register
{
  "email": "admin@test.com",
  "phone_number": "+1234567890",
  "full_name": "Admin User",
  "role": "ADMIN",
  "password": "admin123"
}
```

2. **Login:**
```
POST /api/v1/auth/login
username: admin@test.com
password: admin123
```

3. **Get token and click "Authorize"** at top of Swagger UI

4. **Test health:**
```
GET /health
```

## Troubleshooting

### Connection Error

**Error:** `could not connect to server`

**Fix:**
1. Check Supabase project is running
2. Verify DATABASE_URL in `.env` is correct
3. Check if your IP is allowed in Supabase (Supabase → Settings → Database → Connection pooling)

### PostGIS Not Found

**Error:** `type "geometry" does not exist`

**Fix:**
1. Enable PostGIS extension in Supabase Dashboard
2. Or run: `CREATE EXTENSION postgis;`

### Schema Already Exists

**Error:** `relation "users" already exists`

**Solution:** Schema was already run. Skip to Step 4.

To start fresh (⚠️ **deletes all data**):
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

Then run schema.sql again.

## Alternative: Manual Setup via Supabase SQL Editor

If psql doesn't work, use Supabase Dashboard:

1. Go to https://app.supabase.com
2. Select your project
3. Go to **SQL Editor**
4. Create new query
5. Copy contents of `database/schema.sql`
6. Paste and click **Run**

## Next Steps

✅ Database configured with Supabase
✅ Backend ready to run

**Continue with:**
- [API_TESTING.md](../docs/API_TESTING.md) - Test all endpoints
- [README.md](../README.md) - Update Flutter/React apps

## Supabase Advantages

✅ **Managed PostgreSQL** - No local installation needed
✅ **PostGIS included** - Spatial queries work out of the box
✅ **Auto-backups** - Daily backups enabled
✅ **Real-time subscriptions** - Can add WebSocket support later
✅ **Built-in auth** - Can integrate Supabase Auth if needed
✅ **Cloud accessible** - Share with team easily
✅ **pgAdmin support** - Use pgAdmin to view data visually

## Google Maps Integration

Your Google Maps API key is already configured in `.env`:
```env
GOOGLE_MAPS_API_KEY=AIzaSyBvT4BUEaOVwpc8Is_YSLJ6bPumD3X2Ohw
```

This is the same key used in your M7 Logistics System for:
- Donor dashboard map view
- Volunteer navigation
- Real-time location tracking

## Connect pgAdmin (Optional)

**Host:** db.bwrwszeftkiwbybolzrh.supabase.co
**Port:** 5432
**Database:** postgres
**Username:** postgres
**Password:** surplusSync@12345

---

**Status:** ✅ Ready to deploy!
