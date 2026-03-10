import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle';
import AvatarDropdown from '../ui/AvatarDropdown';
import { Activity } from 'lucide-react';

export default function ProtectedLayout() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 flex flex-col">
            {/* Top Navigation Bar */}
            <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40 transition-colors duration-300 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">

                        {/* Logo area */}
                        <div className="flex">
                            <Link to="/dashboard" className="flex-shrink-0 flex items-center gap-2 group">
                                <div className="p-2 bg-primary-100 dark:bg-primary-900/50 rounded-lg group-hover:bg-primary-200 dark:group-hover:bg-primary-800/60 transition-colors">
                                    <Activity className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                                </div>
                                <span className="font-bold text-xl text-gray-900 dark:text-white hidden sm:block">
                                    Portfolio Engine
                                </span>
                            </Link>
                        </div>

                        {/* Right side navigation items */}
                        <div className="flex items-center gap-4">
                            <div className="relative flex items-center justify-center">
                                {/* Remove absolute positioning from ThemeToggle inside the navbar for proper flow */}
                                <div className="mr-2">
                                    <ThemeToggle className="relative top-0 right-0" />
                                </div>
                            </div>

                            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

                            <AvatarDropdown />
                        </div>

                    </div>
                </div>
            </nav>

            {/* Main Content Area */}
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
                <Outlet />
            </main>
        </div>
    );
}
