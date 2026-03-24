import os
from dotenv import load_dotenv

# Load all environment variables at the absolute top before nested imports run
load_dotenv()

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from fastapi.middleware.cors import CORSMiddleware
from typing import Annotated

import models, schemas, auth, database
import os
import shutil
import time

# Create tables if they don't exist
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Portfolio Engine Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directory for avatars
os.makedirs("static/avatars", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Database Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

db_dependency = Annotated[Session, Depends(get_db)]

@app.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: db_dependency):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login")
def login_user(user: schemas.UserLogin, db: db_dependency):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not auth.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # If MFA is enabled, return a short-lived temp token instead of a full session token
    if db_user.mfa_enabled:
        temp_token = auth.create_access_token(
            data={"sub": db_user.email, "mfa_pending": True},
            expires_minutes=5
        )
        return {"mfa_required": True, "temp_token": temp_token}

    access_token = auth.create_access_token(data={"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer", "mfa_required": False}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: db_dependency):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

@app.get("/users/me", response_model=schemas.UserResponse)
def read_users_me(current_user: Annotated[models.User, Depends(get_current_user)]):
    return current_user

@app.put("/users/me", response_model=schemas.UserResponse)
def update_user_me(
    user_update: schemas.UserUpdate, 
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
        
    if user_update.password is not None and user_update.password.strip() != "":
        current_user.hashed_password = auth.get_password_hash(user_update.password)
        
    db.commit()
    db.refresh(current_user)
    return current_user

@app.put("/users/me/mfa", response_model=schemas.UserResponse)
def toggle_mfa(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    """Toggle MFA on or off for the current user."""
    current_user.mfa_enabled = not current_user.mfa_enabled
    db.commit()
    db.refresh(current_user)
    return current_user

@app.post("/mfa/verify")
def verify_mfa(payload: schemas.MfaVerify, db: db_dependency):
    """
    Verify the MFA code submitted after login.
    In dev mode: any 6-digit numeric code is accepted.
    In production: this would validate a TOTP code.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired session. Please log in again."
    )
    try:
        token_data = jwt.decode(payload.temp_token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email = token_data.get("sub")
        is_mfa_pending = token_data.get("mfa_pending", False)
        if not email or not is_mfa_pending:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Dev-mode: accept any 6-digit code
    if not payload.code.strip().isdigit() or len(payload.code.strip()) != 6:
        raise HTTPException(status_code=400, detail="Invalid code. Please enter a 6-digit code.")

    # Issue the real full-session access token
    access_token = auth.create_access_token(data={"sub": email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/forgot-password")
def forgot_password(payload: schemas.ForgotPasswordRequest, db: db_dependency):
    """
    Generate a password reset token for the given email.
    DEV MODE: returns the token directly in the response instead of sending an email.
    Returns a generic success message regardless of whether the email exists (security best practice).
    """
    import uuid, datetime as dt
    db_user = db.query(models.User).filter(models.User.email == payload.email).first()
    if db_user:
        token = str(uuid.uuid4())
        db_user.password_reset_token = token
        db_user.password_reset_expires = dt.datetime.utcnow() + dt.timedelta(minutes=30)
        db.commit()
        # In dev mode we return the token so it can be pasted into the UI
        return {
            "message": "If this email is registered, a reset link has been generated.",
            "dev_token": token  # Remove this in production
        }
    return {"message": "If this email is registered, a reset link has been generated."}

@app.post("/auth/reset-password")
def reset_password(payload: schemas.ResetPasswordRequest, db: db_dependency):
    """Validate the reset token and update the user's password."""
    import datetime as dt
    if not payload.new_password or len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    db_user = db.query(models.User).filter(models.User.password_reset_token == payload.token).first()
    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    if db_user.password_reset_expires and db_user.password_reset_expires < dt.datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reset token has expired. Please request a new one.")

    # Reject if the new password is the same as the current one
    import bcrypt as _bcrypt
    if _bcrypt.checkpw(payload.new_password.encode('utf-8'), db_user.hashed_password.encode('utf-8')):
        raise HTTPException(status_code=400, detail="New password must be different from your current password.")

    db_user.hashed_password = auth.get_password_hash(payload.new_password)
    db_user.password_reset_token = None
    db_user.password_reset_expires = None
    db.commit()
    return {"message": "Password updated successfully. You can now log in."}



@app.post("/users/me/avatar", response_model=schemas.UserResponse)
async def upload_avatar(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency,
    file: UploadFile = File(...)
):
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File provided is not an image.")

    # Create a unique filename
    file_extension = file.filename.split(".")[-1]
    filename = f"avatar_{current_user.id}.{file_extension}"
    file_path = os.path.join("static", "avatars", filename)

    # Save the file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Update user model - adding timestamp to bust browser cache
    avatar_url = f"http://localhost:8000/static/avatars/{filename}?t={int(time.time())}"
    current_user.avatar_url = avatar_url
    
    db.commit()
    db.refresh(current_user)
    
    return current_user

@app.delete("/users/me/avatar", response_model=schemas.UserResponse)
def delete_avatar(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    if current_user.avatar_url:
        # Extract filename to delete the static file if we wanted to
        # filename = current_user.avatar_url.split("/")[-1]
        # file_path = os.path.join("static", "avatars", filename)
        # if os.path.exists(file_path): os.remove(file_path)
        
        current_user.avatar_url = None
        db.commit()
        db.refresh(current_user)
        
    return current_user

from routers import brokers, portfolio

app.include_router(brokers.router)
app.include_router(portfolio.router)

# Forcing a reload to pick up python-multipart installation
