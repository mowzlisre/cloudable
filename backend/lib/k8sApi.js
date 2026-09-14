const https = require('https');

// Minimal REST client for the Kubernetes API server — avoids pulling in the
// full @kubernetes/client-node dependency for a handful of read-only GETs.
function k8sGet(endpoint, caData, token, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path,
      method: 'GET',
      ca: Buffer.from(caData, 'base64'),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
        } else {
          reject(new Error(`Kubernetes API ${path} returned ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error(`Kubernetes API request to ${path} timed out`)));
    req.end();
  });
}

module.exports = { k8sGet };
