import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  TrendingUp, TrendingDown, RefreshCw, Search, BarChart2,
  Bitcoin, DollarSign, Globe, ChevronUp, ChevronDown, Minus
} from 'lucide-react';

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

function QuoteRow({ quote, isNew }) {
  const isPos = (quote.change_pct || 0) >= 0;
  return (
    <tr className={`border-b border-gray-100 dark:border-gray-800 transition-colors duration-300
      ${isNew ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}`}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold
            ${isPos ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                     : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'}`}>
            {formatSymbolName(quote.symbol).slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white text-sm">{formatSymbolName(quote.symbol)}</p>
            <p className="text-xs text-gray-400">{quote.symbol}</p>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900 dark:text-white tabular-nums">
        ${formatPrice(quote.price, quote.symbol)}
      </td>
      <td className="py-3 px-4 text-right tabular-nums">
        <ChangeBadge pct={quote.change_pct} />
      </td>
      <td className="py-3 px-4 text-right text-sm text-gray-500 dark:text-gray-400 tabular-nums hidden md:table-cell">
        {quote.change !== undefined
          ? <span className={quote.change >= 0 ? 'text-emerald-500' : 'text-red-500'}>
              {quote.change >= 0 ? '+' : ''}{formatPrice(quote.change, quote.symbol)}
            </span>
          : '—'}
      </td>
      <td className="py-3 px-4 text-right text-xs text-gray-400 hidden lg:table-cell">
        {quote.from_cache
          ? <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">cached</span>
          : <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 rounded text-emerald-600 dark:text-emerald-400">live</span>}
      </td>
    </tr>
  );
}

export default function Markets() {
  const [activeTab, setActiveTab] = useState('stocks');
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [newSymbols, setNewSymbols] = useState(new Set());

  const fetchQuotes = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const symbols = WATCHLIST[activeTab];
      const res = await axios.get(`${BASE_URL}/market/quotes`, {
        params: { symbols: symbols.join(',') }
      });
      const incoming = res.data;

      // Highlight rows that are freshly fetched (not from cache)
      const freshSet = new Set(
        incoming.filter(q => !q.from_cache).map(q => q.symbol)
      );
      setNewSymbols(freshSet);
      setTimeout(() => setNewSymbols(new Set()), 2000);

      setQuotes(incoming);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load market data. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Load on mount and whenever tab changes
  useEffect(() => {
    setQuotes([]);
    setLoading(true);
    fetchQuotes(true);
  }, [activeTab]);

  // Auto-refresh every 10s
  useEffect(() => {
    const id = setInterval(() => fetchQuotes(false), 10000);
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
            onClick={() => fetchQuotes(true)}
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
          <div className="flex gap-1">
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
                <tr className="bg-gray-50 dark:bg-gray-800/60 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="text-left py-2.5 px-4 font-semibold">Asset</th>
                  <th className="text-right py-2.5 px-4 font-semibold">Price</th>
                  <th className="text-right py-2.5 px-4 font-semibold">24h Change</th>
                  <th className="text-right py-2.5 px-4 font-semibold hidden md:table-cell">Abs Change</th>
                  <th className="text-right py-2.5 px-4 font-semibold hidden lg:table-cell">Source</th>
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
                    <QuoteRow key={q.symbol} quote={q} isNew={newSymbols.has(q.symbol)} />
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
