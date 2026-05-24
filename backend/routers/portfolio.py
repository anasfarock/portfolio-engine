from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Annotated
import math
import models, schemas, database, alpaca_sync, binance_sync, ibkr_sync
from auth import get_current_user, db_dependency
from fastapi import APIRouter

router = APIRouter(
    prefix="/portfolio",
    tags=["Portfolio"]
)

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
        elif c.broker_name in ["Binance Demo", "Binance Spot"]:
            res = binance_sync.sync_binance_account(c.id, current_user.id, db)
            results.append({"broker": c.broker_name, "status": res["status"]})
        elif c.broker_name == "Interactive Brokers":
            res = ibkr_sync.sync_ibkr_account(c.id, current_user.id, db)
            results.append({"broker": c.broker_name, "status": res["status"]})
    
    return {"message": "Auto-sync pipeline completed", "details": results}

@router.get("/assets", response_model=List[schemas.AssetResponse])
def get_assets(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    # Join with BrokerCredential to get nicknames
    results = db.query(models.Asset, models.BrokerCredential.nickname).outerjoin(
        models.BrokerCredential, models.Asset.credential_id == models.BrokerCredential.id
    ).filter(models.Asset.user_id == current_user.id).all()
    
    assets_with_nicknames = []
    for asset, nickname in results:
        asset_resp = schemas.AssetResponse.from_orm(asset)
        asset_resp.account_nickname = nickname
        assets_with_nicknames.append(asset_resp)
        
    return assets_with_nicknames

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

@router.get("/transactions", response_model=List[schemas.TransactionResponse])
def get_transactions(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    """Return the last 100 trade history records for the current user, newest first."""
    results = (
        db.query(models.Transaction, models.BrokerCredential.nickname)
        .outerjoin(models.BrokerCredential, models.Transaction.credential_id == models.BrokerCredential.id)
        .filter(models.Transaction.user_id == current_user.id)
        .order_by(models.Transaction.timestamp.desc())
        .limit(100)
        .all()
    )
    
    txs_with_nicknames = []
    for tx, nickname in results:
        tx_resp = schemas.TransactionResponse.from_orm(tx)
        tx_resp.account_nickname = nickname
        txs_with_nicknames.append(tx_resp)
        
    return txs_with_nicknames

@router.get("/analytics/allocation")
def get_allocation(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency
):
    """Returns portfolio allocation grouped by asset class and sector."""
    assets = db.query(models.Asset).filter(models.Asset.user_id == current_user.id).all()
    
    asset_class_alloc = {}
    sector_alloc = {}
    
    from services.news_service import TICKER_MAP
    
    for a in assets:
        qty = float(a.quantity) if a.quantity else 0.0
        price = float(a.current_price) if a.current_price else 0.0
        value = qty * price
        
        if value <= 0:
            continue
            
        ac = a.asset_class or "Unknown"
        asset_class_alloc[ac] = asset_class_alloc.get(ac, 0) + value
        
        # Sector
        clean_symbol = a.symbol.replace('-USD', '').replace('=X', '')
        sector = TICKER_MAP.get(clean_symbol, "Other")
        if ac == "Crypto":
            sector = "Crypto"
            
        sector_alloc[sector] = sector_alloc.get(sector, 0) + value
        
    return {
        "by_asset_class": [{"name": k, "value": round(v, 2)} for k, v in asset_class_alloc.items()],
        "by_sector": [{"name": k, "value": round(v, 2)} for k, v in sector_alloc.items()]
    }

@router.get("/analytics/performance")
def get_performance(
    period: str, # e.g. "1mo", "3mo", "1y", "ytd"
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency,
    benchmark: str = "SPY"
):
    """
    Returns historical backcasted performance of the current portfolio vs. benchmark.
    """
    assets = db.query(models.Asset).filter(models.Asset.user_id == current_user.id).all()
    if not assets:
        return {"data": []}
        
    # Build list of tickers and their quantities
    portfolio = {}
    for a in assets:
        qty = float(a.quantity) if a.quantity else 0.0
        if qty > 0:
            portfolio[a.symbol] = portfolio.get(a.symbol, 0) + qty
            
    if not portfolio:
        return {"data": []}
        
    import yfinance as yf
    import pandas as pd
    
    symbols = list(portfolio.keys())
    # Ensure benchmark is fetched
    if benchmark not in symbols:
        symbols_to_fetch = symbols + [benchmark]
    else:
        symbols_to_fetch = symbols
        
    try:
        # download returns a DataFrame where columns are multi-index (Price, Ticker) if multiple tickers
        df = yf.download(symbols_to_fetch, period=period, progress=False)
        if df.empty:
            return {"data": []}
            
        # Extract 'Close' prices
        if "Close" in df.columns.levels[0] if isinstance(df.columns, pd.MultiIndex) else False:
             data = df["Close"]
        elif "Close" in df.columns:
             # Single ticker case
             data = pd.DataFrame(df["Close"])
             data.columns = symbols_to_fetch
        else:
             data = df
             
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical data: {str(e)}")
        
    if data.empty:
        return {"data": []}
        
    # Forward fill missing days, backward fill for start dates (weekends), then fillna with 0
    data = data.ffill().bfill().fillna(0)
    
    # Calculate daily portfolio value
    portfolio_value = pd.Series(0.0, index=data.index)
    for sym, qty in portfolio.items():
        if sym in data.columns:
            portfolio_value += data[sym] * qty
            
    benchmark_value = data[benchmark] if benchmark in data.columns else pd.Series(0.0, index=data.index)
    
    # Normalize benchmark to start at the same value as the portfolio
    if not portfolio_value.empty and not benchmark_value.empty and benchmark_value.iloc[0] > 0:
        multiplier = portfolio_value.iloc[0] / benchmark_value.iloc[0]
        benchmark_value = benchmark_value * multiplier
        
    # Build response
    result = []
    for date, p_val, b_val in zip(data.index, portfolio_value, benchmark_value):
        result.append({
            "date": date.strftime("%Y-%m-%d"),
            "portfolio": round(float(p_val), 2),
            "benchmark": round(float(b_val), 2)
        })
        
    return {"data": result}


# ─────────────────────────────────────────────────────────────────────────────
# Shared helpers for analytics endpoints
# ─────────────────────────────────────────────────────────────────────────────

def _extract_close(raw, symbols):
    """Return a DataFrame of Close prices with symbol names as columns."""
    import pandas as pd
    if isinstance(raw.columns, pd.MultiIndex):
        close = raw["Close"]
    else:
        # Single-ticker download returns flat columns
        close = raw[["Close"]].copy()
        close.columns = [symbols[0]] if len(symbols) == 1 else symbols[:1]
    return close


def _safe_float(v, fallback: float = 0.0) -> float:
    """Convert v to float, replacing NaN/±inf with fallback.

    Prevents 'Out of range float values are not JSON compliant' errors
    when pandas produces NaN from insufficient price data.
    """
    try:
        f = float(v)
        return fallback if not math.isfinite(f) else f
    except (TypeError, ValueError):
        return fallback


# ─────────────────────────────────────────────────────────────────────────────
# Heatmap — daily % price change per holding
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/analytics/heatmap")
def get_heatmap(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency,
    period: str = "1mo",
):
    """Daily % price change per holding — powers the performance heatmap."""
    assets = db.query(models.Asset).filter(models.Asset.user_id == current_user.id).all()
    if not assets:
        return {"data": [], "symbols": []}

    symbols = list({a.symbol for a in assets if float(a.quantity or 0) > 0})
    if not symbols:
        return {"data": [], "symbols": []}

    import yfinance as yf
    import pandas as pd

    try:
        raw = yf.download(symbols if len(symbols) > 1 else symbols[0], period=period, progress=False)
        if raw.empty:
            return {"data": [], "symbols": []}

        close = _extract_close(raw, symbols)
        available = [s for s in symbols if s in close.columns]
        if not available:
            return {"data": [], "symbols": []}

        close = close[available]
        # Drop assets with zero valid price history
        close = close.dropna(axis=1, how='all')
        available = [s for s in available if s in close.columns]
        
        close = close.ffill().bfill()

        # Cap to top-15 by current value to keep the grid readable
        if len(available) > 15:
            asset_values = {}
            for a in assets:
                sym = a.symbol
                val = float(a.quantity or 0) * float(a.current_price or a.average_buy_price or 0)
                asset_values[sym] = asset_values.get(sym, 0) + val
            available = sorted(available, key=lambda s: asset_values.get(s, 0), reverse=True)[:15]
            close = close[available]

        pct = (close.pct_change().dropna(how='all') * 100).clip(-15, 15)

        data = []
        for date, row in pct.iterrows():
            for sym in available:
                val = row.get(sym)
                if val is not None and pd.notna(val):
                    safe = _safe_float(val)
                    data.append({
                        "date": date.strftime("%Y-%m-%d"),
                        "symbol": sym,
                        "pct_change": round(safe, 2),
                    })

        return {"data": data, "symbols": available}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Heatmap fetch failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Risk-Return — annualised vol + return per position
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/analytics/risk-return")
def get_risk_return(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency,
    period: str = "3mo",
):
    """Annualised risk and return per holding — powers the scatter plot."""
    assets = db.query(models.Asset).filter(models.Asset.user_id == current_user.id).all()
    if not assets:
        return []

    portfolio: dict = {}
    for a in assets:
        qty = float(a.quantity or 0)
        if qty <= 0:
            continue
        sym = a.symbol
        if sym not in portfolio:
            portfolio[sym] = {
                "qty": 0.0,
                "avg_price": float(a.average_buy_price or 0),
                "current_price": float(a.current_price or 0),
            }
        portfolio[sym]["qty"] += qty

    if not portfolio:
        return []

    import yfinance as yf
    import pandas as pd

    symbols = list(portfolio.keys())
    try:
        raw = yf.download(symbols if len(symbols) > 1 else symbols[0], period=period, progress=False)
        if raw.empty:
            return []

        close = _extract_close(raw, symbols)
        close = close.dropna(axis=1, how='all')
        daily_ret = close.pct_change().dropna(how='all')

        result = []
        for sym, info in portfolio.items():
            if sym not in daily_ret.columns:
                continue
            ret = daily_ret[sym].dropna()
            if len(ret) < 5:
                continue

            ann_return = _safe_float(ret.mean() * 252 * 100)
            ann_vol    = _safe_float(ret.std()  * (252 ** 0.5) * 100)
            value      = _safe_float(info["qty"] * info["current_price"])
            pnl_pct    = _safe_float(
                (info["current_price"] - info["avg_price"]) / info["avg_price"] * 100
                if info["avg_price"] > 0 else 0.0
            )

            result.append({
                "symbol": sym,
                "annualized_return": round(ann_return, 2),
                "annualized_volatility": round(ann_vol, 2),
                "current_value": round(value, 2),
                "pnl_pct": round(pnl_pct, 2),
            })

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk-return fetch failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Correlation Matrix — pairwise Pearson return correlation
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/analytics/correlation")
def get_correlation(
    current_user: Annotated[models.User, Depends(get_current_user)],
    db: db_dependency,
    period: str = "3mo",
):
    """Pairwise return correlation matrix — powers the diversification view."""
    assets = db.query(models.Asset).filter(models.Asset.user_id == current_user.id).all()
    symbols = list({a.symbol for a in assets if float(a.quantity or 0) > 0})

    if len(symbols) < 2:
        return {"symbols": symbols, "matrix": []}

    import yfinance as yf
    import pandas as pd

    try:
        raw = yf.download(symbols, period=period, progress=False)
        if raw.empty:
            return {"symbols": symbols, "matrix": []}

        close = _extract_close(raw, symbols)
        available = [s for s in symbols if s in close.columns]

        if len(available) < 2:
            return {"symbols": available, "matrix": []}

        close = close[available].dropna(axis=1, how='all')
        available = [s for s in available if s in close.columns]
        
        if len(available) < 2:
            return {"symbols": available, "matrix": []}
            
        close = close.ffill().bfill()
        returns = close.pct_change().dropna(how='all')
        corr = returns.corr()

        matrix = [
            [round(_safe_float(corr.loc[r, c], fallback=0.0), 3) for c in available]
            for r in available
        ]

        return {"symbols": available, "matrix": matrix}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Correlation fetch failed: {e}")
