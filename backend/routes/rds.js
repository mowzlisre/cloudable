const router = require('express').Router();
const { RDSClient, DescribeDBInstancesCommand, DescribeDBClustersCommand } = require('@aws-sdk/client-rds');
const { CloudWatchClient, GetMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

router.get('/', async (req, res) => {
  const region = req.query.region || process.env.AWS_REGION || 'us-east-1';
  const credentials = { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY };
  const rds = new RDSClient({ region, credentials });
  const cw  = new CloudWatchClient({ region, credentials });

  const [instR, clustR] = await Promise.allSettled([
    rds.send(new DescribeDBInstancesCommand({})),
    rds.send(new DescribeDBClustersCommand({})),
  ]);

  const instances = instR.value?.DBInstances ?? [];
  const clusters  = clustR.value?.DBClusters ?? [];
  const clusterMap = Object.fromEntries(clusters.map(c => [c.DBClusterIdentifier, c]));

  const endTime   = new Date();
  const startTime = new Date(endTime - 7 * 24 * 60 * 60 * 1000);

  const queries = instances.flatMap((db, i) => {
    const dims = [{ Name: 'DBInstanceIdentifier', Value: db.DBInstanceIdentifier }];
    return [
      { Id: `ra${i}`, MetricStat: { Metric: { Namespace: 'AWS/RDS', MetricName: 'CPUUtilization',      Dimensions: dims }, Period: 3600, Stat: 'Average' }, ReturnData: true },
      { Id: `rc${i}`, MetricStat: { Metric: { Namespace: 'AWS/RDS', MetricName: 'DatabaseConnections', Dimensions: dims }, Period: 3600, Stat: 'Average' }, ReturnData: true },
      { Id: `rs${i}`, MetricStat: { Metric: { Namespace: 'AWS/RDS', MetricName: 'FreeStorageSpace',    Dimensions: dims }, Period: 86400, Stat: 'Average' }, ReturnData: true },
    ];
  });

  const cwMap = new Map();
  for (let i = 0; i < queries.length; i += 500) {
    try {
      const r = await cw.send(new GetMetricDataCommand({ MetricDataQueries: queries.slice(i, i + 500), StartTime: startTime, EndTime: endTime }));
      for (const m of (r.MetricDataResults ?? [])) cwMap.set(m.Id, m.Values ?? []);
    } catch (_) {}
  }

  const avg = vals => vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;

  const data = instances.map((db, i) => {
    const cpuVals  = cwMap.get(`ra${i}`) ?? [];
    const connVals = cwMap.get(`rc${i}`) ?? [];
    const freeVals = cwMap.get(`rs${i}`) ?? [];
    const cluster  = db.DBClusterIdentifier ? clusterMap[db.DBClusterIdentifier] : null;

    const freeStorageBytes = freeVals.length ? avg(freeVals) : null;
    const freeStorageGb    = freeStorageBytes != null ? +(freeStorageBytes / 1024 / 1024 / 1024).toFixed(1) : null;
    const allocatedGb      = db.AllocatedStorage ?? null;
    const usedGb           = (freeStorageGb != null && allocatedGb) ? +(allocatedGb - freeStorageGb).toFixed(1) : null;
    const storageUtilPct   = (usedGb && allocatedGb) ? +((usedGb / allocatedGb) * 100).toFixed(1) : null;

    return {
      id: db.DBInstanceIdentifier,
      engine: db.Engine,
      engineVersion: db.EngineVersion,
      instanceClass: db.DBInstanceClass,
      status: db.DBInstanceStatus,
      endpoint: db.Endpoint?.Address,
      port: db.Endpoint?.Port,
      multiAz: db.MultiAZ,
      storageType: db.StorageType,
      allocatedStorageGb: allocatedGb,
      freeStorageGb,
      usedStorageGb: usedGb,
      storageUtilPct,
      vpcId: db.DBSubnetGroup?.VpcId,
      az: db.AvailabilityZone,
      clusterIdentifier: db.DBClusterIdentifier ?? null,
      isAuroraReader: cluster?.ReaderEndpoint != null && db.DBClusterIdentifier != null,
      publiclyAccessible: db.PubliclyAccessible,
      autoMinorVersionUpgrade: db.AutoMinorVersionUpgrade,
      avgCpu7d: cpuVals.length ? +avg(cpuVals).toFixed(1) : null,
      maxCpu7d: cpuVals.length ? +Math.max(...cpuVals).toFixed(1) : null,
      avgConnections7d: connVals.length ? +avg(connVals).toFixed(0) : null,
      tags: db.TagList?.filter(t => t.Key !== 'Name').map(t => `${t.Key}=${t.Value}`) ?? [],
    };
  });

  res.json({ instances: data, count: data.length, region });
});

module.exports = router;
