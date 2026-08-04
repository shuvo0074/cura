import { ramp } from './palette';

/**
 * Semantic design tokens.
 *
 * Views never reference `ramp` or literal hex codes. They reference semantic
 * roles (`surface.raised`, `text.muted`, `status.waiting`), so light/dark and
 * any future white-label theme swap without touching a single component.
 */

export type ThemeMode = 'light' | 'dark';

export interface ColorTokens {
  brand: {
    default: string;
    hover: string;
    pressed: string;
    subtle: string;
    onBrand: string;
  };
  surface: {
    canvas: string;
    raised: string;
    sunken: string;
    overlay: string;
    inverted: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverted: string;
    onBrand: string;
    link: string;
  };
  border: {
    subtle: string;
    default: string;
    strong: string;
    focus: string;
  };
  feedback: {
    successFg: string;
    successBg: string;
    warningFg: string;
    warningBg: string;
    dangerFg: string;
    dangerBg: string;
    infoFg: string;
    infoBg: string;
  };
  /**
   * Appointment queue states from the specification's Status Summary
   * (Waiting / Engaged / Done / Cancelled). Encoded as tokens so the calendar,
   * the counters and the mobile app cannot drift apart.
   */
  status: {
    waiting: string;
    waitingBg: string;
    engaged: string;
    engagedBg: string;
    done: string;
    doneBg: string;
    cancelled: string;
    cancelledBg: string;
  };
  /** Patient visit-type prefixes: N (new) / F (follow-up) / O (old). */
  visitType: {
    new: string;
    followUp: string;
    old: string;
  };
}

const lightColors: ColorTokens = {
  brand: {
    default: ramp.brand[900],
    hover: ramp.brand[800],
    pressed: ramp.brand[950],
    subtle: ramp.brand[50],
    onBrand: ramp.neutral[0],
  },
  surface: {
    canvas: ramp.neutral[50],
    raised: ramp.neutral[0],
    sunken: ramp.neutral[100],
    overlay: 'rgba(14, 20, 24, 0.55)',
    inverted: ramp.neutral[900],
  },
  text: {
    primary: ramp.neutral[900],
    secondary: ramp.neutral[700],
    muted: ramp.neutral[500],
    inverted: ramp.neutral[0],
    onBrand: ramp.neutral[0],
    link: ramp.brand[600],
  },
  border: {
    subtle: ramp.neutral[200],
    default: ramp.neutral[300],
    strong: ramp.neutral[400],
    focus: ramp.brand[500],
  },
  feedback: {
    successFg: ramp.teal[700],
    successBg: ramp.teal[50],
    warningFg: ramp.amber[700],
    warningBg: ramp.amber[50],
    dangerFg: ramp.red[700],
    dangerBg: ramp.red[50],
    infoFg: ramp.brand[700],
    infoBg: ramp.brand[50],
  },
  status: {
    waiting: ramp.amber[700],
    waitingBg: ramp.amber[100],
    engaged: ramp.brand[700],
    engagedBg: ramp.brand[100],
    done: ramp.teal[700],
    doneBg: ramp.teal[100],
    cancelled: ramp.neutral[600],
    cancelledBg: ramp.neutral[200],
  },
  visitType: {
    new: ramp.teal[600],
    followUp: ramp.brand[600],
    old: ramp.neutral[500],
  },
};

const darkColors: ColorTokens = {
  brand: {
    default: ramp.brand[300],
    hover: ramp.brand[200],
    pressed: ramp.brand[400],
    subtle: ramp.brand[950],
    onBrand: ramp.neutral[950],
  },
  surface: {
    canvas: ramp.neutral[950],
    raised: ramp.neutral[900],
    sunken: ramp.neutral[950],
    overlay: 'rgba(0, 0, 0, 0.68)',
    inverted: ramp.neutral[50],
  },
  text: {
    primary: ramp.neutral[50],
    secondary: ramp.neutral[300],
    muted: ramp.neutral[400],
    inverted: ramp.neutral[950],
    onBrand: ramp.neutral[950],
    link: ramp.brand[300],
  },
  border: {
    subtle: ramp.neutral[800],
    default: ramp.neutral[700],
    strong: ramp.neutral[600],
    focus: ramp.brand[400],
  },
  feedback: {
    successFg: ramp.teal[300],
    successBg: ramp.teal[950],
    warningFg: ramp.amber[300],
    warningBg: ramp.amber[950],
    dangerFg: ramp.red[300],
    dangerBg: ramp.red[950],
    infoFg: ramp.brand[300],
    infoBg: ramp.brand[950],
  },
  status: {
    waiting: ramp.amber[300],
    waitingBg: ramp.amber[950],
    engaged: ramp.brand[300],
    engagedBg: ramp.brand[950],
    done: ramp.teal[300],
    doneBg: ramp.teal[950],
    cancelled: ramp.neutral[400],
    cancelledBg: ramp.neutral[800],
  },
  visitType: {
    new: ramp.teal[300],
    followUp: ramp.brand[300],
    old: ramp.neutral[400],
  },
};

/** 4px base scale. Numeric so React Native can use it directly. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const typography = {
  family: {
    sans: 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif',
    mono: '"SF Mono", Menlo, Consolas, monospace',
  },
  size: {
    xs: 11,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.45,
    relaxed: 1.65,
  },
} as const;

export const elevation = {
  none: 'none',
  sm: '0 1px 2px rgba(14,20,24,0.06), 0 1px 3px rgba(14,20,24,0.08)',
  md: '0 2px 6px rgba(14,20,24,0.08), 0 4px 12px rgba(14,20,24,0.06)',
  lg: '0 8px 24px rgba(14,20,24,0.12)',
} as const;

export const motion = {
  duration: { instant: 0, fast: 120, normal: 200, slow: 320 },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0, 1)',
    accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  },
} as const;

/** Layout constants the calendar and dashboard shell depend on. */
export const layout = {
  headerHeight: 56,
  sidebarWidth: 232,
  sidebarCollapsedWidth: 64,
  calendarLeftPaneWidth: 260,
  calendarRightPaneWidth: 300,
  /** Height in px of one minute of calendar grid. Drives slot geometry. */
  calendarPixelsPerMinute: 1.6,
  contentMaxWidth: 1600,
} as const;

export interface Theme {
  mode: ThemeMode;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  elevation: typeof elevation;
  motion: typeof motion;
  layout: typeof layout;
}

const base = { spacing, radius, typography, elevation, motion, layout };

export const lightTheme: Theme = { mode: 'light', colors: lightColors, ...base };
export const darkTheme: Theme = { mode: 'dark', colors: darkColors, ...base };

export const themes: Record<ThemeMode, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};

export function getTheme(mode: ThemeMode): Theme {
  return themes[mode];
}
