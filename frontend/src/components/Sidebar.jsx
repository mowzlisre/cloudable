import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Server, Database, HardDrive, Box,
  DollarSign, FileText, Map, HeartPulse, TrendingDown, Globe,
  Settings, CloudLightning, ChevronDown, ExternalLink, HelpCircle,
  Layers, ChevronUp,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import ProfileSwitcher from './ProfileSwitcher';

const NAV = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/organizations', icon: Building2,        label: 'Organizations' },
  {
    key: 'services', icon: Layers, label: 'Services',
    children: [
      { to: '/services/ec2',    icon: Server,    label: 'EC2' },
      { to: '/services/rds',    icon: Database,  label: 'RDS' },
      { to: '/services/s3',     icon: HardDrive, label: 'S3' },
      { to: '/services/others', icon: Box,       label: 'Others' },
    ],
  },
  {
    key: 'billing', icon: DollarSign, label: 'Billing & Cost',
    children: [
      { to: '/billing/overview', icon: DollarSign, label: 'Overview' },
      { to: '/invoice',          icon: FileText,   label: 'Invoice' },
    ],
  },
  { to: '/mapper',      icon: Map,         label: 'Resource Map' },
  { to: '/hygiene',     icon: HeartPulse,  label: 'Cloud Hygiene' },
  { to: '/rightsizing', icon: TrendingDown, label: 'Rightsizing' },
  { to: '/aggregator',  icon: Globe,        label: 'Multi-Account' },
];

function NavItem({ item, depth = 0 }) {
  const location = useLocation();
  const isChildActive = item.children?.some(c => location.pathname.startsWith(c.to));
  const [open, setOpen] = useState(isChildActive);

  useEffect(() => { if (isChildActive) setOpen(true); }, [isChildActive]);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
            isChildActive
              ? 'text-red-400 bg-red-950/20 font-medium'
              : 'text-gray-500 hover:text-gray-200 hover:bg-[#161616]'
          }`}
        >
          <span className="flex items-center gap-3">
            <item.icon size={15} className={isChildActive ? 'text-red-400' : ''} />
            {item.label}
          </span>
          <ChevronDown size={12} className={`text-gray-600 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="ml-5 mt-0.5 space-y-0.5 border-l border-[#1e1e1e] pl-3">
            {item.children.map(child => (
              <NavLink
                key={child.to}
                to={child.to}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs transition-all duration-150 ${
                    isActive
                      ? 'text-red-400 bg-red-950/30 font-medium'
                      : 'text-gray-500 hover:text-gray-200 hover:bg-[#161616]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <child.icon size={13} className={isActive ? 'text-red-400' : ''} />
                    {child.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
          isActive
            ? 'bg-red-950/40 text-red-400 border-l-2 border-red-500 pl-[10px] font-medium'
            : 'text-gray-500 hover:text-gray-200 hover:bg-[#161616]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <item.icon size={15} className={isActive ? 'text-red-400' : ''} />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

const REGION_LIST = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1', 'eu-north-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-south-1',
  'ca-central-1', 'sa-east-1',
];

function RegionSwitcher() {
  const [region, setRegion] = useState('us-east-1');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    window.electronAPI?.loadDefaultRegion().then(r => r && setRegion(r));
  }, []);

  async function handleSelect(r) {
    setRegion(r);
    setOpen(false);
    await window.electronAPI?.saveDefaultRegion(r);
  }

  return (
    <div className="px-3 pb-2 relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs bg-[#0e0e0e] border border-[#1a1a1a] hover:border-[#252525] transition-colors"
      >
        <span className="flex items-center gap-2 text-gray-500">
          <Globe size={13} />
          <span className="text-gray-600">Region</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="font-mono text-red-400 text-[11px]">{region}</span>
          {open ? <ChevronUp size={10} className="text-gray-600" /> : <ChevronDown size={10} className="text-gray-600" />}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-3 right-3 bottom-full mb-1 z-20 rounded-xl border border-[#1e1e1e] overflow-hidden shadow-xl" style={{ background: '#111111', maxHeight: 220, overflowY: 'auto' }}>
            {REGION_LIST.map(r => (
              <button
                key={r}
                onClick={() => handleSelect(r)}
                className={`w-full text-left px-3 py-1.5 text-[11px] font-mono transition-colors ${
                  r === region ? 'text-red-400 bg-red-950/30' : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    staleTime: 10 * 60 * 1000,
  });

  function openFaq() {
    if (window.electronAPI?.openExternal) window.electronAPI.openExternal('https://cloudable.mowzlisre.me/faq');
    else window.open('https://cloudable.mowzlisre.me/faq', '_blank', 'noopener');
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col h-full" style={{ background: '#0c0c0c', borderRight: '1px solid #1a1a1a' }}>
      {/* Brand */}
      <div className="px-5 py-4 flex items-center gap-2.5 border-b border-[#1a1a1a] shrink-0">
        <div className="p-1.5 rounded-lg bg-red-600 shadow-lg shadow-red-900/40">
          <CloudLightning size={14} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-none">Cloudable</p>
          <p className="text-[10px] text-gray-600 mt-0.5">Cost Intelligence</p>
        </div>
      </div>

      {/* Nav — scrollable, fills remaining height */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto min-h-0">
        {NAV.map(item => (
          <NavItem key={item.to ?? item.key} item={item} />
        ))}
      </nav>

      {/* Bottom section — never scrolls */}
      <div className="shrink-0">
        {/* Region switcher */}
        <RegionSwitcher />

        {/* Settings + FAQ */}
        <div className="px-3 pb-1 space-y-0.5 border-t border-[#1a1a1a] pt-2">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-red-950/40 text-red-400 border-l-2 border-red-500 pl-[10px] font-medium'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-[#161616]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Settings size={15} className={isActive ? 'text-red-400' : ''} />
                Settings
              </>
            )}
          </NavLink>
          <button
            onClick={openFaq}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-200 hover:bg-[#161616] transition-all duration-150"
          >
            <span className="flex items-center gap-3">
              <HelpCircle size={15} />
              FAQ
            </span>
            <ExternalLink size={10} className="text-gray-700" />
          </button>
        </div>

        {/* Profile switcher */}
        <ProfileSwitcher />

        {/* Connection status */}
        <div className="px-4 py-3 border-t border-[#1a1a1a]">
          <div className="flex items-center gap-2 mb-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${health?.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-[10px] text-gray-500">
              {health?.status === 'ok' ? 'Connected' : 'Not connected'}
            </span>
          </div>
          {health?.account && <p className="text-[10px] font-mono text-gray-600 truncate">{health.account}</p>}
          {health?.region  && <p className="text-[10px] text-gray-700">{health.region}</p>}
        </div>
      </div>
    </aside>
  );
}
