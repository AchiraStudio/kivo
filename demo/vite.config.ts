import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import pkg from '../package.json';

// The showcase site is built from the repository root's dependencies on purpose: the demo
// renders the real Kivo UI (../src), so React, Tailwind and the design tokens must be the
// very same copies the app uses. Run it with `npm run demo:dev` / `npm run demo:build`.
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here('.'),
  // Relative base so the site works from any sub-path (GitHub Pages project sites).
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  css: {
    // Reuse the app's PostCSS (Tailwind v4) config from the repository root.
    postcss: here('..'),
  },
  server: { host: true, port: 1430, strictPort: false, fs: { allow: [here('..')] } },
  build: {
    outDir: here('dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      input: {
        main: here('index.html'),
        app: here('app.html'),
      },
    },
  },
});
