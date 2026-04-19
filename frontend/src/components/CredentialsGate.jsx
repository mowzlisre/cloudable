import { useEffect, useState } from 'react';
import Onboarding from '../pages/Onboarding';

const isElectron = !!window.electronAPI;

export default function CredentialsGate({ children }) {
  const [checked, setChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!isElectron) { setChecked(true); return; }
    window.electronAPI.hasCredentials().then(has => {
      if (!has) setNeedsOnboarding(true);
      setChecked(true);
    });
  }, []);

  if (!checked) return null;

  if (needsOnboarding) {
    return <Onboarding onComplete={() => setNeedsOnboarding(false)} />;
  }

  return children;
}
