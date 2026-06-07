// Proceedings Design System - Steady Path Theme
// Based on DESIGN.md specifications

export const colors = {
  // Primary
  primary: '#0e3b69',
  onPrimary: '#ffffff',
  primaryContainer: '#2c5282',
  onPrimaryContainer: '#a2c6fd',
  inversePrimary: '#a5c8ff',

  // Secondary (Teal)
  secondary: '#006a68',
  onSecondary: '#ffffff',
  secondaryContainer: '#91f0ed',
  onSecondaryContainer: '#006e6d',

  // Tertiary
  tertiary: '#353b41',
  onTertiary: '#ffffff',
  tertiaryContainer: '#4b5258',
  onTertiaryContainer: '#bfc5cd',

  // Surface
  surface: '#f9f9ff',
  surfaceDim: '#d4daea',
  surfaceBright: '#f9f9ff',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f1f3ff',
  surfaceContainer: '#e8eeff',
  surfaceContainerHigh: '#e3e8f9',
  surfaceContainerHighest: '#dde2f3',
  onSurface: '#161c27',
  onSurfaceVariant: '#43474f',
  inverseSurface: '#2a303d',
  inverseOnSurface: '#ecf0ff',
  surfaceVariant: '#dde2f3',
  surfaceTint: '#3b6090',

  // Outline
  outline: '#737780',
  outlineVariant: '#c3c6d0',

  // Error
  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',

  // Background
  background: '#f9f9ff',
  onBackground: '#161c27',

  // Status colors
  statusResolved: '#059669', // Emerald
  statusInProgress: '#d97706', // Amber
  statusVerified: '#2563eb', // Sapphire

  // Fixed colors
  primaryFixed: '#d4e3ff',
  primaryFixedDim: '#a5c8ff',
  secondaryFixed: '#94f2f0',
  secondaryFixedDim: '#77d6d3',
};

export const typography = {
  displayLg: {
    fontFamily: 'Inter-Bold',
    fontSize: 48,
    fontWeight: '700' as const,
    lineHeight: 56,
    letterSpacing: -0.96, // -0.02em * 48
  },
  headlineLg: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 32,
    fontWeight: '600' as const,
    lineHeight: 40,
    letterSpacing: -0.32, // -0.01em * 32
  },
  headlineLgMobile: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 28,
    fontWeight: '600' as const,
    lineHeight: 36,
  },
  headlineMd: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
  },
  bodyLg: {
    fontFamily: 'Inter-Regular',
    fontSize: 18,
    fontWeight: '400' as const,
    lineHeight: 28,
  },
  bodyMd: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  labelMd: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
    letterSpacing: 0.14, // 0.01em * 14
  },
  caption: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
};

export const spacing = {
  base: 8,
  xs: 4,
  sm: 12,
  md: 24,
  lg: 40,
  xl: 64,
  gutter: 24,
  marginMobile: 16,
  marginDesktop: 48,
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
