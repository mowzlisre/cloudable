const router = require('express').Router();
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

function getCreds() {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

router.get('/', async (req, res) => {
  try {
    const client = new STSClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: getCreds(),
    });
    const data = await client.send(new GetCallerIdentityCommand({}));
    res.json({
      status: 'ok',
      account: data.Account,
      arn: data.Arn,
      userId: data.UserId,
      region: process.env.AWS_REGION || 'us-east-1',
    });
  } catch (err) {
    res.status(401).json({ status: 'error', error: err.message });
  }
});

module.exports = router;
