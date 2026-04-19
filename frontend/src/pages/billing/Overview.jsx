import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, TrendingUp, Calendar, ChevronDown, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { api } from '../../api/client';

function fmt$(n) { return n != null ? `$${n.toFixed(2)}` : '—'; }

function PctBar({ value, total }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1 rounded-full bg-[#1a1a1a] overflow-hidden">
        <div className="h-full rounded-full bg-red-600 opacity-50" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-600">{pct.toFixed(1)}%</span>
    </div>
  );
}

function ServiceRow({ service, idx, total }) {
  const [open, setOpen] = useState(false);
  const hasDetail = service.lineItems?.length > 0;
  const COLORS = ['#ef4444','#f97316','#f59e0b','#84cc16','#10b981','#06b6d4','#8b5cf6','#ec4899','#94a3b8'];

  return (
    <>
      <tr
        className={`border-b border-[#0e0e0e] transition-colors ${hasDetail ? 'cursor-pointer hover:bg-[#0c0c0c]' : 'hover:bg-[#0a0a0a]'}`}
        onClick={() => hasDetail && setOpen(o => !o)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[idx % COLORS.length] }} />
            {hasDetail && (
              open ? <ChevronDown size={11} className="text-gray-500 shrink-0" />
                   : <ChevronRight size={11} className="text-gray-500 shrink-0" />
            )}
            <span className="text-xs text-gray-200 truncate max-w-[220px]" title={service.service}>{service.service}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right"><span className="text-xs font-mono font-semibold text-white">{fmt$(service.cost)}</span></td>
        <td className="px-4 py-3 text-right"><span className="text-xs font-mono text-gray-500">{fmt$(service.lastMonthCost)}</span></td>
        <td className="px-4 py-3"><PctBar value={service.cost} total={total} /></td>
      </tr>
      {open && hasDetail && service.lineItems.map((li, i) => (
        <tr key={i} className="border-b border-[#090909] bg-[#080808]">
          <td className="px-4 py-2 pl-12">
            <span className="text-[11px] text-gray-500 truncate max-w-[200px] block" title={li.usageType}>{li.usageType || li.description || `Line item ${i + 1}`}</span>
            {li.description && li.description !== li.usageType && (
              <span className="text-[10px] text-gray-700 truncate block">{li.description}</span>
            )}
          </td>
          <td className="px-4 py-2 text-right"><span className="text-[11px] font-mono text-gray-400">{fmt$(li.cost)}</span></td>
          <td className="px-4 py-2" colSpan={2} />
        </tr>
      ))}
    </>
  );
}

const CATEGORIES = [
  { label: 'All',      match: null },
  { label: 'Compute',  match: ['EC2', 'Lambda', 'ECS', 'Fargate', 'Lightsail', 'Batch'] },
  { label: 'Storage',  match: ['S3', 'EBS', 'EFS', 'Glacier', 'Backup', 'Storage'] },
  { label: 'Database', match: ['RDS', 'DynamoDB', 'Redshift', 'ElastiCache', 'DocumentDB', 'Neptune', 'Aurora'] },
  { label: 'Network',  match: ['CloudFront', 'Route 53', 'VPC', 'NAT', 'Load Balancing', 'API Gateway', 'Transfer', 'Direct Connect'] },
  { label: 'Other',    match: [] },
];

export default function BillingOverview() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');

  const { data: costs, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['costs'],
    queryFn: api.costs,
    staleTime: 5 * 60 * 1000,
  });

  const { data: detailed } = useQuery({
    queryKey: ['costs-daily-by-service'],
    queryFn: api.costsDailyByService,
    staleTime: 5 * 60 * 1000,
  });

  const byService = (costs?.byService ?? [])
    .filter(s => {
      if (search && !s.service.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== 'All') {
        const cat = CATEGORIES.find(c => c.label === category);
        if (cat?.match?.length > 0) {
          return cat.match.some(k => s.service.toLowerCase().includes(k.toLowerCase()));
        }
        if (cat?.match?.length === 0) {
          const knownKeywords = CATEGORIES.flatMap(c => c.match ?? []);
          return !knownKeywords.some(k => s.service.toLowerCase().includes(k.toLowerCase()));
        }
      }
      return true;
    })
    .map(s => ({
      ...s,
      lineItems: detailed?.lineItems?.[s.service] ?? [],
    }));

  const total = costs?.mtdTotal ?? 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Billing Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Month-to-date cost breakdown — click a service to expand line items</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching}
          className="flex items-center gap-2 px-3 py-1.5 text-xs border border-[#1e1e1e] hover:border-[#2a2a2a] text-gray-400 hover:text-white rounded-lg transition-all">
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: DollarSign, label: 'Month-to-date', value: fmt$(costs?.mtdTotal), sub: 'Unblended cost', color: '#ef4444' },
          { icon: TrendingUp, label: 'Forecast', value: fmt$(costs?.forecastTotal), sub: 'AWS projection', color: '#f59e0b' },
          { icon: Calendar, label: 'Last month', value: fmt$(costs?.lastMonthTotal), sub: 'For comparison', color: '#6366f1' },
        ].map(card => (
          <div key={card.label} className="card p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl" style={{ background: `${card.color}15` }}>
              <card.icon size={15} style={{ color: card.color }} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{card.label}</p>
              {isLoading ? <div className="h-6 w-20 bg-[#1a1a1a] rounded animate-pulse mt-1" />
                : <p className="text-xl font-semibold text-white">{card.value}</p>}
              <p className="text-[10px] text-gray-600 mt-0.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map(cat => (
          <button
            key={cat.label}
            onClick={() => setCategory(cat.label)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
              category === cat.label
                ? 'bg-red-950/40 border-red-800/60 text-red-400 font-medium'
                : 'border-[#1e1e1e] text-gray-500 hover:text-gray-300 hover:border-[#2a2a2a]'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Service table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-[#111] flex items-center gap-3">
          <h2 className="text-sm font-medium text-white">Services</h2>
          <div className="relative ml-auto">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Filter services…"
              className="pl-7 pr-3 py-1.5 text-xs bg-[#0e0e0e] border border-[#1e1e1e] rounded-lg text-white placeholder-gray-700 focus:outline-none focus:border-red-800 transition-colors w-48" />
          </div>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#111]">
              <th className="px-4 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wider font-medium">Service</th>
              <th className="px-4 py-2.5 text-right text-[10px] text-gray-600 uppercase tracking-wider font-medium">MTD Cost</th>
              <th className="px-4 py-2.5 text-right text-[10px] text-gray-600 uppercase tracking-wider font-medium">Last Month</th>
              <th className="px-4 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wider font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={4} className="py-16 text-center">
                <RefreshCw size={20} className="animate-spin mx-auto text-gray-700" />
              </td></tr>
            )}
            {!isLoading && byService.length === 0 && (
              <tr><td colSpan={4} className="py-10 text-center text-xs text-gray-600">No services found.</td></tr>
            )}
            {!isLoading && byService.map((s, i) => (
              <ServiceRow key={s.service} service={s} idx={i} total={total} />
            ))}
          </tbody>
        </table>
        {!isLoading && byService.length > 0 && (
          <div className="px-4 py-3 border-t border-[#111] flex items-center justify-between text-xs text-gray-600">
            <span>{byService.length} services</span>
            <span className="font-mono font-semibold text-white">{fmt$(total)} total MTD</span>
          </div>
        )}
      </div>
    </div>
  );
}
