const router = require('express').Router();

const { EC2Client, DescribeVpcsCommand, DescribeSubnetsCommand, DescribeInstancesCommand,
  DescribeSecurityGroupsCommand, DescribeInternetGatewaysCommand, DescribeNatGatewaysCommand,
  DescribeAddressesCommand, DescribeRouteTablesCommand, DescribeVpcEndpointsCommand,
  DescribeVolumesCommand, DescribeNetworkInterfacesCommand } = require('@aws-sdk/client-ec2');
const { RDSClient, DescribeDBInstancesCommand, DescribeDBClustersCommand,
  DescribeDBProxiesCommand, DescribeDBProxyTargetsCommand } = require('@aws-sdk/client-rds');
const { ElasticLoadBalancingV2Client, DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand, DescribeTargetHealthCommand } = require('@aws-sdk/client-elastic-load-balancing-v2');
const { LambdaClient, ListFunctionsCommand, ListEventSourceMappingsCommand } = require('@aws-sdk/client-lambda');
const { ECSClient, ListClustersCommand, ListServicesCommand, DescribeServicesCommand } = require('@aws-sdk/client-ecs');
const { CloudFrontClient, ListDistributionsCommand } = require('@aws-sdk/client-cloudfront');
const { ElastiCacheClient, DescribeReplicationGroupsCommand, DescribeCacheClustersCommand } = require('@aws-sdk/client-elasticache');
const { APIGatewayClient, GetRestApisCommand } = require('@aws-sdk/client-api-gateway');
const { SQSClient, ListQueuesCommand } = require('@aws-sdk/client-sqs');
const { SNSClient, ListTopicsCommand, ListSubscriptionsCommand } = require('@aws-sdk/client-sns');
const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');
const { KafkaClient, ListClustersV2Command } = require('@aws-sdk/client-kafka');
const { KinesisClient, ListStreamsCommand } = require('@aws-sdk/client-kinesis');
const { Route53Client, ListHostedZonesCommand } = require('@aws-sdk/client-route-53');
const { S3Client, ListBucketsCommand, GetBucketNotificationConfigurationCommand } = require('@aws-sdk/client-s3');
const { EFSClient, DescribeFileSystemsCommand, DescribeMountTargetsCommand } = require('@aws-sdk/client-efs');
const { EventBridgeClient, ListRulesCommand, ListTargetsByRuleCommand } = require('@aws-sdk/client-eventbridge');
const { SFNClient, ListStateMachinesCommand, DescribeStateMachineCommand } = require('@aws-sdk/client-sfn');
const { WAFV2Client, ListWebACLsCommand, ListResourcesForWebACLCommand } = require('@aws-sdk/client-wafv2');
const { ECRClient, DescribeRepositoriesCommand } = require('@aws-sdk/client-ecr');
const { RedshiftClient, DescribeClustersCommand: DescribeRedshiftClustersCommand } = require('@aws-sdk/client-redshift');
const { OpenSearchClient, ListDomainNamesCommand, DescribeDomainsCommand } = require('@aws-sdk/client-opensearch');

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
  const cfg  = { region, credentials };
  const cfgG = { region: 'us-east-1', credentials };

  const ec2      = new EC2Client(cfg);
  const rds      = new RDSClient(cfg);
  const elb      = new ElasticLoadBalancingV2Client(cfg);
  const lambda   = new LambdaClient(cfg);
  const ecs      = new ECSClient(cfg);
  const cf       = new CloudFrontClient(cfgG);
  const ecache   = new ElastiCacheClient(cfg);
  const apigw    = new APIGatewayClient(cfg);
  const sqs      = new SQSClient(cfg);
  const sns      = new SNSClient(cfg);
  const ddb      = new DynamoDBClient(cfg);
  const kafka    = new KafkaClient(cfg);
  const kinesis  = new KinesisClient(cfg);
  const r53      = new Route53Client(cfgG);
  const s3       = new S3Client(cfgG);
  const efs      = new EFSClient(cfg);
  const eb       = new EventBridgeClient(cfg);
  const sfn      = new SFNClient(cfg);
  const waf      = new WAFV2Client(cfg);
  const wafG     = new WAFV2Client(cfgG);
  const ecr      = new ECRClient(cfg);
  const redshift = new RedshiftClient(cfg);
  const os       = new OpenSearchClient(cfg);

  // ── Phase 1: all parallel calls ─────────────────────────────────────────
  const [
    vpcsR, subnetsR, instancesR, sgsR, igwsR, natsR, eipsR, routeTablesR, vpceR,
    ebsR,
    rdsR, auroraR, rdsProxyR,
    lbsR, lambdaR, cfR, ecsClustersR,
    ecRedisR, ecMemR,
    apigwR, sqsR, snsR, snsSubsR,
    ddbR, kafkaR, kinesisR,
    esmR, r53R,
    s3R, efsR, ebRulesR, sfnR,
    wafR, wafGR,
    ecrR, redshiftR, osR,
  ] = await Promise.allSettled([
    ec2.send(new DescribeVpcsCommand({})),
    ec2.send(new DescribeSubnetsCommand({})),
    ec2.send(new DescribeInstancesCommand({ Filters: [{ Name: 'instance-state-name', Values: ['running','stopped'] }] })),
    ec2.send(new DescribeSecurityGroupsCommand({})),
    ec2.send(new DescribeInternetGatewaysCommand({})),
    ec2.send(new DescribeNatGatewaysCommand({ Filter: [{ Name: 'state', Values: ['available'] }] })),
    ec2.send(new DescribeAddressesCommand({})),
    ec2.send(new DescribeRouteTablesCommand({})),
    ec2.send(new DescribeVpcEndpointsCommand({ Filters: [{ Name: 'vpc-endpoint-state', Values: ['available'] }] })),
    ec2.send(new DescribeVolumesCommand({ Filters: [{ Name: 'status', Values: ['available'] }] })), // unattached only
    rds.send(new DescribeDBInstancesCommand({})),
    rds.send(new DescribeDBClustersCommand({})),
    rds.send(new DescribeDBProxiesCommand({})),
    elb.send(new DescribeLoadBalancersCommand({})),
    lambda.send(new ListFunctionsCommand({ MaxItems: 100 })),
    cf.send(new ListDistributionsCommand({})),
    ecs.send(new ListClustersCommand({})),
    ecache.send(new DescribeReplicationGroupsCommand({})),
    ecache.send(new DescribeCacheClustersCommand({ ShowCacheNodeInfo: false })),
    apigw.send(new GetRestApisCommand({ limit: 100 })),
    sqs.send(new ListQueuesCommand({ MaxResults: 50 })),
    sns.send(new ListTopicsCommand({})),
    sns.send(new ListSubscriptionsCommand({})),
    ddb.send(new ListTablesCommand({ Limit: 50 })),
    kafka.send(new ListClustersV2Command({ MaxResults: 20 })),
    kinesis.send(new ListStreamsCommand({ Limit: 20 })),
    lambda.send(new ListEventSourceMappingsCommand({ MaxItems: 100 })),
    r53.send(new ListHostedZonesCommand({})),
    s3.send(new ListBucketsCommand({})),
    efs.send(new DescribeFileSystemsCommand({ MaxItems: 30 })),
    eb.send(new ListRulesCommand({ Limit: 50 })),
    sfn.send(new ListStateMachinesCommand({ maxResults: 20 })),
    waf.send(new ListWebACLsCommand({ Scope: 'REGIONAL', Limit: 20 })),
    wafG.send(new ListWebACLsCommand({ Scope: 'CLOUDFRONT', Limit: 20 })),
    ecr.send(new DescribeRepositoriesCommand({ maxResults: 50 })),
    redshift.send(new DescribeRedshiftClustersCommand({ MaxRecords: 20 })),
    os.send(new ListDomainNamesCommand({})),
  ]);

  const vpcs           = vpcsR.value?.Vpcs ?? [];
  const subnets        = subnetsR.value?.Subnets ?? [];
  const instances      = instancesR.value?.Reservations?.flatMap(r => r.Instances) ?? [];
  const securityGroups = sgsR.value?.SecurityGroups ?? [];
  const igws           = igwsR.value?.InternetGateways ?? [];
  const nats           = natsR.value?.NatGateways ?? [];
  const eips           = eipsR.value?.Addresses ?? [];
  const routeTables    = routeTablesR.value?.RouteTables ?? [];
  const vpces          = vpceR.value?.VpcEndpoints ?? [];
  const unattachedEbs  = ebsR.value?.Volumes ?? [];
  const rdsInstances   = (rdsR.value?.DBInstances ?? []).filter(d => !d.DBClusterIdentifier);
  const auroraClusters = auroraR.value?.DBClusters ?? [];
  const rdsProxies     = rdsProxyR.value?.DBProxies ?? [];
  const lbs            = lbsR.value?.LoadBalancers ?? [];
  const lambdaFns      = lambdaR.value?.Functions ?? [];
  const cfDists        = cfR.value?.DistributionList?.Items ?? [];
  const clusterArns    = ecsClustersR.value?.clusterArns ?? [];
  const redisGroups    = ecRedisR.value?.ReplicationGroups ?? [];
  const memcached      = (ecMemR.value?.CacheClusters ?? []).filter(c => c.Engine === 'memcached');
  const restApis       = apigwR.value?.items ?? [];
  const sqsUrls        = sqsR.value?.QueueUrls ?? [];
  const snsTopics      = snsR.value?.Topics ?? [];
  const snsSubs        = snsSubsR.value?.Subscriptions ?? [];
  const ddbTables      = ddbR.value?.TableNames ?? [];
  const mskClusters    = kafkaR.value?.ClusterInfoList ?? [];
  const kinesisStreams  = kinesisR.value?.StreamNames ?? [];
  const eventSources   = esmR.value?.EventSourceMappings ?? [];
  const hostedZones    = r53R.value?.HostedZones ?? [];
  const s3Buckets      = s3R.value?.Buckets ?? [];
  const efsFileSystems = efsR.value?.FileSystems ?? [];
  const ebRules        = ebRulesR.value?.Rules ?? [];
  const sfnMachines    = sfnR.value?.stateMachines ?? [];
  const wafAcls        = [...(wafR.value?.WebACLs ?? []), ...(wafGR.value?.WebACLs ?? [])];
  const ecrRepos       = ecrR.value?.repositories ?? [];
  const redshiftClusters = redshiftR.value?.Clusters ?? [];
  const osDomainNames  = osR.value?.DomainNames ?? [];

  // ── Phase 2: ECS services ────────────────────────────────────────────────
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

  // ── Phase 2: ALB target mapping ──────────────────────────────────────────
  const lbTargets    = {};  // lbArn → [ec2InstanceId]
  const tgToLbArn    = {};  // targetGroupArn → lbArn  (used for ECS Fargate linkage)
  const lbHasTargets = {};  // lbArn → bool (any healthy/registered target, any type)
  for (const lb of lbs) {
    try {
      const tgs = await elb.send(new DescribeTargetGroupsCommand({ LoadBalancerArn: lb.LoadBalancerArn }));
      lbTargets[lb.LoadBalancerArn] = [];
      for (const tg of (tgs.TargetGroups ?? [])) {
        tgToLbArn[tg.TargetGroupArn] = lb.LoadBalancerArn;
        const h = await elb.send(new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn }));
        for (const t of (h.TargetHealthDescriptions ?? [])) {
          if (t.Target?.Id?.startsWith('i-')) {
            lbTargets[lb.LoadBalancerArn].push(t.Target.Id);
          }
          // Count any registered target (EC2 instance or Fargate IP) so hasIssue is correct
          lbHasTargets[lb.LoadBalancerArn] = true;
        }
      }
    } catch (_) {}
  }

  // ── Phase 2: ENI lookup for ALB-owned EIPs ──────────────────────────────
  // ALB EIPs have NetworkInterfaceId but no InstanceId; ENI description is
  // "ELB app/{lb-name}/{id}" — use this to build eniId → lbArn map
  const eniToLbArn = {};
  const albEniIds = eips.filter(e => e.NetworkInterfaceId && !e.InstanceId).map(e => e.NetworkInterfaceId);
  if (albEniIds.length) {
    try {
      const eniR = await ec2.send(new DescribeNetworkInterfacesCommand({ NetworkInterfaceIds: albEniIds }));
      for (const eni of (eniR?.NetworkInterfaces ?? [])) {
        // Description format: "ELB app/futrr-alb/abc123ef" or "ELB net/..."
        const m = eni.Description?.match(/^ELB (?:app|net|gateway)\/([^/]+)\//);
        if (m) {
          const lbName = m[1];
          const lb = lbs.find(l => l.LoadBalancerName === lbName);
          if (lb) eniToLbArn[eni.NetworkInterfaceId] = lb.LoadBalancerArn;
        }
      }
    } catch (_) {}
  }

  // ── Phase 2: EventBridge targets per rule ────────────────────────────────
  const ebTargets = {};
  await Promise.allSettled(ebRules.slice(0, 20).map(async rule => {
    try {
      const r = await eb.send(new ListTargetsByRuleCommand({ Rule: rule.Name, EventBusName: rule.EventBusName }));
      ebTargets[rule.Name] = r?.Targets ?? [];
    } catch (_) { ebTargets[rule.Name] = []; }
  }));

  // ── Phase 2: Step Functions definitions ──────────────────────────────────
  const sfnDefs = {};
  await Promise.allSettled(sfnMachines.slice(0, 10).map(async sm => {
    try {
      const r = await sfn.send(new DescribeStateMachineCommand({ stateMachineArn: sm.stateMachineArn }));
      sfnDefs[sm.stateMachineArn] = r?.definition ?? '';
    } catch (_) {}
  }));

  // ── Phase 2: EFS mount targets ───────────────────────────────────────────
  const efsMountTargets = {};
  await Promise.allSettled(efsFileSystems.slice(0, 20).map(async fs => {
    try {
      const r = await efs.send(new DescribeMountTargetsCommand({ FileSystemId: fs.FileSystemId }));
      efsMountTargets[fs.FileSystemId] = r?.MountTargets ?? [];
    } catch (_) { efsMountTargets[fs.FileSystemId] = []; }
  }));

  // ── Phase 2: RDS Proxy targets ───────────────────────────────────────────
  const proxyTargets = {};
  await Promise.allSettled(rdsProxies.slice(0, 10).map(async proxy => {
    try {
      const r = await rds.send(new DescribeDBProxyTargetsCommand({ DBProxyName: proxy.DBProxyName }));
      proxyTargets[proxy.DBProxyName] = r?.Targets ?? [];
    } catch (_) { proxyTargets[proxy.DBProxyName] = []; }
  }));

  // ── Phase 2: WAF associated resources ────────────────────────────────────
  const wafResources = {};
  await Promise.allSettled(wafAcls.slice(0, 10).map(async acl => {
    try {
      const scope = acl.ARN?.includes(':global:') || acl.ARN?.includes('::') ? 'CLOUDFRONT' : 'REGIONAL';
      const r = await (scope === 'CLOUDFRONT' ? wafG : waf).send(
        new ListResourcesForWebACLCommand({ WebACLArn: acl.ARN, ResourceType: 'APPLICATION_LOAD_BALANCER' })
      );
      wafResources[acl.ARN] = r?.ResourceArns ?? [];
    } catch (_) { wafResources[acl.ARN] = []; }
  }));

  // ── Phase 2: S3 bucket notifications ─────────────────────────────────────
  const s3Notifications = {};
  await Promise.allSettled(s3Buckets.slice(0, 20).map(async bucket => {
    try {
      const r = await s3.send(new GetBucketNotificationConfigurationCommand({ Bucket: bucket.Name }));
      s3Notifications[bucket.Name] = r?.LambdaFunctionConfigurations ?? [];
    } catch (_) { s3Notifications[bucket.Name] = []; }
  }));

  // ── Phase 2: OpenSearch domain details ───────────────────────────────────
  const osDomains = [];
  if (osDomainNames.length > 0) {
    try {
      const names = osDomainNames.slice(0, 5).map(d => d.DomainName);
      const r = await os.send(new DescribeDomainsCommand({ DomainNames: names }));
      osDomains.push(...(r?.DomainStatusList ?? []));
    } catch (_) {}
  }

  // ── Public subnet detection ───────────────────────────────────────────────
  const publicSubnetIds = new Set();
  const mainRTs = {};
  for (const rt of routeTables) {
    const hasIgw = (rt.Routes ?? []).some(r => r.GatewayId?.startsWith('igw-') && r.DestinationCidrBlock === '0.0.0.0/0');
    if ((rt.Associations ?? []).some(a => a.Main)) mainRTs[rt.VpcId] = { hasIgw };
    if (hasIgw) for (const a of (rt.Associations ?? [])) if (a.SubnetId) publicSubnetIds.add(a.SubnetId);
  }
  for (const s of subnets) {
    const hasExplicit = routeTables.some(rt => (rt.Associations ?? []).some(a => a.SubnetId === s.SubnetId && !a.Main));
    if (!hasExplicit && mainRTs[s.VpcId]?.hasIgw) publicSubnetIds.add(s.SubnetId);
  }

  const getName = (tags, fallback) => tags?.find(t => t.Key === 'Name')?.Value || fallback;
  const sqsNameFromUrl = url => url?.split('/').pop() ?? url;
  const snsNameFromArn = arn => arn?.split(':').pop() ?? arn;
  const kinesisNodeId  = name => `kinesis-${name}`;
  const sqsNodeId      = url  => `sqs-${sqsNameFromUrl(url)}`;
  const ddbNodeId      = name => `ddb-${name}`;
  const s3BucketName   = origin => { const m = origin?.match(/^([^.]+)\.s3[.-]/); return m?.[1] ?? null; };

  // ── Nodes ─────────────────────────────────────────────────────────────────
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

  // EIPs — include unattached ones (they cost $3.65/mo) and flag them
  for (const eip of eips) {
    const isAttached = !!(eip.InstanceId || eip.AssociationId);
    const ai = instances.find(i => i.InstanceId === eip.InstanceId);
    nodes.push({ id: eip.AllocationId || `eip-${eip.PublicIp}`, type: 'eip', label: eip.PublicIp,
      data: { instanceId: eip.InstanceId, privateIp: eip.PrivateIpAddress,
        vpcId: ai?.VpcId ?? null, estimatedCost: 3.65,
        hasIssue: !isAttached, issueType: !isAttached ? 'waste' : null,
        issueLabel: !isAttached ? 'Unattached — $3.65/mo with no association' : null } });
  }

  for (const vpce of vpces) {
    const serviceName = vpce.ServiceName?.split('.').pop() ?? vpce.ServiceName;
    nodes.push({ id: vpce.VpcEndpointId, type: 'vpce', label: serviceName,
      data: { endpointType: vpce.VpcEndpointType, serviceName: vpce.ServiceName,
        vpcId: vpce.VpcId, state: vpce.State, estimatedCost: null } });
  }

  // EBS unattached volumes (attached volumes are represented via EC2 nodes)
  for (const vol of unattachedEbs) {
    const cost = (vol.Size ?? 0) * 0.10;
    nodes.push({ id: `ebs-${vol.VolumeId}`, type: 'ebs', label: getName(vol.Tags, vol.VolumeId),
      data: { volumeId: vol.VolumeId, volumeType: vol.VolumeType, size: vol.Size,
        az: vol.AvailabilityZone, state: vol.State,
        vpcId: null, estimatedCost: cost,
        hasIssue: true, issueType: 'waste',
        issueLabel: `Unattached ${vol.Size}GB — ~$${cost.toFixed(0)}/mo` } });
  }

  for (const inst of instances) {
    const stopped = inst.State?.Name === 'stopped';
    nodes.push({ id: inst.InstanceId, type: 'ec2', label: getName(inst.Tags, inst.InstanceId),
      data: { instanceType: inst.InstanceType, state: inst.State?.Name,
        platform: inst.Platform || 'linux', privateIp: inst.PrivateIpAddress,
        publicIp: inst.PublicIpAddress, subnetId: inst.SubnetId, vpcId: inst.VpcId,
        sgIds: (inst.SecurityGroups ?? []).map(sg => sg.GroupId),
        estimatedCost: EC2_MONTHLY[inst.InstanceType] ?? null,
        isDisabled: stopped, hasIssue: stopped, issueType: stopped ? 'waste' : null,
        issueLabel: stopped ? 'Stopped — still billed for EBS & EIP' : null },
    });
  }

  for (const cl of auroraClusters) {
    const inactive = !['available','backing-up','modifying'].includes(cl.Status);
    nodes.push({ id: `aurora-${cl.DBClusterIdentifier}`, type: 'aurora', label: cl.DBClusterIdentifier,
      data: { engine: `${cl.Engine} ${cl.EngineVersion}`, status: cl.Status,
        endpoint: cl.Endpoint, readerEndpoint: cl.ReaderEndpoint,
        multiAz: cl.MultiAZ, vpcId: cl.DBSubnetGroup ? undefined : null,
        members: cl.DBClusterMembers?.length ?? 0,
        sgIds: (cl.VpcSecurityGroups ?? []).map(sg => sg.VpcSecurityGroupId),
        estimatedCost: null, isDisabled: inactive,
        hasIssue: !inactive && (cl.DBClusterMembers?.length ?? 0) < 2,
        issueType: !inactive && (cl.DBClusterMembers?.length ?? 0) < 2 ? 'idle' : null,
        issueLabel: !inactive && (cl.DBClusterMembers?.length ?? 0) < 2 ? 'Single-node Aurora cluster' : null },
    });
  }

  for (const db of rdsInstances) {
    const single   = !db.MultiAZ;
    const inactive = !['available','backing-up','modifying'].includes(db.DBInstanceStatus);
    nodes.push({ id: `rds-${db.DBInstanceIdentifier}`, type: 'rds', label: db.DBInstanceIdentifier,
      data: { engine: `${db.Engine} ${db.EngineVersion}`, instanceClass: db.DBInstanceClass,
        status: db.DBInstanceStatus, endpoint: db.Endpoint?.Address, port: db.Endpoint?.Port,
        multiAz: db.MultiAZ, vpcId: db.DBSubnetGroup?.VpcId,
        sgIds: (db.VpcSecurityGroups ?? []).map(sg => sg.VpcSecurityGroupId),
        estimatedCost: RDS_MONTHLY[db.DBInstanceClass] ?? null,
        isDisabled: inactive,
        hasIssue: single && !inactive, issueType: single && !inactive ? 'idle' : null,
        issueLabel: single && !inactive ? 'Single-AZ — no automatic failover' : null },
    });
  }

  // RDS Proxy
  for (const proxy of rdsProxies) {
    const inactive = proxy.Status !== 'available';
    nodes.push({ id: `rdsproxy-${proxy.DBProxyName}`, type: 'rdsproxy', label: proxy.DBProxyName,
      data: { endpoint: proxy.Endpoint, engineFamily: proxy.EngineFamily,
        status: proxy.Status, vpcId: proxy.VpcId,
        sgIds: proxy.VpcSecurityGroupIds ?? [],
        estimatedCost: null, isDisabled: inactive } });
  }

  for (const lb of lbs) {
    const noTargets = !lbHasTargets[lb.LoadBalancerArn];
    const lbInactive = lb.State?.Code !== 'active';
    nodes.push({ id: lb.LoadBalancerArn, type: 'alb', label: lb.LoadBalancerName,
      data: { lbType: lb.Type, scheme: lb.Scheme, dns: lb.DNSName, state: lb.State?.Code,
        vpcId: lb.VpcId, estimatedCost: 22.27, isDisabled: lbInactive,
        hasIssue: noTargets && !lbInactive, issueType: noTargets && !lbInactive ? 'waste' : null,
        issueLabel: noTargets && !lbInactive ? 'No registered targets' : null },
    });
  }

  for (const rg of redisGroups) {
    const inactive = rg.Status !== 'available';
    nodes.push({ id: `ecache-${rg.ReplicationGroupId}`, type: 'elasticache', label: rg.ReplicationGroupId,
      data: { engine: 'Redis', description: rg.Description, status: rg.Status,
        clusterMode: rg.ClusterEnabled ? 'Cluster' : 'Standalone',
        nodeCount: rg.MemberClusters?.length ?? 0,
        primaryEndpoint: rg.NodeGroups?.[0]?.PrimaryEndpoint?.Address,
        vpcId: null, sgIds: [], estimatedCost: null, isDisabled: inactive },
    });
  }

  for (const mc of memcached) {
    const inactive = mc.CacheClusterStatus !== 'available';
    nodes.push({ id: `ecache-${mc.CacheClusterId}`, type: 'elasticache', label: mc.CacheClusterId,
      data: { engine: 'Memcached', status: mc.CacheClusterStatus,
        nodeCount: mc.NumCacheNodes, instanceType: mc.CacheNodeType,
        vpcId: null, sgIds: (mc.SecurityGroups ?? []).map(sg => sg.SecurityGroupId),
        estimatedCost: null, isDisabled: inactive },
    });
  }

  for (const api of restApis) {
    nodes.push({ id: `apigw-${api.id}`, type: 'apigateway', label: api.name,
      data: { apiId: api.id, description: api.description,
        endpointType: api.endpointConfiguration?.types?.[0] ?? 'REGIONAL',
        vpcId: null, estimatedCost: null },
    });
  }

  for (const url of sqsUrls) {
    const name = sqsNameFromUrl(url);
    nodes.push({ id: sqsNodeId(url), type: 'sqs', label: name,
      data: { queueUrl: url, fifo: name.endsWith('.fifo'), vpcId: null, estimatedCost: null } });
  }

  for (const topic of snsTopics) {
    const name = snsNameFromArn(topic.TopicArn);
    nodes.push({ id: `sns-${topic.TopicArn}`, type: 'sns', label: name,
      data: { topicArn: topic.TopicArn, vpcId: null, estimatedCost: null } });
  }

  for (const tableName of ddbTables) {
    nodes.push({ id: ddbNodeId(tableName), type: 'dynamodb', label: tableName,
      data: { tableName, vpcId: null, estimatedCost: null } });
  }

  for (const cl of mskClusters) {
    nodes.push({ id: `msk-${cl.ClusterArn}`, type: 'msk', label: cl.ClusterName,
      data: { clusterType: cl.ClusterType, state: cl.State,
        kafkaVersion: cl.Provisioned?.CurrentBrokerSoftwareInfo?.KafkaVersion ?? '',
        brokerCount: cl.Provisioned?.NumberOfBrokerNodes ?? cl.Serverless?.VpcConfigs?.length ?? 0,
        vpcId: null, sgIds: cl.Provisioned?.BrokerNodeGroupInfo?.SecurityGroups ?? [],
        estimatedCost: null, isDisabled: cl.State !== 'ACTIVE' },
    });
  }

  for (const name of kinesisStreams) {
    nodes.push({ id: kinesisNodeId(name), type: 'kinesis', label: name,
      data: { streamName: name, vpcId: null, estimatedCost: null } });
  }

  for (const fn of lambdaFns) {
    nodes.push({ id: `lambda-${fn.FunctionName}`, type: 'lambda', label: fn.FunctionName,
      data: { runtime: fn.Runtime, memorySize: `${fn.MemorySize} MB`, timeout: `${fn.Timeout}s`,
        handler: fn.Handler, codeSize: `${Math.round(fn.CodeSize / 1024)} KB`,
        vpcId: fn.VpcConfig?.VpcId ?? null,
        sgIds: fn.VpcConfig?.SecurityGroupIds ?? [],
        estimatedCost: null },
    });
  }

  for (const svc of ecsServices) {
    const awsvpc  = svc.networkConfiguration?.awsvpcConfiguration;
    const vpcId   = awsvpc?.subnets?.[0] ? (subnets.find(s => s.SubnetId === awsvpc.subnets[0])?.VpcId ?? null) : null;
    const under   = svc.runningCount < svc.desiredCount;
    const inactive = svc.status !== 'ACTIVE';
    nodes.push({ id: svc.serviceArn, type: 'ecs', label: svc.serviceName,
      data: { cluster: svc.clusterArn?.split('/').pop() ?? '', launchType: svc.launchType ?? 'FARGATE',
        desiredCount: svc.desiredCount, runningCount: svc.runningCount, status: svc.status, vpcId,
        sgIds: awsvpc?.securityGroups ?? [], estimatedCost: null, isDisabled: inactive,
        hasIssue: under && !inactive, issueType: under && !inactive ? 'idle' : null,
        issueLabel: under && !inactive ? `Running ${svc.runningCount}/${svc.desiredCount} desired` : null },
    });
  }

  for (const dist of cfDists) {
    nodes.push({ id: dist.Id, type: 'cloudfront', label: dist.Comment || dist.DomainName?.split('.')[0] || dist.Id,
      data: { domainName: dist.DomainName, status: dist.Status, enabled: dist.Enabled,
        origins: (dist.Origins?.Items ?? []).map(o => o.DomainName).join(', '),
        priceClass: dist.PriceClass, vpcId: null, estimatedCost: null, isDisabled: !dist.Enabled },
    });
  }

  for (const zone of hostedZones.slice(0, 10)) {
    const name = zone.Name.replace(/\.$/, '');
    nodes.push({ id: `r53-${zone.Id}`, type: 'route53', label: name,
      data: { zoneId: zone.Id, private: zone.Config?.PrivateZone, recordCount: zone.ResourceRecordSetCount,
        vpcId: null, estimatedCost: null },
    });
  }

  // S3 buckets
  for (const bucket of s3Buckets) {
    nodes.push({ id: `s3-${bucket.Name}`, type: 's3', label: bucket.Name,
      data: { bucketName: bucket.Name, createdAt: bucket.CreationDate,
        vpcId: null, estimatedCost: null } });
  }

  // EFS file systems
  for (const fs of efsFileSystems) {
    const mts = efsMountTargets[fs.FileSystemId] ?? [];
    const noMount = mts.length === 0;
    const vpcId = mts[0]?.VpcId ?? null;
    nodes.push({ id: `efs-${fs.FileSystemId}`, type: 'efs', label: fs.Name || fs.FileSystemId,
      data: { fsId: fs.FileSystemId, lifecycleState: fs.LifeCycleState,
        size: fs.SizeInBytes?.Value ?? 0, encrypted: fs.Encrypted,
        throughputMode: fs.ThroughputMode,
        vpcId, estimatedCost: null,
        hasIssue: noMount, issueType: noMount ? 'waste' : null,
        issueLabel: noMount ? 'No mount targets — unused EFS' : null } });
  }

  // EventBridge rules
  for (const rule of ebRules) {
    if (rule.State !== 'ENABLED') continue;
    const targets = ebTargets[rule.Name] ?? [];
    const noTargets = targets.length === 0;
    nodes.push({ id: `eb-${rule.Arn}`, type: 'eventbridge', label: rule.Name,
      data: { ruleArn: rule.Arn, schedule: rule.ScheduleExpression,
        pattern: rule.EventPattern ? 'Event Pattern' : null,
        vpcId: null, estimatedCost: null,
        hasIssue: noTargets, issueType: noTargets ? 'idle' : null,
        issueLabel: noTargets ? 'No targets configured' : null } });
  }

  // Step Functions state machines
  for (const sm of sfnMachines) {
    nodes.push({ id: `sfn-${sm.stateMachineArn}`, type: 'stepfunctions', label: sm.name,
      data: { arn: sm.stateMachineArn, type: sm.type,
        vpcId: null, estimatedCost: null } });
  }

  // WAF web ACLs
  for (const acl of wafAcls) {
    const resources = wafResources[acl.ARN] ?? [];
    const noResources = resources.length === 0;
    nodes.push({ id: `waf-${acl.ARN}`, type: 'waf', label: acl.Name,
      data: { aclArn: acl.ARN, capacity: acl.Capacity,
        vpcId: null, estimatedCost: null,
        hasIssue: noResources, issueType: noResources ? 'idle' : null,
        issueLabel: noResources ? 'Not associated with any resource' : null } });
  }

  // ECR repositories
  for (const repo of ecrRepos) {
    nodes.push({ id: `ecr-${repo.repositoryArn}`, type: 'ecr', label: repo.repositoryName,
      data: { repoUri: repo.repositoryUri, repoArn: repo.repositoryArn,
        imageScanOnPush: repo.imageScanningConfiguration?.scanOnPush,
        vpcId: null, estimatedCost: null } });
  }

  // Redshift clusters
  for (const cl of redshiftClusters) {
    const inactive = cl.ClusterStatus !== 'available';
    const single   = cl.NumberOfNodes === 1;
    nodes.push({ id: `redshift-${cl.ClusterIdentifier}`, type: 'redshift', label: cl.ClusterIdentifier,
      data: { nodeType: cl.NodeType, nodeCount: cl.NumberOfNodes,
        status: cl.ClusterStatus, endpoint: cl.Endpoint?.Address,
        port: cl.Endpoint?.Port, dbName: cl.DBName,
        vpcId: cl.VpcId,
        sgIds: (cl.VpcSecurityGroups ?? []).map(sg => sg.VpcSecurityGroupId),
        estimatedCost: null, isDisabled: inactive,
        hasIssue: single && !inactive, issueType: single && !inactive ? 'idle' : null,
        issueLabel: single && !inactive ? 'Single-node — no HA' : null } });
  }

  // OpenSearch domains
  for (const domain of osDomains) {
    const inactive = !domain.Processing && domain.Deleted;
    const vpcId = domain.VPCOptions?.VPCId ?? null;
    nodes.push({ id: `os-${domain.DomainName}`, type: 'opensearch', label: domain.DomainName,
      data: { domainName: domain.DomainName, endpoint: domain.Endpoint,
        engineVersion: domain.EngineVersion,
        vpcId,
        sgIds: domain.VPCOptions?.SecurityGroupIds ?? [],
        estimatedCost: null, isDisabled: !!inactive } });
  }

  // ── Edges ─────────────────────────────────────────────────────────────────
  const edges = [];
  const seen  = new Set();
  function addEdge(e) {
    const k = `${e.source}→${e.target}`;
    if (!seen.has(k)) { seen.add(k); edges.push(e); }
  }

  // Internet → IGW
  for (const igw of igws) {
    addEdge({ id: `e-inet-${igw.InternetGatewayId}`, source: '__internet__', target: igw.InternetGatewayId, edgeType: 'internet', label: 'Public traffic' });
  }

  // Internet → CloudFront; CloudFront → ALB / S3
  for (const dist of cfDists) {
    addEdge({ id: `e-inet-cf-${dist.Id}`, source: '__internet__', target: dist.Id, edgeType: 'internet', label: 'CDN' });
    for (const origin of (dist.Origins?.Items ?? [])) {
      // CloudFront → ALB
      const lbMatch = lbs.find(lb => lb.DNSName && origin.DomainName.includes(lb.DNSName.split('.')[0]));
      if (lbMatch) addEdge({ id: `e-cf-${dist.Id}-${lbMatch.LoadBalancerArn}`, source: dist.Id, target: lbMatch.LoadBalancerArn, edgeType: 'alb', label: 'Origin' });
      // CloudFront → S3
      const bucketName = s3BucketName(origin.DomainName);
      const s3Node = bucketName ? nodes.find(n => n.type === 's3' && n.data?.bucketName === bucketName) : null;
      if (s3Node) addEdge({ id: `e-cf-${dist.Id}-${s3Node.id}`, source: dist.Id, target: s3Node.id, edgeType: 'event', label: 'Origin' });
    }
  }

  // Internet → API Gateway (public)
  for (const api of restApis) {
    const ep = api.endpointConfiguration?.types?.[0];
    if (!ep || ep === 'PRIVATE') continue;
    addEdge({ id: `e-inet-apigw-${api.id}`, source: '__internet__', target: `apigw-${api.id}`, edgeType: 'internet', label: 'REST API' });
  }

  // Route 53 → ALB / CloudFront
  for (const zone of hostedZones.slice(0, 10)) {
    const zoneNodeId = `r53-${zone.Id}`;
    const zoneName   = zone.Name.replace(/\.$/, '');
    for (const lb of lbs) {
      if (lb.DNSName && lb.DNSName.endsWith(zoneName)) {
        addEdge({ id: `e-r53-alb-${zone.Id}-${lb.LoadBalancerArn}`, source: zoneNodeId, target: lb.LoadBalancerArn, edgeType: 'dns', label: 'DNS' });
      }
    }
    for (const dist of cfDists) {
      if (dist.Aliases?.Items?.some(a => a.endsWith(zoneName))) {
        addEdge({ id: `e-r53-cf-${zone.Id}-${dist.Id}`, source: zoneNodeId, target: dist.Id, edgeType: 'dns', label: 'DNS' });
      }
    }
  }

  // EIP → EC2 / ALB (and IGW → EIP)
  for (const eip of eips) {
    const eipId = eip.AllocationId || `eip-${eip.PublicIp}`;

    if (eip.InstanceId) {
      // EIP attached to EC2
      const inst = instances.find(i => i.InstanceId === eip.InstanceId);
      if (inst) {
        const igw = igws.find(i => i.Attachments?.[0]?.VpcId === inst.VpcId);
        if (igw) addEdge({ id: `e-igw-eip-${eipId}`, source: igw.InternetGatewayId, target: eipId, edgeType: 'internet', label: 'Public IP' });
        addEdge({ id: `e-eip-ec2-${eip.InstanceId}`, source: eipId, target: eip.InstanceId, edgeType: 'eip', label: 'Elastic IP' });
      }
    } else if (eip.NetworkInterfaceId && eniToLbArn[eip.NetworkInterfaceId]) {
      // EIP managed by ALB — connect IGW → EIP → ALB
      const lbArn = eniToLbArn[eip.NetworkInterfaceId];
      const lb    = lbs.find(l => l.LoadBalancerArn === lbArn);
      if (lb) {
        const igw = igws.find(i => i.Attachments?.[0]?.VpcId === lb.VpcId);
        if (igw) addEdge({ id: `e-igw-eip-${eipId}`, source: igw.InternetGatewayId, target: eipId, edgeType: 'internet', label: 'Public IP' });
        addEdge({ id: `e-eip-alb-${eipId}`, source: eipId, target: lbArn, edgeType: 'eip', label: 'ALB IP' });
      }
    }
  }

  // IGW → EC2 (direct public IP, no EIP)
  for (const inst of instances) {
    if (inst.PublicIpAddress && !eips.find(e => e.InstanceId === inst.InstanceId)) {
      const igw = igws.find(i => i.Attachments?.[0]?.VpcId === inst.VpcId);
      if (igw) addEdge({ id: `e-igw-ec2-${inst.InstanceId}`, source: igw.InternetGatewayId, target: inst.InstanceId, edgeType: 'internet', label: 'Public IP' });
    }
  }

  // NAT → IGW
  for (const nat of nats) {
    const igw = igws.find(i => i.Attachments?.[0]?.VpcId === nat.VpcId);
    if (igw) addEdge({ id: `e-nat-igw-${nat.NatGatewayId}`, source: nat.NatGatewayId, target: igw.InternetGatewayId, edgeType: 'nat', label: 'Outbound' });
  }

  // ALB → EC2 targets + IGW → ALB (internet-facing)
  for (const lb of lbs) {
    for (const id of (lbTargets[lb.LoadBalancerArn] ?? [])) {
      addEdge({ id: `e-alb-${lb.LoadBalancerArn}-${id}`, source: lb.LoadBalancerArn, target: id, edgeType: 'alb', label: 'Target' });
    }
    if (lb.Scheme === 'internet-facing') {
      const igw = igws.find(i => i.Attachments?.[0]?.VpcId === lb.VpcId);
      if (igw) addEdge({ id: `e-igw-alb-${lb.LoadBalancerArn}`, source: igw.InternetGatewayId, target: lb.LoadBalancerArn, edgeType: 'internet', label: 'Public' });
    }
  }

  // VPC → VPC Endpoints
  for (const vpce of vpces) {
    addEdge({ id: `e-vpc-vpce-${vpce.VpcEndpointId}`, source: vpce.VpcId, target: vpce.VpcEndpointId, edgeType: 'vpce', label: 'Endpoint' });
  }

  // Event source mappings: SQS/Kinesis/DynamoDB → Lambda
  for (const esm of eventSources) {
    if (!esm.EventSourceArn || !esm.FunctionArn) continue;
    const lambdaId = `lambda-${esm.FunctionArn.split(':').pop()}`;
    if (!nodes.find(n => n.id === lambdaId)) continue;
    if (esm.EventSourceArn.includes(':sqs:')) {
      const queueName = esm.EventSourceArn.split(':').pop();
      const sqsNode = nodes.find(n => n.type === 'sqs' && n.label === queueName);
      if (sqsNode) addEdge({ id: `e-sqs-lambda-${esm.UUID}`, source: sqsNode.id, target: lambdaId, edgeType: 'event', label: 'Trigger' });
    } else if (esm.EventSourceArn.includes(':kinesis:')) {
      const streamName = esm.EventSourceArn.split('/').pop();
      const kNode = nodes.find(n => n.type === 'kinesis' && n.label === streamName);
      if (kNode) addEdge({ id: `e-kinesis-lambda-${esm.UUID}`, source: kNode.id, target: lambdaId, edgeType: 'event', label: 'Stream' });
    } else if (esm.EventSourceArn.includes(':dynamodb:')) {
      const tableName = esm.EventSourceArn.split('/')[1];
      const ddbNode = nodes.find(n => n.type === 'dynamodb' && n.label === tableName);
      if (ddbNode) addEdge({ id: `e-ddb-lambda-${esm.UUID}`, source: ddbNode.id, target: lambdaId, edgeType: 'event', label: 'Stream' });
    }
  }

  // SNS subscriptions → Lambda / SQS
  for (const sub of snsSubs) {
    if (!sub.TopicArn || sub.SubscriptionArn === 'PendingConfirmation') continue;
    const snsNodeId = `sns-${sub.TopicArn}`;
    if (!nodes.find(n => n.id === snsNodeId)) continue;
    if (sub.Protocol === 'lambda' && sub.Endpoint) {
      const fnName = sub.Endpoint.split(':').pop();
      const lambdaId = `lambda-${fnName}`;
      if (nodes.find(n => n.id === lambdaId))
        addEdge({ id: `e-sns-lambda-${sub.SubscriptionArn}`, source: snsNodeId, target: lambdaId, edgeType: 'event', label: 'Notify' });
    } else if (sub.Protocol === 'sqs' && sub.Endpoint) {
      const queueName = sub.Endpoint.split(':').pop();
      const sqsNode = nodes.find(n => n.type === 'sqs' && n.label === queueName);
      if (sqsNode) addEdge({ id: `e-sns-sqs-${sub.SubscriptionArn}`, source: snsNodeId, target: sqsNode.id, edgeType: 'event', label: 'Fan-out' });
    }
  }

  // ALB → ECS (Fargate IP targets — linked via svc.loadBalancers[].targetGroupArn)
  for (const svc of ecsServices) {
    for (const lb of (svc.loadBalancers ?? [])) {
      const lbArn = lb.targetGroupArn ? tgToLbArn[lb.targetGroupArn] : null;
      if (lbArn) {
        addEdge({ id: `e-alb-ecs-${lbArn}-${svc.serviceArn}`, source: lbArn, target: svc.serviceArn, edgeType: 'alb', label: `Port ${lb.containerPort ?? ''}` });
      }
    }
  }

  // S3 → Lambda (bucket notification triggers)
  for (const bucket of s3Buckets) {
    const s3Id = `s3-${bucket.Name}`;
    for (const cfg of (s3Notifications[bucket.Name] ?? [])) {
      if (!cfg.LambdaFunctionArn) continue;
      const fnName = cfg.LambdaFunctionArn.split(':').pop();
      const lambdaId = `lambda-${fnName}`;
      if (nodes.find(n => n.id === lambdaId))
        addEdge({ id: `e-s3-lambda-${bucket.Name}-${fnName}`, source: s3Id, target: lambdaId, edgeType: 'event', label: 'Trigger' });
    }
  }

  // EventBridge → Lambda / SQS / SNS / ECS
  for (const rule of ebRules) {
    if (rule.State !== 'ENABLED') continue;
    const ebId = `eb-${rule.Arn}`;
    for (const target of (ebTargets[rule.Name] ?? [])) {
      const arn = target.Arn ?? '';
      let targetNode = null;
      if (arn.includes(':function:')) {
        const fnName = arn.split(':function:').pop().split(':')[0];
        targetNode = nodes.find(n => n.id === `lambda-${fnName}`);
      } else if (arn.includes(':sqs:')) {
        const queueName = arn.split(':').pop();
        targetNode = nodes.find(n => n.type === 'sqs' && n.label === queueName);
      } else if (arn.includes(':sns:')) {
        targetNode = nodes.find(n => n.type === 'sns' && n.data?.topicArn === arn);
      } else if (arn.includes(':service/')) {
        targetNode = nodes.find(n => n.type === 'ecs' && arn.includes(n.data?.cluster ?? '__'));
      }
      if (targetNode) addEdge({ id: `e-eb-${rule.Name}-${targetNode.id}`, source: ebId, target: targetNode.id, edgeType: 'event', label: 'Target' });
    }
  }

  // Step Functions → Lambda / ECS / DynamoDB (parse definition)
  for (const sm of sfnMachines) {
    const sfnId = `sfn-${sm.stateMachineArn}`;
    const def   = sfnDefs[sm.stateMachineArn] ?? '';
    const lambdaMatches = def.match(/arn:aws:lambda:[^"]+:function:([^"$:]+)/g) ?? [];
    const seenTargets = new Set();
    for (const match of lambdaMatches) {
      const fnName   = match.split(':function:').pop().split(':')[0];
      const lambdaId = `lambda-${fnName}`;
      if (!seenTargets.has(lambdaId) && nodes.find(n => n.id === lambdaId)) {
        addEdge({ id: `e-sfn-${sm.stateMachineArn}-${lambdaId}`, source: sfnId, target: lambdaId, edgeType: 'event', label: 'Invoke' });
        seenTargets.add(lambdaId);
      }
    }
    const ddbMatches = def.match(/"TableName"\s*:\s*"([^"]+)"/g) ?? [];
    for (const match of ddbMatches) {
      const tableName = match.replace(/.*"TableName"\s*:\s*"/, '').replace(/"$/, '');
      const ddbNode   = nodes.find(n => n.type === 'dynamodb' && n.label === tableName);
      if (ddbNode && !seenTargets.has(ddbNode.id)) {
        addEdge({ id: `e-sfn-${sm.stateMachineArn}-${ddbNode.id}`, source: sfnId, target: ddbNode.id, edgeType: 'event', label: 'Read/Write' });
        seenTargets.add(ddbNode.id);
      }
    }
  }

  // WAF → ALB / CloudFront
  for (const acl of wafAcls) {
    const wafId = `waf-${acl.ARN}`;
    for (const resourceArn of (wafResources[acl.ARN] ?? [])) {
      const lbNode = nodes.find(n => n.id === resourceArn);
      const cfNode = nodes.find(n => n.type === 'cloudfront' && resourceArn.includes(n.id));
      const target = lbNode ?? cfNode;
      if (target) addEdge({ id: `e-waf-${acl.ARN}-${target.id}`, source: wafId, target: target.id, edgeType: 'sg', label: 'Protect' });
    }
  }

  // RDS Proxy → RDS / Aurora
  for (const proxy of rdsProxies) {
    const proxyId = `rdsproxy-${proxy.DBProxyName}`;
    for (const tgt of (proxyTargets[proxy.DBProxyName] ?? [])) {
      let targetNode = null;
      if (tgt.Type === 'RDS_INSTANCE') {
        targetNode = nodes.find(n => n.type === 'rds' && n.label === tgt.RdsResourceId);
      } else if (tgt.Type === 'TRACKED_CLUSTER') {
        targetNode = nodes.find(n => n.type === 'aurora' && n.label === tgt.RdsResourceId);
      }
      if (targetNode) addEdge({ id: `e-proxy-${proxy.DBProxyName}-${targetNode.id}`, source: proxyId, target: targetNode.id, edgeType: 'default', label: 'Proxy' });
    }
  }

  // ── Security group edges ───────────────────────────────────────────────────
  const sgMap = new Map();
  const reg = (sgId, nodeId) => { if (!sgMap.has(sgId)) sgMap.set(sgId, []); sgMap.get(sgId).push(nodeId); };

  for (const inst of instances) for (const sg of (inst.SecurityGroups ?? [])) reg(sg.GroupId, inst.InstanceId);
  for (const db of rdsInstances) for (const sg of (db.VpcSecurityGroups ?? [])) reg(sg.VpcSecurityGroupId, `rds-${db.DBInstanceIdentifier}`);
  for (const cl of auroraClusters) for (const sg of (cl.VpcSecurityGroups ?? [])) reg(sg.VpcSecurityGroupId, `aurora-${cl.DBClusterIdentifier}`);
  for (const fn of lambdaFns) for (const sg of (fn.VpcConfig?.SecurityGroupIds ?? [])) reg(sg, `lambda-${fn.FunctionName}`);
  for (const svc of ecsServices) for (const sg of (svc.networkConfiguration?.awsvpcConfiguration?.securityGroups ?? [])) reg(sg, svc.serviceArn);
  for (const mc of memcached) for (const sg of (mc.SecurityGroups ?? [])) reg(sg.SecurityGroupId, `ecache-${mc.CacheClusterId}`);
  for (const cl of mskClusters) for (const sg of (cl.Provisioned?.BrokerNodeGroupInfo?.SecurityGroups ?? [])) reg(sg, `msk-${cl.ClusterArn}`);
  for (const proxy of rdsProxies) for (const sg of (proxy.VpcSecurityGroupIds ?? [])) reg(sg, `rdsproxy-${proxy.DBProxyName}`);
  for (const cl of redshiftClusters) for (const sg of (cl.VpcSecurityGroups ?? [])) reg(sg.VpcSecurityGroupId, `redshift-${cl.ClusterIdentifier}`);
  for (const domain of osDomains) for (const sg of (domain.VPCOptions?.SecurityGroupIds ?? [])) reg(sg, `os-${domain.DomainName}`);

  for (const sg of securityGroups) {
    const targets = sgMap.get(sg.GroupId) ?? [];
    if (!targets.length) continue;
    for (const rule of (sg.IpPermissions ?? [])) {
      for (const pair of (rule.UserIdGroupPairs ?? [])) {
        const sources = sgMap.get(pair.GroupId) ?? [];
        const proto = rule.IpProtocol === '-1' ? 'All' : rule.IpProtocol?.toUpperCase();
        const port  = rule.FromPort != null ? (rule.FromPort === rule.ToPort ? `:${rule.FromPort}` : `:${rule.FromPort}-${rule.ToPort}`) : '';
        for (const src of sources) for (const tgt of targets) {
          if (src !== tgt) addEdge({ id: `e-sg-${sg.GroupId}-${src}-${tgt}`, source: src, target: tgt, edgeType: 'sg', label: `${proto}${port}` });
        }
      }
      for (const cidr of (rule.IpRanges ?? [])) {
        if (cidr.CidrIp !== '0.0.0.0/0' && cidr.CidrIp !== '::/0') continue;
        const proto = rule.IpProtocol === '-1' ? 'All' : rule.IpProtocol?.toUpperCase();
        const port  = rule.FromPort != null ? `:${rule.FromPort}` : '';
        for (const tgt of targets) {
          const vpcId = nodes.find(n => n.id === tgt)?.data?.vpcId;
          const igw   = igws.find(i => i.Attachments?.[0]?.VpcId === vpcId);
          if (igw) addEdge({ id: `e-open-${sg.GroupId}-${tgt}`, source: igw.InternetGatewayId, target: tgt, edgeType: 'open', label: `Open ${proto}${port}` });
        }
      }
    }
  }

  // Flag nodes targeted by open SG rules
  const openTargets = new Set(edges.filter(e => e.edgeType === 'open').map(e => e.target));
  for (const node of nodes) {
    if (openTargets.has(node.id) && !node.data.hasIssue && !node.data.isDisabled) {
      node.data.hasIssue   = true;
      node.data.issueType  = 'security';
      node.data.issueLabel = 'Security group open to 0.0.0.0/0';
    }
  }

  res.json({ nodes, edges, region, scannedAt: new Date().toISOString() });
});

module.exports = router;
