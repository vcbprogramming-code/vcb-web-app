import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Self-contained SPA — deployable to Vercel as a static build (output: dist/).
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
});
