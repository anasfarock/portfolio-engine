import React, { useState, useEffect } from 'react';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, Label,
} from 'recharts';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { RefreshCw, Target } from 'lucide-react';

const BASE_URL = 'http://localhost:8000';
const PERIODS  = ['1mo', '3mo', '1y'];

/* Scale dot radius from position value (log scale, clamped 8–28 px) */
function dotRadius(value) {
    return Math.max(8, Math.min(28, Math.log10(Math.max(value, 1)) * 7));
}

/* Custom scatter dot with embedded ticker label */
function CustomDot(props) {
    const { cx, cy, payload } = props;
    if (!payload) return null;
    const isPos = payload.pnl_pct >= 0;
    const fill   = isPos ? '#10B981' : '#EF4444';
    const stroke = isPos ? '#059669' : '#DC2626';
    const r = dotRadius(payload.current_value || 0);
    const label = (payload.symbol || '').replace('-USD', '').replace('=X', '');

    return (
        <g>
            <circle cx={cx} cy={cy} r={r}
                fill={fill} fillOpacity={0.75}
                stroke={stroke} strokeWidth={1.5} />
            {r >= 12 && (
                <text x={cx} y={cy + 4} textAnchor="middle"
                    fill="#fff" fontSize={9} fontWeight="700">
                    {label.slice(0, 5)}
                </text>
            )}
        </g>
    );
}

/* Tooltip */
function ScatterTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 shadow-xl text-sm pointer-events-none">
            <p className="font-bold text-gray-900 dark:text-white mb-1">{d.symbol}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Return:&nbsp;
                <span className={`font-semibold ${d.annualized_return >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {d.annualized_return >= 0 ? '+' : ''}{d.annualized_return.toFixed(1)}%
                </span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Volatility:&nbsp;
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {d.annualized_volatility.toFixed(1)}%
                </span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Value:&nbsp;
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                    ${d.current_value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                P&amp;L:&nbsp;
                <span className={`font-semibold ${d.pnl_pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {d.pnl_pct >= 0 ? '+' : ''}{d.pnl_pct.toFixed(2)}%
                </span>
            </p>
        </div>
    );
}

export default function RiskReturnScatter({ refreshTrigger }) {
    const { token } = useAuth();
    const [period, setPeriod]   = useState('3mo');
    const [data, setData]       = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${BASE_URL}/portfolio/analytics/risk-return`, {
                    params: { period },
                    headers: { Authorization: `Bearer ${token}` },
                });
                setData(res.data);
            } catch (e) {
                console.error('Risk-return fetch failed', e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token, period, refreshTrigger]);

    if (loading || refreshTrigger) return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex items-center justify-center h-80 shadow-sm">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
    );

    if (!data.length) return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 flex flex-col items-center justify-center h-80 text-gray-500 shadow-sm">
            <Target className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">Not enough data to compute risk-return</p>
        </div>
    );

    return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Target className="w-5 h-5 text-violet-500" />
                        Risk-Return
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Annualised, dot size = position value</p>
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

            <div className="flex-1 w-full min-h-[16rem]">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 24, left: 0, bottom: 28 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.15} />
                        <XAxis
                            dataKey="annualized_volatility"
                            type="number" name="Volatility" unit="%"
                            tickLine={false} axisLine={false}
                            style={{ fontSize: '11px', fill: '#6B7280' }}
                            domain={['auto', 'auto']}
                        >
                            <Label value="Risk (Volatility %)" position="insideBottom" offset={-18}
                                style={{ fontSize: 11, fill: '#9CA3AF' }} />
                        </XAxis>
                        <YAxis
                            dataKey="annualized_return"
                            type="number" name="Return" unit="%"
                            tickLine={false} axisLine={false}
                            style={{ fontSize: '11px', fill: '#6B7280' }}
                            width={50}
                            domain={['auto', 'auto']}
                        >
                            <Label value="Return %" angle={-90} position="insideLeft" offset={10}
                                style={{ fontSize: 11, fill: '#9CA3AF' }} />
                        </YAxis>
                        {/* Zero-return reference line */}
                        <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="4 4" opacity={0.5} />
                        <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                        <Scatter data={data} shape={<CustomDot />} />
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
