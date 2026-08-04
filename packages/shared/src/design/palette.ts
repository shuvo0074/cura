/**
 * Raw colour ramps. Platform-neutral hex values only.
 *
 * Nothing in the application imports this file directly — consumers use the
 * semantic theme in `theme.ts`. Keeping raw ramps separate from semantic roles
 * means a rebrand touches this file only, and every surface follows.
 */

export const ramp = {
  /** Primary brand — clinical, trustworthy blue. */
  brand: {
    50: '#eef6fb',
    100: '#d5e9f5',
    200: '#aed4ea',
    300: '#7cb8db',
    400: '#4a97c7',
    500: '#2b7aad',
    600: '#1f6191',
    700: '#1a4e76',
    800: '#183f5f',
    900: '#0f3d5c',
    950: '#0a2438',
  },

  /** Secondary — restorative teal, used for success/health affordances. */
  teal: {
    50: '#eefbf6',
    100: '#d2f4e8',
    200: '#a8e8d4',
    300: '#71d5bb',
    400: '#3dbb9d',
    500: '#1f9f84',
    600: '#14806b',
    700: '#136657',
    800: '#135146',
    900: '#11433b',
    950: '#062621',
  },

  /** Neutral — UI chrome, text, borders. Slightly cool to sit with brand. */
  neutral: {
    0: '#ffffff',
    50: '#f7fafb',
    100: '#eef2f5',
    200: '#dde5ea',
    300: '#c3d0d8',
    400: '#93a5b1',
    500: '#6b7f8d',
    600: '#516470',
    700: '#3e4e58',
    800: '#2a353d',
    900: '#1a2228',
    950: '#0e1418',
  },

  amber: {
    50: '#fff8eb',
    100: '#ffecc6',
    200: '#ffd688',
    300: '#ffbb4a',
    400: '#ffa11f',
    500: '#f98107',
    600: '#dd5f02',
    700: '#b74106',
    800: '#94330c',
    900: '#7a2b0d',
    950: '#461302',
  },

  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },

  violet: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6',
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
    950: '#2e1065',
  },
} as const;

export type ColorRamp = typeof ramp;
export type RampName = keyof ColorRamp;
