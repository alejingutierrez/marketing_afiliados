'use client';

import { ConfigProvider, theme as antdTheme } from 'antd';
import type { ConfigProviderProps } from 'antd/es/config-provider';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';

import { BRAND_THEMES, DEFAULT_BRAND, type BrandKey, type BrandTheme, type ThemeMode } from '@/lib/theme';

interface ThemeContextValue {
  brand: BrandTheme;
  availableBrands: BrandTheme[];
  mode: ThemeMode;
  setBrand: (brand: BrandKey) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [brandKey, setBrandKey] = useState<BrandKey>(DEFAULT_BRAND.key);
  const [mode, setMode] = useState<ThemeMode>('light');

  const setBrand = useCallback((next: BrandKey) => {
    setBrandKey(next);
  }, []);

  const setModeExplicit = useCallback((next: ThemeMode) => {
    setMode(next);
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const { config, brand } = useMemo(() => {
    const selectedBrand = BRAND_THEMES[brandKey] ?? DEFAULT_BRAND;
    const algorithm = mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm;
    const themeConfig: ConfigProviderProps['theme'] = {
      ...selectedBrand.theme,
      algorithm: [algorithm]
    };
    return { config: themeConfig, brand: selectedBrand };
  }, [brandKey, mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      brand,
      availableBrands: Object.values(BRAND_THEMES),
      mode,
      setBrand,
      setMode: setModeExplicit,
      toggleMode
    }),
    [brand, mode, setBrand, setModeExplicit, toggleMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={config}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useThemePreferences(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useThemePreferences debe usarse dentro de ThemeProvider');
  }
  return ctx;
}
