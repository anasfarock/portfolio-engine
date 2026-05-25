import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, RefreshCw, AlertTriangle, AlertCircle, Info } from 'lucide-react';

const BASE_URL = 'http://localhost:8000';

function ImpactBadge({ impact }) {
  if (!impact) return null;
  const lower = impact.toLowerCase();
  if (lower === 'high') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded"><AlertTriangle className="w-3 h-3" /> HIGH</span>;
  }
  if (lower === 'medium') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded"><AlertCircle className="w-3 h-3" /> MED</span>;
  }
  if (lower === 'low') {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 rounded"><Info className="w-3 h-3" /> LOW</span>;
  }
  return <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded uppercase">{impact}</span>;
}

export default function EconomicCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCalendar = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${BASE_URL}/news/calendar`);
      setEvents(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load calendar data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, []);

  // Group events by Date
  const grouped = events.reduce((acc, curr) => {
    const d = curr.date || 'Unknown Date';
    if (!acc[d]) acc[d] = [];
    acc[d].push(curr);
    return acc;
  }, {});

  return (
    <div className="bg-white dark:bg-gray-900/60 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden pb-4">
      <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-500" />
          Economic Calendar (This Week)
        </h2>
        <button
          onClick={fetchCalendar}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="m-4 p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && !events.length && (
        <div className="flex justify-center py-20">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
        </div>
      )}

      {!loading && events.length === 0 && !error && (
        <div className="text-center py-20 text-gray-500">No events found for this week.</div>
      )}

      <div className="px-5">
        {Object.entries(grouped).map(([date, dayEvents]) => (
          <div key={date} className="mt-6 first:mt-2">
            <h3 className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm z-10 py-2.5 text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 border-b border-gray-100 dark:border-gray-800">
              {date}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wider border-b border-gray-50 dark:border-gray-800/50">
                    <th className="py-2 font-semibold">Time</th>
                    <th className="py-2 font-semibold">Cur</th>
                    <th className="py-2 font-semibold">Impact</th>
                    <th className="py-2 font-semibold">Event</th>
                    <th className="py-2 font-semibold text-right">Actual</th>
                    <th className="py-2 font-semibold text-right">Forecast</th>
                    <th className="py-2 font-semibold text-right hidden sm:table-cell">Previous</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                  {dayEvents.map(event => {
                    const isActual = !!event.actual;
                    return (
                      <tr key={event.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{event.time}</td>
                        <td className="py-2.5 pr-4 font-bold text-gray-900 dark:text-white text-xs">{event.country}</td>
                        <td className="py-2.5 pr-4"><ImpactBadge impact={event.impact} /></td>
                        <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300 min-w-[200px]">{event.title}</td>
                        <td className={`py-2.5 pr-4 text-right font-bold tabular-nums ${isActual ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-600'}`}>
                          {event.actual || '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-gray-500 dark:text-gray-400 tabular-nums">{event.forecast || '—'}</td>
                        <td className="py-2.5 text-right text-gray-400 hidden sm:table-cell tabular-nums">{event.previous || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
