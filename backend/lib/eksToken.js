// Generates a bearer token for the Kubernetes API server, using the same
// scheme as `aws eks get-token` / aws-iam-authenticator: a presigned STS
// GetCallerIdentity URL, base64url-encoded and prefixed with "k8s-aws-v1.".
const { Hash } = require('@smithy/hash-node');
const { SignatureV4 } = require('@smithy/signature-v4');
const { HttpRequest } = require('@smithy/protocol-http');

class Sha256 extends Hash {
  constructor(secret) { super('sha256', secret); }
}

async function getEksToken({ clusterName, region, credentials }) {
  const hostname = `sts.${region}.amazonaws.com`;
  const signer = new SignatureV4({ service: 'sts', region, credentials, sha256: Sha256 });

  const request = new HttpRequest({
    protocol: 'https:',
    hostname,
    port: 443,
    method: 'GET',
    path: '/',
    query: { Action: 'GetCallerIdentity', Version: '2011-06-15' },
    headers: { host: hostname, 'x-k8s-aws-id': clusterName },
  });

  const presigned = await signer.presign(request, { expiresIn: 60 });

  const qs = Object.entries(presigned.query)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `https://${presigned.hostname}${presigned.path}?${qs}`;

  return 'k8s-aws-v1.' + Buffer.from(url).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

module.exports = { getEksToken };
