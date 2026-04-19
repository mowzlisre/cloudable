import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const isElectron = !!window.electronAPI;

export default function CredentialsGate({ children }) {
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isElectron) { setChecked(true); return; }

    window.electronAPI.hasCredentials().then(has => {
      if (!has && location.pathname !== '/settings') {
        navigate('/settings', { replace: true });
      }
      setChecked(true);
    });
  }, []);

  if (!checked) return null;
  return children;
}
