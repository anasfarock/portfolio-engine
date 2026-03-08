import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ThemeToggle from './components/ThemeToggle';

function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 text-gray-900 dark:text-white">Loading...</div>;

  if (!token) return <Navigate to="/login" />;

  return children;
}

function Dashboard() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 dark:bg-gray-900 transition-colors duration-300 relative">
      <ThemeToggle />
      <div className="glass-panel p-8 sm:rounded-2xl w-full max-w-lg text-center relative z-10">
        <h1 className="text-3xl font-bold mb-4 text-primary-600 dark:text-primary-500">Dashboard</h1>
        <p className="mb-8 text-gray-600 dark:text-gray-300">Welcome to your Portfolio Analysis Engine!</p>
        <button className="btn-primary" onClick={logout}>Sign Out</button>
      </div>

      {/* Decorative background elements matching the login page theme */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 dark:opacity-10"></div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
