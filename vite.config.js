import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    'import.meta.env.VERCEL_ENV': JSON.stringify(
      process.env.VERCEL_ENV || (mode === 'development' ? 'development' : '')
    ),
  },
  plugins: [react()]
}));
