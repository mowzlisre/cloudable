const router = require('express').Router();
const { EC2Client, DescribeVolumesCommand, DescribeAddressesCommand, DescribeInstancesCommand, DescribeSnapshotsCommand, DescribeImagesCommand } = require('@aws-sdk/client-ec2');
const { RDSClient, DescribeDBInstancesCommand, DescribeDBSnapshotsCommand } = require('@aws-sdk/client-rds');
const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand, DescribeTargetGroupsCommand, DescribeTargetHealthCommand } = require('@aws-sdk/client-elastic-load-balancing-v2');
const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');

router.get('/', async (req, res) => {
  const region = process.env.AWS_REGION || 'us-east-1';
  const credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };

  const ec2 = new EC2Client({ region, credentials });
  const rds = new RDSClient({ region, credentials });
  const elb = new ElasticLoadBalancingV2Client({ region, credentials });
  const ce = new CostExplorerClient({ region: 'us-east-1', credentials });

  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const ninetyDaysAgo = new Date(now); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [
    volumesRes, addressesRes, instancesRes, snapshotsRes, imagesRes,
    rdsInstancesRes, rdsSnapshotsRes, lbsRes, ceRes,
  ] = await Promise.allSettled([
    ec2.send(new DescribeVolumesCommand({ Filters: [{ Name: 'status', Values: ['available'] }] })),
    ec2.send(new DescribeAddressesCommand({})),
    ec2.send(new DescribeInstancesCommand({ Filters: [{ Name: 'instance-state-name', Values: ['stopped'] }] })),
    ec2.send(new DescribeSnapshotsCommand({ OwnerIds: ['self'] })),
    ec2.send(new DescribeImagesCommand({ Owners: ['self'] })),
    rds.send(new DescribeDBInstancesCommand({})),
    rds.send(new DescribeDBSnapshotsCommand({ SnapshotType: 'manual' })),
    elb.send(new DescribeLoadBalancersCommand({})),
    ce.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: startOfMonth, End: tomorrowStr },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    })),
  ]);

  const categories = [];
  let totalEstimatedWaste = 0;

  function addCategory(category) {
    if (category.count > 0) {
      categories.push(category);
      totalEstimatedWaste += category.estimatedMonthlyCost;
    }
  }

  // 1. Unattached EBS volumes
  if (volumesRes.status === 'fulfilled') {
    const volumes = volumesRes.value.Volumes || [];
    const items = volumes.map(v => ({
      id: v.VolumeId,
      description: `${v.VolumeType?.toUpperCase()} — ${v.Size} GB`,
      detail: `Created ${new Date(v.CreateTime).toLocaleDateString()}`,
      estimatedMonthlyCost: v.Size * 0.10,
    }));
    const total = items.reduce((s, i) => s + i.estimatedMonthlyCost, 0);
    addCategory({
      category: 'Unattached EBS Volumes',
      description: 'Block storage volumes not attached to any EC2 instance, accruing storage fees.',
      severity: total > 50 ? 'high' : total > 10 ? 'medium' : 'low',
      count: items.length,
      estimatedMonthlyCost: total,
      items,
    });
  }

  // 2. Unused Elastic IPs
  if (addressesRes.status === 'fulfilled') {
    const unused = (addressesRes.value.Addresses || []).filter(a => !a.InstanceId && !a.NetworkInterfaceId);
    const costPerIP = 3.65;
    const items = unused.map(a => ({
      id: a.AllocationId || a.PublicIp,
      description: `IP: ${a.PublicIp}`,
      detail: `Region: ${region}`,
      estimatedMonthlyCost: costPerIP,
    }));
    addCategory({
      category: 'Unused Elastic IPs',
      description: 'Elastic IP addresses allocated but not associated with any running instance.',
      severity: 'medium',
      count: items.length,
      estimatedMonthlyCost: items.length * costPerIP,
      items,
    });
  }

  // 3. Stopped EC2 instances (EBS still billing)
  if (instancesRes.status === 'fulfilled') {
    const instances = instancesRes.value.Reservations?.flatMap(r => r.Instances) || [];
    const items = instances.map(i => {
      const name = i.Tags?.find(t => t.Key === 'Name')?.Value || 'unnamed';
      const gbEstimate = (i.BlockDeviceMappings || []).length * 8;
      return {
        id: i.InstanceId,
        description: `${i.InstanceType} — ${name}`,
        detail: i.StateTransitionReason || 'Stopped',
        estimatedMonthlyCost: gbEstimate * 0.10,
      };
    });
    const total = items.reduce((s, i) => s + i.estimatedMonthlyCost, 0);
    addCategory({
      category: 'Stopped EC2 Instances',
      description: 'Stopped instances no longer charge for compute, but their EBS volumes still bill.',
      severity: 'low',
      count: items.length,
      estimatedMonthlyCost: total,
      items,
    });
  }

  // 4. Old EBS snapshots (>30 days)
  if (snapshotsRes.status === 'fulfilled') {
    const old = (snapshotsRes.value.Snapshots || []).filter(s => new Date(s.StartTime) < thirtyDaysAgo);
    const items = old.map(s => ({
      id: s.SnapshotId,
      description: `${s.VolumeSize} GB snapshot`,
      detail: `Created ${new Date(s.StartTime).toLocaleDateString()} — ${s.Description || 'no description'}`,
      estimatedMonthlyCost: (s.VolumeSize || 0) * 0.05,
    }));
    const total = items.reduce((s, i) => s + i.estimatedMonthlyCost, 0);
    addCategory({
      category: 'Aged EBS Snapshots',
      description: 'EBS snapshots older than 30 days. Old snapshots accumulate silently at $0.05/GB/month.',
      severity: total > 20 ? 'high' : 'medium',
      count: items.length,
      estimatedMonthlyCost: total,
      items: items.slice(0, 25),
    });
  }

  // 5. Old custom AMIs (>90 days)
  if (imagesRes.status === 'fulfilled') {
    const old = (imagesRes.value.Images || []).filter(i => new Date(i.CreationDate) < ninetyDaysAgo);
    const items = old.map(i => ({
      id: i.ImageId,
      description: i.Name || 'unnamed AMI',
      detail: `${i.Architecture} — created ${new Date(i.CreationDate).toLocaleDateString()}`,
      estimatedMonthlyCost: 0.50,
    }));
    addCategory({
      category: 'Old Custom AMIs',
      description: 'Self-owned AMIs older than 90 days. Each AMI stores snapshots you may no longer need.',
      severity: 'low',
      count: items.length,
      estimatedMonthlyCost: items.length * 0.50,
      items,
    });
  }

  // 6. Stopped RDS instances
  if (rdsInstancesRes.status === 'fulfilled') {
    const stopped = (rdsInstancesRes.value.DBInstances || []).filter(i => i.DBInstanceStatus === 'stopped');
    const items = stopped.map(i => ({
      id: i.DBInstanceIdentifier,
      description: `${i.DBInstanceClass} — ${i.Engine} ${i.EngineVersion}`,
      detail: `${i.AllocatedStorage} GB allocated — auto-restarts after 7 days`,
      estimatedMonthlyCost: (i.AllocatedStorage || 20) * 0.115,
    }));
    const total = items.reduce((s, i) => s + i.estimatedMonthlyCost, 0);
    addCategory({
      category: 'Stopped RDS Instances',
      description: 'Stopped RDS instances still charge for storage. AWS auto-restarts them after 7 days.',
      severity: 'high',
      count: items.length,
      estimatedMonthlyCost: total,
      items,
    });
  }

  // 7. Old RDS manual snapshots (>30 days)
  if (rdsSnapshotsRes.status === 'fulfilled') {
    const old = (rdsSnapshotsRes.value.DBSnapshots || []).filter(s => new Date(s.SnapshotCreateTime) < thirtyDaysAgo);
    const items = old.map(s => ({
      id: s.DBSnapshotIdentifier,
      description: `${s.DBInstanceIdentifier} — ${s.AllocatedStorage} GB`,
      detail: `Created ${new Date(s.SnapshotCreateTime).toLocaleDateString()}`,
      estimatedMonthlyCost: (s.AllocatedStorage || 20) * 0.095,
    }));
    const total = items.reduce((s, i) => s + i.estimatedMonthlyCost, 0);
    addCategory({
      category: 'Old RDS Manual Snapshots',
      description: 'Manual RDS snapshots older than 30 days sitting in storage at $0.095/GB/month.',
      severity: total > 20 ? 'high' : 'medium',
      count: items.length,
      estimatedMonthlyCost: total,
      items,
    });
  }

  // 8. Idle load balancers (no healthy targets)
  if (lbsRes.status === 'fulfilled') {
    const lbs = lbsRes.value.LoadBalancers || [];
    const idleLBs = [];
    for (const lb of lbs) {
      try {
        const tgs = await elb.send(new DescribeTargetGroupsCommand({ LoadBalancerArn: lb.LoadBalancerArn }));
        let hasHealthy = false;
        for (const tg of (tgs.TargetGroups || [])) {
          const health = await elb.send(new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn }));
          if ((health.TargetHealthDescriptions || []).some(t => t.TargetHealth?.State === 'healthy')) {
            hasHealthy = true;
            break;
          }
        }
        if (!hasHealthy) idleLBs.push(lb);
      } catch (_) { /* skip on permission error */ }
    }
    const costPerLB = 16.43;
    const items = idleLBs.map(lb => ({
      id: lb.LoadBalancerArn?.split('/').pop(),
      description: lb.LoadBalancerName,
      detail: `${lb.Type} — no healthy targets`,
      estimatedMonthlyCost: costPerLB,
    }));
    addCategory({
      category: 'Idle Load Balancers',
      description: 'Load balancers with no healthy targets — still billed at ~$16/month each.',
      severity: 'high',
      count: items.length,
      estimatedMonthlyCost: items.length * costPerLB,
      items,
    });
  }

  // 9. Data transfer & misc from Cost Explorer
  if (ceRes.status === 'fulfilled') {
    const groups = ceRes.value.ResultsByTime?.[0]?.Groups || [];

    const dataTransfer = groups.find(g => g.Keys[0] === 'AWS Data Transfer');
    if (dataTransfer) {
      const cost = parseFloat(dataTransfer.Metrics.UnblendedCost.Amount);
      if (cost > 1) {
        addCategory({
          category: 'Data Transfer Charges',
          description: 'Cross-region or internet egress data transfer. Often invisible until the bill arrives.',
          severity: cost > 50 ? 'high' : cost > 10 ? 'medium' : 'low',
          count: 1,
          estimatedMonthlyCost: cost,
          isActualCost: true,
          items: [{ id: 'data-transfer', description: 'AWS Data Transfer', detail: `$${cost.toFixed(2)} billed this month`, estimatedMonthlyCost: cost }],
        });
      }
    }

    const support = groups.find(g => g.Keys[0]?.startsWith('AWS Support'));
    if (support) {
      const cost = parseFloat(support.Metrics.UnblendedCost.Amount);
      if (cost > 0) {
        addCategory({
          category: 'AWS Support Plan',
          description: 'Verify your support tier matches your actual needs.',
          severity: 'low',
          count: 1,
          estimatedMonthlyCost: cost,
          isActualCost: true,
          items: [{ id: 'support', description: support.Keys[0], detail: `$${cost.toFixed(2)} this month`, estimatedMonthlyCost: cost }],
        });
      }
    }

    // Tax line items
    const tax = groups.find(g => g.Keys[0] === 'Tax');
    if (tax) {
      const cost = parseFloat(tax.Metrics.UnblendedCost.Amount);
      if (cost > 0) {
        addCategory({
          category: 'Tax',
          description: 'AWS taxes applied based on your billing address and account type.',
          severity: 'low',
          count: 1,
          estimatedMonthlyCost: cost,
          isActualCost: true,
          items: [{ id: 'tax', description: 'AWS Tax', detail: `$${cost.toFixed(2)} this month`, estimatedMonthlyCost: cost }],
        });
      }
    }
  }

  categories.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  res.json({ categories, totalEstimatedWaste, scannedAt: new Date().toISOString() });
});

module.exports = router;
