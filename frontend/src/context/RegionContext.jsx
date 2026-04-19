import { createContext, useContext, useState, useEffect } from 'react';

const RegionContext = createContext();

export function RegionProvider({ children }) {
  const [region, setRegionState] = useState(
    import.meta.env.VITE_AWS_REGION || 'us-east-1'
  );

  useEffect(() => {
    window.electronAPI?.loadDefaultRegion().then(r => r && setRegionState(r));
  }, []);

  async function setRegion(r) {
    setRegionState(r);
    await window.electronAPI?.saveDefaultRegion(r);
  }

  return (
    <RegionContext.Provider value={{ region, setRegion }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
