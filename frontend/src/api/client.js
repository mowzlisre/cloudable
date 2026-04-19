const BASE = import.meta.env.VITE_API_URL || '';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => get('/api/health'),
  services: () => get('/api/services'),
  costs: () => get('/api/costs'),
  costsDailyByService: () => get('/api/costs/daily-by-service'),
  hidden: () => get('/api/hidden'),
  invoice: () => get('/api/invoice'),
  mapper: (region) => get(`/api/mapper${region ? `?region=${region}` : ''}`),
  hygiene: (region) => get(`/api/hygiene${region ? `?region=${region}` : ''}`),
  rightsizing:   (region) => get(`/api/rightsizing${region ? `?region=${region}` : ''}`),
  aggregate:     ()       => get('/api/aggregate'),
  ec2:           (region) => get(`/api/ec2${region ? `?region=${region}` : ''}`),
  rds:           (region) => get(`/api/rds${region ? `?region=${region}` : ''}`),
  s3:            ()       => get('/api/s3'),
  organizations: ()       => get('/api/organizations'),
  others:        (region) => get(`/api/others${region ? `?region=${region}` : ''}`),
};
