from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from database import engine, Base
from config import settings
from api.v1 import auth, donors, ngos, volunteers, tasks, admin, ratings, dispatcher, analytics, notifications
from utils.redis_manager import redis_manager
from utils.socket_manager import socket_manager
import socketio
import uvicorn
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("[BOOT] Starting Unified Food Rescue Backend...")
    
    # Tables already created via schema.sql in Supabase
    logger.info("[OK] Connected to NeonDB database")
    
    # Connect to Redis
    try:
        await redis_manager.connect()
        logger.info("[OK] Redis connected for caching")
    except Exception as e:
        logger.warning(f"[WARN] Redis connection failed: {e}")
        logger.warning("[WARN] Continuing without Redis (real-time caching disabled)")
    
    logger.info("[OK] WebSocket server ready")
    logger.info("[OK] All systems operational - server ready!")
    
    yield
    
    # Shutdown
    logger.info("[STOP] Shutting down application...")
    await redis_manager.disconnect()
    logger.info("[OK] Cleanup complete")


# Create FastAPI app
fastapi_app = FastAPI(
    title="Unified Food Rescue Platform",
    description="Integrated backend for donor, NGO, and volunteer management",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
fastapi_app.include_router(auth.router, prefix="/api/v1")
fastapi_app.include_router(donors.router, prefix="/api/v1")
fastapi_app.include_router(ngos.router, prefix="/api/v1")
fastapi_app.include_router(volunteers.router, prefix="/api/v1")
fastapi_app.include_router(tasks.router, prefix="/api/v1")
fastapi_app.include_router(admin.router, prefix="/api/v1")
fastapi_app.include_router(ratings.router, prefix="/api/v1")
fastapi_app.include_router(dispatcher.router, prefix="/api/v1")
fastapi_app.include_router(analytics.router, prefix="/api/v1")
fastapi_app.include_router(notifications.router, prefix="/api/v1")

@fastapi_app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to Unified Food Rescue API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@fastapi_app.get("/health")
async def health_check():
    """Health check endpoint"""
    redis_status = "connected" if redis_manager.redis_client else "disconnected"
    websocket_status = f"{len(socket_manager.get_connected_volunteers())} volunteers online"
    
    return {
        "status": "healthy",
        "database": "connected",
        "redis": redis_status,
        "websocket": websocket_status
    }


# Mount Socket.IO (Must wrap FastAPI to handle paths correctly at root)
app = socketio.ASGIApp(socket_manager.sio, fastapi_app)


if __name__ == "__main__":
    try:
        logger.info("=" * 60)
        logger.info("[INIT] Starting Unified Food Rescue Platform")
        logger.info(f"[INFO] Environment: Production" if not settings.DEBUG else "[INFO] Environment: Development")
        logger.info(f"[INFO] API Server: http://localhost:8000")
        logger.info(f"[INFO] API Docs: http://localhost:8000/docs")
        logger.info(f"[INFO] WebSocket: ws://localhost:8000/socket.io")
        logger.info("=" * 60)
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info"
        )
    except Exception as e:
        logger.error(f"Γ¥î FATAL ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")

