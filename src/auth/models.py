"""User models for authentication.

Defines User, Patient, and Provider models for the healthcare platform.
"""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, EmailStr, Field


class UserRole(StrEnum):
    """User roles in the system."""

    PATIENT = "patient"
    PROVIDER = "provider"
    ADMIN = "admin"
    STAFF = "staff"


class User(BaseModel):
    """Base user model."""

    id: str = Field(default_factory=lambda: str(uuid4()))
    email: EmailStr
    hashed_password: str
    role: UserRole
    first_name: str
    last_name: str
    phone: str | None = None
    is_active: bool = True
    is_verified: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: datetime | None = None

    @property
    def full_name(self) -> str:
        """Get full name."""
        return f"{self.first_name} {self.last_name}"

    def to_dict(self, include_sensitive: bool = False) -> dict[str, Any]:
        """Convert to dictionary."""
        data = {
            "id": self.id,
            "email": self.email,
            "role": self.role.value,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "phone": self.phone,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "last_login": self.last_login.isoformat() if self.last_login else None,
        }

        if include_sensitive:
            data["hashed_password"] = self.hashed_password

        return data


class Patient(User):
    """Patient user model with healthcare-specific fields."""

    role: UserRole = UserRole.PATIENT

    # Patient-specific fields
    date_of_birth: datetime | None = None
    gender: str | None = None
    insurance_provider: str | None = None
    insurance_id: str | None = None
    primary_provider_id: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    medical_conditions: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    medications: list[str] = Field(default_factory=list)

    @property
    def age(self) -> int | None:
        """Calculate age from date of birth."""
        if not self.date_of_birth:
            return None

        today = datetime.utcnow()
        age = today.year - self.date_of_birth.year
        if (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day):
            age -= 1
        return age

    def to_dict(self, include_sensitive: bool = False) -> dict[str, Any]:
        """Convert to dictionary."""
        data = super().to_dict(include_sensitive)
        data.update(
            {
                "date_of_birth": self.date_of_birth.isoformat() if self.date_of_birth else None,
                "age": self.age,
                "gender": self.gender,
                "insurance_provider": self.insurance_provider,
                "insurance_id": self.insurance_id if include_sensitive else None,
                "primary_provider_id": self.primary_provider_id,
                "emergency_contact_name": self.emergency_contact_name,
                "emergency_contact_phone": self.emergency_contact_phone,
                "medical_conditions": self.medical_conditions,
                "allergies": self.allergies,
                "medications": self.medications,
            }
        )
        return data


class Provider(User):
    """Healthcare provider user model."""

    role: UserRole = UserRole.PROVIDER

    # Provider-specific fields
    specialty: str | None = None
    npi_number: str | None = None  # National Provider Identifier
    license_number: str | None = None
    license_state: str | None = None
    accepting_new_patients: bool = True
    languages: list[str] = Field(default_factory=lambda: ["English"])
    education: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    bio: str | None = None

    def to_dict(self, include_sensitive: bool = False) -> dict[str, Any]:
        """Convert to dictionary."""
        data = super().to_dict(include_sensitive)
        data.update(
            {
                "specialty": self.specialty,
                "npi_number": self.npi_number if include_sensitive else None,
                "license_number": self.license_number if include_sensitive else None,
                "license_state": self.license_state,
                "accepting_new_patients": self.accepting_new_patients,
                "languages": self.languages,
                "education": self.education,
                "certifications": self.certifications,
                "bio": self.bio,
            }
        )
        return data


class UserCreate(BaseModel):
    """Model for creating a new user."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1)
    last_name: str = Field(..., min_length=1)
    phone: str | None = None
    role: UserRole = UserRole.PATIENT


class UserLogin(BaseModel):
    """Model for user login."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Response model for authentication tokens."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class TokenData(BaseModel):
    """Data extracted from a JWT token."""

    user_id: str
    email: str
    role: UserRole
    exp: datetime
