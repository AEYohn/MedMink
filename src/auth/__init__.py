"""Authentication module for the healthcare platform.

Provides:
- User models (Patient, Provider, Admin)
- JWT token handling
- Password hashing
- FastAPI dependencies for authentication
"""

from src.auth.models import User, Patient, Provider, UserRole
from src.auth.jwt import (
    create_access_token,
    create_refresh_token,
    verify_token,
    get_current_user,
)
from src.auth.password import hash_password, verify_password

__all__ = [
    # Models
    "User",
    "Patient",
    "Provider",
    "UserRole",
    # JWT
    "create_access_token",
    "create_refresh_token",
    "verify_token",
    "get_current_user",
    # Password
    "hash_password",
    "verify_password",
]
