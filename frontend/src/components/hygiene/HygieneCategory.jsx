import { useState } from 'react';
import { ChevronDown, ChevronRight, Server, HardDrive, Wifi, LayoutTemplate, Database, ArrowRightLeft, Camera, Package, ScrollText, Shield, UserX } from 'lucide-react';

const ICONS = {
  'server': Server, 'hard-drive': HardDrive, 'wifi': Wifi,
  'layout-template': LayoutTemplate, 'database': Database,
  'arrow-right-left': ArrowRightLeft, 'camera': Camera,
  'package': Package, 'scroll-text': ScrollText,
  'shield': Shield, 'user-x': UserX,
};

const SEVERITY_CONFIG = {
  waste:    { badge: 'badge-high',   sectionColor: '#ef4444', label: 'WASTE',    dot: '#ef4444' },
  idle:     { badge: 'badge-medium', sectionColor: '#f59e0b', label: 'IDLE',     dot: '#f59e0b' },
  security: { badge: 'badge-low',    sectionColor: '#a855f7', label: 'SECURITY', dot: '#a855f7' },
};

const STATUS_DOT = {
  waste:    '#ef4444',
  idle:     '#f59e0b',
  security: '#a855f7',
  healthy:  '#22c55e',
};

function StatusDot({ status }) {
  const color = STATUS_DOT[status] ?? '#6b7280';
  return (
    <span
      title={status}
      style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}`, flexShrink: 0 }}
    />
  );
}

export default function HygieneCategory({ cat }) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[cat.icon] ?? Server;
  const cfg = SEVERITY_CONFIG[cat.severity] ?? SEVERITY_CONFIG.idle;
  const totalCost = cat.items.reduce((s, i) => s + (i.estimatedCost ?? 0), 0);

  return (
    <div className="card card-hover overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        {/* Icon */}
        <span className="p-2 rounded-lg shrink-0" style={{ background: `${cfg.sectionColor}18`, color: cfg.sectionColor }}>
          <Icon size={14} />
        </span>

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-white">{cat.title}</span>
            <span className={cfg.badge}>{cfg.label}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 pr-4">{cat.description}</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-500">Items</p>
            <p className="text-sm font-semibold text-white">{cat.items.length}</p>
          </div>
          {totalCost > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Est./mo</p>
              <p className="text-sm font-semibold" style={{ color: cfg.sectionColor }}>${totalCost.toFixed(2)}</p>
            </div>
          )}
          <span className="text-gray-600">
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </span>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #1a1a1a' }}>
          <table className="w-full text-xs">
            <thead style={{ background: '#0e0e0e', borderBottom: '1px solid #161616' }}>
              <tr>
                <th className="text-left px-5 py-2.5 text-gray-600 font-medium uppercase tracking-wider w-6"></th>
                <th className="text-left px-4 py-2.5 text-gray-600 font-medium uppercase tracking-wider">Resource</th>
                <th className="text-left px-4 py-2.5 text-gray-600 font-medium uppercase tracking-wider">Detail</th>
                <th className="text-left px-4 py-2.5 text-gray-600 font-medium uppercase tracking-wider">Reason</th>
                <th className="text-right px-5 py-2.5 text-gray-600 font-medium uppercase tracking-wider">Cost/mo</th>
              </tr>
            </thead>
            <tbody>
              {cat.items.map((item, i) => (
                <tr
                  key={item.id ?? i}
                  style={{ borderBottom: '1px solid #111111' }}
                  className="hover:bg-[#121212] transition-colors"
                >
                  <td className="px-5 py-2.5">
                    <StatusDot status={item.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-mono text-gray-200 truncate max-w-[180px]" title={item.id}>{item.id}</p>
                    {item.name && item.name !== item.id && (
                      <p className="text-gray-500 mt-0.5 truncate max-w-[180px]">{item.name}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 max-w-[200px]">
                    <span title={item.detail}>{item.detail}</span>
                    {item.az && item.az !== 'global' && item.az !== 'us-east-1' && (
                      <span className="ml-1.5 text-gray-600 text-[10px]">{item.az}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-[200px]">
                    <span title={item.reason}>{item.reason}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono">
                    {item.estimatedCost > 0
                      ? <span style={{ color: cfg.sectionColor }}>${item.estimatedCost.toFixed(2)}</span>
                      : <span className="text-gray-700">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cat.items.length < cat._totalCount && (
            <p className="px-5 py-2 text-[10px] text-gray-600 border-t border-[#111111]">
              Showing first {cat.items.length} items
            </p>
          )}
        </div>
      )}
    </div>
  );
}
