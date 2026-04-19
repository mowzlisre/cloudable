function ScoreRing({ score, size = 148, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(score, 100) / 100) * circ;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e1e1e" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        <span style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 10, color: '#4b5563', marginTop: 2 }}>/ 100</span>
      </div>
    </div>
  );
}

function SubScore({ label, value, weight }) {
  const color = value >= 80 ? '#22c55e' : value >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[#1a1a1a] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-xs font-mono w-12 text-right" style={{ color }}>{value}/100</span>
      <span className="text-[10px] text-gray-700 w-8 text-right">{weight}</span>
    </div>
  );
}

function StatusPill({ count, label, color, dot }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: '#111111', border: '1px solid #1e1e1e' }}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot, boxShadow: `0 0 5px ${dot}` }} />
      <span className="text-lg font-bold text-white">{count}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

function RegionScoreBar({ region, score, rank }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-gray-600 w-4 text-right shrink-0">{rank}</span>
      <span className="text-[11px] font-mono text-gray-400 w-28 shrink-0 truncate">{region}</span>
      <div className="flex-1 h-1 rounded-full bg-[#1a1a1a] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[11px] font-mono w-8 text-right shrink-0" style={{ color }}>{score}</span>
    </div>
  );
}

export default function HygieneScore({ score, summary, regionScores }) {
  if (!score) return null;

  const label = score.overall >= 80 ? 'Great shape' : score.overall >= 60 ? 'Needs attention' : 'Action required';
  const hasRegionScores = regionScores && regionScores.length > 0;

  return (
    <div className="card p-6">
      <div style={{ display: 'grid', gridTemplateColumns: hasRegionScores ? '1fr auto' : '1fr', gap: 0 }}>
        {/* Left: score + breakdown + status */}
        <div className="flex items-start gap-8 flex-wrap" style={{ paddingRight: hasRegionScores ? 24 : 0, borderRight: hasRegionScores ? '1px solid #1a1a1a' : 'none' }}>
          {/* Ring */}
          <div className="flex flex-col items-center gap-2">
            <ScoreRing score={score.overall} />
            <div className="text-center">
              <p className="text-xs font-medium text-white">Cloud Hygiene Score</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
            </div>
          </div>

          {/* Sub-scores */}
          <div className="flex-1 flex flex-col justify-center gap-3 min-w-[240px]">
            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Score Breakdown</p>
            <SubScore label="Cost Efficiency"       value={score.costEfficiency}      weight="40%" />
            <SubScore label="Resource Utilization"  value={score.resourceUtilization} weight="35%" />
            <SubScore label="Security Hygiene"      value={score.securityHygiene}     weight="25%" />
          </div>

          {/* Summary pills */}
          <div className="flex flex-col gap-2 justify-center">
            <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Status</p>
            <div className="flex flex-wrap gap-2">
              <StatusPill count={summary?.healthy}  label="Healthy"  dot="#22c55e" />
              <StatusPill count={summary?.idle}     label="Idle"     dot="#f59e0b" />
              <StatusPill count={summary?.waste}    label="Waste"    dot="#ef4444" />
              <StatusPill count={summary?.security} label="Security" dot="#a855f7" />
            </div>
            {summary?.total > 0 && (
              <p className="text-[10px] text-gray-700 mt-1">{summary.total} flagged across all checks</p>
            )}
          </div>
        </div>

        {/* Right: regional top 5 */}
        {hasRegionScores && (
          <div style={{ paddingLeft: 24, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="text-xs text-gray-600 uppercase tracking-wider">Top Regions by Score</p>
            <div className="flex flex-col gap-2.5">
              {regionScores.map((r, i) => (
                <RegionScoreBar key={r.region} region={r.region} score={r.score} rank={i + 1} />
              ))}
            </div>
            <p className="text-[10px] text-gray-700 mt-auto">Scores from last scan per region</p>
          </div>
        )}
      </div>
    </div>
  );
}
