from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
import urllib.request
import xml.etree.ElementTree as ET
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

import time

CALENDAR_CACHE = {
    "data": None,
    "last_fetched": 0
}
CACHE_TTL = 3600  # 1 hour

@router.get("/calendar")
def get_economic_calendar():
    """
    Fetch the weekly macroeconomic calendar from ForexFactory XML API.
    Uses in-memory caching to avoid rate limits (429 Too Many Requests).
    """
    current_time = time.time()
    
    # Return cached data if valid
    if CALENDAR_CACHE["data"] is not None and (current_time - CALENDAR_CACHE["last_fetched"]) < CACHE_TTL:
        return CALENDAR_CACHE["data"]

    url = 'https://nfs.faireconomy.media/ff_calendar_thisweek.xml'
    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        })
        xml_data = urllib.request.urlopen(req).read()
        root = ET.fromstring(xml_data)
        
        events = []
        for idx, event in enumerate(root.findall('event')):
            title = event.find('title').text if event.find('title') is not None else ''
            country = event.find('country').text if event.find('country') is not None else ''
            date_str = event.find('date').text if event.find('date') is not None else ''
            time_str = event.find('time').text if event.find('time') is not None else ''
            impact = event.find('impact').text if event.find('impact') is not None else ''
            forecast = event.find('forecast').text if event.find('forecast') is not None else ''
            actual = event.find('actual').text if event.find('actual') is not None else ''
            previous = event.find('previous').text if event.find('previous') is not None else ''
            
            event_id = f"evt_{idx}_{date_str}_{time_str}".replace('-', '_').replace(':', '')
            
            events.append({
                "id": event_id,
                "title": title.strip() if title else '',
                "country": country.strip() if country else '',
                "date": date_str.strip() if date_str else '',
                "time": time_str.strip() if time_str else '',
                "impact": impact.strip() if impact else '',
                "forecast": forecast.strip() if forecast else '',
                "actual": actual.strip() if actual else '',
                "previous": previous.strip() if previous else ''
            })
            
        CALENDAR_CACHE["data"] = events
        CALENDAR_CACHE["last_fetched"] = current_time
        return events
        
    except urllib.error.HTTPError as e:
        if e.code == 429:
            # If we are rate limited but have stale data, return it
            if CALENDAR_CACHE["data"] is not None:
                return CALENDAR_CACHE["data"]
            # Otherwise return empty with 429 status
            raise HTTPException(status_code=429, detail="API rate limit exceeded. Please try again later.")
        raise HTTPException(status_code=500, detail=f"Failed to fetch calendar: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch economic calendar: {str(e)}")
