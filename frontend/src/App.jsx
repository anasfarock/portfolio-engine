import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import ApiKeys from './pages/ApiKeys';
import ProtectedLayout from './components/layout/ProtectedLayout';
import GlassPanel from './components/ui/GlassPanel';
import AssetTable from './components/portfolio/AssetTable';
import { RefreshCw } from 'lucide-react';

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-300">
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
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      
      // Auto-negotiate live stream sync with API keys FIRST natively!
      try {
        await axios.post('http://localhost:8000/portfolio/sync', {}, { headers: { Authorization: `Bearer ${token}` } });
      } catch (syncErr) {
        console.error("Auto-sync background pipeline failed: ", syncErr);
      }

      const [summaryRes, assetsRes] = await Promise.all([
        axios.get('http://localhost:8000/portfolio/summary', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://localhost:8000/portfolio/assets', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      setSummary(summaryRes.data);
      setAssets(assetsRes.data);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let pollingInterval;
    if (token) {
      // Intial boot up load
      fetchDashboardData();
      
      // Real-time market data streaming (15 seconds)
      pollingInterval = setInterval(() => {
        fetchDashboardData(true);
      }, 15000);
    }
    
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [token, fetchDashboardData]);

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

  return (
    <div className="w-full animate-fade-in relative">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h1>
        <button 
          onClick={() => fetchDashboardData(false)}
          disabled={loading}
          className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          title="Manual Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-primary-500' : ''}`} />
        </button>
      </div>
      <p className="mb-8 text-gray-600 dark:text-gray-400">Manage your Alpaca automated broker connections to sync your portfolio.</p>

      {/* Decorative background elements matching the login page theme */}
      <div className="absolute top-20 right-0 w-72 h-72 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob pointer-events-none"></div>
      <div className="absolute bottom-20 left-0 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 dark:opacity-10 pointer-events-none"></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Total Capital</h3>
          <p className="text-3xl font-black text-green-600 dark:text-green-400 mt-2">
            ${loading ? "..." : (summary.total_capital || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="glass-panel p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Assets Value</h3>
          <p className="text-3xl font-black text-primary-600 mt-2">
            ${loading ? "..." : summary.total_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="glass-panel p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active Positions</h3>
          <p className="text-3xl font-black text-indigo-600 mt-2">{loading ? "..." : summary.active_positions}</p>
        </div>
        <div className="glass-panel p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">24h Return</h3>
          <p className={`text-3xl font-black mt-2 ${summary.day_return_perc >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {loading ? "..." : `${summary.day_return_perc > 0 ? '+' : ''}${summary.day_return_perc.toFixed(2)}%`}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Current Holdings</h2>
        <GlassPanel className="overflow-hidden">
          <AssetTable
            assets={assets}
            onDelete={handleDeleteAsset}
            loading={loading}
          />
        </GlassPanel>
      </div>
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

          {/* Protected Routes Wrapper */}
          <Route element={
            <ProtectedRoute>
              <ProtectedLayout />
            </ProtectedRoute>
          }>
            {/* These routes render inside the <Outlet /> of ProtectedLayout */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/api-keys" element={<ApiKeys />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
