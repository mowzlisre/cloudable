import { Handle, Position } from 'reactflow';
import {
  Globe, Server, Database, Wifi, ArrowRightLeft,
  LayoutTemplate, Box, Zap, Container, Cloud, AlertTriangle,
  Cpu, Network, Inbox, Bell, Layers, Link, Navigation,
  Table, GitBranch, Activity, Plug,
  HardDrive, Archive, FolderOpen, Radio, GitMerge,
  Shield, Package, Shuffle, BarChart2, Search,
} from 'lucide-react';

const TYPE_CONFIG = {
  internet:    { icon: Cloud,          color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',    border: 'rgba(6,182,212,0.3)',    label: 'Internet' },
  igw:         { icon: Globe,          color: '#22c55e', bg: 'rgba(34,197,94,0.08)',    border: 'rgba(34,197,94,0.3)',    label: 'Internet Gateway' },
  ec2:         { icon: Server,         color: '#f97316', bg: 'rgba(249,115,22,0.08)',   border: 'rgba(249,115,22,0.3)',   label: 'EC2' },
  rds:         { icon: Database,       color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.3)',   label: 'RDS' },
  aurora:      { icon: Layers,         color: '#1d4ed8', bg: 'rgba(29,78,216,0.08)',    border: 'rgba(29,78,216,0.3)',    label: 'Aurora' },
  eip:         { icon: Wifi,           color: '#eab308', bg: 'rgba(234,179,8,0.08)',    border: 'rgba(234,179,8,0.3)',    label: 'Elastic IP' },
  nat:         { icon: ArrowRightLeft, color: '#f97316', bg: 'rgba(249,115,22,0.08)',   border: 'rgba(249,115,22,0.3)',   label: 'NAT Gateway' },
  alb:         { icon: LayoutTemplate, color: '#a855f7', bg: 'rgba(168,85,247,0.08)',   border: 'rgba(168,85,247,0.3)',   label: 'Load Balancer' },
  lambda:      { icon: Zap,            color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.3)',   label: 'Lambda' },
  ecs:         { icon: Container,      color: '#10b981', bg: 'rgba(16,185,129,0.08)',   border: 'rgba(16,185,129,0.3)',   label: 'ECS Service' },
  cloudfront:  { icon: Box,            color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',   border: 'rgba(139,92,246,0.3)',   label: 'CloudFront' },
  elasticache: { icon: Cpu,            color: '#dc2626', bg: 'rgba(220,38,38,0.08)',    border: 'rgba(220,38,38,0.3)',    label: 'ElastiCache' },
  apigateway:  { icon: Network,        color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)',   border: 'rgba(14,165,233,0.3)',   label: 'API Gateway' },
  sqs:         { icon: Inbox,          color: '#ff9900', bg: 'rgba(255,153,0,0.08)',    border: 'rgba(255,153,0,0.3)',    label: 'SQS Queue' },
  sns:         { icon: Bell,           color: '#ec4899', bg: 'rgba(236,72,153,0.08)',   border: 'rgba(236,72,153,0.3)',   label: 'SNS Topic' },
  dynamodb:    { icon: Table,          color: '#4f46e5', bg: 'rgba(79,70,229,0.08)',    border: 'rgba(79,70,229,0.3)',    label: 'DynamoDB' },
  msk:         { icon: GitBranch,      color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',   border: 'rgba(124,58,237,0.3)',   label: 'MSK / Kafka' },
  kinesis:     { icon: Activity,       color: '#0891b2', bg: 'rgba(8,145,178,0.08)',    border: 'rgba(8,145,178,0.3)',    label: 'Kinesis' },
  vpce:        { icon: Plug,           color: '#64748b', bg: 'rgba(100,116,139,0.08)',  border: 'rgba(100,116,139,0.3)',  label: 'VPC Endpoint' },
  route53:     { icon: Navigation,     color: '#16a34a', bg: 'rgba(22,163,74,0.08)',    border: 'rgba(22,163,74,0.3)',    label: 'Route 53' },
  ebs:         { icon: HardDrive,      color: '#6366f1', bg: 'rgba(99,102,241,0.08)',   border: 'rgba(99,102,241,0.3)',   label: 'EBS Volume' },
  s3:          { icon: Archive,        color: '#16a34a', bg: 'rgba(22,163,74,0.08)',    border: 'rgba(22,163,74,0.3)',    label: 'S3 Bucket' },
  efs:         { icon: FolderOpen,     color: '#0891b2', bg: 'rgba(8,145,178,0.08)',    border: 'rgba(8,145,178,0.3)',    label: 'EFS' },
  eventbridge: { icon: Radio,          color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.3)',   label: 'EventBridge' },
  stepfunctions:{ icon: GitMerge,      color: '#7c3aed', bg: 'rgba(124,58,237,0.08)',   border: 'rgba(124,58,237,0.3)',   label: 'Step Functions' },
  waf:         { icon: Shield,         color: '#dc2626', bg: 'rgba(220,38,38,0.08)',    border: 'rgba(220,38,38,0.3)',    label: 'WAF' },
  ecr:         { icon: Package,        color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)',   border: 'rgba(14,165,233,0.3)',   label: 'ECR' },
  rdsproxy:    { icon: Shuffle,        color: '#3b82f6', bg: 'rgba(59,130,246,0.08)',   border: 'rgba(59,130,246,0.3)',   label: 'RDS Proxy' },
  redshift:    { icon: BarChart2,      color: '#4f46e5', bg: 'rgba(79,70,229,0.08)',    border: 'rgba(79,70,229,0.3)',    label: 'Redshift' },
  opensearch:  { icon: Search,         color: '#0891b2', bg: 'rgba(8,145,178,0.08)',    border: 'rgba(8,145,178,0.3)',    label: 'OpenSearch' },
};

const ISSUE_COLOR = { waste: '#ef4444', idle: '#f59e0b', security: '#a855f7' };

function StateIndicator({ state }) {
  const color = (state === 'running' || state === 'available' || state === 'active' || state === 'ACTIVE')
    ? '#22c55e' : state === 'stopped' ? '#ef4444' : '#f59e0b';
  return (
    <span title={state} style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}`, flexShrink: 0 }} />
  );
}

function getDetail(type, data) {
  if (type === 'ec2')         return [data.instanceType, data.privateIp].filter(Boolean).join(' · ');
  if (type === 'rds')         return data.engine ?? '';
  if (type === 'aurora')      return `${data.engine ?? ''} · ${data.members ?? 0} nodes`;
  if (type === 'eip')         return data.privateIp ?? '';
  if (type === 'nat')         return data.publicIp ?? '';
  if (type === 'alb')         return data.scheme ?? '';
  if (type === 'lambda')      return data.runtime ?? '';
  if (type === 'ecs')         return data.launchType ? `${data.launchType} · ${data.runningCount ?? 0}/${data.desiredCount ?? 0} tasks` : '';
  if (type === 'cloudfront')  return data.status ?? '';
  if (type === 'elasticache') return `${data.engine ?? ''} · ${data.nodeCount ?? 0} nodes`;
  if (type === 'apigateway')  return data.endpointType ?? '';
  if (type === 'sqs')         return data.fifo ? 'FIFO' : 'Standard';
  if (type === 'sns')         return 'Topic';
  if (type === 'dynamodb')    return 'Table';
  if (type === 'msk')         return `${data.clusterType ?? 'Kafka'} · ${data.brokerCount ?? 0} brokers`;
  if (type === 'kinesis')     return 'Stream';
  if (type === 'vpce')         return data.endpointType ?? '';
  if (type === 'route53')      return `${data.recordCount ?? 0} records`;
  if (type === 'ebs')          return `${data.size ?? 0}GB · ${data.volumeType ?? ''}`;
  if (type === 's3')           return data.bucketName ?? '';
  if (type === 'efs')          return data.throughputMode ?? '';
  if (type === 'eventbridge')  return data.schedule ?? data.pattern ?? '';
  if (type === 'stepfunctions') return data.type ?? '';
  if (type === 'waf')          return data.capacity ? `${data.capacity} WCU` : '';
  if (type === 'ecr')          return data.repoUri?.split('/').slice(1).join('/') ?? '';
  if (type === 'rdsproxy')     return data.engineFamily ?? '';
  if (type === 'redshift')     return `${data.nodeType ?? ''} · ${data.nodeCount ?? 0} nodes`;
  if (type === 'opensearch')   return data.engineVersion ?? '';
  return '';
}

export default function MapNode({ data, type, selected }) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.ec2;
  const Icon = cfg.icon;
  const detail = getDetail(type, data);
  const issueColor = data.hasIssue ? (ISSUE_COLOR[data.issueType] ?? '#ef4444') : null;
  const hasState = ['ec2', 'rds', 'aurora', 'ecs', 'alb', 'elasticache', 'msk', 'kinesis', 'rdsproxy', 'redshift', 'opensearch', 'efs'].includes(type);
  const stateVal = data.state ?? data.status;
  const disabled = !!data.isDisabled;

  const activeBg     = disabled ? 'rgba(30,30,30,0.5)'  : cfg.bg;
  const activeBorder = disabled ? 'rgba(50,50,50,0.6)'  : (selected ? cfg.color : (issueColor ? `${issueColor}60` : cfg.border));
  const activeColor  = disabled ? '#3a3a3a'             : cfg.color;
  const labelColor   = disabled ? '#444'                : '#f5f5f5';
  const detailColor  = disabled ? '#333'                : '#6b7280';

  return (
    <div style={{ position: 'relative', opacity: disabled ? 0.45 : 1, transition: 'opacity 0.2s' }}>
      {issueColor && !disabled && (
        <div style={{
          position: 'absolute', inset: -4, borderRadius: 14,
          border: `2px solid ${issueColor}`,
          boxShadow: `0 0 8px ${issueColor}50`,
          pointerEvents: 'none', zIndex: 1,
        }} />
      )}
      {disabled && (
        <div style={{
          position: 'absolute', inset: -2, borderRadius: 12,
          border: '1px dashed #2a2a2a',
          pointerEvents: 'none', zIndex: 1,
        }} />
      )}
      <div style={{
        background: activeBg,
        border: `1px solid ${activeBorder}`,
        borderRadius: 10,
        padding: '8px 12px',
        minWidth: 160,
        width: 200,
        boxShadow: selected && !disabled ? `0 0 0 2px ${cfg.color}40` : '0 2px 8px rgba(0,0,0,0.4)',
        transition: 'box-shadow 0.15s, border-color 0.15s',
        cursor: 'default',
        position: 'relative',
        filter: disabled ? 'grayscale(1)' : 'none',
      }}>
        <Handle type="target" position={Position.Top}    style={{ opacity: 0, width: 8, height: 8, border: 'none' }} />
        <Handle type="target" position={Position.Left}   style={{ opacity: 0, width: 8, height: 8, border: 'none' }} />
        <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 8, height: 8, border: 'none' }} />
        <Handle type="source" position={Position.Right}  style={{ opacity: 0, width: 8, height: 8, border: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: activeColor, flexShrink: 0 }}>
            <Icon size={14} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: labelColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }} title={data.label ?? ''}>
                {data.label || data.id}
              </span>
              {hasState && stateVal && !disabled && <StateIndicator state={stateVal} />}
              {issueColor && !disabled && <AlertTriangle size={10} style={{ color: issueColor, flexShrink: 0 }} />}
              {disabled && (
                <span style={{ fontSize: 9, color: '#3a3a3a', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 3, padding: '0 4px', flexShrink: 0 }}>
                  inactive
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: detailColor, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }} title={detail}>
              {detail}
            </div>
          </div>
        </div>

        {data.estimatedCost != null && data.estimatedCost > 0 && !disabled && (
          <div style={{
            position: 'absolute', bottom: -9, right: 8,
            fontSize: 9, fontFamily: 'monospace',
            background: '#1a1a1a', border: '1px solid #2a2a2a',
            borderRadius: 4, padding: '1px 5px', color: '#9ca3af',
          }}>
            ~${data.estimatedCost.toFixed(0)}/mo
          </div>
        )}
      </div>
    </div>
  );
}
