import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { RefreshCw, PieChart as PieChartIcon } from 'lucide-react';

const BASE_URL = 'http://localhost:8000';

const COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#8B5CF6', // Violet
    '#F59E0B', // Amber
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#6366F1', // Indigo
    '#F43F5E', // Rose
];

export default function AllocationChart({ refreshTrigger }) {
    const { token } = useAuth();
    const [data, setData] = useState({ by_asset_class: [], by_sector: [] });
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('asset_class'); // 'asset_class' | 'sector'

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${BASE_URL}/portfolio/analytics/allocation`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(res.data);
            } catch (err) {
                console.error("Failed to fetch allocation data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token, refreshTrigger]);

    const activeData = view === 'asset_class' ? data.by_asset_class : data.by_sector;

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">
                        {payload[0].name}
                    </p>
                    <p className="text-primary-600 dark:text-primary-400 font-medium">
                        ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            );
        }
        return null;
    };

    if (loading || refreshTrigger) {
        return (
            <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex items-center justify-center h-80">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
        );
    }

    if (activeData.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col items-center justify-center h-80 text-gray-500">
                <PieChartIcon className="w-10 h-10 mb-3 opacity-20" />
                <p>No allocation data available</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <PieChartIcon className="w-5 h-5 text-primary-500" />
                        Asset Allocation
                    </h3>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex text-sm">
                    <button 
                        onClick={() => setView('asset_class')}
                        className={`px-3 py-1 rounded-md font-medium transition-colors ${view === 'asset_class' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    >
                        Class
                    </button>
                    <button 
                        onClick={() => setView('sector')}
                        className={`px-3 py-1 rounded-md font-medium transition-colors ${view === 'sector' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                    >
                        Sector
                    </button>
                </div>
            </div>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={activeData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {activeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                            verticalAlign="bottom" 
                            height={36}
                            iconType="circle"
                            formatter={(value) => <span className="text-gray-600 dark:text-gray-300 font-medium text-sm">{value}</span>}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
