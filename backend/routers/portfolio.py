from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Annotated
import models, schemas, database, alpaca_sync
from main import get_current_user

router = APIRouter(
    prefix="/portfolio",
    tags=["Portfolio"]
)

db_dependency = Annotated[Session, Depends(database.get_db)]

@router.post("/sync")
def sync_all_portfolios(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    """Dynamically sweeps all connected brokers for the user and pulls the absolute newest prices into the database for the active viewing session."""
    creds = db.query(models.BrokerCredential).filter(models.BrokerCredential.user_id == current_user.id).all()
    results = []
    for c in creds:
        if c.broker_name == "Alpaca":
            res = alpaca_sync.sync_alpaca_account(c.id, current_user.id, db)
            results.append({"broker": c.broker_name, "status": res["status"]})
    
    return {"message": "Auto-sync pipeline completed", "details": results}

@router.get("/assets", response_model=List[schemas.AssetResponse])
def get_assets(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    assets = db.query(models.Asset).filter(models.Asset.user_id == current_user.id).all()
    # Now that we fetch real-time Alpaca data, mock overrides are completely removed.
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
    creds = db.query(models.BrokerCredential).filter(models.BrokerCredential.user_id == current_user.id).all()
    
    total_val = 0.0
    total_cost = 0.0
    total_capital = 0.0
    
    for c in creds:
        if c.total_capital:
            total_capital += float(c.total_capital)
            
    for a in assets:
        qty = float(a.quantity) if a.quantity else 0.0
        buy_price = float(a.average_buy_price) if a.average_buy_price else 0.0
        
        # Real time asset value utilizing pulled native API tracking
        live_price = float(a.current_price) if a.current_price else 0.0
        
        cost = qty * buy_price
        val = qty * live_price
        
        total_cost += cost
        total_val += val
        
    day_return_abs = total_val - total_cost
    day_return_perc = (day_return_abs / total_cost * 100) if total_cost > 0 else 0.0
    
    return schemas.PortfolioSummary(
        total_capital=total_capital,
        total_value=total_val,
        active_positions=len(assets),
        day_return_perc=day_return_perc,
        day_return_abs=day_return_abs
    )
