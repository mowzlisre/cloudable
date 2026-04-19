const router = require('express').Router();
const {
  EC2Client,
  DescribeVolumesCommand, DescribeAddressesCommand, DescribeInstancesCommand,
  DescribeSnapshotsCommand, DescribeImagesCommand, DescribeNetworkInterfacesCommand,
  DescribeRouteTablesCommand, DescribeNatGatewaysCommand,
} = require('@aws-sdk/client-ec2');
const { RDSClient, DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const {
  ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand, DescribeTargetHealthCommand,
} = require('@aws-sdk/client-elastic-load-balancing-v2');
const { CloudWatchLogsClient, DescribeLogGroupsCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { IAMClient, ListRolesCommand } = require('@aws-sdk/client-iam');

// ── Scoring weights ───────────────────────────────────────────────────────
const COST_WEIGHTS   = { 'stopped-ec2': 8, 'unattached-ebs': 6, 'unused-eip': 5, 'idle-lb': 7, 'stopped-rds': 7, 'idle-nat': 6 };
const UTIL_WEIGHTS   = { 'orphaned-snapshots': 4, 'unused-amis': 3, 'empty-log-groups': 2 };
const SEC_WEIGHTS    = { 'unused-sgs': 4, 'inactive-iam': 3 };
const UTIL_CAPS      = { 'orphaned-snapshots': 20, 'unused-amis': 15, 'empty-log-groups': 15 };
const SEC_CAPS       = { 'unused-sgs': 30, 'inactive-iam': 20 };

function calcScore(categories) {
  let costDed = 0, utilDed = 0, secDed = 0;
  for (const c of categories) {
    const n = c.items.length;
    if (COST_WEIGHTS[c.id])  costDed  += n * COST_WEIGHTS[c.id];
    if (UTIL_WEIGHTS[c.id])  utilDed  += Math.min(n * UTIL_WEIGHTS[c.id],  UTIL_CAPS[c.id]  ?? 100);
    if (SEC_WEIGHTS[c.id])   secDed   += Math.min(n * SEC_WEIGHTS[c.id],   SEC_CAPS[c.id]   ?? 100);
  }
  const cost   = Math.max(0, 100 - costDed);
  const util   = Math.max(0, 100 - utilDed);
  const sec    = Math.max(0, 100 - secDed);
  const overall = Math.round(0.40 * cost + 0.35 * util + 0.25 * sec);
  return { overall, costEfficiency: cost, resourceUtilization: util, securityHygiene: sec };
}

function getName(tags, fallback) {
  return tags?.find(t => t.Key === 'Name')?.Value || fallback;
}

const NINETY_DAYS_AGO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
const THIRTY_DAYS_AGO = new Date(Date.now() - 30  * 24 * 60 * 60 * 1000);

router.get('/', async (req, res) => {
  const region = req.query.region || process.env.AWS_REGION || 'us-east-1';
  const credentials = {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };

  const ec2  = new EC2Client({ region, credentials });
  const rds  = new RDSClient({ region, credentials });
  const elb  = new ElasticLoadBalancingV2Client({ region, credentials });
  const logs = new CloudWatchLogsClient({ region, credentials });
  const iam  = new IAMClient({ region: 'us-east-1', credentials }); // IAM is global

  const [
    volsR, eipsR, instancesR, snapsR, imagesR,
    enisR, rtR, natsR, rdsR, lbsR, logsR, iamR,
  ] = await Promise.allSettled([
    ec2.send(new DescribeVolumesCommand({})),
    ec2.send(new DescribeAddressesCommand({})),
    ec2.send(new DescribeInstancesCommand({})),
    ec2.send(new DescribeSnapshotsCommand({ OwnerIds: ['self'] })),
    ec2.send(new DescribeImagesCommand({ Owners: ['self'] })),
    ec2.send(new DescribeNetworkInterfacesCommand({})),
    ec2.send(new DescribeRouteTablesCommand({})),
    ec2.send(new DescribeNatGatewaysCommand({ Filter: [{ Name: 'state', Values: ['available'] }] })),
    rds.send(new DescribeDBInstancesCommand({})),
    elb.send(new DescribeLoadBalancersCommand({})),
    logs.send(new DescribeLogGroupsCommand({ limit: 50 })),
    iam.send(new ListRolesCommand({ MaxItems: 100 })),
  ]);

  const volumes      = volsR.value?.Volumes ?? [];
  const addresses    = eipsR.value?.Addresses ?? [];
  const instances    = instancesR.value?.Reservations?.flatMap(r => r.Instances) ?? [];
  const snapshots    = snapsR.value?.Snapshots ?? [];
  const images       = imagesR.value?.Images ?? [];
  const enis         = enisR.value?.NetworkInterfaces ?? [];
  const routeTables  = rtR.value?.RouteTables ?? [];
  const nats         = natsR.value?.NatGateways ?? [];
  const rdsInstances = rdsR.value?.DBInstances ?? [];
  const lbs          = lbsR.value?.LoadBalancers ?? [];
  const logGroups    = logsR.value?.LogGroups ?? [];
  const iamRoles     = iamR.value?.Roles ?? [];

  // ── Load balancer → target health ──────────────────────────────────────
  const lbHealthyTargets = {};
  for (const lb of lbs) {
    lbHealthyTargets[lb.LoadBalancerArn] = 0;
    try {
      const tgs = await elb.send(new DescribeTargetGroupsCommand({ LoadBalancerArn: lb.LoadBalancerArn }));
      for (const tg of (tgs.TargetGroups ?? [])) {
        const health = await elb.send(new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn }));
        lbHealthyTargets[lb.LoadBalancerArn] += (health.TargetHealthDescriptions ?? [])
          .filter(t => t.TargetHealth?.State === 'healthy').length;
      }
    } catch (_) {}
  }

  // ── NAT gateways with no route pointing to them ─────────────────────────
  const routedNats = new Set();
  for (const rt of routeTables) {
    for (const route of (rt.Routes ?? [])) {
      if (route.NatGatewayId) routedNats.add(route.NatGatewayId);
    }
  }

  // ── Active volume IDs for orphan snapshot detection ─────────────────────
  const activeVolumeIds = new Set(volumes.map(v => v.VolumeId));

  // ── AMIs used by running/stopped instances ───────────────────────────────
  const usedImageIds = new Set(instances.map(i => i.ImageId));

  // ── SGs attached to any ENI ─────────────────────────────────────────────
  const attachedSgIds = new Set(enis.flatMap(e => (e.Groups ?? []).map(g => g.GroupId)));
  // Also consider SGs attached to instances
  for (const inst of instances) {
    for (const sg of (inst.SecurityGroups ?? [])) attachedSgIds.add(sg.GroupId);
  }

  // ── Category builders ───────────────────────────────────────────────────
  const categories = [];

  // 1. Stopped EC2 instances
  const stoppedEc2 = instances.filter(i => i.State?.Name === 'stopped');
  categories.push({
    id: 'stopped-ec2', severity: 'waste',
    title: 'Stopped EC2 Instances',
    description: 'Instances not running but still charging for attached EBS storage.',
    icon: 'server',
    suggestion: `${stoppedEc2.length} stopped EC2 instance${stoppedEc2.length !== 1 ? 's' : ''} — terminate or create an AMI and delete to stop EBS charges.`,
    items: stoppedEc2.map(i => ({
      id: i.InstanceId,
      name: getName(i.Tags, i.InstanceId),
      detail: `${i.InstanceType} · ${i.Placement?.AvailabilityZone}`,
      az: i.Placement?.AvailabilityZone,
      status: 'waste',
      reason: i.StateTransitionReason || 'Stopped',
      estimatedCost: (i.BlockDeviceMappings?.length ?? 1) * 8 * 0.10,
    })),
  });

  // 2. Unattached EBS volumes
  const unattachedVols = volumes.filter(v => v.State === 'available');
  categories.push({
    id: 'unattached-ebs', severity: 'waste',
    title: 'Unattached EBS Volumes',
    description: 'Block storage not attached to any instance.',
    icon: 'hard-drive',
    suggestion: `${unattachedVols.length} unattached EBS volume${unattachedVols.length !== 1 ? 's' : ''} — delete or snapshot and delete to stop charges.`,
    items: unattachedVols.map(v => ({
      id: v.VolumeId,
      name: getName(v.Tags, v.VolumeId),
      detail: `${v.VolumeType?.toUpperCase()} · ${v.Size} GB · ${v.AvailabilityZone}`,
      az: v.AvailabilityZone,
      status: 'waste',
      reason: 'Not attached to any instance',
      estimatedCost: v.Size * 0.10,
    })),
  });

  // 3. Unused Elastic IPs
  const unusedEips = addresses.filter(a => !a.InstanceId && !a.NetworkInterfaceId);
  categories.push({
    id: 'unused-eip', severity: 'waste',
    title: 'Unused Elastic IPs',
    description: 'Elastic IP addresses allocated but not associated with any resource.',
    icon: 'wifi',
    suggestion: `${unusedEips.length} unused Elastic IP${unusedEips.length !== 1 ? 's' : ''} — release to avoid $0.005/hr charges.`,
    items: unusedEips.map(a => ({
      id: a.AllocationId ?? a.PublicIp,
      name: a.PublicIp,
      detail: `Allocation: ${a.AllocationId ?? '—'}`,
      az: region,
      status: 'waste',
      reason: 'Not associated with any instance or network interface',
      estimatedCost: 3.65,
    })),
  });

  // 4. Load Balancers with no healthy targets
  const idleLbs = lbs.filter(lb => (lbHealthyTargets[lb.LoadBalancerArn] ?? 0) === 0);
  categories.push({
    id: 'idle-lb', severity: 'waste',
    title: 'Load Balancers — No Active Targets',
    description: 'Load balancers running with no healthy registered targets.',
    icon: 'layout-template',
    suggestion: `${idleLbs.length} load balancer${idleLbs.length !== 1 ? 's' : ''} with no healthy targets — delete if no longer needed (~$16/mo each).`,
    items: idleLbs.map(lb => ({
      id: lb.LoadBalancerArn?.split('/').pop(),
      name: lb.LoadBalancerName,
      detail: `${lb.Type?.toUpperCase()} · ${lb.Scheme} · ${lb.VpcId}`,
      az: region,
      status: 'waste',
      reason: 'No healthy targets registered',
      estimatedCost: 16.43,
    })),
  });

  // 5. Stopped RDS instances
  const stoppedRds = rdsInstances.filter(d => d.DBInstanceStatus === 'stopped');
  categories.push({
    id: 'stopped-rds', severity: 'waste',
    title: 'Stopped RDS Instances',
    description: 'Stopped RDS instances still billing for storage. AWS auto-restarts after 7 days.',
    icon: 'database',
    suggestion: `${stoppedRds.length} stopped RDS instance${stoppedRds.length !== 1 ? 's' : ''} — snapshot and delete, or schedule deletion to stop storage charges.`,
    items: stoppedRds.map(d => ({
      id: d.DBInstanceIdentifier,
      name: d.DBInstanceIdentifier,
      detail: `${d.DBInstanceClass} · ${d.Engine} · ${d.AllocatedStorage} GB`,
      az: d.AvailabilityZone,
      status: 'waste',
      reason: 'Stopped — still incurring storage cost, auto-restarts in 7 days',
      estimatedCost: (d.AllocatedStorage ?? 20) * 0.115,
    })),
  });

  // 6. Idle NAT Gateways (no route points to them)
  const idleNats = nats.filter(n => !routedNats.has(n.NatGatewayId));
  categories.push({
    id: 'idle-nat', severity: 'waste',
    title: 'Idle NAT Gateways',
    description: 'NAT gateways not referenced by any route table — likely forgotten.',
    icon: 'arrow-right-left',
    suggestion: `${idleNats.length} idle NAT gateway${idleNats.length !== 1 ? 's' : ''} — delete if no longer needed (~$32/mo each in hourly + data charges).`,
    items: idleNats.map(n => ({
      id: n.NatGatewayId,
      name: getName(n.Tags, n.NatGatewayId),
      detail: `Subnet: ${n.SubnetId} · VPC: ${n.VpcId}`,
      az: region,
      status: 'waste',
      reason: 'No route table references this NAT gateway',
      estimatedCost: 32.40,
    })),
  });

  // 7. Orphaned EBS snapshots (source volume deleted)
  const orphanedSnaps = snapshots.filter(s =>
    s.VolumeId && !activeVolumeIds.has(s.VolumeId) && new Date(s.StartTime) < THIRTY_DAYS_AGO
  );
  categories.push({
    id: 'orphaned-snapshots', severity: 'idle',
    title: 'Orphaned EBS Snapshots',
    description: 'Snapshots whose source volume has been deleted. Kept indefinitely unless manually removed.',
    icon: 'camera',
    suggestion: `${orphanedSnaps.length} orphaned snapshot${orphanedSnaps.length !== 1 ? 's' : ''} from deleted volumes — review and delete to save on storage.`,
    items: orphanedSnaps.slice(0, 30).map(s => ({
      id: s.SnapshotId,
      name: s.SnapshotId,
      detail: `${s.VolumeSize} GB · source volume deleted · ${new Date(s.StartTime).toLocaleDateString()}`,
      az: region,
      status: 'idle',
      reason: `Source volume ${s.VolumeId} no longer exists`,
      estimatedCost: (s.VolumeSize ?? 0) * 0.05,
    })),
  });

  // 8. Unused AMIs (not used by any current instance)
  const unusedAmis = images.filter(i => !usedImageIds.has(i.ImageId) && new Date(i.CreationDate) < NINETY_DAYS_AGO);
  categories.push({
    id: 'unused-amis', severity: 'idle',
    title: 'Unused Custom AMIs',
    description: 'Self-owned AMIs not used by any current instance, older than 90 days.',
    icon: 'package',
    suggestion: `${unusedAmis.length} unused AMI${unusedAmis.length !== 1 ? 's' : ''} — deregister and delete backing snapshots to reclaim storage.`,
    items: unusedAmis.map(i => ({
      id: i.ImageId,
      name: i.Name || i.ImageId,
      detail: `${i.Architecture} · created ${new Date(i.CreationDate).toLocaleDateString()}`,
      az: region,
      status: 'idle',
      reason: 'Not used by any running or stopped instance',
      estimatedCost: 0.50,
    })),
  });

  // 9. Empty CloudWatch Log Groups
  const emptyLogGroups = logGroups.filter(lg => (lg.storedBytes ?? 0) === 0);
  categories.push({
    id: 'empty-log-groups', severity: 'idle',
    title: 'Empty CloudWatch Log Groups',
    description: 'Log groups with zero stored data — likely from services no longer running.',
    icon: 'scroll-text',
    suggestion: `${emptyLogGroups.length} empty log group${emptyLogGroups.length !== 1 ? 's' : ''} — delete to reduce clutter (no cost, but hygiene).`,
    items: emptyLogGroups.map(lg => ({
      id: lg.logGroupName,
      name: lg.logGroupName,
      detail: `Created ${new Date(lg.creationTime).toLocaleDateString()} · ${lg.retentionInDays ? `${lg.retentionInDays}d retention` : 'no expiry'}`,
      az: region,
      status: 'idle',
      reason: '0 bytes stored — no logs ever written or already expired',
      estimatedCost: 0,
    })),
  });

  // 10. Unused Security Groups (not attached to any ENI or instance)
  const unusedSgs = (volsR.value ? [] : []);
  // Re-fetch SGs specifically
  const { EC2Client: _EC2, DescribeSecurityGroupsCommand } = require('@aws-sdk/client-ec2');
  let allSgs = [];
  try {
    const sgRes = await ec2.send(new (require('@aws-sdk/client-ec2').DescribeSecurityGroupsCommand)({}));
    allSgs = sgRes.SecurityGroups ?? [];
  } catch (_) {}
  const unattachedSgs = allSgs.filter(sg => sg.GroupName !== 'default' && !attachedSgIds.has(sg.GroupId));
  categories.push({
    id: 'unused-sgs', severity: 'security',
    title: 'Unused Security Groups',
    description: 'Security groups not attached to any ENI or instance. Dead rules that clutter your network posture.',
    icon: 'shield',
    suggestion: `${unattachedSgs.length} security group${unattachedSgs.length !== 1 ? 's' : ''} not in use — review and delete to reduce attack surface.`,
    items: unattachedSgs.map(sg => ({
      id: sg.GroupId,
      name: sg.GroupName,
      detail: `${sg.Description} · VPC: ${sg.VpcId}`,
      az: region,
      status: 'security',
      reason: 'Not attached to any network interface or instance',
      estimatedCost: 0,
    })),
  });

  // 11. Inactive IAM Roles (not used in 90+ days)
  const inactiveRoles = iamRoles.filter(r => {
    if (!r.RoleLastUsed?.LastUsedDate) return true; // never used
    return new Date(r.RoleLastUsed.LastUsedDate) < NINETY_DAYS_AGO;
  }).filter(r => !r.Path?.startsWith('/aws-service-role/')); // skip AWS-managed service roles
  categories.push({
    id: 'inactive-iam', severity: 'security',
    title: 'Inactive IAM Roles',
    description: 'Roles not used in 90+ days. Standing permissions that may no longer be needed.',
    icon: 'user-x',
    suggestion: `${inactiveRoles.length} IAM role${inactiveRoles.length !== 1 ? 's' : ''} unused for 90+ days — review and remove excess permissions (least privilege).`,
    items: inactiveRoles.slice(0, 20).map(r => ({
      id: r.RoleId,
      name: r.RoleName,
      detail: r.RoleLastUsed?.LastUsedDate
        ? `Last used: ${new Date(r.RoleLastUsed.LastUsedDate).toLocaleDateString()} in ${r.RoleLastUsed.Region ?? 'unknown'}`
        : 'Never used',
      az: 'global',
      status: 'security',
      reason: r.RoleLastUsed?.LastUsedDate ? 'Not used in 90+ days' : 'Never been used',
      estimatedCost: 0,
    })),
  });

  // ── Filter out empty categories ─────────────────────────────────────────
  const activeCategories = categories.filter(c => c.items.length > 0);

  // ── Score ───────────────────────────────────────────────────────────────
  const score = calcScore(activeCategories);

  // ── Summary ─────────────────────────────────────────────────────────────
  const allItems = activeCategories.flatMap(c => c.items);
  const summary = {
    waste:    allItems.filter(i => i.status === 'waste').length,
    idle:     allItems.filter(i => i.status === 'idle').length,
    security: allItems.filter(i => i.status === 'security').length,
    total:    allItems.length,
    healthy:  Math.max(0, instances.filter(i => i.State?.Name === 'running').length + rdsInstances.filter(d => d.DBInstanceStatus === 'available').length),
  };

  // ── Cleanup suggestions (sorted by priority then cost) ───────────────────
  const suggestions = activeCategories
    .map(c => {
      const totalCost = c.items.reduce((s, i) => s + (i.estimatedCost ?? 0), 0);
      return {
        priority: c.severity === 'waste' ? 'high' : c.severity === 'idle' ? 'medium' : 'low',
        categoryId: c.id,
        message: c.suggestion,
        count: c.items.length,
        estimatedMonthlySavings: totalCost,
      };
    })
    .sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return (p[a.priority] - p[b.priority]) || (b.estimatedMonthlySavings - a.estimatedMonthlySavings);
    });

  // ── Region/AZ breakdown ─────────────────────────────────────────────────
  const azBreakdown = {};
  for (const item of allItems) {
    const az = item.az || region;
    if (!azBreakdown[az]) azBreakdown[az] = { waste: 0, idle: 0, security: 0 };
    azBreakdown[az][item.status] = (azBreakdown[az][item.status] ?? 0) + 1;
  }

  res.json({
    score,
    summary,
    categories: activeCategories,
    suggestions,
    azBreakdown,
    region,
    scannedAt: new Date().toISOString(),
  });
});

module.exports = router;
