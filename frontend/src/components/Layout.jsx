import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const isMac = window.electronAPI?.platform === 'darwin';
const TITLEBAR_H = 38;

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#080808', paddingTop: isMac ? TITLEBAR_H : 0 }}>
      {/* macOS draggable title bar — keeps traffic lights from overlapping content */}
      {isMac && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0,
            height: TITLEBAR_H,
            background: '#0c0c0c',
            borderBottom: '1px solid #1a1a1a',
            WebkitAppRegion: 'drag',
            zIndex: 9999,
          }}
        />
      )}
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
