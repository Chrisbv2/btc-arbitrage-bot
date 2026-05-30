import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // SSE endpoint — must be listed before the generic /api rule.
      // compress:false prevents Vite's gzip middleware from buffering the
      // never-ending stream, which would cause events to never reach the browser.
      '/api/stream': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        compress: false,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Ensure no intermediate cache or compression touches SSE frames
            proxyRes.headers['cache-control'] = 'no-cache';
            proxyRes.headers['x-accel-buffering'] = 'no';
          });
        },
      },
      // REST API — generic catch-all
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
