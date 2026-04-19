import { Sparkles, TrendingDown } from 'lucide-react';

const PRIORITY_STYLE = {
  high:   { badge: 'badge-high',   dot: '#ef4444' },
  medium: { badge: 'badge-medium', dot: '#f59e0b' },
  low:    { badge: 'badge-low',    dot: '#60a5fa' },
};

export default function CleanupSuggestions({ suggestions }) {
  if (!suggestions?.length) return null;

  const totalSavings = suggestions.reduce((s, i) => s + (i.estimatedMonthlySavings ?? 0), 0);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #1a1a1a', background: '#0e0e0e' }}>
        <div className="flex items-center gap-2.5">
          <Sparkles size={14} className="text-red-400" />
          <span className="text-sm font-medium text-white">Cleanup Suggestions</span>
          <span className="text-xs text-gray-600">{suggestions.length} actions</span>
        </div>
        {totalSavings > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400">
            <TrendingDown size={12} />
            <span>~${totalSavings.toFixed(2)}/mo potential savings</span>
          </div>
        )}
      </div>

      <div className="divide-y divide-[#1a1a1a]">
        {suggestions.map((s, i) => {
          const style = PRIORITY_STYLE[s.priority] ?? PRIORITY_STYLE.low;
          return (
            <div key={s.categoryId} className="flex items-start gap-4 px-5 py-3 hover:bg-[#121212] transition-colors">
              <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: style.dot }} />
              <p className="flex-1 text-sm text-gray-300">{s.message}</p>
              <div className="flex items-center gap-3 shrink-0">
                {s.estimatedMonthlySavings > 0 && (
                  <span className="text-xs font-mono text-emerald-500">
                    ~${s.estimatedMonthlySavings.toFixed(2)}/mo
                  </span>
                )}
                <span className={style.badge}>{s.priority}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
