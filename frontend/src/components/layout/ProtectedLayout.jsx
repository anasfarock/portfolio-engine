import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function ProtectedLayout() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 flex flex-col">
            <Navbar />

            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
                <Outlet />
            </main>
        </div>
    );
}
