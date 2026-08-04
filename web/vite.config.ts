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
  server: { port: 5173, strictPort: true },
});
