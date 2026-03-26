import React, { useState } from 'react';

const TYPE_STYLES = {
    BUY: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    SELL: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

const BROKER_STYLES = {
    'Alpaca': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    'Binance Demo': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
};

function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString(undefined, {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return iso; }
}

function formatMoney(val, sym = '$') {
    const n = parseFloat(val);
    if (isNaN(n)) return '—';
    return sym + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function formatQty(val) {
    const n = parseFloat(val);
    if (isNaN(n)) return '—';
    return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 });
}

const PAGE_SIZE = 15;

export default function TradeHistory({ transactions = [], loading, currencySymbol = '$' }) {
    const [page, setPage] = useState(0);
    const [filter, setFilter] = useState('ALL');  // ALL | BUY | SELL

    const filtered = filter === 'ALL' ? transactions : transactions.filter(t => t.transaction_type === filter);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginated = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    const changePage = (p) => setPage(Math.max(0, Math.min(p, totalPages - 1)));
    const handleFilter = (f) => { setFilter(f); setPage(0); };

    if (loading) return (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400 animate-pulse">
            Loading trade history…
        </div>
    );

    if (!transactions.length) return (
        <div className="p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">No trade history yet.</p>
            <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">Sync your broker to populate order records.</p>
        </div>
    );

    return (
        <div>
            {/* Filter bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                {['ALL', 'BUY', 'SELL'].map(f => (
                    <button
                        key={f}
                        onClick={() => handleFilter(f)}
                        className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${filter === f
                            ? 'bg-primary-600 text-white border-primary-600'
                            : 'bg-transparent text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-primary-500'
                            }`}
                    >{f}</button>
                ))}
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{filtered.length} trades</span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50/50 dark:bg-[#1a1a1a]">
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-left rounded-tl-xl border-l-4 border-transparent">Symbol</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-left">Type</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-right">Quantity</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-right">Price</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-right">Total Value</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-left">Account</th>
                            <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-left rounded-tr-xl">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginated.map((tx, i) => {
                            const qty = parseFloat(tx.quantity || 0);
                            const price = parseFloat(tx.price || 0);
                            const total = qty * price;
                            return (
                                <tr
                                    key={tx.id}
                                    className={`border-b border-gray-100 dark:border-gray-800/60 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-white/[0.015]'
                                        }`}
                                >
                                    {/* Symbol */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 shrink-0">
                                                {tx.symbol?.slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900 dark:text-white">{tx.symbol}</div>
                                                {tx.asset_class && (
                                                    <div className="text-xs text-gray-400">{tx.asset_class}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Type */}
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_STYLES[tx.transaction_type] || ''}`}>
                                            {tx.transaction_type}
                                        </span>
                                    </td>

                                    {/* Quantity */}
                                    <td className="px-6 py-4 text-right font-mono text-gray-700 dark:text-gray-300">
                                        {formatQty(tx.quantity)}
                                    </td>

                                    {/* Price */}
                                    <td className="px-6 py-4 text-right font-mono text-gray-700 dark:text-gray-300">
                                        {formatMoney(tx.price, currencySymbol)}
                                    </td>

                                    {/* Total Value */}
                                    <td className="px-6 py-4 text-right font-mono font-semibold text-gray-900 dark:text-white">
                                        {formatMoney(total, currencySymbol)}
                                    </td>

                                    {/* Broker */}
                                    <td className="px-6 py-4">
                                        {(tx.account_nickname || tx.broker_name) && (
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BROKER_STYLES[tx.broker_name] || 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                {tx.account_nickname || tx.broker_name}
                                            </span>
                                        )}
                                    </td>

                                    {/* Date */}
                                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        {formatDate(tx.timestamp)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                    <span>Page {page + 1} of {totalPages}</span>
                    <div className="flex gap-1">
                        <button onClick={() => changePage(page - 1)} disabled={page === 0}
                            className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            ← Prev
                        </button>
                        <button onClick={() => changePage(page + 1)} disabled={page >= totalPages - 1}
                            className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
