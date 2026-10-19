"""
Technical Analysis Service
Calculates institutional-grade technical indicators, trend momentum models,
and a unified 0-100 technical strength composite score.
Pure NumPy/Pandas calculation engine with yfinance market data and Redis caching.
"""
import math
import json
import numpy as np
import pandas as pd
import yfinance as yf
from services.market_data import _redis, REDIS_AVAILABLE

CACHE_PREFIX = "tech_analysis:"
CACHE_TTL = 300  # 5 minutes cache for technical indicator calculations


def _calculate_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Calculates standard Wilder smoothed RSI."""
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)

    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period, adjust=False).mean()

    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50.0)


def _calculate_macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    """Calculates MACD line, Signal line, and MACD Histogram."""
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    hist = macd_line - signal_line
    return macd_line, signal_line, hist


def _calculate_bollinger_bands(series: pd.Series, period: int = 20, num_std: float = 2.0):
    """Calculates 20-day SMA Bollinger Bands, Bandwidth, and %B."""
    sma = series.rolling(window=period).mean()
    std = series.rolling(window=period).std()
    upper = sma + (std * num_std)
    lower = sma - (std * num_std)
    bandwidth = (upper - lower) / sma.replace(0, np.nan)
    pct_b = (series - lower) / (upper - lower).replace(0, np.nan)
    return upper, sma, lower, bandwidth, pct_b


def _calculate_stochastic(df: pd.DataFrame, k_period: int = 14, d_period: int = 3):
    """Calculates Stochastic Oscillator %K and %D."""
    low_min = df['Low'].rolling(window=k_period).min()
    high_max = df['High'].rolling(window=k_period).max()
    denom = high_max - low_min
    pct_k = 100 * ((df['Close'] - low_min) / denom.replace(0, np.nan))
    pct_d = pct_k.rolling(window=d_period).mean()
    return pct_k.fillna(50.0), pct_d.fillna(50.0)


def _determine_trend(close: float, sma20: float, sma50: float, sma200: float | None) -> dict:
    """
    Evaluates moving average stacked alignment and slope to classify current market trend.
    """
    score = 50.0

    # Short vs medium term
    if sma20 > sma50:
        score += 15.0
    else:
        score -= 15.0

    # Close vs short term
    if close > sma20:
        score += 10.0
    else:
        score -= 10.0

    # Long-term comparison if 200 SMA is available
    if sma200 and not math.isnan(sma200) and sma200 > 0:
        if close > sma200:
            score += 15.0
        else:
            score -= 15.0

        if sma50 > sma200:
            score += 10.0  # Golden cross territory
        else:
            score -= 10.0  # Death cross territory

    score = max(0.0, min(100.0, score))

    if score >= 75.0:
        label = "Strong Uptrend"
    elif score >= 58.0:
        label = "Weak Uptrend"
    elif score <= 25.0:
        label = "Strong Downtrend"
    elif score <= 42.0:
        label = "Weak Downtrend"
    else:
        label = "Neutral / Consolidation"

    return {"label": label, "score": round(score, 1)}


def analyze_symbol_technical(symbol: str) -> dict:
    """
    Computes comprehensive technical indicators, momentum, support/resistance,
    and a unified 0-100 technical strength score for any stock or crypto symbol.
    """
    sym = symbol.strip().upper()
    cache_key = f"{CACHE_PREFIX}{sym}"

    # Check Redis cache
    if REDIS_AVAILABLE:
        try:
            cached = _redis.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    # Map symbol for yfinance if needed (e.g. BTC -> BTC-USD)
    yf_symbol = sym
    if sym in ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC', 'LINK']:
        yf_symbol = f"{sym}-USD"

    try:
        ticker = yf.Ticker(yf_symbol)
        df = ticker.history(period="1y", interval="1d")
        if df.empty or len(df) < 25:
            # Fallback to shorter period if 1y is unavailable
            df = ticker.history(period="3mo", interval="1d")
            if df.empty or len(df) < 20:
                return {"error": f"Insufficient historical price data for {sym}"}

        # Indicators Calculation
        close_series = df['Close']

        # 1. RSI
        rsi_series = _calculate_rsi(close_series, 14)
        current_rsi = float(rsi_series.iloc[-1])

        # 2. Moving Averages
        sma20 = float(close_series.rolling(20).mean().iloc[-1])
        sma50 = float(close_series.rolling(50).mean().iloc[-1]) if len(df) >= 50 else sma20
        sma200 = float(close_series.rolling(200).mean().iloc[-1]) if len(df) >= 200 else None

        ema9 = float(close_series.ewm(span=9, adjust=False).mean().iloc[-1])
        ema21 = float(close_series.ewm(span=21, adjust=False).mean().iloc[-1])
        ema50 = float(close_series.ewm(span=50, adjust=False).mean().iloc[-1])

        # 3. MACD
        macd_line, sig_line, macd_hist = _calculate_macd(close_series)
        curr_macd = float(macd_line.iloc[-1])
        curr_sig = float(sig_line.iloc[-1])
        curr_hist = float(macd_hist.iloc[-1])
        prev_hist = float(macd_hist.iloc[-2]) if len(macd_hist) > 1 else curr_hist

        # 4. Bollinger Bands
        bb_upper, bb_mid, bb_lower, bb_width, bb_pct_b = _calculate_bollinger_bands(close_series)
        curr_bb_upper = float(bb_upper.iloc[-1])
        curr_bb_mid = float(bb_mid.iloc[-1])
        curr_bb_lower = float(bb_lower.iloc[-1])
        curr_pct_b = float(bb_pct_b.iloc[-1])

        # 5. Stochastic & Momentum
        stoch_k, stoch_d = _calculate_stochastic(df)
        curr_stoch_k = float(stoch_k.iloc[-1])
        curr_stoch_d = float(stoch_d.iloc[-1])

        # 10-day and 20-day Rate of Change (ROC)
        roc10 = float((close_series.iloc[-1] - close_series.iloc[-11]) / close_series.iloc[-11] * 100) if len(close_series) > 11 else 0.0
        roc20 = float((close_series.iloc[-1] - close_series.iloc[-21]) / close_series.iloc[-21] * 100) if len(close_series) > 21 else 0.0

        current_close = float(close_series.iloc[-1])

        # Dynamic Pivot Support and Resistance (last 30 trading days)
        last_30 = df.tail(30)
        resistance = float(last_30['High'].max())
        support = float(last_30['Low'].min())

        # Trend Evaluation
        trend_info = _determine_trend(current_close, sma20, sma50, sma200)

        # -------------------------------------------------------------
        # Composite Technical Strength Score (0 to 100)
        # -------------------------------------------------------------
        # 1. Trend component (30 pts)
        trend_pts = (trend_info["score"] / 100.0) * 30.0

        # 2. RSI component (25 pts)
        # Healthy bullish momentum: 50-65 (max pts). Overbought >70 lowers slightly. Oversold <30 lowers.
        if 50 <= current_rsi <= 65:
            rsi_pts = 25.0
        elif 65 < current_rsi <= 75:
            rsi_pts = 20.0
        elif current_rsi > 75:
            rsi_pts = 12.0  # Overbought caution
        elif 40 <= current_rsi < 50:
            rsi_pts = 14.0
        elif 30 <= current_rsi < 40:
            rsi_pts = 8.0
        else:
            rsi_pts = 10.0  # Oversold rebound potential

        # 3. MACD component (25 pts)
        macd_pts = 12.5
        if curr_macd > curr_sig:
            macd_pts += 7.5
        else:
            macd_pts -= 7.5
        if curr_hist > prev_hist:
            macd_pts += 5.0
        else:
            macd_pts -= 5.0
        macd_pts = max(0.0, min(25.0, macd_pts))

        # 4. Bollinger & Moving Average Position (20 pts)
        ma_pts = 10.0
        if current_close > ema21:
            ma_pts += 5.0
        else:
            ma_pts -= 5.0
        if 0.2 <= curr_pct_b <= 0.8:
            ma_pts += 5.0  # Stable within bands
        ma_pts = max(0.0, min(20.0, ma_pts))

        total_score = round(trend_pts + rsi_pts + macd_pts + ma_pts, 1)
        total_score = max(5.0, min(95.0, total_score))

        # Actionable Signal
        if total_score >= 75.0:
            signal = "Strong Buy"
            signal_color = "emerald"
        elif total_score >= 60.0:
            signal = "Buy"
            signal_color = "green"
        elif total_score <= 30.0:
            signal = "Strong Sell"
            signal_color = "rose"
        elif total_score <= 42.0:
            signal = "Sell"
            signal_color = "amber"
        else:
            signal = "Neutral"
            signal_color = "blue"

        result = {
            "symbol": sym,
            "current_price": round(current_close, 4 if current_close < 1.0 else 2),
            "score": total_score,
            "signal": signal,
            "signal_color": signal_color,
            "trend": {
                "label": trend_info["label"],
                "score": trend_info["score"],
                "golden_cross": (sma50 > sma200) if sma200 else False
            },
            "rsi": {
                "value": round(current_rsi, 1),
                "condition": "Overbought" if current_rsi >= 70 else ("Oversold" if current_rsi <= 30 else "Neutral")
            },
            "macd": {
                "macd": round(curr_macd, 4),
                "signal": round(curr_sig, 4),
                "histogram": round(curr_hist, 4),
                "crossover": "Bullish" if curr_macd > curr_sig else "Bearish"
            },
            "bollinger": {
                "upper": round(curr_bb_upper, 2),
                "middle": round(curr_bb_mid, 2),
                "lower": round(curr_bb_lower, 2),
                "pct_b": round(curr_pct_b, 2)
            },
            "moving_averages": {
                "sma20": round(sma20, 2),
                "sma50": round(sma50, 2),
                "sma200": round(sma200, 2) if sma200 else None,
                "ema9": round(ema9, 2),
                "ema21": round(ema21, 2),
                "ema50": round(ema50, 2),
                "price_vs_sma50": "Above" if current_close >= sma50 else "Below"
            },
            "momentum": {
                "roc10": round(roc10, 2),
                "roc20": round(roc20, 2),
                "stoch_k": round(curr_stoch_k, 1),
                "stoch_d": round(curr_stoch_d, 1)
            },
            "key_levels": {
                "support": round(support, 2),
                "resistance": round(resistance, 2)
            }
        }

        # Cache in Redis
        if REDIS_AVAILABLE:
            try:
                _redis.setex(cache_key, CACHE_TTL, json.dumps(result))
            except Exception:
                pass

        return result

    except Exception as e:
        print(f"[technical_service] Calculation error for {sym}: {e}")
        return {"error": f"Failed to compute technical analysis for {sym}: {str(e)}"}
