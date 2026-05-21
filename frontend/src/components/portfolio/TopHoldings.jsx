import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Briefcase, RefreshCw } from 'lucide-react';

export default function TopHoldings({ assets, loading }) {
    const chartData = useMemo(() => {
        if (!assets || assets.length === 0) return [];

        // Calculate total value for each asset
        const withValue = assets.map(a => {
            const qty = parseFloat(a.quantity) || 0;
            // Use current price if available, fallback to average buy price
            const price = parseFloat(a.current_price || a.average_buy_price) || 0;
            return {
                symbol: a.symbol,
                value: qty * price
            };
        });

        // Filter out zero value
        const active = withValue.filter(a => a.value > 0);
        
        // Sort by Value descending
        active.sort((a, b) => b.value - a.value);

        // Take top 5
        return active.slice(0, 5);
    }, [assets]);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700">
                    <p className="font-bold text-gray-900 dark:text-white mb-1">
                        {data.symbol}
                    </p>
                    <p className="font-medium text-primary-500">
                        ${data.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex items-center justify-center h-80 shadow-sm">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
        );
    }

    if (chartData.length === 0) {
        return (
            <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col items-center justify-center h-80 text-gray-500 shadow-sm">
                <Briefcase className="w-10 h-10 mb-3 opacity-20" />
                <p>No active holdings found</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                <Briefcase className="w-5 h-5 text-primary-500" />
                Top Holdings
            </h3>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                    >
                        <XAxis 
                            type="number" 
                            hide={false}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val) => `$${val >= 1000 ? (val/1000).toFixed(1) + 'k' : val.toFixed(0)}`}
                            style={{ fontSize: '11px', fill: '#6B7280' }}
                        />
                        <YAxis 
                            dataKey="symbol" 
                            type="category" 
                            axisLine={false}
                            tickLine={false}
                            style={{ fontSize: '12px', fill: '#9CA3AF', fontWeight: 'bold' }}
                            width={60}
                        />
                        <Tooltip cursor={{ fill: 'rgba(107, 114, 128, 0.1)' }} content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} fill="#8B5CF6">
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill="#3B82F6" /> // primary blue
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
