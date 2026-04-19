const router = require('express').Router();
const { EC2Client, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { RDSClient, DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const { CloudWatchClient, GetMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

// ── Pricing tables (monthly on-demand, Linux, us-east-1 approx) ──────────────
const EC2_MONTHLY = {
  't2.nano':4.18,'t2.micro':8.47,'t2.small':16.94,'t2.medium':33.87,'t2.large':67.74,'t2.xlarge':135.48,
  't3.nano':3.80,'t3.micro':7.59,'t3.small':15.18,'t3.medium':30.37,'t3.large':60.74,'t3.xlarge':121.47,'t3.2xlarge':242.94,
  't3a.nano':3.39,'t3a.micro':6.79,'t3a.small':13.58,'t3a.medium':27.14,'t3a.large':54.29,'t3a.xlarge':108.58,
  't4g.nano':3.07,'t4g.micro':6.13,'t4g.small':12.26,'t4g.medium':24.53,'t4g.large':49.06,'t4g.xlarge':98.13,
  'm5.large':70.08,'m5.xlarge':140.16,'m5.2xlarge':280.32,'m5.4xlarge':560.64,'m5.8xlarge':1121.28,
  'm5a.large':62.78,'m5a.xlarge':125.57,'m5a.2xlarge':251.14,'m5a.4xlarge':502.27,
  'm6i.large':70.08,'m6i.xlarge':140.16,'m6i.2xlarge':280.32,'m6i.4xlarge':560.64,
  'm6a.large':62.78,'m6a.xlarge':125.57,'m6a.2xlarge':251.14,
  'c5.large':62.05,'c5.xlarge':124.10,'c5.2xlarge':248.20,'c5.4xlarge':496.39,
  'c6i.large':58.97,'c6i.xlarge':117.94,'c6i.2xlarge':235.87,'c6i.4xlarge':471.74,
  'r5.large':91.98,'r5.xlarge':183.96,'r5.2xlarge':367.92,'r5.4xlarge':735.84,
  'r6i.large':91.98,'r6i.xlarge':183.96,'r6i.2xlarge':367.92,
};

const RDS_MONTHLY = {
  'db.t3.micro':12.41,'db.t3.small':24.82,'db.t3.medium':49.64,'db.t3.large':99.28,'db.t3.xlarge':198.58,
  'db.t4g.micro':10.37,'db.t4g.small':20.74,'db.t4g.medium':41.47,'db.t4g.large':82.94,
  'db.m5.large':120.24,'db.m5.xlarge':240.48,'db.m5.2xlarge':480.96,'db.m5.4xlarge':961.92,
  'db.m6g.large':108.22,'db.m6g.xlarge':216.43,'db.m6g.2xlarge':432.86,
  'db.r5.large':170.52,'db.r5.xlarge':341.04,'db.r5.2xlarge':682.08,
  'db.r6g.large':153.43,'db.r6g.xlarge':306.86,
};

// ── Instance family size chains ───────────────────────────────────────────────
const EC2_FAMILIES = {
  't2': ['nano','micro','small','medium','large','xlarge','2xlarge'],
  't3': ['nano','micro','small','medium','large','xlarge','2xlarge'],
  't3a':['nano','micro','small','medium','large','xlarge','2xlarge'],
  't4g':['nano','micro','small','medium','large','xlarge','2xlarge'],
  'm5': ['large','xlarge','2xlarge','4xlarge','8xlarge'],
  'm5a':['large','xlarge','2xlarge','4xlarge'],
  'm6i':['large','xlarge','2xlarge','4xlarge','8xlarge'],
  'm6a':['large','xlarge','2xlarge','4xlarge'],
  'c5': ['large','xlarge','2xlarge','4xlarge','9xlarge'],
  'c6i':['large','xlarge','2xlarge','4xlarge','8xlarge'],
  'r5': ['large','xlarge','2xlarge','4xlarge','8xlarge'],
  'r6i':['large','xlarge','2xlarge','4xlarge','8xlarge'],
};

const RDS_FAMILIES = {
  'db.t3': ['micro','small','medium','large','xlarge','2xlarge'],
  'db.t4g':['micro','small','medium','large','xlarge','2xlarge'],
  'db.m5': ['large','xlarge','2xlarge','4xlarge','8xlarge'],
  'db.m6g':['large','xlarge','2xlarge','4xlarge'],
  'db.r5': ['large','xlarge','2xlarge','4xlarge','8xlarge'],
  'db.r6g':['large','xlarge','2xlarge','4xlarge'],
};

// ── Recommendation engine ─────────────────────────────────────────────────────
function recommend(instanceType, avgCpu, maxCpu, isRds) {
  const families = isRds ? RDS_FAMILIES : EC2_FAMILIES;
  const pricing  = isRds ? RDS_MONTHLY  : EC2_MONTHLY;

  let family, size;
  if (isRds) {
    const parts = instanceType.split('.');           // 'db.t3.medium' → ['db','t3','medium']
    if (parts.length < 3) return null;
    family = parts.slice(0, 2).join('.');            // 'db.t3'
    size   = parts.slice(2).join('.');               // 'medium'
  } else {
    const dot = instanceType.indexOf('.');
    if (dot < 0) return null;
    family = instanceType.slice(0, dot);             // 't3'
    size   = instanceType.slice(dot + 1);            // 'large'
  }

  const sizes = families[family];
  if (!sizes) return null;
  const idx = sizes.indexOf(size);
  if (idx < 0) return null;

  let steps = 0, confidence = 'medium';
  if      (avgCpu < 5  && maxCpu < 20) { steps = 2; confidence = 'high';   }
  else if (avgCpu < 15 && maxCpu < 40) { steps = 1; confidence = 'medium'; }
  else return null; // well-utilized

  const newIdx = Math.max(0, idx - steps);
  if (newIdx >= idx) return null;

  const newType      = `${family}.${sizes[newIdx]}`;
  const currentCost  = pricing[instanceType] ?? null;
  const newCost      = pricing[newType]      ?? null;
  const savings      = (currentCost != null && newCost != null) ? +(currentCost - newCost).toFixed(2) : null;

  return { recommendedType: newType, confidence, currentMonthlyCost: currentCost, recommendedMonthlyCost: newCost, monthlySavings: savings };
}

// ── Batch CloudWatch helper ───────────────────────────────────────────────────
function avg(vals) { return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0; }
function max(vals) { return vals.length ? Math.max(...vals) : 0; }

async function batchMetrics(cw, queries, startTime, endTime) {
  const results = new Map(); // id → values[]
  const CHUNK = 500;

  for (let i = 0; i < queries.length; i += CHUNK) {
    const chunk = queries.slice(i, i + CHUNK);
    try {
      const r = await cw.send(new GetMetricDataCommand({ MetricDataQueries: chunk, StartTime: startTime, EndTime: endTime }));
      for (const m of (r.MetricDataResults ?? [])) results.set(m.Id, m.Values ?? []);
    } catch (_) {}
  }
  return results;
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const region = req.query.region || process.env.AWS_REGION || 'us-east-1';
  const credentials = { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY };

  const ec2 = new EC2Client({ region, credentials });
  const rds = new RDSClient({ region, credentials });
  const cw  = new CloudWatchClient({ region, credentials });

  const endTime   = new Date();
  const startTime = new Date(endTime - 14 * 24 * 60 * 60 * 1000);

  const [instancesR, rdsR] = await Promise.allSettled([
    ec2.send(new DescribeInstancesCommand({ Filters: [{ Name: 'instance-state-name', Values: ['running'] }] })),
    rds.send(new DescribeDBInstancesCommand({})),
  ]);

  const instances    = instancesR.value?.Reservations?.flatMap(r => r.Instances) ?? [];
  const rdsInstances = rdsR.value?.DBInstances ?? [];
  const getName = (tags, fallback) => tags?.find(t => t.Key === 'Name')?.Value || fallback;

  // ── Build CloudWatch queries ──────────────────────────────────────────────
  const ec2Queries = [];
  instances.forEach((inst, i) => {
    const dims = [{ Name: 'InstanceId', Value: inst.InstanceId }];
    ec2Queries.push(
      { Id: `ea${i}`, MetricStat: { Metric: { Namespace: 'AWS/EC2', MetricName: 'CPUUtilization', Dimensions: dims }, Period: 3600, Stat: 'Average' }, ReturnData: true },
      { Id: `em${i}`, MetricStat: { Metric: { Namespace: 'AWS/EC2', MetricName: 'CPUUtilization', Dimensions: dims }, Period: 3600, Stat: 'Maximum' }, ReturnData: true },
    );
  });

  const rdsQueries = [];
  rdsInstances.forEach((db, i) => {
    const dims = [{ Name: 'DBInstanceIdentifier', Value: db.DBInstanceIdentifier }];
    rdsQueries.push(
      { Id: `ra${i}`, MetricStat: { Metric: { Namespace: 'AWS/RDS', MetricName: 'CPUUtilization',    Dimensions: dims }, Period: 3600, Stat: 'Average' }, ReturnData: true },
      { Id: `rm${i}`, MetricStat: { Metric: { Namespace: 'AWS/RDS', MetricName: 'CPUUtilization',    Dimensions: dims }, Period: 3600, Stat: 'Maximum' }, ReturnData: true },
      { Id: `rc${i}`, MetricStat: { Metric: { Namespace: 'AWS/RDS', MetricName: 'DatabaseConnections', Dimensions: dims }, Period: 3600, Stat: 'Average' }, ReturnData: true },
    );
  });

  const [ec2Metrics, rdsMetrics] = await Promise.all([
    batchMetrics(cw, ec2Queries, startTime, endTime),
    batchMetrics(cw, rdsQueries, startTime, endTime),
  ]);

  // ── Build EC2 results ─────────────────────────────────────────────────────
  const ec2Results = instances.map((inst, i) => {
    const avgCpu = +avg(ec2Metrics.get(`ea${i}`) ?? []).toFixed(1);
    const maxCpu = +max(ec2Metrics.get(`em${i}`) ?? []).toFixed(1);
    const hasData = (ec2Metrics.get(`ea${i}`) ?? []).length > 0;
    const rec = hasData ? recommend(inst.InstanceType, avgCpu, maxCpu, false) : null;

    return {
      id: inst.InstanceId,
      name: getName(inst.Tags, inst.InstanceId),
      instanceType: inst.InstanceType,
      state: inst.State?.Name,
      avgCpu, maxCpu, hasData,
      currentMonthlyCost: EC2_MONTHLY[inst.InstanceType] ?? null,
      recommendation: rec,
    };
  });

  // ── Build RDS results ─────────────────────────────────────────────────────
  const rdsResults = rdsInstances.map((db, i) => {
    const avgCpu  = +avg(rdsMetrics.get(`ra${i}`) ?? []).toFixed(1);
    const maxCpu  = +max(rdsMetrics.get(`rm${i}`) ?? []).toFixed(1);
    const avgConn = +avg(rdsMetrics.get(`rc${i}`) ?? []).toFixed(0);
    const hasData = (rdsMetrics.get(`ra${i}`) ?? []).length > 0;
    const rec = hasData ? recommend(db.DBInstanceClass, avgCpu, maxCpu, true) : null;

    return {
      id: db.DBInstanceIdentifier,
      engine: `${db.Engine} ${db.EngineVersion}`,
      instanceClass: db.DBInstanceClass,
      status: db.DBInstanceStatus,
      avgCpu, maxCpu, avgConn, hasData,
      currentMonthlyCost: RDS_MONTHLY[db.DBInstanceClass] ?? null,
      recommendation: rec,
    };
  });

  const allRecs = [...ec2Results, ...rdsResults].map(r => r.recommendation).filter(Boolean);
  const totalSavings = allRecs.reduce((s, r) => s + (r.monthlySavings ?? 0), 0);

  res.json({
    ec2: ec2Results,
    rds: rdsResults,
    summary: {
      ec2Count: ec2Results.length,
      rdsCount: rdsResults.length,
      overProvisionedCount: allRecs.length,
      totalMonthlySavings: +totalSavings.toFixed(2),
      analyzedAt: new Date().toISOString(),
      windowDays: 14,
    },
  });
});

module.exports = router;
