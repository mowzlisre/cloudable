import { useCallback, useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import { AlertTriangle } from 'lucide-react';
import K8sNode from './K8sNode';
import NodeDetail from '../mapper/NodeDetail';
import { buildK8sLayout } from './layout';
import { mergeParallelEdges } from '../mapper/layout';

function NamespaceGroupNode({ data }) {
  return (
    <div style={{ width: '100%', height: '100%', background: 'rgba(100,116,139,0.03)', border: '1px dashed rgba(100,116,139,0.22)', borderRadius: 12, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 10, left: 14, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.6)', userSelect: 'none' }}>
        {data.label}
        <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 6 }}>· {data.count}</span>
      </div>
    </div>
  );
}

const nodeTypes = {
  deployment: K8sNode, statefulset: K8sNode, daemonset: K8sNode,
  replicaset: K8sNode, service: K8sNode, pod: K8sNode,
  nsGroup: NamespaceGroupNode,
};

const EDGE_STYLES = {
  owner: { stroke: '#64748b', strokeWidth: 1.2, strokeDasharray: '0' },
  route: { stroke: '#22c55e', strokeWidth: 1.2, strokeDasharray: '0' },
  default: { stroke: '#4b5563', strokeWidth: 1, strokeDasharray: '0' },
};

const EDGE_CUES = {
  owner: { label: 'Controller ownership', color: '#64748b', dash: null },
  route: { label: 'Service routes to pod', color: '#22c55e', dash: null },
};

const TYPE_LABELS = {
  deployment: 'Deployment', statefulset: 'StatefulSet', daemonset: 'DaemonSet',
  replicaset: 'ReplicaSet', service: 'Service', pod: 'Pod',
};

function EdgeLegend({ edges }) {
  const present = useMemo(() => {
    const seen = new Set(edges.map(e => e.edgeType ?? 'default'));
    return Object.entries(EDGE_CUES).filter(([t]) => seen.has(t));
  }, [edges]);
  if (!present.length) return null;
  return (
    <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 5, background: '#111111', border: '1px solid #1e1e1e', borderRadius: 8, padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <p style={{ fontSize: 9, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Legend</p>
      {present.map(([type, cue]) => (
        <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#9ca3af' }}>
          <svg width="28" height="10" style={{ flexShrink: 0 }}>
            <line x1="0" y1="5" x2="28" y2="5" stroke={cue.color} strokeWidth="1.5" strokeDasharray={cue.dash ?? '0'} />
            <polygon points="22,2 28,5 22,8" fill={cue.color} />
          </svg>
          {cue.label}
        </span>
      ))}
    </div>
  );
}

function FilterBar({ presentTypes, hiddenTypes, setHiddenTypes, issuesOnly, setIssuesOnly, issueCount }) {
  const toggle = (t) => setHiddenTypes(prev => {
    const next = new Set(prev);
    next.has(t) ? next.delete(t) : next.add(t);
    return next;
  });
  return (
    <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 5, display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 'calc(100% - 20px)' }}>
      {issueCount > 0 && (
        <button
          onClick={() => setIssuesOnly(v => !v)}
          style={{
            fontSize: 10, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
            background: issuesOnly ? 'rgba(239,68,68,0.2)' : '#111111',
            border: `1px solid ${issuesOnly ? '#ef4444' : '#1e1e1e'}`,
            color: issuesOnly ? '#ef4444' : '#9ca3af',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <AlertTriangle size={10} /> Issues only ({issueCount})
        </button>
      )}
      {presentTypes.map(t => (
        <button
          key={t}
          onClick={() => toggle(t)}
          style={{
            fontSize: 10, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
            background: hiddenTypes.has(t) ? '#0a0a0a' : '#151515',
            border: `1px solid ${hiddenTypes.has(t) ? '#111111' : '#1e1e1e'}`,
            color: hiddenTypes.has(t) ? '#333333' : '#9ca3af',
            textDecoration: hiddenTypes.has(t) ? 'line-through' : 'none',
          }}
        >
          {TYPE_LABELS[t] ?? t}
        </button>
      ))}
    </div>
  );
}

function buildEdges(rawEdges) {
  const deduped = mergeParallelEdges(rawEdges);
  return deduped.map(e => {
    const style = EDGE_STYLES[e.edgeType] ?? EDGE_STYLES.default;
    return {
      id: e.id, source: e.source, target: e.target,
      label: e.label, type: 'smoothstep',
      animated: e.edgeType === 'route',
      style: { ...style },
      edgeType: e.edgeType,
      labelStyle: { fontSize: 9, fill: '#6b7280' },
      labelBgStyle: { fill: '#0a0a0a', fillOpacity: 0.85 },
      labelBgPadding: [3, 5],
      markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10, color: style.stroke },
    };
  });
}

const CONTROLS_CSS = `
.react-flow__controls { background: #111111 !important; border: 1px solid #1e1e1e !important; border-radius: 8px !important; box-shadow: none !important; }
.react-flow__controls button { background: transparent !important; border: none !important; border-bottom: 1px solid #1e1e1e !important; fill: #22c55e !important; color: #22c55e !important; }
.react-flow__controls button:last-child { border-bottom: none !important; }
.react-flow__controls button:hover { background: rgba(34,197,94,0.08) !important; }
.react-flow__controls button svg { fill: #22c55e !important; }
`;

export default function K8sCanvas({ data, region }) {
  const initialNodes = useMemo(() => buildK8sLayout(data.nodes, data.edges), [data]);
  const initialEdges = useMemo(() => buildEdges(data.edges), [data]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [selected, setSelected] = useState(null);
  const [hiddenTypes, setHiddenTypes] = useState(new Set());
  const [issuesOnly, setIssuesOnly] = useState(false);

  const onNodeClick = useCallback((_, node) => {
    if (node.type === 'nsGroup') return;
    setSelected(node);
  }, []);
  const onPaneClick = useCallback(() => setSelected(null), []);

  const presentTypes = useMemo(() => {
    const seen = new Set(nodes.filter(n => n.type !== 'nsGroup').map(n => n.type));
    return Object.keys(TYPE_LABELS).filter(t => seen.has(t));
  }, [nodes]);

  const issueCount = useMemo(() => nodes.filter(n => n.data?.hasIssue).length, [nodes]);

  const visibleNodes = useMemo(() => nodes.map(n => {
    if (n.type === 'nsGroup') return n;
    const dimmed = hiddenTypes.has(n.type) || (issuesOnly && !n.data?.hasIssue);
    return dimmed ? { ...n, hidden: true } : { ...n, hidden: false };
  }), [nodes, hiddenTypes, issuesOnly]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>{CONTROLS_CSS}</style>
      <FilterBar presentTypes={presentTypes} hiddenTypes={hiddenTypes} setHiddenTypes={setHiddenTypes} issuesOnly={issuesOnly} setIssuesOnly={setIssuesOnly} issueCount={issueCount} />
      <ReactFlow
        nodes={visibleNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        minZoom={0.1}
        maxZoom={2}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1a1a1a" gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <EdgeLegend edges={edges} />
      {selected && <NodeDetail node={selected} region={region} onClose={() => setSelected(null)} />}
    </div>
  );
}
