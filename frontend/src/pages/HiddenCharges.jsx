import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronRight, RefreshCw, Eye, Shield } from 'lucide-react';
import { api } from '../api/client';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';

function SeverityBadge({ severity }) {
  return <span className={`badge-${severity}`}>{severity}</span>;
}

function CategoryCard({ cat }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card card-hover overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-sm font-medium text-white">{cat.category}</span>
            <SeverityBadge severity={cat.severity} />
            {cat.isActualCost && (
              <span className="text-[10px] text-gray-500 border border-[#2a2a2a] px-1.5 py-0.5 rounded">actual cost</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 pr-8">{cat.description}</p>
        </div>
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500">Items</p>
            <p className="text-sm font-medium text-white">{cat.count}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Est. / month</p>
            <p className="text-sm font-semibold text-red-400">${cat.estimatedMonthlyCost.toFixed(2)}</p>
          </div>
          <span className="text-gray-600">
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
        </div>
      </button>

      {/* Item list */}
      {open && (
        <div style={{ borderTop: '1px solid #1a1a1a' }}>
          <table className="w-full text-xs">
            <thead style={{ background: '#0e0e0e' }}>
              <tr style={{ borderBottom: '1px solid #161616' }}>
                <th className="text-left px-5 py-2 text-gray-600 font-medium">Resource</th>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Detail</th>
                <th className="text-right px-5 py-2 text-gray-600 font-medium">Est. Cost/mo</th>
              </tr>
            </thead>
            <tbody>
              {cat.items.map((item, i) => (
                <tr key={item.id || i} style={{ borderBottom: '1px solid #111111' }} className="hover:bg-[#121212] transition-colors">
                  <td className="px-5 py-2.5 font-mono text-gray-300">{item.id}</td>
                  <td className="px-4 py-2.5 text-gray-400 max-w-[300px]">
                    <p>{item.description}</p>
                    {item.detail && <p className="text-gray-600 mt-0.5">{item.detail}</p>}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono text-red-400">
                    ${item.estimatedMonthlyCost.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cat.items.length < cat.count && (
            <p className="px-5 py-2 text-[10px] text-gray-600 border-t border-[#111111]">
              Showing first {cat.items.length} of {cat.count} items
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function HiddenCharges() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hidden'],
    queryFn: api.hidden,
  });

  const highCount = data?.categories?.filter(c => c.severity === 'high').length ?? 0;
  const mediumCount = data?.categories?.filter(c => c.severity === 'medium').length ?? 0;

  if (error) return <div className="p-8"><ErrorMessage error={error} onRetry={refetch} /></div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Hidden Charges</h1>
          <p className="text-sm text-gray-500 mt-0.5">Orphaned resources, waste, and non-obvious billing</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-white border border-[#1e1e1e] hover:border-[#2a2a2a] px-3 py-1.5 rounded-lg transition-all"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Spinner size={32} />
          <p className="text-sm text-gray-500">Scanning your AWS account for waste...</p>
          <p className="text-xs text-gray-600">This may take 10–30 seconds</p>
        </div>
      ) : (
        <>
          {/* Summary banner */}
          {data?.totalEstimatedWaste > 0 ? (
            <div className="mb-6 p-5 rounded-xl border border-red-900/40" style={{ background: 'rgba(127,29,29,0.12)' }}>
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-red-950/60">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white mb-1">
                    Estimated waste: <span className="text-red-400">${data.totalEstimatedWaste.toFixed(2)}/month</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    Found {data.categories.length} category{data.categories.length !== 1 ? 's' : ''} of billable waste
                    {highCount > 0 && ` — ${highCount} high severity`}
                    {mediumCount > 0 && `, ${mediumCount} medium severity`}.
                    Estimates are approximate; actual costs may differ.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">Annualized</p>
                  <p className="text-lg font-bold text-red-400">${(data.totalEstimatedWaste * 12).toFixed(0)}</p>
                </div>
              </div>
            </div>
          ) : data?.categories?.length === 0 ? (
            <div className="mb-6 p-5 rounded-xl border border-emerald-900/30" style={{ background: 'rgba(6,78,59,0.1)' }}>
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-emerald-400" />
                <p className="text-sm text-emerald-300 font-medium">No significant waste detected in this region.</p>
              </div>
            </div>
          ) : null}

          {/* Severity legend */}
          {data?.categories?.length > 0 && (
            <div className="flex items-center gap-4 mb-4">
              <span className="text-xs text-gray-600">Severity:</span>
              <span className="badge-high">high — take action</span>
              <span className="badge-medium">medium — review</span>
              <span className="badge-low">low — informational</span>
            </div>
          )}

          {/* Category cards */}
          <div className="space-y-3">
            {(data?.categories ?? []).map((cat, i) => (
              <CategoryCard key={cat.category} cat={cat} />
            ))}
          </div>

          {data?.scannedAt && (
            <p className="mt-4 text-[10px] text-gray-700 text-right">
              Scanned {new Date(data.scannedAt).toLocaleString()} · Region: {import.meta.env.VITE_AWS_REGION || 'configured region'}
            </p>
          )}
        </>
      )}
    </div>
  );
}
