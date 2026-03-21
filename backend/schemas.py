from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None = None
    avatar_url: str | None = None
    is_active: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class UserUpdate(BaseModel):
    full_name: str | None = None
    password: str | None = None

# Broker Schemas
class BrokerCredentialBase(BaseModel):
    broker_name: str
    api_key: str
    identifier: str | None = None
    endpoint: str | None = None
    total_capital: str | None = None

class BrokerCredentialCreate(BrokerCredentialBase):
    api_secret: str

class BrokerCredentialResponse(BrokerCredentialBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

# Asset Schemas
class AssetBase(BaseModel):
    symbol: str
    asset_class: str
    quantity: str
    average_buy_price: str
    current_price: str | None = None
    pnl: str | None = None
    pnl_percent: str | None = None
    broker_name: str | None = None

class AssetCreate(AssetBase):
    pass

class AssetResponse(AssetBase):
    id: int
    user_id: int
    
    class Config:
        from_attributes = True

class PortfolioSummary(BaseModel):
    total_capital: float
    total_value: float
    active_positions: int
    day_return_perc: float
    day_return_abs: float
