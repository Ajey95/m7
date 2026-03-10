# Data Migration Guide

Guide to migrate data from 4 separate systems into unified database.

## Overview

**Old Systems:**
1. M7_Logistics_System - PostgreSQL
2. food-rescue-platform-main - PostgreSQL
3. food-rescue-platform-ngo-portal - PostgreSQL
4. food-rescue-platform-donation - PostgreSQL

**New System:**
- Unified PostgreSQL database with UUIDs and PostGIS

## Pre-Migration Checklist

- [ ] Backup all 4 databases
- [ ] Create unified database and run schema
- [ ] Stop all old systems
- [ ] Export data from all systems
- [ ] Transform data to match new schema
- [ ] Import data into unified database
- [ ] Verify data integrity
- [ ] Update frontends to use new API

## Step 1: Backup Old Databases

```powershell
# Backup M7 database
pg_dump -U postgres m7_database > m7_backup.sql

# Backup main platform
pg_dump -U postgres food_rescue_db > main_backup.sql

# Backup NGO portal
pg_dump -U postgres ngo_portal_db > ngo_backup.sql

# Backup donation platform
pg_dump -U postgres donation_db > donation_backup.sql
```

## Step 2: Export Data

### Export Users

**M7 System:**
```sql
psql -U postgres -d m7_database
\copy (SELECT * FROM volunteers) TO 'volunteers_m7.csv' CSV HEADER;
\q
```

**NGO Portal:**
```sql
psql -U postgres -d ngo_portal_db
\copy (SELECT * FROM ngos) TO 'ngos_export.csv' CSV HEADER;
\q
```

**Donation Platform:**
```sql
psql -U postgres -d donation_db
\copy (SELECT * FROM donors) TO 'donors_export.csv' CSV HEADER;
\copy (SELECT * FROM donations) TO 'donations_export.csv' CSV HEADER;
\q
```

## Step 3: Data Transformation

Create Python script `migrate_data.py`:

```python
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import uuid
from datetime import datetime

# Connection to new unified database
conn = psycopg2.connect(
    "postgresql://postgres:yourpassword@localhost:5432/foodrescue_unified_db"
)
cur = conn.cursor()

# ID mapping dictionaries
user_id_map = {}  # old_id -> new_uuid
donor_id_map = {}
ngo_id_map = {}
volunteer_id_map = {}

### 1. Migrate Volunteers from M7 ###
print("Migrating volunteers from M7...")
volunteers_df = pd.read_csv('volunteers_m7.csv')

for _, row in volunteers_df.iterrows():
    # Create user account
    user_uuid = uuid.uuid4()
    
    cur.execute("""
        INSERT INTO users (clerk_user_id, email, phone_number, full_name, role, is_active)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        f"migrated_{user_uuid}",  # Temporary clerk_user_id
        row.get('email', f"volunteer{row['id']}@migrated.com"),
        row.get('phone_number', ''),
        row.get('name', 'Migrated Volunteer'),
        'VOLUNTEER',
        True
    ))
    
    user_id = cur.fetchone()[0]
    user_id_map[f"volunteer_{row['id']}"] = user_id
    
    # Create volunteer profile
    cur.execute("""
        INSERT INTO volunteers (user_id, vehicle_type, license_plate, 
                                current_status, total_tasks_completed, average_rating)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        user_id,
        row.get('vehicle_type', 'CAR').upper(),
        row.get('license_plate', ''),
        'OFFLINE',
        row.get('completed_tasks', 0),
        row.get('rating', 0.0)
    ))
    
    volunteer_id = cur.fetchone()[0]
    volunteer_id_map[row['id']] = volunteer_id

conn.commit()
print(f"✅ Migrated {len(volunteers_df)} volunteers")

### 2. Migrate Donors from Donation Platform ###
print("Migrating donors...")
donors_df = pd.read_csv('donors_export.csv')

for _, row in donors_df.iterrows():
    # Create user account
    user_uuid = uuid.uuid4()
    
    cur.execute("""
        INSERT INTO users (clerk_user_id, email, phone_number, full_name, role, is_active)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        f"migrated_{user_uuid}",
        row.get('email', f"donor{row['id']}@migrated.com"),
        row.get('phone', ''),
        row.get('name', 'Migrated Donor'),
        'DONOR',
        True
    ))
    
    user_id = cur.fetchone()[0]
    user_id_map[f"donor_{row['id']}"] = user_id
    
    # Create donor profile with PostGIS
    lat = row.get('latitude', 8.5241)
    lng = row.get('longitude', 76.9366)
    
    cur.execute("""
        INSERT INTO donors (user_id, address, location, total_donations, average_rating)
        VALUES (%s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s)
        RETURNING id
    """, (
        user_id,
        row.get('address', ''),
        lng, lat,  # Note: PostGIS uses (lng, lat) order
        row.get('total_donations', 0),
        row.get('rating', 0.0)
    ))
    
    donor_id = cur.fetchone()[0]
    donor_id_map[row['id']] = donor_id

conn.commit()
print(f"✅ Migrated {len(donors_df)} donors")

### 3. Migrate NGOs from NGO Portal ###
print("Migrating NGOs...")
ngos_df = pd.read_csv('ngos_export.csv')

for _, row in ngos_df.iterrows():
    # Create user account
    user_uuid = uuid.uuid4()
    
    cur.execute("""
        INSERT INTO users (clerk_user_id, email, phone_number, full_name, role, is_active)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        f"migrated_{user_uuid}",
        row.get('email', f"ngo{row['id']}@migrated.com"),
        row.get('phone', ''),
        row.get('organization_name', 'Migrated NGO'),
        'NGO',
        True
    ))
    
    user_id = cur.fetchone()[0]
    user_id_map[f"ngo_{row['id']}"] = user_id
    
    # Create NGO profile
    lat = row.get('latitude', 8.5241)
    lng = row.get('longitude', 76.9366)
    
    cur.execute("""
        INSERT INTO ngos (user_id, organization_name, registration_number,
                          headquarters_address, headquarters_location, 
                          verification_status, preferred_food_types,
                          max_capacity_per_day, license_document_url)
        VALUES (%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s)
        RETURNING id
    """, (
        user_id,
        row.get('organization_name', 'Migrated NGO'),
        row.get('registration_number', f"REG-{row['id']}"),
        row.get('address', ''),
        lng, lat,
        row.get('verification_status', 'PENDING').upper(),
        row.get('preferred_food_types', '{}').split(',') if row.get('preferred_food_types') else ['COOKED_FOOD'],
        row.get('capacity', 50),
        row.get('license_url', '')
    ))
    
    ngo_id = cur.fetchone()[0]
    ngo_id_map[row['id']] = ngo_id

conn.commit()
print(f"✅ Migrated {len(ngos_df)} NGOs")

### 4. Migrate Tasks/Donations ###
print("Migrating tasks...")
donations_df = pd.read_csv('donations_export.csv')

for _, row in donations_df.iterrows():
    # Map old IDs to new UUIDs
    donor_id = donor_id_map.get(row.get('donor_id'))
    volunteer_id = volunteer_id_map.get(row.get('volunteer_id')) if row.get('volunteer_id') else None
    ngo_id = ngo_id_map.get(row.get('ngo_id')) if row.get('ngo_id') else None
    
    if not donor_id:
        print(f"⚠️ Skipping task {row['id']} - donor not found")
        continue
    
    # Generate QR tokens
    import random
    import string
    pickup_token = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    delivery_token = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    # Get coordinates
    pickup_lat = row.get('pickup_latitude', 8.5241)
    pickup_lng = row.get('pickup_longitude', 76.9366)
    dropoff_lat = row.get('dropoff_latitude', 8.4900)
    dropoff_lng = row.get('dropoff_longitude', 76.9520)
    
    cur.execute("""
        INSERT INTO tasks (
            donor_id, ngo_id, volunteer_id, food_type, quantity, perishable,
            pickup_address, pickup_location, dropoff_address, dropoff_location,
            special_instructions, status, pickup_qr_token, delivery_qr_token,
            created_at, assigned_at, accepted_at, picked_up_at, delivered_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s,
            %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326),
            %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326),
            %s, %s, %s, %s,
            %s, %s, %s, %s, %s
        )
    """, (
        donor_id, ngo_id, volunteer_id,
        row.get('food_type', 'COOKED_FOOD').upper(),
        row.get('quantity', '10 meals'),
        row.get('perishable', True),
        row.get('pickup_address', ''),
        pickup_lng, pickup_lat,
        row.get('dropoff_address', ''),
        dropoff_lng, dropoff_lat,
        row.get('special_instructions', ''),
        row.get('status', 'COMPLETED').upper(),
        pickup_token,
        delivery_token,
        row.get('created_at', datetime.now()),
        row.get('assigned_at'),
        row.get('accepted_at'),
        row.get('picked_up_at'),
        row.get('delivered_at')
    ))

conn.commit()
print(f"✅ Migrated {len(donations_df)} tasks")

### 5. Generate Summary ###
print("\n📊 Migration Summary:")
print(f"Users: {len(user_id_map)}")
print(f"Donors: {len(donor_id_map)}")
print(f"NGOs: {len(ngo_id_map)}")
print(f"Volunteers: {len(volunteer_id_map)}")
print(f"Tasks: {len(donations_df)}")

# Close connection
cur.close()
conn.close()

print("\n✅ Migration complete!")
```

## Step 4: Run Migration

```powershell
# Install dependencies
pip install pandas psycopg2-binary

# Run migration script
python migrate_data.py
```

## Step 5: Verify Data

```sql
psql -U postgres -d foodrescue_unified_db

-- Check counts
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM donors;
SELECT COUNT(*) FROM ngos;
SELECT COUNT(*) FROM volunteers;
SELECT COUNT(*) FROM tasks;

-- Check sample data
SELECT * FROM users LIMIT 5;
SELECT * FROM donors LIMIT 5;
SELECT * FROM volunteers LIMIT 5;
SELECT * FROM tasks LIMIT 5;

-- Verify PostGIS data
SELECT id, pickup_address, ST_AsText(pickup_location) 
FROM tasks LIMIT 5;

-- Check relationships
SELECT 
    u.full_name, 
    u.role, 
    d.address,
    d.total_donations
FROM users u
JOIN donors d ON u.id = d.user_id
LIMIT 5;

\q
```

## Step 6: Data Validation

Create validation script `validate_migration.py`:

```python
import psycopg2

conn = psycopg2.connect(
    "postgresql://postgres:yourpassword@localhost:5432/foodrescue_unified_db"
)
cur = conn.cursor()

print("Running validation checks...\n")

# Check 1: All users have valid roles
cur.execute("SELECT COUNT(*) FROM users WHERE role NOT IN ('DONOR', 'NGO', 'VOLUNTEER', 'ADMIN', 'DISPATCHER')")
invalid_roles = cur.fetchone()[0]
print(f"✓ Invalid user roles: {invalid_roles} (should be 0)")

# Check 2: All donors have locations
cur.execute("SELECT COUNT(*) FROM donors WHERE location IS NULL")
missing_locations = cur.fetchone()[0]
print(f"✓ Donors with missing locations: {missing_locations} (should be 0)")

# Check 3: All tasks have valid statuses
cur.execute("SELECT COUNT(*) FROM tasks WHERE status NOT IN ('PENDING', 'ASSIGNED', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED')")
invalid_statuses = cur.fetchone()[0]
print(f"✓ Invalid task statuses: {invalid_statuses} (should be 0)")

# Check 4: All tasks have QR tokens
cur.execute("SELECT COUNT(*) FROM tasks WHERE pickup_qr_token IS NULL OR delivery_qr_token IS NULL")
missing_qr = cur.fetchone()[0]
print(f"✓ Tasks with missing QR tokens: {missing_qr} (should be 0)")

# Check 5: All volunteers have vehicle types
cur.execute("SELECT COUNT(*) FROM volunteers WHERE vehicle_type NOT IN ('BIKE', 'CAR', 'VAN', 'TRUCK')")
invalid_vehicles = cur.fetchone()[0]
print(f"✓ Invalid vehicle types: {invalid_vehicles} (should be 0)")

# Check 6: Orphaned records
cur.execute("SELECT COUNT(*) FROM donors WHERE user_id NOT IN (SELECT id FROM users)")
orphaned_donors = cur.fetchone()[0]
print(f"✓ Orphaned donors: {orphaned_donors} (should be 0)")

cur.execute("SELECT COUNT(*) FROM volunteers WHERE user_id NOT IN (SELECT id FROM users)")
orphaned_volunteers = cur.fetchone()[0]
print(f"✓ Orphaned volunteers: {orphaned_volunteers} (should be 0)")

cur.execute("SELECT COUNT(*) FROM ngos WHERE user_id NOT IN (SELECT id FROM users)")
orphaned_ngos = cur.fetchone()[0]
print(f"✓ Orphaned NGOs: {orphaned_ngos} (should be 0)")

# Summary
total_issues = (invalid_roles + missing_locations + invalid_statuses + 
                missing_qr + invalid_vehicles + orphaned_donors + 
                orphaned_volunteers + orphaned_ngos)

if total_issues == 0:
    print("\n✅ All validation checks passed!")
else:
    print(f"\n⚠️ {total_issues} validation issues found. Please review.")

cur.close()
conn.close()
```

Run validation:
```powershell
python validate_migration.py
```

## Step 7: Update Frontend Configurations

### M7 Volunteer App (Flutter)

Update `lib/config.dart`:
```dart
class Config {
  static const String API_BASE_URL = 'http://localhost:8000/api/v1';
  // Or production: 'https://your-domain.com/api/v1'
}
```

Update authentication:
```dart
Future<String?> login(String email, String password) async {
  final response = await http.post(
    Uri.parse('${Config.API_BASE_URL}/auth/login'),
    body: {
      'username': email,
      'password': password,
    },
  );
  
  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['access_token'];
  }
  return null;
}
```

### NGO Portal (Flutter)

Similar updates to API endpoints and authentication.

### Donor App (Flutter)

Similar updates.

### React Dashboard

Update API config:
```javascript
// src/config.js
export const API_BASE_URL = 'http://localhost:8000/api/v1';

// src/api/auth.js
export const login = async (email, password) => {
  const formData = new FormData();
  formData.append('username', email);
  formData.append('password', password);
  
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    body: formData,
  });
  
  const data = await response.json();
  localStorage.setItem('token', data.access_token);
  return data.access_token;
};
```

## Step 8: Sunset Old Systems

1. **Stop old backend services**
2. **Archive old databases**
3. **Update documentation**
4. **Notify team members**
5. **Monitor new system for 1 week**
6. **Remove old infrastructure**

## Rollback Plan

If migration fails:

1. **Stop unified backend**
2. **Restore old databases from backups:**
```powershell
psql -U postgres -c "DROP DATABASE m7_database;"
psql -U postgres -c "CREATE DATABASE m7_database;"
psql -U postgres m7_database < m7_backup.sql
```
3. **Restart old systems**
4. **Investigate migration errors**
5. **Fix issues and retry**

## Common Issues

### Issue: Duplicate Emails

**Error:** `duplicate key value violates unique constraint "users_email_key"`

**Solution:**
```python
# Add suffix to duplicate emails
if cur.execute("SELECT COUNT(*) FROM users WHERE email = %s", (email,)).fetchone()[0] > 0:
    email = f"{email}.migrated{timestamp}"
```

### Issue: Invalid Coordinates

**Error:** `Invalid coordinates for lat/lng`

**Solution:**
```python
# Validate coordinates before insertion
def validate_coords(lat, lng):
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return 8.5241, 76.9366  # Default to Kerala
    return lat, lng
```

### Issue: Missing Firebase UIDs

**Solution:**
```python
# Generate temporary clerk_user_id
clerk_user_id = f"migrated_{uuid.uuid4()}"
```

Later, when users first login with Clerk:
```python
# Update clerk_user_id on first Clerk login
def update_clerk_user_id(email, clerk_user_id):
    cur.execute("""
        UPDATE users 
        SET clerk_user_id = %s 
        WHERE email = %s
    """, (clerk_user_id, email))
```

## Post-Migration Tasks

- [ ] Send password reset emails to all migrated users
- [ ] Update mobile apps to new API
- [ ] Update React dashboard
- [ ] Train team on new unified system
- [ ] Monitor error logs for 1 week
- [ ] Collect user feedback
- [ ] Document any issues found
- [ ] Optimize slow queries if any

## Success Criteria

✅ All users migrated successfully
✅ All spatial data preserved
✅ All relationships maintained
✅ No data loss
✅ Frontend apps work with new backend
✅ Performance is acceptable
✅ No critical bugs in first week

---

**Migration Checklist Complete!** 🎉
