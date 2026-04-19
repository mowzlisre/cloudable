import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Key, Save, Trash2, CheckCircle2, XCircle, RefreshCw, ShieldCheck, Globe, Plus, Users, ChevronDown, Copy, Lock } from 'lucide-react';
import { api } from '../api/client';

const isElectron = !!window.electronAPI;

const REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1', 'eu-north-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-south-1',
  'ca-central-1', 'sa-east-1', 'af-south-1', 'me-south-1',
];

const IAM_POLICY = JSON.stringify({
  Version: '2012-10-17',
  Statement: [
    { Sid: 'CloudableReadOnly', Effect: 'Allow', Action: [
      'ce:GetCostAndUsage', 'ce:GetCostForecast', 'ce:GetDimensionValues',
      'ec2:DescribeInstances', 'ec2:DescribeVpcs', 'ec2:DescribeSubnets',
      'ec2:DescribeSecurityGroups', 'ec2:DescribeInternetGateways',
      'ec2:DescribeNatGateways', 'ec2:DescribeAddresses', 'ec2:DescribeRouteTables',
      'ec2:DescribeVolumes', 'rds:DescribeDBInstances', 'rds:DescribeDBClusters',
      'rds:ListTagsForResource', 's3:ListAllMyBuckets', 's3:GetBucketLocation',
      's3:GetBucketTagging', 's3:GetBucketVersioning', 's3:GetLifecycleConfiguration',
      's3:GetBucketPublicAccessBlock', 's3:ListMultipartUploadParts',
      's3:ListBucketMultipartUploads', 'elasticloadbalancing:DescribeLoadBalancers',
      'elasticloadbalancing:DescribeTargetGroups', 'elasticloadbalancing:DescribeTargetHealth',
      'cloudwatch:GetMetricData', 'cloudwatch:GetMetricStatistics',
      'lambda:ListFunctions', 'ecs:ListClusters', 'ecs:ListServices', 'ecs:DescribeServices',
      'ecs:DescribeClusters', 'cloudfront:ListDistributions', 'route53:ListHostedZones',
      'route53:ListResourceRecordSets', 'iam:GetUser', 'sts:GetCallerIdentity',
      'organizations:ListAccounts', 'organizations:DescribeOrganization',
    ], Resource: '*' },
  ],
}, null, 2);

function PolicyAccordion() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(IAM_POLICY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-[#1a1a1a] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#0e0e0e] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-indigo-950/40 rounded-lg"><Lock size={13} className="text-indigo-400" /></div>
          <div>
            <p className="text-sm font-medium text-white">Required IAM Permissions</p>
            <p className="text-xs text-gray-600 mt-0.5">All permissions are read-only. No write or delete access required.</p>
          </div>
        </div>
        <ChevronDown size={14} className={`text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-[#1a1a1a] bg-[#080808]">
          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">Copy and attach this policy to your IAM user or role.</p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-[#1e1e1e] hover:border-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-all"
              >
                {copied ? <><CheckCircle2 size={12} className="text-emerald-400" /> Copied</> : <><Copy size={12} /> Copy policy</>}
              </button>
            </div>
            <pre className="text-[10px] font-mono text-gray-500 bg-[#0c0c0c] border border-[#1a1a1a] rounded-lg p-4 overflow-x-auto max-h-64 overflow-y-auto leading-relaxed">
              {IAM_POLICY}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const qc = useQueryClient();

  const [form, setForm] = useState({ accessKeyId: '', secretKey: '', region: 'us-east-1' });
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [existing, setExisting] = useState(null);
  const [defaultRegion, setDefaultRegion] = useState('us-east-1');
  const [regionSaved, setRegionSaved] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [profileForm, setProfileForm] = useState({ name: '', accessKeyId: '', secretKey: '', region: 'us-east-1' });
  const [showProfileSecret, setShowProfileSecret] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (isElectron) {
      window.electronAPI.loadCredentials().then(creds => {
        setExisting(creds);
        setForm(f => ({ ...f, region: creds.region || 'us-east-1' }));
      });
      window.electronAPI.loadDefaultRegion().then(r => setDefaultRegion(r));
      window.electronAPI.loadProfiles().then(setProfiles);
    }
  }, []);

  async function handleSaveDefaultRegion(region) {
    await window.electronAPI.saveDefaultRegion(region);
    setDefaultRegion(region);
    setRegionSaved(true);
    setTimeout(() => setRegionSaved(false), 3000);
  }

  async function handleSave() {
    if (!form.accessKeyId.trim()) { setError('Access Key ID is required.'); return; }
    if (!form.secretKey.trim()) { setError('Secret Access Key is required.'); return; }
    setError('');
    setSaving(true);
    try {
      const result = await window.electronAPI.saveCredentials({
        accessKeyId: form.accessKeyId.trim(),
        secretKey: form.secretKey.trim(),
        region: form.region,
      });
      if (result.ok) {
        setSaved(true);
        setForm({ accessKeyId: '', secretKey: '', region: form.region });
        const updated = await window.electronAPI.loadCredentials();
        setExisting(updated);
        qc.invalidateQueries();
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(result.error || 'Failed to save.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const data = await api.health();
      setTestResult({ ok: true, account: data.account, arn: data.arn, region: data.region });
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveProfile() {
    if (!profileForm.name.trim())        { setProfileError('Profile name is required.'); return; }
    if (!profileForm.accessKeyId.trim()) { setProfileError('Access Key ID is required.'); return; }
    if (!profileForm.secretKey.trim())   { setProfileError('Secret Access Key is required.'); return; }
    setProfileError('');
    setSavingProfile(true);
    try {
      const result = await window.electronAPI.saveProfile(profileForm);
      if (result.ok) {
        setProfileForm({ name: '', accessKeyId: '', secretKey: '', region: 'us-east-1' });
        setProfiles(await window.electronAPI.loadProfiles());
        setProfileSaved(true);
        qc.invalidateQueries({ queryKey: ['aggregate'] });
        setTimeout(() => setProfileSaved(false), 3000);
      } else setProfileError(result.error || 'Failed to save.');
    } finally { setSavingProfile(false); }
  }

  async function handleDeleteProfile(id) {
    if (!window.confirm('Remove this account profile?')) return;
    await window.electronAPI.deleteProfile(id);
    setProfiles(await window.electronAPI.loadProfiles());
    qc.invalidateQueries({ queryKey: ['aggregate'] });
  }

  async function handleClear() {
    if (!window.confirm('Remove stored credentials? You will need to re-enter them.')) return;
    await window.electronAPI.clearCredentials();
    setExisting(null);
    setTestResult(null);
    qc.invalidateQueries();
  }

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Credentials and preferences stored locally on this machine.</p>
        </div>

        {/* Default Region — top right */}
        <div className="flex items-center gap-2">
          <Globe size={13} className="text-gray-500" />
          <span className="text-xs text-gray-500">Default region</span>
          <select
            value={defaultRegion}
            onChange={e => handleSaveDefaultRegion(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-[#0e0e0e] border border-[#1e1e1e] rounded-lg text-red-400 font-mono focus:outline-none focus:border-red-800 transition-colors appearance-none cursor-pointer"
          >
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          {regionSaved && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 size={12} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-5 items-start">

        {/* LEFT — credentials stored + update form */}
        <div className="space-y-4">
          {/* Stored status */}
          {existing?.hasCredentials && (
            <div className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-emerald-950/60 rounded-lg">
                  <ShieldCheck size={14} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white">Credentials stored</p>
                  <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                    {existing.accessKeyId} · {existing.secretKeyMasked} · {existing.region}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} /> Clear
              </button>
            </div>
          )}

          {/* Update form */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-medium text-white">
              {existing?.hasCredentials ? 'Update credentials' : 'Enter your AWS credentials'}
            </h2>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">Access Key ID</label>
              <input
                type="text"
                value={form.accessKeyId}
                onChange={e => setForm(f => ({ ...f, accessKeyId: e.target.value }))}
                placeholder={existing?.accessKeyId ? `Current: ${existing.accessKeyId}` : 'AKIAIOSFODNN7EXAMPLE'}
                className="w-full px-3 py-2.5 text-sm bg-[#0e0e0e] border border-[#1e1e1e] rounded-lg text-white placeholder-gray-700 font-mono focus:outline-none focus:border-red-800 transition-colors"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">Secret Access Key</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={form.secretKey}
                  onChange={e => setForm(f => ({ ...f, secretKey: e.target.value }))}
                  placeholder={existing?.secretKeyMasked || 'wJalrXUtnFEMI/K7MDENG/...'}
                  className="w-full px-3 py-2.5 pr-10 text-sm bg-[#0e0e0e] border border-[#1e1e1e] rounded-lg text-white placeholder-gray-700 font-mono focus:outline-none focus:border-red-800 transition-colors"
                  autoComplete="new-password"
                  spellCheck={false}
                />
                <button
                  onClick={() => setShowSecret(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-500">Primary Region</label>
              <select
                value={form.region}
                onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-[#0e0e0e] border border-[#1e1e1e] rounded-lg text-white focus:outline-none focus:border-red-800 transition-colors appearance-none cursor-pointer"
              >
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <p className="text-[10px] text-gray-600">Used for EC2, RDS, and resource-level scans. Cost Explorer is always global.</p>
            </div>

            {error && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <XCircle size={12} /> {error}
              </p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
              >
                {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                {saving ? 'Saving...' : 'Save credentials'}
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 size={13} /> Saved securely
                </span>
              )}
            </div>
          </div>

          {/* Security note */}
          <div className="p-4 rounded-lg border border-[#1a1a1a] bg-[#0c0c0c]">
            <p className="text-[11px] text-gray-600 leading-relaxed">
              <span className="text-gray-400 font-medium">Security note:</span> Credentials are encrypted using your OS keychain (macOS Keychain, Windows DPAPI, or Linux Secret Service) via Electron's <code className="text-gray-500">safeStorage</code> API. Never sent to any external server.
            </p>
          </div>
        </div>

        {/* RIGHT — test connection + IAM permissions */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-white">Test Connection</h2>
              <button
                onClick={handleTest}
                disabled={testing || !existing?.hasCredentials}
                className="flex items-center gap-2 text-xs border border-[#1e1e1e] hover:border-[#2a2a2a] disabled:opacity-40 text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-all"
              >
                {testing ? <RefreshCw size={12} className="animate-spin" /> : <Key size={12} />}
                {testing ? 'Testing...' : 'Test now'}
              </button>
            </div>

            {!existing?.hasCredentials && !testResult && (
              <p className="text-xs text-gray-600">Save credentials first, then test the connection.</p>
            )}

            {testResult && (
              <div className={`p-3 rounded-lg border text-xs ${testResult.ok ? 'border-emerald-900/40 bg-emerald-950/20' : 'border-red-900/40 bg-red-950/20'}`}>
                {testResult.ok ? (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 text-emerald-400 font-medium">
                      <CheckCircle2 size={12} /> Connected successfully
                    </p>
                    <div className="space-y-1 pt-1 border-t border-[#1a1a1a]">
                      <p className="text-gray-500">Account ID</p>
                      <p className="font-mono text-white">{testResult.account}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-500">Region</p>
                      <p className="font-mono text-white">{testResult.region}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-500">ARN</p>
                      <p className="font-mono text-gray-300 break-all">{testResult.arn}</p>
                    </div>
                  </div>
                ) : (
                  <p className="flex items-center gap-1.5 text-red-400">
                    <XCircle size={12} /> {testResult.error}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* IAM Permissions accordion — right column */}
          <PolicyAccordion />
        </div>
      </div>

      {/* ── Additional Accounts ─────────────────────────────────── */}
      {isElectron && (
        <div className="space-y-4 mt-8 pt-8 border-t border-[#1a1a1a]">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-gray-500" />
            <h2 className="text-sm font-medium text-white">Additional Accounts</h2>
            <span className="text-[11px] text-gray-600">Switch profiles from the sidebar</span>
          </div>

          {profiles.length > 0 && (
            <div className="space-y-2">
              {profiles.map(p => (
                <div key={p.id} className="card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-indigo-950/40 rounded-lg"><Globe size={12} className="text-indigo-400" /></div>
                    <div>
                      <p className="text-xs font-medium text-white">{p.name}</p>
                      <p className="text-[11px] text-gray-600 font-mono mt-0.5">
                        {p.accessKeyId} · {p.secretKeyMasked} · {p.region}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteProfile(p.id)}
                    className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 size={11} /> Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="card p-5 space-y-4">
            <h3 className="text-xs font-medium text-gray-400">Add account profile</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Profile Name</label>
                <input type="text" value={profileForm.name}
                  onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Production, Staging…"
                  className="w-full px-3 py-2.5 text-sm bg-[#0e0e0e] border border-[#1e1e1e] rounded-lg text-white placeholder-gray-700 focus:outline-none focus:border-red-800 transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Region</label>
                <select value={profileForm.region} onChange={e => setProfileForm(f => ({ ...f, region: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-[#0e0e0e] border border-[#1e1e1e] rounded-lg text-white focus:outline-none focus:border-red-800 transition-colors appearance-none cursor-pointer">
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Access Key ID</label>
                <input type="text" value={profileForm.accessKeyId}
                  onChange={e => setProfileForm(f => ({ ...f, accessKeyId: e.target.value }))}
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  className="w-full px-3 py-2.5 text-sm bg-[#0e0e0e] border border-[#1e1e1e] rounded-lg text-white placeholder-gray-700 font-mono focus:outline-none focus:border-red-800 transition-colors"
                  autoComplete="off" spellCheck={false} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Secret Access Key</label>
                <div className="relative">
                  <input type={showProfileSecret ? 'text' : 'password'} value={profileForm.secretKey}
                    onChange={e => setProfileForm(f => ({ ...f, secretKey: e.target.value }))}
                    placeholder="wJalrXUtnFEMI/K7MDENG/…"
                    className="w-full px-3 py-2.5 pr-10 text-sm bg-[#0e0e0e] border border-[#1e1e1e] rounded-lg text-white placeholder-gray-700 font-mono focus:outline-none focus:border-red-800 transition-colors"
                    autoComplete="new-password" spellCheck={false} />
                  <button onClick={() => setShowProfileSecret(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors">
                    {showProfileSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            {profileError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5"><XCircle size={12} /> {profileError}</p>
            )}
            <div className="flex items-center gap-3">
              <button onClick={handleSaveProfile} disabled={savingProfile}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition-colors font-medium">
                {savingProfile ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                {savingProfile ? 'Saving…' : 'Add profile'}
              </button>
              {profileSaved && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 size={13} /> Profile saved
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
