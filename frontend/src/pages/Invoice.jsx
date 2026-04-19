import { useQuery } from '@tanstack/react-query';
import { Printer, RefreshCw, Building2, Calendar, TrendingUp, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { api } from '../api/client';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';

function ProgressBar({ value, max = 100, color = '#ef4444' }) {
  return (
    <div className="h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color }}
      />
    </div>
  );
}

export default function Invoice() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['invoice'],
    queryFn: api.invoice,
  });

  if (error) return <div className="p-8"><ErrorMessage error={error} onRetry={refetch} /></div>;

  const fmtDate = str => str ? format(parseISO(str), 'MMMM d, yyyy') : '—';
  const fmtShort = str => str ? format(parseISO(str), 'MMM d') : '—';

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8 no-print">
        <div>
          <h1 className="text-xl font-semibold text-white">Invoice</h1>
          <p className="text-sm text-gray-500 mt-0.5">Month-to-date statement with projected totals</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-white border border-[#1e1e1e] hover:border-[#2a2a2a] px-3 py-1.5 rounded-lg transition-all"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Printer size={12} />
            Print / Export PDF
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size={32} />
        </div>
      ) : (
        <div className="print-page max-w-4xl">
          {/* Invoice header */}
          <div className="card p-6 mb-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-red-600">
                    <FileText size={13} className="text-white" />
                  </div>
                  <span className="text-sm font-semibold text-white">Cloudable</span>
                </div>
                <p className="text-xs text-gray-500">AWS Cost Statement</p>
                {data?.account && (
                  <p className="text-xs text-gray-600 font-mono mt-1">Account: {data.account.id}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-white">{data?.invoiceNumber}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Generated {format(new Date(), 'MMM d, yyyy, h:mm a')}
                </p>
              </div>
            </div>

            {/* Period details */}
            <div className="mt-5 pt-5 border-t border-[#1a1a1a] grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Billing Period</p>
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-gray-500" />
                  <span className="text-sm text-white">
                    {fmtDate(data?.period?.start)} — {fmtDate(data?.period?.end)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Progress</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{data?.period?.daysElapsed} of {data?.period?.daysInMonth} days elapsed</span>
                    <span>{data?.period?.completionPercent}%</span>
                  </div>
                  <ProgressBar value={data?.period?.daysElapsed ?? 0} max={data?.period?.daysInMonth ?? 30} />
                  <p className="text-[10px] text-gray-600">{data?.period?.daysRemaining} days remaining in {format(new Date(), 'MMMM')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cost summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="card p-4">
              <p className="text-xs text-gray-500 mb-2">Month-to-Date</p>
              <p className="text-2xl font-bold text-white">
                ${data?.mtdTotal?.toFixed(2) ?? '—'}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">Billed {fmtShort(data?.period?.start)} – {fmtShort(data?.period?.today)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-gray-500 mb-2">Remaining Forecast</p>
              <p className="text-2xl font-bold text-gray-400">
                {data?.remainingForecast != null ? `$${data.remainingForecast.toFixed(2)}` : '—'}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">Est. {fmtShort(data?.period?.today)} – {fmtShort(data?.period?.end)}</p>
            </div>
            <div className="card p-4 border-red-900/40" style={{ borderColor: 'rgba(127,29,29,0.4)' }}>
              <p className="text-xs text-gray-500 mb-2">Projected Month Total</p>
              <p className="text-2xl font-bold text-red-400">
                {data?.monthEndEstimate != null ? `$${data.monthEndEstimate.toFixed(2)}` : '—'}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">MTD + remaining forecast</p>
            </div>
          </div>

          {/* Line items */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1a1a1a] flex items-center justify-between">
              <h2 className="text-sm font-medium text-white">Line Items</h2>
              <span className="text-xs text-gray-500">{data?.lineItems?.length ?? 0} services</span>
            </div>
            <table className="w-full text-xs">
              <thead style={{ background: '#0e0e0e', borderBottom: '1px solid #1a1a1a' }}>
                <tr>
                  <th className="text-left px-5 py-3 text-gray-500 font-medium uppercase tracking-wider">#</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium uppercase tracking-wider">Service</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium uppercase tracking-wider">MTD Cost</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium uppercase tracking-wider">Share</th>
                  <th className="text-right px-5 py-3 text-gray-500 font-medium uppercase tracking-wider">Proj. Month</th>
                </tr>
              </thead>
              <tbody>
                {(data?.lineItems ?? []).map((item, i) => {
                  const share = data.mtdTotal > 0 ? (item.mtdCost / data.mtdTotal) * 100 : 0;
                  const daysElapsed = data?.period?.daysElapsed ?? 1;
                  const daysInMonth = data?.period?.daysInMonth ?? 30;
                  const projectedMonth = (item.mtdCost / daysElapsed) * daysInMonth;

                  return (
                    <tr
                      key={item.service}
                      style={{ borderBottom: '1px solid #111111' }}
                      className="hover:bg-[#121212] transition-colors"
                    >
                      <td className="px-5 py-3 text-gray-600">{i + 1}</td>
                      <td className="px-4 py-3 text-gray-200 max-w-[280px]">
                        <span title={item.service}>{item.service}</span>
                      </td>
                      <td className="px-5 py-3 text-right font-mono font-medium text-white">
                        ${item.mtdCost.toFixed(2)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1 rounded-full bg-[#1a1a1a] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-red-600 opacity-60"
                              style={{ width: `${Math.min(share, 100)}%` }}
                            />
                          </div>
                          <span className="text-gray-500 w-10 text-right">{share.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-gray-400">
                        ${projectedMonth.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ borderTop: '1px solid #1e1e1e', background: '#0e0e0e' }}>
                <tr>
                  <td colSpan={2} className="px-5 py-4 text-sm font-semibold text-white">Total</td>
                  <td className="px-5 py-4 text-right font-mono font-bold text-white text-sm">
                    ${data?.mtdTotal?.toFixed(2) ?? '—'}
                  </td>
                  <td className="px-5 py-4 text-right text-gray-500 text-xs">100%</td>
                  <td className="px-5 py-4 text-right font-mono font-bold text-red-400 text-sm">
                    {data?.monthEndEstimate != null ? `$${data.monthEndEstimate.toFixed(2)}` : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer note */}
          <p className="mt-4 text-[10px] text-gray-700 text-center">
            Costs are unblended and may not match your AWS invoice exactly. Forecast is an AWS Cost Explorer projection.
            {data?.generatedAt && ` · Generated ${new Date(data.generatedAt).toLocaleString()}`}
          </p>
        </div>
      )}
    </div>
  );
}
