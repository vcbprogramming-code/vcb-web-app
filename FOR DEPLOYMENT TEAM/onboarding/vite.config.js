import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// @vcb/shared is a sibling folder, not an installed package. The explicit alias
// plus dedupe means Vite resolves its .jsx sources through this app's own React
// copy — two Reacts would break every hook.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@vcb/shared': fileURLToPath(new URL('../shared/src/index.js', import.meta.url)),
    },
    dedupe: ['react', 'react-dom'],
  },
  // The shared package lives outside the project root, so Vite must be allowed
  // to serve and pre-bundle from there.
  server: {
    port: 5174,
    fs: { allow: ['..'] },
  },
  optimizeDeps: {
    // Source files, not a built package — let Vite compile them with the app.
    exclude: ['@vcb/shared'],
  },
})
