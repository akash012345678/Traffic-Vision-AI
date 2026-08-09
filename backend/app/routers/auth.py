from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.database.session import get_db
from app.models.models import User
from app.utils.security import verify_password, create_access_token
from app.middleware.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None

class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

@router.post("/signup", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """
    Public User Registration Endpoint: Creates a new user with PUBLIC role.
    """
    from app.utils.security import hash_password

    email_clean = payload.email.strip().lower()
    existing_user = db.query(User).filter(func.lower(User.email) == email_clean).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in."
        )

    pw_hash = hash_password(payload.password.strip())
    new_user = User(
        name=payload.name.strip(),
        email=email_clean,
        password_hash=pw_hash,
        role="PUBLIC",
        status="ACTIVE",
        phone=payload.phone.strip() if payload.phone else None
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token_data = {
        "sub": str(new_user.id),
        "email": new_user.email,
        "role": new_user.role,
        "name": new_user.name,
    }
    access_token = create_access_token(data=token_data)

    user_profile = {
        "id": new_user.id,
        "name": new_user.name,
        "email": new_user.email,
        "role": new_user.role,
        "phone": getattr(new_user, "phone", None),
        "status": getattr(new_user, "status", "ACTIVE"),
        "zone": None,
        "created_at": new_user.created_at.isoformat() if new_user.created_at else None
    }

    return AuthTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_profile
    )

@router.post("/login", response_model=AuthTokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate User with email & password against Supabase / PostgreSQL users table.
    Returns JWT access_token and user profile with role.
    """
    email_clean = payload.email.strip().lower()
    user = db.query(User).filter(func.lower(User.email) == email_clean).first()
    
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if getattr(user, "status", "ACTIVE").upper() == "INACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Please contact an Administrator."
        )

    # Generate JWT token with sub as string per RFC 7519
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "name": user.name,
    }
    access_token = create_access_token(data=token_data)

    user_profile = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "phone": getattr(user, "phone", None),
        "status": getattr(user, "status", "ACTIVE"),
        "zone": getattr(user, "zone", None),
        "created_at": user.created_at.isoformat() if user.created_at else None
    }

    return AuthTokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_profile
    )

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve current authenticated user details."""
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "phone": getattr(current_user, "phone", None),
        "status": getattr(current_user, "status", "ACTIVE"),
        "zone": getattr(current_user, "zone", None),
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None
    }
