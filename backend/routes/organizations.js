const router = require('express').Router();
const { OrganizationsClient, ListAccountsCommand } = require('@aws-sdk/client-organizations');
const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');

router.get('/', async (req, res) => {
  const credentials = { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY };
  const org = new OrganizationsClient({ region: 'us-east-1', credentials });
  const ce  = new CostExplorerClient({ region: 'us-east-1', credentials });

  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const prev  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const fmt   = d => d.toISOString().slice(0, 10);

  const [accountsR, costsMtdR, costsLastR] = await Promise.allSettled([
    org.send(new ListAccountsCommand({})),
    ce.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: fmt(start), End: fmt(now) },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'LINKED_ACCOUNT' }],
    })),
    ce.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: fmt(prev), End: fmt(prevEnd) },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'LINKED_ACCOUNT' }],
    })),
  ]);

  if (accountsR.status === 'rejected') {
    return res.json({ accounts: [], notInOrg: true, message: 'Not an Organizations management account or insufficient permissions.' });
  }

  const accounts = accountsR.value?.Accounts ?? [];
  const mtdMap   = {};
  const lastMap  = {};

  for (const result of costsMtdR.value?.ResultsByTime ?? []) {
    for (const g of result.Groups ?? []) {
      const id = g.Keys?.[0];
      if (id) mtdMap[id] = +(parseFloat(g.Metrics?.UnblendedCost?.Amount ?? 0)).toFixed(2);
    }
  }
  for (const result of costsLastR.value?.ResultsByTime ?? []) {
    for (const g of result.Groups ?? []) {
      const id = g.Keys?.[0];
      if (id) lastMap[id] = +(parseFloat(g.Metrics?.UnblendedCost?.Amount ?? 0)).toFixed(2);
    }
  }

  const enriched = accounts.map(a => ({
    id: a.Id,
    name: a.Name,
    email: a.Email,
    status: a.Status,
    joinedTimestamp: a.JoinedTimestamp,
    mtdCost: mtdMap[a.Id] ?? 0,
    lastMonthCost: lastMap[a.Id] ?? 0,
  })).sort((a, b) => b.mtdCost - a.mtdCost);

  const totalMtd  = +enriched.reduce((s, a) => s + a.mtdCost, 0).toFixed(2);
  const totalLast = +enriched.reduce((s, a) => s + a.lastMonthCost, 0).toFixed(2);

  res.json({ accounts: enriched, totalMtd, totalLastMonth: totalLast, count: enriched.length });
});

module.exports = router;
