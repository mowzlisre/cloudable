// Tier index within a VPC container (lower = higher on screen)
const TIER = {
  igw: 0,
  alb: 1, nat: 1,
  ec2: 2, lambda: 2, ecs: 2, eip: 2,
  rds: 3, elasticache: 3,
};

const NODE_W = 200;
const NODE_H = 72;
const H_GAP = 50;
const TIER_SPACING = 150;
const VPC_PAD_TOP = 64;
const VPC_PAD = 44;
const VPC_GAP = 70;
const GLOBAL_Y = 0;
const VPC_Y = 180;

/**
 * Build ReactFlow nodes with tiered layout + VPC parent grouping.
 * Parent nodes come first in the returned array (ReactFlow requirement).
 */
export function buildTieredLayout(rawNodes) {
  const GLOBAL_TYPES = new Set(['internet', 'cloudfront']);
  const SKIP_TYPES   = new Set(['vpc', 'subnet']); // vpc becomes container; subnet is embedded in node metadata

  const globalNodes   = rawNodes.filter(n => GLOBAL_TYPES.has(n.type));
  const vpcMeta       = rawNodes.filter(n => n.type === 'vpc');
  const resourceNodes = rawNodes.filter(n => !GLOBAL_TYPES.has(n.type) && !SKIP_TYPES.has(n.type));

  // Group resources by VPC
  const byVpc = new Map();
  for (const n of resourceNodes) {
    const vid = n.data?.vpcId || '__no_vpc__';
    if (!byVpc.has(vid)) byVpc.set(vid, []);
    byVpc.get(vid).push(n);
  }

  // Calculate per-VPC layout
  const vpcLayouts = new Map();
  for (const [vpcId, nodes] of byVpc) {
    const byTier = new Map();
    for (const n of nodes) {
      const t = TIER[n.type] ?? 2;
      if (!byTier.has(t)) byTier.set(t, []);
      byTier.get(t).push(n);
    }

    const tiers = [...byTier.entries()].sort(([a], [b]) => a - b);
    const maxRowW = Math.max(...tiers.map(([, ns]) => ns.length * NODE_W + (ns.length - 1) * H_GAP), NODE_W);
    const positions = [];

    for (const [tier, tierNodes] of tiers) {
      const rowW = tierNodes.length * NODE_W + (tierNodes.length - 1) * H_GAP;
      const rowX = (maxRowW - rowW) / 2; // center row within max width
      const y = tier * TIER_SPACING;
      tierNodes.forEach((n, i) => positions.push({ id: n.id, x: rowX + i * (NODE_W + H_GAP), y }));
    }

    const lastTier = tiers.length ? Math.max(...tiers.map(([t]) => t)) : 0;
    vpcLayouts.set(vpcId, {
      width: Math.max(maxRowW + VPC_PAD * 2, 300),
      height: lastTier * TIER_SPACING + NODE_H + VPC_PAD_TOP + VPC_PAD,
      positions,
    });
  }

  // Lay VPC containers side by side
  const orderedVpcIds = [
    ...vpcMeta.map(v => v.id).filter(id => byVpc.has(id)),
    ...[...byVpc.keys()].filter(id => !vpcMeta.find(v => v.id === id)),
  ];

  const vpcXPos = new Map();
  let curX = 0;
  for (const vpcId of orderedVpcIds) {
    const layout = vpcLayouts.get(vpcId);
    if (!layout) continue;
    vpcXPos.set(vpcId, curX);
    curX += layout.width + VPC_GAP;
  }

  const totalW = curX > 0 ? curX - VPC_GAP : 0;
  const globalRowW = globalNodes.length * NODE_W + Math.max(globalNodes.length - 1, 0) * H_GAP;
  const globalStartX = Math.max(0, (totalW - globalRowW) / 2);

  // Assemble RF nodes — parents first
  const rfNodes = [];

  // 1. VPC group containers
  for (const vpcId of orderedVpcIds) {
    const layout = vpcLayouts.get(vpcId);
    const x = vpcXPos.get(vpcId);
    if (layout == null || x == null) continue;
    const meta = vpcMeta.find(v => v.id === vpcId);
    rfNodes.push({
      id: vpcId,
      type: 'vpcGroup',
      data: { label: meta?.label ?? vpcId, cidr: meta?.data?.cidr ?? '', isDefault: meta?.data?.isDefault ?? false },
      position: { x, y: VPC_Y },
      style: { width: layout.width, height: layout.height },
      selectable: false,
      draggable: true,
      zIndex: 0,
    });
  }

  // 2. Global nodes (no parent)
  globalNodes.forEach((n, i) => {
    rfNodes.push({
      id: n.id, type: n.type,
      data: { ...n.data, label: n.label },
      position: { x: globalStartX + i * (NODE_W + H_GAP), y: GLOBAL_Y },
      zIndex: 2,
    });
  });

  // 3. Resource nodes (children inside VPC containers)
  for (const vpcId of orderedVpcIds) {
    const layout = vpcLayouts.get(vpcId);
    if (!layout) continue;
    const nodes = byVpc.get(vpcId) ?? [];
    for (const pos of layout.positions) {
      const raw = nodes.find(n => n.id === pos.id);
      if (!raw) continue;
      rfNodes.push({
        id: raw.id, type: raw.type,
        data: { ...raw.data, label: raw.label },
        position: { x: pos.x + VPC_PAD, y: pos.y + VPC_PAD_TOP },
        parentNode: vpcId,
        extent: 'parent',
        zIndex: 2,
      });
    }
  }

  return rfNodes;
}

/** Merge parallel source→target edges into one with combined label. */
export function mergeParallelEdges(edges) {
  const map = new Map();
  const PRIORITY = { sg: 3, open: 2, nat: 1 };

  for (const edge of edges) {
    const key = `${edge.source}→${edge.target}`;
    if (!map.has(key)) {
      map.set(key, { ...edge, _labels: edge.label ? [edge.label] : [] });
    } else {
      const e = map.get(key);
      if (edge.label && !e._labels.includes(edge.label)) e._labels.push(edge.label);
      if ((PRIORITY[edge.edgeType] ?? 0) > (PRIORITY[e.edgeType] ?? 0)) e.edgeType = edge.edgeType;
    }
  }

  return [...map.values()].map(e => ({
    ...e,
    label: e._labels.length > 1 ? e._labels.join(' · ') : (e._labels[0] ?? ''),
    _labels: undefined,
  }));
}
