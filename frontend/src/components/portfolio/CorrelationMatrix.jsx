import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { RefreshCw, Grid3x3 } from 'lucide-react';

const BASE_URL = 'http://localhost:8000';
const PERIODS  = ['1mo', '3mo', '1y'];

/* Color helpers */
function corrToBackground(val) {
    if (val === 1.0)         return 'rgba(99,102,241,0.85)'; // diagonal — indigo
    const v = Math.max(-1, Math.min(1, val ?? 0));
    if (Math.abs(v) < 0.05) return 'rgba(156,163,175,0.12)'; // ~zero → neutral
    const t = Math.abs(v);
    const opacity = 0.12 + t * 0.82;
    return v > 0
        ? `rgba(59,130,246,${opacity})`   // blue  — positive (moves together)
        : `rgba(239,68,68,${opacity})`;   // red   — negative (diversifies)
}

function corrToTextColor(val) {
    return Math.abs(val ?? 0) > 0.55 ? '#fff' : undefined;
    // undefined → rely on Tailwind dark:text-gray-300
}

function labelFor(sym) {
    return sym.replace('-USD', '').replace('=X', '').slice(0, 5);
}

export default function CorrelationMatrix({ refreshTrigger }) {
    const { token } = useAuth();
    const [period, setPeriod]   = useState('3mo');
    const [matData, setMatData] = useState({ symbols: [], matrix: [] });
    const [loading, setLoading] = useState(true);
    const [tooltip, setTooltip] = useState(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${BASE_URL}/portfolio/analytics/correlation`, {
                    params: { period },
                    headers: { Authorization: `Bearer ${token}` },
                });
                setMatData(res.data);
            } catch (e) {
                console.error('Correlation fetch failed', e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token, period, refreshTrigger]);

    const { symbols, matrix } = matData;
    const n = symbols.length;

    /* Responsive cell sizing */
    const cellSize = n <= 4 ? 54 : n <= 7 ? 42 : n <= 10 ? 32 : 24;
    const fontSize = n <= 4 ? 11 : n <= 7 ? 10 : 9;
    const labelSize = n <= 7 ? 10 : 9;
    const showNum = cellSize >= 32;

    if (loading || refreshTrigger) return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex items-center justify-center h-80 shadow-sm">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
    );

    if (!n || !matrix.length) return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col items-center justify-center h-80 text-gray-500 shadow-sm">
            <Grid3x3 className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">Need ≥ 2 positions to compute correlation</p>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Grid3x3 className="w-5 h-5 text-blue-500" />
                        Correlation Matrix
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Blue = correlated · Red = diversifying</p>
                </div>
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

            {/* Matrix */}
            <div className="overflow-auto">
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `${cellSize + 8}px repeat(${n}, ${cellSize}px)`,
                    gap: 3,
                }}>
                    {/* Top-left corner */}
                    <div />

                    {/* Column headers */}
                    {symbols.map(s => (
                        <div key={`ch-${s}`}
                            style={{ width: cellSize, textAlign: 'center', fontSize: labelSize }}
                            className="text-gray-400 dark:text-gray-500 font-bold truncate px-0.5">
                            {labelFor(s)}
                        </div>
                    ))}

                    {/* Data rows */}
                    {matrix.map((row, r) => (
                        <React.Fragment key={`row-${symbols[r]}`}>
                            {/* Row header */}
                            <div style={{ fontSize: labelSize }}
                                className="text-gray-400 dark:text-gray-500 font-bold text-right flex items-center justify-end pr-1.5 truncate">
                                {labelFor(symbols[r])}
                            </div>

                            {/* Cells */}
                            {row.map((val, c) => {
                                const bg    = corrToBackground(val);
                                const color = corrToTextColor(val);
                                return (
                                    <div key={`${r}-${c}`}
                                        style={{
                                            width: cellSize, height: cellSize,
                                            background: bg, borderRadius: 4,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer',
                                            color: color,
                                        }}
                                        className="text-gray-600 dark:text-gray-300 transition-all hover:brightness-110 hover:ring-1 hover:ring-white hover:z-10"
                                        onMouseEnter={e => {
                                            setMousePos({ x: e.clientX, y: e.clientY });
                                            setTooltip({ r, c, val, rowSym: symbols[r], colSym: symbols[c] });
                                        }}
                                        onMouseLeave={() => setTooltip(null)}
                                    >
                                        {showNum && (
                                            <span style={{ fontSize, fontWeight: 600, lineHeight: 1 }}>
                                                {val.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                <span>−1</span>
                <div className="flex gap-px">
                    {[-1, -0.6, -0.3, 0, 0.3, 0.6, 1].map(v => (
                        <div key={v} style={{ width: 14, height: 10, background: corrToBackground(v), borderRadius: 2 }} />
                    ))}
                </div>
                <span>+1</span>
            </div>

            {/* Fixed tooltip */}
            {tooltip && (
                <div className="fixed z-50 pointer-events-none bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-2 shadow-xl text-xs"
                    style={{ left: mousePos.x + 14, top: mousePos.y - 72 }}>
                    <p className="font-bold text-gray-900 dark:text-white">
                        {tooltip.rowSym} × {tooltip.colSym}
                    </p>
                    <p className="mt-0.5">
                        Correlation:&nbsp;
                        <span className={`font-semibold ${tooltip.val >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                            {tooltip.val.toFixed(3)}
                        </span>
                    </p>
                </div>
            )}
        </div>
    );
}
