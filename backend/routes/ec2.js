const router = require('express').Router();
const { EC2Client, DescribeInstancesCommand, DescribeVolumesCommand } = require('@aws-sdk/client-ec2');
const { CloudWatchClient, GetMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

router.get('/', async (req, res) => {
  const region = req.query.region || process.env.AWS_REGION || 'us-east-1';
  const credentials = { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY };
  const ec2 = new EC2Client({ region, credentials });
  const cw  = new CloudWatchClient({ region, credentials });

  const [instR, volR] = await Promise.allSettled([
    ec2.send(new DescribeInstancesCommand({ Filters: [{ Name: 'instance-state-name', Values: ['running', 'stopped', 'stopping'] }] })),
    ec2.send(new DescribeVolumesCommand({})),
  ]);

  const instances = instR.value?.Reservations?.flatMap(r => r.Instances) ?? [];
  const volumes   = volR.value?.Volumes ?? [];

  const volsByInst = {};
  for (const v of volumes) {
    for (const a of (v.Attachments ?? [])) {
      if (!volsByInst[a.InstanceId]) volsByInst[a.InstanceId] = [];
      volsByInst[a.InstanceId].push({ size: v.Size, type: v.VolumeType, id: v.VolumeId });
    }
  }

  const getName = (tags, fallback) => tags?.find(t => t.Key === 'Name')?.Value || fallback;

  const endTime   = new Date();
  const startTime = new Date(endTime - 7 * 24 * 60 * 60 * 1000);
  const queries   = instances
    .filter(i => i.State?.Name === 'running')
    .flatMap((inst, idx) => {
      const dims = [{ Name: 'InstanceId', Value: inst.InstanceId }];
      return [
        { Id: `ca${idx}`, MetricStat: { Metric: { Namespace: 'AWS/EC2', MetricName: 'CPUUtilization', Dimensions: dims }, Period: 3600, Stat: 'Average' }, ReturnData: true },
        { Id: `nm${idx}`, MetricStat: { Metric: { Namespace: 'AWS/EC2', MetricName: 'NetworkIn', Dimensions: dims }, Period: 86400, Stat: 'Sum' }, ReturnData: true },
      ];
    });

  const cwMap = new Map();
  for (let i = 0; i < queries.length; i += 500) {
    try {
      const r = await cw.send(new GetMetricDataCommand({ MetricDataQueries: queries.slice(i, i + 500), StartTime: startTime, EndTime: endTime }));
      for (const m of (r.MetricDataResults ?? [])) cwMap.set(m.Id, m.Values ?? []);
    } catch (_) {}
  }

  const runningIdx = {};
  let ri = 0;
  for (const inst of instances) {
    if (inst.State?.Name === 'running') runningIdx[inst.InstanceId] = ri++;
  }

  const data = instances.map(inst => {
    const idx = runningIdx[inst.InstanceId];
    const cpuVals = idx !== undefined ? (cwMap.get(`ca${idx}`) ?? []) : [];
    const netVals = idx !== undefined ? (cwMap.get(`nm${idx}`) ?? []) : [];
    const avgCpu = cpuVals.length ? +(cpuVals.reduce((s, v) => s + v, 0) / cpuVals.length).toFixed(1) : null;
    const maxCpu = cpuVals.length ? +Math.max(...cpuVals).toFixed(1) : null;
    const totalNetIn = netVals.length ? +(netVals.reduce((s, v) => s + v, 0) / 1024 / 1024).toFixed(1) : null;
    const vols = volsByInst[inst.InstanceId] ?? [];
    const totalStorage = vols.reduce((s, v) => s + (v.size ?? 0), 0);

    return {
      id: inst.InstanceId,
      name: getName(inst.Tags, inst.InstanceId),
      instanceType: inst.InstanceType,
      state: inst.State?.Name,
      platform: inst.Platform || 'linux',
      privateIp: inst.PrivateIpAddress,
      publicIp: inst.PublicIpAddress,
      az: inst.Placement?.AvailabilityZone,
      launchTime: inst.LaunchTime,
      vpcId: inst.VpcId,
      subnetId: inst.SubnetId,
      volumes: vols,
      totalStorageGb: totalStorage,
      avgCpu7d: avgCpu,
      maxCpu7d: maxCpu,
      netInMb7d: totalNetIn,
      imageId: inst.ImageId,
      keyName: inst.KeyName,
      tags: inst.Tags?.filter(t => !['Name'].includes(t.Key)).map(t => `${t.Key}=${t.Value}`) ?? [],
    };
  });

  res.json({ instances: data, count: data.length, region });
});

module.exports = router;
