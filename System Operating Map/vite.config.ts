import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Plain Vite + React preview. Runs on http://localhost:5173.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false, host: true },
});
