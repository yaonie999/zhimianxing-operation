import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [],
  esbuildTarget: 'chrome120',
  build: {
    target: 'chrome120',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    errorOverlay: false,
    host: '0.0.0.0',
    port: 5175,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3101',
        changeOrigin: true
      }
    }
  }
})
