"""Authentication module for the healthcare platform.

Provides:
- User models (Patient, Provider, Admin)
- JWT token handling
- Password hashing
- FastAPI dependencies for authentication
"""

from src.auth.jwt import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    verify_token,
)
from src.auth.models import Patient, Provider, User, UserRole
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
