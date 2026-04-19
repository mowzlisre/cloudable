import { useState } from 'react';
import { useRegion } from '../context/RegionContext';
import { useQuery } from '@tanstack/react-query';
import { TrendingDown, DollarSign, Server, Database, RefreshCw, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api/client';

const CONF_COLOR = { high: '#10b981', medium: '#f59e0b' };
const CONF_LABEL = { high: 'High', medium: 'Medium' };

function UtilBar({ value, max = 100, color }) {
  const pct = Math.min(100, (value / max) * 100);
  const c = value < 5 ? '#10b981' : value < 20 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color ?? c }} />
      </div>
      <span className="text-[11px] font-mono text-gray-400 w-10 text-right">{value}%</span>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="p-2.5 rounded-xl" style={{ background: `${accent}15` }}>
        <Icon size={16} style={{ color: accent }} />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-semibold text-white mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function EC2Table({ data }) {
  const [expanded, setExpanded] = useState(null);
  const withRec = data.filter(r => r.recommendation);
  const rest    = data.filter(r => !r.recommendation);

  function Row({ inst, highlight }) {
    const rec = inst.recommendation;
    return (
      <>
        <tr
          className={`border-b border-[#111] transition-colors cursor-pointer ${highlight ? 'hover:bg-[#0f0f0f]' : 'hover:bg-[#0a0a0a] opacity-60'}`}
          onClick={() => setExpanded(e => e === inst.id ? null : inst.id)}
        >
          <td className="px-4 py-3">
            <p className="text-xs text-white font-medium truncate max-w-[160px]">{inst.name}</p>
            <p className="text-[10px] text-gray-600 font-mono mt-0.5">{inst.id}</p>
          </td>
          <td className="px-4 py-3">
            <span className="text-xs font-mono text-gray-300">{inst.instanceType}</span>
          </td>
          <td className="px-4 py-3 w-40">
            {inst.hasData ? (
              <div className="space-y-1">
                <UtilBar value={inst.avgCpu} />
                <UtilBar value={inst.maxCpu} color="#6366f1" />
              </div>
            ) : (
              <span className="text-[11px] text-gray-600">No data</span>
            )}
          </td>
          <td className="px-4 py-3">
            <span className="text-xs text-gray-400">{inst.currentMonthlyCost != null ? `$${inst.currentMonthlyCost}/mo` : '—'}</span>
          </td>
          <td className="px-4 py-3">
            {rec ? (
              <span className="text-xs font-mono font-medium" style={{ color: CONF_COLOR[rec.confidence] }}>
                → {rec.recommendedType}
              </span>
            ) : inst.hasData ? (
              <span className="text-[11px] text-gray-600">Well-utilized</span>
            ) : (
              <span className="text-[11px] text-gray-600">Insufficient data</span>
            )}
          </td>
          <td className="px-4 py-3">
            {rec?.monthlySavings != null ? (
              <span className="text-xs font-semibold text-emerald-400">-${rec.monthlySavings}/mo</span>
            ) : '—'}
          </td>
          <td className="px-2 py-3 text-gray-600">
            {rec && (expanded === inst.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </td>
        </tr>
        {expanded === inst.id && rec && (
          <tr className="bg-[#0a0a0a] border-b border-[#111]">
            <td colSpan={7} className="px-6 py-3">
              <div className="flex items-center gap-6 text-xs">
                <div>
                  <p className="text-gray-600">Current</p>
                  <p className="text-white font-mono">{inst.instanceType}</p>
                  <p className="text-gray-500">${rec.currentMonthlyCost}/mo</p>
                </div>
                <div className="text-gray-600">→</div>
                <div>
                  <p className="text-gray-600">Recommended</p>
                  <p className="font-mono" style={{ color: CONF_COLOR[rec.confidence] }}>{rec.recommendedType}</p>
                  <p className="text-gray-500">${rec.recommendedMonthlyCost}/mo</p>
                </div>
                <div className="ml-4 px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-900/30">
                  <p className="text-[10px] text-emerald-600">Monthly savings</p>
                  <p className="text-emerald-400 font-semibold">${rec.monthlySavings}</p>
                </div>
                <div className="px-3 py-1.5 rounded-lg" style={{ background: `${CONF_COLOR[rec.confidence]}15`, border: `1px solid ${CONF_COLOR[rec.confidence]}30` }}>
                  <p className="text-[10px] text-gray-600">Confidence</p>
                  <p className="text-xs font-medium" style={{ color: CONF_COLOR[rec.confidence] }}>{CONF_LABEL[rec.confidence]}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600">Avg CPU (14d)</p>
                  <p className="text-xs font-mono text-gray-300">{inst.avgCpu}% avg · {inst.maxCpu}% peak</p>
                </div>
              </div>
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-[#111] flex items-center gap-2">
        <Server size={14} className="text-gray-500" />
        <h2 className="text-sm font-medium text-white">EC2 Instances</h2>
        <span className="text-[11px] text-gray-600 ml-1">{data.length} instances · {withRec.length} recommendations</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#111]">
              {['Name', 'Type', 'CPU (avg / peak)', 'Current Cost', 'Recommendation', 'Savings', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withRec.map(r => <Row key={r.id} inst={r} highlight />)}
            {rest.map(r => <Row key={r.id} inst={r} highlight={false} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RDSTable({ data }) {
  const [expanded, setExpanded] = useState(null);
  const withRec = data.filter(r => r.recommendation);
  const rest    = data.filter(r => !r.recommendation);

  function Row({ inst, highlight }) {
    const rec = inst.recommendation;
    return (
      <>
        <tr
          className={`border-b border-[#111] transition-colors cursor-pointer ${highlight ? 'hover:bg-[#0f0f0f]' : 'hover:bg-[#0a0a0a] opacity-60'}`}
          onClick={() => setExpanded(e => e === inst.id ? null : inst.id)}
        >
          <td className="px-4 py-3">
            <p className="text-xs text-white font-medium">{inst.id}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">{inst.engine}</p>
          </td>
          <td className="px-4 py-3">
            <span className="text-xs font-mono text-gray-300">{inst.instanceClass}</span>
          </td>
          <td className="px-4 py-3 w-40">
            {inst.hasData ? (
              <div className="space-y-1">
                <UtilBar value={inst.avgCpu} />
                <UtilBar value={inst.maxCpu} color="#6366f1" />
              </div>
            ) : (
              <span className="text-[11px] text-gray-600">No data</span>
            )}
          </td>
          <td className="px-4 py-3">
            <span className="text-[11px] text-gray-400">{inst.avgConn > 0 ? `${inst.avgConn} avg conn` : '—'}</span>
          </td>
          <td className="px-4 py-3">
            <span className="text-xs text-gray-400">{inst.currentMonthlyCost != null ? `$${inst.currentMonthlyCost}/mo` : '—'}</span>
          </td>
          <td className="px-4 py-3">
            {rec ? (
              <span className="text-xs font-mono font-medium" style={{ color: CONF_COLOR[rec.confidence] }}>
                → {rec.recommendedType}
              </span>
            ) : inst.hasData ? (
              <span className="text-[11px] text-gray-600">Well-utilized</span>
            ) : (
              <span className="text-[11px] text-gray-600">No data</span>
            )}
          </td>
          <td className="px-4 py-3">
            {rec?.monthlySavings != null ? (
              <span className="text-xs font-semibold text-emerald-400">-${rec.monthlySavings}/mo</span>
            ) : '—'}
          </td>
          <td className="px-2 py-3 text-gray-600">
            {rec && (expanded === inst.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </td>
        </tr>
        {expanded === inst.id && rec && (
          <tr className="bg-[#0a0a0a] border-b border-[#111]">
            <td colSpan={8} className="px-6 py-3">
              <div className="flex items-center gap-6 text-xs">
                <div>
                  <p className="text-gray-600">Current</p>
                  <p className="text-white font-mono">{inst.instanceClass}</p>
                  <p className="text-gray-500">${rec.currentMonthlyCost}/mo</p>
                </div>
                <div className="text-gray-600">→</div>
                <div>
                  <p className="text-gray-600">Recommended</p>
                  <p className="font-mono" style={{ color: CONF_COLOR[rec.confidence] }}>{rec.recommendedType}</p>
                  <p className="text-gray-500">${rec.recommendedMonthlyCost}/mo</p>
                </div>
                <div className="ml-4 px-3 py-1.5 rounded-lg bg-emerald-950/30 border border-emerald-900/30">
                  <p className="text-[10px] text-emerald-600">Monthly savings</p>
                  <p className="text-emerald-400 font-semibold">${rec.monthlySavings}</p>
                </div>
                <div className="px-3 py-1.5 rounded-lg" style={{ background: `${CONF_COLOR[rec.confidence]}15`, border: `1px solid ${CONF_COLOR[rec.confidence]}30` }}>
                  <p className="text-[10px] text-gray-600">Confidence</p>
                  <p className="text-xs font-medium" style={{ color: CONF_COLOR[rec.confidence] }}>{CONF_LABEL[rec.confidence]}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600">Avg CPU (14d)</p>
                  <p className="text-xs font-mono text-gray-300">{inst.avgCpu}% avg · {inst.maxCpu}% peak</p>
                </div>
              </div>
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-[#111] flex items-center gap-2">
        <Database size={14} className="text-gray-500" />
        <h2 className="text-sm font-medium text-white">RDS Instances</h2>
        <span className="text-[11px] text-gray-600 ml-1">{data.length} instances · {withRec.length} recommendations</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#111]">
              {['Identifier', 'Class', 'CPU (avg / peak)', 'Connections', 'Current Cost', 'Recommendation', 'Savings', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] text-gray-600 uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withRec.map(r => <Row key={r.id} inst={r} highlight />)}
            {rest.map(r => <Row key={r.id} inst={r} highlight={false} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Rightsizing() {
  const { region } = useRegion();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['rightsizing', region],
    queryFn: () => api.rightsizing(region),
    staleTime: 10 * 60 * 1000,
  });

  const s = data?.summary;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Rightsizing</h1>
          <p className="text-sm text-gray-500 mt-0.5">CloudWatch-powered recommendations based on 14 days of utilization.</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-white border border-[#1e1e1e] hover:border-[#2a2a2a] disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          {isFetching ? 'Analyzing…' : 'Re-analyze'}
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-gray-600 gap-3">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">Fetching CloudWatch metrics for the last 14 days…</span>
        </div>
      )}

      {error && (
        <div className="card p-5 flex items-start gap-3 border-red-900/30 bg-red-950/10">
          <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-red-400 font-medium">Analysis failed</p>
            <p className="text-xs text-red-600 mt-1">{error.message}</p>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-4">
            <SummaryCard icon={Server}      label="EC2 Instances"      value={s.ec2Count}                  accent="#6366f1" />
            <SummaryCard icon={Database}    label="RDS Instances"      value={s.rdsCount}                  accent="#8b5cf6" />
            <SummaryCard icon={TrendingDown} label="Over-provisioned"  value={s.overProvisionedCount}      sub="instances" accent="#f59e0b" />
            <SummaryCard
              icon={DollarSign}
              label="Total monthly savings"
              value={s.totalMonthlySavings > 0 ? `$${s.totalMonthlySavings}` : '$0'}
              sub={s.totalMonthlySavings > 0 ? `≈ $${(s.totalMonthlySavings * 12).toFixed(0)}/yr` : 'No savings identified'}
              accent="#10b981"
            />
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 text-[11px] text-gray-600">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> CPU avg — green ≤5%, yellow ≤20%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" /> CPU peak (purple bar)</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={11} className="text-emerald-500" /> High confidence = 2 size steps · Medium = 1 step</span>
          </div>

          {data.ec2.length > 0 && <EC2Table data={data.ec2} />}
          {data.rds.length > 0 && <RDSTable data={data.rds} />}

          {data.ec2.length === 0 && data.rds.length === 0 && (
            <div className="card p-10 text-center text-gray-600 text-sm">No running instances found in {region}.</div>
          )}

          <p className="text-[11px] text-gray-700">
            Analyzed at {new Date(s.analyzedAt).toLocaleString()} · {s.windowDays}-day CloudWatch window · Region: {region}
          </p>
        </>
      )}
    </div>
  );
}
