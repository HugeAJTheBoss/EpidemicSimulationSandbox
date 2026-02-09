import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/backend_2.0': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
})
