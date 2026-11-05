import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split vendor code so app changes do not invalidate the framework
        // chunk in users' caches.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          shared: ['@cura/shared'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    strictPort: true,
    // Set API_PROXY_URL with VITE_API_BASE_URL=/api to develop against a deployed
    // API. It sends no CORS headers for localhost, so the browser must stay same-origin.
    ...(process.env.API_PROXY_URL
      ? { proxy: { '/api': { target: process.env.API_PROXY_URL, changeOrigin: true, xfwd: true } } }
      : {}),
  },
});
