"""
Market Data Service
Handles real-time price fetching with Redis caching and yfinance fallback.
Priority: Redis cache → Connected broker API → yfinance fallback
"""
import os
import json
import redis
import yfinance as yf
from datetime import datetime

# Redis client (shared instance)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
PRICE_TTL = 15  # seconds before a cached price expires

try:
    _redis = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1)
    _redis.ping()
    REDIS_AVAILABLE = True
    print("✅ Redis connected — price caching enabled")
except Exception:
    _redis = None
    REDIS_AVAILABLE = False
    # Redis is optional — the app works fine without it using yfinance directly


def _cache_key(symbol: str) -> str:
    return f"price:{symbol.upper()}"


def set_cached_price(symbol: str, data: dict):
    """Store price data in Redis with TTL."""
    if not REDIS_AVAILABLE:
        return
    try:
        _redis.setex(_cache_key(symbol), PRICE_TTL, json.dumps(data))
    except Exception as e:
        print(f"Redis write error for {symbol}: {e}")


def get_cached_price(symbol: str) -> dict | None:
    """Retrieve cached price from Redis. Returns None if not cached or expired."""
    if not REDIS_AVAILABLE:
        return None
    try:
        raw = _redis.get(_cache_key(symbol))
        return json.loads(raw) if raw else None
    except Exception as e:
        print(f"Redis read error for {symbol}: {e}")
        return None


def fetch_price_yfinance(symbol: str) -> dict | None:
    """
    Fetch live price from yfinance as a universal fallback.
    Works for stocks (AAPL), crypto (BTC-USD), forex (EURUSD=X).
    """
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = getattr(info, "last_price", None)
        prev_close = getattr(info, "previous_close", None)

        if price is None:
            return None

        change = price - prev_close if prev_close else 0.0
        change_pct = (change / prev_close * 100) if prev_close else 0.0

        return {
            "symbol": symbol.upper(),
            "price": round(float(price), 6),
            "change": round(float(change), 6),
            "change_pct": round(float(change_pct), 4),
            "prev_close": round(float(prev_close), 6) if prev_close else None,
            "source": "yfinance",
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        print(f"yfinance fetch error for {symbol}: {e}")
        return None


def get_price(symbol: str) -> dict | None:
    """
    Get a price for a symbol.
    Checks Redis cache first, then falls back to yfinance.
    """
    symbol = symbol.upper()

    # 1. Check Redis cache
    cached = get_cached_price(symbol)
    if cached:
        cached["from_cache"] = True
        return cached

    # 2. Fetch live from yfinance
    data = fetch_price_yfinance(symbol)
    if data:
        set_cached_price(symbol, data)
        data["from_cache"] = False
        return data

    return None


def get_batch_quotes(symbols: list[str]) -> list[dict]:
    """
    Fetch multiple symbols at once.
    Used by the Markets page to populate the full watchlist table.
    Returns results in order, skipping any that failed to fetch.
    """
    results = []
    uncached = []

    # Separate cached vs uncached
    for sym in symbols:
        cached = get_cached_price(sym)
        if cached:
            cached["from_cache"] = True
            results.append(cached)
        else:
            uncached.append(sym)

    # Batch-fetch uncached symbols from yfinance
    if uncached:
        try:
            joined = " ".join(uncached)
            tickers = yf.Tickers(joined)
            for sym in uncached:
                try:
                    info = tickers.tickers[sym].fast_info
                    price = getattr(info, "last_price", None)
                    prev_close = getattr(info, "previous_close", None)
                    if price is None:
                        continue
                    change = price - prev_close if prev_close else 0.0
                    change_pct = (change / prev_close * 100) if prev_close else 0.0
                    data = {
                        "symbol": sym.upper(),
                        "price": round(float(price), 6),
                        "change": round(float(change), 6),
                        "change_pct": round(float(change_pct), 4),
                        "prev_close": round(float(prev_close), 6) if prev_close else None,
                        "source": "yfinance",
                        "timestamp": datetime.utcnow().isoformat(),
                        "from_cache": False,
                    }
                    set_cached_price(sym, data)
                    results.append(data)
                except Exception as e:
                    print(f"Batch fetch error for {sym}: {e}")
        except Exception as e:
            print(f"yfinance batch fetch error: {e}")
            # Fallback: fetch individually
            for sym in uncached:
                data = fetch_price_yfinance(sym)
                if data:
                    data["from_cache"] = False
                    set_cached_price(sym, data)
                    results.append(data)

    # Sort results to match original symbol order
    order = {s.upper(): i for i, s in enumerate(symbols)}
    results.sort(key=lambda x: order.get(x["symbol"], 999))
    return results


def fetch_historical_ohlcv(symbol: str, period: str = "1mo", interval: str = "1d") -> list[dict]:
    """
    Fetch historical OHLCV data for charting.
    period: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max
    interval: 1m, 5m, 15m, 1h, 1d, 1wk, 1mo
    """
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period, interval=interval)
        if hist.empty:
            return []
        records = []
        for ts, row in hist.iterrows():
            records.append({
                "time": ts.isoformat(),
                "open": round(float(row["Open"]), 6),
                "high": round(float(row["High"]), 6),
                "low": round(float(row["Low"]), 6),
                "close": round(float(row["Close"]), 6),
                "volume": int(row.get("Volume", 0)),
            })
        return records
    except Exception as e:
        print(f"Historical OHLCV fetch error for {symbol}: {e}")
        return []


def get_spread(symbol: str) -> dict | None:
    """Attempt to retrieve bid-ask spread from yfinance info."""
    try:
        info = yf.Ticker(symbol).info
        bid = info.get("bid")
        ask = info.get("ask")
        if bid and ask:
            return {
                "symbol": symbol.upper(),
                "bid": bid,
                "ask": ask,
                "spread": round(ask - bid, 6),
                "spread_pct": round((ask - bid) / ask * 100, 4) if ask else None,
            }
        return None
    except Exception as e:
        print(f"Spread fetch error for {symbol}: {e}")
        return None
