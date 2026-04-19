import { useState } from 'react';
import { Eye, EyeOff, ChevronRight, Github, Linkedin, Instagram, Globe, KeyRound } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const REGIONS = [
  'us-east-1','us-east-2','us-west-1','us-west-2',
  'eu-west-1','eu-west-2','eu-central-1','eu-north-1',
  'ap-southeast-1','ap-southeast-2','ap-northeast-1','ap-south-1',
  'ca-central-1','sa-east-1','af-south-1','me-south-1',
];

const SOCIALS = [
  { icon: Globe,     label: 'Website',   handle: 'mowzlisre.me',       url: 'https://mowzlisre.me' },
  { icon: Github,    label: 'GitHub',    handle: '@mowzlisre',          url: 'https://github.com/mowzlisre' },
  { icon: Linkedin,  label: 'LinkedIn',  handle: 'in/mowzlisre',        url: 'https://linkedin.com/in/mowzlisre' },
  { icon: Instagram, label: 'Instagram', handle: '@mowzlisre',          url: 'https://instagram.com/mowzlisre' },
];

function openLink(url) {
  window.electronAPI?.openExternal(url);
}

// ── Step 0: Welcome ──────────────────────────────────────────────────────────
function StepWelcome({ onNext }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 32 }}>
      <div style={{
        width: 80, height: 80, borderRadius: 22,
        background: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.1) 100%)',
        border: '1px solid rgba(239,68,68,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 40px rgba(239,68,68,0.1)',
      }}>
        <img src="/icon.png" alt="Cloudable" style={{ width: 48, height: 48, borderRadius: 10 }}
          onError={e => { e.target.style.display = 'none'; }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f5f5f5', margin: 0, letterSpacing: -0.5 }}>
          Welcome to Cloudable
        </h1>
        <p style={{ fontSize: 15, color: '#6b7280', margin: 0, lineHeight: 1.6, maxWidth: 400 }}>
          AWS cost intelligence, right on your desktop.
        </p>
        <p style={{ fontSize: 13, color: '#4b5563', margin: 0, lineHeight: 1.7, maxWidth: 380 }}>
          Visualize your AWS spend, map your infrastructure, identify waste,
          and right-size resources — all without leaving your machine.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {['Cost Explorer', 'Resource Map', 'Cloud Hygiene', 'Right-sizing'].map(f => (
          <span key={f} style={{
            fontSize: 11, padding: '4px 10px',
            background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1e1e',
            borderRadius: 20, color: '#6b7280',
          }}>{f}</span>
        ))}
      </div>

      <button onClick={onNext} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '11px 32px', borderRadius: 999,
        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
        border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
        cursor: 'pointer', boxShadow: '0 4px 20px rgba(239,68,68,0.3)',
        transition: 'opacity 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        Get Started <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── Step 1: Social follow ────────────────────────────────────────────────────
function StepSocial({ onNext }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f5f5f5', margin: 0 }}>
          Before we begin — a small ask
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
          Cloudable is built and maintained by one person. A follow goes a long way.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 440 }}>
        {SOCIALS.map(({ icon: Icon, label, handle, url }) => (
          <button key={label} onClick={() => openLink(url)} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.03)', border: '1px solid #1e1e1e',
            cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#2e2e2e'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
          >
            <span style={{ color: '#6b7280', flexShrink: 0 }}><Icon size={16} /></span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#d1d5db' }}>{label}</div>
              <div style={{ fontSize: 11, color: '#4b5563', marginTop: 1 }}>{handle}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <button onClick={onNext} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '11px 32px', borderRadius: 999,
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          border: 'none', color: '#fff', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', boxShadow: '0 4px 20px rgba(239,68,68,0.3)',
          transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Continue <ChevronRight size={16} />
        </button>
        <button onClick={onNext} style={{
          background: 'none', border: 'none', color: '#4b5563',
          fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
        }}>
          Skip
        </button>
      </div>
    </div>
  );
}

// ── Step 2: AWS Credentials ──────────────────────────────────────────────────
function StepCredentials({ onComplete }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ accessKeyId: '', secretKey: '', region: 'us-east-1' });
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
        qc.invalidateQueries();
        onComplete();
      } else {
        setError(result.error || 'Failed to save credentials.');
      }
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', borderRadius: 8,
    background: '#0e0e0e', border: '1px solid #1e1e1e',
    color: '#f5f5f5', fontSize: 13, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, width: '100%', maxWidth: 400 }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f5f5f5', margin: 0 }}>
          Connect your AWS account
        </h2>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
          Your credentials are stored locally and encrypted with your OS keychain.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <div>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 6 }}>
            Access Key ID
          </label>
          <input
            style={inputStyle}
            placeholder="AKIA..."
            value={form.accessKeyId}
            onChange={e => setForm(f => ({ ...f, accessKeyId: e.target.value }))}
            onFocus={e => e.target.style.borderColor = '#2e2e2e'}
            onBlur={e => e.target.style.borderColor = '#1e1e1e'}
            autoComplete="off"
          />
        </div>

        <div>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 6 }}>
            Secret Access Key
          </label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...inputStyle, paddingRight: 40 }}
              type={showSecret ? 'text' : 'password'}
              placeholder="••••••••••••••••••••"
              value={form.secretKey}
              onChange={e => setForm(f => ({ ...f, secretKey: e.target.value }))}
              onFocus={e => e.target.style.borderColor = '#2e2e2e'}
              onBlur={e => e.target.style.borderColor = '#1e1e1e'}
              autoComplete="off"
            />
            <button onClick={() => setShowSecret(s => !s)} style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', padding: 2,
            }}>
              {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 6 }}>
            Default Region
          </label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={form.region}
            onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
          >
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {error && (
          <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>
        )}
      </div>

      <button onClick={handleSave} disabled={saving} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: '100%', padding: '12px', borderRadius: 999,
        background: saving ? '#1a1a1a' : 'linear-gradient(135deg, #ef4444, #dc2626)',
        border: saving ? '1px solid #2a2a2a' : 'none',
        color: saving ? '#4b5563' : '#fff', fontSize: 14, fontWeight: 600,
        cursor: saving ? 'not-allowed' : 'pointer',
        boxShadow: saving ? 'none' : '0 4px 20px rgba(239,68,68,0.3)',
        transition: 'all 0.15s',
      }}>
        <KeyRound size={15} />
        {saving ? 'Saving…' : 'Save'}
      </button>

      <button
        onClick={() => openLink('https://cloudable.mowzlisre.me/#faq')}
        style={{
          background: 'none', border: 'none', color: '#4b5563',
          fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
          padding: 0, marginTop: -8,
        }}
      >
        Have questions?
      </button>
    </div>
  );
}

// ── Main Onboarding component ────────────────────────────────────────────────
export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#080808',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      {/* Step dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 48 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: i === step ? 20 : 6, height: 6, borderRadius: 3,
            background: i === step ? '#ef4444' : i < step ? '#374151' : '#1e1e1e',
            transition: 'all 0.25s',
          }} />
        ))}
      </div>

      {step === 0 && <StepWelcome onNext={() => setStep(1)} />}
      {step === 1 && <StepSocial onNext={() => setStep(2)} />}
      {step === 2 && <StepCredentials onComplete={onComplete} />}
    </div>
  );
}
