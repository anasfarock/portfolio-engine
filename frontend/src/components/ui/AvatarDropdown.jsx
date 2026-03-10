import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { User, Settings, Key, LogOut } from 'lucide-react';

export default function AvatarDropdown() {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getInitials = (name, email) => {
        if (name) {
            return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        }
        return email ? email.substring(0, 2).toUpperCase() : '??';
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-300 dark:focus:ring-primary-800 transition-colors shadow-sm overflow-hidden"
            >
                {user?.avatar_url ? (
                    <img
                        src={user.avatar_url}
                        alt="User Avatar"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <span className="text-sm font-medium tracking-wide">
                        {user ? getInitials(user.full_name, user.email) : 'U'}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl bg-white dark:bg-gray-800 shadow-xl ring-1 ring-black ring-opacity-5 dark:ring-white dark:ring-opacity-10 divide-y divide-gray-100 dark:divide-gray-700 focus:outline-none z-50">
                    <div className="px-4 py-3">
                        <p className="text-sm text-gray-900 dark:text-white truncate font-medium">
                            {user?.full_name || 'Portfolio User'}
                        </p>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                            {user?.email}
                        </p>
                    </div>

                    <div className="py-1">
                        <Link
                            to="/profile"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left"
                        >
                            <User className="mr-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
                            Your Profile
                        </Link>
                        <Link
                            to="/api-keys"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left cursor-not-allowed opacity-60"
                        >
                            <Key className="mr-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
                            Manage API Keys (Soon)
                        </Link>
                        <Link
                            to="/settings"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left cursor-not-allowed opacity-60"
                        >
                            <Settings className="mr-3 h-4 w-4 text-gray-400 dark:text-gray-500" />
                            Settings (Soon)
                        </Link>
                    </div>

                    <div className="py-1">
                        <button
                            onClick={handleLogout}
                            className="flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 w-full text-left"
                        >
                            <LogOut className="mr-3 h-4 w-4 text-red-500 dark:text-red-400" />
                            Sign out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
