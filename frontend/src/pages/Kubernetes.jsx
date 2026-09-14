import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRegion } from '../context/RegionContext';
import { RefreshCw, AlertCircle, Info, ChevronDown, Boxes } from 'lucide-react';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import K8sCanvas from '../components/kubernetes/K8sCanvas';

const BASE = import.meta.env.VITE_API_URL || '';

function fetchClusters(region) {
  return fetch(`${BASE}/api/kubernetes/clusters?region=${region}`)
    .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(new Error(e.error))));
}

function fetchTopology(region, cluster) {
  return fetch(`${BASE}/api/kubernetes/topology?region=${region}&cluster=${encodeURIComponent(cluster)}`)
    .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(new Error(e.error))));
}

function ClusterPicker({ clusters, value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs border border-[#1e1e1e] hover:border-green-900/60 bg-[#111111] hover:bg-[#141414] text-gray-300 px-2.5 py-1.5 rounded-lg transition-all"
      >
        <span className="font-mono text-green-400">{value || 'Select cluster'}</span>
        <ChevronDown size={11} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 card py-1 overflow-y-auto" style={{ minWidth: 220, maxHeight: 320, background: '#111111' }}>
            {clusters.length === 0 && <p className="px-3 py-2 text-xs text-gray-600">No EKS clusters found</p>}
            {clusters.map(c => (
              <button
                key={c.name}
                onClick={() => { onChange(c.name); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors flex items-center justify-between gap-2 ${
                  c.name === value ? 'text-green-400 bg-green-950/30' : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                <span className="truncate">{c.name}</span>
                <span className="text-[10px] text-gray-600 shrink-0">{c.status}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Kubernetes() {
  const { region } = useRegion();
  const [cluster, setCluster] = useState('');

  const { data: clusterData, isLoading: clustersLoading, error: clustersError } = useQuery({
    queryKey: ['k8s-clusters', region],
    queryFn: () => fetchClusters(region),
    staleTime: 5 * 60 * 1000,
  });

  const clusters = clusterData?.clusters ?? [];

  useEffect(() => {
    if (!cluster && clusters.length > 0) setCluster(clusters[0].name);
  }, [clusters, cluster]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['k8s-topology', region, cluster],
    queryFn: () => fetchTopology(region, cluster),
    enabled: !!cluster,
    staleTime: 60 * 1000,
  });

  const hasData = data && data.nodes?.length > 0;
  const podCount = data?.nodes?.filter(n => n.type === 'pod').length ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="px-8 py-8 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #1a1a1a' }}>
        <div>
          <h1 className="text-xl font-semibold text-white">Kubernetes Topology</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-gray-500">Pods, controllers, and how traffic reaches them</p>
            <span className="text-gray-700">·</span>
            {clustersLoading ? (
              <span className="text-xs text-gray-600">Loading clusters...</span>
            ) : (
              <ClusterPicker clusters={clusters} value={cluster} onChange={setCluster} />
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasData && (
            <span className="text-xs text-gray-500">
              {podCount} pods · {data.nodes.length} objects · {data.edges.length} connections
            </span>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching || !cluster}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-white border border-[#1e1e1e] hover:border-[#2a2a2a] disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all"
          >
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            {isFetching ? 'Scanning...' : 'Re-scan'}
          </button>
        </div>
      </div>

      {hasData && (
        <div className="px-8 py-2 flex items-center gap-2 shrink-0" style={{ borderBottom: '1px solid #111111', background: '#0a0a0a' }}>
          <Info size={11} className="text-gray-600 shrink-0" />
          <p className="text-[11px] text-gray-600">
            Click any object to inspect it. Grey lines are controller ownership, green lines are Service routing. Scroll to zoom, drag to pan.
          </p>
        </div>
      )}

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {clustersError ? (
          <div className="p-8"><ErrorMessage error={clustersError} /></div>
        ) : !clustersLoading && clusters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-24 gap-3">
            <div className="p-3 bg-[#111111] rounded-full border border-[#1e1e1e]"><Boxes size={20} className="text-gray-600" /></div>
            <p className="text-sm text-gray-400">No EKS clusters found in <span className="font-mono text-gray-300">{region}</span></p>
            <p className="text-xs text-gray-600">Try a different region using the region picker in the sidebar.</p>
          </div>
        ) : !cluster ? null : isLoading || isFetching ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-24">
            <Spinner size={36} />
            <p className="text-sm text-gray-400">Scanning {cluster}...</p>
            <p className="text-xs text-gray-600">Discovering pods, deployments, services, and their connections...</p>
          </div>
        ) : error ? (
          <div className="p-8"><ErrorMessage error={error} onRetry={refetch} /></div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-full py-24 gap-3">
            <div className="p-3 bg-[#111111] rounded-full border border-[#1e1e1e]"><AlertCircle size={20} className="text-gray-600" /></div>
            <p className="text-sm text-gray-400">No workloads found in <span className="font-mono text-gray-300">{cluster}</span></p>
          </div>
        ) : (
          <K8sCanvas data={data} region={region} />
        )}
      </div>
    </div>
  );
}
