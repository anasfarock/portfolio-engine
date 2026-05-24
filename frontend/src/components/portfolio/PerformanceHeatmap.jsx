import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { RefreshCw, Flame } from 'lucide-react';

const BASE_URL = 'http://localhost:8000';
const PERIODS  = ['1w', '1mo', '3mo'];

/* Color helpers */
function pctToColor(val) {
    if (val === null || val === undefined || isNaN(val)) return 'rgba(156,163,175,0.15)';
    const v = Math.max(-10, Math.min(10, val));
    if (Math.abs(v) < 0.2) return 'rgba(156,163,175,0.18)';
    const t = Math.abs(v) / 10; // 0→1
    const opacity = 0.18 + t * 0.82;
    return v > 0
        ? `rgba(16,185,129,${opacity})`   // emerald
        : `rgba(239,68,68,${opacity})`;   // red
}

function formatDate(str, period) {
    const d = new Date(str + 'T00:00:00');
    if (period === '1w')  return d.toLocaleDateString(undefined, { weekday: 'short' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function labelEvery(period) {
    if (period === '1w')  return 1;
    if (period === '1mo') return 3;
    return 7;
}

function cellWidth(period) {
    if (period === '1w')  return 34;
    if (period === '1mo') return 18;
    return 11;
}

export default function PerformanceHeatmap({ refreshTrigger }) {
    const { token } = useAuth();
    const [period, setPeriod] = useState('1mo');
    const [rawData, setRawData] = useState({ data: [], symbols: [] });
    const [loading, setLoading] = useState(true);
    const [tooltip, setTooltip] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${BASE_URL}/portfolio/analytics/heatmap`, {
                    params: { period },
                    headers: { Authorization: `Bearer ${token}` },
                });
                setRawData(res.data);
            } catch (e) {
                console.error('Heatmap fetch failed', e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token, period, refreshTrigger]);

    /* Pivot flat rows → { symbol → { date → pct } } */
    const { symbols, dates, cells } = useMemo(() => {
        const { data: rows = [], symbols: syms = [] } = rawData;
        const dateSet = new Set(rows.map(r => r.date));
        const dates   = [...dateSet].sort();
        const cells   = Object.fromEntries(syms.map(s => [s, {}]));
        for (const { date, symbol, pct_change } of rows) {
            if (cells[symbol]) cells[symbol][date] = pct_change;
        }
        return { symbols: syms, dates, cells };
    }, [rawData]);

    const cw = cellWidth(period);
    const ch = 26;
    const every = labelEvery(period);

    if (loading || refreshTrigger) return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex items-center justify-center h-80 shadow-sm">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
    );

    if (!symbols.length || !dates.length) return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col items-center justify-center h-80 text-gray-500 shadow-sm">
            <Flame className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">No performance data available</p>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-500" />
                    Performance Heatmap
                </h3>
                <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex text-xs">
                    {PERIODS.map(p => (
                        <button key={p} onClick={() => setPeriod(p)}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                                period === p
                                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}>
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto -mx-1 px-1">
                {/* Date labels */}
                <div className="flex mb-1" style={{ paddingLeft: '4.5rem' }}>
                    {dates.map((d, i) => (
                        <div key={d} style={{ width: cw, minWidth: cw, flexShrink: 0 }}>
                            {i % every === 0 && (
                                <span className="text-[9px] text-gray-400 dark:text-gray-500 block"
                                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', lineHeight: 1 }}>
                                    {formatDate(d, period)}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Symbol rows */}
                {symbols.map(sym => (
                    <div key={sym} className="flex items-center mb-px">
                        <div className="w-16 shrink-0 text-right pr-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 truncate"
                            title={sym}>
                            {sym.replace('-USD', '').replace('=X', '')}
                        </div>
                        <div className="flex gap-px">
                            {dates.map(d => {
                                const val = cells[sym]?.[d];
                                return (
                                    <div key={d}
                                        style={{ width: cw, height: ch, minWidth: cw, background: pctToColor(val), borderRadius: 2 }}
                                        className="cursor-pointer transition-all hover:brightness-110 hover:ring-1 hover:ring-white hover:z-10"
                                        onMouseEnter={e => {
                                            setMousePos({ x: e.clientX, y: e.clientY });
                                            setTooltip({ sym, date: d, val });
                                        }}
                                        onMouseLeave={() => setTooltip(null)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                <span>−10%</span>
                <div className="flex gap-px">
                    {[-10, -6, -3, -1, 0, 1, 3, 6, 10].map(v => (
                        <div key={v} style={{ width: 14, height: 10, background: pctToColor(v), borderRadius: 2 }} />
                    ))}
                </div>
                <span>+10%</span>
            </div>

            {/* Fixed tooltip */}
            {tooltip && (
                <div className="fixed z-50 pointer-events-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-2 shadow-xl text-xs"
                    style={{ left: mousePos.x + 14, top: mousePos.y - 70 }}>
                    <p className="font-bold text-gray-900 dark:text-white">{tooltip.sym}</p>
                    <p className="text-gray-400 dark:text-gray-500">{tooltip.date}</p>
                    <p className={`font-semibold ${(tooltip.val ?? 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {(tooltip.val ?? 0) >= 0 ? '+' : ''}{(tooltip.val ?? 0).toFixed(2)}%
                    </p>
                </div>
            )}
        </div>
    );
}
