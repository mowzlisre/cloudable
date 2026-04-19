import { useQuery } from '@tanstack/react-query';
import { HardDrive, RefreshCw, AlertTriangle, CheckCircle2, Shield, Archive, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../api/client';

function WasteTag({ label }) {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-red-950/40 border border-red-900/30 text-red-400">
      <AlertTriangle size={8} /> {label}
    </span>
  );
}

function FmtBytes({ gb }) {
  if (gb == null) return <span className="text-gray-700">—</span>;
  if (gb < 0.001) return <span className="text-gray-400">{'< 1 MB'}</span>;
  if (gb < 1) return <span className="text-gray-400">{(gb * 1024).toFixed(1)} MB</span>;
  return <span className="text-gray-400">{gb.toFixed(2)} GB</span>;
}

export default function S3() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['s3'],
    queryFn: api.s3,
    staleTime: 10 * 60 * 1000,
  });

  const buckets = data?.buckets ?? [];
  const wasteCount = buckets.filter(b => b.wasteFlags?.length > 0).length;

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">S3 Buckets</h1>
          <p className="text-sm text-gray-500 mt-0.5">Storage waste analysis — lifecycle, versioning, public access, orphaned uploads</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[#1e1e1e] hover:border-[#2a2a2a] text-gray-400 hover:text-white rounded-lg transition-all">
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {!isLoading && data && (
        <div className="grid grid-cols-4 gap-4">
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-900/20"><HardDrive size={14} className="text-indigo-400" /></div>
            <div>
              <p className="text-[10px] text-gray-600">Total buckets</p>
              <p className="text-lg font-semibold text-white">{data.count}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-900/20"><Archive size={14} className="text-emerald-400" /></div>
            <div>
              <p className="text-[10px] text-gray-600">Total size</p>
              <p className="text-lg font-semibold text-white">{data.totalSizeGb.toFixed(1)} GB</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-900/20"><AlertTriangle size={14} className="text-red-400" /></div>
            <div>
              <p className="text-[10px] text-gray-600">Waste flags</p>
              <p className="text-lg font-semibold text-white">{wasteCount}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-900/20"><Shield size={14} className="text-yellow-400" /></div>
            <div>
              <p className="text-[10px] text-gray-600">Public exposure</p>
              <p className="text-lg font-semibold text-white">{buckets.filter(b => b.publicBlocked === false).length}</p>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-600">
          <RefreshCw size={16} className="animate-spin" /><span className="text-sm">Scanning all buckets…</span>
        </div>
      )}

      {!isLoading && buckets.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#111] flex items-center gap-2">
            <HardDrive size={13} className="text-gray-500" />
            <h2 className="text-sm font-medium text-white">Buckets</h2>
            <span className="text-[11px] text-gray-600 ml-1">{data.count} buckets</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#111]">
                {['Bucket', 'Region', 'Size', 'Objects', 'Lifecycle', 'Versioning', 'Public', 'Waste Flags'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buckets.map(b => (
                <tr key={b.name} className={`border-b border-[#0e0e0e] transition-colors ${b.wasteFlags?.length > 0 ? 'hover:bg-red-950/5' : 'hover:bg-[#0a0a0a]'}`}>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-white font-mono">{b.name}</p>
                    {b.creationDate && <p className="text-[10px] text-gray-700 mt-0.5">Created {format(new Date(b.creationDate), 'MMM d, yyyy')}</p>}
                  </td>
                  <td className="px-4 py-3"><span className="text-[10px] font-mono text-gray-500">{b.region}</span></td>
                  <td className="px-4 py-3"><FmtBytes gb={b.sizeGb} /></td>
                  <td className="px-4 py-3"><span className="text-xs font-mono text-gray-400">{b.objectCount != null ? b.objectCount.toLocaleString() : '—'}</span></td>
                  <td className="px-4 py-3">
                    {b.hasLifecycle
                      ? <CheckCircle2 size={13} className="text-emerald-500" />
                      : <span className="text-[10px] text-red-400">None</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] ${b.versioningStatus === 'Enabled' ? 'text-emerald-400' : 'text-gray-600'}`}>
                      {b.versioningStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {b.publicBlocked === true  && <CheckCircle2 size={13} className="text-emerald-500" />}
                    {b.publicBlocked === false && <span className="text-[10px] text-yellow-400 flex items-center gap-1"><AlertTriangle size={10} /> Exposed</span>}
                    {b.publicBlocked == null   && <span className="text-[10px] text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {b.wasteFlags?.length > 0
                        ? b.wasteFlags.map(f => <WasteTag key={f} label={f} />)
                        : <span className="text-[10px] text-emerald-500 flex items-center gap-1"><CheckCircle2 size={9} /> Clean</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && buckets.length === 0 && (
        <div className="card p-10 text-center text-xs text-gray-600">No S3 buckets found.</div>
      )}
    </div>
  );
}
