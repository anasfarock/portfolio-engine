import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import ProtectedLayout from './components/layout/ProtectedLayout';

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
  return (
    <div className="w-full animate-fade-in relative">
      <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Dashboard Overview</h1>
      <p className="mb-8 text-gray-600 dark:text-gray-400">Welcome to your Portfolio Analysis Engine. Select an option from your profile menu to manage your account.</p>

      {/* Decorative background elements matching the login page theme */}
      <div className="absolute top-20 right-0 w-72 h-72 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob pointer-events-none"></div>
      <div className="absolute bottom-20 left-0 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 dark:opacity-10 pointer-events-none"></div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Total Value</h3>
          <p className="text-3xl font-black text-primary-600 mt-2">$0.00</p>
        </div>
        <div className="glass-panel p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Active Positions</h3>
          <p className="text-3xl font-black text-indigo-600 mt-2">0</p>
        </div>
        <div className="glass-panel p-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">24h Return</h3>
          <p className="text-3xl font-black text-green-500 mt-2">0.00%</p>
        </div>
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
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
