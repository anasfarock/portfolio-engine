import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const BASE_URL = 'http://localhost:8000';

/**
 * useMarketPrice — polls a single symbol's price on a given interval.
 * @param {string} symbol  e.g. "AAPL" or "BTC-USD"
 * @param {number} intervalMs  polling interval in ms (default 15000)
 */
export function useMarketPrice(symbol, intervalMs = 15000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!symbol) return;
    try {
      const res = await axios.get(`${BASE_URL}/market/price/${symbol}`);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch price');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, intervalMs);
    return () => clearInterval(id);
  }, [fetch, intervalMs]);

  return { data, loading, error, refetch: fetch };
}

/**
 * useBatchQuotes — polls a list of symbols and returns all quotes.
 * @param {string[]} symbols  list of symbol strings
 * @param {number} intervalMs  polling interval in ms (default 10000)
 */
export function useBatchQuotes(symbols, intervalMs = 10000) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMounted = useRef(true);

  const fetch = useCallback(async () => {
    if (!symbols || symbols.length === 0) return;
    try {
      const joined = symbols.join(',');
      const res = await axios.get(`${BASE_URL}/market/quotes`, { params: { symbols: joined } });
      if (isMounted.current) {
        setQuotes(res.data);
        setError(null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err.response?.data?.detail || 'Failed to fetch quotes');
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [symbols.join(',')]);

  useEffect(() => {
    isMounted.current = true;
    fetch();
    const id = setInterval(fetch, intervalMs);
    return () => {
      isMounted.current = false;
      clearInterval(id);
    };
  }, [fetch, intervalMs]);

  return { quotes, loading, error, refetch: fetch };
}

/**
 * useHistoricalData — fetches OHLCV history for charting.
 * @param {string} symbol
 * @param {string} period  e.g. "1mo", "3mo", "1y"
 * @param {string} interval  e.g. "1d", "1h"
 */
export function useHistoricalData(symbol, period = '1mo', interval = '1d') {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    axios
      .get(`${BASE_URL}/market/history/${symbol}`, { params: { period, interval } })
      .then((res) => {
        setCandles(res.data.candles || []);
        setError(null);
      })
      .catch((err) => {
        setError(err.response?.data?.detail || 'Failed to fetch history');
      })
      .finally(() => setLoading(false));
  }, [symbol, period, interval]);

  return { candles, loading, error };
}
