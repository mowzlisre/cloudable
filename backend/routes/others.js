const router = require('express').Router();
const { LambdaClient, ListFunctionsCommand, GetFunctionConcurrencyCommand } = require('@aws-sdk/client-lambda');
const { Route53Client, ListHostedZonesCommand, ListResourceRecordSetsCommand } = require('@aws-sdk/client-route-53');
const { ECSClient, ListClustersCommand, DescribeClustersCommand, ListServicesCommand, DescribeServicesCommand } = require('@aws-sdk/client-ecs');
const { CloudWatchClient, GetMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

router.get('/', async (req, res) => {
  const region = req.query.region || process.env.AWS_REGION || 'us-east-1';
  const credentials = { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY };
  const lambda  = new LambdaClient({ region, credentials });
  const r53     = new Route53Client({ region: 'us-east-1', credentials });
  const ecs     = new ECSClient({ region, credentials });
  const cw      = new CloudWatchClient({ region, credentials });

  const [lambdaR, zonesR, clustersR] = await Promise.allSettled([
    lambda.send(new ListFunctionsCommand({ MaxItems: 100 })),
    r53.send(new ListHostedZonesCommand({})),
    ecs.send(new ListClustersCommand({})),
  ]);

  const functions = lambdaR.value?.Functions ?? [];
  const zones     = zonesR.value?.HostedZones ?? [];
  const clusterArns = clustersR.value?.clusterArns ?? [];

  // Lambda invocation metrics (7 days)
  const endTime   = new Date();
  const startTime = new Date(endTime - 7 * 24 * 60 * 60 * 1000);
  const lambdaQueries = functions.flatMap((fn, i) => {
    const dims = [{ Name: 'FunctionName', Value: fn.FunctionName }];
    return [
      { Id: `li${i}`, MetricStat: { Metric: { Namespace: 'AWS/Lambda', MetricName: 'Invocations', Dimensions: dims }, Period: 86400, Stat: 'Sum' }, ReturnData: true },
      { Id: `le${i}`, MetricStat: { Metric: { Namespace: 'AWS/Lambda', MetricName: 'Errors',      Dimensions: dims }, Period: 86400, Stat: 'Sum' }, ReturnData: true },
      { Id: `ld${i}`, MetricStat: { Metric: { Namespace: 'AWS/Lambda', MetricName: 'Duration',    Dimensions: dims }, Period: 86400, Stat: 'Average' }, ReturnData: true },
    ];
  });

  const cwMap = new Map();
  for (let i = 0; i < lambdaQueries.length; i += 500) {
    try {
      const r = await cw.send(new GetMetricDataCommand({ MetricDataQueries: lambdaQueries.slice(i, i + 500), StartTime: startTime, EndTime: endTime }));
      for (const m of (r.MetricDataResults ?? [])) cwMap.set(m.Id, m.Values ?? []);
    } catch (_) {}
  }

  const sum = vals => vals.reduce((s, v) => s + v, 0);
  const avg = vals => vals.length ? sum(vals) / vals.length : 0;

  const lambdaData = functions.map((fn, i) => {
    const invocations = cwMap.get(`li${i}`) ?? [];
    const errors      = cwMap.get(`le${i}`) ?? [];
    const durations   = cwMap.get(`ld${i}`) ?? [];
    const totalInv  = Math.round(sum(invocations));
    const totalErr  = Math.round(sum(errors));
    const errorRate = totalInv > 0 ? +((totalErr / totalInv) * 100).toFixed(1) : 0;
    return {
      name: fn.FunctionName,
      runtime: fn.Runtime,
      memorySizeMb: fn.MemorySize,
      timeoutSec: fn.Timeout,
      codeSize: fn.CodeSize,
      lastModified: fn.LastModified,
      handler: fn.Handler,
      description: fn.Description,
      vpcId: fn.VpcConfig?.VpcId ?? null,
      invocations7d: totalInv,
      errors7d: totalErr,
      errorRate7d: errorRate,
      avgDurationMs7d: durations.length ? +avg(durations).toFixed(0) : null,
    };
  });

  // ECS services
  const ecsServices = [];
  for (const arn of clusterArns.slice(0, 5)) {
    try {
      const svcArns = (await ecs.send(new ListServicesCommand({ cluster: arn, maxResults: 20 }))).serviceArns ?? [];
      if (!svcArns.length) continue;
      const desc = await ecs.send(new DescribeServicesCommand({ cluster: arn, services: svcArns.slice(0, 10) }));
      for (const svc of (desc.services ?? [])) {
        ecsServices.push({
          name: svc.serviceName,
          clusterArn: arn,
          cluster: arn.split('/').pop(),
          status: svc.status,
          desiredCount: svc.desiredCount,
          runningCount: svc.runningCount,
          launchType: svc.launchType ?? 'FARGATE',
          taskDefinition: svc.taskDefinition?.split('/').pop() ?? '',
        });
      }
    } catch (_) {}
  }

  // Route53 zone record counts (sample first 5 zones)
  const zoneData = await Promise.all(zones.slice(0, 5).map(async z => {
    let recordCount = z.Config?.PrivateZone ? z.ResourceRecordSetCount : z.ResourceRecordSetCount;
    return {
      id: z.Id.split('/').pop(),
      name: z.Name,
      isPrivate: z.Config?.PrivateZone ?? false,
      recordCount: recordCount ?? 0,
      comment: z.Config?.Comment ?? '',
    };
  }));

  res.json({
    lambda: { functions: lambdaData, count: lambdaData.length },
    ecs:    { services: ecsServices, count: ecsServices.length },
    route53: { zones: zoneData, count: zones.length },
    region,
  });
});

module.exports = router;
