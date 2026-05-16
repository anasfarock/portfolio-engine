from celery import Celery
import os

BROKER = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

celery_app = Celery(
    "spaie_worker",
    broker=BROKER,
    backend=BACKEND,
    include=["tasks.market_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "refresh-price-cache-every-15s": {
            "task": "tasks.market_tasks.refresh_price_cache",
            "schedule": 15.0,  # every 15 seconds
        },
    },
)
