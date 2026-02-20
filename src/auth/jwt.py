"""JWT token handling for authentication.

Provides token creation and verification using python-jose.
"""

from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from src.auth.models import TokenData, UserRole

# JWT Configuration
# In production, these would come from environment variables
SECRET_KEY = "your-secret-key-change-in-production"  # noqa: S105
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7


# Security scheme for FastAPI
security = HTTPBearer()


def create_access_token(
    user_id: str,
    email: str,
    role: UserRole,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT access token.

    Args:
        user_id: User's unique identifier
        email: User's email address
        role: User's role
        expires_delta: Optional custom expiration time

    Returns:
        Encoded JWT token
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    expire = datetime.utcnow() + expires_delta

    payload = {
        "sub": user_id,
        "email": email,
        "role": role.value,
        "exp": expire,
        "type": "access",
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(
    user_id: str,
    email: str,
    role: UserRole,
) -> str:
    """Create a JWT refresh token.

    Args:
        user_id: User's unique identifier
        email: User's email address
        role: User's role

    Returns:
        Encoded JWT refresh token
    """
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    payload = {
        "sub": user_id,
        "email": email,
        "role": role.value,
        "exp": expire,
        "type": "refresh",
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str, token_type: str = "access") -> TokenData:
    """Verify and decode a JWT token.

    Args:
        token: The JWT token to verify
        token_type: Expected token type ("access" or "refresh")

    Returns:
        TokenData with decoded information

    Raises:
        HTTPException: If token is invalid or expired
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        user_id: str = payload.get("sub")
        email: str = payload.get("email")
        role_str: str = payload.get("role")
        exp: int = payload.get("exp")
        actual_type: str = payload.get("type", "access")

        if user_id is None or email is None or role_str is None:
            raise credentials_exception

        if actual_type != token_type:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid token type. Expected {token_type}.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return TokenData(
            user_id=user_id,
            email=email,
            role=UserRole(role_str),
            exp=datetime.fromtimestamp(exp),
        )

    except JWTError as e:
        raise credentials_exception from e


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> TokenData:
    """FastAPI dependency to get the current authenticated user.

    Args:
        credentials: HTTP Bearer credentials from request

    Returns:
        TokenData for the authenticated user

    Raises:
        HTTPException: If authentication fails
    """
    token = credentials.credentials
    return verify_token(token, token_type="access")


async def get_current_active_user(
    current_user: TokenData = Depends(get_current_user),
) -> TokenData:
    """FastAPI dependency to get current active user.

    Args:
        current_user: Current authenticated user

    Returns:
        TokenData if user is active

    Note:
        In production, this would check the database to verify
        the user is still active.
    """
    # In production, verify user is still active in database
    return current_user


def require_role(*allowed_roles: UserRole):
    """FastAPI dependency factory to require specific roles.

    Args:
        allowed_roles: Roles that are allowed access

    Returns:
        Dependency function that checks user role

    Example:
        @app.get("/admin-only")
        async def admin_endpoint(
            user: TokenData = Depends(require_role(UserRole.ADMIN))
        ):
            ...
    """

    async def role_checker(
        current_user: TokenData = Depends(get_current_user),
    ) -> TokenData:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_checker
