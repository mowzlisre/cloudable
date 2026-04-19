import { useState } from 'react';
import { useRegion } from '../context/RegionContext';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ChevronDown, MapPin } from 'lucide-react';
import Spinner from '../components/Spinner';
import ErrorMessage from '../components/ErrorMessage';
import HygieneScore from '../components/hygiene/HygieneScore';
import CleanupSuggestions from '../components/hygiene/CleanupSuggestions';
import HygieneCategory from '../components/hygiene/HygieneCategory';

const BASE = import.meta.env.VITE_API_URL || '';

const TOP_SCAN_REGIONS = ['us-east-1', 'us-east-2', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];

const REGIONS = [
  { group: 'US',           items: ['us-east-1','us-east-2','us-west-1','us-west-2'] },
  { group: 'Europe',       items: ['eu-west-1','eu-west-2','eu-west-3','eu-central-1','eu-north-1'] },
  { group: 'Asia Pacific', items: ['ap-southeast-1','ap-southeast-2','ap-northeast-1','ap-northeast-2','ap-south-1'] },
  { group: 'Other',        items: ['ca-central-1','sa-east-1','af-south-1','me-south-1'] },
];

const SEVERITY_ORDER = ['waste', 'idle', 'security'];
const SECTION_LABELS = {
  waste:    { emoji: '🔴', label: 'Waste / High Cost Risk' },
  idle:     { emoji: '🟡', label: 'Idle Resources' },
  security: { emoji: '🟣', label: 'Security Hygiene' },
};

function RegionPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs border border-[#1e1e1e] hover:border-red-900/60 bg-[#111111] hover:bg-[#141414] text-gray-300 px-2.5 py-1.5 rounded-lg transition-all"
      >
        <MapPin size={10} className="text-gray-500" />
        <span className="font-mono text-red-400">{value}</span>
        <ChevronDown size={10} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 card py-1 overflow-y-auto" style={{ minWidth: 180, maxHeight: 300, background: '#111111' }}>
            {REGIONS.map(({ group, items }) => (
              <div key={group}>
                <p className="px-3 pt-2 pb-1 text-[10px] text-gray-600 uppercase tracking-wider">{group}</p>
                {items.map(r => (
                  <button key={r} onClick={() => { onChange(r); setOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors ${r === value ? 'text-red-400 bg-red-950/30' : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'}`}>
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

function AzBreakdown({ azBreakdown, region }) {
  const entries = Object.entries(azBreakdown ?? {}).filter(([az]) => az !== region && az !== 'global');
  if (!entries.length) return null;
  return (
    <div className="card p-5">
      <h2 className="text-sm font-medium text-white mb-4">Region / AZ Breakdown</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {entries.map(([az, counts]) => (
          <div key={az} className="p-3 rounded-lg" style={{ background: '#0e0e0e', border: '1px solid #1a1a1a' }}>
            <p className="text-[11px] font-mono text-gray-300 mb-2">{az}</p>
            <div className="flex gap-3 text-[10px]">
              {counts.waste    > 0 && <span className="text-red-400">🔴 {counts.waste}</span>}
              {counts.idle     > 0 && <span className="text-yellow-400">🟡 {counts.idle}</span>}
              {counts.security > 0 && <span className="text-purple-400">🟣 {counts.security}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Hygiene() {
  const { region, setRegion } = useRegion();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['hygiene', region],
    queryFn: () => fetch(`${BASE}/api/hygiene?region=${region}`)
      .then(r => r.ok ? r.json() : r.json().then(e => Promise.reject(new Error(e.error)))),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: regionScores } = useQuery({
    queryKey: ['hygiene-region-scores'],
    queryFn: async () => {
      const results = await Promise.allSettled(
        TOP_SCAN_REGIONS.map(r =>
          fetch(`${BASE}/api/hygiene?region=${r}`).then(res => res.ok ? res.json() : null)
        )
      );
      return results
        .map((r, i) => ({ region: TOP_SCAN_REGIONS[i], score: r.status === 'fulfilled' && r.value?.score?.overall != null ? r.value.score.overall : null }))
        .filter(r => r.score != null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    },
    staleTime: 2 * 60 * 60 * 1000,
    enabled: !!data,
    refetchOnWindowFocus: false,
  });

  const categoriesBySeverity = SEVERITY_ORDER.map(sev => ({
    sev,
    cats: (data?.categories ?? []).filter(c => c.severity === sev),
  })).filter(g => g.cats.length > 0);

  return (
    <div className="p-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Cloud Hygiene</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-sm text-gray-500">Detection engine for idle, orphaned, and insecure resources</p>
            <span className="text-gray-700">·</span>
            <RegionPicker value={region} onChange={setRegion} />
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-white border border-[#1e1e1e] hover:border-[#2a2a2a] disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          {isFetching ? 'Scanning...' : 'Re-scan'}
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Spinner size={36} />
          <p className="text-sm text-gray-400">Running hygiene checks on <span className="font-mono text-white">{region}</span>...</p>
          <p className="text-xs text-gray-600">Checking EC2 · EBS · EIPs · RDS · NAT · Snapshots · AMIs · IAM · SGs · CloudWatch Logs</p>
        </div>
      ) : error ? (
        <ErrorMessage error={error} onRetry={refetch} />
      ) : data ? (
        <>
          {/* Score + summary */}
          <HygieneScore score={data.score} summary={data.summary} regionScores={regionScores} />

          {/* Cleanup suggestions */}
          <CleanupSuggestions suggestions={data.suggestions} />

          {/* Category sections */}
          {categoriesBySeverity.map(({ sev, cats }) => {
            const sec = SECTION_LABELS[sev];
            return (
              <div key={sev}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">{sec.emoji}</span>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{sec.label}</span>
                  <div className="flex-1 h-px bg-[#1a1a1a]" />
                  <span className="text-xs text-gray-600">{cats.reduce((s, c) => s + c.items.length, 0)} issues</span>
                </div>
                <div className="space-y-2">
                  {cats.map(cat => <HygieneCategory key={cat.id} cat={cat} />)}
                </div>
              </div>
            );
          })}

          {/* AZ breakdown */}
          <AzBreakdown azBreakdown={data.azBreakdown} region={region} />

          {data.scannedAt && (
            <p className="text-[10px] text-gray-700 text-right">
              Scanned {new Date(data.scannedAt).toLocaleString()} · {region} · IAM checks are global
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}
