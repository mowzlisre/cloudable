import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { api } from '../../api/client';

const STATUS_COLOR = { available: '#10b981', stopped: '#ef4444', 'backing-up': '#6366f1', modifying: '#f59e0b' };

function StorageBar({ used, total }) {
  if (!total) return <span className="text-[10px] text-gray-700">—</span>;
  const pct = Math.min(100, (used / total) * 100);
  const c = pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : '#10b981';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
      </div>
      <span className="text-[10px] font-mono text-gray-400">{pct.toFixed(0)}%</span>
    </div>
  );
}

export default function RDS() {
  const [region, setRegion] = useState(import.meta.env.VITE_AWS_REGION || 'us-east-1');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { window.electronAPI?.loadDefaultRegion().then(r => r && setRegion(r)); }, []);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['rds', region],
    queryFn: () => api.rds(region),
    staleTime: 5 * 60 * 1000,
  });

  const instances = data?.instances ?? [];

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">RDS Instances</h1>
          <p className="text-sm text-gray-500 mt-0.5">Database instances with storage, connections, and utilization</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-mono">{region}</span>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[#1e1e1e] hover:border-[#2a2a2a] text-gray-400 hover:text-white rounded-lg transition-all">
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-600">
          <RefreshCw size={16} className="animate-spin" /><span className="text-sm">Loading instances…</span>
        </div>
      )}

      {!isLoading && instances.length === 0 && (
        <div className="card p-10 text-center text-xs text-gray-600">No RDS instances found in {region}.</div>
      )}

      {!isLoading && instances.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#111]">
                {['Identifier', 'Engine', 'Class', 'Status', 'Storage', 'Avg CPU (7d)', 'Avg Connections', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {instances.map(db => (
                <>
                  <tr key={db.id} className="border-b border-[#0e0e0e] hover:bg-[#0a0a0a] transition-colors cursor-pointer"
                    onClick={() => setExpanded(e => e === db.id ? null : db.id)}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-white">{db.id}</p>
                      {db.clusterIdentifier && <p className="text-[10px] text-gray-600 mt-0.5">cluster: {db.clusterIdentifier}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-mono text-gray-300">{db.engine}</p>
                      <p className="text-[10px] text-gray-600">{db.engineVersion}</p>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs font-mono text-gray-300">{db.instanceClass}</span></td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: STATUS_COLOR[db.status] ?? '#9ca3af' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLOR[db.status] ?? '#9ca3af' }} />
                        {db.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StorageBar used={db.usedStorageGb} total={db.allocatedStorageGb} />
                      <p className="text-[10px] text-gray-600 mt-0.5">{db.usedStorageGb ?? '?'}/{db.allocatedStorageGb} GB</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-400">{db.avgCpu7d != null ? `${db.avgCpu7d}%` : '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-400">{db.avgConnections7d ?? '—'}</span>
                    </td>
                    <td className="px-2 py-3 text-gray-600">
                      {expanded === db.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </td>
                  </tr>
                  {expanded === db.id && (
                    <tr key={`${db.id}-detail`} className="bg-[#080808] border-b border-[#111]">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-3 gap-6 text-xs">
                          <div className="space-y-2">
                            <p className="text-[10px] text-gray-600 uppercase tracking-wider">Configuration</p>
                            <p className="text-gray-400">AZ: <span className="text-gray-300">{db.az}</span></p>
                            <p className="text-gray-400">Multi-AZ: <span className="text-gray-300">{db.multiAz ? 'Yes' : 'No'}</span></p>
                            <p className="text-gray-400">Storage type: <span className="font-mono text-gray-300">{db.storageType}</span></p>
                            <p className="text-gray-400">Public: <span className={db.publiclyAccessible ? 'text-yellow-400' : 'text-gray-300'}>{db.publiclyAccessible ? 'Yes ⚠' : 'No'}</span></p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] text-gray-600 uppercase tracking-wider">Endpoint</p>
                            <p className="font-mono text-gray-300 break-all">{db.endpoint || '—'}</p>
                            <p className="text-gray-400">Port: <span className="font-mono text-gray-300">{db.port}</span></p>
                            <p className="text-gray-400">VPC: <span className="font-mono text-gray-300">{db.vpcId || '—'}</span></p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] text-gray-600 uppercase tracking-wider">Performance (7d)</p>
                            <p className="text-gray-400">CPU max: <span className="text-gray-300">{db.maxCpu7d != null ? `${db.maxCpu7d}%` : '—'}</span></p>
                            <p className="text-gray-400">Free storage: <span className="text-gray-300">{db.freeStorageGb != null ? `${db.freeStorageGb} GB` : '—'}</span></p>
                            <p className="text-gray-400">Storage util: <span className="text-gray-300">{db.storageUtilPct != null ? `${db.storageUtilPct}%` : '—'}</span></p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
