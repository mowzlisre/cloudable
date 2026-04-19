import { useQuery } from '@tanstack/react-query';
import { Globe, DollarSign, Server, Database, RefreshCw, AlertTriangle, TrendingUp, Plus } from 'lucide-react';
import { api } from '../api/client';
import { useNavigate } from 'react-router-dom';

const SERVICE_COLORS = ['#ef4444','#f59e0b','#10b981','#6366f1','#8b5cf6','#ec4899','#14b8a6','#f97316'];

function MiniBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 truncate text-[10px] text-gray-500 shrink-0">{label}</div>
      <div className="flex-1 h-1 rounded-full bg-[#1a1a1a] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="text-[10px] font-mono text-gray-400 w-14 text-right">${value.toFixed(2)}</div>
    </div>
  );
}

function AccountCard({ account }) {
  const isError = !!account.error;
  return (
    <div className={`card p-5 space-y-4 ${isError ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white">{account.profileName}</p>
          <p className="text-[11px] font-mono text-gray-600 mt-0.5">{account.accountId}</p>
          <p className="text-[10px] text-gray-700 mt-0.5">{account.region}</p>
        </div>
        {isError ? (
          <div className="flex items-center gap-1.5 text-red-400 text-[11px]">
            <AlertTriangle size={11} /><span>Error</span>
          </div>
        ) : (
          <div className="text-right">
            <p className="text-lg font-semibold text-white">${account.totalMonthlyCost.toFixed(2)}</p>
            <p className="text-[10px] text-gray-600">this month</p>
          </div>
        )}
      </div>

      {isError && (
        <p className="text-[11px] text-red-600 bg-red-950/20 border border-red-900/20 rounded px-3 py-2">{account.error}</p>
      )}

      {!isError && (
        <>
          <div className="flex items-center gap-4 py-2 border-t border-b border-[#111]">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Server size={11} className="text-indigo-400" />
              <span>{account.resourceCount.ec2} EC2</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Database size={11} className="text-violet-400" />
              <span>{account.resourceCount.rds} RDS</span>
            </div>
          </div>
          {account.topServices.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Top services</p>
              {account.topServices.slice(0, 5).map((svc, i) => (
                <MiniBar key={svc.service} label={svc.service.replace('Amazon ', '').replace('AWS ', '')}
                  value={svc.cost} total={account.totalMonthlyCost} color={SERVICE_COLORS[i % SERVICE_COLORS.length]} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function Aggregator() {
  const navigate = useNavigate();
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['aggregate'],
    queryFn: api.aggregate,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Multi-Account</h1>
          <p className="text-sm text-gray-500 mt-0.5">Aggregate costs and resources across all configured AWS accounts.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/settings')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[#1e1e1e] hover:border-red-800 text-gray-400 hover:text-red-400 rounded-lg transition-all">
            <Plus size={12} /> Add account
          </button>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[#1e1e1e] hover:border-[#2a2a2a] text-gray-400 hover:text-white rounded-lg transition-all">
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            {isFetching ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-gray-600 gap-3">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">Querying all accounts in parallel…</span>
        </div>
      )}

      {error && (
        <div className="card p-5 flex items-start gap-3">
          <AlertTriangle size={14} className="text-red-400 mt-0.5" />
          <p className="text-sm text-red-400">{error.message}</p>
        </div>
      )}

      {data?.accounts?.length === 0 && !isLoading && (
        <div className="card p-10 text-center space-y-3">
          <Globe size={28} className="text-gray-700 mx-auto" />
          <p className="text-sm text-gray-500">No accounts configured yet.</p>
          <p className="text-xs text-gray-600">Add profiles in Settings to see aggregated data here.</p>
          <button onClick={() => navigate('/settings')}
            className="mx-auto flex items-center gap-2 px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors mt-2">
            <Plus size={13} /> Open Settings
          </button>
        </div>
      )}

      {data && data.accounts.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-5 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-emerald-900/20"><DollarSign size={16} className="text-emerald-400" /></div>
              <div>
                <p className="text-xs text-gray-500">Combined monthly</p>
                <p className="text-2xl font-semibold text-white">${data.combinedTotal.toFixed(2)}</p>
                <p className="text-[11px] text-gray-600 mt-0.5">≈ ${(data.combinedTotal * 12).toFixed(0)}/yr</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-indigo-900/20"><Globe size={16} className="text-indigo-400" /></div>
              <div>
                <p className="text-xs text-gray-500">Accounts</p>
                <p className="text-2xl font-semibold text-white">{data.accounts.length}</p>
                <p className="text-[11px] text-gray-600 mt-0.5">{data.accounts.filter(a => !a.error).length} healthy</p>
              </div>
            </div>
            <div className="card p-5 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-violet-900/20"><TrendingUp size={16} className="text-violet-400" /></div>
              <div>
                <p className="text-xs text-gray-500">Total instances</p>
                <p className="text-2xl font-semibold text-white">
                  {data.accounts.reduce((s, a) => s + a.resourceCount.ec2 + a.resourceCount.rds, 0)}
                </p>
                <p className="text-[11px] text-gray-600 mt-0.5">EC2 + RDS running</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {data.accounts.map(a => <AccountCard key={a.profileId} account={a} />)}
          </div>

          <p className="text-[11px] text-gray-700">Scanned at {new Date(data.scannedAt).toLocaleString()}</p>
        </>
      )}
    </div>
  );
}
