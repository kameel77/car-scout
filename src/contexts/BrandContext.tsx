import React, { createContext, useContext, useEffect, useState } from 'react';
import { BrandConfig } from '../types/brand';

// Import configurations statically to avoid dynamic import issues in simple setups,
// though in a very large app we might lazy load them.
import { carsalonConfig } from '../brands/carsalon/config';
import { motoliaConfig } from '../brands/motolia/config';

interface BrandContextType {
  config: BrandConfig;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

const brandMap: Record<string, BrandConfig> = {
  carsalon: carsalonConfig,
  motolia: motoliaConfig,
};

const brandId = (import.meta.env.VITE_BRAND as string) || 'carsalon';
export const activeBrandConfig: BrandConfig = brandMap[brandId] || carsalonConfig;

/**
 * Wstrzykuje tokeny marki do :root. Wywoływane raz, synchronicznie z main.tsx
 * przed pierwszym renderem — dzięki temu nagłówki nie mrugają krojem zastępczym,
 * a przyciski nie pokazują koloru domyślnego.
 */
export function applyBrandTokens(config: BrandConfig = activeBrandConfig): void {
  const root = document.documentElement;

  root.style.setProperty('--primary', config.colors.primary);
  root.style.setProperty('--accent', config.colors.accent);

  // Foreground colors (text on top of primary/accent backgrounds)
  // Default: white (0 0% 100%) — override per brand as needed
  root.style.setProperty(
    '--primary-foreground',
    config.colors.primaryForeground ?? '0 0% 100%'
  );
  root.style.setProperty(
    '--accent-foreground',
    config.colors.accentForeground ?? '0 0% 100%'
  );

  if (config.colors.primaryHover) {
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${config.colors.primary}) 0%, hsl(${config.colors.primaryHover}) 100%)`);
  }

  if (config.colors.accentHover) {
    root.style.setProperty('--gradient-accent', `linear-gradient(135deg, hsl(${config.colors.accent}) 0%, hsl(${config.colors.accentHover}) 100%)`);
  }

  // Kroje pisma per marka (brandbook rozdz. 02). Tailwind czyta je przez
  // font-heading / font-body, więc podmiana działa bez zmian w komponentach.
  if (config.fonts?.heading) {
    root.style.setProperty('--font-heading', config.fonts.heading);
  }
  if (config.fonts?.body) {
    root.style.setProperty('--font-body', config.fonts.body);
  }

  // Marka na <html> — pozwala scopować wyjątki w CSS bez zmian w JS.
  root.setAttribute('data-brand', config.id);
}

export const BrandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config] = useState<BrandConfig>(activeBrandConfig);

  useEffect(() => {
    applyBrandTokens(config);
  }, [config]);

  return (
    <BrandContext.Provider value={{ config }}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
};
