import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiProxy = process.env.API_PROXY_URL ?? 'http://127.0.0.1:4000'
const minioProxy = process.env.MINIO_PROXY_URL ?? 'http://192.168.100.31:9000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': { target: apiProxy, changeOrigin: true, xfwd: true },
      '/cura-media': { target: minioProxy, changeOrigin: true },
    },
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': { target: apiProxy, changeOrigin: true, xfwd: true },
      '/cura-media': { target: minioProxy, changeOrigin: true },
    },
  },
})
