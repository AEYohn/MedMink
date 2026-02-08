"""Authentication API routes.

Provides endpoints for:
- User registration
- Login/logout
- Token refresh
- Password management
"""

from datetime import datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from src.auth.jwt import (
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from src.auth.models import (
    User,
    Patient,
    Provider,
    UserRole,
    UserCreate,
    UserLogin,
    TokenResponse,
    TokenData,
)
from src.auth.password import hash_password, verify_password

logger = structlog.get_logger()
router = APIRouter(prefix="/auth", tags=["auth"])


# In-memory user storage (would be database in production)
_users: dict[str, User] = {}
_users_by_email: dict[str, str] = {}  # email -> user_id mapping


# ============================================================================
# Request/Response Models
# ============================================================================


class RegisterRequest(BaseModel):
    """Request for user registration."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1)
    last_name: str = Field(..., min_length=1)
    phone: str | None = None
    role: UserRole = UserRole.PATIENT

    # Patient-specific fields (optional)
    date_of_birth: str | None = None
    gender: str | None = None
    insurance_provider: str | None = None


class LoginRequest(BaseModel):
    """Request for user login."""

    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """Request for token refresh."""

    refresh_token: str


class PasswordChangeRequest(BaseModel):
    """Request for password change."""

    current_password: str
    new_password: str = Field(..., min_length=8)


class UserResponse(BaseModel):
    """Response with user information."""

    id: str
    email: str
    first_name: str
    last_name: str
    full_name: str
    role: str
    phone: str | None
    is_active: bool
    is_verified: bool
    created_at: str


# ============================================================================
# Endpoints
# ============================================================================


@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest):
    """Register a new user.

    Creates a new user account and returns authentication tokens.
    """
    # Check if email already exists
    if request.email.lower() in _users_by_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Hash password
    hashed_password = hash_password(request.password)

    # Create user based on role
    if request.role == UserRole.PATIENT:
        user = Patient(
            email=request.email.lower(),
            hashed_password=hashed_password,
            first_name=request.first_name,
            last_name=request.last_name,
            phone=request.phone,
            date_of_birth=datetime.fromisoformat(request.date_of_birth) if request.date_of_birth else None,
            gender=request.gender,
            insurance_provider=request.insurance_provider,
        )
    elif request.role == UserRole.PROVIDER:
        user = Provider(
            email=request.email.lower(),
            hashed_password=hashed_password,
            first_name=request.first_name,
            last_name=request.last_name,
            phone=request.phone,
        )
    else:
        user = User(
            email=request.email.lower(),
            hashed_password=hashed_password,
            first_name=request.first_name,
            last_name=request.last_name,
            phone=request.phone,
            role=request.role,
        )

    # Store user
    _users[user.id] = user
    _users_by_email[user.email] = user.id

    logger.info("User registered", user_id=user.id, email=user.email, role=user.role.value)

    # Create tokens
    access_token = create_access_token(user.id, user.email, user.role)
    refresh_token = create_refresh_token(user.id, user.email, user.role)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Log in a user.

    Validates credentials and returns authentication tokens.
    """
    email = request.email.lower()

    # Find user
    user_id = _users_by_email.get(email)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user = _users.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Verify password
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Check if active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # Update last login
    user.last_login = datetime.utcnow()

    logger.info("User logged in", user_id=user.id, email=user.email)

    # Create tokens
    access_token = create_access_token(user.id, user.email, user.role)
    refresh_token = create_refresh_token(user.id, user.email, user.role)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshRequest):
    """Refresh authentication tokens.

    Uses a refresh token to get new access and refresh tokens.
    """
    try:
        token_data = verify_token(request.refresh_token, token_type="refresh")
    except HTTPException:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Verify user still exists and is active
    user = _users.get(token_data.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    # Create new tokens
    access_token = create_access_token(user.id, user.email, user.role)
    refresh_token = create_refresh_token(user.id, user.email, user.role)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: TokenData = Depends(get_current_user),
):
    """Get current user information.

    Returns the authenticated user's profile information.
    """
    user = _users.get(current_user.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        role=user.role.value,
        phone=user.phone,
        is_active=user.is_active,
        is_verified=user.is_verified,
        created_at=user.created_at.isoformat(),
    )


@router.post("/change-password")
async def change_password(
    request: PasswordChangeRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """Change user password.

    Requires the current password for verification.
    """
    user = _users.get(current_user.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Verify current password
    if not verify_password(request.current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Update password
    user.hashed_password = hash_password(request.new_password)
    user.updated_at = datetime.utcnow()

    logger.info("Password changed", user_id=user.id)

    return {"message": "Password changed successfully"}


@router.post("/logout")
async def logout(
    current_user: TokenData = Depends(get_current_user),
):
    """Log out the current user.

    Note: In a production system with token blacklisting,
    this would invalidate the token.
    """
    logger.info("User logged out", user_id=current_user.user_id)

    return {"message": "Logged out successfully"}
