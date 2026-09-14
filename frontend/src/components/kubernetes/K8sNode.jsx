import { Handle, Position } from 'reactflow';
import { Layers, Database, Shield, Copy, Network, Box } from 'lucide-react';

const TYPE_CONFIG = {
  deployment:  { icon: Layers,   color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.3)',  label: 'Deployment' },
  statefulset: { icon: Database, color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',  border: 'rgba(139,92,246,0.3)',  label: 'StatefulSet' },
  daemonset:   { icon: Shield,   color: '#f97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.3)',  label: 'DaemonSet' },
  replicaset:  { icon: Copy,     color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.3)', label: 'ReplicaSet' },
  service:     { icon: Network,  color: '#22c55e', bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)',   label: 'Service' },
  pod:         { icon: Box,      color: '#eab308', bg: 'rgba(234,179,8,0.08)',   border: 'rgba(234,179,8,0.3)',   label: 'Pod' },
};

const ISSUE_COLOR = { waste: '#ef4444', idle: '#f59e0b' };

function StateIndicator({ state }) {
  const color = state === 'running' || state === 'healthy' || state === 'succeeded'
    ? '#22c55e'
    : state === 'crashloop' || state === 'failed'
    ? '#ef4444'
    : '#f59e0b';
  return (
    <span title={state} style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}`, flexShrink: 0 }} />
  );
}

function getDetail(type, data) {
  if (type === 'pod')         return [data.node, data.restarts ? `${data.restarts} restarts` : null].filter(Boolean).join(' · ');
  if (type === 'service')     return [data.svcType, data.ports].filter(Boolean).join(' · ');
  if (type === 'deployment')  return `${data.available ?? 0}/${data.desired ?? 0} available`;
  if (type === 'statefulset') return `${data.ready ?? 0}/${data.desired ?? 0} ready`;
  if (type === 'daemonset')   return `${data.ready ?? 0}/${data.desired ?? 0} ready`;
  if (type === 'replicaset')  return `${data.current ?? 0}/${data.desired ?? 0} replicas`;
  return '';
}

export default function K8sNode({ type, data, selected }) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.pod;
  const Icon = cfg.icon;
  const issueColor = data.hasIssue ? (ISSUE_COLOR[data.issueType] ?? '#ef4444') : null;

  return (
    <div
      style={{
        width: 200, minHeight: 60, borderRadius: 10, padding: '8px 10px',
        background: issueColor ? `${issueColor}10` : cfg.bg,
        border: `1px solid ${selected ? cfg.color : (issueColor ?? cfg.border)}`,
        boxShadow: selected ? `0 0 0 2px ${cfg.color}40` : 'none',
        display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: cfg.color, width: 6, height: 6, border: 'none' }} />
      <Handle type="source" position={Position.Bottom} style={{ background: cfg.color, width: 6, height: 6, border: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={13} style={{ color: cfg.color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#e5e7eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={data.label}>
          {data.label}
        </span>
        {data.state && <StateIndicator state={data.state} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cfg.label}</span>
        <span style={{ fontSize: 9, color: issueColor ?? '#9ca3af', fontFamily: 'monospace' }}>{getDetail(type, data)}</span>
      </div>
    </div>
  );
}
