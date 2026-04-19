import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRegion } from '../context/RegionContext';
import { Map, RefreshCw, AlertCircle, Info, ChevronDown, Download } from 'lucide-react';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import MapCanvas from '../components/mapper/MapCanvas';

const BASE = import.meta.env.VITE_API_URL || '';

const REGIONS = [
  { group: 'US',            regions: ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2'] },
  { group: 'Europe',        regions: ['eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1', 'eu-south-1'] },
  { group: 'Asia Pacific',  regions: ['ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2', 'ap-south-1', 'ap-east-1'] },
  { group: 'Other',         regions: ['ca-central-1', 'sa-east-1', 'af-south-1', 'me-south-1', 'me-central-1'] },
];

const ALL_REGIONS = REGIONS.flatMap(g => g.regions);

function fetchMapper(region) {
  return fetch(`${BASE}/api/mapper?region=${region}`)
    .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(new Error(e.error))));
}

function RegionPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs border border-[#1e1e1e] hover:border-red-900/60 bg-[#111111] hover:bg-[#141414] text-gray-300 px-2.5 py-1.5 rounded-lg transition-all"
      >
        <span className="font-mono text-red-400">{value}</span>
        <ChevronDown size={11} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1 z-20 card py-1 overflow-y-auto"
            style={{ minWidth: 180, maxHeight: 320, background: '#111111' }}
          >
            {REGIONS.map(({ group, regions }) => (
              <div key={group}>
                <p className="px-3 pt-2 pb-1 text-[10px] text-gray-600 uppercase tracking-wider">{group}</p>
                {regions.map(r => (
                  <button
                    key={r}
                    onClick={() => { onChange(r); setOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors ${
                      r === value
                        ? 'text-red-400 bg-red-950/30'
                        : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Mapper() {
  const { region, setRegion } = useRegion();
  const qc = useQueryClient();

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['mapper', region],
    queryFn: () => fetchMapper(region),
    staleTime: 10 * 60 * 1000,
  });

  function handleRegionChange(r) {
    setRegion(r);
    // query auto-refetches because key changes; no manual call needed
  }

  const hasData = data && data.nodes?.length > 0;

  function handleExport() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `cloudable-topology-${region}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="px-8 py-5 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #1a1a1a' }}>
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-red-950/60 rounded-lg">
            <Map size={15} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white leading-none">Resource Mapper</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-gray-500">Visual topology of your AWS infrastructure</p>
              <span className="text-gray-700">·</span>
              <RegionPicker value={region} onChange={handleRegionChange} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hasData && (
            <span className="text-xs text-gray-500">
              {data.nodes.length} resources · {data.edges.length} connections
            </span>
          )}
          {hasData && (
            <button onClick={handleExport}
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-white border border-[#1e1e1e] hover:border-[#2a2a2a] px-3 py-1.5 rounded-lg transition-all">
              <Download size={12} /> Export JSON
            </button>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-white border border-[#1e1e1e] hover:border-[#2a2a2a] disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all"
          >
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            {isFetching ? 'Scanning...' : 'Re-scan'}
          </button>
        </div>
      </div>

      {/* Hint bar */}
      {hasData && (
        <div className="px-8 py-2 flex items-center gap-2 shrink-0" style={{ borderBottom: '1px solid #111111', background: '#0a0a0a' }}>
          <Info size={11} className="text-gray-600 shrink-0" />
          <p className="text-[11px] text-gray-600">
            Click any resource to inspect its details. Dashed red lines are security group rules (showing allowed traffic). Scroll to zoom, drag to pan.
          </p>
        </div>
      )}

      {/* Canvas area — overflow:hidden keeps RF controls within bounds */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        {isLoading || isFetching ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 py-24">
            <Spinner size={36} />
            <p className="text-sm text-gray-400">Scanning {region}...</p>
            <p className="text-xs text-gray-600">Discovering EC2, RDS, VPCs, subnets, security groups, load balancers...</p>
          </div>
        ) : error ? (
          <div className="p-8">
            <ErrorMessage error={error} onRetry={refetch} />
          </div>
        ) : !hasData ? (
          <div className="flex flex-col items-center justify-center h-full py-24 gap-3">
            <div className="p-3 bg-[#111111] rounded-full border border-[#1e1e1e]">
              <AlertCircle size={20} className="text-gray-600" />
            </div>
            <p className="text-sm text-gray-400">No resources found in <span className="font-mono text-gray-300">{region}</span></p>
            <p className="text-xs text-gray-600">Try a different region using the picker above.</p>
          </div>
        ) : (
          <MapCanvas data={data} />
        )}
      </div>
    </div>
  );
}
