import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { DollarSign, TrendingUp, RefreshCw, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api } from '../api/client';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#94a3b8'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="card px-3 py-2.5 text-xs shadow-xl min-w-[150px]">
      <p className="text-gray-400 mb-2">{label}</p>
      {payload.filter(p => p.value > 0).map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-0.5">
          <span style={{ color: p.color }} className="truncate max-w-[100px]">
            {String(p.dataKey).replace('Amazon ', '').replace('AWS ', '')}
          </span>
          <span className="font-mono text-white">${p.value?.toFixed(2)}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="flex justify-between mt-2 pt-1.5 border-t border-[#1e1e1e]">
          <span className="text-gray-500">Total</span>
          <span className="font-mono text-white">${total.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="card px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 truncate max-w-[160px]">{d.name}</p>
      <p className="text-white font-mono mt-0.5">${d.value?.toFixed(2)}</p>
      <p className="text-gray-500">{d.payload?.percent?.toFixed(1)}% of total</p>
    </div>
  );
}

const TABS = ['Overview', 'By Service', 'Daily Stacked'];

export default function CostExplorer() {
  const [tab, setTab] = useState('Overview');

  const { data: costs, isLoading: costsLoading, error: costsError, refetch } = useQuery({
    queryKey: ['costs'],
    queryFn: api.costs,
  });
  const { data: stacked, isLoading: stackedLoading } = useQuery({
    queryKey: ['costs-daily-by-service'],
    queryFn: api.costsDailyByService,
    enabled: tab === 'Daily Stacked',
  });

  const isLoading = costsLoading || (tab === 'Daily Stacked' && stackedLoading);

  const dailyData = (costs?.dailyData ?? []).map(d => ({
    ...d,
    label: format(parseISO(d.date), 'MMM d'),
  }));

  const byServiceWithPercent = (costs?.byService ?? []).map(s => ({
    ...s,
    percent: costs.mtdTotal > 0 ? (s.cost / costs.mtdTotal) * 100 : 0,
    name: s.service,
  }));

  const stackedDays = (stacked?.days ?? []).map(d => ({
    ...d,
    label: format(parseISO(d.date), 'MMM d'),
  }));

  if (costsError) return <div className="p-8"><ErrorMessage error={costsError} onRetry={refetch} /></div>;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Cost Explorer</h1>
          <p className="text-sm text-gray-500 mt-0.5">Current month spend breakdown</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-white border border-[#1e1e1e] hover:border-[#2a2a2a] px-3 py-1.5 rounded-lg transition-all"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            icon: DollarSign,
            label: 'Month-to-Date',
            value: costs?.mtdTotal != null ? `$${costs.mtdTotal.toFixed(2)}` : '—',
            sub: 'Unblended cost',
          },
          {
            icon: TrendingUp,
            label: 'Month-End Forecast',
            value: costs?.forecastTotal != null ? `$${costs.forecastTotal.toFixed(2)}` : '—',
            sub: 'AWS projection',
          },
          {
            icon: Calendar,
            label: 'Last Month',
            value: costs?.lastMonthTotal != null ? `$${costs.lastMonthTotal.toFixed(2)}` : '—',
            sub: 'For comparison',
          },
        ].map(card => (
          <div key={card.label} className="card p-4 flex items-start gap-3">
            <span className="p-1.5 bg-[#1a1a1a] rounded-lg text-gray-500 mt-0.5">
              <card.icon size={14} />
            </span>
            <div>
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              {costsLoading ? (
                <div className="h-6 w-24 bg-[#1a1a1a] rounded animate-pulse" />
              ) : (
                <p className="text-lg font-semibold text-white tracking-tight">{card.value}</p>
              )}
              <p className="text-[10px] text-gray-600 mt-0.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[#111111] border border-[#1e1e1e] rounded-lg w-fit mb-5">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs rounded-md transition-all ${
              tab === t ? 'bg-red-600 text-white font-medium' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'Overview' && (
        <div className="card p-5">
          <h2 className="text-sm font-medium text-white mb-4">Daily Cost — Last 30 Days</h2>
          {costsLoading ? (
            <div className="flex items-center justify-center h-64"><Spinner size={28} /></div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="redGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#4b5563' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: '#4b5563' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={46} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} fill="url(#redGrad2)" dot={false} activeDot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {tab === 'By Service' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Pie chart */}
          <div className="card p-5">
            <h2 className="text-sm font-medium text-white mb-4">Cost Distribution</h2>
            {costsLoading ? (
              <div className="flex items-center justify-center h-64"><Spinner size={28} /></div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={byServiceWithPercent.slice(0, 8)}
                    dataKey="cost"
                    nameKey="service"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {byServiceWithPercent.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} opacity={0.85} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Service table */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1a1a1a]">
              <h2 className="text-sm font-medium text-white">By Service (MTD)</h2>
            </div>
            <div className="overflow-y-auto max-h-[320px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ background: '#111111' }}>
                  <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <th className="text-left px-4 py-2.5 text-gray-500 font-medium uppercase tracking-wider">Service</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-medium uppercase tracking-wider">Cost</th>
                    <th className="text-right px-4 py-2.5 text-gray-500 font-medium uppercase tracking-wider">%</th>
                  </tr>
                </thead>
                <tbody>
                  {costsLoading ? (
                    <tr><td colSpan={3} className="py-8 text-center"><Spinner size={20} className="mx-auto" /></td></tr>
                  ) : byServiceWithPercent.map((s, i) => (
                    <tr key={s.service} style={{ borderBottom: '1px solid #0f0f0f' }} className="hover:bg-[#141414] transition-colors">
                      <td className="px-4 py-2.5 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-gray-300 truncate max-w-[180px]" title={s.service}>{s.service}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-white">${s.cost.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{s.percent.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'Daily Stacked' && (
        <div className="card p-5">
          <h2 className="text-sm font-medium text-white mb-4">Daily Cost by Service — Current Month (Top 8)</h2>
          {stackedLoading ? (
            <div className="flex items-center justify-center h-64"><Spinner size={28} /></div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={stackedDays} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#4b5563' }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: '#4b5563' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} width={46} />
                <Tooltip content={<ChartTooltip />} />
                {(stacked?.services ?? []).map((svc, i) => (
                  <Bar key={svc} dataKey={svc} stackId="a" fill={COLORS[i % COLORS.length]} opacity={0.85} radius={i === (stacked.services.length - 1) ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
          {stacked?.services?.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-[#1a1a1a]">
              {stacked.services.map((svc, i) => (
                <span key={svc} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  {svc.replace('Amazon ', '').replace('AWS ', '')}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
