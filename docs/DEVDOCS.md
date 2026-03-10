# Food Rescue Platform - Developer Documentation

![Food Rescue Platform](https://img.shields.io/badge/status-active-success.svg)
![Python](https://img.shields.io/badge/python-3.10%2B-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104%2B-009688.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

> **Unified backend system integrating 4 separate food rescue platforms into a single cohesive solution**

---

## Table of Contents

- [Introduction](#introduction)
- [About](#about)
- [Prerequisites](#prerequisites)
- [Installing and Setting Up](#installing-and-setting-up)
  - [Quick Start Script](#quick-start-script)
  - [Manual Installation](#manual-installation)
  - [Database Setup](#database-setup)
    - [Automated Setup](#automated-setup)
    - [Manual Setup](#manual-setup)
  - [Verify Installation](#verify-installation)
  - [Important Notes](#important-notes)
- [Architecture](#architecture)
  - [Technology Stack](#technology-stack)
  - [Database Schema](#database-schema)
  - [API Structure](#api-structure)
- [Usage](#usage)
  - [Starting the Development Server](#starting-the-development-server)
  - [API Documentation](#api-documentation)
  - [Authentication Flow](#authentication-flow)
  - [Task Workflow](#task-workflow)
- [API Reference](#api-reference)
  - [Authentication Endpoints](#authentication-endpoints)
  - [Donor Endpoints](#donor-endpoints)
  - [NGO Endpoints](#ngo-endpoints)
  - [Volunteer Endpoints](#volunteer-endpoints)
  - [Task Management Endpoints](#task-management-endpoints)
  - [Admin Endpoints](#admin-endpoints)
- [Core Features](#core-features)
  - [Spatial Auto-Assignment](#spatial-auto-assignment)
  - [Real-Time GPS Tracking](#real-time-gps-tracking)
  - [QR Code Verification](#qr-code-verification)
  - [Multi-Role Authentication](#multi-role-authentication)
  - [NGO Verification System](#ngo-verification-system)
- [Frontend Integration](#frontend-integration)
  - [Flutter Mobile Apps](#flutter-mobile-apps)
  - [Next.js Web Dashboard](#nextjs-web-dashboard)
  - [API Configuration](#api-configuration)
- [Testing](#testing)
  - [Running Tests](#running-tests)
  - [Test Data Setup](#test-data-setup)
  - [Complete Workflow Testing](#complete-workflow-testing)
- [Environment Variables](#environment-variables)
- [Database Management](#database-management)
  - [Migrations](#migrations)
  - [Backup and Restore](#backup-and-restore)
- [Deployment](#deployment)
  - [Production Checklist](#production-checklist)
  - [Docker Deployment](#docker-deployment)
  - [Environment-Specific Configuration](#environment-specific-configuration)
- [Troubleshooting](#troubleshooting)
  - [Common Issues](#common-issues)
  - [Database Connection Problems](#database-connection-problems)
  - [Authentication Issues](#authentication-issues)
  - [PostGIS Issues](#postgis-issues)
- [Development Guidelines](#development-guidelines)
  - [Code Style](#code-style)
  - [Git Workflow](#git-workflow)
  - [Pull Request Process](#pull-request-process)
- [Contributing](#contributing)
- [Maintainers](#maintainers)
- [License](#license)
- [Support](#support)

---

## Introduction

The Food Rescue Platform is a unified backend system that consolidates four separate food rescue applications into a single, integrated solution. It enables seamless coordination between donors, NGOs, volunteers, and administrators to efficiently manage food donation and distribution.

**Example Workflow:**

```bash
# Donor creates a donation task
$ curl -X POST http://localhost:8000/api/v1/donors/tasks \
  -H "Authorization: Bearer <token>" \
  -d '{"food_type": "Vegetables", "quantity": 50}'

# System automatically assigns nearest volunteer
✓ Task created and assigned to volunteer 5km away

# Volunteer accepts and picks up food
$ curl -X POST http://localhost:8000/api/v1/tasks/123/accept

# QR verification at pickup and delivery
✓ Pickup verified
✓ Delivery verified
✓ Task completed
```

Simple as that!

---

## About

The Food Rescue Platform is a comprehensive backend system built with FastAPI, designed to coordinate food rescue operations across multiple stakeholders. It integrates:

1. **M7 Logistics System** - Volunteer tracking with real-time GPS
2. **Food Rescue Platform Main** - Donor management
3. **Food Rescue Platform NGO Portal** - NGO verification and management
4. **Food Rescue Platform Donation** - Donation forms

The platform works on any modern operating system (Windows, macOS, Linux) and provides RESTful APIs for web and mobile frontends.

---

## Prerequisites

Before installing the Food Rescue Platform, ensure you have the following:

### Required Software

- **Python 3.10 or higher**
  ```bash
  python --version  # Should show 3.10+
  ```

- **PostgreSQL 15 with PostGIS**
  - Supabase (recommended) or local PostgreSQL installation
  - PostGIS extension for spatial queries

- **Git** (for version control)
  ```bash
  git --version
  ```

### Optional Software

- **Docker** (for containerized deployment)
- **Redis** (for caching and session management)
- **Node.js 18+** (for frontend development)

### System Requirements

- **RAM**: Minimum 4GB, recommended 8GB+
- **Disk Space**: Minimum 2GB for dependencies
- **Network**: Internet connection for package installation

---

## Installing and Setting Up

### Quick Start Script

The fastest way to get started is using our automated setup script:

**Windows (PowerShell):**
```powershell
cd C:\path\to\food-rescue-platform
.\setup_database.ps1
```

**Linux/macOS (Bash):**
```bash
cd /path/to/food-rescue-platform
chmod +x setup_database.sh
./setup_database.sh
```

The script will:
- ✅ Test database connection
- ✅ Enable PostGIS and UUID extensions
- ✅ Create all 10 core tables
- ✅ Set up indexes and constraints
- ✅ Verify the installation

### Manual Installation

If you prefer manual installation or the script fails, follow these steps:

#### 1. Clone the Repository

```bash
git clone https://github.com/gL1TchE0/food-rescue-platform.git
cd food-rescue-platform
git checkout dev  # Use development branch
```

#### 2. Create Virtual Environment

**Windows:**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**Linux/macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

#### 3. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Key Dependencies:**
- FastAPI - Web framework
- SQLAlchemy - ORM
- psycopg2-binary - PostgreSQL driver
- pydantic - Data validation
- python-jose - JWT handling
- passlib - Password hashing
- GeoAlchemy2 - PostGIS support

#### 4. Configure Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:[password]@db.bwrwszeftkiwbybolzrh.supabase.co:5432/postgres

# JWT Configuration
SECRET_KEY=your-secret-key-here-use-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:8081

# Optional: Redis Configuration
REDIS_URL=redis://localhost:6379

# Environment
ENVIRONMENT=development
DEBUG=true
```

**Generate a secure SECRET_KEY:**
```bash
openssl rand -hex 32
```

### Database Setup

#### Automated Setup

Run the database setup script:

```bash
# From the root directory
.\setup_database.ps1  # Windows
./setup_database.sh   # Linux/macOS
```

#### Manual Setup

If the automated script doesn't work, manually execute the SQL:

1. **Connect to your database:**
   ```bash
   psql -h db.bwrwszeftkiwbybolzrh.supabase.co -U postgres -d postgres
   ```

2. **Run the schema file:**
   ```bash
   psql -h db.bwrwszeftkiwbybolzrh.supabase.co -U postgres -d postgres -f database/schema.sql
   ```

3. **Verify tables were created:**
   ```sql
   \dt
   ```

   You should see 10 tables:
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

### Verify Installation

To verify that the platform has been installed correctly:

```bash
# Start the development server
cd backend
python main.py

# In another terminal, test the health endpoint
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "version": "1.0.0"
}
```

Visit the interactive API documentation:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Important Notes

**Note on Database Credentials:**
- Never commit `.env` files with real credentials to version control
- Use environment-specific `.env` files (`.env.development`, `.env.production`)
- Store production credentials in secure vaults (AWS Secrets Manager, Azure Key Vault, etc.)

**Note on PostGIS:**
- PostGIS is required for spatial queries (finding nearest volunteers)
- Ensure PostGIS extension is enabled: `CREATE EXTENSION IF NOT EXISTS postgis;`
- Test PostGIS: `SELECT PostGIS_Version();`

**Note on Supabase:**
- This platform is optimized for Supabase but works with any PostgreSQL 15+ database
- Supabase provides built-in connection pooling and monitoring
- Local PostgreSQL requires manual PostGIS installation

**Windows Users:**
- Use PowerShell (not Command Prompt) for running scripts
- If execution policy blocks scripts, run: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

**macOS Users:**
- You may need to install PostgreSQL tools: `brew install postgresql`
- Ensure Python 3.10+ is installed: `brew install python@3.10`

---

## Architecture

### Technology Stack

**Backend:**
- **FastAPI** - Modern, fast Python web framework
- **SQLAlchemy** - SQL toolkit and ORM
- **PostgreSQL 15** - Relational database
- **PostGIS** - Spatial database extension
- **Pydantic** - Data validation using Python type annotations
- **Redis** (optional) - Caching and session storage

**Frontend:**
- **Flutter** - Mobile apps (iOS/Android)
- **Next.js** - Web dashboard
- **React.js** - UI components

**Authentication & Security:**
- **JWT** - JSON Web Tokens for authentication
- **Bcrypt** - Password hashing
- **CORS** - Cross-Origin Resource Sharing
- **Rate Limiting** - API protection

**DevOps:**
- **Docker** - Containerization
- **GitHub Actions** - CI/CD pipelines
- **Nginx** - Reverse proxy (production)

### Database Schema

The platform uses 10 core tables designed for scalability and spatial efficiency:

```
┌─────────────────────────────────────────────────────────────┐
│                     Database Schema                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐      ┌──────────┐      ┌─────────────┐     │
│  │  users   │──┬──→│  donors  │      │     ngos    │     │
│  └──────────┘  │   └──────────┘      └─────────────┘     │
│                │                              ↓            │
│                │                      ┌─────────────┐     │
│                ├──→┌─────────────┐   │ngo_branches │     │
│                │   │ volunteers  │   └─────────────┘     │
│                │   └─────────────┘                        │
│                │           ↓                               │
│                │   ┌─────────────┐                        │
│                └──→│    tasks    │←──────────────┐       │
│                    └─────────────┘               │       │
│                            ↓                      │       │
│                    ┌──────────────────┐          │       │
│                    │tracking_sessions │          │       │
│                    └──────────────────┘          │       │
│                            ↓                      │       │
│                    ┌──────────────────┐          │       │
│                    │task_exceptions   │          │       │
│                    └──────────────────┘          │       │
│                                                   │       │
│  ┌────────────────┐  ┌─────────────────┐        │       │
│  │admin_actions   │  │performance_stats│────────┘       │
│  └────────────────┘  └─────────────────┘                │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Key Tables:**

1. **users** - Unified user authentication (supports Clerk integration)
2. **donors** - Donor profiles with location data
3. **ngos** - NGO profiles with verification status
4. **ngo_branches** - Multiple NGO branch locations
5. **volunteers** - Volunteer profiles with vehicle info and availability
6. **tasks** - Donation tasks with QR verification
7. **tracking_sessions** - Real-time GPS tracking data
8. **task_exceptions** - Issue and exception tracking
9. **performance_stats** - Analytics and metrics
10. **admin_actions** - Audit log for administrative actions

**Spatial Features:**
- All location data uses PostGIS `GEOGRAPHY(POINT, 4326)` type
- Supports distance calculations in meters/kilometers
- Optimized spatial indexes for fast nearest-neighbor queries

### API Structure

```
backend/
├── main.py                 # FastAPI application entry point
├── config.py               # Configuration management
├── database.py             # Database connection and session
├── requirements.txt        # Python dependencies
│
├── api/
│   └── v1/
│       ├── __init__.py
│       ├── auth.py         # Authentication endpoints
│       ├── donors.py       # Donor CRUD + task creation
│       ├── ngos.py         # NGO management + verification
│       ├── volunteers.py   # Volunteer location tracking
│       └── tasks.py        # Task workflow + QR verification
│
├── models/
│   └── __init__.py         # SQLAlchemy ORM models
│
├── schemas/
│   └── __init__.py         # Pydantic validation schemas
│
├── services/
│   └── assignment.py       # Auto-assignment logic
│
└── utils/
    ├── auth.py             # JWT utilities
    ├── spatial.py          # PostGIS spatial queries
    └── qr_generator.py     # QR token generation
```

**API Versioning:**
- Current version: `v1`
- All endpoints prefixed with `/api/v1/`
- Future versions can coexist (e.g., `/api/v2/`)

---

## Usage

### Starting the Development Server

**Basic Start:**
```bash
cd backend
python main.py
```

The server will start on `http://localhost:8000`

**With Hot Reload:**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Custom Port:**
```bash
uvicorn main:app --port 8080
```

**Production Mode:**
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### API Documentation

Once the server is running, visit:

- **Swagger UI**: http://localhost:8000/docs
  - Interactive API documentation
  - Test endpoints directly in browser
  - View request/response schemas

- **ReDoc**: http://localhost:8000/redoc
  - Clean, searchable documentation
  - Better for reading and reference

### Authentication Flow

The platform uses JWT (JSON Web Tokens) for authentication:

1. **Register a new user:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user@example.com",
       "full_name": "John Doe",
       "role": "DONOR",
       "password": "SecurePass123"
     }'
   ```

2. **Login to get access token:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "user@example.com",
       "password": "SecurePass123"
     }'
   ```

   Response:
   ```json
   {
     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "token_type": "bearer"
   }
   ```

3. **Use token in subsequent requests:**
   ```bash
   curl -X GET http://localhost:8000/api/v1/donors/me \
     -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

### Task Workflow

The complete task lifecycle:

```
┌──────────┐  Create    ┌──────────┐  Auto-     ┌──────────┐
│  PENDING │───────────→│ ASSIGNED │───assign──→│ ACCEPTED │
└──────────┘  Donation  └──────────┘  Volunteer └──────────┘
                                                       │
                                                       │ Pickup
                                                       │ QR Scan
                                                       ↓
┌───────────┐  Admin    ┌────────────┐  Delivery ┌─────────────┐
│ COMPLETED │←──────────│  DELIVERED │←──────────│ IN_TRANSIT  │
└───────────┘  Confirms └────────────┘  QR Scan  └─────────────┘
```

**Step-by-Step:**

1. Donor creates task → `PENDING`
2. System auto-assigns nearest volunteer → `ASSIGNED`
3. Volunteer accepts task → `ACCEPTED`
4. Volunteer scans pickup QR → `IN_TRANSIT`
5. Volunteer scans delivery QR → `DELIVERED`
6. Admin confirms completion → `COMPLETED`

---

## API Reference

### Authentication Endpoints

#### Register User
```http
POST /api/v1/auth/register
```

**Request Body:**
```json
{
  "email": "string",
  "full_name": "string",
  "phone": "string (optional)",
  "role": "DONOR | NGO | VOLUNTEER | ADMIN",
  "password": "string (min 8 characters)"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "email": "string",
  "full_name": "string",
  "role": "string"
}
```

#### Login
```http
POST /api/v1/auth/login
```

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "string",
  "token_type": "bearer"
}
```

#### Get Current User
```http
GET /api/v1/auth/me
```

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "string",
  "full_name": "string",
  "role": "string",
  "created_at": "datetime"
}
```

---

### Donor Endpoints

#### Create Donor Profile
```http
POST /api/v1/donors/
```

**Request Body:**
```json
{
  "address": "string",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "organization_name": "string (optional)"
}
```

#### Get My Profile
```http
GET /api/v1/donors/me
```

#### Create Donation Task
```http
POST /api/v1/donors/tasks
```

**Request Body:**
```json
{
  "food_type": "string",
  "quantity": 50,
  "unit": "kg | liters | servings",
  "expiry_date": "2024-12-31T18:00:00",
  "pickup_address": "string",
  "pickup_latitude": 12.9716,
  "pickup_longitude": 77.5946,
  "special_instructions": "string (optional)"
}
```

**Response:** `201 Created`
- Task is automatically assigned to nearest available volunteer

#### Get My Tasks
```http
GET /api/v1/donors/tasks
```

**Query Parameters:**
- `status`: Filter by task status
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset

---

### NGO Endpoints

#### Create NGO Profile
```http
POST /api/v1/ngos/
```

**Request Body:**
```json
{
  "organization_name": "string",
  "registration_number": "string",
  "address": "string",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "license_url": "string",
  "verification_status": "PENDING"
}
```

#### Get Nearby Tasks
```http
GET /api/v1/ngos/nearby-tasks
```

**Query Parameters:**
- `max_distance_km`: Maximum distance (default: 10)

**Response:**
```json
[
  {
    "task_id": "uuid",
    "food_type": "string",
    "quantity": 50,
    "distance_km": 2.5,
    "pickup_location": {...}
  }
]
```

#### Claim a Task
```http
POST /api/v1/ngos/tasks/{task_id}/claim
```

---

### Volunteer Endpoints

#### Create Volunteer Profile
```http
POST /api/v1/volunteers/
```

**Request Body:**
```json
{
  "vehicle_type": "BIKE | CAR | VAN | TRUCK",
  "license_number": "string",
  "current_latitude": 12.9716,
  "current_longitude": 77.5946,
  "availability_status": "AVAILABLE"
}
```

#### Go Online/Offline
```http
POST /api/v1/volunteers/go-online
POST /api/v1/volunteers/go-offline
```

#### Update GPS Location
```http
PATCH /api/v1/volunteers/location
```

**Request Body:**
```json
{
  "latitude": 12.9716,
  "longitude": 77.5946
}
```

**Note:** Call this endpoint every 10-30 seconds during active delivery

#### Get Current Task
```http
GET /api/v1/volunteers/current-task
```

#### Accept Task
```http
POST /api/v1/tasks/{task_id}/accept
```

---

### Task Management Endpoints

#### Verify Pickup QR
```http
POST /api/v1/tasks/{task_id}/pickup-verify
```

**Request Body:**
```json
{
  "qr_token": "string",
  "latitude": 12.9716,
  "longitude": 77.5946
}
```

#### Verify Delivery QR
```http
POST /api/v1/tasks/{task_id}/delivery-verify
```

**Request Body:**
```json
{
  "qr_token": "string",
  "latitude": 12.9716,
  "longitude": 77.5946
}
```

#### Get Task Details
```http
GET /api/v1/tasks/{task_id}
```

#### Cancel Task
```http
POST /api/v1/tasks/{task_id}/cancel
```

**Request Body:**
```json
{
  "reason": "string"
}
```

---

### Admin Endpoints

#### Trigger Auto-Assignment
```http
POST /api/v1/tasks/auto-assign
```

**Request Body:**
```json
{
  "task_id": "uuid"
}
```

#### Reassign Task
```http
POST /api/v1/tasks/{task_id}/reassign
```

**Request Body:**
```json
{
  "volunteer_id": "uuid"
}
```

#### Mark Task Complete
```http
POST /api/v1/tasks/{task_id}/complete
```

---

## Core Features

### Spatial Auto-Assignment

The platform uses PostGIS to automatically assign donation tasks to the nearest available volunteer.

**How it works:**

1. Donor creates a task with pickup location (lat/lng)
2. System queries database for volunteers within configurable radius (default: 10km)
3. Filters for `AVAILABLE` status
4. Calculates exact distance using Haversine formula
5. Assigns to closest volunteer
6. Creates tracking session
7. Sends notification to volunteer

**Configuration:**

```python
# In services/assignment.py
MAX_ASSIGNMENT_DISTANCE_KM = 10  # Configurable
```

**SQL Query Example:**

```sql
-- Find volunteers within 10km of pickup location
SELECT v.id, v.full_name,
       ST_Distance(
         v.location::geography,
         ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography
       ) / 1000 as distance_km
FROM volunteers v
WHERE v.availability_status = 'AVAILABLE'
  AND ST_DWithin(
    v.location::geography,
    ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)::geography,
    10000  -- 10km in meters
  )
ORDER BY distance_km
LIMIT 1;
```

### Real-Time GPS Tracking

Volunteers can update their location in real-time during deliveries.

**Implementation:**

```javascript
// Mobile app sends location every 15 seconds
setInterval(async () => {
  const position = await getCurrentPosition();
  
  await fetch('/api/v1/volunteers/location', {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      latitude: position.latitude,
      longitude: position.longitude
    })
  });
}, 15000);
```

**Tracking Session:**
- Created when task is `ACCEPTED`
- Updated with GPS coordinates during delivery
- Closed when task is `COMPLETED` or `CANCELLED`

### QR Code Verification

Dual QR system prevents fraud and ensures accountability:

1. **Pickup QR** - Generated for donor, scanned by volunteer at pickup
2. **Delivery QR** - Generated for NGO, scanned by volunteer at delivery

**QR Token Format:**

```python
# QR token structure
{
  "task_id": "uuid",
  "type": "pickup | delivery",
  "timestamp": "datetime",
  "signature": "hmac_sha256"
}
```

**Verification Process:**

```bash
# Volunteer scans pickup QR
POST /api/v1/tasks/123/pickup-verify
{
  "qr_token": "eyJ0YXNrX2lkIjoi...",
  "latitude": 12.9716,
  "longitude": 77.5946
}

# System verifies:
✓ Token signature is valid
✓ Task ID matches
✓ Type is "pickup"
✓ Not expired (< 24 hours old)
✓ Location is within 100m of pickup address
```

### Multi-Role Authentication

The platform supports 4 user roles with distinct permissions:

| Role | Permissions |
|------|------------|
| **DONOR** | Create tasks, view own tasks, update profile |
| **NGO** | View nearby tasks, claim tasks, manage branches |
| **VOLUNTEER** | Accept tasks, update location, scan QR codes |
| **ADMIN** | All permissions, reassign tasks, view analytics |

**Role-Based Access Control (RBAC):**

```python
# Endpoint protection example
@router.get("/admin/analytics")
async def get_analytics(
    current_user: User = Depends(get_current_admin_user)
):
    # Only admins can access
    ...
```

### NGO Verification System

NGOs must be verified before receiving donations:

**Verification Workflow:**

1. NGO registers and uploads license document
2. Status: `PENDING`
3. Admin reviews license and organization details
4. Admin approves or rejects
5. Status: `APPROVED` or `REJECTED`
6. Only approved NGOs can claim tasks

**Document Requirements:**
- Government-issued registration certificate
- Tax exemption certificate (if applicable)
- Proof of address
- Bank account details

---

## Frontend Integration

### Flutter Mobile Apps

**Update API Base URL:**

```dart
// lib/config/constants.dart
class AppConfig {
  static const String apiBaseUrl = 'http://localhost:8000/api/v1';
  // Production: 'https://api.foodrescue.com/api/v1'
}
```

**Authentication Example:**

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

class AuthService {
  Future<String> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('${AppConfig.apiBaseUrl}/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
      }),
    );
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['access_token'];
    }
    throw Exception('Login failed');
  }
}
```

**Authenticated Requests:**

```dart
Future<void> updateLocation(double lat, double lng) async {
  final token = await SecureStorage.getToken();
  
  final response = await http.patch(
    Uri.parse('${AppConfig.apiBaseUrl}/volunteers/location'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({
      'latitude': lat,
      'longitude': lng,
    }),
  );
}
```

### Next.js Web Dashboard

**API Configuration:**

```javascript
// lib/api.js
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export const api = {
  async get(endpoint, token) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },
  
  async post(endpoint, data, token) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },
};
```

**Environment Variables (.env.local):**

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### API Configuration

**Endpoint Mapping:**

| Old System | New Unified Endpoint |
|-----------|---------------------|
| M7: `/tasks` | `/api/v1/volunteers/current-task` |
| M7: `/update-location` | `/api/v1/volunteers/location` |
| NGO Portal: `/ngos` | `/api/v1/ngos/` |
| Donation: `/donate` | `/api/v1/donors/tasks` |

---

## Testing

### Running Tests

**Unit Tests:**
```bash
pytest tests/unit/
```

**Integration Tests:**
```bash
pytest tests/integration/
```

**All Tests:**
```bash
pytest
```

**With Coverage:**
```bash
pytest --cov=backend --cov-report=html
```

### Test Data Setup

Create test users for each role:

```bash
# Donor
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "donor@test.com",
    "full_name": "Test Donor",
    "role": "DONOR",
    "password": "test123"
  }'

# NGO
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ngo@test.com",
    "full_name": "Test NGO",
    "role": "NGO",
    "password": "test123"
  }'

# Volunteer
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "volunteer@test.com",
    "full_name": "Test Volunteer",
    "role": "VOLUNTEER",
    "password": "test123"
  }'
```

### Complete Workflow Testing

Test the entire donation flow:

```bash
# 1. Login as donor
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"donor@test.com","password":"test123"}' \
  | jq -r .access_token)

# 2. Create donor profile
curl -X POST http://localhost:8000/api/v1/donors/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "123 Main St",
    "latitude": 12.9716,
    "longitude": 77.5946
  }'

# 3. Create donation task (auto-assigns volunteer)
curl -X POST http://localhost:8000/api/v1/donors/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "food_type": "Rice",
    "quantity": 50,
    "unit": "kg",
    "pickup_latitude": 12.9716,
    "pickup_longitude": 77.5946
  }'

# 4. Login as volunteer
VOLUNTEER_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"volunteer@test.com","password":"test123"}' \
  | jq -r .access_token)

# 5. Accept task
curl -X POST http://localhost:8000/api/v1/tasks/TASK_ID/accept \
  -H "Authorization: Bearer $VOLUNTEER_TOKEN"

# 6. Verify pickup
curl -X POST http://localhost:8000/api/v1/tasks/TASK_ID/pickup-verify \
  -H "Authorization: Bearer $VOLUNTEER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "qr_token": "PICKUP_QR_TOKEN",
    "latitude": 12.9716,
    "longitude": 77.5946
  }'
```

---

## Environment Variables

**Required Variables:**

| Variable | Description | Example |
|---------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SECRET_KEY` | JWT signing key | `openssl rand -hex 32` |
| `ALGORITHM` | JWT algorithm | `HS256` |

**Optional Variables:**

| Variable | Description | Default |
|---------|-------------|---------|
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT expiration | `30` |
| `CORS_ORIGINS` | Allowed origins | `http://localhost:3000` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `ENVIRONMENT` | Environment name | `development` |
| `DEBUG` | Debug mode | `false` |
| `MAX_ASSIGNMENT_DISTANCE_KM` | Auto-assign radius | `10` |

**Example .env file:**

```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/foodrescue

# JWT
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8081

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Environment
ENVIRONMENT=development
DEBUG=true

# Features
MAX_ASSIGNMENT_DISTANCE_KM=10
```

---

## Database Management

### Migrations

**Using Alembic (recommended):**

```bash
# Initialize Alembic
alembic init alembic

# Create a migration
alembic revision --autogenerate -m "Add new column"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

**Manual Migrations:**

```bash
# Apply SQL file
psql -h localhost -U postgres -d foodrescue -f migrations/001_add_column.sql
```

### Backup and Restore

**Backup Database:**

```bash
# Full backup
pg_dump -h localhost -U postgres -d foodrescue > backup.sql

# Schema only
pg_dump -h localhost -U postgres -d foodrescue --schema-only > schema.sql

# Data only
pg_dump -h localhost -U postgres -d foodrescue --data-only > data.sql
```

**Restore Database:**

```bash
# Restore from backup
psql -h localhost -U postgres -d foodrescue < backup.sql
```

**Automated Backups (Cron):**

```bash
# Add to crontab: Daily backup at 2 AM
0 2 * * * pg_dump -h localhost -U postgres -d foodrescue > /backups/foodrescue-$(date +\%Y\%m\%d).sql
```

---

## Deployment

### Production Checklist

Before deploying to production:

- [ ] Set strong `SECRET_KEY` (use `openssl rand -hex 32`)
- [ ] Configure production database (managed PostgreSQL recommended)
- [ ] Set `DEBUG=false`
- [ ] Configure CORS for production domains
- [ ] Enable HTTPS/SSL
- [ ] Set up Redis for caching
- [ ] Configure rate limiting
- [ ] Set up monitoring (Sentry, New Relic)
- [ ] Configure logging
- [ ] Set up CI/CD pipeline
- [ ] Database backups configured
- [ ] Environment variables in secure vault
- [ ] Firewall rules configured
- [ ] Load balancer configured
- [ ] CDN for static assets

### Docker Deployment

**Dockerfile:**

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Start application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/foodrescue
      - SECRET_KEY=${SECRET_KEY}
    depends_on:
      - db
      - redis
    
  db:
    image: postgis/postgis:15-3.3
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=foodrescue
    volumes:
      - postgres_data:/var/lib/postgresql/data
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

**Build and Run:**

```bash
# Build image
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

### Environment-Specific Configuration

**Development (.env.development):**
```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/foodrescue_dev
DEBUG=true
CORS_ORIGINS=http://localhost:3000,http://localhost:8081
```

**Staging (.env.staging):**
```bash
DATABASE_URL=postgresql://user:pass@staging-db.example.com:5432/foodrescue
DEBUG=false
CORS_ORIGINS=https://staging.foodrescue.com
```

**Production (.env.production):**
```bash
DATABASE_URL=postgresql://user:pass@prod-db.example.com:5432/foodrescue
DEBUG=false
CORS_ORIGINS=https://foodrescue.com
REDIS_URL=redis://prod-redis.example.com:6379
```

---

## Troubleshooting

### Common Issues

**Issue: "ModuleNotFoundError: No module named 'fastapi'"**

**Solution:**
```bash
# Ensure virtual environment is activated
source venv/bin/activate  # Linux/macOS
.\venv\Scripts\Activate.ps1  # Windows

# Reinstall dependencies
pip install -r requirements.txt
```

---

**Issue: "Connection refused" when starting server**

**Solution:**
```bash
# Check if port 8000 is already in use
# Linux/macOS:
lsof -i :8000

# Windows:
netstat -ano | findstr :8000

# Use a different port
uvicorn main:app --port 8080
```

---

**Issue: "CORS policy: No 'Access-Control-Allow-Origin' header"**

**Solution:**
Add frontend URL to `CORS_ORIGINS` in `.env`:
```bash
CORS_ORIGINS=http://localhost:3000,http://localhost:8081
```

### Database Connection Problems

**Issue: "could not connect to server: Connection refused"**

**Solution:**
```bash
# Check database is running
pg_isready -h localhost -p 5432

# Test connection manually
psql -h localhost -U postgres -d foodrescue

# Verify DATABASE_URL in .env
echo $DATABASE_URL
```

---

**Issue: "relation 'users' does not exist"**

**Solution:**
```bash
# Run database setup script
.\setup_database.ps1  # Windows
./setup_database.sh   # Linux/macOS

# Or manually apply schema
psql -h localhost -U postgres -d foodrescue -f database/schema.sql
```

### Authentication Issues

**Issue: "Could not validate credentials"**

**Solution:**
```bash
# Check JWT token expiration
# Token expires after ACCESS_TOKEN_EXPIRE_MINUTES (default: 30)

# Get a new token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -d '{"email":"user@example.com","password":"password"}'
```

---

**Issue: "Invalid signature" on JWT verification**

**Solution:**
```bash
# Ensure SECRET_KEY hasn't changed
# If SECRET_KEY changes, all existing tokens become invalid

# Generate new SECRET_KEY
openssl rand -hex 32

# Update .env file
SECRET_KEY=new-key-here

# Restart server
```

### PostGIS Issues

**Issue: "function st_distance does not exist"**

**Solution:**
```sql
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify installation
SELECT PostGIS_Version();
```

---

**Issue: "geometry type modifier mismatch"**

**Solution:**
```sql
-- Ensure correct SRID (4326 for WGS84)
SELECT ST_SRID(location) FROM volunteers;

-- Update SRID if incorrect
UPDATE volunteers 
SET location = ST_SetSRID(location, 4326);
```

---

## Development Guidelines

### Code Style

**Python (PEP 8):**
```bash
# Install formatter and linter
pip install black flake8 mypy

# Format code
black backend/

# Lint code
flake8 backend/

# Type checking
mypy backend/
```

**Naming Conventions:**
- Variables: `snake_case`
- Functions: `snake_case`
- Classes: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`

**Example:**
```python
# Good
MAX_ASSIGNMENT_DISTANCE = 10
class UserService:
    def get_user_by_email(self, email: str) -> User:
        ...

# Bad
maxAssignmentDistance = 10
class userservice:
    def GetUserByEmail(self, Email):
        ...
```

### Git Workflow

**Branching Strategy:**

```
main (production)
  ↑
dev (development)
  ↑
feature/add-notifications
feature/improve-assignment
bugfix/fix-qr-validation
```

**Branch Naming:**
- Feature: `feature/description`
- Bug Fix: `bugfix/description`
- Hot Fix: `hotfix/description`

**Commit Messages:**
```bash
# Good
git commit -m "feat: Add email notifications for task assignment"
git commit -m "fix: Correct QR token validation logic"
git commit -m "docs: Update API documentation"

# Bad
git commit -m "updated code"
git commit -m "fixes"
```

### Pull Request Process

1. Create feature branch from `dev`
2. Make changes and commit
3. Write/update tests
4. Ensure all tests pass
5. Update documentation
6. Create pull request to `dev`
7. Code review
8. Merge after approval

**PR Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests passed
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

---

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Areas for Contribution:**
- Bug fixes
- Feature enhancements
- Documentation improvements
- Test coverage
- Performance optimizations
- Security improvements

**Before Contributing:**
- Read the code of conduct
- Check existing issues
- Discuss major changes in issues first

---

## Maintainers

**Current Maintainers:**
- [@gL1TchE0](https://github.com/gL1TchE0) - Project Lead

**Integration Team:**
- M7 Logistics System - Volunteer Tracking
- Food Rescue Platform Main - Donor Management
- Food Rescue Platform NGO Portal - NGO Verification
- Food Rescue Platform Donation - Donation Forms

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

**Documentation:**
- [Setup Guide](SETUP_GUIDE.md) - Detailed installation instructions
- [Quick Start](QUICKSTART_SUPABASE.md) - Supabase setup guide
- [API Docs](http://localhost:8000/docs) - Interactive API documentation

**Getting Help:**
- **Issues**: Report bugs via [GitHub Issues](https://github.com/gL1TchE0/food-rescue-platform/issues)
- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/gL1TchE0/food-rescue-platform/discussions)
- **Email**: support@foodrescue.com (if configured)

**Community:**
- Discord Server (if available)
- Slack Channel (if available)
- Weekly Community Calls (if scheduled)

---

**Project Status:** ✅ Active Development

**Last Updated:** February 12, 2026

**Version:** 1.0.0

---

*Built with ❤️ for reducing food waste and helping communities*
