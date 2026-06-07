import { defineConfig } from 'vitest/config'
import path from 'path'

// Minimal Vitest harness for the React components (jsdom + Testing Library).
// esbuild's automatic JSX runtime (react/jsx-runtime) avoids needing a React
// import in every file and sidesteps the ESM-only @vitejs/plugin-react loader.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
})
