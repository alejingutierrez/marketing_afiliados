'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';

interface LayoutState {
  siderCollapsed: boolean;
  toggleSider: (collapsed?: boolean) => void;
}

const LayoutStateContext = createContext<LayoutState | undefined>(undefined);

export function LayoutStateProvider({ children }: PropsWithChildren) {
  const [siderCollapsed, setSiderCollapsed] = useState(false);

  const toggleSider = useCallback((value?: boolean) => {
    setSiderCollapsed((prev) => (typeof value === 'boolean' ? value : !prev));
  }, []);

  const value = useMemo<LayoutState>(
    () => ({ siderCollapsed, toggleSider }),
    [siderCollapsed, toggleSider]
  );

  return <LayoutStateContext.Provider value={value}>{children}</LayoutStateContext.Provider>;
}

export function useLayoutState(): LayoutState {
  const ctx = useContext(LayoutStateContext);
  if (!ctx) {
    throw new Error('useLayoutState debe usarse dentro de LayoutStateProvider');
  }
  return ctx;
}
