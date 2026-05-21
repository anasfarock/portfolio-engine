import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AvatarDropdown from '../ui/AvatarDropdown';
import { Activity, BarChart2, Newspaper, Menu, X } from 'lucide-react';

const NAV_LINKS = [
    { to: '/dashboard', label: 'Dashboard', icon: Activity },
    { to: '/markets',   label: 'Markets',   icon: BarChart2 },
    { to: '/news',      label: 'News',      icon: Newspaper },
];

export default function Navbar() {
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const drawerRef = useRef(null);

    // Close drawer on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    // Close drawer on outside click
    useEffect(() => {
        if (!mobileOpen) return;
        const handleClick = (e) => {
            if (drawerRef.current && !drawerRef.current.contains(e.target)) {
                setMobileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [mobileOpen]);

    const isActive = (path) => location.pathname === path;

    const linkClass = (path) =>
        `flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
            isActive(path)
                ? 'bg-primary-50 dark:bg-primary-900/25 text-primary-600 dark:text-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
        }`;

    return (
        <nav
            ref={drawerRef}
            className="bg-white dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors duration-300 shadow-sm"
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">

                    {/* ── LEFT: hamburger (mobile) | logo+links (desktop) ── */}
                    <div className="flex items-center gap-3">
                        {/* Hamburger — mobile only */}
                        <button
                            onClick={() => setMobileOpen((o) => !o)}
                            className="sm:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            aria-label="Toggle menu"
                        >
                            {mobileOpen
                                ? <X className="w-5 h-5" />
                                : <Menu className="w-5 h-5" />
                            }
                        </button>

                        {/* Logo — desktop only */}
                        <Link
                            to="/dashboard"
                            className="hidden sm:flex items-center gap-2 flex-shrink-0 group"
                        >
                            <span className="font-bold text-xl text-gray-900 dark:text-white font-['Courier_New',monospace] tracking-widest">
                                SPAIE
                            </span>
                        </Link>

                        {/* Nav links — desktop only */}
                        <div className="hidden sm:flex items-center gap-1 ml-2">
                            {NAV_LINKS.map(({ to, label, icon: Icon }) => (
                                <Link key={to} to={to} className={linkClass(to)}>
                                    <Icon className="w-4 h-4" />
                                    {label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* ── CENTRE: title — mobile only ── */}
                    <Link
                        to="/dashboard"
                        className="sm:hidden absolute left-1/2 -translate-x-1/2 font-bold text-lg text-gray-900 dark:text-white font-['Courier_New',monospace] tracking-widest"
                    >
                        SPAIE
                    </Link>

                    {/* ── RIGHT: avatar ── */}
                    <div className="flex items-center">
                        <AvatarDropdown />
                    </div>
                </div>
            </div>

            {/* ── Mobile drawer ── */}
            <div
                className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${
                    mobileOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'
                }`}
            >
                <div className="px-4 pb-4 pt-1 flex flex-col gap-1 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/95">
                    {NAV_LINKS.map(({ to, label, icon: Icon }) => (
                        <Link key={to} to={to} className={linkClass(to)}>
                            <Icon className="w-4 h-4" />
                            {label}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}
