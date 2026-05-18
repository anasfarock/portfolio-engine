from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
import database
import models
from services.news_service import ingest_articles
from auth import get_current_user

router = APIRouter(prefix="/news", tags=["news"])

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("")
def get_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    ticker: Optional[str] = None,
    sector: Optional[str] = None,
    source: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get paginated news articles, optionally filtered.
    Public endpoint.
    """
    query = db.query(models.NewsArticle)
    
    if ticker:
        query = query.filter(models.NewsArticle.tickers.contains(ticker.upper()))
    if sector:
        query = query.filter(models.NewsArticle.sector == sector)
    if source:
        query = query.filter(models.NewsArticle.source == source)
        
    total = query.count()
    articles = query.order_by(desc(models.NewsArticle.published_at)).offset((page - 1) * limit).limit(limit).all()
    
    return {
        "data": articles,
        "page": page,
        "limit": limit,
        "total": total,
        "pages": (total + limit - 1) // limit
    }

@router.get("/sources")
def get_sources(db: Session = Depends(get_db)):
    """
    Get all unique sources currently in the database.
    """
    sources = db.query(models.NewsArticle.source).distinct().all()
    return [s[0] for s in sources if s[0]]

@router.post("/refresh")
def force_refresh_news(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Manually trigger a fetch of all RSS feeds.
    Requires authentication.
    """
    try:
        new_count = ingest_articles(db)
        return {"status": "success", "new_articles": new_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
