import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// TypeScript-strict React mirror of the VCB E-Memo Apps Script portal.
// UI-only: the Google backend is replaced by a typed mock layer (src/api).
// Static SPA — deployable to Vercel as-is (framework preset: Vite).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  build: { outDir: 'dist' },
})
