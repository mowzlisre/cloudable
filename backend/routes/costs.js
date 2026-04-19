const router = require('express').Router();
const {
  CostExplorerClient,
  GetCostAndUsageCommand,
  GetCostForecastCommand,
} = require('@aws-sdk/client-cost-explorer');

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
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const last30 = new Date(now); last30.setDate(last30.getDate() - 30);
  const startOfMonth = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
  const startOfLastMonth = fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const endOfLastMonth = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
  const endOfMonth = fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  try {
    const [mtd, lastMonth, daily, forecast] = await Promise.all([
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
      })),
      client.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: fmt(last30), End: fmt(tomorrow) },
        Granularity: 'DAILY',
        Metrics: ['UnblendedCost'],
      })),
      client.send(new GetCostForecastCommand({
        TimePeriod: { Start: fmt(tomorrow), End: endOfMonth },
        Metric: 'UNBLENDED_COST',
        Granularity: 'MONTHLY',
      })).catch(() => null),
    ]);

    const byService = (mtd.ResultsByTime?.[0]?.Groups || [])
      .map(g => ({ service: g.Keys[0], cost: parseFloat(g.Metrics.UnblendedCost.Amount) }))
      .filter(s => s.cost > 0.001)
      .sort((a, b) => b.cost - a.cost);

    const mtdTotal = byService.reduce((s, x) => s + x.cost, 0);
    const lastMonthTotal = parseFloat(lastMonth.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount || 0);
    const remainingForecast = forecast ? parseFloat(forecast.Total?.Amount || 0) : null;
    const forecastTotal = remainingForecast !== null ? mtdTotal + remainingForecast : null;

    const dailyData = (daily.ResultsByTime || []).map(r => ({
      date: r.TimePeriod.Start,
      cost: parseFloat(r.Total?.UnblendedCost?.Amount || 0),
    }));

    res.json({ mtdTotal, lastMonthTotal, forecastTotal, byService, dailyData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/daily-by-service', async (req, res) => {
  const client = getCEClient();
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  const startOfMonth = fmt(new Date(now.getFullYear(), now.getMonth(), 1));

  try {
    const data = await client.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: startOfMonth, End: fmt(tomorrow) },
      Granularity: 'DAILY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    }));

    const serviceTotals = {};
    for (const day of (data.ResultsByTime || [])) {
      for (const g of (day.Groups || [])) {
        const name = g.Keys[0];
        const cost = parseFloat(g.Metrics.UnblendedCost.Amount);
        serviceTotals[name] = (serviceTotals[name] || 0) + cost;
      }
    }

    const topServices = Object.entries(serviceTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);

    const days = (data.ResultsByTime || []).map(day => {
      const row = { date: day.TimePeriod.Start };
      for (const svc of topServices) row[svc] = 0;
      for (const g of (day.Groups || [])) {
        if (topServices.includes(g.Keys[0])) {
          row[g.Keys[0]] = parseFloat(g.Metrics.UnblendedCost.Amount);
        }
      }
      return row;
    });

    res.json({ days, services: topServices });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
