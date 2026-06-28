// Meridian Design System — Clean red brand identity
// Meridian red (dominant) · neutral gray (secondary) · crisp near-white ground.
import { Platform } from 'react-native';

// Font families for backward compatibility
export const fonts = {
  heading: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  headingBold: Platform.OS === 'ios' ? 'Georgia-Bold' : 'serif',
  headingItalic: Platform.OS === 'ios' ? 'Georgia-Italic' : 'serif',
  body: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  bodyMedium: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  bodyHeavy: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  bodyBlack: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
};

export const colors = {
  // Primary (Meridian red)
  primary: '#AE0000',
  onPrimary: '#ffffff',
  primaryContainer: '#FFEBEB',
  onPrimaryContainer: '#5C0000',
  inversePrimary: '#FFCDD2',

  // Secondary (neutral gray)
  secondary: '#4A4A4A',
  onSecondary: '#ffffff',
  secondaryContainer: '#E8E8E8',
  onSecondaryContainer: '#2A2A2A',

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
  surfaceTint: '#AE0000',

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
  primaryFixed: '#FFEBEB',
  primaryFixedDim: '#FFCDD2',
  secondaryFixed: '#E8E8E8',
  secondaryFixedDim: '#CCCCCC',

  // Liquid Glass Palette (AI Assistant screen only)
  glass: {
    gradientTop: '#E9E7F6',
    gradientBottom: '#C9CEE8',
    surface: 'rgba(255, 255, 255, 0.50)',
    border: 'rgba(255, 255, 255, 0.6)',
    divider: 'rgba(200, 200, 220, 0.3)',
  },

  // Cool accent (for AI screens)
  coolAccent: '#8B5CF6',
  coolAccentLight: '#A78BFA',
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
  // Glass shadow (used by AI Chat components)
  glass: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 3,
  },
};

export default {
  colors,
  fonts,
  typography,
  spacing,
  borderRadius,
  shadows,
};
