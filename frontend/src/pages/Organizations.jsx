import { useQuery } from '@tanstack/react-query';
import { Building2, DollarSign, RefreshCw, TrendingUp, TrendingDown, Minus, AlertTriangle, Users } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../api/client';

function TrendBadge({ mtd, last }) {
  if (!last || last === 0) return <span className="text-[10px] text-gray-600">—</span>;
  const pct = ((mtd - last) / last) * 100;
  if (pct > 5)  return <span className="flex items-center gap-0.5 text-xs text-red-400"><TrendingUp size={11} />+{pct.toFixed(0)}%</span>;
  if (pct < -5) return <span className="flex items-center gap-0.5 text-xs text-emerald-400"><TrendingDown size={11} />{pct.toFixed(0)}%</span>;
  return <span className="flex items-center gap-0.5 text-xs text-gray-500"><Minus size={10} /> Stable</span>;
}

function CostBar({ value, max }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-[#1a1a1a] overflow-hidden">
        <div className="h-full rounded-full bg-red-600 opacity-60" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-400 w-16 text-right">${value.toFixed(2)}</span>
    </div>
  );
}

export default function Organizations() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['organizations'],
    queryFn: api.organizations,
    staleTime: 10 * 60 * 1000,
  });

  const maxCost = data?.accounts?.[0]?.mtdCost ?? 1;

  if (data?.notInOrg) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-white">Organizations</h1>
            <p className="text-sm text-gray-500 mt-0.5">AWS Organization account overview</p>
          </div>
        </div>
        <div className="card p-8 flex flex-col items-center gap-4 text-center">
          <div className="p-3 bg-[#111] rounded-full border border-[#1e1e1e]">
            <Building2 size={22} className="text-gray-600" />
          </div>
          <p className="text-sm text-gray-400">Not a management account</p>
          <p className="text-xs text-gray-600 max-w-sm">
            The connected AWS account is not an Organizations management account, or lacks <code className="text-gray-500">organizations:ListAccounts</code> permission. Add that permission or switch to the management account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Organizations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Cost breakdown per linked AWS account</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[#1e1e1e] hover:border-[#2a2a2a] text-gray-400 hover:text-white rounded-lg transition-all">
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          {isFetching ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="card p-5 flex items-start gap-3 border-red-900/30 bg-red-950/10">
          <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-400">{error.message}</p>
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-5 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-red-900/20"><DollarSign size={16} className="text-red-400" /></div>
              <div>
                <p className="text-xs text-gray-500">MTD across all accounts</p>
                <p className="text-2xl font-semibold text-white">${data.totalMtd.toFixed(2)}</p>
                <p className="text-[11px] text-gray-600 mt-0.5">Last month: ${data.totalLastMonth.toFixed(2)}</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-indigo-900/20"><Users size={16} className="text-indigo-400" /></div>
              <div>
                <p className="text-xs text-gray-500">Member accounts</p>
                <p className="text-2xl font-semibold text-white">{data.count}</p>
                <p className="text-[11px] text-gray-600 mt-0.5">{data.accounts.filter(a => a.status === 'ACTIVE').length} active</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-emerald-900/20"><TrendingUp size={16} className="text-emerald-400" /></div>
              <div>
                <p className="text-xs text-gray-500">Top account spend</p>
                <p className="text-2xl font-semibold text-white">${(data.accounts[0]?.mtdCost ?? 0).toFixed(2)}</p>
                <p className="text-[11px] text-gray-600 mt-0.5 truncate max-w-[140px]">{data.accounts[0]?.name ?? '—'}</p>
              </div>
            </div>
          </div>

          {/* Accounts table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-[#111] flex items-center gap-2">
              <Building2 size={13} className="text-gray-500" />
              <h2 className="text-sm font-medium text-white">Accounts</h2>
              <span className="text-[11px] text-gray-600 ml-1">{data.count} total · sorted by MTD cost</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#111]">
                  {['Account', 'ID', 'Status', 'MTD Cost', 'Last Month', 'Trend', 'Share'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wider font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.accounts.map(a => (
                  <tr key={a.id} className="border-b border-[#0e0e0e] hover:bg-[#0a0a0a] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-white">{a.name}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{a.email}</p>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs font-mono text-gray-400">{a.id}</span></td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${a.status === 'ACTIVE' ? 'bg-emerald-950/50 text-emerald-400' : 'bg-[#1a1a1a] text-gray-500'}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs font-mono font-semibold text-white">${a.mtdCost.toFixed(2)}</span></td>
                    <td className="px-4 py-3"><span className="text-xs font-mono text-gray-400">${a.lastMonthCost.toFixed(2)}</span></td>
                    <td className="px-4 py-3"><TrendBadge mtd={a.mtdCost} last={a.lastMonthCost} /></td>
                    <td className="px-4 py-3 w-40"><CostBar value={a.mtdCost} max={maxCost} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.accounts.length === 0 && (
              <p className="py-10 text-center text-xs text-gray-600">No accounts found.</p>
            )}
          </div>
        </>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-600">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">Loading organization accounts…</span>
        </div>
      )}
    </div>
  );
}
