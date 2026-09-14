import dagre from '@dagrejs/dagre';

const NODE_W = 200;
const NODE_H = 60;
const NS_PAD_TOP = 40;
const NS_PAD = 30;
const NS_GAP = 50;

/** Build ReactFlow nodes with per-namespace dagre layout + namespace parent grouping. */
export function buildK8sLayout(rawNodes, rawEdges) {
  const nsNodes = rawNodes.filter(n => n.type === 'namespace');
  const members = rawNodes.filter(n => n.type !== 'namespace');

  const byNs = new Map();
  for (const n of members) {
    const ns = n.data?.namespace || '__cluster__';
    if (!byNs.has(ns)) byNs.set(ns, []);
    byNs.get(ns).push(n);
  }

  const rfNodes = [];
  let yOffset = 0;

  for (const nsMeta of nsNodes) {
    const ns = nsMeta.label;
    const nsMembers = byNs.get(ns) ?? [];
    if (nsMembers.length === 0) continue;

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', nodesep: 30, ranksep: 60 });
    g.setDefaultEdgeLabel(() => ({}));

    const memberIds = new Set(nsMembers.map(m => m.id));
    for (const n of nsMembers) g.setNode(n.id, { width: NODE_W, height: NODE_H });
    for (const e of rawEdges) {
      if (memberIds.has(e.source) && memberIds.has(e.target)) g.setEdge(e.source, e.target);
    }

    dagre.layout(g);

    let maxX = 0, maxY = 0;
    for (const n of nsMembers) {
      const pos = g.node(n.id);
      maxX = Math.max(maxX, pos.x + NODE_W / 2);
      maxY = Math.max(maxY, pos.y + NODE_H / 2);
    }

    const nsId = nsMeta.id;
    const width = maxX + NS_PAD * 2;
    const height = maxY + NS_PAD_TOP + NS_PAD;

    rfNodes.push({
      id: nsId, type: 'nsGroup',
      position: { x: 0, y: yOffset },
      data: { label: ns, count: nsMembers.length },
      style: { width, height },
      draggable: false, selectable: false, zIndex: 0,
    });

    for (const n of nsMembers) {
      const pos = g.node(n.id);
      rfNodes.push({
        id: n.id, type: n.type,
        parentNode: nsId, extent: 'parent',
        position: { x: pos.x - NODE_W / 2 + NS_PAD, y: pos.y - NODE_H / 2 + NS_PAD_TOP },
        data: { ...n.data, label: n.label },
        zIndex: 2,
      });
    }

    yOffset += height + NS_GAP;
  }

  return rfNodes;
}
