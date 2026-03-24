import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import ApiKeys from './pages/ApiKeys';
import Settings from './pages/Settings';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';
import ProtectedLayout from './components/layout/ProtectedLayout';
import GlassPanel from './components/ui/GlassPanel';
import AssetTable from './components/portfolio/AssetTable';
import TradeHistory from './components/portfolio/TradeHistory';
import { RefreshCw } from 'lucide-react';

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center dark:bg-black text-gray-900 dark:text-white transition-colors duration-300">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-medium">Loading...</p>
      </div>
    </div>
  );

  if (!token) return <Navigate to="/login" />;

  return children;
}

function Dashboard() {
  const { token } = useAuth();

  const [summary, setSummary] = useState({
    total_capital: 0.0,
    total_value: 0.0,
    active_positions: 0,
    day_return_perc: 0.0,
    day_return_abs: 0.0
  });
  const [assets, setAssets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState([]);
  const [selectedBrokers, setSelectedBrokers] = useState(['ALL']);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  const [prefs, setPrefs] = useState(() => {
    try {
      const cached = localStorage.getItem('portfolio_prefs');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return { sync_interval: 15, default_view: 'dashboard' };
  });

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);

      // Auto-negotiate live stream sync with API keys FIRST natively!
      try {
        await axios.post('http://localhost:8000/portfolio/sync', {}, { headers: { Authorization: `Bearer ${token}` } });
      } catch (syncErr) {
        console.error("Auto-sync background pipeline failed: ", syncErr);
      }

      const [summaryRes, assetsRes, txRes, prefsRes] = await Promise.all([
        axios.get('http://localhost:8000/portfolio/summary', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:8000/portfolio/assets', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:8000/portfolio/transactions', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:8000/users/me/preferences', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: {} }))
      ]);

      setSummary(summaryRes.data);
      setAssets(assetsRes.data);
      setTransactions(txRes.data);
      if (prefsRes.data && prefsRes.data.default_view) {
          setPrefs(prefsRes.data);
          localStorage.setItem('portfolio_prefs', JSON.stringify(prefsRes.data));
      }

      // Fetch credentials to build the broker filter options
      try {
        const credsRes = await axios.get('http://localhost:8000/brokers/credentials', { headers: { Authorization: `Bearer ${token}` } });
        setCredentials(credsRes.data);
      } catch (e) { /* silent */ }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial load
  // Initial load
  useEffect(() => {
    if (token) fetchDashboardData();
  }, [token, fetchDashboardData]);

  // Dynamic Polling Interval based on preferences
  useEffect(() => {
    if (!token) return;
    
    // Convert prefs.sync_interval (seconds) to milliseconds
    const intervalMs = (prefs.sync_interval || 15) * 1000;
    const pollingInterval = setInterval(() => {
      fetchDashboardData(true);
    }, intervalMs);

    return () => clearInterval(pollingInterval);
  }, [token, fetchDashboardData, prefs.sync_interval]);

  const handleDeleteAsset = async (assetId) => {
    if (!window.confirm("Are you sure you want to remove this position?")) return;

    try {
      await axios.delete(`http://localhost:8000/portfolio/assets/${assetId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchDashboardData();
    } catch (err) {
      console.error("Failed to delete asset", err);
    }
  };

  // Derive unique broker names from credentials for the filter
  const brokerOptions = [...new Set(credentials.map(c => c.broker_name))];

  const toggleBroker = (name) => {
    if (name === 'ALL') {
      setSelectedBrokers(['ALL']);
      return;
    }
    setSelectedBrokers(prev => {
      const withoutAll = prev.filter(b => b !== 'ALL');
      const already = withoutAll.includes(name);
      const next = already ? withoutAll.filter(b => b !== name) : [...withoutAll, name];
      return next.length === 0 ? ['ALL'] : next;
    });
  };

  // Filter transactions the same as assets
  const filteredTransactions = selectedBrokers.includes('ALL')
    ? transactions
    : transactions.filter(t => selectedBrokers.includes(t.broker_name));

  const filteredAssets = selectedBrokers.includes('ALL')
    ? assets
    : assets.filter(a => selectedBrokers.includes(a.broker_name));

  // Label for the dropdown trigger button
  const filterLabel = selectedBrokers.includes('ALL') ? 'All Accounts' : `${selectedBrokers.length} Account${selectedBrokers.length > 1 ? 's' : ''}`;

  // Compute summary metrics from filteredAssets so filter affects ALL tiles
  const filteredSummary = (() => {
    if (selectedBrokers.includes('ALL')) return summary;

    // Total Capital: sum total_capital from only the matching credentials
    const filteredCapital = credentials
      .filter(c => selectedBrokers.includes(c.broker_name))
      .reduce((sum, c) => sum + parseFloat(c.total_capital || 0), 0);

    // Assets Value: sum (qty * current_price) for filtered assets
    const filteredValue = filteredAssets.reduce((sum, a) => {
      const qty = parseFloat(a.quantity || 0);
      const price = parseFloat(a.current_price || a.average_buy_price || 0);
      return sum + qty * price;
    }, 0);

    // P&L: sum of pnl
    const totalPnl = filteredAssets.reduce((sum, a) => sum + parseFloat(a.pnl || 0), 0);
    const costBasis = filteredAssets.reduce((sum, a) => {
      return sum + parseFloat(a.quantity || 0) * parseFloat(a.average_buy_price || 0);
    }, 0);
    const dayReturnPerc = costBasis > 0 ? (totalPnl / costBasis) * 100 : 0;

    return {
      total_capital: filteredCapital,
      total_value: filteredValue,
      active_positions: filteredAssets.length,
      day_return_perc: dayReturnPerc,
      day_return_abs: totalPnl,
    };
  })();

  return (
    <div className="w-full animate-fade-in relative">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h1>
        <div className="flex items-center gap-2">
          {/* Broker Account Dropdown */}
          {brokerOptions.length >= 1 && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(o => !o)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors"
              >
                <span>{filterLabel}</span>
                <svg className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>

              {dropdownOpen && (
                <>
                  {/* Backdrop to close on outside click */}
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-52 z-20 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden">
                    <div className="px-3 py-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
                      Filter by Account
                    </div>
                    {/* All option */}
                    <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBrokers.includes('ALL')}
                        onChange={() => toggleBroker('ALL')}
                        className="accent-primary-600 w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">All Accounts</span>
                    </label>
                    <div className="border-t border-gray-100 dark:border-gray-800" />
                    {brokerOptions.map(broker => (
                      <label key={broker} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedBrokers.includes(broker)}
                          onChange={() => toggleBroker(broker)}
                          className="accent-primary-600 w-4 h-4"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{broker}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => fetchDashboardData(false)}
            disabled={loading}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            title="Manual Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-primary-500' : ''}`} />
          </button>
        </div>
      </div>


      {/* Decorative background elements matching the login page theme */}
      <div className="absolute top-20 right-0 w-72 h-72 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob pointer-events-none dark:hidden"></div>
      <div className="absolute bottom-20 left-0 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 dark:hidden pointer-events-none"></div>

      {prefs.default_view !== 'holdings' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-panel p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Total Capital</h3>
            <p className="text-3xl font-black text-green-600 dark:text-green-400 mt-2">
              ${loading ? "..." : (filteredSummary.total_capital || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="glass-panel p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assets Value</h3>
            <p className="text-3xl font-black text-primary-600 mt-2">
              ${loading ? "..." : (filteredSummary?.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="glass-panel p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active Positions</h3>
            <p className="text-3xl font-black text-indigo-600 mt-2">{loading ? "..." : filteredSummary.active_positions}</p>
          </div>
          <div className="glass-panel p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">24h Return</h3>
            <p className={`text-3xl font-black mt-2 ${filteredSummary.day_return_perc >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {loading ? "..." : `${filteredSummary.day_return_perc > 0 ? '+' : ''}${filteredSummary.day_return_perc.toFixed(2)}%`}
            </p>
          </div>
        </div>
      )}

      <div className={`mt-8 ${prefs.default_view === 'holdings' ? 'pt-4' : ''}`}>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Current Holdings</h2>
        <GlassPanel className="overflow-hidden">
          <AssetTable
            assets={filteredAssets}
            onDelete={handleDeleteAsset}
            loading={loading}
          />
        </GlassPanel>
      </div>

      {prefs.default_view !== 'holdings' && (
        <div className="mt-8 relative z-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Trade History</h2>
          <GlassPanel className="overflow-hidden relative z-0">
            <TradeHistory
              transactions={filteredTransactions}
              loading={loading}
            />
          </GlassPanel>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected Routes Wrapper */}
          <Route element={
            <ProtectedRoute>
              <ProtectedLayout />
            </ProtectedRoute>
          }>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/api-keys" element={<ApiKeys />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
