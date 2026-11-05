import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The browser must reach the API through this same-origin proxy: it sends no
// CORS headers for other origins, and its refresh cookie is SameSite=Strict.
const apiProxy = process.env.API_PROXY_URL ?? 'https://cura-api-otxn.onrender.com'
const proxy = { '/api': { target: apiProxy, changeOrigin: true, xfwd: true } }

export default defineConfig({
  plugins: [react()],
  server: { host: true, proxy },
  preview: { host: true, port: 5173, allowedHosts: true, proxy },
})
