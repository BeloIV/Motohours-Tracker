import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5002,
    // No allowedHosts: the public host must never reach the dev server
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:3002',
        changeOrigin: true
      },
      '/uploads': {
        target: process.env.BACKEND_URL || 'http://localhost:3002',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
}) 