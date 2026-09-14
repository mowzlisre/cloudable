const router = require('express').Router();
const { EKSClient, ListClustersCommand, DescribeClusterCommand } = require('@aws-sdk/client-eks');
const { getEksToken } = require('../lib/eksToken');
const { k8sGet } = require('../lib/k8sApi');

function creds() {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

// GET /api/kubernetes/clusters — list EKS clusters in the region.
router.get('/clusters', async (req, res) => {
  const region = req.query.region || process.env.AWS_REGION || 'us-east-1';
  const eks = new EKSClient({ region, credentials: creds() });

  try {
    const { clusters = [] } = await eks.send(new ListClustersCommand({}));
    const details = await Promise.all(clusters.map(async (name) => {
      try {
        const { cluster } = await eks.send(new DescribeClusterCommand({ name }));
        return { name, status: cluster.status, version: cluster.version };
      } catch {
        return { name, status: 'UNKNOWN' };
      }
    }));
    res.json({ clusters: details });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/kubernetes/topology?cluster=<name> — pods, controllers, services and
// how they're connected (ownership chain + Service→Pod routing via selectors).
router.get('/topology', async (req, res) => {
  const region = req.query.region || process.env.AWS_REGION || 'us-east-1';
  const clusterName = req.query.cluster;
  if (!clusterName) return res.status(400).json({ error: 'cluster query param is required' });

  const credentials = creds();
  const eks = new EKSClient({ region, credentials });

  try {
    const { cluster } = await eks.send(new DescribeClusterCommand({ name: clusterName }));
    if (!cluster?.endpoint || !cluster?.certificateAuthority?.data) {
      return res.status(400).json({ error: 'Cluster endpoint/CA not available yet — is it still creating?' });
    }

    const token = await getEksToken({ clusterName, region, credentials });
    const caData = cluster.certificateAuthority.data;
    const get = (path) => k8sGet(cluster.endpoint, caData, token, path);

    const [podsRes, svcRes, rsRes, depRes, stsRes, dsRes] = await Promise.all([
      get('/api/v1/pods'),
      get('/api/v1/services'),
      get('/apis/apps/v1/replicasets'),
      get('/apis/apps/v1/deployments'),
      get('/apis/apps/v1/statefulsets'),
      get('/apis/apps/v1/daemonsets'),
    ]);

    const pods         = podsRes.items || [];
    const services     = svcRes.items || [];
    const replicasets   = rsRes.items || [];
    const deployments   = depRes.items || [];
    const statefulsets   = stsRes.items || [];
    const daemonsets     = dsRes.items || [];

    const nodes = [];
    const edges = [];
    const seen = new Set();
    function addEdge(id, source, target, edgeType, label) {
      const key = `${source}→${target}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({ id, source, target, edgeType, label });
    }

    const namespaces = new Set();
    for (const list of [pods, services, deployments, statefulsets, daemonsets]) {
      for (const item of list) namespaces.add(item.metadata.namespace);
    }
    for (const ns of namespaces) nodes.push({ id: `ns-${ns}`, type: 'namespace', label: ns, data: { namespace: ns } });

    // uid → our node id, so pods/replicasets can find their owning controller
    const uidToNodeId = new Map();

    for (const d of deployments) {
      const id = `deploy-${d.metadata.namespace}-${d.metadata.name}`;
      uidToNodeId.set(d.metadata.uid, id);
      const desired = d.spec.replicas ?? 0;
      const available = d.status.availableReplicas ?? 0;
      const healthy = desired > 0 && available >= desired;
      nodes.push({
        id, type: 'deployment', label: d.metadata.name,
        data: {
          namespace: d.metadata.namespace, desired, available,
          state: healthy ? 'healthy' : 'degraded',
          hasIssue: !healthy,
          issueType: !healthy ? 'waste' : undefined,
          issueLabel: !healthy ? `${available}/${desired} replicas available` : undefined,
        },
      });
    }

    for (const s of statefulsets) {
      const id = `sts-${s.metadata.namespace}-${s.metadata.name}`;
      uidToNodeId.set(s.metadata.uid, id);
      const desired = s.spec.replicas ?? 0;
      const ready = s.status.readyReplicas ?? 0;
      const healthy = desired > 0 && ready >= desired;
      nodes.push({
        id, type: 'statefulset', label: s.metadata.name,
        data: {
          namespace: s.metadata.namespace, desired, ready,
          state: healthy ? 'healthy' : 'degraded',
          hasIssue: !healthy,
          issueType: !healthy ? 'waste' : undefined,
          issueLabel: !healthy ? `${ready}/${desired} ready` : undefined,
        },
      });
    }

    for (const d of daemonsets) {
      const id = `ds-${d.metadata.namespace}-${d.metadata.name}`;
      uidToNodeId.set(d.metadata.uid, id);
      const desired = d.status.desiredNumberScheduled ?? 0;
      const ready = d.status.numberReady ?? 0;
      const healthy = desired > 0 && ready >= desired;
      nodes.push({
        id, type: 'daemonset', label: d.metadata.name,
        data: {
          namespace: d.metadata.namespace, desired, ready,
          state: healthy ? 'healthy' : 'degraded',
          hasIssue: !healthy,
          issueType: !healthy ? 'waste' : undefined,
          issueLabel: !healthy ? `${ready}/${desired} ready` : undefined,
        },
      });
    }

    // Skip scaled-to-zero ReplicaSets — they're history, not live topology.
    for (const rs of replicasets) {
      const desired = rs.spec.replicas ?? 0;
      const current = rs.status.replicas ?? 0;
      if (desired === 0 && current === 0) continue;
      const id = `rs-${rs.metadata.namespace}-${rs.metadata.name}`;
      uidToNodeId.set(rs.metadata.uid, id);
      nodes.push({
        id, type: 'replicaset', label: rs.metadata.name,
        data: {
          namespace: rs.metadata.namespace, desired, current,
          state: current >= desired ? 'healthy' : 'degraded',
        },
      });
      const owner = (rs.metadata.ownerReferences || [])[0];
      const ownerId = owner && uidToNodeId.get(owner.uid);
      if (ownerId) addEdge(`e-${ownerId}-${id}`, ownerId, id, 'owner', 'owns');
    }

    for (const s of services) {
      const id = `svc-${s.metadata.namespace}-${s.metadata.name}`;
      const ports = (s.spec.ports || []).map(p => `${p.port}${p.protocol !== 'TCP' ? '/' + p.protocol : ''}`).join(', ');
      nodes.push({
        id, type: 'service', label: s.metadata.name,
        data: { namespace: s.metadata.namespace, clusterIP: s.spec.clusterIP, svcType: s.spec.type, ports },
      });
    }

    for (const p of pods) {
      const id = `pod-${p.metadata.namespace}-${p.metadata.name}`;
      const phase = p.status.phase || 'Unknown';
      const containerStatuses = p.status.containerStatuses || [];
      const restarts = containerStatuses.reduce((sum, c) => sum + (c.restartCount || 0), 0);
      const ready = containerStatuses.length > 0 && containerStatuses.every(c => c.ready);
      const waitingReason = containerStatuses.find(c => c.state?.waiting)?.state?.waiting?.reason;

      let state = phase.toLowerCase();
      let issueType, issueLabel;
      if (waitingReason === 'CrashLoopBackOff' || phase === 'Failed') {
        state = 'crashloop';
        issueType = 'waste';
        issueLabel = waitingReason || phase;
      } else if (phase === 'Pending') {
        issueType = 'idle';
        issueLabel = 'Pending';
      } else if (phase === 'Running' && !ready) {
        issueType = 'idle';
        issueLabel = 'Not ready';
      }

      nodes.push({
        id, type: 'pod', label: p.metadata.name,
        data: {
          namespace: p.metadata.namespace, phase, ready, restarts,
          node: p.spec.nodeName, podIP: p.status.podIP,
          containers: (p.spec.containers || []).map(c => c.image),
          state,
          hasIssue: !!issueType,
          issueType, issueLabel,
        },
      });

      const owner = (p.metadata.ownerReferences || [])[0];
      const ownerId = owner && uidToNodeId.get(owner.uid);
      if (ownerId) addEdge(`e-${ownerId}-${id}`, ownerId, id, 'owner', 'owns');
    }

    // Service → Pod routing, derived from label selector matches.
    for (const s of services) {
      const selector = s.spec.selector;
      if (!selector || Object.keys(selector).length === 0) continue;
      const svcId = `svc-${s.metadata.namespace}-${s.metadata.name}`;
      for (const p of pods) {
        if (p.metadata.namespace !== s.metadata.namespace) continue;
        const labels = p.metadata.labels || {};
        const matches = Object.entries(selector).every(([k, v]) => labels[k] === v);
        if (matches) {
          const podId = `pod-${p.metadata.namespace}-${p.metadata.name}`;
          addEdge(`e-${svcId}-${podId}`, svcId, podId, 'route', 'routes to');
        }
      }
    }

    res.json({ nodes, edges, cluster: clusterName, region, scannedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
