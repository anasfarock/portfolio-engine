"""
Celery Tasks: Market Data
Periodic background task to refresh the Redis price cache for all symbols
currently held in the database across all users.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from celery_app import celery_app
import database
import models
from services.market_data import fetch_price_yfinance, set_cached_price


@celery_app.task(name="tasks.market_tasks.refresh_price_cache")
def refresh_price_cache():
    """
    Runs every 15 seconds (via Celery Beat).
    Queries all unique symbols held by any user in the assets table,
    fetches a fresh price, and stores it in Redis.
    """
    db = database.SessionLocal()
    try:
        symbols = db.query(models.Asset.symbol).distinct().all()
        unique_symbols = list({row[0].upper() for row in symbols})

        refreshed = 0
        for sym in unique_symbols:
            data = fetch_price_yfinance(sym)
            if data:
                set_cached_price(sym, data)
                refreshed += 1

        print(f"[market_tasks] Refreshed {refreshed}/{len(unique_symbols)} symbols in Redis cache.")
        return {"refreshed": refreshed, "total": len(unique_symbols)}
    except Exception as e:
        print(f"[market_tasks] Error refreshing price cache: {e}")
        return {"error": str(e)}
    finally:
        db.close()
