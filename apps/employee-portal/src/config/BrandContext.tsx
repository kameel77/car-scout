import React, { createContext, useContext, useEffect, useState } from 'react';
import { PortalBrandConfig, defaultBrandConfig, loadPortalConfig } from './brand';

interface BrandContextType {
  config: PortalBrandConfig;
  isLoading: boolean;
}

const BrandContext = createContext<BrandContextType>({
  config: defaultBrandConfig,
  isLoading: false,
});

export const BrandProvider: React.FC<{
  children: React.ReactNode;
  initialConfig?: PortalBrandConfig;
}> = ({ children, initialConfig }) => {
  const [config, setConfig] = useState<PortalBrandConfig>(
    initialConfig || defaultBrandConfig
  );
  const [isLoading, setIsLoading] = useState(!initialConfig);

  useEffect(() => {
    if (initialConfig) return;
    let isMounted = true;

    loadPortalConfig()
      .then((loaded) => {
        if (isMounted) {
          setConfig(loaded);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setConfig(defaultBrandConfig);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialConfig]);

  return (
    <BrandContext.Provider value={{ config, isLoading }}>
      {children}
    </BrandContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useBrandConfig = (): BrandContextType => useContext(BrandContext);
