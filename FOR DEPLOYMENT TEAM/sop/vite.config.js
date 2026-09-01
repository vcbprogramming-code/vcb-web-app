import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// `@vcb/shared` is a sibling folder, not an installed package, so it is aliased
// rather than resolved from node_modules. Vite must also be told it is allowed
// to serve files from outside this module's root, or the dev server refuses to
// read ../shared/src.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@vcb/shared': fileURLToPath(new URL('../shared/src/index.js', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
    host: true,
    fs: { allow: ['..'] },
  },
});
