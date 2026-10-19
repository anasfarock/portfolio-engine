"""
Financial Analysis Engine
Evaluates valuation ratios, profitability metrics, revenue/earnings growth,
balance sheet solvency health, and peer comparison ranking across sector peers.
Uses yfinance fundamentals with Redis caching.
"""
import json
import yfinance as yf
from services.market_data import _redis, REDIS_AVAILABLE

CACHE_PREFIX = "fin_analysis:"
PEERS_CACHE_PREFIX = "fin_peers:"
CACHE_TTL = 3600  # 1 hour fundamental caching

# Representative sector peers for standard stock tickers
SECTOR_PEERS_MAP = {
    "Technology": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ORCL", "CRM", "AMD"],
    "Financial Services": ["JPM", "BAC", "WFC", "C", "GS", "MS", "V", "MA", "AXP", "BLK"],
    "Healthcare": ["JNJ", "UNH", "PFE", "ABBV", "MRK", "TMO", "ABT", "LLY", "DHR", "BMY"],
    "Consumer Cyclical": ["AMZN", "TSLA", "HD", "MCD", "NKE", "SBUX", "TJX", "TGT", "LOW", "BKNG"],
    "Communication Services": ["GOOGL", "META", "DIS", "NFLX", "CMCSA", "T", "VZ", "TMUS"],
    "Energy": ["XOM", "CVX", "COP", "SLB", "EOG", "OXY", "MPC", "PSX", "VLO"],
    "Consumer Defensive": ["PG", "KO", "PEP", "COST", "WMT", "PM", "MDLZ", "CL", "KMB"],
    "Industrials": ["CAT", "GE", "UNP", "HON", "BA", "LMT", "DE", "RTX", "UPS"]
}


def _safe_float(val, fallback=None, multiplier=1.0):
    """Converts a value safely to a rounded float."""
    if val is None or val == "N/A" or val == "":
        return fallback
    try:
        f = float(val) * multiplier
        return round(f, 4 if abs(f) < 0.1 else 2)
    except (ValueError, TypeError):
        return fallback


def _calculate_health_score(val_dict: dict, prof_dict: dict, growth_dict: dict, bs_dict: dict) -> tuple[float, str]:
    """
    Computes an institutional fundamental health score (0-100) and letter grade (A-F).
    """
    score = 50.0

    # Valuation scoring (max +/- 15 pts)
    pe = val_dict.get("trailing_pe")
    if pe:
        if 0 < pe <= 20:
            score += 10.0  # Attractive valuation
        elif 20 < pe <= 35:
            score += 5.0
        elif pe > 60:
            score -= 8.0  # High valuation multiple

    pb = val_dict.get("price_to_book")
    if pb and 0 < pb <= 4.0:
        score += 5.0

    # Profitability scoring (max +/- 25 pts)
    roe = prof_dict.get("roe")
    if roe:
        if roe >= 20.0:
            score += 10.0
        elif roe >= 10.0:
            score += 6.0
        elif roe < 0:
            score -= 10.0

    net_margin = prof_dict.get("net_margin")
    if net_margin:
        if net_margin >= 20.0:
            score += 10.0
        elif net_margin >= 10.0:
            score += 5.0
        elif net_margin < 0:
            score -= 10.0

    # Growth scoring (max +/- 15 pts)
    rev_growth = growth_dict.get("revenue_growth_yoy")
    if rev_growth:
        if rev_growth >= 15.0:
            score += 10.0
        elif rev_growth >= 5.0:
            score += 5.0
        elif rev_growth < 0:
            score -= 8.0

    # Balance Sheet Solvency (max +/- 20 pts)
    current_ratio = bs_dict.get("current_ratio")
    if current_ratio:
        if current_ratio >= 1.5:
            score += 8.0  # Strong liquidity
        elif current_ratio < 1.0:
            score -= 8.0  # Liquidity strain

    debt_to_equity = bs_dict.get("debt_to_equity")
    if debt_to_equity:
        if debt_to_equity <= 80.0:
            score += 8.0  # Low leverage
        elif debt_to_equity > 200.0:
            score -= 8.0  # High debt burden

    final_score = max(10.0, min(95.0, round(score, 1)))

    if final_score >= 80.0:
        grade = "A"
    elif final_score >= 70.0:
        grade = "B"
    elif final_score >= 55.0:
        grade = "C"
    elif final_score >= 40.0:
        grade = "D"
    else:
        grade = "F"

    return final_score, grade


def analyze_symbol_financial(symbol: str, force_refresh: bool = False) -> dict:
    """
    Extracts fundamental financial metrics, valuation ratios, profitability,
    growth, and balance sheet health for a given equity or crypto symbol.
    """
    sym = symbol.strip().upper()
    cache_key = f"{CACHE_PREFIX}{sym}"

    if REDIS_AVAILABLE and not force_refresh:
        try:
            cached = _redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    try:
        ticker = yf.Ticker(sym)
        info = ticker.info

        # Handle crypto tickers gracefully
        is_crypto = info.get("quoteType") == "CRYPTOCURRENCY" or sym.endswith("-USD") or sym in ["BTC", "ETH", "SOL", "BNB"]

        if is_crypto:
            market_cap = info.get("marketCap") or info.get("totalMarketCap")
            circ_supply = info.get("circulatingSupply")
            max_supply = info.get("maxSupply") or info.get("totalSupply")
            vol24h = info.get("volume24Hr") or info.get("regularMarketVolume")

            crypto_result = {
                "symbol": sym,
                "asset_type": "Crypto",
                "name": info.get("shortName") or info.get("name") or sym,
                "sector": "Digital Assets",
                "industry": "Cryptocurrency",
                "currency": info.get("currency", "USD"),
                "market_cap": market_cap,
                "volume_24h": vol24h,
                "circulating_supply": circ_supply,
                "max_supply": max_supply,
                "supply_mined_pct": round((circ_supply / max_supply * 100), 2) if circ_supply and max_supply else None,
                "health_score": 75.0,
                "health_grade": "B",
                "is_equity": False,
                "summary": info.get("description", "Cryptocurrency asset.")
            }
            if REDIS_AVAILABLE:
                try:
                    _redis.setex(cache_key, CACHE_TTL, json.dumps(crypto_result))
                except Exception:
                    pass
            return crypto_result

        # Equity Fundamentals
        sector = info.get("sector", "Technology")
        industry = info.get("industry", "Diversified")

        # 1. Valuation Ratios
        valuation = {
            "trailing_pe": _safe_float(info.get("trailingPE")),
            "forward_pe": _safe_float(info.get("forwardPE")),
            "peg_ratio": _safe_float(info.get("pegRatio")),
            "price_to_book": _safe_float(info.get("priceToBook")),
            "price_to_sales": _safe_float(info.get("priceToSalesTrailing12Months")),
            "enterprise_to_ebitda": _safe_float(info.get("enterpriseToEbitda")),
            "market_cap": info.get("marketCap"),
            "enterprise_value": info.get("enterpriseValue")
        }

        # 2. Profitability Analysis
        profitability = {
            "roe": _safe_float(info.get("returnOnEquity"), multiplier=100.0),
            "roa": _safe_float(info.get("returnOnAssets"), multiplier=100.0),
            "gross_margin": _safe_float(info.get("grossMargins"), multiplier=100.0),
            "operating_margin": _safe_float(info.get("operatingMargins"), multiplier=100.0),
            "net_margin": _safe_float(info.get("profitMargins"), multiplier=100.0)
        }

        # 3. Growth Measurements
        growth = {
            "revenue_growth_yoy": _safe_float(info.get("revenueGrowth"), multiplier=100.0),
            "earnings_growth_yoy": _safe_float(info.get("earningsGrowth"), multiplier=100.0),
            "forward_eps": _safe_float(info.get("forwardEps")),
            "trailing_eps": _safe_float(info.get("trailingEps"))
        }

        # 4. Balance Sheet & Solvency
        balance_sheet = {
            "total_cash": info.get("totalCash"),
            "total_debt": info.get("totalDebt"),
            "debt_to_equity": _safe_float(info.get("debtToEquity")),
            "current_ratio": _safe_float(info.get("currentRatio")),
            "quick_ratio": _safe_float(info.get("quickRatio")),
            "free_cash_flow": info.get("freeCashflow"),
            "operating_cash_flow": info.get("operatingCashflow")
        }

        # Composite Health Calculation
        health_score, health_grade = _calculate_health_score(valuation, profitability, growth, balance_sheet)

        result = {
            "symbol": sym,
            "asset_type": "Equity",
            "name": info.get("shortName") or info.get("longName") or sym,
            "sector": sector,
            "industry": industry,
            "currency": info.get("currency", "USD"),
            "current_price": _safe_float(info.get("currentPrice") or info.get("regularMarketPrice")),
            "health_score": health_score,
            "health_grade": health_grade,
            "valuation": valuation,
            "profitability": profitability,
            "growth": growth,
            "balance_sheet": balance_sheet,
            "is_equity": True,
            "dividend_yield": _safe_float(info.get("dividendYield"), multiplier=100.0),
            "summary": info.get("longBusinessSummary", "")[:350] + "..." if info.get("longBusinessSummary") else ""
        }

        if REDIS_AVAILABLE:
            try:
                _redis.setex(cache_key, CACHE_TTL, json.dumps(result))
            except Exception:
                pass

        return result

    except Exception as e:
        print(f"[financial_service] Fundamental fetch error for {sym}: {e}")
        return {
            "symbol": sym,
            "error": f"Failed to retrieve fundamentals for {sym}: {str(e)}",
            "health_score": 50.0,
            "health_grade": "C",
            "is_equity": False
        }


def get_sector_peers_comparison(symbol: str, force_refresh: bool = False) -> dict:
    """
    Compares the target ticker against industry peers across P/E, Margins, and ROE.
    """
    sym = symbol.strip().upper()
    cache_key = f"{PEERS_CACHE_PREFIX}{sym}"

    if REDIS_AVAILABLE and not force_refresh:
        try:
            cached = _redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    target_data = analyze_symbol_financial(sym)
    if not target_data.get("is_equity"):
        return {"symbol": sym, "peers": [], "message": "Peer comparison is available for equity assets."}

    sector = target_data.get("sector", "Technology")
    peers_list = SECTOR_PEERS_MAP.get(sector, SECTOR_PEERS_MAP["Technology"])

    # Include target symbol if not in list, limit to 6 peers for display
    selected_peers = [p for p in peers_list if p != sym][:5]
    all_tickers = [sym] + selected_peers

    peer_results = []
    for ticker_sym in all_tickers:
        fin = analyze_symbol_financial(ticker_sym)
        if "valuation" in fin:
            peer_results.append({
                "symbol": ticker_sym,
                "name": fin.get("name", ticker_sym),
                "is_target": (ticker_sym == sym),
                "pe_ratio": fin["valuation"].get("trailing_pe"),
                "forward_pe": fin["valuation"].get("forward_pe"),
                "price_to_book": fin["valuation"].get("price_to_book"),
                "net_margin": fin["profitability"].get("net_margin"),
                "roe": fin["profitability"].get("roe"),
                "health_grade": fin.get("health_grade", "N/A"),
                "health_score": fin.get("health_score", 50.0)
            })

    output = {
        "target_symbol": sym,
        "sector": sector,
        "peers": peer_results
    }

    if REDIS_AVAILABLE:
        try:
            _redis.setex(cache_key, CACHE_TTL, json.dumps(output))
        except Exception:
            pass

    return output
