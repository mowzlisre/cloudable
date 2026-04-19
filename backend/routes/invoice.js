const router = require('express').Router();
const { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } = require('@aws-sdk/client-cost-explorer');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

function fmt(d) { return d.toISOString().split('T')[0]; }

router.get('/', async (req, res) => {
  const credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
  const ce = new CostExplorerClient({ region: 'us-east-1', credentials });
  const sts = new STSClient({ region: process.env.AWS_REGION || 'us-east-1', credentials });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const [mtdData, forecastData, identity] = await Promise.allSettled([
      ce.send(new GetCostAndUsageCommand({
        TimePeriod: { Start: fmt(startOfMonth), End: fmt(tomorrow) },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
      })),
      ce.send(new GetCostForecastCommand({
        TimePeriod: { Start: fmt(tomorrow), End: fmt(endOfMonth) },
        Metric: 'UNBLENDED_COST',
        Granularity: 'MONTHLY',
      })),
      sts.send(new GetCallerIdentityCommand({})),
    ]);

    const lineItems = (mtdData.value?.ResultsByTime?.[0]?.Groups || [])
      .map(g => ({
        service: g.Keys[0],
        mtdCost: parseFloat(g.Metrics.UnblendedCost.Amount),
      }))
      .filter(li => li.mtdCost > 0.001)
      .sort((a, b) => b.mtdCost - a.mtdCost);

    const mtdTotal = lineItems.reduce((s, li) => s + li.mtdCost, 0);
    const remainingForecast = forecastData.value ? parseFloat(forecastData.value.Total?.Amount || 0) : null;
    const monthEndEstimate = remainingForecast !== null ? mtdTotal + remainingForecast : null;

    const daysInMonth = endOfMonth.getDate();
    const dayOfMonth = now.getDate();

    res.json({
      invoiceNumber: `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`,
      period: {
        start: fmt(startOfMonth),
        end: fmt(endOfMonth),
        today: fmt(now),
        daysElapsed: dayOfMonth,
        daysRemaining: daysInMonth - dayOfMonth,
        daysInMonth,
        completionPercent: Math.round((dayOfMonth / daysInMonth) * 100),
      },
      account: identity.value ? { id: identity.value.Account, arn: identity.value.Arn } : null,
      lineItems,
      mtdTotal,
      monthEndEstimate,
      remainingForecast,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
