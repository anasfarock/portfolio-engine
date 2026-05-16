"""
Market Data Router
Provides REST API endpoints for real-time prices, batch quotes,
historical OHLCV data, watchlist, and bid-ask spread.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from services.market_data import (
    get_price,
    get_batch_quotes,
    fetch_historical_ohlcv,
    get_spread,
)

router = APIRouter(prefix="/market", tags=["market"])

# ─── Default watchlists shown on the Markets page ──────────────────────────
DEFAULT_WATCHLIST = {
    "stocks": [
        "AAPL", "MSFT", "NVDA", "AMZN", "GOOGL",
        "TSLA", "META", "JPM", "V", "WMT",
    ],
    "crypto": [
        "BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD",
        "XRP-USD", "ADA-USD", "DOGE-USD", "AVAX-USD",
    ],
    "forex": [
        "EURUSD=X", "GBPUSD=X", "USDJPY=X", "AUDUSD=X",
        "USDCAD=X", "USDCHF=X", "NZDUSD=X",
    ],
}


@router.get("/price/{symbol}")
def get_single_price(symbol: str):
    """
    Get the current price for a single symbol.
    Checks Redis cache first (TTL 15s), then falls back to yfinance.
    """
    data = get_price(symbol.upper())
    if not data:
        raise HTTPException(status_code=404, detail=f"Could not fetch price for {symbol.upper()}")
    return data


@router.get("/quotes")
def get_batch_prices(symbols: str = Query(..., description="Comma-separated list of symbols, e.g. AAPL,BTC-USD")):
    """
    Batch price fetch for multiple symbols.
    Used by the Markets page to load all watchlist quotes at once.
    """
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        raise HTTPException(status_code=400, detail="No symbols provided")
    if len(symbol_list) > 50:
        raise HTTPException(status_code=400, detail="Maximum 50 symbols per request")
    return get_batch_quotes(symbol_list)


@router.get("/history/{symbol}")
def get_historical_data(
    symbol: str,
    period: str = Query("1mo", description="Period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y"),
    interval: str = Query("1d", description="Interval: 1m, 5m, 15m, 1h, 1d, 1wk, 1mo"),
):
    """
    Fetch historical OHLCV candlestick data for charting.
    """
    valid_periods = {"1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "max"}
    valid_intervals = {"1m", "5m", "15m", "30m", "1h", "1d", "1wk", "1mo"}
    if period not in valid_periods:
        raise HTTPException(status_code=400, detail=f"Invalid period. Choose from: {valid_periods}")
    if interval not in valid_intervals:
        raise HTTPException(status_code=400, detail=f"Invalid interval. Choose from: {valid_intervals}")

    data = fetch_historical_ohlcv(symbol.upper(), period=period, interval=interval)
    if not data:
        raise HTTPException(status_code=404, detail=f"No historical data found for {symbol.upper()}")
    return {"symbol": symbol.upper(), "period": period, "interval": interval, "candles": data}


@router.get("/watchlist")
def get_watchlist(category: Optional[str] = Query(None, description="Filter by: stocks, crypto, forex")):
    """
    Returns the default pre-configured watchlist symbols.
    Optionally filter by category.
    """
    if category:
        category = category.lower()
        if category not in DEFAULT_WATCHLIST:
            raise HTTPException(status_code=400, detail=f"Invalid category. Choose from: stocks, crypto, forex")
        return {category: DEFAULT_WATCHLIST[category]}
    return DEFAULT_WATCHLIST


@router.get("/spread/{symbol}")
def get_bid_ask_spread(symbol: str):
    """
    Get the bid-ask spread for a symbol.
    """
    data = get_spread(symbol.upper())
    if not data:
        raise HTTPException(status_code=404, detail=f"Spread data not available for {symbol.upper()}")
    return data
