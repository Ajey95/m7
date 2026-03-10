from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Clerk
    CLERK_ISSUER: str = "https://clerk.clerk.com"  # Update with your Clerk Issuer URL
    CLERK_JWKS_URL: str = "https://api.clerk.com/v1/jwks"  # Update with your Clerk JWKS URL
    TEST_MODE: bool = True  # Set to True for running tests without real Clerk tokens

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    RELOAD: bool = True

    # CORS
    CORS_ORIGINS: str

    # Assignment
    MAX_ASSIGNMENT_DISTANCE_KM: int = 10
    QR_TOKEN_LENGTH: int = 6

    # Google Maps API
    GOOGLE_MAPS_API_KEY: str = ""

    # Firebase (for push notifications)
    FIREBASE_SERVER_KEY: str = ""
    FIREBASE_PROJECT_ID: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignore extra fields in .env file


settings = Settings()
