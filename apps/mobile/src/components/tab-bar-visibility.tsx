import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Lets a screen hide the floating tab bar — the map's detail sheet covers the
 * bottom of the screen, so the bar would sit on top of its content.
 *
 * The tab bar is rendered by the navigator rather than by the screen, so the
 * two can't talk through props; this context sits above both.
 */
const TabBarVisibility = createContext<{ hidden: boolean; setHidden: (hidden: boolean) => void }>({
  hidden: false,
  // No-op by default so components still work outside the tabs (dev screens).
  setHidden: () => {},
});

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHiddenState] = useState(false);
  const setHidden = useCallback((next: boolean) => setHiddenState(next), []);
  const value = useMemo(() => ({ hidden, setHidden }), [hidden, setHidden]);
  return <TabBarVisibility.Provider value={value}>{children}</TabBarVisibility.Provider>;
}

export function useTabBarVisibility() {
  return useContext(TabBarVisibility);
}
