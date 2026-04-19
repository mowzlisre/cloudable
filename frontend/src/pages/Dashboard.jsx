import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { DollarSign, TrendingUp, Activity, Server, RefreshCw, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import StatCard from '../components/StatCard';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';

const CHART_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899'];

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">
          ${p.value?.toFixed(2)}
        </p>
      ))}
    </div>
  );
}

function fmt$(n) {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n?.toFixed(2) ?? '—'}`;
}

function pct(a, b) {
  if (!b) return null;
  return ((a - b) / b) * 100;
}

export default function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: costs, isLoading: costsLoading, error: costsError, refetch: refetchCosts } = useQuery({
    queryKey: ['costs'],
    queryFn: api.costs,
  });
  const { data: services, isLoading: svcsLoading } = useQuery({
    queryKey: ['services'],
    queryFn: api.services,
  });
  const { data: hidden } = useQuery({
    queryKey: ['hidden'],
    queryFn: api.hidden,
  });

  const isLoading = costsLoading || svcsLoading;

  function handleRefresh() {
    qc.invalidateQueries();
  }

  const activeCount = services?.services?.filter(s => s.status === 'active').length ?? 0;
  const topServices = costs?.byService?.slice(0, 6) ?? [];
  const maxServiceCost = topServices[0]?.cost ?? 1;

  const dailyData = (costs?.dailyData ?? []).map(d => ({
    ...d,
    label: format(parseISO(d.date), 'MMM d'),
  }));

  if (costsError) return (
    <div className="p-8">
      <ErrorMessage error={costsError} onRetry={refetchCosts} />
    </div>
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(), 'MMMM yyyy')} — month-to-date overview
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-white border border-[#1e1e1e] hover:border-[#2a2a2a] px-3 py-1.5 rounded-lg transition-all"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Hidden charges alert */}
      {hidden?.totalEstimatedWaste > 0 && (
        <div
          onClick={() => navigate('/hidden')}
          className="mb-6 flex items-center gap-3 px-4 py-3 rounded-lg border border-red-900/40 bg-red-950/20 cursor-pointer hover:bg-red-950/30 transition-colors"
        >
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300">
            <span className="font-medium">Potential waste detected:</span>{' '}
            ~${hidden.totalEstimatedWaste.toFixed(2)}/month in hidden or orphaned resources.{' '}
            <span className="text-red-400 underline underline-offset-2">View details →</span>
          </p>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={DollarSign}
          label="MTD Cost"
          value={fmt$(costs?.mtdTotal)}
          sub="Unblended, current month"
          trend={pct(costs?.mtdTotal, costs?.lastMonthTotal)}
          accent
          loading={costsLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Month-End Forecast"
          value={fmt$(costs?.forecastTotal)}
          sub={costs?.forecastTotal ? 'AI-based projection' : 'Unavailable'}
          loading={costsLoading}
        />
        <StatCard
          icon={Activity}
          label="vs Last Month"
          value={costs?.lastMonthTotal ? fmt$(costs.lastMonthTotal) : '—'}
          sub="Previous month total"
          trend={pct(costs?.mtdTotal, costs?.lastMonthTotal)}
          loading={costsLoading}
        />
        <StatCard
          icon={Server}
          label="Active Services"
          value={svcsLoading ? '—' : activeCount}
          sub={`of ${services?.services?.length ?? 0} total tracked`}
          loading={svcsLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Daily cost trend */}
        <div className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-white">Daily Spend — Last 30 Days</h2>
            {costs?.mtdTotal && (
              <span className="text-xs text-gray-500">
                avg ${(costs.mtdTotal / (dailyData.length || 1)).toFixed(2)}/day
              </span>
            )}
          </div>
          {costsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner size={24} />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="redGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: '#4b5563' }}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.floor(dailyData.length / 6)}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#4b5563' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `$${v}`}
                  width={42}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  fill="url(#redGrad)"
                  dot={false}
                  activeDot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top services */}
        <div className="card p-5">
          <h2 className="text-sm font-medium text-white mb-4">Top Services (MTD)</h2>
          {svcsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner size={24} />
            </div>
          ) : topServices.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-8">No cost data yet</p>
          ) : (
            <div className="space-y-3">
              {topServices.map((s, i) => (
                <div key={s.service}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400 truncate max-w-[60%]" title={s.service}>
                      {s.service.replace('Amazon ', '').replace('AWS ', '')}
                    </span>
                    <span className="text-xs font-medium text-white">${s.cost.toFixed(2)}</span>
                  </div>
                  <div className="h-1 rounded-full bg-[#1a1a1a] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(s.cost / maxServiceCost) * 100}%`,
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        opacity: 0.7,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
