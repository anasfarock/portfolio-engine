import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  TrendingUp, TrendingDown, RefreshCw, Search, BarChart2,
  Bitcoin, DollarSign, Globe, ChevronUp, ChevronDown, Minus
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const BASE_URL = 'http://localhost:8000';

const WATCHLIST = {
  stocks: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'TSLA', 'META', 'JPM', 'V', 'WMT'],
  crypto: ['BTC-USD', 'ETH-USD', 'BNB-USD', 'SOL-USD', 'XRP-USD', 'ADA-USD', 'DOGE-USD', 'AVAX-USD'],
  forex: ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'AUDUSD=X', 'USDCAD=X', 'USDCHF=X', 'NZDUSD=X'],
};

const CATEGORY_META = {
  stocks: { label: 'Stocks', icon: BarChart2, color: 'text-blue-500' },
  crypto: { label: 'Crypto', icon: Bitcoin, color: 'text-amber-500' },
  forex: { label: 'Forex', icon: Globe, color: 'text-emerald-500' },
};

// Module-level cache — survives page navigation within the same session.
// Stores { quotes: [], lastUpdated: Date } per tab key.
const quotesCache = { stocks: null, crypto: null, forex: null };

function formatPrice(price, symbol) {
  if (price === undefined || price === null) return '—';
  const isCrypto = symbol?.includes('-USD') && !['EURUSD=X', 'GBPUSD=X'].includes(symbol);
  const isForex = symbol?.endsWith('=X');
  if (isForex) return price.toFixed(4);
  if (isCrypto && price < 1) return price.toFixed(6);
  if (isCrypto && price < 100) return price.toFixed(2);
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatSymbolName(symbol) {
  if (symbol.endsWith('=X')) return symbol.replace('=X', '').replace(/(.{3})(.{3})/, '$1/$2');
  if (symbol.endsWith('-USD')) return symbol.replace('-USD', '');
  return symbol;
}

function ChangeBadge({ pct }) {
  if (pct === null || pct === undefined) return <span className="text-gray-400">—</span>;
  const isPos = pct > 0;
  const isNeg = pct < 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums
      ${isPos ? 'text-emerald-500' : isNeg ? 'text-red-500' : 'text-gray-400'}`}>
      {isPos ? <ChevronUp className="w-3.5 h-3.5" /> : isNeg ? <ChevronDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

function ExpandedRowContent({ symbol }) {
  const [history, setHistory] = useState([]);
  const [spread, setSpread] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchDetailedData = async () => {
      setLoading(true);
      try {
        const [histRes, spreadRes] = await Promise.all([
          axios.get(`${BASE_URL}/market/history/${symbol}?period=1mo&interval=1d`),
          axios.get(`${BASE_URL}/market/spread/${symbol}`)
        ]);
        if (active) {
          setHistory(histRes.data.candles || []);
          setSpread(spreadRes.data || null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchDetailedData();
    return () => { active = false; };
  }, [symbol]);

  if (loading) {
    return <div className="p-8 flex justify-center"><RefreshCw className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 h-48">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">30-Day Price History</p>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <XAxis 
              dataKey="time" 
              tickFormatter={(val) => {
                const d = new Date(val);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
              stroke="#9CA3AF"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
            />
            <YAxis 
              orientation="right"
              domain={['auto', 'auto']} 
              tickFormatter={(val) => `$${val < 1 ? Number(val).toFixed(4) : Number(val).toFixed(2)}`}
              stroke="#9CA3AF"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <RechartsTooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
              labelFormatter={(lbl) => new Date(lbl).toLocaleDateString()}
              formatter={(val) => [`$${Number(val).toFixed(2)}`, 'Price']}
            />
            <Line type="monotone" dataKey="close" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col justify-center space-y-4 bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bid / Ask Spread</p>
        {spread ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <p className="text-xs text-gray-400">Bid Price</p>
              <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white">${formatPrice(spread.bid, symbol)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Ask Price</p>
              <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white">${formatPrice(spread.ask, symbol)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Spread</p>
              <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white">{formatPrice(spread.spread, symbol)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Spread %</p>
              <p className="text-sm font-mono font-semibold text-gray-900 dark:text-white">{spread.spread_pct ? spread.spread_pct.toFixed(3) : '0.000'}%</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">Spread data not available from source.</p>
        )}
      </div>
    </div>
  );
}

function QuoteRow({ quote, isNew, isExpanded, onToggle }) {
  const isPos = (quote.change_pct || 0) >= 0;
  return (
    <>
      <tr 
        onClick={onToggle}
        className={`border-b border-gray-100 dark:border-gray-800 transition-colors duration-300 cursor-pointer
        ${isNew ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}
        ${isExpanded ? 'bg-gray-50 dark:bg-gray-800/60' : ''}`}>
        <td className="py-3 px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold
              ${isPos ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                       : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
              {formatSymbolName(quote.symbol).slice(0, 2)}
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white text-xs sm:text-sm leading-tight sm:leading-normal">{formatSymbolName(quote.symbol)}</p>
              <p className="text-[10px] sm:text-xs text-gray-400 leading-tight sm:leading-normal">{quote.symbol}</p>
            </div>
          </div>
        </td>
        <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold text-gray-900 dark:text-white tabular-nums text-xs sm:text-sm">
          ${formatPrice(quote.price, quote.symbol)}
        </td>
        <td className="py-3 px-3 sm:px-4 text-right tabular-nums text-xs sm:text-sm whitespace-nowrap">
          <ChangeBadge pct={quote.change_pct} />
        </td>
        <td className="py-3 px-3 sm:px-4 text-right text-sm text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
          {quote.change !== undefined
            ? <span className={quote.change >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                {quote.change >= 0 ? '+' : ''}{formatPrice(quote.change, quote.symbol)}
              </span>
            : '—'}
        </td>
        <td className="py-3 px-3 sm:px-4 text-right text-xs text-gray-400 whitespace-nowrap">
          <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-md text-blue-600 dark:text-blue-400 font-medium">
            Yahoo Finance
          </span>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20">
          <td colSpan={5} className="p-0">
             <ExpandedRowContent symbol={quote.symbol} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function Markets() {
  const [activeTab, setActiveTab] = useState('stocks');
  const [expandedRow, setExpandedRow] = useState(null);

  // Initialise from cache so returning to the page is instant
  const [quotes, setQuotes] = useState(() => quotesCache['stocks']?.quotes || []);
  const [loading, setLoading] = useState(() => !quotesCache['stocks']);
  const [lastUpdated, setLastUpdated] = useState(() => quotesCache['stocks']?.lastUpdated || null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [newSymbols, setNewSymbols] = useState(new Set());

  // Track the currently active tab in a ref so async fetches can detect stale results
  const activeTabRef = useRef(activeTab);

  const fetchQuotes = useCallback(async (tab, showLoading = false) => {
    // Only show the loading skeleton if there's no cached data to show yet
    if (showLoading && !quotesCache[tab]) setLoading(true);
    setError(null);
    try {
      const symbols = WATCHLIST[tab];
      const res = await axios.get(`${BASE_URL}/market/quotes`, {
        params: { symbols: symbols.join(',') }
      });

      const incoming = res.data;

      // Persist to module-level cache so navigating back is instant
      quotesCache[tab] = { quotes: incoming, lastUpdated: new Date() };

      // Discard state updates if the user switched tabs while this request was in-flight
      if (activeTabRef.current !== tab) return;

      // Highlight rows that are freshly fetched (not from cache)
      const freshSet = new Set(
        incoming.filter(q => !q.from_cache).map(q => q.symbol)
      );
      setNewSymbols(freshSet);
      setTimeout(() => setNewSymbols(new Set()), 2000);

      setQuotes(incoming);
      setLastUpdated(new Date());
    } catch (err) {
      if (activeTabRef.current === tab) {
        setError(err.response?.data?.detail || 'Failed to load market data. Make sure the backend is running.');
      }
    } finally {
      if (activeTabRef.current === tab) setLoading(false);
    }
  }, []);

  // When tab changes: show cached data instantly if available, then refresh in background
  useEffect(() => {
    activeTabRef.current = activeTab;
    setSearch('');
    setError(null);

    const cached = quotesCache[activeTab];
    if (cached) {
      // Show cached data immediately — no loading flash
      setQuotes(cached.quotes);
      setLastUpdated(cached.lastUpdated);
      setLoading(false);
      // Silently refresh in background
      fetchQuotes(activeTab, false);
    } else {
      // No cache yet — show skeleton and fetch
      setQuotes([]);
      setLoading(true);
      fetchQuotes(activeTab, false);
    }
  }, [activeTab, fetchQuotes]);

  // Pre-fetch all tabs in the background on initial mount to make tab switching instant
  useEffect(() => {
    ['stocks', 'crypto', 'forex'].forEach(tab => {
      // Fetch if it's not the active one (which is already handled) and not yet cached
      if (tab !== activeTabRef.current && !quotesCache[tab]) {
        fetchQuotes(tab, false);
      }
    });
  }, [fetchQuotes]);

  // Auto-refresh every 30s — always uses the current tab via the ref
  useEffect(() => {
    const id = setInterval(() => fetchQuotes(activeTabRef.current, false), 30000);
    return () => clearInterval(id);
  }, [fetchQuotes]);

  const filtered = quotes.filter(q =>
    q.symbol.toLowerCase().includes(search.toLowerCase()) ||
    formatSymbolName(q.symbol).toLowerCase().includes(search.toLowerCase())
  );

  const topGainers = [...quotes].sort((a, b) => (b.change_pct || 0) - (a.change_pct || 0)).slice(0, 3);
  const topLosers = [...quotes].sort((a, b) => (a.change_pct || 0) - (b.change_pct || 0)).slice(0, 3);

  const tabs = Object.entries(CATEGORY_META);

  return (
    <div className="space-y-6 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-primary-500" />
            Markets
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Live prices across Stocks, Crypto &amp; Forex — refreshes every 10s
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchQuotes(activeTab, true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
              text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Gainers / Losers mini-cards */}
      {quotes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-3 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Top Gainers
            </p>
            <div className="space-y-2">
              {topGainers.map(q => (
                <div key={q.symbol} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatSymbolName(q.symbol)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-gray-900 dark:text-white">${formatPrice(q.price, q.symbol)}</span>
                    <ChangeBadge pct={q.change_pct} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 rounded-xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-3 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" /> Top Losers
            </p>
            <div className="space-y-2">
              {topLosers.map(q => (
                <div key={q.symbol} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatSymbolName(q.symbol)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-gray-900 dark:text-white">${formatPrice(q.price, q.symbol)}</span>
                    <ChangeBadge pct={q.change_pct} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main table card */}
      <div className="bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Tabs + Search bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 pt-4 pb-0 border-b border-gray-100 dark:border-gray-800">
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide w-full sm:w-auto">
            {tabs.map(([key, meta]) => {
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  onClick={() => { setSearch(''); setActiveTab(key); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition-all border-b-2
                    ${activeTab === key
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/10'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                >
                  <Icon className={`w-4 h-4 ${activeTab === key ? meta.color : ''}`} />
                  {meta.label}
                </button>
              );
            })}
          </div>
          <div className="relative mb-3 sm:mb-0 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search symbol..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
            />
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="p-6 text-center text-sm text-red-500 dark:text-red-400">
            ⚠️ {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/60 text-[10px] sm:text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  <th className="text-left py-2.5 px-3 sm:px-4 font-semibold">Asset</th>
                  <th className="text-right py-2.5 px-3 sm:px-4 font-semibold">Price</th>
                  <th className="text-right py-2.5 px-3 sm:px-4 font-semibold">24h Change</th>
                  <th className="text-right py-2.5 px-3 sm:px-4 font-semibold">Abs Change</th>
                  <th className="text-right py-2.5 px-3 sm:px-4 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-400 text-sm">
                      No results found for &quot;{search}&quot;
                    </td>
                  </tr>
                ) : (
                  filtered.map(q => (
                    <QuoteRow 
                      key={q.symbol} 
                      quote={q} 
                      isNew={newSymbols.has(q.symbol)} 
                      isExpanded={expandedRow === q.symbol}
                      onToggle={() => setExpandedRow(prev => prev === q.symbol ? null : q.symbol)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {!loading && !error && quotes.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 flex justify-between">
            <span>{filtered.length} symbols shown</span>
            <span>Data via yfinance · auto-refreshes every 10s</span>
          </div>
        )}
      </div>
    </div>
  );
}
