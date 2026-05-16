import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import AvatarDropdown from '../ui/AvatarDropdown';
import { Activity, BarChart2 } from 'lucide-react';

export default function Navbar() {
    const location = useLocation();
    const isMarkets = location.pathname === '/markets';
    const isDashboard = location.pathname === '/dashboard';

    return (
        <nav className="bg-white dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors duration-300 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">

                    {/* Logo + nav links */}
                    <div className="flex items-center gap-6">
                        <Link to="/dashboard" className="flex-shrink-0 flex items-center gap-2 group">
                            <span className="font-bold text-xl text-gray-900 dark:text-white hidden sm:block font-['Courier_New',monospace]">
                                SPAIE
                            </span>
                        </Link>

                        {/* Nav links */}
                        <div className="hidden sm:flex items-center gap-1">
                            <Link
                                to="/dashboard"
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                                    ${isDashboard
                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            >
                                <Activity className="w-4 h-4" />
                                Dashboard
                            </Link>
                            <Link
                                to="/markets"
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                                    ${isMarkets
                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                            >
                                <BarChart2 className="w-4 h-4" />
                                Markets
                            </Link>
                        </div>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-4">
                        <AvatarDropdown />
                    </div>

                </div>
            </div>
        </nav>
    );
}
