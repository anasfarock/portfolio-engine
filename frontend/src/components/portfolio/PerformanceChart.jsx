import React, { useState, useEffect } from 'react';
import { ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { RefreshCw, TrendingUp } from 'lucide-react';

const BASE_URL = 'http://localhost:8000';

export default function PerformanceChart({ refreshTrigger }) {
    const { token } = useAuth();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('1mo'); // 1mo, 3mo, 1y, ytd
    const [benchmark, setBenchmark] = useState('SPY');
    const [chartType, setChartType] = useState('area'); // area, line, bar

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`${BASE_URL}/portfolio/analytics/performance`, {
                    params: { period, benchmark },
                    headers: { Authorization: `Bearer ${token}` }
                });
                setData(res.data.data);
            } catch (err) {
                console.error("Failed to fetch performance data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [token, period, benchmark, refreshTrigger]);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700">
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-medium mb-3">{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center gap-3 mb-1.5 last:mb-0">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-gray-600 dark:text-gray-300 text-sm font-medium w-20 capitalize">
                                {entry.name}
                            </span>
                            <span className="text-gray-900 dark:text-white font-bold ml-auto">
                                ${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-primary-500" />
                        Historical Backcast Performance
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Current holdings back-tested vs benchmark</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                    <select 
                        value={chartType}
                        onChange={(e) => setChartType(e.target.value)}
                        className="bg-gray-100 dark:bg-gray-800 border-none text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 px-3 py-1.5 cursor-pointer outline-none focus:ring-2 focus:ring-primary-500"
                    >
                        <option value="area">Area Chart</option>
                        <option value="line">Line Chart</option>
                        <option value="bar">Bar Chart</option>
                    </select>

                    <select 
                        value={benchmark}
                        onChange={(e) => setBenchmark(e.target.value)}
                        className="bg-gray-100 dark:bg-gray-800 border-none text-sm font-medium rounded-lg text-gray-700 dark:text-gray-200 px-3 py-1.5 cursor-pointer outline-none focus:ring-2 focus:ring-primary-500"
                    >
                        <option value="SPY">S&P 500 (SPY)</option>
                        <option value="GC=F">Gold (GC=F)</option>
                        <option value="BTC-USD">Bitcoin (BTC)</option>
                        <option value="SI=F">Silver (SI=F)</option>
                    </select>

                    <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-lg flex text-sm">
                        {['1mo', '3mo', 'ytd', '1y'].map((p) => (
                            <button 
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1 rounded-md font-medium transition-colors uppercase ${period === p ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="h-80 w-full relative">
                {(loading || refreshTrigger) ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                        <TrendingUp className="w-10 h-10 mb-3 opacity-20" />
                        <p>No historical data available for current holdings</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                            <XAxis 
                                dataKey="date" 
                                tickLine={false} 
                                axisLine={false} 
                                tickMargin={10}
                                tickFormatter={(str) => {
                                    const d = new Date(str);
                                    return period === '1mo' ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : d.toLocaleDateString(undefined, { month: 'short' });
                                }}
                                style={{ fontSize: '12px', fill: '#6B7280' }}
                                minTickGap={30}
                            />
                            <YAxis 
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                                style={{ fontSize: '12px', fill: '#6B7280' }}
                                domain={['auto', 'auto']}
                                width={60}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                                verticalAlign="top" 
                                height={36}
                                iconType="plainline"
                                formatter={(value) => <span className="text-gray-600 dark:text-gray-300 font-medium text-sm capitalize">{value}</span>}
                            />
                            
                            {chartType === 'bar' ? (
                                <Bar 
                                    dataKey="benchmark" 
                                    name={`${benchmark} Benchmark`}
                                    fill="#9CA3AF"
                                    radius={[4, 4, 0, 0]}
                                />
                            ) : (
                                <Line 
                                    type="monotone" 
                                    dataKey="benchmark" 
                                    name={`${benchmark} Benchmark`}
                                    stroke="#9CA3AF" 
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    dot={false} 
                                    activeDot={false}
                                />
                            )}

                            {chartType === 'area' && (
                                <Area 
                                    type="monotone" 
                                    dataKey="portfolio" 
                                    name="Portfolio"
                                    stroke="#3B82F6" 
                                    strokeWidth={3}
                                    fillOpacity={1} 
                                    fill="url(#colorPortfolio)" 
                                    dot={false}
                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#3B82F6' }}
                                />
                            )}
                            {chartType === 'line' && (
                                <Line 
                                    type="monotone" 
                                    dataKey="portfolio" 
                                    name="Portfolio"
                                    stroke="#3B82F6" 
                                    strokeWidth={3}
                                    dot={false}
                                    activeDot={{ r: 6, strokeWidth: 0, fill: '#3B82F6' }}
                                />
                            )}
                            {chartType === 'bar' && (
                                <Bar 
                                    dataKey="portfolio" 
                                    name="Portfolio"
                                    fill="#3B82F6" 
                                    radius={[4, 4, 0, 0]}
                                />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
