const router = require('express').Router();
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');
const { EC2Client, DescribeInstancesCommand } = require('@aws-sdk/client-ec2');
const { RDSClient, DescribeDBInstancesCommand } = require('@aws-sdk/client-rds');
const credStore = require('../lib/credentials');

async function queryAccount(profile) {
  const credentials = { accessKeyId: profile.accessKeyId, secretAccessKey: profile.secretKey };
  const region = profile.region || 'us-east-1';

  const sts = new STSClient({ region, credentials });
  const ce  = new CostExplorerClient({ region: 'us-east-1', credentials });
  const ec2 = new EC2Client({ region, credentials });
  const rds = new RDSClient({ region, credentials });

  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt   = d => d.toISOString().slice(0, 10);

  const [identityR, costR, ec2R, rdsR] = await Promise.allSettled([
    sts.send(new GetCallerIdentityCommand({})),
    ce.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: fmt(start), End: fmt(now) },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    })),
    ec2.send(new DescribeInstancesCommand({ Filters: [{ Name: 'instance-state-name', Values: ['running'] }] })),
    rds.send(new DescribeDBInstancesCommand({})),
  ]);

  const accountId = identityR.value?.Account ?? 'unknown';

  const services = {};
  let totalCost = 0;
  for (const result of costR.value?.ResultsByTime ?? []) {
    for (const group of result.Groups ?? []) {
      const svc = group.Keys?.[0] ?? 'Other';
      const amt = parseFloat(group.Metrics?.UnblendedCost?.Amount ?? 0);
      services[svc] = (services[svc] ?? 0) + amt;
      totalCost += amt;
    }
  }

  const ec2Count = ec2R.value?.Reservations?.flatMap(r => r.Instances).length ?? 0;
  const rdsCount = rdsR.value?.DBInstances?.length ?? 0;

  return {
    profileId:   profile.id,
    profileName: profile.name,
    accountId,
    region,
    totalMonthlyCost: +totalCost.toFixed(2),
    topServices: Object.entries(services)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([service, cost]) => ({ service, cost: +cost.toFixed(2) })),
    resourceCount: { ec2: ec2Count, rds: rdsCount },
    error: null,
  };
}

router.get('/', async (req, res) => {
  const active   = credStore.getActive();
  const profiles = credStore.getProfiles();

  const all = [];
  if (active?.accessKeyId) {
    all.push({ id: '__primary__', name: 'Primary', accessKeyId: active.accessKeyId, secretKey: active.secretKey, region: active.region });
  }
  for (const p of profiles) all.push(p);

  if (all.length === 0) {
    return res.json({ accounts: [], combinedTotal: 0, scannedAt: new Date().toISOString() });
  }

  const results = await Promise.allSettled(all.map(queryAccount));

  const accounts = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      profileId: all[i].id, profileName: all[i].name,
      accountId: 'unknown', region: all[i].region,
      totalMonthlyCost: 0, topServices: [],
      resourceCount: { ec2: 0, rds: 0 },
      error: r.reason?.message ?? 'Query failed',
    };
  });

  const combinedTotal = +accounts.reduce((s, a) => s + a.totalMonthlyCost, 0).toFixed(2);
  res.json({ accounts, combinedTotal, scannedAt: new Date().toISOString() });
});

module.exports = router;
