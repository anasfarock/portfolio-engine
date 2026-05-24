import React, { useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { LayoutGrid, RefreshCw } from 'lucide-react';

function pnlToFill(pct) {
    if (pct >= 5)   return '#059669';
    if (pct >= 2)   return '#10B981';
    if (pct >= 0.5) return '#34D399';
    if (pct > -0.5) return '#6B7280';
    if (pct > -2)   return '#F87171';
    if (pct > -5)   return '#EF4444';
    return '#DC2626';
}

function TreemapCell(props) {
    const { x, y, width, height, name, pnl_pct, depth } = props;
    if (depth !== 1 || width < 1 || height < 1) return null;

    const fill = pnlToFill(pnl_pct ?? 0);
    const w = Math.max(0, width - 2);
    const h = Math.max(0, height - 2);
    const showFull  = w > 52 && h > 42;
    const showSmall = w > 26 && h > 22;
    const fsSym = Math.min(12, w / 5.5);
    const fsPct = Math.min(10, w / 7);

    return (
        <g>
            <rect x={x + 1} y={y + 1} width={w} height={h} fill={fill} rx={4}
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))' }} />
            {showFull && (
                <>
                    <text x={x + width / 2} y={y + height / 2 - 7}
                        textAnchor="middle" fill="#fff" fontSize={fsSym} fontWeight="700">
                        {name}
                    </text>
                    <text x={x + width / 2} y={y + height / 2 + 9}
                        textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={fsPct}>
                        {(pnl_pct ?? 0) >= 0 ? '+' : ''}{(pnl_pct ?? 0).toFixed(1)}%
                    </text>
                </>
            )}
            {!showFull && showSmall && (
                <text x={x + width / 2} y={y + height / 2 + 4}
                    textAnchor="middle" fill="#fff" fontSize={Math.min(9, w / 4)} fontWeight="600">
                    {name}
                </text>
            )}
        </g>
    );
}

function TreeTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d?.name || d.name === 'Portfolio') return null;
    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 shadow-xl pointer-events-none">
            <p className="font-bold text-gray-900 dark:text-white text-sm">{d.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                ${(d.value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className={`text-xs font-semibold mt-0.5 ${(d.pnl_pct ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {(d.pnl_pct ?? 0) >= 0 ? '+' : ''}{(d.pnl_pct ?? 0).toFixed(2)}%
            </p>
        </div>
    );
}

export default function HoldingsTreemap({ assets, loading }) {
    const treeData = useMemo(() => {
        if (!assets?.length) return null;
        const children = assets
            .map(a => {
                const qty      = parseFloat(a.quantity) || 0;
                const price    = parseFloat(a.current_price || a.average_buy_price) || 0;
                const avgPrice = parseFloat(a.average_buy_price) || 0;
                const value    = qty * price;
                const pnl_pct  = avgPrice > 0 ? ((price - avgPrice) / avgPrice) * 100 : 0;
                return { name: a.symbol, size: value, value, pnl_pct: +pnl_pct.toFixed(2) };
            })
            .filter(d => d.value > 0)
            .sort((a, b) => b.size - a.size);
        const totalValue = children.reduce((sum, d) => sum + d.value, 0);
        const threshold = totalValue * 0.01; // 1% threshold
        const largeAssets = [];
        let otherValue = 0;
        let otherCost = 0;

        children.forEach(d => {
            if (d.value >= threshold) {
                largeAssets.push(d);
            } else {
                otherValue += d.value;
                const cost = d.value / (1 + (d.pnl_pct / 100));
                otherCost += cost;
            }
        });

        if (otherValue > 0) {
            const otherPnl = otherCost > 0 ? ((otherValue - otherCost) / otherCost) * 100 : 0;
            largeAssets.push({ 
                name: 'Other', 
                size: otherValue, 
                value: otherValue, 
                pnl_pct: +otherPnl.toFixed(2) 
            });
        }
        
        return largeAssets.length ? largeAssets : null;
    }, [assets]);

    if (loading) return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex items-center justify-center h-80 shadow-sm">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
    );

    if (!treeData) return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col items-center justify-center h-80 text-gray-500 shadow-sm">
            <LayoutGrid className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">No holdings to display</p>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-primary-500" />
                    Holdings Treemap
                </h3>
                <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                        Gain
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />
                        Loss
                    </span>
                </div>
            </div>

            <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap data={treeData} dataKey="size" aspectRatio={16 / 9}
                        content={<TreemapCell />}>
                        <Tooltip content={<TreeTooltip />} />
                    </Treemap>
                </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-2 text-center">
                Area&nbsp;=&nbsp;position value&nbsp;·&nbsp;Color&nbsp;=&nbsp;P&amp;L&nbsp;%
            </p>
        </div>
    );
}
