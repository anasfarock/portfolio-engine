import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Settings as SettingsIcon, Bell, PieChart, Save, Check, Download, Database, FileText, FileJson, Sun, Moon, Monitor, ShieldCheck, ShieldAlert } from 'lucide-react';
import GlassPanel from '../components/ui/GlassPanel';
import Button from '../components/ui/Button';

export default function Settings() {
    const { token, user, refetchUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');
    const [exportingJson, setExportingJson] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);

    const [mfaEnabled, setMfaEnabled] = useState(user?.mfa_enabled || false);

    useEffect(() => {
        if (user) setMfaEnabled(user.mfa_enabled);
    }, [user]);

    const [prefs, setPrefs] = useState({
        currency: 'USD',
        sync_interval: 15,
        show_chart: true,
        default_view: 'dashboard',
        notify_email: false,
        notify_price_alerts: true,
        notify_sync_complete: false,
        notify_daily_summary: false,
        notify_milestones: true
    });

    const [theme, setTheme] = useState(() => localStorage.getItem('color-theme') || 'system');

    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
        localStorage.setItem('color-theme', newTheme);

        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else if (newTheme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            // system
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    };

    useEffect(() => {
        const fetchPreferences = async () => {
            try {
                const res = await axios.get('http://localhost:8000/users/me/preferences', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPrefs(res.data);
                localStorage.setItem('portfolio_prefs', JSON.stringify(res.data));
            } catch (err) {
                console.error('Failed to load preferences', err);
                setError('Failed to load preferences');
            } finally {
                setLoading(false);
            }
        };
        fetchPreferences();
    }, [token]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setPrefs(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            const payload = {
                ...prefs,
                sync_interval: parseInt(prefs.sync_interval)
            };
            await axios.put('http://localhost:8000/users/me/preferences', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            localStorage.setItem('portfolio_prefs', JSON.stringify(payload));

            // Sync MFA state up to the server if dirtied locally
            if (mfaEnabled !== user?.mfa_enabled) {
                await axios.put('http://localhost:8000/users/me/mfa', {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                await refetchUser();
            }

            setSuccess('Preferences saved successfully!');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Save failed', err);
            setError('Failed to save preferences');
        } finally {
            setSaving(false);
        }
    };

    const handleExportJson = async () => {
        setExportingJson(true);
        setError('');
        try {
            const res = await axios.get('http://localhost:8000/users/me/export', {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `spai_export_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Export failed', err);
            setError('Failed to export data');
        } finally {
            setExportingJson(false);
        }
    };

    const handleExportPdf = async () => {
        setExportingPdf(true);
        setError('');
        try {
            const res = await axios.get('http://localhost:8000/users/me/export/pdf', {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `spai_export_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Export failed', err);
            setError('Failed to export PDF');
        } finally {
            setExportingPdf(false);
        }
    };

    if (loading) {
        return (
            <div className="w-full space-y-8 animate-pulse">
                <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded"></div>
                <div className="h-64 bg-gray-100 dark:bg-gray-800/50 rounded-2xl"></div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-8 pb-12">
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                    <SettingsIcon className="w-8 h-8 text-primary-500" />
                    App Settings
                </h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Manage your portfolio display options and notification preferences.
                </p>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                    <Check className="w-4 h-4" /> {success}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* PORTFOLIO PREFS */}
                <GlassPanel className="p-6">
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                        <PieChart className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Portfolio Preferences</h2>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Auto-Sync Interval</label>
                            <select
                                name="sync_interval"
                                value={prefs.sync_interval}
                                onChange={handleChange}
                                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#141414] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="15">Every 15 seconds</option>
                                <option value="30">Every 30 seconds</option>
                                <option value="60">Every 60 seconds</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Default View</label>
                            <select
                                name="default_view"
                                value={prefs.default_view}
                                onChange={handleChange}
                                className="w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#141414] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                            >
                                <option value="dashboard">Dashboard</option>
                                <option value="holdings">Holdings Only</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">App Theme</label>
                            <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => handleThemeChange('light')}
                                    className={`flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${theme === 'light'
                                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-600'
                                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                        }`}
                                >
                                    <Sun className="w-4 h-4" /> Light
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleThemeChange('dark')}
                                    className={`flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${theme === 'dark'
                                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-600'
                                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                        }`}
                                >
                                    <Moon className="w-4 h-4" /> Dark
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleThemeChange('system')}
                                    className={`flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all ${theme === 'system'
                                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-gray-200 dark:ring-gray-600'
                                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                                        }`}
                                >
                                    <Monitor className="w-4 h-4" /> System
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Show Performance Chart (Not Functional)</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Display the historical line chart on dashboard</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="show_chart" checked={prefs.show_chart} onChange={handleChange} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                            </label>
                        </div>
                    </div>
                </GlassPanel>

                {/* NOTIFICATION PREFS */}
                <GlassPanel className="p-6">
                    <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                        <Bell className="w-5 h-5 text-rose-500" />
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Email Notifications (Not Functional)</h2>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Enable Email Alerts</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Master toggle for all emails</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" name="notify_email" checked={prefs.notify_email} onChange={handleChange} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                            </label>
                        </div>

                        <div className={`space-y-6 pt-4 border-t border-gray-100 dark:border-gray-800 transition-opacity ${!prefs.notify_email ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Price Alerts</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">Significant daily swings</p>
                                </div>
                                <input type="checkbox" name="notify_price_alerts" checked={prefs.notify_price_alerts} onChange={handleChange} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600" />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Sync Completions</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">When brokers finish syncing</p>
                                </div>
                                <input type="checkbox" name="notify_sync_complete" checked={prefs.notify_sync_complete} onChange={handleChange} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600" />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Daily Summary</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">End of day portfolio report</p>
                                </div>
                                <input type="checkbox" name="notify_daily_summary" checked={prefs.notify_daily_summary} onChange={handleChange} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600" />
                            </div>

                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Milestone Alerts</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">Hitting new ATHs or capital goals</p>
                                </div>
                                <input type="checkbox" name="notify_milestones" checked={prefs.notify_milestones} onChange={handleChange} className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600" />
                            </div>
                        </div>
                    </div>
                </GlassPanel>
            </div>

            {/* SECURITY PREFS */}
            <GlassPanel className="p-6">
                <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Account Security</h2>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            Two-Factor Authentication
                            {mfaEnabled ? (
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                    Enabled
                                </span>
                            ) : (
                                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                    Disabled
                                </span>
                            )}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {mfaEnabled
                                ? 'A 6-digit code will be required each time you sign in.'
                                : 'Add an extra layer of security to your account with a verification code at login.'}
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={mfaEnabled} onChange={() => setMfaEnabled(!mfaEnabled)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                </div>
            </GlassPanel>

            {/* DATA MANAGEMENT */}
            <GlassPanel className="p-6">
                <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-gray-800 pb-4">
                    <Database className="w-5 h-5 text-teal-500" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Data & Privacy</h2>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">Export Portfolio Data</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Download a complete backup of your account settings, holdings, and trade history.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleExportJson}
                            disabled={exportingJson || exportingPdf}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#141414] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50"
                        >
                            <FileJson className="w-4 h-4 text-emerald-500" />
                            {exportingJson ? 'Exporting...' : 'Export JSON'}
                        </button>

                        <button
                            onClick={handleExportPdf}
                            disabled={exportingJson || exportingPdf}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#141414] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-50"
                        >
                            <FileText className="w-4 h-4 text-rose-500" />
                            {exportingPdf ? 'Exporting...' : 'Export PDF'}
                        </button>
                    </div>
                </div>
            </GlassPanel>

            <div className="flex justify-end pt-4">
                <Button onClick={handleSave} isLoading={saving} icon={Save} className="w-full sm:w-auto px-8">
                    Save Preferences
                </Button>
            </div>
        </div>
    );
}
