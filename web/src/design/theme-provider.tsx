import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getTheme, type Theme, type ThemeMode } from '@cura/shared';

/**
 * Theme distribution.
 *
 * Tokens from `@cura/shared` are projected onto CSS custom properties once, at
 * the document root. Components then style themselves with `var(--color-...)`,
 * which means:
 *  - Switching light/dark repaints via CSS without re-rendering the React tree.
 *  - No component holds a colour value, so a rebrand is a token change only.
 *  - The same token names exist in the React Native app, where they are read
 *    from the object directly.
 */

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'cura.theme-mode';

function flattenToCssVariables(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {};

  const walk = (prefix: string, value: unknown): void => {
    if (value === null || value === undefined) return;
    if (typeof value === 'object') {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        walk(`${prefix}-${kebab(key)}`, child);
      }
      return;
    }
    vars[prefix] = typeof value === 'number' ? `${value}px` : String(value);
  };

  walk('--color', theme.colors);
  walk('--space', theme.spacing);
  walk('--radius', theme.radius);
  walk('--shadow', theme.elevation);
  walk('--layout', theme.layout);
  walk('--font', theme.typography.family);
  walk('--text', theme.typography.size);
  walk('--weight', theme.typography.weight);

  // Line heights are unitless multipliers — the generic walker would append px.
  for (const [key, value] of Object.entries(theme.typography.lineHeight)) {
    vars[`--leading-${kebab(key)}`] = String(value);
  }
  for (const [key, value] of Object.entries(theme.motion.duration)) {
    vars[`--duration-${kebab(key)}`] = `${value}ms`;
  }
  for (const [key, value] of Object.entries(theme.motion.easing)) {
    vars[`--ease-${kebab(key)}`] = value;
  }

  return vars;
}

const kebab = (value: string): string => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

function resolveInitialMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(resolveInitialMode);
  const theme = useMemo(() => getTheme(mode), [mode]);

  useEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(flattenToCssVariables(theme))) {
      root.style.setProperty(name, value);
    }
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
    localStorage.setItem(STORAGE_KEY, mode);
  }, [theme, mode]);

  const value = useMemo(() => ({ theme, mode, setMode }), [theme, mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
