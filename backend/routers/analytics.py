"""
Analytics Router
Exposes REST endpoints for the Sentiment Analysis Module, Technical Analysis Module,
and Financial Analysis Engine, plus a 3-in-1 executive overview synthesis.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import json
import database
from auth import get_current_user
import models
from services.market_data import _redis, REDIS_AVAILABLE
from services.sentiment_service import (
    get_sentiment_summary,
    get_holding_sentiment,
    analyze_unprocessed_news
)
from services.technical_service import analyze_symbol_technical
from services.financial_service import (
    analyze_symbol_financial,
    get_sector_peers_comparison
)

OVERVIEW_CACHE_PREFIX = "analytics:overview:"
OVERVIEW_CACHE_TTL = 90  # 90 seconds cache

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)


def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -------------------------------------------------------------
# 1. Sentiment Analysis Endpoints
# -------------------------------------------------------------
@router.get("/sentiment")
def get_market_sentiment(refresh: bool = False, db: Session = Depends(get_db)):
    """
    Returns general market sentiment score (0-100), bullish/bearish counts,
    top identified catalysts, and recent analyzed news feed.
    """
    return get_sentiment_summary(db, force_refresh=refresh)


@router.get("/sentiment/{symbol}")
def get_symbol_sentiment(symbol: str, refresh: bool = False, db: Session = Depends(get_db)):
    """
    Returns sentiment score and specific catalysts for a target stock or crypto ticker.
    """
    return get_holding_sentiment(symbol, db, force_refresh=refresh)


@router.post("/sentiment/process")
def trigger_sentiment_processing(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Manually triggers batch sentiment processing of pending news articles.
    """
    count = analyze_unprocessed_news(db, batch_size=10, limit=40)
    return {"status": "success", "processed_articles": count}


# -------------------------------------------------------------
# 2. Technical Analysis Endpoints
# -------------------------------------------------------------
@router.get("/technical/{symbol}")
def get_technical_analysis(symbol: str, refresh: bool = False):
    """
    Computes 14-day RSI, MACD, Bollinger Bands, Moving Averages (SMA/EMA),
    momentum ROC, trend classification, and 0-100 technical strength score.
    """
    data = analyze_symbol_technical(symbol, force_refresh=refresh)
    if "error" in data and "Insufficient" in data["error"]:
        raise HTTPException(status_code=404, detail=data["error"])
    return data


# -------------------------------------------------------------
# 3. Financial Analysis Endpoints
# -------------------------------------------------------------
@router.get("/financial/{symbol}")
def get_financial_analysis(symbol: str, refresh: bool = False):
    """
    Evaluates valuation ratios (P/E, P/B, EV/EBITDA), profitability (ROE, margins),
    growth rates, balance sheet health, and letter grade (A-F).
    """
    data = analyze_symbol_financial(symbol, force_refresh=refresh)
    if "error" in data and not data.get("is_equity"):
        # Return gracefully with error notice
        return data
    return data


@router.get("/peers/{symbol}")
def get_peer_comparison(symbol: str, refresh: bool = False):
    """
    Ranks the target ticker against sector peers across P/E, profit margins, and ROE.
    """
    return get_sector_peers_comparison(symbol, force_refresh=refresh)


# -------------------------------------------------------------
# 4. Unified 3-in-1 Executive Overview
# -------------------------------------------------------------
@router.get("/overview/{symbol}")
def get_unified_overview(symbol: str, refresh: bool = False, db: Session = Depends(get_db)):
    """
    Synthesizes Sentiment, Technical, and Financial analyses into a single 360-degree
    intelligence card with an executive composite recommendation.
    Cached in Redis for high-speed instant switching.
    """
    sym = symbol.strip().upper()
    cache_key = f"{OVERVIEW_CACHE_PREFIX}{sym}"

    # Check Redis cache for instant sub-millisecond retrieval
    if REDIS_AVAILABLE and not refresh:
        try:
            cached = _redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    tech = analyze_symbol_technical(sym, force_refresh=refresh)
    fin = analyze_symbol_financial(sym, force_refresh=refresh)
    sent = get_holding_sentiment(sym, db, force_refresh=refresh)

    tech_score = tech.get("score", 50.0) if "error" not in tech else 50.0
    fin_score = fin.get("health_score", 50.0)
    sent_score = sent.get("score", 50.0)

    # Weighted composite score:
    # 40% Technical + 40% Financial + 20% Sentiment
    composite_score = round((tech_score * 0.40) + (fin_score * 0.40) + (sent_score * 0.20), 1)

    if composite_score >= 78.0:
        recommendation = "Strong Buy"
        rec_color = "emerald"
    elif composite_score >= 62.0:
        recommendation = "Buy"
        rec_color = "green"
    elif composite_score <= 32.0:
        recommendation = "Strong Sell"
        rec_color = "rose"
    elif composite_score <= 44.0:
        recommendation = "Sell"
        rec_color = "amber"
    else:
        recommendation = "Hold / Neutral"
        rec_color = "blue"

    result = {
        "symbol": sym,
        "name": fin.get("name", sym),
        "current_price": tech.get("current_price") or fin.get("current_price"),
        "composite_score": composite_score,
        "recommendation": recommendation,
        "recommendation_color": rec_color,
        "technical": {
            "score": tech_score,
            "signal": tech.get("signal", "Neutral"),
            "rsi": tech.get("rsi", {}).get("value"),
            "rsi_condition": tech.get("rsi", {}).get("condition", "Neutral"),
            "trend": tech.get("trend", {}).get("label", "Neutral"),
            "macd_crossover": tech.get("macd", {}).get("crossover", "Neutral"),
            "support": tech.get("key_levels", {}).get("support"),
            "resistance": tech.get("key_levels", {}).get("resistance"),
        },
        "financial": {
            "score": fin_score,
            "grade": fin.get("health_grade", "N/A"),
            "pe_ratio": fin.get("valuation", {}).get("trailing_pe"),
            "roe": fin.get("profitability", {}).get("roe"),
            "net_margin": fin.get("profitability", {}).get("net_margin"),
            "debt_to_equity": fin.get("balance_sheet", {}).get("debt_to_equity"),
            "sector": fin.get("sector"),
            "industry": fin.get("industry"),
            "is_equity": fin.get("is_equity", True),
        },
        "sentiment": {
            "score": sent_score,
            "label": sent.get("label", "Neutral"),
            "catalysts": sent.get("catalysts", [])
        }
    }

    if REDIS_AVAILABLE:
        try:
            _redis.setex(cache_key, OVERVIEW_CACHE_TTL, json.dumps(result))
        except Exception:
            pass

    return result
