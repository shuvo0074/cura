import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { getTheme, type Theme, type ThemeMode } from '@cura/shared';

/**
 * Theme distribution for React Native.
 *
 * This is the only file that differs from the web theming layer, and only in
 * *delivery*: the web projects tokens onto CSS custom properties, while RN
 * consumes the same token object directly through `StyleSheet`. The token
 * values themselves — colours, spacing, radii, the Waiting/Engaged/Done status
 * palette — come from `@cura/shared`, so the two apps cannot drift.
 */

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<ThemeMode | null>(null);

  const mode: ThemeMode = override ?? (systemScheme === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => getTheme(mode), [mode]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, mode, setMode: setOverride }),
    [theme, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/**
 * Builds a memoised StyleSheet from the active theme.
 *
 * Styles are recreated only when the theme object changes, so a re-render does
 * not rebuild the sheet on every frame.
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const { theme } = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
