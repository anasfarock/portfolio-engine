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
    allow_origins=["*"],
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

@app.post("/login", response_model=schemas.Token)
def login_user(user: schemas.UserLogin, db: db_dependency):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if not db_user or not auth.verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(
        data={"sub": db_user.email}
    )
    return {"access_token": access_token, "token_type": "bearer"}

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

# Forcing a reload to pick up python-multipart installation
