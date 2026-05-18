import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from celery_app import celery_app
import database
from services.news_service import ingest_articles

@celery_app.task(name="tasks.news_tasks.fetch_news")
def fetch_news():
    """
    Runs every 30 minutes (via Celery Beat).
    Fetches latest news from all configured RSS feeds.
    """
    db = database.SessionLocal()
    try:
        new_count = ingest_articles(db)
        return {"status": "success", "new_articles": new_count}
    except Exception as e:
        print(f"[news_tasks] Error fetching news: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()
