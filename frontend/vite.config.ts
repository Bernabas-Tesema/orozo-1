import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Production builds land in Django so cPanel can serve the portal from one Python app
// (no Node.js runtime required on the host).
const djangoFrontendDist = path.resolve(__dirname, '../backend/frontend_dist');

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    root: path.resolve(__dirname),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: djangoFrontendDist,
      emptyOutDir: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
