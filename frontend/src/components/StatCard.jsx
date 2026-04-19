import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function TrendBadge({ value, suffix = '%' }) {
  if (value === null || value === undefined) return null;
  const positive = value >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${positive ? 'text-red-400' : 'text-emerald-400'}`}>
      {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {positive ? '+' : ''}{typeof value === 'number' ? value.toFixed(1) : value}{suffix}
    </span>
  );
}

export default function StatCard({ icon: Icon, label, value, sub, trend, trendSuffix, accent = false, loading = false }) {
  return (
    <div className={`card p-5 flex flex-col gap-3 ${accent ? 'border-red-900/50' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
        {Icon && (
          <span className={`p-1.5 rounded-lg ${accent ? 'bg-red-950/60 text-red-400' : 'bg-[#1a1a1a] text-gray-500'}`}>
            <Icon size={14} />
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-32 bg-[#1a1a1a] rounded animate-pulse" />
      ) : (
        <div className="flex items-end justify-between gap-2">
          <span className={`text-2xl font-semibold tracking-tight ${accent ? 'text-red-400' : 'text-white'}`}>
            {value}
          </span>
          {trend !== undefined && <TrendBadge value={trend} suffix={trendSuffix} />}
        </div>
      )}
      {sub && !loading && (
        <p className="text-xs text-gray-600">{sub}</p>
      )}
    </div>
  );
}
