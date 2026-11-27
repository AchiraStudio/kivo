import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type SiteTheme = 'dark' | 'light';

const Ctx = createContext<{ theme: SiteTheme; toggle: () => void } | null>(null);

export function SiteThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<SiteTheme>(() => (document.documentElement.classList.contains('light') ? 'light' : 'dark'));

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    try { localStorage.setItem('kivo-site-theme', theme); } catch { /* ignore */ }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e1013' : '#f7f7f8');
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const value = useMemo(() => ({ theme, toggle }), [theme, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSiteTheme = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSiteTheme outside provider');
  return v;
};
