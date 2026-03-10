from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Annotated
import models, schemas, database
from main import get_current_user

router = APIRouter(
    prefix="/portfolio",
    tags=["Portfolio"]
)

db_dependency = Annotated[Session, Depends(database.get_db)]

@router.get("/assets", response_model=List[schemas.AssetResponse])
def get_assets(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    assets = db.query(models.Asset).filter(models.Asset.user_id == current_user.id).all()
    # In a real app we would ping the live price feed. For simplicity:
    for asset in assets:
        asset.current_price = float(asset.average_buy_price) * 1.05 # Mocked 5% gain for UI representation if live price missing
    return assets

@router.delete("/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(
    asset_id: int,
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    asset = db.query(models.Asset).filter(
        models.Asset.id == asset_id,
        models.Asset.user_id == current_user.id
    ).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    db.delete(asset)
    db.commit()

@router.get("/summary", response_model=schemas.PortfolioSummary)
def get_portfolio_summary(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    assets = db.query(models.Asset).filter(models.Asset.user_id == current_user.id).all()
    
    total_val = 0.0
    total_cost = 0.0
    
    for a in assets:
        qty = float(a.quantity)
        buy_price = float(a.average_buy_price)
        cost = qty * buy_price
        
        # Simulating live price for aesthetics
        live_price = buy_price * 1.05 
        
        val = qty * live_price
        
        total_cost += cost
        total_val += val
        
    day_return_abs = total_val - total_cost
    day_return_perc = (day_return_abs / total_cost * 100) if total_cost > 0 else 0.0
    
    return schemas.PortfolioSummary(
        total_value=total_val,
        active_positions=len(assets),
        day_return_perc=day_return_perc,
        day_return_abs=day_return_abs
    )
