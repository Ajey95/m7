from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from config import settings
from database import get_db
from models import User
from typing import Optional, Dict
import httpx

# Password hashing (kept for legacy support/local testing if needed, though Clerk handles passwords)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

# JWKS Cache
_jwks_cache: Dict = {}


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Create JWT access token.
    ONLY used for:
    1. Local Testing (TEST_MODE=True)
    2. Legacy login support (if enabled)
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def _get_clerk_public_key(kid: str) -> str:
    """Fetch and cache Clerk's public key from JWKS"""
    # Check cache first
    if kid in _jwks_cache:
        return _jwks_cache[kid]

    # Fetch from Clerk
    try:
        with httpx.Client() as client:
            response = client.get(settings.CLERK_JWKS_URL)
            response.raise_for_status()
            jwks = response.json()

            for key in jwks.get("keys", []):
                if key.get("kid") == kid:
                    _jwks_cache[kid] = key
                    return key

            # If not found after refresh, maybe refresh logic here (but we just refreshed)
            return None
    except Exception as e:
        print(f"Error fetching JWKS: {e}")
        return None


def verify_token(token: str) -> dict:
    """
    Verify and decode JWT token.
    Supports:
    1. Local HS256 tokens (if TEST_MODE=True)
    2. Clerk RS256 tokens (Production)
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # TEST MODE: Verify simplistic HS256 token
        if settings.TEST_MODE:
            return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        # PRODUCTION MODE: Verify Clerk RS256 token
        # 1. Decode header to find Key ID (kid) without verification
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if not kid:
            raise credentials_exception

        # 2. Get Public Key
        public_key = _get_clerk_public_key(kid)
        if not public_key:
            raise credentials_exception

        # 3. Verify Token
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=None,  # Clerk audience might be different, can check later
            issuer=settings.CLERK_ISSUER
        )
        return payload

    except JWTError:
        raise credentials_exception
    except Exception as e:
        print(f"Token verification error: {e}")
        raise credentials_exception


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user via Clerk token or Local Test token"""
    payload = verify_token(token)

    # Clerk uses 'sub' as the user ID (clerk_user_id)
    # Our local test tokens use 'sub' as email, but let's standardize
    token_sub = payload.get("sub")

    if token_sub is None:
        print("[AUTH_DEBUG] Token sub is None")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

    # Find user
    # Priority 1: Match by clerk_user_id (Production)
    user = db.query(User).filter(User.clerk_user_id == token_sub).first()

    # Priority 2: Match by email (Legacy / Test Mode fallback)
    # In test mode, we might sign the email as 'sub'
    if not user and settings.TEST_MODE:
        user = db.query(User).filter(User.email == token_sub).first()

    if user is None:
        print(f"[AUTH_DEBUG] User not found for sub: {token_sub}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user
