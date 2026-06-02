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
        // Surface colors
        surface: '#f9f9ff',
        'surface-dim': '#d4daea',
        'surface-bright': '#f9f9ff',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f1f3ff',
        'surface-container': '#e8eeff',
        'surface-container-high': '#e3e8f9',
        'surface-container-highest': '#dde2f3',
        'on-surface': '#161c27',
        'on-surface-variant': '#43474f',
        'inverse-surface': '#2a303d',
        'inverse-on-surface': '#ecf0ff',
        'surface-variant': '#dde2f3',
        'surface-tint': '#3b6090',

        // Primary colors
        primary: '#0e3b69',
        'on-primary': '#ffffff',
        'primary-container': '#2c5282',
        'on-primary-container': '#a2c6fd',
        'inverse-primary': '#a5c8ff',
        'primary-fixed': '#d4e3ff',
        'primary-fixed-dim': '#a5c8ff',
        'on-primary-fixed': '#001c3a',
        'on-primary-fixed-variant': '#204877',

        // Secondary colors
        secondary: '#006a68',
        'on-secondary': '#ffffff',
        'secondary-container': '#91f0ed',
        'on-secondary-container': '#006e6d',
        'secondary-fixed': '#94f2f0',
        'secondary-fixed-dim': '#77d6d3',
        'on-secondary-fixed': '#00201f',
        'on-secondary-fixed-variant': '#00504e',

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
        background: '#f9f9ff',
        'on-background': '#161c27',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-lg-mobile': ['28px', { lineHeight: '36px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'label-md': ['14px', { lineHeight: '20px', letterSpacing: '0.01em', fontWeight: '500' }],
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
      spacing: {
        'base': '8px',
        'xs': '4px',
        'gutter': '24px',
        'margin-mobile': '16px',
        'margin-desktop': '48px',
      },
      maxWidth: {
        'content': '720px',
      },
    },
  },
  plugins: [],
}
export default config
