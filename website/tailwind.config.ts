import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Brand: Meridian — Clean red brand identity
        // Meridian red (dominant) · neutral gray (secondary) · crisp near-white ground.

        // Surface colors (crisp, cool near-white ground)
        surface: '#fbfcff',
        'surface-dim': '#d4daea',
        'surface-bright': '#fbfcff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f1f4fb',
        'surface-container': '#e8eef8',
        'surface-container-high': '#e1e8f4',
        'surface-container-highest': '#dae1f0',
        'on-surface': '#15202e',
        'on-surface-variant': '#43474f',
        'inverse-surface': '#2a303d',
        'inverse-on-surface': '#ecf0ff',
        'surface-variant': '#dde2f3',
        'surface-tint': '#AE0000',

        // Primary colors (Meridian red)
        primary: '#AE0000',
        'on-primary': '#ffffff',
        'primary-container': '#FFEBEB',
        'on-primary-container': '#5C0000',
        'inverse-primary': '#FFCDD2',
        'primary-fixed': '#FFEBEB',
        'primary-fixed-dim': '#FFCDD2',
        'on-primary-fixed': '#5C0000',
        'on-primary-fixed-variant': '#8B0000',

        // Secondary colors (neutral gray)
        secondary: '#4A4A4A',
        'on-secondary': '#ffffff',
        'secondary-container': '#E8E8E8',
        'on-secondary-container': '#2A2A2A',
        'secondary-fixed': '#E8E8E8',
        'secondary-fixed-dim': '#CCCCCC',
        'on-secondary-fixed': '#1A1A1A',
        'on-secondary-fixed-variant': '#3A3A3A',

        // Accent colors (flame red — reserved for highlights & emphasis)
        accent: '#d62828',
        'on-accent': '#ffffff',
        'accent-container': '#fbe0de',
        'on-accent-container': '#8e1b1b',

        // Success colors (kept distinct for positive states)
        success: '#0f7b53',
        'on-success': '#ffffff',
        'success-container': '#c8f0dd',
        'on-success-container': '#00432b',

        // Status colors
        'status-resolved': '#0f7b53',
        'status-in-progress': '#d97706',
        'status-verified': '#2c6fb5',

        // Tertiary colors
        tertiary: '#353b41',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#4b5258',
        'on-tertiary-container': '#bfc5cd',
        'tertiary-fixed': '#dde3eb',
        'tertiary-fixed-dim': '#c1c7cf',
        'on-tertiary-fixed': '#161c22',
        'on-tertiary-fixed-variant': '#41474e',

        // Outline colors
        outline: '#737780',
        'outline-variant': '#c3c6d0',

        // Error colors
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',

        // Background
        background: '#fbfcff',
        'on-background': '#15202e',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['var(--font-lora)', 'Lora', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      // Type scale tightened per UI-beautify.md §3.1 (smaller) — larger sizes
      // trimmed more, body −1px, caption held at 12px for legibility.
      fontSize: {
        'display-lg': ['40px', { lineHeight: '46px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['27px', { lineHeight: '34px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-lg-mobile': ['24px', { lineHeight: '31px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md': ['20px', { lineHeight: '27px', fontWeight: '600' }],
        'body-lg': ['17px', { lineHeight: '26px', fontWeight: '400' }],
        'body-md': ['15px', { lineHeight: '22px', fontWeight: '400' }],
        'label-md': ['13px', { lineHeight: '18px', letterSpacing: '0.01em', fontWeight: '500' }],
        'caption': ['12px', { lineHeight: '16px', fontWeight: '400' }],
      },
      borderRadius: {
        'sm': '0.25rem',
        'DEFAULT': '0.5rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.5rem',
        'full': '9999px',
      },
      // Spacing tightened per UI-beautify.md §3.2 (less white space).
      spacing: {
        'base': '8px',
        'xs': '4px',
        'gutter': '16px',
        'margin-mobile': '12px',
        'margin-desktop': '32px',
      },
      maxWidth: {
        'content': '720px',
      },
    },
  },
  plugins: [],
}
export default config
