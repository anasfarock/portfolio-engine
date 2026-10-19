import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  TrendingUp, TrendingDown, Activity, Cpu, Search, RefreshCw, BarChart2,
  DollarSign, Shield, Zap, Sparkles, Layers, ArrowUpRight, ArrowDownRight,
  CheckCircle2, AlertTriangle, ExternalLink, HelpCircle, Clock, Check
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const BASE_URL = 'http://localhost:8000';

const POPULAR_SYMBOLS = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'AMZN', 'BTC-USD', 'ETH-USD'];
const CACHE_TTL_MS = 60 * 1000; // 60 seconds stale-while-revalidate threshold
const AUTO_REFRESH_INTERVAL_MS = 30 * 1000; // 30 seconds silent background auto-refresh

// Persistent in-memory session cache across symbol and tab switches (0ms instant perceived switching)
const analyticsCache = {
  overview: {},        // [sym]: { data, timestamp }
  technical: {},       // [sym]: { data, timestamp }
  financial: {},       // [sym]: { data, timestamp }
  peers: {},           // [sym]: { data, timestamp }
  sentimentSummary: null, // { data, timestamp }
  symbolSentiment: {}, // [sym]: { data, timestamp }
};

function getRelativeTime(timestamp) {
  if (!timestamp) return 'Just now';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function ScoreGauge({ score, size = 'md', label = 'Score' }) {
  const normalized = Math.max(0, Math.min(100, score || 50));
  const getColor = (s) => {
    if (s >= 70) return '#10B981'; // emerald-500
    if (s >= 55) return '#3B82F6'; // blue-500
    if (s >= 45) return '#F59E0B'; // amber-500
    return '#EF4444';             // red-500
  };
  const color = getColor(normalized);

  const isLg = size === 'lg';
  const width = isLg ? 140 : 100;
  const stroke = isLg ? 10 : 8;
  const radius = (width - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalized / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width, height: width }}>
        <svg className="w-full h-full -rotate-90">
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-gray-200 dark:text-gray-800"
            fill="transparent"
          />
          <circle
            cx={width / 2}
            cy={width / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold tabular-nums text-gray-900 dark:text-white ${isLg ? 'text-3xl' : 'text-xl'}`}>
            {normalized.toFixed(0)}
          </span>
          <span className="text-[10px] uppercase font-semibold text-gray-400 dark:text-gray-500">
            /100
          </span>
        </div>
      </div>
      {label && (
        <span className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
          {label}
        </span>
      )}
    </div>
  );
}

function SignalBadge({ signal }) {
  if (!signal) return null;
  const s = signal.toLowerCase();
  let bg = 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700';
  if (s.includes('strong buy')) {
    bg = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
  } else if (s.includes('buy')) {
    bg = 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30';
  } else if (s.includes('strong sell')) {
    bg = 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
  } else if (s.includes('sell')) {
    bg = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
  } else if (s.includes('neutral') || s.includes('hold')) {
    bg = 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${bg} inline-flex items-center gap-1.5`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {signal}
    </span>
  );
}

// ── Tab Loading Skeletons ──
function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
          <div className="flex justify-between items-center">
            <div className="h-5 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-800 rounded-full" />
          </div>
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="flex justify-between items-center py-1">
                <div className="h-4 w-28 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TechnicalSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-2">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-7 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
        <div className="h-5 w-48 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl h-16" />
          ))}
        </div>
      </div>
    </div>
  );
}

function FinancialSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
            <div className="h-5 w-36 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4, 5].map((j) => (
                <div key={j} className="flex justify-between items-center py-1">
                  <div className="h-4 w-28 bg-gray-200 dark:bg-gray-800 rounded" />
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
        <div className="h-5 w-56 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl" />
      </div>
    </div>
  );
}

function SentimentSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
        <div className="h-5 w-64 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-3 w-full bg-gray-200 dark:bg-gray-800 rounded-full" />
        <div className="flex gap-2 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 w-28 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 h-28 space-y-3">
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-800 rounded" />
            <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const { token } = useAuth();
  const [symbol, setSymbol] = useState('AAPL');
  const [searchInput, setSearchInput] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'technical' | 'financial' | 'sentiment'

  // Analytical Data States
  const [overview, setOverview] = useState(null);
  const [technical, setTechnical] = useState(null);
  const [financial, setFinancial] = useState(null);
  const [peers, setPeers] = useState(null);
  const [marketSentiment, setMarketSentiment] = useState(null);

  // Lazy loading per-tab flags
  const [tabLoading, setTabLoading] = useState({
    overview: false,
    technical: false,
    financial: false,
    sentiment: false,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [error, setError] = useState(null);
  const [portfolioHoldings, setPortfolioHoldings] = useState([]);

  // Fetch user's active holdings for quick selection pills
  useEffect(() => {
    if (token) {
      axios.get(`${BASE_URL}/portfolio/assets`, { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          const syms = res.data.map(a => a.symbol);
          setPortfolioHoldings([...new Set(syms)]);
        })
        .catch(() => {});
    }
  }, [token]);

  // Periodic clock ticker to re-render "Updated X seconds ago"
  const [, setClockTick] = useState(0);
  useEffect(() => {
    const clockInterval = setInterval(() => setClockTick(t => t + 1), 5000);
    return () => clearInterval(clockInterval);
  }, []);

  // ── Lazy Loading & Cache-First Data Fetcher ──
  const fetchTabData = useCallback(async (targetSym, targetTab, options = {}) => {
    const { isBackground = false, forceRefresh = false } = options;
    const sym = targetSym.trim().toUpperCase();
    const now = Date.now();
    const refreshQuery = forceRefresh ? '?refresh=true' : '';

    if (!isBackground) {
      setTabLoading(prev => ({ ...prev, [targetTab]: true }));
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      // 1. Overview & Hero Data (essential for hero and overview tab)
      const cachedOverview = analyticsCache.overview[sym];
      const isOverviewStale = !cachedOverview || (now - cachedOverview.timestamp > CACHE_TTL_MS);

      if (forceRefresh || isOverviewStale || !cachedOverview) {
        axios.get(`${BASE_URL}/analytics/overview/${sym}${refreshQuery}`)
          .then(res => {
            if (res.data && !res.data.error) {
              analyticsCache.overview[sym] = { data: res.data, timestamp: Date.now() };
              setOverview(res.data);
            }
          })
          .catch(err => console.warn('Overview fetch warning:', err));
      } else if (cachedOverview) {
        setOverview(cachedOverview.data);
      }

      // 2. Market Sentiment Summary (cached globally across all tickers)
      if (targetTab === 'overview' || targetTab === 'sentiment') {
        const cachedSent = analyticsCache.sentimentSummary;
        const isSentStale = !cachedSent || (now - cachedSent.timestamp > CACHE_TTL_MS * 2);

        if (forceRefresh || isSentStale || !cachedSent) {
          axios.get(`${BASE_URL}/analytics/sentiment${refreshQuery}`)
            .then(res => {
              if (res.data) {
                analyticsCache.sentimentSummary = { data: res.data, timestamp: Date.now() };
                setMarketSentiment(res.data);
              }
            })
            .catch(err => console.warn('Market sentiment fetch warning:', err));
        } else if (cachedSent) {
          setMarketSentiment(cachedSent.data);
        }
      }

      // 3. Lazy Tab: Technical Indicators (only when technical tab is active)
      if (targetTab === 'technical') {
        const cachedTech = analyticsCache.technical[sym];
        const isTechStale = !cachedTech || (now - cachedTech.timestamp > CACHE_TTL_MS);

        if (forceRefresh || isTechStale || !cachedTech) {
          const res = await axios.get(`${BASE_URL}/analytics/technical/${sym}${refreshQuery}`);
          if (res.data) {
            analyticsCache.technical[sym] = { data: res.data, timestamp: Date.now() };
            setTechnical(res.data);
          }
        } else if (cachedTech) {
          setTechnical(cachedTech.data);
        }
      }

      // 4. Lazy Tab: Financial Fundamentals & Peers (only when financial tab is active)
      if (targetTab === 'financial') {
        const cachedFin = analyticsCache.financial[sym];
        const cachedPeers = analyticsCache.peers[sym];
        const isFinStale = !cachedFin || (now - cachedFin.timestamp > CACHE_TTL_MS * 3);
        const isPeersStale = !cachedPeers || (now - cachedPeers.timestamp > CACHE_TTL_MS * 3);

        const requests = [];
        if (forceRefresh || isFinStale || !cachedFin) {
          requests.push(
            axios.get(`${BASE_URL}/analytics/financial/${sym}${refreshQuery}`)
              .then(res => {
                if (res.data) {
                  analyticsCache.financial[sym] = { data: res.data, timestamp: Date.now() };
                  setFinancial(res.data);
                }
              })
          );
        } else if (cachedFin) {
          setFinancial(cachedFin.data);
        }

        if (forceRefresh || isPeersStale || !cachedPeers) {
          requests.push(
            axios.get(`${BASE_URL}/analytics/peers/${sym}${refreshQuery}`)
              .then(res => {
                if (res.data) {
                  analyticsCache.peers[sym] = { data: res.data, timestamp: Date.now() };
                  setPeers(res.data);
                }
              })
          );
        } else if (cachedPeers) {
          setPeers(cachedPeers.data);
        }

        if (requests.length > 0) {
          await Promise.all(requests);
        }
      }

      // 5. Lazy Tab: Symbol-specific sentiment catalysts (when sentiment tab is active)
      if (targetTab === 'sentiment') {
        const cachedSymSent = analyticsCache.symbolSentiment[sym];
        const isSymSentStale = !cachedSymSent || (now - cachedSymSent.timestamp > CACHE_TTL_MS * 2);

        if (forceRefresh || isSymSentStale || !cachedSymSent) {
          axios.get(`${BASE_URL}/analytics/sentiment/${sym}${refreshQuery}`)
            .then(res => {
              if (res.data) {
                analyticsCache.symbolSentiment[sym] = { data: res.data, timestamp: Date.now() };
              }
            })
            .catch(() => {});
        }
      }

      setLastUpdated(Date.now());
    } catch (err) {
      console.error('Analytics fetch error:', err);
      if (!isBackground) {
        setError('Failed to fetch analytics for symbol');
      }
    } finally {
      setTabLoading(prev => ({ ...prev, [targetTab]: false }));
      setIsRefreshing(false);
    }
  }, []);

  // ── Instant Symbol Switcher (0ms Perceived Latency from Cache) ──
  const handleSelectSymbol = useCallback((newSym) => {
    const clean = newSym.trim().toUpperCase();
    if (clean === symbol) return;

    setSymbol(clean);

    // Instantly hydrate UI state from in-memory session cache if available
    if (analyticsCache.overview[clean]) {
      setOverview(analyticsCache.overview[clean].data);
    }
    if (analyticsCache.technical[clean]) {
      setTechnical(analyticsCache.technical[clean].data);
    }
    if (analyticsCache.financial[clean]) {
      setFinancial(analyticsCache.financial[clean].data);
    }
    if (analyticsCache.peers[clean]) {
      setPeers(analyticsCache.peers[clean].data);
    }

    // Lazy load the active tab data for this symbol
    fetchTabData(clean, activeTab);
  }, [symbol, activeTab, fetchTabData]);

  // ── Tab Switch Handler ──
  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);

    // Instant hydrate if target tab is already in session cache
    if (newTab === 'technical' && analyticsCache.technical[symbol]) {
      setTechnical(analyticsCache.technical[symbol].data);
    } else if (newTab === 'financial') {
      if (analyticsCache.financial[symbol]) setFinancial(analyticsCache.financial[symbol].data);
      if (analyticsCache.peers[symbol]) setPeers(analyticsCache.peers[symbol].data);
    } else if (newTab === 'sentiment' && analyticsCache.sentimentSummary) {
      setMarketSentiment(analyticsCache.sentimentSummary.data);
    }

    // Trigger lazy fetch for target tab if needed
    fetchTabData(symbol, newTab);
  }, [symbol, fetchTabData]);

  // Initial load on mount or activeTab switch
  useEffect(() => {
    fetchTabData(symbol, activeTab);
  }, [symbol, activeTab, fetchTabData]);

  // ── Background Auto-Refresh Polling (every 30s) ──
  useEffect(() => {
    const autoRefreshTimer = setInterval(() => {
      // Revalidate active tab silently in the background
      fetchTabData(symbol, activeTab, { isBackground: true });
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => clearInterval(autoRefreshTimer);
  }, [symbol, activeTab, fetchTabData]);

  // Manual Force Refresh (bypasses frontend and backend caches)
  const handleManualRefresh = () => {
    fetchTabData(symbol, activeTab, { forceRefresh: true });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      handleSelectSymbol(searchInput.trim().toUpperCase());
      setSearchInput('');
    }
  };

  const tabs = [
    { id: 'overview', label: '360° Overview', icon: Sparkles },
    { id: 'technical', label: 'Technical Indicators', icon: TrendingUp },
    { id: 'financial', label: 'Fundamentals & Peers', icon: DollarSign },
    { id: 'sentiment', label: 'Sentiment & Catalysts', icon: Cpu },
  ];

  return (
    <div className="space-y-6 pb-10">
      {/* Page Header matching Markets, News, and Home */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-primary-500" />
            Analytics
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Deep-dive technical momentum, financial solvency ratios, and local LLM sentiment analysis
          </p>
        </div>

        {/* Header Controls: Live Auto-Sync Status, Search, Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Live Auto-Refresh Status Pill */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 shadow-sm">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isRefreshing ? 'bg-primary-400' : 'bg-emerald-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isRefreshing ? 'bg-primary-500' : 'bg-emerald-500'}`}></span>
            </span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              {isRefreshing ? 'Syncing...' : 'Live (30s)'}
            </span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="tabular-nums flex items-center gap-1 text-[11px]">
              <Clock className="w-3 h-3 text-gray-400" />
              {getRelativeTime(lastUpdated)}
            </span>
          </div>

          <form onSubmit={handleSearch} className="relative min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search symbol (e.g. NVDA)..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
            />
          </form>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || tabLoading[activeTab]}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
              text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50"
            title="Force Refresh Data (Bypasses Cache)"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary-500' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

        {/* ── Quick Symbol Pills ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0 mr-1">
            Tracked Assets:
          </span>
          {[...new Set([...(portfolioHoldings.length ? portfolioHoldings : []), ...POPULAR_SYMBOLS])].map((sym) => (
            <button
              key={sym}
              onClick={() => handleSelectSymbol(sym)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex-shrink-0 ${
                symbol === sym
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary-400'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>

        {/* ── Active Symbol Hero Banner ── */}
        <div className="bg-gradient-to-br from-white via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 p-6 sm:p-8 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl -z-0 pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black font-['Courier_New',monospace] tracking-wider text-gray-900 dark:text-white">
                  {symbol}
                </span>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {overview?.name || financial?.name || symbol}
                </span>
                {(financial?.is_equity ?? overview?.financial?.is_equity) && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                    {financial?.sector || overview?.financial?.sector} • {financial?.industry || overview?.financial?.industry}
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold tabular-nums text-gray-900 dark:text-white">
                  ${overview?.current_price ? Number(overview.current_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                </span>
                {overview && (
                  <SignalBadge signal={overview.recommendation} />
                )}
              </div>
            </div>

            {/* Overall Composite Score Gauge & Health Cards */}
            <div className="flex items-center gap-6 self-start md:self-center">
              <ScoreGauge
                score={overview?.composite_score || 50}
                size="lg"
                label="Composite Score"
              />

              <div className="hidden sm:grid grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700/60 text-center min-w-[90px]">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Technical</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white tabular-nums">
                    {technical?.score ?? overview?.technical?.score ?? '—'}
                  </p>
                  <p className="text-[11px] font-medium text-primary-500">
                    {technical?.signal ?? overview?.technical?.signal ?? 'Neutral'}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700/60 text-center min-w-[90px]">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Financial</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white tabular-nums">
                    {financial?.health_score ?? overview?.financial?.score ?? '—'}
                  </p>
                  <p className="text-[11px] font-bold text-emerald-500">
                    Grade {financial?.health_grade ?? overview?.financial?.grade ?? 'C'}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700/60 text-center min-w-[90px]">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Sentiment</p>
                  <p className="text-base font-bold text-gray-900 dark:text-white tabular-nums">
                    {overview?.sentiment?.score ?? '—'}
                  </p>
                  <p className="text-[11px] font-medium text-blue-500">
                    {overview?.sentiment?.label ?? 'Neutral'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Navigation Tabs ── */}
        <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === id
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800/50'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── TAB 1: 360° OVERVIEW (INSTANT LAZY LOAD) ── */}
        {activeTab === 'overview' && (
          tabLoading.overview && !overview ? (
            <OverviewSkeleton />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              {/* Technical Quick Card */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary-500" />
                    <h3 className="font-bold text-base text-gray-900 dark:text-white">Technical Momentum</h3>
                  </div>
                  <SignalBadge signal={overview?.technical?.signal ?? technical?.signal} />
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                    <span className="text-gray-500 dark:text-gray-400">Trend Classification</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {overview?.technical?.trend ?? technical?.trend?.label ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                    <span className="text-gray-500 dark:text-gray-400">RSI (14-day)</span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                      {overview?.technical?.rsi ?? technical?.rsi?.value ?? '—'} ({overview?.technical?.rsi_condition ?? technical?.rsi?.condition ?? 'Neutral'})
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                    <span className="text-gray-500 dark:text-gray-400">MACD Crossover</span>
                    <span className={`font-semibold ${(overview?.technical?.macd_crossover ?? technical?.macd?.crossover) === 'Bullish' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {overview?.technical?.macd_crossover ?? technical?.macd?.crossover ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Support / Resistance</span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                      ${overview?.technical?.support ?? technical?.key_levels?.support ?? '—'} / ${overview?.technical?.resistance ?? technical?.key_levels?.resistance ?? '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Solvency Card */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-500" />
                    <h3 className="font-bold text-base text-gray-900 dark:text-white">Financial Health</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Grade {overview?.financial?.grade ?? financial?.health_grade ?? 'B'}
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                    <span className="text-gray-500 dark:text-gray-400">Trailing P/E Ratio</span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                      {overview?.financial?.pe_ratio ? `${overview.financial.pe_ratio}x` : (financial?.valuation?.trailing_pe ? `${financial.valuation.trailing_pe}x` : '—')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                    <span className="text-gray-500 dark:text-gray-400">Return on Equity (ROE)</span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                      {overview?.financial?.roe ? `${overview.financial.roe}%` : (financial?.profitability?.roe ? `${financial.profitability.roe}%` : '—')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                    <span className="text-gray-500 dark:text-gray-400">Net Profit Margin</span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                      {overview?.financial?.net_margin ? `${overview.financial.net_margin}%` : (financial?.profitability?.net_margin ? `${financial.profitability.net_margin}%` : '—')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Debt-to-Equity</span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-white">
                      {overview?.financial?.debt_to_equity ? `${overview.financial.debt_to_equity}%` : (financial?.balance_sheet?.debt_to_equity ? `${financial.balance_sheet.debt_to_equity}%` : '—')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sentiment & Catalysts Card */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-blue-500" />
                    <h3 className="font-bold text-base text-gray-900 dark:text-white">Sentiment & Catalysts</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    {overview?.sentiment?.label || 'Neutral'}
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-800 pb-2">
                    <span className="text-gray-500 dark:text-gray-400">Sentiment Score</span>
                    <span className="font-bold tabular-nums text-gray-900 dark:text-white">
                      {overview?.sentiment?.score || 50}/100
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase">Active Catalysts:</span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {overview?.sentiment?.catalysts?.length > 0 ? (
                        overview.sentiment.catalysts.map((cat, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                            {cat}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400">No major catalysts detected</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 text-xs text-gray-500 dark:text-gray-400">
                    {marketSentiment?.ollama_active
                      ? '✨ Processed via local Mistral 7B LLM (Ollama)'
                      : '⚡ Processed via Financial Sentiment Engine'}
                  </div>
                </div>
              </div>

            </div>
          )
        )}

        {/* ── TAB 2: TECHNICAL ANALYSIS (LAZY LOADED) ── */}
        {activeTab === 'technical' && (
          tabLoading.technical && !technical ? (
            <TechnicalSkeleton />
          ) : technical ? (
            <div className="space-y-6">
              {/* Top Technical Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
                  <span className="text-xs font-medium text-gray-500 uppercase">RSI (14-day)</span>
                  <p className="text-2xl font-bold mt-1 tabular-nums text-gray-900 dark:text-white">
                    {technical?.rsi?.value ?? '—'}
                  </p>
                  <span className={`text-xs font-medium ${
                    (technical?.rsi?.value ?? 50) >= 70 ? 'text-rose-500' : (technical?.rsi?.value ?? 50) <= 30 ? 'text-emerald-500' : 'text-blue-500'
                  }`}>
                    {technical?.rsi?.condition ?? 'Neutral'}
                  </span>
                </div>

                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
                  <span className="text-xs font-medium text-gray-500 uppercase">MACD Histogram</span>
                  <p className={`text-2xl font-bold mt-1 tabular-nums ${(technical?.macd?.histogram ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {(technical?.macd?.histogram ?? 0) > 0 ? `+${technical.macd.histogram}` : (technical?.macd?.histogram ?? '—')}
                  </p>
                  <span className="text-xs font-medium text-gray-500">
                    Line: {technical?.macd?.macd ?? '—'} • Sig: {technical?.macd?.signal ?? '—'}
                  </span>
                </div>

                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
                  <span className="text-xs font-medium text-gray-500 uppercase">Bollinger Band %B</span>
                  <p className="text-2xl font-bold mt-1 tabular-nums text-gray-900 dark:text-white">
                    {technical?.bollinger?.pct_b ? `${(technical.bollinger.pct_b * 100).toFixed(1)}%` : '—'}
                  </p>
                  <span className="text-xs font-medium text-gray-500">
                    Upper: ${technical?.bollinger?.upper ?? '—'}
                  </span>
                </div>

                <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
                  <span className="text-xs font-medium text-gray-500 uppercase">20-day ROC Momentum</span>
                  <p className={`text-2xl font-bold mt-1 tabular-nums ${(technical?.momentum?.roc20 ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {(technical?.momentum?.roc20 ?? 0) > 0 ? `+${technical.momentum.roc20}%` : `${technical?.momentum?.roc20 ?? 0}%`}
                  </p>
                  <span className="text-xs font-medium text-gray-500">
                    Stoch %K: {technical?.momentum?.stoch_k ?? '—'}
                  </span>
                </div>
              </div>

              {/* Moving Average Status Table */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
                <h3 className="font-bold text-base text-gray-900 dark:text-white mb-4">Moving Averages Spectrum</h3>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 text-center">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <p className="text-[11px] text-gray-400 font-semibold uppercase">EMA 9</p>
                    <p className="text-sm font-bold mt-1 tabular-nums">${technical?.moving_averages?.ema9 ?? '—'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <p className="text-[11px] text-gray-400 font-semibold uppercase">EMA 21</p>
                    <p className="text-sm font-bold mt-1 tabular-nums">${technical?.moving_averages?.ema21 ?? '—'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <p className="text-[11px] text-gray-400 font-semibold uppercase">SMA 20</p>
                    <p className="text-sm font-bold mt-1 tabular-nums">${technical?.moving_averages?.sma20 ?? '—'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <p className="text-[11px] text-gray-400 font-semibold uppercase">SMA 50</p>
                    <p className="text-sm font-bold mt-1 tabular-nums">${technical?.moving_averages?.sma50 ?? '—'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <p className="text-[11px] text-gray-400 font-semibold uppercase">EMA 50</p>
                    <p className="text-sm font-bold mt-1 tabular-nums">${technical?.moving_averages?.ema50 ?? '—'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <p className="text-[11px] text-gray-400 font-semibold uppercase">SMA 200</p>
                    <p className="text-sm font-bold mt-1 tabular-nums">${technical?.moving_averages?.sma200 ?? '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null
        )}

        {/* ── TAB 3: FINANCIAL FUNDAMENTALS & PEERS (LAZY LOADED) ── */}
        {activeTab === 'financial' && (
          tabLoading.financial && !financial ? (
            <FinancialSkeleton />
          ) : financial ? (
            <div className="space-y-6">
              {financial.is_equity ? (
                <>
                  {/* Ratio Sections Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                    {/* Valuation Multiples */}
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                      <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 text-primary-500" />
                        Valuation Multiples
                      </h3>
                      <div className="space-y-2.5 pt-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Trailing P/E</span>
                          <span className="font-bold tabular-nums">{financial.valuation?.trailing_pe ? `${financial.valuation.trailing_pe}x` : '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Forward P/E</span>
                          <span className="font-bold tabular-nums">{financial.valuation?.forward_pe ? `${financial.valuation.forward_pe}x` : '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Price to Book (P/B)</span>
                          <span className="font-bold tabular-nums">{financial.valuation?.price_to_book ? `${financial.valuation.price_to_book}x` : '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">EV / EBITDA</span>
                          <span className="font-bold tabular-nums">{financial.valuation?.enterprise_to_ebitda ? `${financial.valuation.enterprise_to_ebitda}x` : '—'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-500">PEG Ratio</span>
                          <span className="font-bold tabular-nums">{financial.valuation?.peg_ratio || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Profitability Margins */}
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                      <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                        Profitability & Returns
                      </h3>
                      <div className="space-y-2.5 pt-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Return on Equity (ROE)</span>
                          <span className="font-bold tabular-nums text-emerald-500">{financial.profitability?.roe ? `${financial.profitability.roe}%` : '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Return on Assets (ROA)</span>
                          <span className="font-bold tabular-nums">{financial.profitability?.roa ? `${financial.profitability.roa}%` : '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Gross Margin</span>
                          <span className="font-bold tabular-nums">{financial.profitability?.gross_margin ? `${financial.profitability.gross_margin}%` : '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Operating Margin</span>
                          <span className="font-bold tabular-nums">{financial.profitability?.operating_margin ? `${financial.profitability.operating_margin}%` : '—'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-500">Net Profit Margin</span>
                          <span className="font-bold tabular-nums text-emerald-500">{financial.profitability?.net_margin ? `${financial.profitability.net_margin}%` : '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Solvency & Balance Sheet */}
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
                      <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        Balance Sheet Solvency
                      </h3>
                      <div className="space-y-2.5 pt-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Debt-to-Equity</span>
                          <span className="font-bold tabular-nums">{financial.balance_sheet?.debt_to_equity ? `${financial.balance_sheet.debt_to_equity}%` : '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Current Ratio</span>
                          <span className="font-bold tabular-nums">{financial.balance_sheet?.current_ratio ? `${financial.balance_sheet.current_ratio}x` : '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Quick Ratio</span>
                          <span className="font-bold tabular-nums">{financial.balance_sheet?.quick_ratio ? `${financial.balance_sheet.quick_ratio}x` : '—'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-gray-500">Revenue Growth (YoY)</span>
                          <span className="font-bold tabular-nums text-emerald-500">{financial.growth?.revenue_growth_yoy ? `+${financial.growth.revenue_growth_yoy}%` : '—'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-gray-500">Dividend Yield</span>
                          <span className="font-bold tabular-nums">{financial.dividend_yield ? `${financial.dividend_yield}%` : '0%'}</span>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Industry Peer Comparison Table */}
                  {peers?.peers?.length > 0 && (
                    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-bold text-base text-gray-900 dark:text-white">Sector Peer Comparison Matrix</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Benchmarked against leading {peers.sector} companies</p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 text-xs font-semibold uppercase">
                              <th className="pb-3">Symbol</th>
                              <th className="pb-3">Company</th>
                              <th className="pb-3">Trailing P/E</th>
                              <th className="pb-3">Forward P/E</th>
                              <th className="pb-3">P/B</th>
                              <th className="pb-3">Net Margin</th>
                              <th className="pb-3">ROE</th>
                              <th className="pb-3">Health Grade</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {peers.peers.map((p) => (
                              <tr
                                key={p.symbol}
                                onClick={() => handleSelectSymbol(p.symbol)}
                                className={`cursor-pointer transition-colors ${
                                  p.is_target
                                    ? 'bg-primary-500/10 font-bold text-primary-600 dark:text-primary-400'
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <td className="py-3 font-mono">{p.symbol} {p.is_target && '★'}</td>
                                <td className="py-3 text-xs">{p.name}</td>
                                <td className="py-3 tabular-nums">{p.pe_ratio ? `${p.pe_ratio}x` : '—'}</td>
                                <td className="py-3 tabular-nums">{p.forward_pe ? `${p.forward_pe}x` : '—'}</td>
                                <td className="py-3 tabular-nums">{p.price_to_book ? `${p.price_to_book}x` : '—'}</td>
                                <td className="py-3 tabular-nums">{p.net_margin ? `${p.net_margin}%` : '—'}</td>
                                <td className="py-3 tabular-nums">{p.roe ? `${p.roe}%` : '—'}</td>
                                <td className="py-3">
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                    {p.health_grade}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-200 dark:border-gray-800 text-center space-y-3">
                  <Cpu className="w-10 h-10 text-amber-500 mx-auto" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Digital Asset Fundamentals</h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    Market capitalization, circulating supply economics, and network activity metrics are tracked for {symbol}. Balance sheet P/E ratios apply to corporate equities.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto pt-4 text-left">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <span className="text-[10px] text-gray-400 font-semibold uppercase">Market Cap</span>
                      <p className="text-sm font-bold mt-1">${((financial?.market_cap ?? 0) / 1e9).toFixed(2)}B</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <span className="text-[10px] text-gray-400 font-semibold uppercase">24h Volume</span>
                      <p className="text-sm font-bold mt-1">${((financial?.volume_24h ?? 0) / 1e6).toFixed(2)}M</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <span className="text-[10px] text-gray-400 font-semibold uppercase">Supply Mined</span>
                      <p className="text-sm font-bold mt-1">{financial?.supply_mined_pct ? `${financial.supply_mined_pct}%` : '100%'}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                      <span className="text-[10px] text-gray-400 font-semibold uppercase">Network Grade</span>
                      <p className="text-sm font-bold mt-1 text-emerald-500">Grade {financial?.health_grade ?? 'A'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null
        )}

        {/* ── TAB 4: NEWS SENTIMENT & CATALYSTS (LAZY LOADED) ── */}
        {activeTab === 'sentiment' && (
          tabLoading.sentiment && !marketSentiment ? (
            <SentimentSkeleton />
          ) : marketSentiment ? (
            <div className="space-y-6">

              {/* Sentiment Macro Distribution */}
              <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-bold text-base text-gray-900 dark:text-white">Macro News Sentiment Barometer</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Analyzed across active financial headlines from Bloomberg, CNBC, Reuters & CoinDesk
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-semibold">
                      {marketSentiment.ollama_active ? '🤖 Local Mistral 7B (Ollama)' : '⚡ High-Speed Financial NLP'}
                    </span>
                  </div>
                </div>

                {/* Distribution Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-emerald-500">Bullish: {marketSentiment.bullish_count ?? 0}</span>
                    <span className="text-blue-500">Neutral: {marketSentiment.neutral_count ?? 0}</span>
                    <span className="text-rose-500">Bearish: {marketSentiment.bearish_count ?? 0}</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
                    <div
                      style={{ width: `${(marketSentiment.bullish_count / Math.max(1, marketSentiment.recent_articles?.length || 1)) * 100}%` }}
                      className="bg-emerald-500 h-full transition-all duration-500"
                    />
                    <div
                      style={{ width: `${(marketSentiment.neutral_count / Math.max(1, marketSentiment.recent_articles?.length || 1)) * 100}%` }}
                      className="bg-blue-500 h-full transition-all duration-500"
                    />
                    <div
                      style={{ width: `${(marketSentiment.bearish_count / Math.max(1, marketSentiment.recent_articles?.length || 1)) * 100}%` }}
                      className="bg-rose-500 h-full transition-all duration-500"
                    />
                  </div>
                </div>

                {/* Top Catalyst Badges */}
                <div className="mt-6">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Top Detected Market Catalysts:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {marketSentiment.top_catalysts?.map((cat, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-xl text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 flex items-center gap-1.5"
                      >
                        <Zap className="w-3 h-3 text-amber-500" />
                        {cat.name} ({cat.count})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Analyzed Articles Feed */}
              <div className="space-y-3">
                <h3 className="font-bold text-base text-gray-900 dark:text-white">Recent Articles with AI Sentiment Scoring</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {marketSentiment.recent_articles?.map((art) => (
                    <div
                      key={art.id}
                      className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <a
                          href={art.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-gray-900 dark:text-white hover:text-primary-500 transition-colors line-clamp-2"
                        >
                          {art.title}
                        </a>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex-shrink-0 ${
                          art.score >= 58
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : art.score <= 42
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        }`}>
                          {art.score} • {art.label}
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        "{art.reasoning}"
                      </p>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800/80 text-[11px] text-gray-400">
                        <span>{art.source}</span>
                        <div className="flex gap-1">
                          {art.catalysts?.map((c, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : null
        )}

    </div>
  );
}
