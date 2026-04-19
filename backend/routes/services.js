const router = require('express').Router();
const { CostExplorerClient, GetCostAndUsageCommand } = require('@aws-sdk/client-cost-explorer');

function getCEClient() {
  return new CostExplorerClient({
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

function fmt(d) { return d.toISOString().split('T')[0]; }

router.get('/', async (req, res) => {
  const client = getCEClient();
  const now = new Date();
  const start90 = new Date(now); start90.setDate(start90.getDate() - 90);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfMonth = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
  const startOfLastMonth = fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const endOfLastMonth = fmt(new Date(now.getFullYear(), now.getMonth(), 1));

  try {
    const [currentMonth, lastMonth, daily90] = await Promise.all([
      client.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: startOfMonth, End: fmt(tomorrow) },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
      })),
      client.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: startOfLastMonth, End: endOfLastMonth },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
      })),
      client.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: fmt(start90), End: fmt(tomorrow) },
        Granularity: 'DAILY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
      })),
    ]);

    const serviceMap = {};

    for (const g of (currentMonth.ResultsByTime?.[0]?.Groups || [])) {
      const name = g.Keys[0];
      const cost = parseFloat(g.Metrics.UnblendedCost.Amount);
      if (cost > 0) {
        serviceMap[name] = { name, currentMonthCost: cost, lastMonthCost: 0, lastAccessed: null, active: true };
      }
    }

    for (const g of (lastMonth.ResultsByTime?.[0]?.Groups || [])) {
      const name = g.Keys[0];
      const cost = parseFloat(g.Metrics.UnblendedCost.Amount);
      if (cost > 0) {
        if (!serviceMap[name]) serviceMap[name] = { name, currentMonthCost: 0, lastMonthCost: 0, lastAccessed: null, active: false };
        serviceMap[name].lastMonthCost = cost;
      }
    }

    for (const day of (daily90.ResultsByTime || [])) {
      const dateStr = day.TimePeriod.Start;
      for (const g of (day.Groups || [])) {
        const name = g.Keys[0];
        const cost = parseFloat(g.Metrics.UnblendedCost.Amount);
        if (cost > 0) {
          if (!serviceMap[name]) serviceMap[name] = { name, currentMonthCost: 0, lastMonthCost: 0, lastAccessed: null, active: false };
          if (!serviceMap[name].lastAccessed || dateStr > serviceMap[name].lastAccessed) {
            serviceMap[name].lastAccessed = dateStr;
          }
        }
      }
    }

    const services = Object.values(serviceMap).map(s => ({
      ...s,
      status: s.currentMonthCost > 0 ? 'active' : s.lastMonthCost > 0 ? 'idle' : 'inactive',
      trend: s.lastMonthCost === 0 ? 'new'
        : s.currentMonthCost > s.lastMonthCost * 1.1 ? 'up'
        : s.currentMonthCost < s.lastMonthCost * 0.9 ? 'down'
        : 'stable',
      changePercent: s.lastMonthCost > 0
        ? ((s.currentMonthCost - s.lastMonthCost) / s.lastMonthCost) * 100
        : null,
    })).sort((a, b) => b.currentMonthCost - a.currentMonthCost);

    res.json({ services, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
