import secrets
import string
import jwt
import hashlib
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from passlib.context import CryptContext
from app.config.settings import settings
from app.utils.logger import logger

# Retained strictly for imports compatibility in other files
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Generate bcrypt hashed password string."""
    salt = bcrypt.gensalt(12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against bcrypt hashed password with legacy fallback."""
    if not hashed_password or not plain_password:
        return False
    try:
        if bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8')):
            return True
    except Exception:
        pass

    # Fallback for copy-pasted password with surrounding whitespace
    stripped_pwd = plain_password.strip()
    if stripped_pwd != plain_password:
        try:
            if bcrypt.checkpw(stripped_pwd.encode('utf-8'), hashed_password.encode('utf-8')):
                return True
        except Exception:
            pass

    # Legacy sha256 or plaintext fallback
    sha256_hash = hashlib.sha256(plain_password.encode('utf-8')).hexdigest()
    if sha256_hash == hashed_password or plain_password == hashed_password or stripped_pwd == hashed_password:
        return True

    return False

def generate_temporary_password() -> str:
    """Generate secure temporary password (e.g. Traf@2026#AB12)."""
    uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    digits = "23456789"
    suffix = ''.join(secrets.choice(uppercase + digits) for _ in range(4))
    return f"Traf@2026#{suffix}"

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Generate JWT Access Token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT Access Token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT Token verification failed: Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning("JWT Token verification failed: %s", str(e))
        return None
