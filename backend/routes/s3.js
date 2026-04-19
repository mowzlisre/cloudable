const router = require('express').Router();
const {
  S3Client, ListBucketsCommand, GetBucketLocationCommand,
  GetBucketLifecycleConfigurationCommand, GetBucketVersioningCommand,
  GetPublicAccessBlockCommand, ListMultipartUploadsCommand,
  GetBucketTaggingCommand,
} = require('@aws-sdk/client-s3');
const { CloudWatchClient, GetMetricStatisticsCommand } = require('@aws-sdk/client-cloudwatch');

async function getBucketLocation(s3, bucket) {
  try {
    const r = await s3.send(new GetBucketLocationCommand({ Bucket: bucket }));
    return r.LocationConstraint || 'us-east-1';
  } catch (_) { return 'us-east-1'; }
}

async function analyzeOneBucket(s3, cw, bucket) {
  const [lifecycleR, versionR, publicR, mpuR, tagsR] = await Promise.allSettled([
    s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket })),
    s3.send(new GetBucketVersioningCommand({ Bucket: bucket })),
    s3.send(new GetPublicAccessBlockCommand({ Bucket: bucket })),
    s3.send(new ListMultipartUploadsCommand({ Bucket: bucket })),
    s3.send(new GetBucketTaggingCommand({ Bucket: bucket })),
  ]);

  const hasLifecycle   = lifecycleR.status === 'fulfilled' && (lifecycleR.value?.Rules?.length ?? 0) > 0;
  const versioningStatus = versionR.status === 'fulfilled' ? (versionR.value?.Status ?? 'Disabled') : 'Unknown';
  const publicBlocked  = publicR.status === 'fulfilled'
    ? (publicR.value?.PublicAccessBlockConfiguration?.BlockPublicAcls && publicR.value?.PublicAccessBlockConfiguration?.RestrictPublicBuckets)
    : null;
  const incompleteMPUs = mpuR.status === 'fulfilled' ? (mpuR.value?.Uploads?.length ?? 0) : 0;
  const tags           = tagsR.status === 'fulfilled' ? (tagsR.value?.TagSet ?? []) : [];

  // Approximate size from CW StorageMetrics (daily)
  let sizeBytes = null;
  let objectCount = null;
  try {
    const endTime   = new Date();
    const startTime = new Date(endTime - 2 * 24 * 60 * 60 * 1000);
    const [szR, cntR] = await Promise.allSettled([
      cw.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/S3', MetricName: 'BucketSizeBytes',
        Dimensions: [{ Name: 'BucketName', Value: bucket }, { Name: 'StorageType', Value: 'StandardStorage' }],
        StartTime: startTime, EndTime: endTime, Period: 86400, Statistics: ['Average'],
      })),
      cw.send(new GetMetricStatisticsCommand({
        Namespace: 'AWS/S3', MetricName: 'NumberOfObjects',
        Dimensions: [{ Name: 'BucketName', Value: bucket }, { Name: 'StorageType', Value: 'AllStorageTypes' }],
        StartTime: startTime, EndTime: endTime, Period: 86400, Statistics: ['Average'],
      })),
    ]);
    const szPts  = szR.value?.Datapoints ?? [];
    const cntPts = cntR.value?.Datapoints ?? [];
    if (szPts.length)  sizeBytes   = szPts.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))[0].Average;
    if (cntPts.length) objectCount = Math.round(cntPts.sort((a, b) => new Date(b.Timestamp) - new Date(a.Timestamp))[0].Average);
  } catch (_) {}

  const sizeGb     = sizeBytes != null ? +(sizeBytes / 1024 / 1024 / 1024).toFixed(3) : null;
  const wasteFlags = [];
  if (!hasLifecycle)             wasteFlags.push('No lifecycle policy');
  if (versioningStatus === 'Enabled' && !hasLifecycle) wasteFlags.push('Versioning on, no expiry rule');
  if (incompleteMPUs > 0)        wasteFlags.push(`${incompleteMPUs} incomplete uploads`);
  if (publicBlocked === false)   wasteFlags.push('Public access not fully blocked');

  return {
    hasLifecycle, versioningStatus, publicBlocked, incompleteMPUs,
    sizeGb, objectCount, wasteFlags,
    tags: tags.map(t => `${t.Key}=${t.Value}`),
  };
}

router.get('/', async (req, res) => {
  const credentials = { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY };
  const s3global = new S3Client({ region: 'us-east-1', credentials });

  const listR = await s3global.send(new ListBucketsCommand({})).catch(() => null);
  const buckets = listR?.Buckets ?? [];

  // Analyze in parallel batches of 10 to avoid throttling
  const BATCH = 10;
  const results = [];
  for (let i = 0; i < buckets.length; i += BATCH) {
    const batch = buckets.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(batch.map(async b => {
      const region = await getBucketLocation(s3global, b.Name);
      const s3     = new S3Client({ region, credentials });
      const cw     = new CloudWatchClient({ region: 'us-east-1', credentials });
      const analysis = await analyzeOneBucket(s3, cw, b.Name);
      return { name: b.Name, creationDate: b.CreationDate, region, ...analysis };
    }));
    for (const r of batchResults) {
      results.push(r.status === 'fulfilled' ? r.value : { name: batch[results.length - (results.length % BATCH || BATCH) + batchResults.indexOf(r)]?.Name, error: r.reason?.message });
    }
  }

  const totalSizeGb  = results.reduce((s, b) => s + (b.sizeGb ?? 0), 0);
  const wasteCount   = results.filter(b => b.wasteFlags?.length > 0).length;

  res.json({ buckets: results, count: results.length, totalSizeGb: +totalSizeGb.toFixed(3), wasteCount });
});

module.exports = router;
