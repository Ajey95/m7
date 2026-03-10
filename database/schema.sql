-- ============================================================================
-- FOOD RESCUE PLATFORM - UNIFIED DATABASE SCHEMA
-- PostgreSQL 15 + PostGIS + Clerk Authentication
-- Version: 2.0.0 (Integrated)
-- ============================================================================

-- CREATE DATABASE foodrescue_unified_db;
\c foodrescue_unified_db

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

-- User roles
CREATE TYPE user_role AS ENUM ('DONOR', 'NGO', 'VOLUNTEER', 'ADMIN');

-- Food categories
CREATE TYPE food_type AS ENUM ('VEG', 'NON_VEG', 'VEGAN', 'MIXED');

-- Task/Donation status
CREATE TYPE task_status AS ENUM (
    'PENDING',      -- Created, waiting for assignment
    'ASSIGNED',     -- Assigned to volunteer
    'PICKED_UP',    -- Volunteer picked up from donor
    'IN_TRANSIT',   -- On the way to NGO
    'DELIVERED',    -- Delivered to NGO
    'COMPLETED',    -- NGO confirmed receipt
    'CANCELLED'     -- Task cancelled
);

-- Volunteer status
CREATE TYPE volunteer_status AS ENUM ('ONLINE', 'BUSY', 'OFFLINE');

-- Vehicle types
CREATE TYPE vehicle_type AS ENUM ('BIKE', 'SCOOTER', 'CAR', 'VAN');

-- NGO verification status
CREATE TYPE verification_status AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- 1. USERS (Clerk Authentication Base)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(15) UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_clerk_id ON users(clerk_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- 2. DONORS
CREATE TABLE donors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_name VARCHAR(150),
    address TEXT NOT NULL,
    location GEOMETRY(POINT, 4326) NOT NULL,
    qr_token VARCHAR(100) UNIQUE NOT NULL,
    rating NUMERIC(3, 2) DEFAULT 5.0,
    total_donations INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_donors_user_id ON donors(user_id);
CREATE INDEX idx_donors_location ON donors USING GIST(location);
CREATE INDEX idx_donors_qr_token ON donors(qr_token);

-- 3. NGOS
CREATE TABLE ngos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_name VARCHAR(150) NOT NULL,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    license_expiry DATE,
    license_document_url VARCHAR(500),
    rejection_reason TEXT,
    verification_status verification_status DEFAULT 'PENDING',
    address TEXT NOT NULL,
    location GEOMETRY(POINT, 4326) NOT NULL,
    capacity_kg INT DEFAULT 100,
    current_stock_kg INT DEFAULT 0,
    preferred_food_types food_type[] DEFAULT '{}',
    qr_token VARCHAR(100) UNIQUE NOT NULL,
    rating NUMERIC(3, 2) DEFAULT 5.0,
    total_claims INT DEFAULT 0,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ngos_user_id ON ngos(user_id);
CREATE INDEX idx_ngos_location ON ngos USING GIST(location);
CREATE INDEX idx_ngos_qr_token ON ngos(qr_token);
CREATE INDEX idx_ngos_verification_status ON ngos(verification_status);

-- 4. NGO BRANCHES
CREATE TABLE ngo_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ngo_id UUID REFERENCES ngos(id) ON DELETE CASCADE,
    branch_name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    location GEOMETRY(POINT, 4326) NOT NULL,
    capacity_kg INT DEFAULT 50,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ngo_branches_ngo_id ON ngo_branches(ngo_id);
CREATE INDEX idx_ngo_branches_location ON ngo_branches USING GIST(location);

-- 5. VOLUNTEERS
CREATE TABLE volunteers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type vehicle_type NOT NULL,
    vehicle_plate VARCHAR(20),
    capacity_kg INT DEFAULT 15,
    status volunteer_status DEFAULT 'OFFLINE',
    current_location GEOMETRY(POINT, 4326),
    current_task_id UUID,
    last_heartbeat TIMESTAMP,
    id_proof_url VARCHAR(500),
    id_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,
    availability_schedule JSONB,
    rating NUMERIC(3, 2) DEFAULT 5.0,
    total_deliveries INT DEFAULT 0,
    on_time_percentage NUMERIC(5, 2) DEFAULT 100.0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_volunteers_user_id ON volunteers(user_id);
CREATE INDEX idx_volunteers_status ON volunteers(status);
CREATE INDEX idx_volunteers_location ON volunteers USING GIST(current_location);
CREATE INDEX idx_volunteers_current_task ON volunteers(current_task_id);

-- 6. TASKS
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donor_id UUID REFERENCES donors(id) NOT NULL,
    ngo_id UUID REFERENCES ngos(id),
    volunteer_id UUID REFERENCES volunteers(id),
    pickup_location GEOMETRY(POINT, 4326) NOT NULL,
    drop_location GEOMETRY(POINT, 4326),
    distance_km NUMERIC(5, 2),
    food_type food_type NOT NULL,
    quantity_kg NUMERIC(10, 2) NOT NULL,
    description TEXT,
    requires_cooling BOOLEAN DEFAULT false,
    expiry_time TIMESTAMP NOT NULL,
    status task_status DEFAULT 'PENDING',
    pickup_token VARCHAR(100) UNIQUE NOT NULL,
    delivery_token VARCHAR(100) UNIQUE NOT NULL,
    pickup_verified_at TIMESTAMP,
    delivery_verified_at TIMESTAMP,
    pickup_proof_url VARCHAR(500),
    drop_proof_url VARCHAR(500),
    assigned_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_donor_id ON tasks(donor_id);
CREATE INDEX idx_tasks_ngo_id ON tasks(ngo_id);
CREATE INDEX idx_tasks_volunteer_id ON tasks(volunteer_id);
CREATE INDEX idx_tasks_expiry_time ON tasks(expiry_time);
CREATE INDEX idx_tasks_pickup_location ON tasks USING GIST(pickup_location);
CREATE INDEX idx_tasks_drop_location ON tasks USING GIST(drop_location);
CREATE INDEX idx_tasks_pickup_token ON tasks(pickup_token);
CREATE INDEX idx_tasks_delivery_token ON tasks(delivery_token);

-- 7. TRACKING SESSIONS
CREATE TABLE tracking_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    volunteer_id UUID REFERENCES volunteers(id),
    route_polyline TEXT,
    start_time TIMESTAMP DEFAULT NOW(),
    last_update TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP,
    current_speed_kmh NUMERIC(5, 2),
    distance_traveled_km NUMERIC(5, 2),
    estimated_arrival TIMESTAMP
);

CREATE INDEX idx_tracking_task_id ON tracking_sessions(task_id);
CREATE INDEX idx_tracking_volunteer_id ON tracking_sessions(volunteer_id);

-- 8. TASK EXCEPTIONS
CREATE TABLE task_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id),
    volunteer_id UUID REFERENCES volunteers(id),
    issue_type VARCHAR(50) NOT NULL,
    description TEXT,
    location GEOMETRY(POINT, 4326),
    photo_url VARCHAR(500),
    resolved BOOLEAN DEFAULT false,
    resolution_notes TEXT,
    reported_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);

CREATE INDEX idx_exceptions_task_id ON task_exceptions(task_id);
CREATE INDEX idx_exceptions_volunteer_id ON task_exceptions(volunteer_id);
CREATE INDEX idx_exceptions_resolved ON task_exceptions(resolved);

-- 9. PERFORMANCE STATS
CREATE TABLE performance_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID REFERENCES volunteers(id),
    task_id UUID REFERENCES tasks(id),
    on_time BOOLEAN,
    completion_time_minutes INT,
    distance_traveled_km NUMERIC(5, 2),
    rating INT CHECK (rating >= 1 AND rating <= 5),
    feedback TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_performance_volunteer_id ON performance_stats(volunteer_id);
CREATE INDEX idx_performance_task_id ON performance_stats(task_id);

-- 10. ADMIN ACTIONS
CREATE TABLE admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID REFERENCES users(id),
    target_user_id UUID REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_admin_actions_admin ON admin_actions(admin_user_id);
CREATE INDEX idx_admin_actions_target ON admin_actions(target_user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Find nearby available tasks for NGOs
CREATE OR REPLACE FUNCTION find_nearby_tasks(
    ngo_lat NUMERIC,
    ngo_lng NUMERIC,
    max_distance_km NUMERIC DEFAULT 10
)
RETURNS TABLE (
    task_id UUID,
    distance_km NUMERIC,
    food_type food_type,
    quantity_kg NUMERIC,
    expires_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        ST_Distance(
            t.pickup_location::geography,
            ST_SetSRID(ST_MakePoint(ngo_lng, ngo_lat), 4326)::geography
        ) / 1000 AS distance,
        t.food_type,
        t.quantity_kg,
        t.expiry_time
    FROM tasks t
    WHERE t.status = 'PENDING'
        AND t.ngo_id IS NULL
        AND ST_DWithin(
            t.pickup_location::geography,
            ST_SetSRID(ST_MakePoint(ngo_lng, ngo_lat), 4326)::geography,
            max_distance_km * 1000
        )
    ORDER BY t.expiry_time ASC, distance ASC;
END;
$$ LANGUAGE plpgsql;

-- Find nearby online volunteers for auto-assignment
CREATE OR REPLACE FUNCTION find_nearby_volunteers(
    pickup_lat NUMERIC,
    pickup_lng NUMERIC,
    max_distance_km NUMERIC DEFAULT 10
)
RETURNS TABLE (
    volunteer_id UUID,
    distance_km NUMERIC,
    vehicle_type vehicle_type,
    rating NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        ST_Distance(
            v.current_location::geography,
            ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography
        ) / 1000 AS distance,
        v.vehicle_type,
        v.rating
    FROM volunteers v
    WHERE v.status = 'ONLINE'
        AND v.current_task_id IS NULL
        AND v.current_location IS NOT NULL
        AND ST_DWithin(
            v.current_location::geography,
            ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography,
            max_distance_km * 1000
        )
    ORDER BY distance ASC, v.rating DESC;
END;
$$ LANGUAGE plpgsql;

-- Insert sample admin user
INSERT INTO users (clerk_user_id, email, full_name, role) VALUES
('clerk_admin_temp', 'admin@foodrescue.org', 'System Admin', 'ADMIN')
ON CONFLICT DO NOTHING;
