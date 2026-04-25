from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    mfa_enabled = Column(Boolean, default=False)
    
    # Registration & Password Reset
    email_verification_code = Column(String, nullable=True)
    email_verification_expires = Column(DateTime, nullable=True)
    password_reset_token = Column(String, nullable=True)
    password_reset_expires = Column(DateTime, nullable=True)
    
    # MFA Authentication
    mfa_code = Column(String, nullable=True)
    mfa_expires = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    broker_credentials = relationship("BrokerCredential", back_populates="user", cascade="all, delete-orphan")
    assets = relationship("Asset", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")

class BrokerCredential(Base):
    __tablename__ = "broker_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    broker_name = Column(String, nullable=False)
    nickname = Column(String, nullable=True)
    api_key = Column(String, nullable=False)
    identifier = Column(String, nullable=True) # E.g. account id or email
    endpoint = Column(String, nullable=True) # Manual base URL provided by user
    total_capital = Column(String, nullable=True) # Fetched from account API
    encrypted_secret = Column(String, nullable=False) # Changed from encrypted_password to secret for Alpaca
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="broker_credentials")

class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False, index=True)
    asset_class = Column(String, nullable=False) # 'Stock', 'Crypto', 'CFD'
    quantity = Column(String, nullable=False) # Storing as String for decimal precision
    average_buy_price = Column(String, nullable=False) 
    current_price = Column(String, nullable=True)
    pnl = Column(String, nullable=True)
    pnl_percent = Column(String, nullable=True)
    broker_name = Column(String, nullable=True)  # 'Alpaca', 'Binance Demo', etc.
    credential_id = Column(Integer, ForeignKey("broker_credentials.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="assets")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String, nullable=False, index=True)
    transaction_type = Column(String, nullable=False) # 'BUY' or 'SELL'
    quantity = Column(String, nullable=False)
    price = Column(String, nullable=False)
    broker_name = Column(String, nullable=True)  # 'Alpaca', 'Binance Demo'
    credential_id = Column(Integer, ForeignKey("broker_credentials.id"), nullable=True)
    asset_class = Column(String, nullable=True)
    external_id = Column(String, nullable=True, index=True)  # broker order id for deduplication
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="transactions")

class UserPreferences(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # Portfolio Preferences
    currency = Column(String, default="USD")
    sync_interval = Column(Integer, default=15)        # minutes
    show_chart = Column(Boolean, default=True)
    default_view = Column(String, default="dashboard") # 'dashboard' | 'holdings'

    # Notification Preferences
    notify_email = Column(Boolean, default=False)
    notify_price_alerts = Column(Boolean, default=True)
    notify_sync_complete = Column(Boolean, default=False)
    notify_daily_summary = Column(Boolean, default=False)
    notify_milestones = Column(Boolean, default=True)

    user = relationship("User", back_populates="preferences")
