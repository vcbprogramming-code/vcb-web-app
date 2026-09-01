import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static SPA for Vercel. Everything server-side lives behind VITE_API_URL —
// the single Express API at api/ (TECH_STACK.md); the browser never holds
// database credentials and never talks to Supabase directly.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
});
