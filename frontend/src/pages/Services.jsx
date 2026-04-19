import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Search, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api } from '../api/client';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';

const STATUS_FILTERS = ['all', 'active', 'idle', 'inactive'];

function TrendIcon({ trend, change }) {
  if (trend === 'new') return <span className="text-[10px] text-blue-400 font-medium">NEW</span>;
  if (trend === 'up') return (
    <span className="flex items-center gap-0.5 text-xs text-red-400">
      <TrendingUp size={11} /> {change !== null ? `+${change.toFixed(0)}%` : ''}
    </span>
  );
  if (trend === 'down') return (
    <span className="flex items-center gap-0.5 text-xs text-emerald-400">
      <TrendingDown size={11} /> {change !== null ? `${change.toFixed(0)}%` : ''}
    </span>
  );
  return <span className="flex items-center gap-0.5 text-xs text-gray-500"><Minus size={10} /> Stable</span>;
}

export default function Services() {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('currentMonthCost');
  const [sortDir, setSortDir] = useState('desc');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['services'],
    queryFn: api.services,
  });

  const services = useMemo(() => {
    let list = data?.services ?? [];
    if (filter !== 'all') list = list.filter(s => s.status === filter);
    if (search) list = list.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    return [...list].sort((a, b) => {
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
  }, [data, filter, search, sortKey, sortDir]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const counts = useMemo(() => {
    const all = data?.services ?? [];
    return {
      all: all.length,
      active: all.filter(s => s.status === 'active').length,
      idle: all.filter(s => s.status === 'idle').length,
      inactive: all.filter(s => s.status === 'inactive').length,
    };
  }, [data]);

  if (error) return <div className="p-8"><ErrorMessage error={error} onRetry={refetch} /></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Services</h1>
          <p className="text-sm text-gray-500 mt-0.5">All AWS services with cost activity in the last 90 days</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-white border border-[#1e1e1e] hover:border-[#2a2a2a] px-3 py-1.5 rounded-lg transition-all"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search services..."
            className="w-full pl-8 pr-3 py-2 text-sm bg-[#111111] border border-[#1e1e1e] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-red-800 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-[#111111] border border-[#1e1e1e] rounded-lg">
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-md capitalize transition-all ${
                filter === f
                  ? 'bg-red-600 text-white font-medium'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {f} {counts[f] !== undefined && <span className="opacity-60">({counts[f]})</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #1a1a1a', background: '#0e0e0e' }}>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300" onClick={() => toggleSort('currentMonthCost')}>
                  MTD Cost {sortKey === 'currentMonthCost' && (sortDir === 'desc' ? '↓' : '↑')}
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300" onClick={() => toggleSort('lastMonthCost')}>
                  Last Month {sortKey === 'lastMonthCost' && (sortDir === 'desc' ? '↓' : '↑')}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300" onClick={() => toggleSort('lastAccessed')}>
                  Last Active {sortKey === 'lastAccessed' && (sortDir === 'desc' ? '↓' : '↑')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <Spinner size={24} className="mx-auto" />
                  </td>
                </tr>
              ) : services.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-gray-600">
                    No services found
                  </td>
                </tr>
              ) : (
                services.map((s, i) => (
                  <tr
                    key={s.name}
                    style={{ borderBottom: '1px solid #141414' }}
                    className="hover:bg-[#121212] transition-colors"
                  >
                    <td className="px-4 py-3 text-xs font-medium text-gray-200 max-w-[240px]">
                      <span title={s.name}>{s.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge-${s.status}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-white">
                      {s.currentMonthCost > 0 ? `$${s.currentMonthCost.toFixed(2)}` : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">
                      {s.lastMonthCost > 0 ? `$${s.lastMonthCost.toFixed(2)}` : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <TrendIcon trend={s.trend} change={s.changePercent} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {s.lastAccessed ? format(parseISO(s.lastAccessed), 'MMM d, yyyy') : <span className="text-gray-700">—</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && services.length > 0 && (
          <div className="px-4 py-3 border-t border-[#1a1a1a] text-xs text-gray-600">
            Showing {services.length} service{services.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
