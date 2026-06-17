// meridianjourney.ai Design System — USA-flag brand identity
// flag navy (dominant) · liberty blue · flame red (accent only) · crisp
// near-white ground. Reference: logo3-vivid.jpeg. Mirrors website/tailwind.config.ts.

export const colors = {
  // Primary (flag navy)
  primary: '#15487e',
  onPrimary: '#ffffff',
  primaryContainer: '#2d5c90',
  onPrimaryContainer: '#c6dbf7',
  inversePrimary: '#a8c7f0',

  // Secondary (liberty blue — replaces the retired teal)
  secondary: '#2c6fb5',
  onSecondary: '#ffffff',
  secondaryContainer: '#d4e3f6',
  onSecondaryContainer: '#103f6e',

  // Accent (flame red — reserved for the mark, highlights & emphasis)
  accent: '#d62828',
  onAccent: '#ffffff',
  accentContainer: '#fbe0de',
  onAccentContainer: '#8e1b1b',

  // Tertiary
  tertiary: '#353b41',
  onTertiary: '#ffffff',
  tertiaryContainer: '#4b5258',
  onTertiaryContainer: '#bfc5cd',

  // Surface (crisp, cool near-white ground)
  surface: '#fbfcff',
  surfaceDim: '#d4daea',
  surfaceBright: '#fbfcff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f1f4fb',
  surfaceContainer: '#e8eef8',
  surfaceContainerHigh: '#e1e8f4',
  surfaceContainerHighest: '#dae1f0',
  onSurface: '#15202e',
  onSurfaceVariant: '#43474f',
  inverseSurface: '#2a303d',
  inverseOnSurface: '#ecf0ff',
  surfaceVariant: '#dde2f3',
  surfaceTint: '#15487e',

  // Outline
  outline: '#737780',
  outlineVariant: '#c3c6d0',

  // Error
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',

  // Background
  background: '#fbfcff',
  onBackground: '#15202e',

  // Status colors
  statusResolved: '#0f7b53', // Green
  statusInProgress: '#d97706', // Amber
  statusVerified: '#2c6fb5', // Liberty blue

  // Fixed colors
  primaryFixed: '#d7e4f8',
  primaryFixedDim: '#a8c7f0',
  secondaryFixed: '#d4e3f6',
  secondaryFixedDim: '#a8c7ec',
};

// Type scale tightened per UI-beautify.md §3.1 (smaller) — larger sizes
// trimmed more, body −1px, caption held at 12px for legibility.
export const typography = {
  displayLg: {
    fontFamily: 'Inter-Bold',
    fontSize: 40,
    fontWeight: '700' as const,
    lineHeight: 46,
    letterSpacing: -0.8, // -0.02em * 40
  },
  headlineLg: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 27,
    fontWeight: '600' as const,
    lineHeight: 34,
    letterSpacing: -0.27, // -0.01em * 27
  },
  headlineLgMobile: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 31,
  },
  headlineMd: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 27,
  },
  bodyLg: {
    fontFamily: 'Inter-Regular',
    fontSize: 17,
    fontWeight: '400' as const,
    lineHeight: 26,
  },
  bodyMd: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  labelMd: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
    letterSpacing: 0.13, // 0.01em * 13
  },
  caption: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
};

// Spacing tightened per UI-beautify.md §3.2 (less white space).
export const spacing = {
  base: 8,
  xs: 4,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 36,
  gutter: 16,
  marginMobile: 14,
  marginDesktop: 32,
  maxWidthContent: 720,
};

export const borderRadius = {
  sm: 4, // 0.25rem
  default: 8, // 0.5rem
  md: 12, // 0.75rem
  lg: 16, // 1rem
  xl: 24, // 1.5rem
  full: 9999,
};

export const shadows = {
  level1: {
    shadowColor: '#1a202c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  level2: {
    shadowColor: '#1a202c',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 32,
    elevation: 4,
  },
};

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
};
