import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Server, RefreshCw, HardDrive, Cpu, Wifi, ChevronDown, ChevronUp, Globe } from 'lucide-react';
import { api } from '../../api/client';

const STATE_COLOR = { running: '#10b981', stopped: '#ef4444', stopping: '#f59e0b', pending: '#6366f1' };

function UtilBar({ value, max = 100 }) {
  if (value == null) return <span className="text-[10px] text-gray-700">No data</span>;
  const pct = Math.min(100, (value / max) * 100);
  const c = value < 20 ? '#10b981' : value < 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
      </div>
      <span className="text-[10px] font-mono text-gray-400">{value}%</span>
    </div>
  );
}

export default function EC2() {
  const [region, setRegion] = useState(import.meta.env.VITE_AWS_REGION || 'us-east-1');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { window.electronAPI?.loadDefaultRegion().then(r => r && setRegion(r)); }, []);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['ec2', region],
    queryFn: () => api.ec2(region),
    staleTime: 5 * 60 * 1000,
  });

  const instances = data?.instances ?? [];
  const running = instances.filter(i => i.state === 'running').length;
  const stopped = instances.filter(i => i.state === 'stopped').length;

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">EC2 Instances</h1>
          <p className="text-sm text-gray-500 mt-0.5">Compute instances with metadata and 7-day utilization</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-mono">{region}</span>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[#1e1e1e] hover:border-[#2a2a2a] text-gray-400 hover:text-white rounded-lg transition-all">
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {!isLoading && data && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" />{running} running</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />{stopped} stopped</span>
          <span className="text-gray-700">{instances.length} total</span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-600">
          <RefreshCw size={16} className="animate-spin" /><span className="text-sm">Loading instances…</span>
        </div>
      )}

      {!isLoading && instances.length === 0 && (
        <div className="card p-10 text-center text-xs text-gray-600">No EC2 instances found in {region}.</div>
      )}

      {!isLoading && instances.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#111]">
                {['Instance', 'Type', 'State', 'IP', 'Storage', 'Avg CPU (7d)', 'Net In (7d)', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {instances.map(inst => (
                <>
                  <tr key={inst.id} className="border-b border-[#0e0e0e] hover:bg-[#0a0a0a] transition-colors cursor-pointer"
                    onClick={() => setExpanded(e => e === inst.id ? null : inst.id)}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-white truncate max-w-[140px]">{inst.name}</p>
                      <p className="text-[10px] text-gray-600 font-mono mt-0.5">{inst.id}</p>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs font-mono text-gray-300">{inst.instanceType}</span></td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: STATE_COLOR[inst.state] ?? '#9ca3af' }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATE_COLOR[inst.state] ?? '#9ca3af' }} />
                        {inst.state}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[10px] font-mono text-gray-400">{inst.privateIp || '—'}</p>
                      {inst.publicIp && <p className="text-[10px] font-mono text-gray-600 mt-0.5 flex items-center gap-1"><Globe size={9} />{inst.publicIp}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-400">{inst.totalStorageGb > 0 ? `${inst.totalStorageGb} GB` : '—'}</span>
                    </td>
                    <td className="px-4 py-3"><UtilBar value={inst.avgCpu7d} /></td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-400">{inst.netInMb7d != null ? `${inst.netInMb7d} MB` : '—'}</span>
                    </td>
                    <td className="px-2 py-3 text-gray-600">
                      {expanded === inst.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </td>
                  </tr>
                  {expanded === inst.id && (
                    <tr key={`${inst.id}-detail`} className="bg-[#080808] border-b border-[#111]">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-4 gap-6 text-xs">
                          <div className="space-y-2">
                            <p className="text-[10px] text-gray-600 uppercase tracking-wider">Compute</p>
                            <p className="text-gray-400">AMI: <span className="font-mono text-gray-300">{inst.imageId}</span></p>
                            <p className="text-gray-400">Key: <span className="font-mono text-gray-300">{inst.keyName || '—'}</span></p>
                            <p className="text-gray-400">Platform: <span className="text-gray-300">{inst.platform}</span></p>
                            <p className="text-gray-400">AZ: <span className="text-gray-300">{inst.az}</span></p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] text-gray-600 uppercase tracking-wider">Network</p>
                            <p className="text-gray-400">VPC: <span className="font-mono text-gray-300">{inst.vpcId || '—'}</span></p>
                            <p className="text-gray-400">Subnet: <span className="font-mono text-gray-300">{inst.subnetId || '—'}</span></p>
                            <p className="text-gray-400">Max CPU: <span className="text-gray-300">{inst.maxCpu7d != null ? `${inst.maxCpu7d}%` : '—'}</span></p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] text-gray-600 uppercase tracking-wider">Storage ({inst.volumes.length} vol)</p>
                            {inst.volumes.map(v => (
                              <p key={v.id} className="text-gray-400 font-mono text-[10px]">{v.id} · {v.size} GB · {v.type}</p>
                            ))}
                          </div>
                          {inst.tags.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] text-gray-600 uppercase tracking-wider">Tags</p>
                              {inst.tags.slice(0, 6).map(t => (
                                <p key={t} className="text-[10px] font-mono text-gray-500 truncate">{t}</p>
                              ))}
                            </div>
                          )}
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
