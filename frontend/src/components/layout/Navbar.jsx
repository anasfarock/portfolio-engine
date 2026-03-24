import React from 'react';
import { Link } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle';
import AvatarDropdown from '../ui/AvatarDropdown';
import { Activity } from 'lucide-react';

export default function Navbar() {
    return (
        <nav className="bg-white dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors duration-300 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">

                    {/* Logo area */}
                    <div className="flex">
                        <Link to="/dashboard" className="flex-shrink-0 flex items-center gap-2 group">
                            <span className="font-bold text-xl text-gray-900 dark:text-white hidden sm:block font-['Courier_New',monospace]">
                                SPAIE
                            </span>
                        </Link>
                    </div>

                    {/* Right side navigation items */}
                    <div className="flex items-center gap-4">
                        <ThemeToggle />

                        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>

                        <AvatarDropdown />
                    </div>

                </div>
            </div>
        </nav>
    );
}
