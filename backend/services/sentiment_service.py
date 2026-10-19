"""
Sentiment Analysis Service
Extracts sentiment and market catalysts from financial news using local Ollama (Mistral 7B 4-bit Q4)
with an intelligent financial NLP fallback when Ollama is offline.
Optimized for 8GB VRAM GPUs (e.g. RTX 2070) with batch processing.
"""
import os
import json
import re
import requests
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import desc
import models

# Ollama Configuration
OLLAMA_HOST = os.getenv("OLLAMA_BASE_URL")
if not OLLAMA_HOST:
    # In Docker on Windows/Mac, host.docker.internal reaches the host machine Ollama instance
    OLLAMA_HOST = "http://host.docker.internal:11434"

# 4-bit quantized Mistral 7B (standard 'mistral' or 'mistral:7b-instruct-q4_K_M' ~4.1GB VRAM)
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")

# Known market catalyst keyword patterns for classification
CATALYST_PATTERNS = {
    "Earnings & Revenue": [
        r"\bearnings\b", r"\brevenue\b", r"\bprofit\b", r"\beps\b", r"\bebitda\b",
        r"\bbeat estimates\b", r"\bmissed estimates\b", r"\bguidance\b", r"\bquarterly results\b"
    ],
    "Mergers & Acquisitions": [
        r"\bacquisition\b", r"\bacquire\b", r"\bmerger\b", r"\btakeover\b", r"\bbuyout\b", r"\bdeal\b"
    ],
    "Regulatory & Legal": [
        r"\bsec\b", r"\bfda approval\b", r"\blawsuit\b", r"\bregulation\b", r"\bantitrust\b",
        r"\bfine\b", r"\binvestigation\b", r"\bcompliance\b", r"\bban\b"
    ],
    "Macroeconomic & Fed": [
        r"\bfed\b", r"\binterest rates?\b", r"\binflation\b", r"\bcpi\b", r"\bgdp\b",
        r"\brecession\b", r"\brate cut\b", r"\brate hike\b", r"\byield\b"
    ],
    "Product & Innovation": [
        r"\blaunch\b", r"\bpatent\b", r"\bnew product\b", r"\bai\b", r"\bchip\b", r"\bupgrade\b",
        r"\bpartnership\b", r"\bcontract\b", r"\bbreakthrough\b"
    ],
    "Management & Insider": [
        r"\bceo\b", r"\bexecutive\b", r"\binsider buying\b", r"\bresign\b", r"\bappoint\b",
        r"\blayoffs?\b", r"\brestructuring\b"
    ],
    "Crypto & Market Dynamics": [
        r"\bhalving\b", r"\betf\b", r"\bliquidation\b", r"\bwhale\b", r"\bstaking\b",
        r"\bhashrate\b", r"\bshort squeeze\b", r"\bbreakout\b"
    ]
}

# Financial lexicon sentiment weights (Loughran-McDonald inspired)
BULLISH_KEYWORDS = {
    "surge": 15, "surges": 15, "surging": 15, "soar": 15, "soars": 15, "rally": 15, "rallies": 15,
    "jump": 10, "jumps": 10, "gain": 10, "gains": 10, "bull": 10, "bullish": 12, "outperform": 15,
    "beat": 12, "beats": 12, "record": 10, "high": 8, "growth": 10, "profit": 10, "upgrade": 15,
    "dividend": 8, "positive": 10, "breakthrough": 12, "approval": 12, "expand": 8, "strong": 10,
    "revenue": 5, "buy": 10, "optimism": 10, "rebound": 12, "soaring": 15, "stellar": 15
}

BEARISH_KEYWORDS = {
    "plunge": 15, "plunges": 15, "plunging": 15, "slump": 15, "slumps": 15, "crash": 20, "crashes": 20,
    "drop": 10, "drops": 10, "fall": 10, "falls": 10, "bear": 10, "bearish": 12, "underperform": 15,
    "miss": 12, "misses": 12, "loss": 12, "losses": 12, "low": 8, "decline": 10, "downgrade": 15,
    "cut": 10, "cuts": 10, "warning": 12, "fraud": 20, "lawsuit": 12, "investigation": 15,
    "inflation": 8, "recession": 15, "layoffs": 12, "weak": 10, "selloff": 15, "deficit": 10
}


def is_ollama_available() -> bool:
    """Quick health check to determine if local Ollama daemon is reachable."""
    try:
        res = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=1.5)
        return res.status_code == 200
    except Exception:
        # Fallback check on localhost:11434 if host.docker.internal failed
        try:
            res = requests.get("http://localhost:11434/api/tags", timeout=1.0)
            return res.status_code == 200
        except Exception:
            return False


def _nlp_extract_catalysts(text: str) -> list[str]:
    """Classifies catalysts from article text using regex pattern matching."""
    detected = []
    text_lower = text.lower()
    for category, patterns in CATALYST_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, text_lower):
                detected.append(category)
                break
    return detected if detected else ["General Market Movement"]


def _nlp_fallback_score(title: str, summary: str | None) -> dict:
    """
    High-accuracy deterministic financial lexicon scoring (0 to 100)
    used when local Ollama LLM is offline or uninstalled.
    """
    full_text = f"{title} {summary or ''}".lower()
    words = re.findall(r"\b[a-z]+\b", full_text)

    bull_score = sum(BULLISH_KEYWORDS.get(w, 0) for w in words)
    bear_score = sum(BEARISH_KEYWORDS.get(w, 0) for w in words)

    # Base neutral is 50.0
    net = bull_score - bear_score
    raw_score = 50.0 + (net * 2.5)
    normalized_score = max(5.0, min(95.0, raw_score))

    if normalized_score >= 58.0:
        label = "Bullish"
    elif normalized_score <= 42.0:
        label = "Bearish"
    else:
        label = "Neutral"

    catalysts = _nlp_extract_catalysts(full_text)
    reasoning = (
        f"Keyword balance indicated {label.lower()} sentiment (Bullish signals: {bull_score}, Bearish signals: {bear_score})."
    )

    return {
        "score": round(normalized_score, 1),
        "label": label,
        "catalysts": catalysts,
        "reasoning": reasoning
    }


def _ollama_batch_analyze(articles: list[models.NewsArticle]) -> list[dict]:
    """
    Processes articles in a batch using Ollama (Mistral 7B quantized).
    Returns list of dicts with score, label, catalysts, reasoning.
    """
    items_prompt = []
    for idx, art in enumerate(articles):
        items_prompt.append(
            f"Article {idx + 1} (ID: {art.id}):\n"
            f"Title: {art.title}\n"
            f"Summary: {art.summary[:250] if art.summary else 'N/A'}\n"
        )

    prompt = (
        "You are an expert financial sentiment analyst. Analyze the following news articles.\n"
        "For each article, score sentiment from 0 (extreme panic/bearish) to 100 (extreme euphoria/bullish) where 50 is neutral.\n"
        "Identify key market catalysts (e.g. Earnings, Interest Rates, M&A, FDA, Lawsuit, AI Innovation).\n"
        "Return ONLY a valid JSON array matching this exact schema for all articles:\n"
        "[\n"
        "  {\n"
        "    \"id\": <article_id>,\n"
        "    \"score\": <integer 0-100>,\n"
        "    \"label\": \"Bullish\" | \"Bearish\" | \"Neutral\",\n"
        "    \"catalysts\": [\"<catalyst1>\", \"<catalyst2>\"],\n"
        "    \"reasoning\": \"<1 concise sentence>\"\n"
        "  }\n"
        "]\n\n"
        f"{''.join(items_prompt)}\n"
        "JSON output:"
    )

    try:
        res = requests.post(
            f"{OLLAMA_HOST}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json",
                "options": {
                    "temperature": 0.1,
                    "top_p": 0.9,
                    "num_ctx": 2048
                }
            },
            timeout=30
        )
        if res.status_code == 200:
            data = res.json()
            raw_response = data.get("response", "")
            parsed = json.loads(raw_response)
            if isinstance(parsed, list):
                return parsed
    except Exception as e:
        print(f"[sentiment_service] Ollama batch call failed, using NLP fallback: {e}")

    # Fallback if Ollama response parsing failed
    return [_nlp_fallback_score(a.title, a.summary) for a in articles]


def analyze_unprocessed_news(db: Session, batch_size: int = 10, limit: int = 40) -> int:
    """
    Pulls unanalyzed news articles from DB and processes them in batches.
    Updates sentiment_score, sentiment_label, catalysts, and reasoning.
    """
    unprocessed = (
        db.query(models.NewsArticle)
        .filter(models.NewsArticle.sentiment_score == None)
        .order_by(desc(models.NewsArticle.published_at))
        .limit(limit)
        .all()
    )

    if not unprocessed:
        return 0

    ollama_ready = is_ollama_available()
    processed_count = 0

    # Process in groups of batch_size
    for i in range(0, len(unprocessed), batch_size):
        chunk = unprocessed[i:i + batch_size]
        if ollama_ready:
            results = _ollama_batch_analyze(chunk)
            # Map results by id if returned
            result_map = {r.get("id"): r for r in results if isinstance(r, dict)}
            for art in chunk:
                r = result_map.get(art.id) or _nlp_fallback_score(art.title, art.summary)
                art.sentiment_score = float(r.get("score", 50.0))
                art.sentiment_label = r.get("label", "Neutral")
                art.catalysts = json.dumps(r.get("catalysts", ["General Market"]))
                art.sentiment_reasoning = r.get("reasoning", "")
                art.sentiment_analyzed_at = datetime.now(timezone.utc)
                processed_count += 1
        else:
            for art in chunk:
                r = _nlp_fallback_score(art.title, art.summary)
                art.sentiment_score = float(r.get("score", 50.0))
                art.sentiment_label = r.get("label", "Neutral")
                art.catalysts = json.dumps(r.get("catalysts", ["General Market"]))
                art.sentiment_reasoning = r.get("reasoning", "")
                art.sentiment_analyzed_at = datetime.now(timezone.utc)
                processed_count += 1

    db.commit()
    return processed_count


def get_sentiment_summary(db: Session) -> dict:
    """
    Returns aggregate sentiment statistics across all analyzed articles.
    """
    # Ensure at least recent articles have sentiment
    analyze_unprocessed_news(db, batch_size=10, limit=30)

    articles = (
        db.query(models.NewsArticle)
        .filter(models.NewsArticle.sentiment_score != None)
        .order_by(desc(models.NewsArticle.published_at))
        .limit(60)
        .all()
    )

    if not articles:
        return {
            "average_score": 50.0,
            "overall_label": "Neutral",
            "bullish_count": 0,
            "bearish_count": 0,
            "neutral_count": 0,
            "top_catalysts": [],
            "recent_articles": [],
            "ollama_active": is_ollama_available(),
            "model": OLLAMA_MODEL
        }

    scores = [a.sentiment_score for a in articles]
    avg_score = round(sum(scores) / len(scores), 1)

    bullish_count = sum(1 for a in articles if a.sentiment_score >= 58.0)
    bearish_count = sum(1 for a in articles if a.sentiment_score <= 42.0)
    neutral_count = len(articles) - bullish_count - bearish_count

    if avg_score >= 58.0:
        overall_label = "Bullish"
    elif avg_score <= 42.0:
        overall_label = "Bearish"
    else:
        overall_label = "Neutral"

    # Aggregate catalysts
    catalyst_freq: dict[str, int] = {}
    for a in articles:
        if a.catalysts:
            try:
                cats = json.loads(a.catalysts)
                for c in cats:
                    catalyst_freq[c] = catalyst_freq.get(c, 0) + 1
            except Exception:
                pass

    sorted_catalysts = sorted(
        [{"name": k, "count": v} for k, v in catalyst_freq.items()],
        key=lambda x: x["count"],
        reverse=True
    )[:8]

    recent_feed = [
        {
            "id": a.id,
            "title": a.title,
            "source": a.source,
            "url": a.url,
            "published_at": a.published_at.isoformat() if a.published_at else None,
            "tickers": a.tickers.split(",") if a.tickers else [],
            "score": round(a.sentiment_score or 50.0, 1),
            "label": a.sentiment_label or "Neutral",
            "catalysts": json.loads(a.catalysts) if a.catalysts else [],
            "reasoning": a.sentiment_reasoning or ""
        }
        for a in articles[:15]
    ]

    return {
        "average_score": avg_score,
        "overall_label": overall_label,
        "bullish_count": bullish_count,
        "bearish_count": bearish_count,
        "neutral_count": neutral_count,
        "top_catalysts": sorted_catalysts,
        "recent_articles": recent_feed,
        "ollama_active": is_ollama_available(),
        "model": OLLAMA_MODEL
    }


def get_holding_sentiment(symbol: str, db: Session) -> dict:
    """
    Returns specific sentiment and catalysts tagged for an individual stock/crypto ticker.
    """
    clean_sym = symbol.upper().replace("-USD", "")
    articles = (
        db.query(models.NewsArticle)
        .filter(models.NewsArticle.tickers.contains(clean_sym))
        .order_by(desc(models.NewsArticle.published_at))
        .limit(10)
        .all()
    )

    if not articles:
        return {
            "symbol": symbol,
            "score": 50.0,
            "label": "Neutral",
            "article_count": 0,
            "catalysts": ["No direct ticker headlines"],
            "recent_headlines": []
        }

    scores = [a.sentiment_score for a in articles if a.sentiment_score is not None]
    if not scores:
        # Score them now
        for a in articles:
            r = _nlp_fallback_score(a.title, a.summary)
            a.sentiment_score = r["score"]
            a.sentiment_label = r["label"]
            a.catalysts = json.dumps(r["catalysts"])
            a.sentiment_reasoning = r["reasoning"]
            a.sentiment_analyzed_at = datetime.now(timezone.utc)
        db.commit()
        scores = [a.sentiment_score for a in articles if a.sentiment_score is not None]

    avg_score = round(sum(scores) / len(scores), 1) if scores else 50.0
    label = "Bullish" if avg_score >= 58.0 else ("Bearish" if avg_score <= 42.0 else "Neutral")

    holding_catalysts = set()
    headlines = []
    for a in articles:
        if a.catalysts:
            try:
                for c in json.loads(a.catalysts):
                    holding_catalysts.add(c)
            except Exception:
                pass
        headlines.append({
            "title": a.title,
            "source": a.source,
            "score": round(a.sentiment_score or 50.0, 1),
            "label": a.sentiment_label or "Neutral",
            "url": a.url
        })

    return {
        "symbol": symbol,
        "score": avg_score,
        "label": label,
        "article_count": len(articles),
        "catalysts": list(holding_catalysts)[:5],
        "recent_headlines": headlines[:5]
    }
