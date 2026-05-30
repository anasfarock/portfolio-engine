import feedparser
import hashlib
from datetime import datetime
from bs4 import BeautifulSoup
import re
from sqlalchemy.orm import Session
import concurrent.futures

from models import NewsArticle

# Free RSS Feeds
RSS_SOURCES = {
    "Yahoo Finance": "https://finance.yahoo.com/news/rssindex",
    "CoinDesk": "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "CoinTelegraph": "https://cointelegraph.com/rss",
    "CNBC Top News": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
    "CNBC Investing": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839069",
    "Investing.com": "https://www.investing.com/rss/news_25.rss",
    "Investing.com Crypto": "https://www.investing.com/rss/news_301.rss",
    "Wall Street Journal": "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "NYT Business": "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml",
    "Financial Times": "https://www.ft.com/?format=rss",
    "MarketWatch": "http://feeds.marketwatch.com/marketwatch/topstories/",
    "Fox Business": "https://moxie.foxbusiness.com/google-publisher/latest.xml",
}

TICKER_MAP = {
    "AAPL": "Technology", "MSFT": "Technology", "NVDA": "Technology", 
    "AMZN": "Consumer", "GOOGL": "Technology", "TSLA": "Automotive", 
    "META": "Technology", "JPM": "Financial", "V": "Financial", 
    "WMT": "Retail", 
    
    # Base Crypto
    "BTC": "Crypto", "ETH": "Crypto", "SOL": "Crypto", "DOGE": "Crypto", "XRP": "Crypto",
    
    # Crypto Pairs
    "BTC-USD": "Crypto", "ETH-USD": "Crypto", "SOL-USD": "Crypto", 
    "BTC/USD": "Crypto", "ETH/USD": "Crypto", "SOL/USD": "Crypto",
    
    # Forex Pairs
    "EUR/USD": "Forex", "GBP/USD": "Forex", "USD/JPY": "Forex", 
    "AUD/USD": "Forex", "USD/CAD": "Forex", "USD/CHF": "Forex", "NZD/USD": "Forex",
    "EURUSD=X": "Forex", "GBPUSD=X": "Forex", "USDJPY=X": "Forex",
    "AUDUSD=X": "Forex", "USDCAD=X": "Forex", "USDCHF=X": "Forex", "NZDUSD=X": "Forex",
}

def clean_html(text: str) -> str:
    if not text:
        return ""
    soup = BeautifulSoup(text, "html.parser")
    return soup.get_text(separator=" ", strip=True)

def extract_tickers(text: str) -> list[str]:
    found = set()
    text_upper = text.upper()
    
    for ticker in TICKER_MAP.keys():
        escaped_ticker = re.escape(ticker)
        # Use negative lookarounds to match the ticker as a distinct "word"
        # Since tickers contain symbols like '-' or '=', \b is unreliable.
        pattern = r'(?<![A-Z0-9])' + escaped_ticker + r'(?![A-Z0-9])'
        
        if re.search(pattern, text_upper):
            # Normalize variations into a single display format
            if ticker == "BTC/USD": found.add("BTC-USD")
            elif ticker == "ETH/USD": found.add("ETH-USD")
            elif ticker == "SOL/USD": found.add("SOL-USD")
            elif ticker == "EURUSD=X": found.add("EUR/USD")
            elif ticker == "GBPUSD=X": found.add("GBP/USD")
            elif ticker == "USDJPY=X": found.add("USD/JPY")
            elif ticker == "AUDUSD=X": found.add("AUD/USD")
            elif ticker == "USDCAD=X": found.add("USD/CAD")
            elif ticker == "USDCHF=X": found.add("USD/CHF")
            elif ticker == "NZDUSD=X": found.add("NZD/USD")
            else: found.add(ticker)
            
    # Dynamically find exchange-prefixed tickers (e.g., NASDAQ: TSLA)
    exchange_matches = re.findall(r'(?:NYSE|NASDAQ|AMEX|BATS)[^A-Z0-9]*([A-Z]{1,5})\b', text_upper)
    for match in exchange_matches:
        found.add(match)
        
    # Dynamically find Forex/Crypto pairs (e.g., USD/JPY, BTC/USDT)
    pair_matches = re.findall(r'\b([A-Z]{3,5}/[A-Z]{3,5})\b', text_upper)
    for match in pair_matches:
        found.add(match)
        
    # Match Common Market Indices
    if "S&P 500" in text_upper or "S&P500" in text_upper:
        found.add("SPX")
    if "DOW JONES" in text_upper or "DJIA" in text_upper:
        found.add("DJI")
    if "NASDAQ COMPOSITE" in text_upper or "NASDAQ 100" in text_upper:
        found.add("NDX")
    if "VIX" in text_upper:
        found.add("VIX")
    
    return list(found)

def infer_sector(tickers: list[str]) -> str | None:
    if not tickers:
        return "Macro"
    
    sectors = [TICKER_MAP.get(t) for t in tickers if TICKER_MAP.get(t)]
    if not sectors:
        return "General"
    
    # Return most common sector
    return max(set(sectors), key=sectors.count)

def fetch_feed(source_name: str, url: str) -> list[dict]:
    articles = []
    try:
        feed = feedparser.parse(url)
        for entry in feed.entries[:20]:  # Limit to top 20 per feed
            link = entry.get("link", "")
            if not link:
                continue
                
            url_hash = hashlib.sha256(link.encode()).hexdigest()
            title = clean_html(entry.get("title", ""))
            summary = clean_html(entry.get("summary", ""))
            
            # published date parsing
            pub_date = datetime.utcnow()
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                pub_date = datetime(*entry.published_parsed[:6])
                
            # image extraction
            image_url = None
            if "media_content" in entry and len(entry.media_content) > 0:
                image_url = entry.media_content[0].get("url")
            
            tickers = extract_tickers(title + " " + summary)
            sector = infer_sector(tickers)
            if "crypto" in url.lower() or "coin" in source_name.lower():
                sector = "Crypto"
                
            articles.append({
                "url_hash": url_hash,
                "title": title,
                "summary": summary[:500], # truncate
                "source": source_name,
                "url": link,
                "image_url": image_url,
                "published_at": pub_date,
                "tickers": ",".join(tickers) if tickers else None,
                "sector": sector,
            })
    except Exception as e:
        print(f"Failed to fetch {source_name}: {e}")
        
    return articles

def ingest_articles(db: Session):
    all_articles = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_source = {executor.submit(fetch_feed, name, url): name for name, url in RSS_SOURCES.items()}
        for future in concurrent.futures.as_completed(future_to_source):
            all_articles.extend(future.result())
            
    print(f"Fetched {len(all_articles)} total articles from feeds.")
    
    # Deduplicate in-memory first to avoid IntegrityError on commit
    unique_articles = {}
    for data in all_articles:
        unique_articles[data["url_hash"]] = data
        
    new_count = 0
    for url_hash, data in unique_articles.items():
        exists = db.query(NewsArticle).filter(NewsArticle.url_hash == url_hash).first()
        if not exists:
            article = NewsArticle(**data)
            db.add(article)
            new_count += 1
            
    db.commit()
    print(f"Inserted {new_count} new articles into the database.")
    return new_count
