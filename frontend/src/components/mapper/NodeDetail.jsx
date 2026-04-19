import { X, AlertTriangle, ExternalLink, DollarSign } from 'lucide-react';

const TYPE_LABELS = {
  internet: 'Internet', igw: 'Internet Gateway', ec2: 'EC2 Instance',
  rds: 'RDS Instance', eip: 'Elastic IP', nat: 'NAT Gateway',
  alb: 'Load Balancer', lambda: 'Lambda Function', ecs: 'ECS Service',
  cloudfront: 'CloudFront Distribution',
};

const ISSUE_COLOR = { waste: '#ef4444', idle: '#f59e0b', security: '#a855f7' };

function consoleUrl(type, data, region) {
  const r = region || 'us-east-1';
  if (type === 'ec2')        return `https://console.aws.amazon.com/ec2/v2/home?region=${r}#Instances:instanceId=${data.id ?? ''}`;
  if (type === 'rds')        return `https://console.aws.amazon.com/rds/home?region=${r}#database:id=${data.label ?? ''}`;
  if (type === 'alb')        return `https://console.aws.amazon.com/ec2/v2/home?region=${r}#LoadBalancers`;
  if (type === 'lambda')     return `https://console.aws.amazon.com/lambda/home?region=${r}#/functions/${data.label ?? ''}`;
  if (type === 'ecs')        return `https://console.aws.amazon.com/ecs/home?region=${r}#/services`;
  if (type === 'cloudfront') return `https://console.aws.amazon.com/cloudfront/v3/home#/distributions`;
  if (type === 'nat')        return `https://console.aws.amazon.com/vpc/home?region=${r}#NatGateways`;
  return null;
}

function openExternal(url) {
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

function Row({ k, v }) {
  if (v == null || v === '') return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5" style={{ borderBottom: '1px solid #1a1a1a' }}>
      <span className="text-[11px] text-gray-500 shrink-0 pt-0.5">{k}</span>
      <span className="text-[11px] text-gray-200 font-mono text-right break-all">{String(v)}</span>
    </div>
  );
}

// Fields to always skip in the generic row renderer
const SKIP_FIELDS = new Set(['label', 'hasIssue', 'issueType', 'issueLabel', 'sgIds', 'subnetIds', 'vpcId', 'estimatedCost']);

export default function NodeDetail({ node, region, onClose }) {
  if (!node) return null;
  const { type, data } = node;
  const url = consoleUrl(type, { ...data, id: node.id, label: node.data?.label }, region);
  const issueColor = data.hasIssue ? (ISSUE_COLOR[data.issueType] ?? '#ef4444') : null;

  const rows = Object.entries(data || {}).filter(([k]) => !SKIP_FIELDS.has(k));

  return (
    <div
      className="card"
      style={{
        position: 'absolute', right: 12, top: 12, bottom: 12,
        width: 280, zIndex: 10, overflowY: 'auto',
        background: '#0e0e0e', display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3" style={{ borderBottom: '1px solid #1a1a1a' }}>
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">{TYPE_LABELS[type] ?? type}</p>
          <p className="text-sm font-medium text-white mt-0.5 truncate" title={data.label}>{data.label}</p>
          {node.id !== data.label && (
            <p className="text-[10px] text-gray-600 font-mono mt-0.5 truncate">{node.id}</p>
          )}
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors shrink-0 mt-0.5">
          <X size={14} />
        </button>
      </div>

      {/* Issue warning */}
      {issueColor && (
        <div className="px-4 py-2.5 flex items-start gap-2" style={{ background: `${issueColor}10`, borderBottom: `1px solid ${issueColor}30` }}>
          <AlertTriangle size={12} style={{ color: issueColor, flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11, color: issueColor, lineHeight: 1.4 }}>{data.issueLabel}</p>
        </div>
      )}

      {/* Cost */}
      {data.estimatedCost != null && (
        <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid #1a1a1a', background: '#0c0c0c' }}>
          <div className="flex items-center gap-1.5">
            <DollarSign size={11} className="text-gray-500" />
            <span className="text-[11px] text-gray-500">Est. monthly cost</span>
          </div>
          <span className="text-sm font-mono font-semibold text-white">
            {data.estimatedCost > 0 ? `~$${data.estimatedCost.toFixed(2)}` : 'Free'}
          </span>
        </div>
      )}

      {/* Properties */}
      <div className="flex-1 px-4 py-2">
        {rows.map(([k, v]) => (
          <Row key={k} k={k.replace(/([A-Z])/g, ' $1').trim()} v={Array.isArray(v) ? v.join(', ') : v} />
        ))}
        {data.sgIds?.length > 0 && <Row k="Security Groups" v={data.sgIds.join(', ')} />}
        {data.subnetIds?.length > 0 && <Row k="Subnets" v={data.subnetIds.join(', ')} />}
        {data.vpcId && <Row k="VPC" v={data.vpcId} />}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #1a1a1a' }}>
        <p className="text-[10px] text-gray-600">Click canvas to deselect</p>
        {url && (
          <button
            onClick={() => openExternal(url)}
            className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-blue-400 transition-colors"
          >
            <ExternalLink size={10} /> Console
          </button>
        )}
      </div>
    </div>
  );
}
