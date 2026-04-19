import { useCallback, useMemo, useState, forwardRef, useRef, useImperativeHandle } from 'react';
import ReactFlow, {
  Background, Controls,
  useNodesState, useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { AlertTriangle } from 'lucide-react';
import MapNode from './MapNode';
import NodeDetail from './NodeDetail';
import { buildTieredLayout, mergeParallelEdges } from './layout';

// ── VPC group container node ─────────────────────────────────────────────────
function VpcGroupNode({ data }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'rgba(99,102,241,0.03)',
      border: '1px dashed rgba(99,102,241,0.22)',
      borderRadius: 12,
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'absolute', top: 10, left: 14,
        fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase',
        color: 'rgba(99,102,241,0.55)', userSelect: 'none',
      }}>
        VPC{data.isDefault ? ' (default)' : ''} · {data.label}
        {data.cidr ? <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 6 }}>{data.cidr}</span> : null}
      </div>
    </div>
  );
}

const nodeTypes = {
  internet: MapNode, igw: MapNode, vpc: MapNode, subnet: MapNode,
  ec2: MapNode, rds: MapNode, aurora: MapNode, eip: MapNode, nat: MapNode,
  alb: MapNode, lambda: MapNode, ecs: MapNode, cloudfront: MapNode,
  elasticache: MapNode, apigateway: MapNode, sqs: MapNode, sns: MapNode,
  dynamodb: MapNode, msk: MapNode, kinesis: MapNode, vpce: MapNode, route53: MapNode,
  ebs: MapNode, s3: MapNode, efs: MapNode, eventbridge: MapNode, stepfunctions: MapNode,
  waf: MapNode, ecr: MapNode, rdsproxy: MapNode, redshift: MapNode, opensearch: MapNode,
  vpcGroup: VpcGroupNode,
};

// ── Edge styling ─────────────────────────────────────────────────────────────
const EDGE_STYLES = {
  internet: { stroke: '#22c55e', strokeWidth: 1.5, strokeDasharray: '0' },
  sg:       { stroke: '#ef4444', strokeWidth: 1,   strokeDasharray: '5,4' },
  eip:      { stroke: '#eab308', strokeWidth: 1.5, strokeDasharray: '0' },
  nat:      { stroke: '#f97316', strokeWidth: 1.5, strokeDasharray: '4,3' },
  alb:      { stroke: '#a855f7', strokeWidth: 1.5, strokeDasharray: '0' },
  open:     { stroke: '#ef4444', strokeWidth: 1,   strokeDasharray: '3,3' },
  default:  { stroke: '#4b5563', strokeWidth: 1,   strokeDasharray: '0' },
};

const EDGE_CUES = {
  internet: { label: 'Internet traffic',             color: '#22c55e', dash: null    },
  eip:      { label: 'Elastic IP attachment',        color: '#eab308', dash: null    },
  alb:      { label: 'Load balancer target / origin',color: '#a855f7', dash: null    },
  nat:      { label: 'NAT outbound',                 color: '#f97316', dash: '4,3'   },
  sg:       { label: 'Security group rule',          color: '#ef4444', dash: '5,4'   },
  open:     { label: 'Open to 0.0.0.0/0',            color: '#ef4444', dash: '3,3'   },
  default:  { label: 'Connection',                   color: '#4b5563', dash: null    },
};

// ── Legend ───────────────────────────────────────────────────────────────────
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

// ── Filter bar ───────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  ec2: 'EC2', rds: 'RDS', aurora: 'Aurora', alb: 'ALB', nat: 'NAT', igw: 'IGW',
  eip: 'EIP', lambda: 'Lambda', ecs: 'ECS', cloudfront: 'CloudFront',
  elasticache: 'ElastiCache', apigateway: 'API GW', sqs: 'SQS', sns: 'SNS',
  dynamodb: 'DynamoDB', msk: 'MSK', kinesis: 'Kinesis', vpce: 'VPC EP', route53: 'R53',
  ebs: 'EBS', s3: 'S3', efs: 'EFS', eventbridge: 'EventBridge', stepfunctions: 'Step Fn',
  waf: 'WAF', ecr: 'ECR', rdsproxy: 'RDS Proxy', redshift: 'Redshift', opensearch: 'OpenSearch',
};

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
          {TYPE_LABELS[t] ?? t.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ── Build RF edges from raw edge data ────────────────────────────────────────
function buildEdges(rawEdges) {
  const deduped = mergeParallelEdges(rawEdges);
  return deduped.map(e => {
    const style = EDGE_STYLES[e.edgeType] ?? EDGE_STYLES.default;
    return {
      id: e.id,
      source: e.source, target: e.target,
      label: e.label, type: 'smoothstep',
      animated: e.edgeType === 'internet',
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
.react-flow__controls button { background: transparent !important; border: none !important; border-bottom: 1px solid #1e1e1e !important; fill: #ef4444 !important; color: #ef4444 !important; }
.react-flow__controls button:last-child { border-bottom: none !important; }
.react-flow__controls button:hover { background: rgba(239,68,68,0.08) !important; }
.react-flow__controls button svg { fill: #ef4444 !important; }
`;

// ── Brand widget (replaces MiniMap) ─────────────────────────────────────────
function BrandWidget() {
  return (
    <div style={{
      position: 'absolute', bottom: 10, right: 10, zIndex: 5,
      display: 'flex', alignItems: 'center', gap: 8,
      background: '#111111', border: '1px solid #1e1e1e',
      borderRadius: 8, padding: '6px 12px',
    }}>
      <img src="/icon.png" alt="Cloudable" style={{ width: 18, height: 18, borderRadius: 4 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb', letterSpacing: '0.01em' }}>Cloudable</span>
    </div>
  );
}

// ── Main canvas ──────────────────────────────────────────────────────────────
const MapCanvas = forwardRef(function MapCanvas({ data }, ref) {
  const containerRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  useImperativeHandle(ref, () => ({
    getElement: () => containerRef.current,
    setExporting: (v) => setIsExporting(v),
  }));

  const initialNodes = useMemo(() => buildTieredLayout(data.nodes), [data]);
  const initialEdges = useMemo(() => buildEdges(data.edges), [data]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [selected, setSelected] = useState(null);
  const [hiddenTypes, setHiddenTypes] = useState(new Set());
  const [issuesOnly, setIssuesOnly] = useState(false);

  const onNodeClick = useCallback((_, node) => {
    if (node.type === 'vpcGroup') return;
    setSelected(node);
  }, []);
  const onPaneClick = useCallback(() => setSelected(null), []);

  // Derived filter data
  const presentTypes = useMemo(() => {
    const seen = new Set(nodes.filter(n => n.type !== 'vpcGroup').map(n => n.type));
    return Object.keys(TYPE_LABELS).filter(t => seen.has(t));
  }, [nodes]);

  const issueCount = useMemo(() => nodes.filter(n => n.data?.hasIssue).length, [nodes]);

  // Apply filter opacity
  const filteredNodes = useMemo(() => nodes.map(n => {
    if (n.type === 'vpcGroup') return n;
    const dimmed =
      hiddenTypes.has(n.type) ||
      (issuesOnly && !n.data?.hasIssue && n.type !== 'internet' && n.type !== 'cloudfront');
    return dimmed ? { ...n, style: { ...n.style, opacity: 0.1 } } : n;
  }), [nodes, hiddenTypes, issuesOnly]);

  const filteredEdges = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    return edges.map(e => {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      const srcDim = src && (hiddenTypes.has(src.type) || (issuesOnly && !src.data?.hasIssue && src.type !== 'internet'));
      const tgtDim = tgt && (hiddenTypes.has(tgt.type) || (issuesOnly && !tgt.data?.hasIssue && tgt.type !== 'internet'));
      return (srcDim || tgtDim) ? { ...e, style: { ...e.style, opacity: 0.05 } } : e;
    });
  }, [edges, nodes, hiddenTypes, issuesOnly]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>{CONTROLS_CSS}</style>
      {!isExporting && (
        <FilterBar
          presentTypes={presentTypes}
          hiddenTypes={hiddenTypes}
          setHiddenTypes={setHiddenTypes}
          issuesOnly={issuesOnly}
          setIssuesOnly={setIssuesOnly}
          issueCount={issueCount}
        />
      )}

      <ReactFlow
        nodes={filteredNodes}
        edges={filteredEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.05}
        maxZoom={2}
        style={{ background: '#080808' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1a1a1a" gap={20} size={1} />
        {!isExporting && <Controls />}
      </ReactFlow>

      <EdgeLegend edges={filteredEdges} />
      <BrandWidget />

      {selected && (
        <NodeDetail node={selected} region={data.region} onClose={() => setSelected(null)} />
      )}
    </div>
  );
});
export default MapCanvas;
