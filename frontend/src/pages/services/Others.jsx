import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Zap, Globe, Container, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../../api/client';

const TABS = ['Lambda', 'ECS', 'Route 53'];

function ErrorRate({ rate }) {
  const c = rate > 10 ? '#ef4444' : rate > 2 ? '#f59e0b' : '#10b981';
  return <span className="text-xs font-mono" style={{ color: c }}>{rate}%</span>;
}

export default function Others() {
  const [region, setRegion] = useState(import.meta.env.VITE_AWS_REGION || 'us-east-1');
  const [tab, setTab] = useState('Lambda');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { window.electronAPI?.loadDefaultRegion().then(r => r && setRegion(r)); }, []);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['others', region],
    queryFn: () => api.others(region),
    staleTime: 5 * 60 * 1000,
  });

  const lambdaFns = data?.lambda?.functions ?? [];
  const ecsServices = data?.ecs?.services ?? [];
  const zones = data?.route53?.zones ?? [];
  const zoneTotal = data?.route53?.count ?? 0;

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Other Services</h1>
          <p className="text-sm text-gray-500 mt-0.5">Lambda functions, ECS services, and Route 53 zones</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600 font-mono">{region}</span>
          <button onClick={() => refetch()} disabled={isFetching}
            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[#1e1e1e] hover:border-[#2a2a2a] text-gray-400 hover:text-white rounded-lg transition-all">
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[#111] border border-[#1e1e1e] rounded-lg w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-xs rounded-md transition-all ${tab === t ? 'bg-red-600 text-white font-medium' : 'text-gray-500 hover:text-gray-300'}`}>
            {t} {t === 'Lambda' && !isLoading && <span className="opacity-60">({lambdaFns.length})</span>}
            {t === 'ECS'    && !isLoading && <span className="opacity-60">({ecsServices.length})</span>}
            {t === 'Route 53' && !isLoading && <span className="opacity-60">({zoneTotal})</span>}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-600">
          <RefreshCw size={16} className="animate-spin" /><span className="text-sm">Loading…</span>
        </div>
      )}

      {/* Lambda */}
      {!isLoading && tab === 'Lambda' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#111]">
                {['Function', 'Runtime', 'Memory', 'Timeout', 'Invocations (7d)', 'Error Rate', 'Avg Duration', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lambdaFns.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-xs text-gray-600">No Lambda functions found.</td></tr>
              )}
              {lambdaFns.map(fn => (
                <>
                  <tr key={fn.name} className="border-b border-[#0e0e0e] hover:bg-[#0a0a0a] transition-colors cursor-pointer"
                    onClick={() => setExpanded(e => e === fn.name ? null : fn.name)}>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-white truncate max-w-[160px]">{fn.name}</p>
                      {fn.description && <p className="text-[10px] text-gray-600 mt-0.5 truncate max-w-[160px]">{fn.description}</p>}
                    </td>
                    <td className="px-4 py-3"><span className="text-[10px] font-mono text-gray-400">{fn.runtime ?? '—'}</span></td>
                    <td className="px-4 py-3"><span className="text-xs text-gray-400">{fn.memorySizeMb} MB</span></td>
                    <td className="px-4 py-3"><span className="text-xs text-gray-400">{fn.timeoutSec}s</span></td>
                    <td className="px-4 py-3"><span className="text-xs font-mono text-gray-300">{fn.invocations7d.toLocaleString()}</span></td>
                    <td className="px-4 py-3">{fn.invocations7d > 0 ? <ErrorRate rate={fn.errorRate7d} /> : <span className="text-xs text-gray-700">—</span>}</td>
                    <td className="px-4 py-3"><span className="text-xs font-mono text-gray-400">{fn.avgDurationMs7d != null ? `${fn.avgDurationMs7d} ms` : '—'}</span></td>
                    <td className="px-2 py-3 text-gray-600">{expanded === fn.name ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</td>
                  </tr>
                  {expanded === fn.name && (
                    <tr key={`${fn.name}-d`} className="bg-[#080808] border-b border-[#111]">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-3 gap-6 text-xs">
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-gray-600 uppercase tracking-wider">Config</p>
                            <p className="text-gray-400">Handler: <span className="font-mono text-gray-300">{fn.handler}</span></p>
                            <p className="text-gray-400">Code size: <span className="text-gray-300">{(fn.codeSize / 1024).toFixed(0)} KB</span></p>
                            <p className="text-gray-400">VPC: <span className="font-mono text-gray-300">{fn.vpcId || 'None'}</span></p>
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-[10px] text-gray-600 uppercase tracking-wider">7-day metrics</p>
                            <p className="text-gray-400">Total invocations: <span className="text-gray-300">{fn.invocations7d.toLocaleString()}</span></p>
                            <p className="text-gray-400">Total errors: <span className="text-gray-300">{fn.errors7d}</span></p>
                          </div>
                          {fn.lastModified && (
                            <div className="space-y-1.5">
                              <p className="text-[10px] text-gray-600 uppercase tracking-wider">Last modified</p>
                              <p className="text-gray-300">{new Date(fn.lastModified).toLocaleDateString()}</p>
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

      {/* ECS */}
      {!isLoading && tab === 'ECS' && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#111]">
                {['Service', 'Cluster', 'Launch Type', 'Status', 'Tasks', 'Task Def'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wider font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ecsServices.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-xs text-gray-600">No ECS services found.</td></tr>
              )}
              {ecsServices.map(svc => {
                const healthy = svc.runningCount >= svc.desiredCount;
                return (
                  <tr key={svc.name} className="border-b border-[#0e0e0e] hover:bg-[#0a0a0a] transition-colors">
                    <td className="px-4 py-3"><p className="text-xs font-medium text-white">{svc.name}</p></td>
                    <td className="px-4 py-3"><span className="text-[10px] font-mono text-gray-500">{svc.cluster}</span></td>
                    <td className="px-4 py-3"><span className="text-[10px] text-gray-400">{svc.launchType}</span></td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] ${svc.status === 'ACTIVE' ? 'text-emerald-400' : 'text-red-400'}`}>{svc.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-mono ${healthy ? 'text-emerald-400' : 'text-red-400'}`}>
                        {svc.runningCount}/{svc.desiredCount}
                        {!healthy && <AlertTriangle size={10} className="inline ml-1" />}
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className="text-[10px] font-mono text-gray-600">{svc.taskDefinition}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Route53 */}
      {!isLoading && tab === 'Route 53' && (
        <div className="space-y-3">
          {zoneTotal > zones.length && (
            <p className="text-xs text-gray-600">Showing first {zones.length} of {zoneTotal} zones</p>
          )}
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#111]">
                  {['Zone Name', 'ID', 'Type', 'Records'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wider font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zones.length === 0 && (
                  <tr><td colSpan={4} className="py-10 text-center text-xs text-gray-600">No hosted zones found.</td></tr>
                )}
                {zones.map(z => (
                  <tr key={z.id} className="border-b border-[#0e0e0e] hover:bg-[#0a0a0a] transition-colors">
                    <td className="px-4 py-3"><p className="text-xs font-medium text-white font-mono">{z.name}</p></td>
                    <td className="px-4 py-3"><span className="text-[10px] font-mono text-gray-600">{z.id}</span></td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] ${z.isPrivate ? 'text-indigo-400' : 'text-emerald-400'}`}>
                        {z.isPrivate ? 'Private' : 'Public'}
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className="text-xs font-mono text-gray-400">{z.recordCount}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
