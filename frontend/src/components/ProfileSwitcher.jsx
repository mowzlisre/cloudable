import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Check, User, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const isElectron = !!window.electronAPI;

export default function ProfileSwitcher() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState('__primary__');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!isElectron) return;
    Promise.all([
      window.electronAPI.loadProfiles(),
      window.electronAPI.getActiveProfileId(),
    ]).then(([p, id]) => { setProfiles(p); setActiveId(id); });
  }, []);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function switchTo(id) {
    if (id === activeId) { setOpen(false); return; }
    await window.electronAPI.setActiveProfile(id);
    setActiveId(id);
    setOpen(false);
    qc.invalidateQueries();
  }

  const allProfiles = [
    { id: '__primary__', name: 'Primary' },
    ...profiles,
  ];
  const current = allProfiles.find(p => p.id === activeId) ?? allProfiles[0];

  if (!isElectron) return null;

  return (
    <div ref={ref} className="relative px-3 pb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:bg-[#161616]"
        style={{ border: '1px solid #1a1a1a' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <User size={11} className="text-gray-600 shrink-0" />
          <span className="text-gray-400 truncate">{current.name}</span>
        </div>
        <ChevronDown size={11} className={`text-gray-600 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-3 right-3 mb-1 rounded-lg overflow-hidden z-50"
          style={{ background: '#111', border: '1px solid #1e1e1e', boxShadow: '0 -4px 16px rgba(0,0,0,0.6)' }}
        >
          {allProfiles.map(p => (
            <button
              key={p.id}
              onClick={() => switchTo(p.id)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-[#1a1a1a]"
            >
              <span className={p.id === activeId ? 'text-red-400 font-medium' : 'text-gray-400'}>{p.name}</span>
              {p.id === activeId && <Check size={11} className="text-red-400" />}
            </button>
          ))}
          <div style={{ borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={() => { setOpen(false); navigate('/settings'); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:text-gray-400 hover:bg-[#1a1a1a] transition-colors"
            >
              <Plus size={11} /> Manage accounts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
