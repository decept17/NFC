import os
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User

# Configuration 
SECRET_KEY = os.getenv("JWT_SECRET", "test_secret") # Fallback for dev
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Security Tools 
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password,hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data:dict):
    to_encode = data.copy()
    #set expiration time (now + 60 minutes)
    expires = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expires})

    #sign the data with the secret key
    return jwt.encode(to_encode,SECRET_KEY,algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # 1. define the error to return if anything goes wrong
    credentials_exp = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # 2. Decode the token using the SECRET_KEY
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        
        # 3. Extract the User ID ('sub') from the token
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exp
            
    except JWTError:
        # If the token is fake, expired, or malformed, crash here
        raise credentials_exp
        
    # 4. Double check the user actually exists in the database
    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None:
        raise credentials_exp
        
    # 5. Return the full User object to the route
    return user