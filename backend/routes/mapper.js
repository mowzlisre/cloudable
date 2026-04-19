const router = require('express').Router();
const {
  EC2Client,
  DescribeVpcsCommand, DescribeSubnetsCommand, DescribeInstancesCommand,
  DescribeSecurityGroupsCommand, DescribeInternetGatewaysCommand,
  DescribeNatGatewaysCommand, DescribeAddressesCommand, DescribeRouteTablesCommand,
} = require('@aws-sdk/client-ec2');
const { RDSClient, DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const {
  ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand, DescribeTargetHealthCommand,
} = require('@aws-sdk/client-elastic-load-balancing-v2');
const { LambdaClient, ListFunctionsCommand } = require('@aws-sdk/client-lambda');
const { ECSClient, ListClustersCommand, ListServicesCommand, DescribeServicesCommand } = require('@aws-sdk/client-ecs');
const { CloudFrontClient, ListDistributionsCommand } = require('@aws-sdk/client-cloudfront');

// Rough monthly on-demand pricing (Linux, us-east-1)
const EC2_MONTHLY = {
  't2.nano':4.18,'t2.micro':8.47,'t2.small':16.94,'t2.medium':33.87,'t2.large':67.74,'t2.xlarge':135.48,'t2.2xlarge':270.96,
  't3.nano':3.80,'t3.micro':7.59,'t3.small':15.18,'t3.medium':30.37,'t3.large':60.74,'t3.xlarge':121.47,'t3.2xlarge':242.94,
  't3a.nano':3.39,'t3a.micro':6.79,'t3a.small':13.58,'t3a.medium':27.14,'t3a.large':54.29,
  't4g.nano':3.07,'t4g.micro':6.13,'t4g.small':12.26,'t4g.medium':24.53,'t4g.large':49.06,
  'm5.large':70.08,'m5.xlarge':140.16,'m5.2xlarge':280.32,'m5.4xlarge':560.64,
  'm6i.large':70.08,'m6i.xlarge':140.16,'m6i.2xlarge':280.32,
  'c5.large':62.05,'c5.xlarge':124.10,'c5.2xlarge':248.20,'c5.4xlarge':496.39,
  'c6i.large':58.97,'c6i.xlarge':117.94,'c6i.2xlarge':235.87,
  'r5.large':91.98,'r5.xlarge':183.96,'r5.2xlarge':367.92,
  'r6i.large':91.98,'r6i.xlarge':183.96,
};

const RDS_MONTHLY = {
  'db.t3.micro':12.41,'db.t3.small':24.82,'db.t3.medium':49.64,'db.t3.large':99.28,
  'db.t4g.micro':10.37,'db.t4g.small':20.74,'db.t4g.medium':41.47,'db.t4g.large':82.94,
  'db.m5.large':120.24,'db.m5.xlarge':240.48,'db.m5.2xlarge':480.96,
  'db.m6g.large':108.22,'db.m6g.xlarge':216.43,
  'db.r5.large':170.52,'db.r5.xlarge':341.04,
};

router.get('/', async (req, res) => {
  const region = req.query.region || process.env.AWS_REGION || 'us-east-1';
  const credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };

  const ec2 = new EC2Client({ region, credentials });
  const rds = new RDSClient({ region, credentials });
  const elb = new ElasticLoadBalancingV2Client({ region, credentials });
  const lambda = new LambdaClient({ region, credentials });
  const ecs = new ECSClient({ region, credentials });
  const cf = new CloudFrontClient({ region: 'us-east-1', credentials });

  const [vpcsR, subnetsR, instancesR, sgsR, igwsR, natsR, eipsR, routeTablesR, rdsR, lbsR, lambdaR, cfR, ecsClustersR] =
    await Promise.allSettled([
      ec2.send(new DescribeVpcsCommand({})),
      ec2.send(new DescribeSubnetsCommand({})),
      ec2.send(new DescribeInstancesCommand({ Filters: [{ Name: 'instance-state-name', Values: ['running', 'stopped'] }] })),
      ec2.send(new DescribeSecurityGroupsCommand({})),
      ec2.send(new DescribeInternetGatewaysCommand({})),
      ec2.send(new DescribeNatGatewaysCommand({ Filter: [{ Name: 'state', Values: ['available'] }] })),
      ec2.send(new DescribeAddressesCommand({})),
      ec2.send(new DescribeRouteTablesCommand({})),
      rds.send(new DescribeDBInstancesCommand({})),
      elb.send(new DescribeLoadBalancersCommand({})),
      lambda.send(new ListFunctionsCommand({ MaxItems: 100 })),
      cf.send(new ListDistributionsCommand({})),
      ecs.send(new ListClustersCommand({})),
    ]);

  const vpcs         = vpcsR.value?.Vpcs ?? [];
  const subnets      = subnetsR.value?.Subnets ?? [];
  const instances    = instancesR.value?.Reservations?.flatMap(r => r.Instances) ?? [];
  const securityGroups = sgsR.value?.SecurityGroups ?? [];
  const igws         = igwsR.value?.InternetGateways ?? [];
  const nats         = natsR.value?.NatGateways ?? [];
  const eips         = eipsR.value?.Addresses ?? [];
  const routeTables  = routeTablesR.value?.RouteTables ?? [];
  const rdsInstances = rdsR.value?.DBInstances ?? [];
  const lbs          = lbsR.value?.LoadBalancers ?? [];
  const lambdaFns    = lambdaR.value?.Functions ?? [];
  const cfDists      = cfR.value?.DistributionList?.Items ?? [];
  const clusterArns  = ecsClustersR.value?.clusterArns ?? [];

  // ECS: sequential per cluster
  const ecsServices = [];
  for (const clusterArn of clusterArns.slice(0, 8)) {
    try {
      const svcR = await ecs.send(new ListServicesCommand({ cluster: clusterArn, maxResults: 50 }));
      const arns = svcR?.serviceArns ?? [];
      if (!arns.length) continue;
      const descR = await ecs.send(new DescribeServicesCommand({ cluster: clusterArn, services: arns.slice(0, 10) }));
      ecsServices.push(...(descR?.services ?? []));
    } catch (_) {}
  }

  // ── Public subnet detection ──────────────────────────────────────────────
  const publicSubnetIds = new Set();
  const mainRTs = {};
  for (const rt of routeTables) {
    const hasIgw = (rt.Routes ?? []).some(r => r.GatewayId?.startsWith('igw-') && r.DestinationCidrBlock === '0.0.0.0/0');
    if ((rt.Associations ?? []).some(a => a.Main)) mainRTs[rt.VpcId] = { hasIgw };
    if (hasIgw) {
      for (const a of (rt.Associations ?? [])) { if (a.SubnetId) publicSubnetIds.add(a.SubnetId); }
    }
  }
  for (const s of subnets) {
    const hasExplicit = routeTables.some(rt => (rt.Associations ?? []).some(a => a.SubnetId === s.SubnetId && !a.Main));
    if (!hasExplicit && mainRTs[s.VpcId]?.hasIgw) publicSubnetIds.add(s.SubnetId);
  }

  // ── ALB → EC2 target mapping ─────────────────────────────────────────────
  const lbTargets = {};
  for (const lb of lbs) {
    try {
      const tgs = await elb.send(new DescribeTargetGroupsCommand({ LoadBalancerArn: lb.LoadBalancerArn }));
      lbTargets[lb.LoadBalancerArn] = [];
      for (const tg of (tgs.TargetGroups ?? [])) {
        const h = await elb.send(new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn }));
        for (const t of (h.TargetHealthDescriptions ?? [])) {
          if (t.Target?.Id?.startsWith('i-')) lbTargets[lb.LoadBalancerArn].push(t.Target.Id);
        }
      }
    } catch (_) {}
  }

  const getName = (tags, fallback) => tags?.find(t => t.Key === 'Name')?.Value || fallback;

  // ── Nodes ────────────────────────────────────────────────────────────────
  const nodes = [];

  nodes.push({ id: '__internet__', type: 'internet', label: 'Internet', data: {} });

  for (const v of vpcs) {
    nodes.push({ id: v.VpcId, type: 'vpc', label: getName(v.Tags, v.VpcId),
      data: { cidr: v.CidrBlock, isDefault: v.IsDefault, vpcId: v.VpcId } });
  }

  for (const s of subnets) {
    nodes.push({ id: s.SubnetId, type: 'subnet', label: getName(s.Tags, s.SubnetId),
      data: { cidr: s.CidrBlock, az: s.AvailabilityZone, isPublic: publicSubnetIds.has(s.SubnetId), vpcId: s.VpcId } });
  }

  for (const igw of igws) {
    nodes.push({ id: igw.InternetGatewayId, type: 'igw', label: getName(igw.Tags, 'Internet Gateway'),
      data: { vpcId: igw.Attachments?.[0]?.VpcId, estimatedCost: 0 } });
  }

  for (const nat of nats) {
    nodes.push({ id: nat.NatGatewayId, type: 'nat', label: getName(nat.Tags, 'NAT Gateway'),
      data: { subnetId: nat.SubnetId, vpcId: nat.VpcId, publicIp: nat.NatGatewayAddresses?.[0]?.PublicIp, estimatedCost: 32.40 } });
  }

  for (const eip of eips) {
    if (!eip.InstanceId && !eip.AssociationId) continue;
    const ai = instances.find(i => i.InstanceId === eip.InstanceId);
    nodes.push({ id: eip.AllocationId || `eip-${eip.PublicIp}`, type: 'eip', label: eip.PublicIp,
      data: { instanceId: eip.InstanceId, privateIp: eip.PrivateIpAddress, vpcId: ai?.VpcId ?? null, estimatedCost: 3.65 } });
  }

  for (const inst of instances) {
    const stopped = inst.State?.Name === 'stopped';
    nodes.push({ id: inst.InstanceId, type: 'ec2', label: getName(inst.Tags, inst.InstanceId),
      data: {
        instanceType: inst.InstanceType, state: inst.State?.Name,
        platform: inst.Platform || 'linux', privateIp: inst.PrivateIpAddress,
        publicIp: inst.PublicIpAddress, subnetId: inst.SubnetId, vpcId: inst.VpcId,
        sgIds: (inst.SecurityGroups ?? []).map(sg => sg.GroupId),
        estimatedCost: EC2_MONTHLY[inst.InstanceType] ?? null,
        isDisabled: stopped,
        hasIssue: stopped, issueType: stopped ? 'waste' : null,
        issueLabel: stopped ? 'Stopped — still billed for EBS & EIP' : null,
      },
    });
  }

  for (const db of rdsInstances) {
    const single   = !db.MultiAZ;
    const inactive = !['available', 'backing-up', 'modifying'].includes(db.DBInstanceStatus);
    nodes.push({ id: `rds-${db.DBInstanceIdentifier}`, type: 'rds', label: db.DBInstanceIdentifier,
      data: {
        engine: `${db.Engine} ${db.EngineVersion}`, instanceClass: db.DBInstanceClass,
        status: db.DBInstanceStatus, endpoint: db.Endpoint?.Address, port: db.Endpoint?.Port,
        multiAz: db.MultiAZ, vpcId: db.DBSubnetGroup?.VpcId,
        sgIds: (db.VpcSecurityGroups ?? []).map(sg => sg.VpcSecurityGroupId),
        estimatedCost: RDS_MONTHLY[db.DBInstanceClass] ?? null,
        isDisabled: inactive,
        hasIssue: single && !inactive, issueType: single && !inactive ? 'idle' : null,
        issueLabel: single && !inactive ? 'Single-AZ — no automatic failover' : null,
      },
    });
  }

  for (const lb of lbs) {
    const noTargets = !(lbTargets[lb.LoadBalancerArn] ?? []).length;
    const lbInactive = lb.State?.Code !== 'active';
    nodes.push({ id: lb.LoadBalancerArn, type: 'alb', label: lb.LoadBalancerName,
      data: {
        lbType: lb.Type, scheme: lb.Scheme, dns: lb.DNSName, state: lb.State?.Code,
        vpcId: lb.VpcId, estimatedCost: 22.27,
        isDisabled: lbInactive,
        hasIssue: noTargets && !lbInactive, issueType: noTargets && !lbInactive ? 'waste' : null,
        issueLabel: noTargets && !lbInactive ? 'No registered targets' : null,
      },
    });
  }

  for (const fn of lambdaFns) {
    nodes.push({ id: `lambda-${fn.FunctionName}`, type: 'lambda', label: fn.FunctionName,
      data: {
        runtime: fn.Runtime, memorySize: `${fn.MemorySize} MB`, timeout: `${fn.Timeout}s`,
        handler: fn.Handler, codeSize: `${Math.round(fn.CodeSize / 1024)} KB`,
        vpcId: fn.VpcConfig?.VpcId ?? null,
        sgIds: fn.VpcConfig?.SecurityGroupIds ?? [],
        estimatedCost: null,
      },
    });
  }

  for (const svc of ecsServices) {
    const awsvpc = svc.networkConfiguration?.awsvpcConfiguration;
    const vpcId = awsvpc?.subnets?.[0]
      ? (subnets.find(s => s.SubnetId === awsvpc.subnets[0])?.VpcId ?? null)
      : null;
    const under    = svc.runningCount < svc.desiredCount;
    const inactive = svc.status !== 'ACTIVE';
    nodes.push({ id: svc.serviceArn, type: 'ecs', label: svc.serviceName,
      data: {
        cluster: svc.clusterArn?.split('/').pop() ?? '', launchType: svc.launchType ?? 'FARGATE',
        desiredCount: svc.desiredCount, runningCount: svc.runningCount,
        status: svc.status, vpcId,
        sgIds: awsvpc?.securityGroups ?? [],
        estimatedCost: null,
        isDisabled: inactive,
        hasIssue: under && !inactive, issueType: under && !inactive ? 'idle' : null,
        issueLabel: under && !inactive ? `Running ${svc.runningCount}/${svc.desiredCount} desired` : null,
      },
    });
  }

  for (const dist of cfDists) {
    nodes.push({ id: dist.Id, type: 'cloudfront', label: dist.Comment || dist.DomainName?.split('.')[0] || dist.Id,
      data: {
        domainName: dist.DomainName, status: dist.Status, enabled: dist.Enabled,
        origins: (dist.Origins?.Items ?? []).map(o => o.DomainName).join(', '),
        priceClass: dist.PriceClass, vpcId: null, estimatedCost: null,
        isDisabled: !dist.Enabled,
      },
    });
  }

  // ── Edges ────────────────────────────────────────────────────────────────
  const edges = [];
  const seen = new Set();
  function addEdge(e) {
    const k = `${e.source}→${e.target}`;
    if (!seen.has(k)) { seen.add(k); edges.push(e); }
  }

  for (const igw of igws) {
    addEdge({ id: `e-inet-${igw.InternetGatewayId}`, source: '__internet__', target: igw.InternetGatewayId, edgeType: 'internet', label: 'Public traffic' });
  }

  for (const dist of cfDists) {
    addEdge({ id: `e-inet-cf-${dist.Id}`, source: '__internet__', target: dist.Id, edgeType: 'internet', label: 'CDN' });
    for (const origin of (dist.Origins?.Items ?? [])) {
      const match = lbs.find(lb => lb.DNSName && origin.DomainName.includes(lb.DNSName.split('.')[0]));
      if (match) addEdge({ id: `e-cf-${dist.Id}-${match.LoadBalancerArn}`, source: dist.Id, target: match.LoadBalancerArn, edgeType: 'alb', label: 'Origin' });
    }
  }

  for (const eip of eips) {
    const eipId = eip.AllocationId || `eip-${eip.PublicIp}`;
    if (!eip.InstanceId && !eip.AssociationId) continue;
    const inst = instances.find(i => i.InstanceId === eip.InstanceId);
    if (inst) {
      const igw = igws.find(i => i.Attachments?.[0]?.VpcId === inst.VpcId);
      if (igw) addEdge({ id: `e-igw-eip-${eipId}`, source: igw.InternetGatewayId, target: eipId, edgeType: 'internet', label: 'Public IP' });
      addEdge({ id: `e-eip-ec2-${eip.InstanceId}`, source: eipId, target: eip.InstanceId, edgeType: 'eip', label: 'Elastic IP' });
    }
  }

  for (const inst of instances) {
    if (inst.PublicIpAddress && !eips.find(e => e.InstanceId === inst.InstanceId)) {
      const igw = igws.find(i => i.Attachments?.[0]?.VpcId === inst.VpcId);
      if (igw) addEdge({ id: `e-igw-ec2-${inst.InstanceId}`, source: igw.InternetGatewayId, target: inst.InstanceId, edgeType: 'internet', label: 'Public IP' });
    }
  }

  for (const nat of nats) {
    const igw = igws.find(i => i.Attachments?.[0]?.VpcId === nat.VpcId);
    if (igw) addEdge({ id: `e-nat-igw-${nat.NatGatewayId}`, source: nat.NatGatewayId, target: igw.InternetGatewayId, edgeType: 'nat', label: 'Outbound' });
  }

  for (const lb of lbs) {
    for (const id of (lbTargets[lb.LoadBalancerArn] ?? [])) {
      addEdge({ id: `e-alb-${lb.LoadBalancerArn}-${id}`, source: lb.LoadBalancerArn, target: id, edgeType: 'alb', label: 'Target' });
    }
    if (lb.Scheme === 'internet-facing') {
      const igw = igws.find(i => i.Attachments?.[0]?.VpcId === lb.VpcId);
      if (igw) addEdge({ id: `e-igw-alb-${lb.LoadBalancerArn}`, source: igw.InternetGatewayId, target: lb.LoadBalancerArn, edgeType: 'internet', label: 'Public' });
    }
  }

  // Security group rules → resource-to-resource + open-internet
  const sgMap = new Map();
  const reg = (sgId, nodeId) => { if (!sgMap.has(sgId)) sgMap.set(sgId, []); sgMap.get(sgId).push(nodeId); };
  for (const inst of instances) for (const sg of (inst.SecurityGroups ?? [])) reg(sg.GroupId, inst.InstanceId);
  for (const db of rdsInstances) for (const sg of (db.VpcSecurityGroups ?? [])) reg(sg.VpcSecurityGroupId, `rds-${db.DBInstanceIdentifier}`);
  for (const fn of lambdaFns) for (const sg of (fn.VpcConfig?.SecurityGroupIds ?? [])) reg(sg, `lambda-${fn.FunctionName}`);
  for (const svc of ecsServices) for (const sg of (svc.networkConfiguration?.awsvpcConfiguration?.securityGroups ?? [])) reg(sg, svc.serviceArn);

  for (const sg of securityGroups) {
    const targets = sgMap.get(sg.GroupId) ?? [];
    if (!targets.length) continue;
    for (const rule of (sg.IpPermissions ?? [])) {
      for (const pair of (rule.UserIdGroupPairs ?? [])) {
        const sources = sgMap.get(pair.GroupId) ?? [];
        const proto = rule.IpProtocol === '-1' ? 'All' : rule.IpProtocol?.toUpperCase();
        const port = rule.FromPort != null ? (rule.FromPort === rule.ToPort ? `:${rule.FromPort}` : `:${rule.FromPort}-${rule.ToPort}`) : '';
        for (const src of sources) for (const tgt of targets) {
          if (src !== tgt) addEdge({ id: `e-sg-${sg.GroupId}-${src}-${tgt}`, source: src, target: tgt, edgeType: 'sg', label: `${proto}${port}` });
        }
      }
      for (const cidr of (rule.IpRanges ?? [])) {
        if (cidr.CidrIp !== '0.0.0.0/0' && cidr.CidrIp !== '::/0') continue;
        const proto = rule.IpProtocol === '-1' ? 'All' : rule.IpProtocol?.toUpperCase();
        const port = rule.FromPort != null ? `:${rule.FromPort}` : '';
        for (const tgt of targets) {
          const vpcId = nodes.find(n => n.id === tgt)?.data?.vpcId;
          const igw = igws.find(i => i.Attachments?.[0]?.VpcId === vpcId);
          if (igw) addEdge({ id: `e-open-${sg.GroupId}-${tgt}`, source: igw.InternetGatewayId, target: tgt, edgeType: 'open', label: `Open ${proto}${port}` });
        }
      }
    }
  }

  // Flag nodes targeted by open SG rules as security issues
  const openTargets = new Set(edges.filter(e => e.edgeType === 'open').map(e => e.target));
  for (const node of nodes) {
    if (openTargets.has(node.id) && !node.data.hasIssue) {
      node.data.hasIssue = true;
      node.data.issueType = 'security';
      node.data.issueLabel = 'Security group open to 0.0.0.0/0';
    }
  }

  res.json({ nodes, edges, region, scannedAt: new Date().toISOString() });
});

module.exports = router;
