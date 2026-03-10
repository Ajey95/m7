# Food Rescue Platform - Backend API

The core backend service for the Food Rescue Platform, built with **FastAPI**. It handles user authentication, donation management, logistics coordination, and real-time updates via WebSockets.

## 🌟 Key Features

- **Authentication**: Secure JWT-based auth with role-based access control (Admin, Dispatcher, Donor, NGO, Volunteer).
- **Donation Management**: CRUD operations for food donations with validation.
- **Logistics & Tasks**: Automated and manual assignment of pickup/delivery tasks to volunteers.
- **Real-time Updates**: Socket.IO integration for live tracking of volunteers and task status updates.
- **Geolocation**: Spatial queries to find nearby volunteers and optimize routes.
- **Admin Analytics**: Aggregated stats on food rescued and CO2 emissions prevented.

## 🛠️ Tech Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.9+)
- **Database**: SQLAlchemy (SQLite for dev / PostgreSQL ready)
- **Real-time**: Python-SocketIO (ASGI)
- **Validation**: Pydantic models
- **Testing**: Pytest

## 🚀 Getting Started

### Prerequisites

- Python 3.9 or higher
- pip (Python package manager)

### Installation

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On macOS/Linux
   # OR
   .\venv\Scripts\activate   # On Windows
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Setup:**
   Create a `.env` file in the `backend` directory (copy from `.env.example` if available) or set defaults:
   ```env
   SECRET_KEY=your_secret_key_here
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=30
   DATABASE_URL=sqlite:///./sql_app.db
   ```

### Running the Server

Start the development server with hot-reload:

```bash
python main.py
```
*Server will run at `http://localhost:8000`*

## 📚 API Documentation

FastAPI provides automatic interactive documentation:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/token` | Login & get access token |
| POST | `/api/v1/auth/register` | Register new user |
| GET | `/api/v1/donors/tasks` | Get donor's donation history |
| POST | `/api/v1/donors/tasks` | Create a new donation |
| GET | `/api/v1/volunteers/tasks` | Get available tasks for volunteers |
| POST | `/api/v1/tasks/{id}/verify` | Verify delivery with QR code |

## 🔌 WebSocket Events

The backend broadcasts events to connected clients:

- `task_created`: New donation available.
- `task_assigned`: Task assigned to a volunteer.
- `task_updated`: Status change (e.g., DELIVERED).
- `volunteer_location`: Real-time GPS updates (Admin/Dispatcher only).

## 🤝 Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
