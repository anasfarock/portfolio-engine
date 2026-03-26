import React from 'react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

export default function AssetTable({ assets, loading, onDelete, currencySymbol = '$' }) {
    if (loading) {
        return (
            <div className="flex justify-center items-center py-12 text-gray-500 dark:text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mr-3"></div>
                Loading positions...
            </div>
        );
    }

    if (!assets || assets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                    <DollarSign className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Active Positions</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                    Connect an Alpaca brokerage account via the API Keys settings to automatically sync your holdings.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-gray-50/50 dark:bg-[#1a1a1a]">
                        <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-left rounded-tl-xl border-l-4 border-transparent">Asset</th>
                        <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-left">Type</th>
                        <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-right">Qty</th>
                        <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-right">Avg Entry</th>
                        <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-right">Current Price</th>
                        <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-right">Total Value</th>
                        <th className="px-6 py-4 font-semibold text-sm text-gray-600 dark:text-gray-300 text-right rounded-tr-xl">Unrealized PNL</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                    {assets.map((asset) => {
                        const qty = parseFloat(asset.quantity);
                        const buyPrice = parseFloat(asset.average_buy_price);
                        const currentPrice = asset.current_price ? parseFloat(asset.current_price) : buyPrice;

                        const profitLoss = asset.pnl ? parseFloat(asset.pnl) : (currentPrice - buyPrice)*qty;
                        const profitLossPerc = asset.pnl_percent ? parseFloat(asset.pnl_percent) : (buyPrice > 0 ? (profitLoss / buyPrice) * 100 : 0);
                        const isPositive = profitLoss >= 0;
                        const totalValue = qty * currentPrice;

                        return (
                            <tr key={asset.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/30 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-[#1a1a1a] flex items-center justify-center text-primary-600 dark:text-gray-300 font-bold border dark:border-gray-800">
                                            {asset.symbol.substring(0, 2)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-gray-900 dark:text-white uppercase">{asset.symbol}</div>
                                            <div className="text-[10px] text-gray-400 font-medium uppercase truncate max-w-[80px]">
                                                {asset.account_nickname || asset.broker_name}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full capitalize">
                                        {asset.asset_class}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-gray-900 dark:text-gray-200">
                                    {qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-gray-700 dark:text-gray-300">
                                    {currencySymbol}{buyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                </td>
                                <td className="px-6 py-4 text-right font-medium text-gray-700 dark:text-gray-300">
                                    {currencySymbol}{currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                </td>
                                <td className="px-6 py-4 text-right font-semibold text-gray-900 dark:text-white">
                                    {currencySymbol}{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className={`px-6 py-4 text-right font-semibold flex flex-col items-end justify-center h-full ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    <div className="flex items-center gap-1">
                                        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        <span>{isPositive ? '+' : ''}{currencySymbol}{Math.abs(profitLoss).toLocaleString()}</span>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
