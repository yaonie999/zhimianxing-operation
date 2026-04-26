import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [],
  server: {
    errorOverlay: false,
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3101',
        changeOrigin: true
      }
    }
  }
})