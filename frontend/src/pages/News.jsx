import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Newspaper, Search, Filter, RefreshCw, ExternalLink, Clock, Tag, Calendar } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import EconomicCalendar from '../components/news/EconomicCalendar';

const BASE_URL = 'http://localhost:8000';

// Module-level cache to survive navigation
const newsCache = {
  articles: [],
  page: 1,
  hasMore: true,
  lastUpdated: null,
  sector: '',
  source: '',
};

export default function News() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('news');
  
  // Initialize from cache
  const [articles, setArticles] = useState(() => newsCache.articles);
  const [page, setPage] = useState(() => newsCache.page);
  const [hasMore, setHasMore] = useState(() => newsCache.hasMore);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Filters
  const [sector, setSector] = useState(() => newsCache.sector);
  const [source, setSource] = useState(() => newsCache.source);
  const [availableSources, setAvailableSources] = useState([]);
  
  const SECTORS = ['Technology', 'Financial', 'Crypto', 'Macro', 'Consumer', 'Automotive', 'Retail', 'General'];

  // Fetch sources once on mount
  useEffect(() => {
    axios.get(`${BASE_URL}/news/sources`)
      .then(res => setAvailableSources(res.data))
      .catch(err => console.error("Failed to fetch sources", err));
  }, []);

  const fetchNews = useCallback(async (pageNum = 1, append = false, currentSector = sector, currentSource = source) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    
    setError(null);
    try {
      const params = { page: pageNum, limit: 12 };
      if (currentSector) params.sector = currentSector;
      if (currentSource) params.source = currentSource;
      
      const res = await axios.get(`${BASE_URL}/news`, { params });
      const incoming = res.data.data;
      
      let newArticles;
      if (append) {
        newArticles = [...articles, ...incoming];
      } else {
        newArticles = incoming;
      }
      
      const more = res.data.page < res.data.pages;
      
      // Update state
      setArticles(newArticles);
      setPage(pageNum);
      setHasMore(more);
      
      // Update cache
      newsCache.articles = newArticles;
      newsCache.page = pageNum;
      newsCache.hasMore = more;
      newsCache.lastUpdated = new Date();
      newsCache.sector = currentSector;
      newsCache.source = currentSource;
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load news.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [articles, sector, source]);

  // Initial fetch if cache is empty
  useEffect(() => {
    if (articles.length === 0) {
      fetchNews(1, false, sector, source);
    }
  }, []); // Only on mount

  // Handle filter changes
  const handleFilterChange = (newSector, newSource) => {
    setSector(newSector);
    setSource(newSource);
    setArticles([]); // clear immediately for visual feedback
    fetchNews(1, false, newSector, newSource);
  };

  const handleManualRefresh = async () => {
    if (!token) return; // Need auth for manual refresh
    setRefreshing(true);
    try {
      await axios.post(`${BASE_URL}/news/refresh`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Fetch page 1 again
      await fetchNews(1, false, sector, source);
    } catch (err) {
      setError('Failed to trigger manual refresh.');
    } finally {
      setRefreshing(false);
    }
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'Z'); // Assume UTC from backend
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <Newspaper className="w-7 h-7 text-primary-500" />
            Financial News
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Aggregated real-time market news and crypto updates.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {newsCache.lastUpdated && (
            <span className="text-xs text-gray-400 hidden sm:block">
              Updated {newsCache.lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleManualRefresh}
            disabled={refreshing || !token}
            title={!token ? "Login required to refresh" : "Fetch latest from RSS"}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
              text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-100 dark:border-gray-800 mb-6 scrollbar-hide">
        <button
          onClick={() => setActiveTab('news')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'news'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          <Newspaper className="w-4 h-4" />
          News Feed
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'calendar'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Economic Calendar
        </button>
      </div>

      {activeTab === 'news' ? (
        <>
          {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-900/60 p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 mr-2">
          <Filter className="w-4 h-4" /> Filters
        </div>
        
        <select 
          value={sector}
          onChange={(e) => handleFilterChange(e.target.value, source)}
          className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2"
        >
          <option value="">All Sectors</option>
          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        
        <select 
          value={source}
          onChange={(e) => handleFilterChange(sector, e.target.value)}
          className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2"
        >
          <option value="">All Sources</option>
          {availableSources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        
        {(sector || source) && (
          <button 
            onClick={() => handleFilterChange('', '')}
            className="text-xs text-primary-500 hover:text-primary-600 font-medium px-2"
          >
            Clear Filters
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Article Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 h-64 flex flex-col">
               <div className="flex gap-4">
                  <div className="w-20 h-20 bg-gray-200 dark:bg-gray-800 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-3 py-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
                    <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-4/5" />
                  </div>
               </div>
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center justify-center border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-900/20">
          <Newspaper className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No articles found</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Try adjusting your filters or sync for new updates.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {articles.map((article) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col bg-white dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 hover:shadow-lg transition-all duration-300 hover:border-primary-200 dark:hover:border-primary-900/50"
              >
                <div className="flex gap-4 mb-4 flex-1">
                  {/* Thumbnail */}
                  {article.image_url ? (
                    <img 
                      src={article.image_url} 
                      alt="" 
                      className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl flex-shrink-0 bg-gray-100 dark:bg-gray-800"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center flex-shrink-0 text-gray-400">
                      <Newspaper className="w-8 h-8 opacity-50 mb-1" />
                    </div>
                  )}
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {article.source}
                      </span>
                      {article.sector && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400">
                          {article.sector}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base leading-snug line-clamp-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {article.title}
                    </h3>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-auto pt-4 border-t border-gray-50 dark:border-gray-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatRelativeTime(article.published_at)}
                    </div>
                    
                    {/* Tickers */}
                    {article.tickers && (
                      <div className="flex gap-1.5 flex-wrap">
                        {article.tickers.split(',').slice(0, 3).map(ticker => (
                          <span key={ticker} className="flex items-center text-[11px] font-mono font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 px-1.5 py-0.5 rounded">
                            <Tag className="w-3 h-3 mr-0.5 opacity-70" />
                            {ticker}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <ExternalLink className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 transition-colors" />
                </div>
              </a>
            ))}
          </div>
          
          {hasMore && (
            <div className="pt-6 flex justify-center">
              <button
                onClick={() => fetchNews(page + 1, true, sector, source)}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {loadingMore && <RefreshCw className="w-4 h-4 animate-spin" />}
                {loadingMore ? 'Loading...' : 'Load More Articles'}
              </button>
            </div>
          )}
        </>
      )}
        </>
      ) : (
        <EconomicCalendar />
      )}
    </div>
  );
}
