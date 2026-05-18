import React from 'react';
import { LogIn, Clock } from 'lucide-react';

/**
 * SessionExpiredModal
 * Shown when any API call returns 401 (token expired / invalid).
 * Clicking "Sign In Again" redirects to /login.
 */
export default function SessionExpiredModal({ onLogin }) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl
        w-full max-w-sm p-8 flex flex-col items-center gap-5 animate-[fadeInScale_0.2s_ease-out]">

        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>

        {/* Text */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            Session Expired
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your login session has expired. Please sign in again to continue.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={onLogin}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl
            bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm
            transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          <LogIn className="w-4 h-4" />
          Sign In Again
        </button>
      </div>

      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.93); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
