import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trophy, RefreshCw } from 'lucide-react';

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const isPositive = data.pnl >= 0;
        return (
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700">
                <p className="font-bold text-gray-900 dark:text-white mb-1">
                    {data.symbol}
                </p>
                <p className={`font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {isPositive ? '+' : ''}${data.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
            </div>
        );
    }
    return null;
};

export default function TopContributors({ assets, loading }) {
    const chartData = useMemo(() => {
        if (!assets || assets.length === 0) return [];

        // Calculate absolute PnL for each asset
        const withPnl = assets.map(a => {
            const qty = parseFloat(a.quantity) || 0;
            const current = parseFloat(a.current_price) || 0;
            const avg = parseFloat(a.average_buy_price) || 0;
            return {
                symbol: a.symbol,
                pnl: (current - avg) * qty
            };
        });

        // Filter out zero PnL
        const active = withPnl.filter(a => Math.abs(a.pnl) > 0.01);
        
        // Sort by PnL descending
        active.sort((a, b) => b.pnl - a.pnl);

        // Take top 3 and bottom 3
        let top = active.slice(0, 3);
        let bottom = active.slice(-3).reverse();

        // If less than 6 items total, just show all sorted
        let combined = [];
        if (active.length <= 6) {
            combined = active;
        } else {
            // Deduplicate if overlap
            const bottomSymbols = new Set(bottom.map(b => b.symbol));
            top = top.filter(t => !bottomSymbols.has(t.symbol));
            combined = [...top, ...bottom].sort((a, b) => b.pnl - a.pnl);
        }

        return combined;
    }, [assets]);

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
                <Trophy className="w-10 h-10 mb-3 opacity-20" />
                <p>No P&L data available yet</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
                <Trophy className="w-5 h-5 text-primary-500" />
                Top & Bottom Contributors
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
                            tickFormatter={(val) => `$${Math.abs(val) >= 1000 ? (val/1000).toFixed(1) + 'k' : val.toFixed(0)}`}
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
                        <Bar dataKey="pnl" radius={[0, 4, 4, 0]} barSize={24}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
